/**
 * SERVICIU ECOLET - API Real
 * Suportă Sameday Easybox, DPD, GLS etc. prin detecție dinamică.
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const ECOLET_CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const ECOLET_CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;
const ECOLET_USERNAME = process.env.ECOLET_USERNAME;
const ECOLET_PASSWORD = process.env.ECOLET_PASSWORD;

// Contracte implicite (pot fi suprascrise de logica dinamică)
const ECOLET_DPD_CONTRACT_ID = parseInt(process.env.ECOLET_DPD_CONTRACT_ID || process.env.ECOLET_CONTRACT_ID || "4");
const ECOLET_SAMEDAY_CONTRACT_ID = parseInt(process.env.ECOLET_SAMEDAY_CONTRACT_ID || process.env.ECOLET_CONTRACT_ID || "4");

let cachedToken = null;
let tokenExpiry = null;

function cleanName(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(judetul|județul|county|district|comuna|sat|municipiul|orasul|oras)\b/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

// ============================================================
// 1. AUTENTIFICARE
// ============================================================
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

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Ecolet Auth Failed: ${response.status} - ${err}`);
    }
    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
    console.log('✅ Ecolet: Token obținut.');
    return cachedToken;
}

// ============================================================
// 2. CĂUTARE LOCALITATE
// ============================================================
async function getLocalityId(token, county, city) {
    if (!county || !city) return null;

    const simpleCity = cleanName(city);
    const simpleCounty = cleanName(county);
    const searchQuery = `${simpleCity} ${simpleCounty}`;

    try {
        const url = `${ECOLET_BASE_URL}/locations/ro/localities/${encodeURIComponent(searchQuery)}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const localities = data.localities || (Array.isArray(data) ? data : []);

        if (localities.length > 0) {
            const match = localities.find(l =>
                cleanName(l.county?.name || "").includes(simpleCounty) ||
                simpleCounty.includes(cleanName(l.county?.name || ""))
            );
            if (match) return match.id;
            return localities[0].id;
        }
        return null;
    } catch (e) {
        console.error('❌ Ecolet locality error:', e.message);
        return null;
    }
}

// ============================================================
// LOGICĂ DETECTARE SERVICIU (LOCKER vs CURIER)
// ============================================================
function getShipmentService(order) {
    const isLocker = order.shipping_method === 'easybox' && order.locker_id;
    
    // A. CAZUL LOCKER
    if (isLocker) {
        const lockerId = order.locker_id.toString();
        
        // AICI POȚI ADĂUGA REGULI PENTRU DPD/GLS/FAN
        // Exemplu ipotetic: Dacă ID-ul începe cu "DPD", e DPD Locker.
        // if (lockerId.startsWith("DPD")) {
        //    return { service: "dpd_locker", contract_id: ECOLET_DPD_CONTRACT_ID };
        // }

        // DEFAULT PENTRU LOCKER: SAMEDAY
        // Corectare eroare "sameday_easybox": slug-ul corect este de obicei "sameday"
        return { 
            service: "sameday", 
            contract_id: ECOLET_SAMEDAY_CONTRACT_ID,
            is_locker: true
        };
    } 
    
    // B. CAZUL CURIER STANDARD (LA ADRESĂ)
    // Implicit folosim DPD Standard, dar poți schimba în "sameday" sau "gls"
    return { 
        service: "dpd_standard", 
        contract_id: ECOLET_DPD_CONTRACT_ID,
        is_locker: false
    };
}

// ============================================================
// 3. CREARE DRAFT AWB
// ============================================================
export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        const shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : (order.shipping_address || {});

        const targetCounty = shippingAddress.county || order.county || "Bucuresti";
        const targetCity = shippingAddress.city || order.city || "Bucuresti";
        const streetName = shippingAddress.street_name || order.address_line || "Strada Principala";
        
        let streetNumber = shippingAddress.street_number || "1";
        if (streetNumber.length > 10) streetNumber = streetNumber.substring(0, 10);
        if (!streetNumber) streetNumber = "1";

        // 1. Determinăm serviciul corect
        const serviceSettings = getShipmentService(order);
        const mapPointId = serviceSettings.is_locker ? parseInt(order.locker_id, 10) : null;

        if (serviceSettings.is_locker && isNaN(mapPointId)) {
            throw new Error(`Locker ID invalid: "${order.locker_id}"`);
        }

        console.log(`📦 Ecolet Draft #${order.id} | Service: ${serviceSettings.service} | Locker: ${serviceSettings.is_locker}`);

        // 2. Localitate (necesară pentru routing)
        let localityId = await getLocalityId(token, targetCounty, targetCity);
        if (!localityId) localityId = 323; // Fallback București

        // 3. Pickup Date
        const pickupDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // 4. Construire Payload
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
                contact_person: process.env.ECOLET_SENDER_CONTACT || "OCLAR",
                email: process.env.ECOLET_SENDER_EMAIL || "office@oclar.ro",
                phone: process.env.ECOLET_SENDER_PHONE || "0700000000",
                has_map_point: false,
                map_point_id: null
            },
            receiver: {
                name: order.customer_name,
                country: "ro",
                county: targetCounty,
                locality_id: localityId,
                locality: targetCity,
                postal_code: order.postal_code || "000000",
                street_name: serviceSettings.is_locker ? "Locker Point" : streetName,
                street_number: serviceSettings.is_locker ? "1" : streetNumber,
                contact_person: order.customer_name,
                email: order.customer_email || "client@oclar.ro",
                phone: (order.customer_phone || "0700000000").replace(/\s+/g, ''),
                has_map_point: serviceSettings.is_locker,
                map_point_id: mapPointId
            },
            parcel: {
                type: "package",
                weight: 1,
                dimensions: { length: 20, width: 20, height: 10 },
                content: "Ochelari",
                observations: `Comanda #${order.id}`,
                shape: "standard",
                amount: 1
            },
            additional_services: {
                cod: {
                    // Dacă e Locker, de obicei nu permitem RAMBURS prin curier (se plătește la locker cu cardul)
                    // Dacă serviciul tău suportă ramburs la locker, scoate condiția !is_locker
                    status: order.payment_method === 'ramburs' && !serviceSettings.is_locker,
                    amount: (order.payment_method === 'ramburs' && !serviceSettings.is_locker)
                        ? parseFloat(order.total_amount || 0)
                        : 0
                }
            },
            courier: {
                service: serviceSettings.service, // Aici vine "sameday" sau "dpd_standard" etc.
                pickup: { type: "courier", date: pickupDate, time: "12:00" },
                contract_id: serviceSettings.contract_id
            }
        };

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
            const errMsg = data.message || Object.values(data.errors || {}).flat().join(', ') || 'Eroare necunoscută';
            throw new Error(`Ecolet: ${errMsg}`);
        }

        const shipmentId = data.order_to_send_id || data.id;
        
        return {
            success: true,
            ecolet_shipment_id: shipmentId.toString(),
            status: 'draft',
            message: `Draft creat (${serviceSettings.service})`
        };

    } catch (error) {
        console.error('❌ createDraftShipment error:', error.message);
        return { success: false, message: error.message };
    }
}

// ============================================================
// 4. STATUS SHIPMENT (Sync AWB)
// ============================================================
export async function getShipmentStatus(shipmentId) {
    try {
        const token = await authenticate();
        const response = await fetch(`${ECOLET_BASE_URL}/order/${shipmentId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`Status API ${response.status}`);
        const r = await response.json();
        const d = r.data || r;

        if (d.awb && d.status !== 'new') {
            return {
                success: true,
                awb_number: d.awb,
                label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill`,
                status: 'completed'
            };
        }
        return { success: false, status: d.status || 'draft', message: 'AWB nu e gata' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ============================================================
// 5. LABEL URL
// ============================================================
export async function getShipmentLabel(shipmentId) {
    try {
        const token = await authenticate();
        return {
            success: true,
            label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill?access_token=${token}`
        };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ============================================================
// 6. DEBUG: Listează serviciile disponibile
// ============================================================
export async function getAvailableServices() {
    try {
        const token = await authenticate();
        const response = await fetch(`${ECOLET_BASE_URL}/services`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`Services API ${response.status}`);
        const data = await response.json();
        const services = data.services || data;
        return { success: true, services };
    } catch (e) {
        return { success: false, message: e.message };
    }
}
