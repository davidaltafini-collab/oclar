import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const USERNAME = process.env.ECOLET_USERNAME;
const PASSWORD = process.env.ECOLET_PASSWORD;
const CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

async function findCityId(county, city) {
    // 1. Luam token
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('username', USERNAME);
    params.append('password', PASSWORD);

    const authRes = await fetch(`${BASE_URL}/oauth/token`, {
        method: 'POST',
        body: params
    });
    const { access_token } = await authRes.json();

    // 2. Cautam orasul
    const countyNorm = county.toLowerCase().replace(/\s+/g, '-');
    const cityNorm = city.trim();
    
    console.log(`🔍 Caut ID pentru: ${county} / ${city}...`);
    
    const res = await fetch(
        `${BASE_URL}/locations/ro/${countyNorm}/localities/${encodeURIComponent(cityNorm)}`,
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    );
    
    const data = await res.json();
    console.log('REZULTAT:', JSON.stringify(data, null, 2));
}

// Modifică aici cu Județul și Orașul tău real!
findCityId("Bucuresti", "Bucuresti");