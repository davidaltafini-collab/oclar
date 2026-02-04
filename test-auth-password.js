import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;
const USERNAME = process.env.ECOLET_USERNAME;
const PASSWORD = process.env.ECOLET_PASSWORD;

async function testPasswordAuth() {
    console.log('🔐 Testing "Password Grant" Authentication...');

    if (!USERNAME || !PASSWORD) {
        console.error('❌ EROARE: Lipsesc ECOLET_USERNAME sau ECOLET_PASSWORD din .env');
        return;
    }

    const params = new URLSearchParams();
    // AICI ESTE SCHIMBAREA CERUTĂ DE SUPORT:
    params.append('grant_type', 'password'); 
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('username', USERNAME);
    params.append('password', PASSWORD);
    // Ei au zis explicit: "scope trebuie lăsat necompletat"
    // params.append('scope', ''); 

    try {
        // 1. Obținem Token-ul
        const authRes = await fetch(`${BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        const authData = await authRes.json();

        if (!authRes.ok) {
            console.log('❌ Auth Failed:', authData);
            return;
        }

        console.log('✅ Token obtained via Password Grant!');
        const token = authData.access_token;

        // 2. Testăm direct POST-ul care nu mergea (Creare Comandă)
        console.log('\n📦 Testing POST (Create Order)...');
        
        const payload = {
            sender: {
                name: "Test Oclar",
                country: "ro",
                county: "Bucuresti",
                locality_id: 323,
                locality: "Bucuresti",
                postal_code: "011318",
                street_name: "Strada Test",
                street_number: "1",
                contact_person: "Admin",
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
                street_name: "Strada Destinatar",
                street_number: "20",
                contact_person: "Client",
                email: "client@test.ro",
                phone: "0722123456"
            },
            parcel: {
                type: "package",
                weight: 1,
                dimensions: { length: 10, width: 10, height: 10 },
                content: "TEST"
            },
            additional_services: { cod: { status: false } },
            courier: {
                service: "dpd_standard", // Sau serviciul tau activ
                pickup: { type: "courier", date: new Date(Date.now() + 86400000).toISOString().split('T')[0], time: "12:00" },
                contract_id: 4 // Schimba daca ai alt ID
            }
        };

        const postRes = await fetch(`${BASE_URL}/add-parcel/save-order-to-send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const postText = await postRes.text();
        console.log(`📡 POST Status: ${postRes.status}`);
        
        try {
            console.log('Response:', JSON.stringify(JSON.parse(postText), null, 2));
        } catch {
            console.log('Response Raw:', postText);
        }

    } catch (e) {
        console.error('Eroare script:', e);
    }
}

testPasswordAuth();