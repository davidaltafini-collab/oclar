/**
 * SERVICIU ECOLET - API Real (Conform Documentației Oficiale PDF)
 *
 * FIX: Logica de detectare operator locker rulează DOAR pentru comenzi easybox.
 *      Comenzile curier (card / ramburs la adresă) folosesc direct "dpd_standard".
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

// ============================================================
// HELPER: Curățare nume pentru căutare (diacritice, prefixe)
// ============================================================
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
export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        // --- Parsare date adresă ---
        const shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : (order.shipping_address || {});

        const targetCounty = shippingAddress.county || order.county || "Bucuresti";
        const targetCity   = shippingAddress.city   || order.city   || "Bucuresti";

        // ---------------------------------------------------------------
        // BIFURCAȚIE PRINCIPALĂ: CURIER vs EASYBOX
        // ---------------------------------------------------------------
        const isEasyBox = order.shipping_method === 'easybox' && !!order.locker_id;

        // --- DATE RECEIVER ---
        let streetName, streetNumber, observations;

        if (isEasyBox) {
            // Pentru locker: adresa fizică a lockerului din locker_details
            const rawInfo = order.locker_details || order.address_line || "";
            let lockerNameHuman = rawInfo;
            let lockerAddressPhysical = rawInfo;

            if (rawInfo.includes('|')) {
                const parts = rawInfo.split('|');
                // format: "OPERATOR|NUME_LOCKER|ADRESA_FIZICA"
                lockerNameHuman       = parts[1] || rawInfo;
                lockerAddressPhysical = parts[2] || parts[1] || rawInfo;
            }

            streetName   = lockerAddressPhysical;
            streetNumber = ".";
            observations = `Locker: ${lockerNameHuman} | Comanda #${order.id}`;

        } else {
            // Pentru curier la adresă: date normale din DB
            streetName   = shippingAddress.street_name || order.address_line || "Strada Principala";
            streetNumber = shippingAddress.street_number || "1";
            if (streetNumber.length > 10) streetNumber = streetNumber.substring(0, 10);
            if (!streetNumber) streetNumber = "1";

            const details = shippingAddress.details || "";
            observations = `Comanda #${order.id}${details ? '. Detalii: ' + details : ''}`;
        }

        // --- LOCALITATE ---
        let localityId = await getLocalityId(token, targetCounty, targetCity);
        if (!localityId) {
            console.warn(`⚠️ Localitate negăsită. Fallback: București (323).`);
            localityId = 323;
        }

        const pickupDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // --- SERVICIU CURIER ---
        // Curier la adresă → dpd_standard (întotdeauna)
        // Easybox → detectăm operatorul DOAR din locker_details
        let courierService  = "dpd_standard";
        let contractId      = parseInt(process.env.ECOLET_DPD_CONTRACT_ID || process.env.ECOLET_CONTRACT_ID || "4");

        if (isEasyBox) {
            const rawInfo  = order.locker_details || order.address_line || "";
            const checkStr = rawInfo.toUpperCase();

            if (checkStr.includes('SAMEDAY')) {
                courierService = "sameday_locker";
                contractId     = parseInt(process.env.ECOLET_SAMEDAY_CONTRACT_ID || process.env.ECOLET_CONTRACT_ID || "4");
            } else if (checkStr.includes('FAN') || checkStr.includes('FANBOX')) {
                courierService = "fan_courier_courier_to_locker";
            } else if (checkStr.includes('CARGUS')) {
                courierService = "easy_collect_locker_s";
                contractId     = parseInt(process.env.ECOLET_CARGUS_CONTRACT_ID || process.env.ECOLET_CONTRACT_ID || "4");
            } else if (checkStr.includes('DPD')) {
                courierService = "dpd_automat_courier_to_locker";
            } else {
                // Fallback locker necunoscut → sameday (cel mai comun)
                console.warn(`⚠️ Operator locker nerecunoscut în "${rawInfo}". Fallback: sameday_locker.`);
                courierService = "sameday_locker";
                contractId     = parseInt(process.env.ECOLET_SAMEDAY_CONTRACT_ID || process.env.ECOLET_CONTRACT_ID || "4");
            }
        }

        // --- COD (ramburs) — NU e disponibil la easybox ---
        const isCOD = order.payment_method === 'ramburs' && !isEasyBox;

        // --- PAYLOAD FINAL ---
        const payload = {
            sender: {
                name:           process.env.ECOLET_SENDER_NAME     || "OCLAR Store",
                country:        "ro",
                county:         process.env.ECOLET_SENDER_COUNTY   || "Bucuresti",
                locality_id:    parseInt(process.env.ECOLET_SENDER_LOCALITY_ID || "323"),
                locality:       process.env.ECOLET_SENDER_CITY     || "Bucuresti",
                postal_code:    process.env.ECOLET_SENDER_POSTAL   || "011318",
                street_name:    process.env.ECOLET_SENDER_STREET   || "Strada Depozitului",
                street_number:  process.env.ECOLET_SENDER_NUMBER   || "1",
                contact_person: process.env.ECOLET_SENDER_CONTACT  || "OCLAR",
                email:          process.env.ECOLET_SENDER_EMAIL    || "office@oclar.ro",
                phone:          process.env.ECOLET_SENDER_PHONE    || "0700000000",
                has_map_point:  false,
                map_point_id:   null
            },
            receiver: {
                name:           order.customer_name,
                country:        "ro",
                county:         targetCounty,
                locality_id:    localityId,
                locality:       targetCity,
                postal_code:    order.postal_code || shippingAddress.postalCode || "000000",
                street_name:    streetName,
                street_number:  isEasyBox ? "." : streetNumber,
                contact_person: order.customer_name,
                email:          order.customer_email || "client@oclar.ro",
                phone:          (order.customer_phone || "0700000000").replace(/\s+/g, ''),
                has_map_point:  isEasyBox,
                map_point_id:   isEasyBox ? parseInt(order.locker_id, 10) : null
            },
            parcel: {
                type:         "package",
                weight:       1,
                dimensions:   { length: 20, width: 20, height: 10 },
                content:      "Ochelari",
                observations: observations,
                shape:        "standard",
                amount:       1
            },
            additional_services: {
                cod: {
                    status: isCOD,
                    amount: isCOD ? parseFloat(order.total_amount || 0) : 0
                }
            },
            courier: {
                service:     courierService,
                pickup:      { type: "courier", date: pickupDate, time: "12:00" },
                contract_id: contractId
            }
        };

        // --- DEBUG ---
        console.log("\n==================================================");
        console.log("📦 [ECOLET] Date trimitere:");
        console.log(`   Comanda:   #${order.id}`);
        console.log(`   Tip:       ${isEasyBox ? "LOCKER" : "CURIER LA ADRESĂ"}`);
        console.log(`   Serviciu:  ${courierService} (contract: ${contractId})`);
        console.log(`   Adresă:    "${streetName}", nr "${isEasyBox ? "." : streetNumber}"`);
        console.log(`   COD:       ${isCOD ? parseFloat(order.total_amount) + " RON" : "NU"}`);
        console.log("==================================================\n");

        const response = await fetch(`${ECOLET_BASE_URL}/add-parcel/save-order-to-send`, {
            method: 'POST',
            headers: {
                'Authorization':  `Bearer ${token}`,
                'Content-Type':   'application/json',
                'Accept':         'application/json'
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
        console.log(`✅ AWB Draft creat! ID: ${shipmentId}`);

        return {
            success:            true,
            ecolet_shipment_id: shipmentId.toString(),
            status:             'draft',
            message:            `Draft creat (${courierService})`
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
                success:    true,
                awb_number: d.awb,
                label_url:  `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill`,
                status:     'completed'
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
            success:   true,
            label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill?access_token=${token}`
        };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ============================================================
// 6. DEBUG: Servicii disponibile în contul Ecolet
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