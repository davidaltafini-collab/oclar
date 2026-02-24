// test-ecolet.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';

async function checkServices() {
    console.log("1. Autentificare Ecolet...");
    
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.ECOLET_CLIENT_ID);
    params.append('client_secret', process.env.ECOLET_CLIENT_SECRET);
    params.append('username', process.env.ECOLET_USERNAME);
    params.append('password', process.env.ECOLET_PASSWORD);

    try {
        const authRes = await fetch(`${ECOLET_BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!authRes.ok) {
            console.error("❌ Eroare Auth:", await authRes.text());
            return;
        }

        const authData = await authRes.json();
        const token = authData.access_token;
        console.log("✅ Token obținut!");

        console.log("2. Căutare servicii EasyBox...");
        const servicesRes = await fetch(`${ECOLET_BASE_URL}/services`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const servicesData = await servicesRes.json();
        const services = servicesData.services || servicesData;

        console.log("\n====== LISTA SERVICII DISPONIBILE ======");
        const easyboxServices = services.filter(s => 
            s.slug.includes('easy') || 
            s.slug.includes('sameday') || 
            s.full_name.toLowerCase().includes('easybox')
        );

        if (easyboxServices.length === 0) {
            console.log("⚠️ Nu am găsit servicii cu numele 'easy' sau 'sameday'. Iată tot ce ai:");
            services.forEach(s => console.log(`Slug: "${s.slug}" | Nume: "${s.full_name}"`));
        } else {
            easyboxServices.forEach(s => {
                console.log(`\n📌 Serviciu: ${s.full_name}`);
                console.log(`   SLUG DE PUS IN COD:  "${s.slug}"`); // <--- Asta cauți
                console.log(`   Courier slug:        "${s.courier?.slug}"`);
            });
        }
        console.log("\n========================================");

    } catch (e) {
        console.error("Eroare script:", e);
    }
}

checkServices();
