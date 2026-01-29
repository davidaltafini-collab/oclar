import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL;
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

console.log('Testing Ecolet API...');
console.log('BASE_URL:', BASE_URL);

// Autentificare
async function getToken() {
    const response = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        })
    });

    const data = await response.json();
    return data.access_token;
}

// Testează diferite endpoint-uri posibile
async function testEndpoint(token, path, method = 'GET', body = null) {
    console.log(`\n📝 Testing: ${method} ${path}`);
    try {
        const options = {
            method,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${BASE_URL}${path}`, options);
        const text = await response.text();
        
        console.log(`Status: ${response.status}`);
        
        if (text.startsWith('<!DOCTYPE')) {
            console.log('❌ HTML response (wrong endpoint)');
        } else if (text.length > 0) {
            try {
                const data = JSON.parse(text);
                console.log('✅ JSON response:', JSON.stringify(data, null, 2).substring(0, 300));
            } catch {
                console.log('Response:', text.substring(0, 200));
            }
        } else {
            console.log('Empty response');
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

(async () => {
    console.log('\n🔐 Getting auth token...');
    const token = await getToken();
    console.log('✅ Token received');

    // Testează endpoint-uri comune pentru comenzi/shipments
    const endpoints = [
        '/shipments',
        '/orders',
        '/parcels',
        '/awb',
        '/deliveries',
        '/packages',
        '/order',
        '/shipment',
        '/parcel'
    ];

    console.log('\n📦 Testing GET endpoints...');
    for (const endpoint of endpoints) {
        await testEndpoint(token, endpoint);
    }

    // Testează crearea unui shipment de test (doar să vedem ce endpoint acceptă POST)
    console.log('\n\n📮 Testing POST endpoints with dummy data...');
    
    const testPayload = {
        recipient: {
            name: "Test User",
            phone: "0712345678"
        },
        address: {
            city: "București",
            county: "București",
            street: "Str. Test 1"
        },
        service_type: "courier"
    };

    for (const endpoint of ['/shipments', '/orders', '/order', '/parcels']) {
        await testEndpoint(token, endpoint, 'POST', testPayload);
    }

    // Testează și endpoint-uri specifice Ecolet
    console.log('\n\n🔍 Testing Ecolet-specific endpoints...');
    const ecoletEndpoints = [
        '/lockers',
        '/easybox',
        '/services',
        '/me',
        '/user',
        '/account'
    ];

    for (const endpoint of ecoletEndpoints) {
        await testEndpoint(token, endpoint);
    }
})();