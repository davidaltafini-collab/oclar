import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

// Debug
console.log('🔍 Config:', {
    baseUrl: BASE_URL,
    clientIdSet: !!CLIENT_ID,
    clientSecretSet: !!CLIENT_SECRET
});

async function getToken() {
    console.log('🔄 Authenticating...');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID ? CLIENT_ID.trim() : '');
    params.append('client_secret', CLIENT_SECRET ? CLIENT_SECRET.trim() : '');

    const response = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!response.ok) {
        throw new Error(`Auth failed: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function testCreateParcel() {
    try {
        const token = await getToken();
        console.log('✅ Token received\n');

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

        console.log('📝 Test: POST /add-parcel/save-order-to-send');
        
        // SOLUȚIA: Adăugăm token-ul direct în URL
        const url = `${BASE_URL}/add-parcel/save-order-to-send?access_token=${token}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                // Păstrăm și header-ul standard, dar query param-ul are prioritate adesea
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