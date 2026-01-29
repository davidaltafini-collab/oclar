/**
 * SERVICIU ECOLET - API REAL cu OAuth 2.0
 * https://panel.ecolet.ro/api/v1
 */

import dotenv from 'dotenv';
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const ECOLET_CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const ECOLET_CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

// Cache pentru access token (evită autentificări repetate)
let cachedToken = null;
let tokenExpiry = null;

/**
 * Autentificare OAuth 2.0
 * Returnează access_token valid
 */
async function authenticate() {
    // Verifică dacă avem token valid în cache
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    if (!ECOLET_CLIENT_ID || !ECOLET_CLIENT_SECRET) {
        throw new Error('Ecolet credentials missing in .env (ECOLET_CLIENT_ID, ECOLET_CLIENT_SECRET)');
    }

    try {
        console.log('🔐 Authenticating with Ecolet OAuth...');
        
        const response = await fetch(`${ECOLET_BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: ECOLET_CLIENT_ID,
                client_secret: ECOLET_CLIENT_SECRET
            })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Ecolet auth failed:', response.status, text);
            throw new Error(`Ecolet auth failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.access_token) {
            throw new Error('No access_token in Ecolet response');
        }

        // Salvează în cache (expiry - 5 minute pentru siguranță)
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;

        console.log('✅ Ecolet authenticated successfully');
        return cachedToken;

    } catch (error) {
        console.error('❌ Ecolet authentication error:', error);
        throw error;
    }
}

/**
 * Creează un draft de expediere în Ecolet
 * NU emite AWB automat
 * 
 * @param {Object} order - Comanda din DB
 * @returns {Object} { success, ecolet_shipment_id, status, message }
 */
