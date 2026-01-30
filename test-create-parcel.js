import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// 1. Definim variabilele o singură dată
const BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

// 2. Debugging - Verificăm ce citește scriptul (fără să afișăm secretele complet)
console.log('🔍 DEBUG CREDENTIALS:');
console.log(`- CLIENT_ID Type: ${typeof CLIENT_ID}`);
console.log(`- CLIENT_ID Value: ${CLIENT_ID ? `'${CLIENT_ID}'` : 'UNDEFINED'}`);
console.log(`- CLIENT_SECRET Set: ${CLIENT_SECRET ? 'YES' : 'NO'}`);
console.log(`- CLIENT_SECRET Length: ${CLIENT_SECRET ? CLIENT_SECRET.length : 0}`);
console.log('-------------------\n');

async function getToken() {
    console.log('🔄 Authenticating...');
    
    // Curățăm valorile de spații accidentale
    const cleanClientId = CLIENT_ID ? CLIENT_ID.trim() : '';
    const cleanSecret = CLIENT_SECRET ? CLIENT_SECRET.trim() : '';

    if (!cleanClientId || !cleanSecret) {
        throw new Error('❌ Missing credentials in .env file');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', cleanClientId);
    params.append('client_secret', cleanSecret);

    const response = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json' 
        },
        body: params.toString()
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('❌ Auth Error Response:', text);
        throw new Error(`Auth failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function testCreateParcel() {
    try {
        const token = await getToken();
        console.log('✅ Token received:', token ? token.substring(0, 10) + '...' : 'NULL');

        // Test payload conform Swagger
        const testPayload = {
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
                has_map_point: false,
                map_point_id: null
            },
            receiver: {
                name: "Client Test",
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
                has_map_point: false,
                map_point_id: null
            },
            parcel: {
                type: "package",
                weight: 1,
                dimensions: { length: 10, width: 15, height: 10 },
                shape: "standard",
                declared_value: null,
                amount: 1,
                content: "Ochelari Test",
                observations: "Test integration"
            },
            additional_services: {
                cod: { status: false, amount: 0 },
                open_package: { status: false },
                rod: { status: false },
                rop: { status: false },
                saturday_delivery: { status: false },
                sms_notify: { status: false },
                swap: { status: false },
                epod: { status: false }
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
                uit_code: null,
                sender_forklift: false,
                receiver_forklift: false
            },
            coupon: { code: null }
        };

        console.log('\n📝 Test: POST /add-parcel/save-order-to-send');
        
        const response = await fetch(`${BASE_URL}/add-parcel/save-order-to-send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        const text = await response.text();
        console.log('Status:', response.status);
        
        try {
            console.log('Response:', JSON.stringify(JSON.parse(text), null, 2));
        } catch {
            console.log('Response Text:', text);
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testCreateParcel();