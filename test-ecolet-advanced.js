import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

async function runDiagnostics() {
    console.log('🔍 Starting Ecolet Diagnostics...');
    console.log(`📡 Connecting to: ${BASE_URL}`);

    // PASUL 1: AUTENTIFICARE
    console.log('\n1️⃣  Step 1: Getting Token...');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'client_credentials');
    authParams.append('client_id', CLIENT_ID ? CLIENT_ID.trim() : '');
    authParams.append('client_secret', CLIENT_SECRET ? CLIENT_SECRET.trim() : '');
    // Uneori scope-ul ajută, chiar dacă e steluță
    authParams.append('scope', '*'); 

    const authRes = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: authParams.toString()
    });

    if (!authRes.ok) {
        console.error('❌ Authentication Failed:', await authRes.text());
        return;
    }

    const authData = await authRes.json();
    const token = authData.access_token;
    console.log('✅ Token Received!');
    console.log(`🔑 Token Type: ${authData.token_type || 'Bearer'}`);
    console.log(`⏳ Expires in: ${authData.expires_in}`);

    // PASUL 2: TEST GET (CITIRE)
    // Încercăm să citim ID-ul pentru București. Dacă asta merge, token-ul e bun.
    console.log('\n2️⃣  Step 2: Testing Read Access (GET /locations)...');
    
    // Header standard OAuth
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Oclar-Test-Script/1.0' // Uneori serverele blochează requesturi fără User-Agent
    };

    const getRes = await fetch(`${BASE_URL}/locations/ro/bucuresti/localities/bucuresti`, {
        method: 'GET',
        headers: headers
    });

    const getText = await getRes.text();
    console.log(`Status: ${getRes.status}`);
    
    if (getRes.status === 200) {
        console.log('✅ READ Access Confirmed! (Token works)');
    } else {
        console.error('❌ READ Access Failed!');
        console.error('Response:', getText);
        console.log('⚠️  If Step 2 fails, the POST in Step 3 will definitely fail.');
        // Nu ne oprim, încercăm și POST doar ca să vedem eroarea
    }

    // PASUL 3: TEST POST (CREARE DRAFT)
    console.log('\n3️⃣  Step 3: Testing Write Access (POST /add-parcel)...');
    
    const payload = {
        sender: {
            name: "OCLAR TEST",
            country: "ro",
            county: "Bucuresti",
            locality_id: 323,
            locality: "Bucuresti",
            postal_code: "011318",
            street_name: "Str. Testare",
            street_number: "1",
            contact_person: "Test",
            email: "office@oclar.ro",
            phone: "0712345678"
        },
        receiver: {
            name: "Client Test",
            country: "ro",
            county: "Bucuresti",
            locality_id: 323,
            locality: "Bucuresti",
            postal_code: "011318",
            street_name: "Bucuresti",
            street_number: "1",
            contact_person: "Client",
            email: "client@test.ro",
            phone: "0722123123"
        },
        parcel: {
            type: "package",
            weight: 1,
            dimensions: { length: 10, width: 10, height: 10 },
            content: "TEST"
        },
        additional_services: { cod: { status: false, amount: 0 } },
        courier: {
            service: "dpd_standard",
            pickup: {
                type: "courier",
                date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                time: "13:00"
            },
            contract_id: 4 // Poate fi diferit pe contul tau!
        }
    };

    const postRes = await fetch(`${BASE_URL}/add-parcel/save-order-to-send`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    const postText = await postRes.text();
    console.log(`Status: ${postRes.status}`);
    console.log('Response:', postText);
}

runDiagnostics();