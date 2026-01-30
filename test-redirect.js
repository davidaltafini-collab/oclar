import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

async function checkRedirect() {
    console.log('🕵️‍♂️ Starting Redirect Detective...');
    
    // 1. Luam Token
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID.trim());
    params.append('client_secret', CLIENT_SECRET.trim());

    const authRes = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });
    const authData = await authRes.json();
    const token = authData.access_token;
    console.log('✅ Token obtained.');

    // 2. Facem request POST cu redirect: 'manual'
    console.log('\n🧪 Testing POST request with redirect: "manual"');
    const url = `${BASE_URL}/add-parcel/save-order-to-send`; // URL-ul curent
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ test: true }),
        redirect: 'manual' // <--- Aici e cheia
    });

    console.log(`📡 Status: ${response.status}`);
    
    if (response.status >= 300 && response.status < 400) {
        console.log('🚨 REDIRECT DETECTED!');
        console.log(`➡️ Location Header: ${response.headers.get('location')}`);
        console.log('💡 SOLUTION: Update your ECOLET_BASE_URL or endpoints to match the Location header exactly.');
    } else if (response.status === 401) {
        console.log('❌ Still 401. No redirect involved. Token rejected directly.');
        // Daca nu e redirect, incercam cu token in URL ca fallback
        await testUrlToken(url, token);
    } else {
        console.log('✅ Connection established (Status code other than 401/3xx).');
        console.log('Response:', await response.text());
    }
}

async function testUrlToken(baseUrl, token) {
    console.log('\n🔄 Retrying with ?access_token= in URL (ignoring redirects)...');
    const url = `${baseUrl}?access_token=${token}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ test: true }),
        redirect: 'manual'
    });
    console.log(`📡 Status: ${response.status}`);
    if (response.status === 301 || response.status === 302) {
         console.log(`➡️ Redirects to: ${response.headers.get('location')}`);
    } else {
         console.log('Response:', await response.text());
    }
}

checkRedirect();