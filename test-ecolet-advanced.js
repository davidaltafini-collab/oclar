import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL;
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

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
            client_secret: CLIENT_SECRET,
            scope: '*' // încearcă să obții toate permisiunile
        })
    });

    const data = await response.json();
    console.log('🔑 Full token response:', JSON.stringify(data, null, 2));
    return data.access_token;
}

async function testWithDifferentAuth(path) {
    console.log(`\n📝 Testing: ${path}`);
    
    const token = await getToken();
    
    // Test 1: Bearer în header (standard)
    console.log('  1️⃣ Bearer in Authorization header');
    let response = await fetch(`${BASE_URL}${path}`, {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });
    console.log(`     Status: ${response.status}`);
    let text = await response.text();
    if (text) console.log(`     Response: ${text.substring(0, 100)}`);

    // Test 2: Token în query params
    console.log('  2️⃣ Token in query params');
    response = await fetch(`${BASE_URL}${path}?access_token=${token}`, {
        headers: { 'Accept': 'application/json' }
    });
    console.log(`     Status: ${response.status}`);
    text = await response.text();
    if (text) console.log(`     Response: ${text.substring(0, 100)}`);

    // Test 3: Token în body (pentru POST)
    if (path === '/order' || path === '/orders') {
        console.log('  3️⃣ POST with token in body');
        response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                access_token: token,
                recipient_name: "Test",
                recipient_phone: "0712345678",
                city: "București"
            })
        });
        console.log(`     Status: ${response.status}`);
        text = await response.text();
        if (text) console.log(`     Response: ${text.substring(0, 200)}`);
    }
}

// Testează și alte variante de base URL
async function testAlternativeURLs() {
    const token = await getToken();
    
    const alternatives = [
        'https://panel.ecolet.ro/api/v2/order',
        'https://panel.ecolet.ro/api/order',
        'https://api.ecolet.ro/v1/order',
        'https://api.ecolet.ro/order',
        'https://panel.ecolet.ro/api/v1/client/orders',
        'https://panel.ecolet.ro/api/v1/courier/orders'
    ];

    console.log('\n🌐 Testing alternative URLs...');
    for (const url of alternatives) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log(`${url} → ${response.status}`);
            if (response.status !== 404) {
                const text = await response.text();
                console.log(`   Response: ${text.substring(0, 150)}`);
            }
        } catch (error) {
            console.log(`${url} → Error: ${error.message}`);
        }
    }
}

(async () => {
    console.log('🔍 Advanced Ecolet API Testing\n');
    
    // Endpoint-uri care au returnат 401 (există, dar auth nu merge)
    const prometingEndpoints = ['/order', '/services'];
    
    for (const endpoint of prometingEndpoints) {
        await testWithDifferentAuth(endpoint);
    }

    await testAlternativeURLs();

    // Încearcă să descifrezi structura token-ului JWT
    console.log('\n\n🔐 JWT Token Analysis:');
    const token = await getToken();
    const parts = token.split('.');
    if (parts.length === 3) {
        try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log('Token payload:', JSON.stringify(payload, null, 2));
        } catch (e) {
            console.log('Could not decode token');
        }
    }
})();