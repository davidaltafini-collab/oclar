import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const ECOLET_CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const ECOLET_CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;
const ECOLET_USERNAME = process.env.ECOLET_USERNAME;
const ECOLET_PASSWORD = process.env.ECOLET_PASSWORD;

// Contracte definite în .env
const ECOLET_DPD_CONTRACT_ID = parseInt(process.env.ECOLET_DPD_CONTRACT_ID || "4");
const ECOLET_SAMEDAY_CONTRACT_ID = parseInt(process.env.ECOLET_SAMEDAY_CONTRACT_ID || "4");

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
        throw new Error(`Ecolet Auth Failed: ${err}`);
    }
    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
    return cachedToken;
}

async function getLocalityId(token, county, city) {
    if (!county || !city) return null;
    const simpleCity = cleanName(city);
    const simpleCounty = cleanName(county);
    const searchQuery = `${simpleCity} ${simpleCounty}`;

    try {
        const url = `${ECOLET_BASE_URL}/locations/ro/localities/${encodeURIComponent(searchQuery)}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
        if (!response.ok) return null;
        const data = await response.json();
        const localities = data.localities || (Array.isArray(data) ? data : []);
        if (localities.length > 0) return localities[0].id; // Returnăm primul match
        return null;
    } catch (e) {
        return null;
    }
}

// Funcție pentru a determina Contract ID pe baza numelui serviciului
function getContractIdForService(serviceName) {
    if (!serviceName) return ECOLET_SAMEDAY_CONTRACT_ID;
    const s = serviceName.toLowerCase();
    if (s.includes('dpd')) return ECOLET_DPD_CONTRACT_ID;
    if (s.includes('sameday')) return ECOLET_SAMEDAY_CONTRACT_ID;
    // Default fallback
    return parseInt(process.env.ECOLET_CONTRACT_ID || "4");
}

export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        const shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : (order.shipping_address || {});

        const targetCounty = shippingAddress.county || order.county;
        const targetCity = shippingAddress.city || order.city;
        const streetName = shippingAddress.street_name || order.address_line || "Strada Principala";
        
        // 1. DETERMINARE SERVICIU (VARIABILĂ)
        // Folosim exact ce vine din DB. Dacă în DB scrie "easybox" și asta e invalid, va da eroare.
        // Trebuie să te asiguri că `shipping_method` sau `awb_courier` conține slug-ul corect (ex: "sameday").
        const serviceSlug = order.awb_courier || order.shipping_method; 
        
        if (!serviceSlug) {
            throw new Error("Lipsă serviciu curier (shipping_method/awb_courier) în comandă!");
        }

        const contractId = getContractIdForService(serviceSlug);
        const isLocker = !!order.locker_id;
        const mapPointId = isLocker ? parseInt(order.locker_id, 10) : null;

        console.log(`📦 Ecolet Draft #${order.id} | Service: ${serviceSlug} | LockerID: ${mapPointId}`);

        // Localitate
        let localityId = await getLocalityId(token, targetCounty, targetCity);
        if (!localityId) localityId = 323; // Fallback București dacă nu găsește localitatea (necesar tehnic)

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
                street_name: isLocker ? "Locker Point" : streetName,
                street_number: "1",
                contact_person: order.customer_name,
                email: order.customer_email || "client@oclar.ro",
                phone: (order.customer_phone || "0700000000").replace(/\s+/g, ''),
                has_map_point: isLocker,
                map_point_id: mapPointId
            },
            parcel: {
                type: "package",
                weight: 1,
                dimensions: { length: 20, width: 20, height: 10 },
                content: "Ochelari",
                observations: `Comanda #${order.id}`,
                amount: 1
            },
            additional_services: {
                cod: {
                    status: order.payment_method === 'ramburs' && !isLocker,
                    amount: (order.payment_method === 'ramburs' && !isLocker) ? parseFloat(order.total_amount) : 0
                }
            },
            courier: {
                service: serviceSlug, // Variabila din DB
                pickup: { type: "courier", date: new Date(Date.now() + 86400000).toISOString().split('T')[0], time: "12:00" },
                contract_id: contractId
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
            const errMsg = data.message || Object.values(data.errors || {}).flat().join(', ');
            throw new Error(`Ecolet Error: ${errMsg}`);
        }

        return {
            success: true,
            ecolet_shipment_id: (data.order_to_send_id || data.id).toString(),
            status: 'draft',
            message: `Draft creat (${serviceSlug})`
        };

    } catch (error) {
        console.error('❌ createDraftShipment error:', error.message);
        return { success: false, message: error.message };
    }
}

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

export async function getAvailableServices() {
    try {
        const token = await authenticate();
        const response = await fetch(`${ECOLET_BASE_URL}/services`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const data = await response.json();
        return { success: true, services: data.services || data };
    } catch (e) {
        return { success: false, message: e.message };
    }
}
