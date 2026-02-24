import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Încărcăm variabilele din .env
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';

async function listAllServices() {
    console.log("--- 🔍 SCANARE COMPLETĂ SERVICII ECOLET ---");

    if (!process.env.ECOLET_CLIENT_ID) {
        console.error("❌ EROARE: Nu pot citi .env!");
        return;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.ECOLET_CLIENT_ID);
    params.append('client_secret', process.env.ECOLET_CLIENT_SECRET);
    params.append('username', process.env.ECOLET_USERNAME);
    params.append('password', process.env.ECOLET_PASSWORD);

    try {
        // 1. AUTENTIFICARE
        process.stdout.write("1. Autentificare... ");
        const authRes = await fetch(`${ECOLET_BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!authRes.ok) {
            console.log("❌ EȘUAT");
            console.error(await authRes.text());
            return;
        }

        const authData = await authRes.json();
        const token = authData.access_token;
        console.log("✅ OK");

        // 2. DESCĂRCARE SERVICII
        process.stdout.write("2. Descărcare listă servicii... ");
        const servicesRes = await fetch(`${ECOLET_BASE_URL}/services`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const servicesData = await servicesRes.json();
        const services = servicesData.services || servicesData;
        console.log(`✅ OK (${services.length} servicii găsite)\n`);

        // 3. AFIȘARE DETALIATĂ
        console.log("====== LISTA DISPONIBILĂ PE CONTUL TĂU ======");
        
        services.forEach((s, i) => {
            const courierName = s.courier ? s.courier.slug.toUpperCase() : "NECUNOSCUT";
            console.log(`${i + 1}. [${courierName}] ${s.full_name}`);
            console.log(`   👉 SLUG (ID Cod): "${s.slug}"`);
            console.log(`   📝 ID Contract:   ${s.contract_id || 'Standard'}`);
            console.log("--------------------------------------------------");
        });

        console.log("\n✅ Gata! Acestea sunt singurele servicii pe care le poți folosi.");

    } catch (e) {
        console.error("\n❌ Eroare script:", e);
    }
}

listAllServices();