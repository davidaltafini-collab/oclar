/**
 * SERVICIU ECOLET - API Real (Conform Documentației Oficiale PDF)
 * Endpoint folosit: /locations/ro/localities/{Nume + Judet}
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

// Helper: Curățare nume pentru căutare (scoatem "Județul", diacritice, etc)
function cleanName(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Fără diacritice
        .replace(/\b(judetul|județul|county|district|comuna|sat|municipiul|orasul|oras)\b/g, '')
        .replace(/[^a-z0-9\s]/g, '') // Păstrăm doar litere și spații
        .trim();
}

/**
 * 1. Autentificare (Standard)
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
 * 2. Căutare Localitate (Conform Documentației - Pagina 4/5)
 * Folosește endpoint-ul /locations/ro/localities/{query}
 */
async function getLocalityId(token, county, city) {
    if (!county || !city) return null;

    const simpleCity = cleanName(city);
    const simpleCounty = cleanName(county);

    // Construim query-ul exact cum zice doc-ul: "Locality Name + County Name"
    // Ex: "Aronesti Bacau" sau "Bucuresti Bucuresti"
    const searchQuery = `${simpleCity} ${simpleCounty}`;

    try {
        console.log(`🔎 Ecolet Search: '${searchQuery}'...`);

        // Endpoint oficial de căutare
        const url = `${ECOLET_BASE_URL}/locations/ro/localities/${encodeURIComponent(searchQuery)}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.warn(`⚠️ API Error ${response.status} searching for ${searchQuery}`);
            return null;
        }

        const data = await response.json();
        
        // Documentația spune că primim un obiect { "localities": [...] } sau direct array
        const localities = data.localities || (Array.isArray(data) ? data : []);

        if (localities.length > 0) {
            // 1. Încercăm să găsim potrivirea perfectă pe județ
            // Ecolet returnează structura: { id, name, county: { name: "..." } }
            const match = localities.find(l => 
                cleanName(l.county?.name || "").includes(simpleCounty) || 
                simpleCounty.includes(cleanName(l.county?.name || ""))
            );

            if (match) {
                console.log(`✅ ID Găsit: ${match.id} (${match.name}, ${match.county?.name})`);
                return match.id;
            }

            // 2. Fallback: Dacă am căutat "Bucuresti" și primim "Sector 1", e ok, luăm primul.
            console.log(`ℹ️ Luăm primul rezultat disponibil: ${localities[0].id}`);
            return localities[0].id;
        }

        console.warn(`❌ Niciun rezultat pentru '${searchQuery}'`);
        
        // ULTIMA SPERANȚĂ: Căutăm DOAR după oraș (poate numele județului e scris ciudat)
        if (searchQuery.includes(' ')) {
            console.log(`🔄 Reîncercăm doar cu numele orașului: '${simpleCity}'...`);
            const retryUrl = `${ECOLET_BASE_URL}/locations/ro/localities/${encodeURIComponent(simpleCity)}`;
            const retryRes = await fetch(retryUrl, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }});
            if (retryRes.ok) {
                const retryData = await retryRes.json();
                const retryLocs = retryData.localities || (Array.isArray(retryData) ? retryData : []);
                
                // Filtrăm manual după județ
                const manualMatch = retryLocs.find(l => cleanName(l.county?.name || "").includes(simpleCounty));
                if (manualMatch) return manualMatch.id;
            }
        }

        return null;

    } catch (e) {
        console.error('❌ Ecolet lookup error:', e.message);
        return null;
    }
}

/**
 * 3. Creare Draft AWB
 */
export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        const shippingAddress = typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : (order.shipping_address || {});

        // Date de la Google/DB
        const targetCounty = shippingAddress.county || order.county || "Bucuresti";
        const targetCity = shippingAddress.city || order.city || "Bucuresti";
        const streetName = shippingAddress.street_name || order.address_line || "Strada Principala";
        
        // Validare lungime număr (Ecolet limită 10 chars)
        let streetNumber = shippingAddress.street_number || "1";
        if (streetNumber.length > 10) streetNumber = streetNumber.substring(0, 10);
        if (!streetNumber) streetNumber = "1";

        const details = shippingAddress.details || "";
        const observations = `Comanda #${order.id}. ${details ? 'Detalii: ' + details : ''}`;

        // CĂUTARE DINAMICĂ ID
        let localityId = await getLocalityId(token, targetCounty, targetCity);
        
        // Fallback București (ID 323) dacă eșuează totul, dar nu ar trebui
        if (!localityId) {
            console.warn(`⚠️ NU S-A GĂSIT LOCALITATEA. Se folosește fallback ID 323 (București).`);
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
                street_number: streetNumber,
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
                observations: observations,
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

        // Logică Easybox
        if (order.shipping_method === 'easybox' && order.locker_id) {
            payload.receiver.has_map_point = true;
            payload.receiver.map_point_id = order.locker_id;
            payload.courier.service = "sameday_easybox"; 
        }

        console.log(`📦 Creare draft Ecolet #${order.id}...`);
        
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
        console.log('✅ AWB Draft Creat! ID:', shipmentId);
        return { success: true, ecolet_shipment_id: shipmentId.toString(), status: 'draft', message: 'Draft creat' };

    } catch (error) {
        console.error('❌ Eroare creare AWB:', error.message);
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
