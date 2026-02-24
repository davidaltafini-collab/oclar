/**
 * SERVICIU ECOLET - API Real
 * 
 * FIX EASYBOX:
 * - map_point_id trebuie să fie INTEGER (nu string!)
 * - courier.service = "sameday_easybox" pentru lockers Sameday
 * - contract_id SEPARAT pentru DPD vs Sameday (setează în .env!)
 * - COD (ramburs) NU este disponibil pentru EasyBox
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const ECOLET_CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const ECOLET_CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;
const ECOLET_USERNAME = process.env.ECOLET_USERNAME;
const ECOLET_PASSWORD = process.env.ECOLET_PASSWORD;

// ⚠️ IMPORTANT: Verifică în Ecolet > Contracte ce ID corespunde DPD și Sameday
// Dacă ai un singur contract, pune același ID la ambele
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
        console.log(`🔎 Ecolet Search locality: '${searchQuery}'...`);
        const url = `${ECOLET_BASE_URL}/locations/ro/localities/${encodeURIComponent(searchQuery)}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.warn(`⚠️ Locality API ${response.status} for: ${searchQuery}`);
            return null;
        }

        const data = await response.json();
        const localities = data.localities || (Array.isArray(data) ? data : []);

        if (localities.length > 0) {
            const match = localities.find(l =>
                cleanName(l.county?.name || "").includes(simpleCounty) ||
                simpleCounty.includes(cleanName(l.county?.name || ""))
            );
            if (match) {
                console.log(`✅ Localitate: ${match.id} (${match.name}, ${match.county?.name})`);
                return match.id;
            }
            console.log(`ℹ️ Primul rezultat: ${localities[0].id} - ${localities[0].name}`);
            return localities[0].id;
        }

        // Retry cu doar orașul
        console.log(`🔄 Retry cu: '${simpleCity}'...`);
        const retryUrl = `${ECOLET_BASE_URL}/locations/ro/localities/${encodeURIComponent(simpleCity)}`;
        const retryRes = await fetch(retryUrl, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryLocs = retryData.localities || (Array.isArray(retryData) ? retryData : []);
            const manualMatch = retryLocs.find(l => cleanName(l.county?.name || "").includes(simpleCounty));
            if (manualMatch) return manualMatch.id;
            if (retryLocs.length > 0) return retryLocs[0].id;
        }

        console.warn(`❌ Nicio localitate găsită pentru: ${searchQuery}`);
        return null;
    } catch (e) {
        console.error('❌ Ecolet locality error:', e.message);
        return null;
    }
}

// ============================================================
// 3. CREARE DRAFT AWB
// ============================================================
//

export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        // 1. Pregătire date
        const shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : (order.shipping_address || {});

        const targetCounty = shippingAddress.county || order.county || "Bucuresti";
        const targetCity = shippingAddress.city || order.city || "Bucuresti";
        
        // La lockere, folosim address_line ca să detectăm curierul (am salvat acolo numele lockerului)
        const addressDetails = order.address_line || shippingAddress.line || "";
        const streetName = order.shipping_method === 'easybox' ? "Locker" : addressDetails;

        const isEasyBox = order.shipping_method === 'easybox' && order.locker_id;
        const mapPointId = isEasyBox ? parseInt(order.locker_id, 10) : null;

        // Validare ID Locker
        if (isEasyBox && isNaN(mapPointId)) {
            throw new Error(`locker_id invalid: "${order.locker_id}" nu este un număr valid!`);
        }

        console.log(`📦 Ecolet Draft #${order.id} | Destinație: ${addressDetails} (ID: ${mapPointId})`);

        // 2. Determinare Localitate (necesar Ecolet)
        let localityId = await getLocalityId(token, targetCounty, targetCity);
        if (!localityId) localityId = 323; // Fallback București

        const pickupDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // ============================================================
        // 🤖 LOGICĂ DETECTARE CURIER (DINAMIC)
        // ============================================================
        
        // Harta serviciilor tale (Slug-urile găsite cu scriptul de test)
         const SERVICE_MAP = {
            sameday: 'sameday_locker',                // 12. [SAMEDAY] Locker (Curier -> Automatul)
            cargus: 'easy_collect_locker_s',          // 50. [URGENT_CARGUS] Easy Collect Locker S (Ochelarii încap în S)
            fan: 'fan_courier_courier_to_locker',     // 8. [FAN_COURIER] Fanbox (Curier -> automatul)
            dpd: 'dpd_automat_courier_to_locker'      // 27. [DPD] Automat (curier -> automatul)
        };

        // Contracte specifice (dacă ai ID-uri diferite în Ecolet per curier)
        // Dacă ai un singur contract global (ex: ID 4), folosește-l pe ăla peste tot.
        const CONTRACT_MAP = {
            sameday: parseInt(process.env.ECOLET_SAMEDAY_CONTRACT_ID || "4"),
            cargus: parseInt(process.env.ECOLET_CARGUS_CONTRACT_ID || process.env.ECOLET_CONTRACT_ID || "4"),
            other: parseInt(process.env.ECOLET_CONTRACT_ID || "4")
        };

        // Algoritm STRICT de detectare bazat pe locker_details din DB
        let selectedService = null;
        let selectedContract = null;
        
        // Folosim strict coloana locker_details (ex: "SAMEDAY - Easybox...")
        const lockerInfo = (order.locker_details || "").toLowerCase();

        console.log(`🔎 Ecolet Strict Check: "${lockerInfo}"`);

        if (lockerInfo.includes('cargus')) {
            selectedService = SERVICE_MAP.cargus;
            selectedContract = CONTRACT_MAP.cargus;
        } 
        else if (lockerInfo.includes('fan') || lockerInfo.includes('fan courier')) {
            selectedService = SERVICE_MAP.fan;
            selectedContract = CONTRACT_MAP.other;
        }
        else if (lockerInfo.includes('dpd')) {
            selectedService = SERVICE_MAP.dpd;
            selectedContract = CONTRACT_MAP.other;
        }
        else if (lockerInfo.includes('sameday')) {
            selectedService = SERVICE_MAP.sameday;
            selectedContract = CONTRACT_MAP.sameday;
        } 
        else {
            // FĂRĂ DEFAULT! Dăm eroare dacă nu identificăm operatorul.
            throw new Error(`[Ecolet] Nu s-a putut identifica operatorul locker-ului din: "${lockerInfo}". Verifică baza de date.`);
        }

        // ============================================================
        // CONSTRUIRE PAYLOAD
        // ============================================================

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
                street_name: streetName,
                street_number: "1",
                contact_person: order.customer_name,
                email: order.customer_email || "client@oclar.ro",
                phone: (order.customer_phone || "0700000000").replace(/\s+/g, ''),
                // Configurare Locker
                has_map_point: isEasyBox,
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
                    // Cargus/Fan suportă ramburs la locker uneori, Sameday nu.
                    // Activăm ramburs doar dacă NU e Sameday Locker sau dacă știi sigur că ai contract de ramburs la locker.
                    // Momentan lăsăm dezactivat la locker pentru siguranță.
                    status: order.payment_method === 'ramburs' && !isEasyBox,
                    amount: (order.payment_method === 'ramburs' && !isEasyBox)
                        ? parseFloat(order.total_amount || 0)
                        : 0
                }
            },
            courier: isEasyBox
                ? {
                    service: selectedService, // <--- AICI E MAGIA
                    pickup: { type: "courier", date: pickupDate, time: "12:00" },
                    contract_id: selectedContract
                }
                : {
                    service: "dpd_standard",
                    pickup: { type: "courier", date: pickupDate, time: "12:00" },
                    contract_id: parseInt(process.env.ECOLET_DPD_CONTRACT_ID || "4")
                }
        };

        console.log(`🚀 Payload Ecolet: Service=${payload.courier.service} | MapID=${payload.receiver.map_point_id}`);

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
            const errMsg = data.message || Object.values(data.errors || {}).flat().join(', ') || 'Eroare necunoscută';
            throw new Error(`Ecolet: ${errMsg}`);
        }

        const shipmentId = data.order_to_send_id || data.id;
        console.log(`✅ Draft creat! ID: ${shipmentId}`);

        return {
            success: true,
            ecolet_shipment_id: shipmentId.toString(),
            status: 'draft',
            message: `Draft creat (${payload.courier.service})`
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
// 6. DEBUG: Listează serviciile disponibile în contul tău
// Apelează GET /api/admin/ecolet/services din Admin să vezi
// ce valori exacte acceptă câmpul courier.service
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
        console.log('📋 Servicii Ecolet disponibile:');
        services.forEach(s => console.log(`  - slug: "${s.slug}" | name: "${s.full_name}" | courier: "${s.courier?.slug}"`));
        return { success: true, services };
    } catch (e) {
        return { success: false, message: e.message };
    }
}
