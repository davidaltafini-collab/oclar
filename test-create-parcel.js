import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL;
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

async function getToken() {
    const response = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            scope: '*'
        })
    });
    const data = await response.json();
    return data.access_token;
}

async function testCreateParcel() {
    const token = await getToken();
    console.log('✅ Token received\n');

    // Test 1: Reload form (validare + prețuri)
    console.log('📝 Test 1: POST /add-parcel/reload-form');
    
    const testPayload = {
        // Ghicim structura - o să ajustăm după ce vezi schema
        recipient_name: "Test User",
        recipient_phone: "0712345678",
        recipient_email: "test@example.com",
        city: "București",
        county: "București",
        address: "Str. Test 1",
        postal_code: "123456",
        service_type: "courier",
        weight: 1,
        length: 30,
        width: 20,
        height: 10,
        cod_amount: 0,
        reference: "TEST-ORDER-123"
    };

    try {
        const response = await fetch(`${BASE_URL}/add-parcel/reload-form`, {
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
        console.log('Response:', text.substring(0, 500));

        if (response.status === 200 || response.status === 422) {
            console.log('\n✅ Endpoint funcționează!');
            if (response.status === 422) {
                console.log('ℹ️  Validation error - trebuie să ajustăm payload-ul');
            }
        }
    } catch (error) {
        console.log('Error:', error.message);
    }

    // Test 2: Save order to send (draft)
    console.log('\n\n📝 Test 2: POST /add-parcel/save-order-to-send');
    try {
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
        console.log('Response:', text.substring(0, 500));

        if (response.status === 200 || response.status === 422) {
            console.log('\n✅ Endpoint funcționează!');
        }
    } catch (error) {
        console.log('Error:', error.message);
    }
}

testCreateParcel();