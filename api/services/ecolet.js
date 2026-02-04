/**
 * SERVICIU ECOLET - API Real (Smart Lookup & Google Maps Data)
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const ECOLET_CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const ECOLET_CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;
const ECOLET_USERNAME = process.env.ECOLET_USERNAME;
const ECOLET_PASSWORD = process.env.ECOLET_PASSWORD;

let cachedToken = null;
let tokenExpiry = null;

/**
 * 1. Autentificare
 */
async function authenticate() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', ECOLET_CLIENT_ID);
    params.append('client_secret', ECOLET_CLIENT_SECRET);
    params.append('username', ECOLET_USERNAME);
    params.append('password', ECOLET_PASSWORD);

    const response = await fetch(`${ECOLET_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: params.toString()
    });

    if (!response.ok) throw new Error(`Ecolet Auth Failed: ${response.status}`);
    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
    return cachedToken;
}

/**
 * 2. Căutare Localitate (Smart Lookup cu Fallback API)
 * Asta e funcția care rezolvă problema Bucureștiului dinamic.
 */
async function getLocalityId(token, county, city) {
    if (!county || !city) return null;

    // Funcție de normalizare (scoate diacritice, litere mici) pentru comparații
    const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    
    const countyNorm = normalize(county).replace(/\s+/g, '-');
    const cityNorm = city.trim(); 

    try {
        // PASUL 1: Încercăm căutarea directă (cea rapidă)
        // Endpoint: /locations/ro/{judet}/localities/{oras}
        let response = await fetch(
            `${ECOLET_BASE_URL}/locations/ro/${countyNorm}/localities/${encodeURIComponent(cityNorm)}`,
            { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
        );

        if (response.ok) {
            const data = await response.json();
            // Ecolet poate returna un array sau un obiect
            if (Array.isArray(data) && data.length > 0) return data[0].id;
            if (data.id) return data.id;
        }

        // PASUL 2: Dacă direct nu merge (ex: București 404), cerem TOATE localitățile din județ
        // Endpoint: /locations/ro/{judet}/localities
        console.log(`⚠️ Lookup direct eșuat pentru ${city}. Cerem lista completă din ${county}...`);
        
        response = await fetch(
            `${ECOLET_BASE_URL}/locations/ro/${countyNorm}/localities`,
            { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
        );

        if (response.ok) {
            const allLocalities = await response.json();
            
            if (Array.isArray(allLocalities) && allLocalities.length > 0) {
                // a) Căutăm "fuzzy match" (numele conține ce a scris userul sau invers)
                const match = allLocalities.find(l => 
                    normalize(l.name).includes(normalize(city)) || 
                    normalize(city).includes(normalize(l.name))
                );

                if (match) {
                    console.log(`✅ Găsit prin listă: ${match.name} (ID: ${match.id})`);
                    return match.id;
                }

                // b) Fallback specific pentru București:
                // Dacă suntem în județul București și nu am găsit exact ce a scris userul,
                // luăm pur și simplu PRIMA localitate din listă (care e un ID valid din acel județ).
                // Asta rezolvă problema "Sector X" vs "București".
                if (normalize(county).includes('bucurest')) {
                     console.log(`ℹ️ Fallback București: Folosim ID-ul primei localități (${allLocalities[0].name})`);
                     return allLocalities[0].id;
                }
            }
        }

        console.warn(`❌ Niciun ID găsit pentru ${city} în ${county}`);
        return null;

    } catch (e) {
        console.error('❌ Ecolet locality lookup error:', e.message);
        return null;
    }
}

/**
 * 3. Creare AWB
 */
export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        // Extragem datele
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
        const shippingAddress = typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : (order.shipping_address || {});

        const targetCounty = shippingAddress.county || order.county || "Bucuresti";
        const targetCity = shippingAddress.city || order.city || "Bucuresti";
        
        // --- LOGICA DE ADRESĂ (GOOGLE MAPS) ---
        // 1. Strada: Luăm exact ce vine de la Google
        const streetName = shippingAddress.street_name || order.address_line || "Strada Principala";
        
        // 2. Numărul: Luăm exact ce vine de la Google
        let streetNumber = shippingAddress.street_number || "1";
        
        // SAFEGUARD: Ecolet are o limită strictă de 10 caractere pentru număr.
        // Chiar dacă Google ne dă corect "10 bis corp A", Ecolet va refuza comanda.
        // Soluția corectă: Tăiem la 10 pentru validare API, dar punem TOTUL în observații.
        if (streetNumber.length > 10) {
            streetNumber = streetNumber.substring(0, 10);
        }
        if (!streetNumber) streetNumber = "1";

        // 3. Detaliile (Bloc, Scara) -> Observații
        const details = shippingAddress.details || "";
        const fullAddressInfo = `Adresă completă: ${streetName} Nr. ${shippingAddress.street_number || streetNumber} ${details}`;
        const observations = `Comanda #${order.id}. ${details ? 'Detalii: ' + details : ''}`;

        // Căutăm ID-ul localității (folosind logica nouă "Smart")
        let localityId = await getLocalityId(token, targetCounty, targetCity);
        
        // Ultimul resort: Hardcoded doar dacă API-ul a picat complet
        if (!localityId) {
            console.warn(`⚠️ API Lookup failed complet. Folosim fallback sigur.`);
            localityId = 323; 
        }

        const payload = {
            sender: {
                name: process.env.ECOLET_SENDER_NAME || "OCLAR Store",
                country: "ro",
                county: process.env.ECOLET_SENDER_COUNTY || "Bucuresti",
                locality_id: parseInt(process.env.ECOLET_SENDER_LOCALITY_ID || "323"),
                locality: process.env.ECOLET_SENDER_CITY || "Bucuresti",
                postal_code: process.env.ECOLET_SENDER_POSTAL || "011318",
                street_name: process.env.ECOLET_SENDER_STREET || "Strada Depozitului",
                street_number: process.env.ECOLET_SENDER_NUMBER || "1",
                contact_person: process.env.ECOLET_SENDER_CONTACT || "Expeditor",
                email: process.env.ECOLET_SENDER_EMAIL || "office@oclar.ro",
                phone: process.env.ECOLET_SENDER_PHONE || "0712345678",
                has_map_point: false
            },
            receiver: {
                name: order.customer_name,
                country: "ro",
                county: targetCounty,
                locality_id: localityId,
                locality: targetCity,
                postal_code: order.postal_code || shippingAddress.postalCode || "000000",
                street_name: streetName,
                street_number: streetNumber, // Numărul scurt (valid API)
                contact_person: order.customer_name,
                email: order.customer_email || "client@fara-email.ro",
                phone: (order.customer_phone || "0700000000").replace(/\s/g, ''),
                has_map_point: false
            },
            parcel: {
                type: "package",
                weight: 1,
                dimensions: { length: 20, width: 20, height: 10 },
                content: `Ochelari`,
                observations: observations, // Detaliile importante sunt aici
                shape: "standard",
                amount: 1
            },
            additional_services: {
                cod: {
                    status: (order.payment_method === 'ramburs'),
                    amount: (order.payment_method === 'ramburs') ? parseFloat(order.total_amount) : 0
                }
            },
            courier: {
                service: "dpd_standard",
                pickup: {
                    type: "courier",
                    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                    time: "12:00"
                },
                contract_id: parseInt(process.env.ECOLET_CONTRACT_ID || "4")
            }
        };

        if (order.shipping_method === 'easybox' && order.locker_id) {
            payload.receiver.has_map_point = true;
            payload.receiver.map_point_id = order.locker_id;
            payload.courier.service = "sameday_easybox"; 
        }

        console.log(`📦 Ecolet: Sending draft for Order #${order.id} (LocalityID: ${localityId})...`);
        
        const response = await fetch(`${ECOLET_BASE_URL}/add-parcel/save-order-to-send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Ecolet API Error:', JSON.stringify(data, null, 2));
            throw new Error(`Ecolet: ${data.message || JSON.stringify(data.errors)}`);
        }

        const shipmentId = data.order_to_send_id || data.id;
        console.log('✅ Ecolet Draft Created! ID:', shipmentId);
        return { success: true, ecolet_shipment_id: shipmentId.toString(), status: 'draft', message: 'Draft creat' };

    } catch (error) {
        console.error('❌ createDraftShipment Failed:', error.message);
        return { success: false, message: error.message };
    }
}

export async function getShipmentStatus(shipmentId) {
    try {
        const token = await authenticate();
        const response = await fetch(`${ECOLET_BASE_URL}/order/${shipmentId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed');
        const r = await response.json();
        const d = r.data || r;
        if (d.awb && d.status !== 'new') return { success: true, awb_number: d.awb, label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill`, status: 'completed' };
        return { success: false, status: d.status || 'draft' };
    } catch (e) { return { success: false, message: e.message }; }
}

export async function getShipmentLabel(shipmentId) {
    try {
        const token = await authenticate();
        return { success: true, label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill?access_token=${token}` };
    } catch (e) { return { success: false, message: e.message }; }
}
