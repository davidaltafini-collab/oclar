import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL;
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

console.log('Testing Ecolet API...');
console.log('BASE_URL:', BASE_URL);
console.log('CLIENT_ID:', CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('CLIENT_SECRET:', CLIENT_SECRET ? '✓ Set' : '✗ Missing');

// Test 1: Autentificare
async function testAuth() {
    console.log('\n📝 Test 1: OAuth Authentication');
    try {
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

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text.substring(0, 500));

        if (text.startsWith('<!DOCTYPE')) {
            console.log('❌ Received HTML - endpoint greșit!');
            return null;
        }

        const data = JSON.parse(text);
        if (data.access_token) {
            console.log('✅ Token obținut:', data.access_token.substring(0, 20) + '...');
            return data.access_token;
        } else {
            console.log('❌ No access token in response');
            return null;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return null;
    }
}

// Test 2: Listare shipments (dacă există)
async function testListShipments(token) {
    if (!token) return;
    
    console.log('\n📝 Test 2: List Shipments');
    try {
        const response = await fetch(`${BASE_URL}/shipments`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text.substring(0, 500));
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

// Rulează testele
(async () => {
    const token = await testAuth();
    await testListShipments(token);
})();