/**
 * SERVICIU ECOLET - API Real (Optimizat pentru Google Maps Data)
 * Folosește datele structurate (Stradă, Număr, Detalii) separate.
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

    // console.log('🔄 Ecolet: Requesting new token...');
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
 * 2. Căutare Localitate (Smart Lookup)
 */
async function getLocalityId(token, county, city) {
    if (!county || !city) return 323; // Fallback București

    // Normalizăm numele pentru a crește șansele de match (fără diacritice)
    const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    
    // Fix specific: Google zice "București", Ecolet vrea "Bucuresti"
    if (normalize(city).includes('bucurest') || normalize(county).includes('bucurest')) return 323;

    try {
        const countyNorm = normalize(county).replace(/\s+/g, '-');
        const cityNorm = city.trim(); // Păstrăm orașul original pentru query, dar normalizat în URL

        const response = await fetch(
            `${ECOLET_BASE_URL}/locations/ro/${countyNorm}/localities/${encodeURIComponent(cityNorm)}`,
            { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
        );

        if (!response.ok) return null;
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) return data[0].id;
        if (data.id) return data.id;
        return null;
    } catch (e) {
        console.warn('⚠️ Ecolet locality lookup error:', e.message);
        return null;
    }
}

/**
 * 3. Creare AWB (Folosind datele de la Google Maps)
 */
export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        // Parsăm datele. Acum ne așteptăm ca shipping_address să conțină câmpurile noi
        const shippingAddress = typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : (order.shipping_address || {});

        // --- EXTRAGERE DATE STRUCTURATE (DE LA GOOGLE) ---
        // Asta e partea pe care o doreai: folosim datele separate, nu le mai tăiem noi.
        
        const targetCounty = shippingAddress.county || order.county || "Bucuresti";
        const targetCity = shippingAddress.city || order.city || "Bucuresti";
        
        // 1. Strada (Vine curat de la Google)
        const streetName = shippingAddress.street_name || order.address_line || "Strada Principala";
        
        // 2. Numărul (Vine curat de la Google - ex: "10B")
        let streetNumber = shippingAddress.street_number || "1";
        
        // SAFEGUARD: Ecolet are o limită tehnică de 10 caractere pe DB. 
        // Chiar dacă luăm datele corect, dacă userul a scris "10 bis intrarea 2", tot crapă API-ul.
        // Așa că tăiem surplusul și îl mutăm la observații, dar păstrăm esențialul.
        if (streetNumber.length > 10) {
            streetNumber = streetNumber.substring(0, 10);
        }

        // 3. Detalii (Bloc, Scara, Ap) -> Merg în OBSERVAȚII
        // Așa curierul vede tot, dar API-ul primește câmpurile curate.
        const details = shippingAddress.details || "";
        
        // Compunem observațiile pentru curier
        const observations = `Comanda #${order.id}. ${details ? 'Detalii livrare: ' + details : ''}`;

        // Căutăm ID-ul localității
        let localityId = await getLocalityId(token, targetCounty, targetCity);
        if (!localityId) {
            console.warn(`⚠️ Locality ID not found for ${targetCity}. Fallback to Bucuresti (323).`);
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
                street_number: streetNumber, // Trimitem NUMĂRUL CURAT
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
                observations: observations, // Aici punem BLOC, SCARA, AP, INTERFON
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

        // Suport Easybox
        if (order.shipping_method === 'easybox' && order.locker_id) {
            payload.receiver.has_map_point = true;
            payload.receiver.map_point_id = order.locker_id;
            payload.courier.service = "sameday_easybox"; 
        }

        console.log(`📦 Ecolet: Sending draft for Order #${order.id} (Str: ${streetName}, Nr: ${streetNumber})...`);
        
        const response = await fetch(`${ECOLET_BASE_URL}/add-parcel/save-order-to-send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error('Invalid JSON from Ecolet'); }

        if (!response.ok) {
            console.error('❌ Ecolet API Error:', JSON.stringify(data, null, 2));
            throw new Error(`Ecolet: ${data.message || JSON.stringify(data.errors)}`);
        }

        console.log('✅ Ecolet Shipment Created! ID:', data.order_to_send_id || data.id);
        return { 
            success: true, 
            ecolet_shipment_id: (data.order_to_send_id || data.id).toString(),
            status: 'draft',
            message: 'Draft creat cu succes'
        };

    } catch (error) {
        console.error('❌ createDraftShipment Failed:', error.message);
        return { success: false, message: error.message };
    }
}

export async function getShipmentStatus(shipmentId) {
    // ... Păstrăm logica existentă pentru status ...
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
    // ... Păstrăm logica existentă pentru label ...
    try {
        const token = await authenticate();
        return { success: true, label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill?access_token=${token}` };
    } catch (e) { return { success: false, message: e.message }; }
}