export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        // Parsăm datele comenzii
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const shippingAddress = typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : order.shipping_address;

        // Verificăm că avem datele necesare
        if (!order.customer_phone) {
            throw new Error('Customer phone is required for Ecolet shipment');
        }

        // Pregătim payload-ul conform API Ecolet
        let payload;

        if (order.shipping_method === 'easybox' && order.locker_id) {
            // LIVRARE EASYBOX (LOCKER)
            payload = {
                service_type: 'locker', // sau 'easybox'
                locker_id: order.locker_id,
                
                // Date destinatar
                recipient: {
                    name: order.customer_name,
                    phone: order.customer_phone.replace(/\s/g, ''), // elimină spații
                    email: order.customer_email || null
                },
                
                // Date colet
                parcel: {
                    weight: items.reduce((sum, item) => sum + (item.quantity * 0.5), 0.5), // kg
                    length: 30, // cm - ajustează după nevoie
                    width: 20,
                    height: 10,
                    contents: items.map(item => item.name).join(', ').substring(0, 100)
                },
                
                // Ramburs (doar pentru plata ramburs)
                cod_amount: order.payment_method === 'ramburs' ? parseFloat(order.total_amount) : 0,
                
                // Referință internă
                reference: `ORDER-${order.id}`,
                
                // Notă
                notes: `Comandă OCLAR #${order.id}`,
                
                // NU emite AWB automat
                auto_generate_awb: false
            };

        } else {
            // LIVRARE CURIER CLASIC
            payload = {
                service_type: 'courier', // sau 'standard'
                
                // Date destinatar
                recipient: {
                    name: order.customer_name,
                    phone: order.customer_phone.replace(/\s/g, ''),
                    email: order.customer_email || null
                },
                
                // Adresa completă
                address: {
                    street: shippingAddress.line || shippingAddress.line1 || order.address_line,
                    city: shippingAddress.city || order.city,
                    county: shippingAddress.county || order.county,
                    postal_code: order.postal_code,
                    country: 'RO'
                },
                
                // Date colet
                parcel: {
                    weight: items.reduce((sum, item) => sum + (item.quantity * 0.5), 0.5), // kg
                    length: 30,
                    width: 20,
                    height: 10,
                    contents: items.map(item => item.name).join(', ').substring(0, 100)
                },
                
                // Ramburs
                cod_amount: order.payment_method === 'ramburs' ? parseFloat(order.total_amount) : 0,
                
                // Referință
                reference: `ORDER-${order.id}`,
                
                // Notă
                notes: `Comandă OCLAR #${order.id}`,
                
                // NU emite AWB automat
                auto_generate_awb: false
            };
        }

        console.log('📦 Creating Ecolet draft for order', order.id);

        // Apel API Ecolet - endpoint-ul poate fi /shipments sau /orders
        // Încearcă mai întâi /shipments
        const response = await fetch(`${ECOLET_BASE_URL}/shipments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        
        // Verifică dacă primim HTML (eroare de endpoint)
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
            console.error('❌ Received HTML instead of JSON. Wrong endpoint?');
            console.error('Response:', text.substring(0, 200));
            throw new Error('Ecolet API returned HTML - check endpoint URL');
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('❌ Failed to parse response:', text);
            throw new Error('Invalid JSON response from Ecolet API');
        }

        if (!response.ok) {
            console.error('❌ Ecolet API error:', response.status, data);
            throw new Error(data.message || data.error || 'Failed to create draft shipment');
        }

        // ID-ul shipment-ului poate fi în data.id sau data.shipment_id
        const shipmentId = data.id || data.shipment_id || data.data?.id;

        if (!shipmentId) {
            console.error('❌ No shipment ID in response:', data);
            throw new Error('No shipment ID returned from Ecolet');
        }

        console.log('✅ Ecolet draft created:', shipmentId);

        return {
            success: true,
            ecolet_shipment_id: shipmentId,
            status: 'draft',
            message: 'Draft creat cu succes în Ecolet'
        };

    } catch (error) {
        console.error('❌ Ecolet createDraftShipment error:', error);
        return {
            success: false,
            ecolet_shipment_id: null,
            status: 'error',
            message: error.message
        };
    }
}

/**
 * Verifică statusul unei expedieri și obține AWB-ul dacă este disponibil
 * 
 * @param {string} shipmentId - ID-ul expedieri din Ecolet
 * @returns {Object} { success, awb_number, label_url, status, message }
 */
export async function getShipmentStatus(shipmentId) {
    try {
        const token = await authenticate();

        const response = await fetch(`${ECOLET_BASE_URL}/shipments/${shipmentId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const text = await response.text();
        
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
            console.error('❌ Received HTML instead of JSON');
            throw new Error('Ecolet API returned HTML - check endpoint URL');
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('❌ Failed to parse response:', text);
            throw new Error('Invalid JSON response from Ecolet API');
        }

        if (!response.ok) {
            throw new Error(data.message || `Failed to fetch shipment status: ${response.status}`);
        }

        // Verificăm dacă AWB-ul a fost generat
        // Câmpul poate fi awb_number, tracking_number, awb, etc.
        const awbNumber = data.awb_number || data.tracking_number || data.awb || data.data?.awb_number;
        const labelUrl = data.label_url || data.label || data.pdf_url || data.data?.label_url;
        const status = data.status || data.state || 'draft';

        if (awbNumber && (status === 'completed' || status === 'active' || status === 'confirmed')) {
            return {
                success: true,
                awb_number: awbNumber,
                label_url: labelUrl || null,
                status: 'completed',
                message: 'AWB disponibil'
            };
        } else {
            return {
                success: false,
                awb_number: null,
                label_url: null,
                status: status,
                message: `AWB încă nedisponibil (status: ${status})`
            };
        }

    } catch (error) {
        console.error('❌ Ecolet getShipmentStatus error:', error);
        return {
            success: false,
            awb_number: null,
            label_url: null,
            status: 'error',
            message: error.message
        };
    }
}

/**
 * Obține link-ul către label-ul PDF al AWB-ului
 * 
 * @param {string} shipmentId - ID-ul expedieri
 * @returns {Object} { success, label_url, message }
 */
export async function getShipmentLabel(shipmentId) {
    try {
        const token = await authenticate();

        const response = await fetch(`${ECOLET_BASE_URL}/shipments/${shipmentId}/label`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const text = await response.text();
        
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
            throw new Error('Ecolet API returned HTML - check endpoint URL');
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error('Invalid JSON response from Ecolet API');
        }

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch label');
        }

        const labelUrl = data.label_url || data.url || data.pdf_url || data.data?.url;

        if (!labelUrl) {
            throw new Error('No label URL in response');
        }

        return {
            success: true,
            label_url: labelUrl,
            message: 'Label obținut cu succes'
        };

    } catch (error) {
        console.error('❌ Ecolet getShipmentLabel error:', error);
        return {
            success: false,
            label_url: null,
            message: error.message
        };
    }
}