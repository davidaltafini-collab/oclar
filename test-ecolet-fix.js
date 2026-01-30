import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL_V1 = 'https://panel.ecolet.ro/api/v1';
const BASE_URL_V2 = 'https://panel.ecolet.ro/api/v2';
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

async function runFixTest() {
    console.log('🔧 Starting Final Fix Test...');

    // 1. AUTENTIFICARE
    console.log('🔑 Authenticating...');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'client_credentials');
    authParams.append('client_id', CLIENT_ID.trim());
    authParams.append('client_secret', CLIENT_SECRET.trim());
    authParams.append('scope', '*'); // Forțăm scope-ul

    const authRes = await fetch(`${BASE_URL_V1}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: authParams.toString()
    });

    if (!authRes.ok) {
        console.error('❌ Auth Failed:', await authRes.text());
        return;
    }

    const { access_token: token } = await authRes.json();
    console.log('✅ Token obtained.\n');

    // DATELE DE TEST (Structura V2)
    const payloadV2 = {
        sender: {
            name: "OCLAR Store",
            country: "ro",
            county: "Bucuresti",
            locality_id: 323,
            locality: "Bucuresti",
            postal_code: "011318",
            street_name: "Str. Testare",
            street_number: "1",
            contact_person: "Admin Oclar",
            email: "office@oclar.ro",
            phone: "0712345678",
            has_map_point: false
        },
        receiver: {
            name: "Client Test Fix",
            country: "ro",
            county: "Bucuresti",
            locality_id: 323,
            locality: "Bucuresti",
            postal_code: "011318",
            street_name: "Bucuresti-Ploiesti",
            street_number: "172",
            contact_person: "Client Test",
            email: "client@test.ro",
            phone: "0722123123",
            has_map_point: false
        },
        parcel: {
            type: "package",
            shape: "standard",
            observations: "Test Fix"
        },
        parcels: [{
            weight: 1,
            dimensions: { length: 10, width: 10, height: 10 },
            content: "TEST",
            declared_value: 0
        }],
        additional_services: { cod: { status: false, amount: 0 } },
        courier: {
            service: "dpd_standard",
            pickup: {
                type: "courier",
                date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                time: "13:00"
            },
            contract_id: 4
        },
        shipment_details: { sender_forklift: false, receiver_forklift: false }
    };

    // --- TEST 1: Header XML + v2 ---
    console.log('🧪 Attempt 1: Standard v2 + X-Requested-With Header');
    const res1 = await fetch(`${BASE_URL_V2}/add-parcel/save-order-to-send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest' // <--- Header Critic pentru Laravel
        },
        body: JSON.stringify(payloadV2)
    });
    
    console.log(`📡 Status: ${res1.status}`);
    if (res1.status !== 401) {
        console.log('✅ SUCCESS! (Attempt 1 worked)');
        console.log('Response:', await res1.text());
        return;
    } else {
        console.log('❌ Failed (401). Trying next method...\n');
    }

    // --- TEST 2: Token în BODY ---
    console.log('🧪 Attempt 2: Sending access_token inside JSON Body');
    const payloadWithToken = { ...payloadV2, access_token: token }; // Injectăm token-ul
    
    const res2 = await fetch(`${BASE_URL_V2}/add-parcel/save-order-to-send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payloadWithToken)
    });

    console.log(`📡 Status: ${res2.status}`);
    if (res2.status !== 401) {
        console.log('✅ SUCCESS! (Attempt 2 worked)');
        console.log('Response:', await res2.text());
        return;
    } else {
        console.log('❌ Failed (401). Trying next method...\n');
    }

    // --- TEST 3: Fallback la v1 ---
    console.log('🧪 Attempt 3: Fallback to v1 endpoint (cu structura v1)');
    // Convertim payload la v1 (fără array parcels, direct în parcel)
    const payloadV1 = { ...payloadV2 };
    delete payloadV1.parcels;
    payloadV1.parcel = {
        ...payloadV2.parcel,
        weight: 1,
        dimensions: { length: 10, width: 10, height: 10 },
        content: "TEST",
        amount: 1
    };

    const res3 = await fetch(`${BASE_URL_V1}/add-parcel/save-order-to-send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payloadV1)
    });

    console.log(`📡 Status: ${res3.status}`);
    console.log('Response:', await res3.text());
}

runFixTest();