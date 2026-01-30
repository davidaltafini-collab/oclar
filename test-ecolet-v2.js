import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL_V1 = 'https://panel.ecolet.ro/api/v1';
const BASE_URL_V2 = 'https://panel.ecolet.ro/api/v2'; // ⚠️ Endpoint nou
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

async function testV2Integration() {
    console.log('🚀 Starting Ecolet V2 Test...');

    // 1. AUTENTIFICARE (Rămâne pe v1)
    console.log('🔑 Authenticating on v1...');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'client_credentials');
    authParams.append('client_id', CLIENT_ID.trim());
    authParams.append('client_secret', CLIENT_SECRET.trim());

    const authRes = await fetch(`${BASE_URL_V1}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: authParams.toString()
    });

    if (!authRes.ok) throw new Error(`Auth failed: ${await authRes.text()}`);
    const { access_token: token } = await authRes.json();
    console.log('✅ Token obtained.');

    // 2. CREARE COMANDĂ (Pe v2 cu structură nouă)
    console.log('\n📦 Sending Order to v2 endpoint...');
    
    // Structura V2 conform documentației:
    const v2Payload = {
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
            name: "Client Test V2",
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
        // În V2, 'parcel' conține doar tipul și observațiile
        parcel: {
            type: "package",
            shape: "standard",
            observations: "Test V2 Integration"
        },
        // ⚠️ ARRAY NOU 'parcels' pentru dimensiuni/greutate
        parcels: [{
            weight: 1,
            dimensions: {
                length: 10,
                width: 10,
                height: 10
            },
            content: "Ochelari Test",
            declared_value: 0
        }],
        additional_services: {
            cod: { status: false, amount: 0 },
            open_package: { status: false },
            sms_notify: { status: false }
        },
        courier: {
            service: "dpd_standard",
            pickup: {
                type: "courier",
                date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                time: "13:00"
            },
            contract_id: 4
        },
        shipment_details: {
            sender_forklift: false,
            receiver_forklift: false
        }
    };

    const response = await fetch(`${BASE_URL_V2}/add-parcel/save-order-to-send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(v2Payload)
    });

    const text = await response.text();
    console.log(`📡 Status: ${response.status}`);
    
    try {
        console.log('Response:', JSON.stringify(JSON.parse(text), null, 2));
    } catch {
        console.log('Response Text:', text);
    }
}

testV2Integration();