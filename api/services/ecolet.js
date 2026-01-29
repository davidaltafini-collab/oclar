/**
 * SERVICIU ECOLET - API Real
 * Endpoint-uri confirmate în Swagger
 */

import dotenv from 'dotenv';
dotenv.config();

const ECOLET_BASE_URL = process.env.ECOLET_BASE_URL || 'https://panel.ecolet.ro/api/v1';
const ECOLET_CLIENT_ID = process.env.ECOLET_CLIENT_ID;
const ECOLET_CLIENT_SECRET = process.env.ECOLET_CLIENT_SECRET;

// Cache token
let cachedToken = null;
let tokenExpiry = null;

/**
 * Autentificare OAuth 2.0
 */
async function authenticate() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    if (!ECOLET_CLIENT_ID || !ECOLET_CLIENT_SECRET) {
        throw new Error('Ecolet credentials missing');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', ECOLET_CLIENT_ID);
    params.append('client_secret', ECOLET_CLIENT_SECRET);

    const response = await fetch(`${ECOLET_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: params.toString()
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('❌ Ecolet auth failed:', response.status, data);
        throw new Error(`Ecolet auth failed: ${response.status}`);
    }

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + ((data.expires_in || 31536000) - 300) * 1000;

    console.log('✅ Ecolet authenticated');
    return cachedToken;
}


/**
 * Obține locality_id pentru oraș
 */
async function getLocalityId(token, county, city) {
    try {
        // Normalizare județ (fără diacritice pentru URL)
        const countyNorm = county
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-');

        const response = await fetch(
            `${ECOLET_BASE_URL}/locations/ro/${countyNorm}/localities/${city}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error(`❌ Locality not found: ${county} / ${city}`);
            return null;
        }

        const data = await response.json();
        
        // API poate returna array sau object
        if (Array.isArray(data) && data.length > 0) {
            return data[0].id;
        } else if (data.id) {
            return data.id;
        } else if (data.data && data.data.id) {
            return data.data.id;
        }

        return null;

    } catch (error) {
        console.error('❌ Error getting locality_id:', error);
        return null;
    }
}

/**
 * Creează draft parcel în Ecolet
 * Endpoint: POST /add-parcel/save-order-to-send
 */
export async function createDraftShipment(order) {
    try {
        const token = await authenticate();

        // Parse date comandă
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const shippingAddress = typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : order.shipping_address;

        // Obține locality_id pentru destinatar
        const receiverLocalityId = await getLocalityId(
            token,
            shippingAddress.county || order.county,
            shippingAddress.city || order.city
        );

        if (!receiverLocalityId) {
            throw new Error(`Orașul ${shippingAddress.city || order.city} nu a fost găsit în Ecolet`);
        }

        // PAYLOAD EXACT DIN SWAGGER
        const payload = {
            sender: {
                name: process.env.ECOLET_SENDER_NAME || "OCLAR Store",
                country: "ro",
                county: process.env.ECOLET_SENDER_COUNTY || "Bucuresti",
                locality_id: parseInt(process.env.ECOLET_SENDER_LOCALITY_ID || "323"), // București = 323
                locality: process.env.ECOLET_SENDER_CITY || "Bucuresti",
                postal_code: process.env.ECOLET_SENDER_POSTAL || "011318",
                street_name: process.env.ECOLET_SENDER_STREET || "Str. Example",
                street_number: process.env.ECOLET_SENDER_NUMBER || "1",
                block: process.env.ECOLET_SENDER_BLOCK || null,
                entrance: process.env.ECOLET_SENDER_ENTRANCE || null,
                floor: process.env.ECOLET_SENDER_FLOOR || null,
                flat: process.env.ECOLET_SENDER_FLAT || null,
                contact_person: process.env.ECOLET_SENDER_CONTACT || "OCLAR",
                email: process.env.ECOLET_SENDER_EMAIL || "office@oclar.ro",
                phone: process.env.ECOLET_SENDER_PHONE || "0712345678",
                has_map_point: false,
                map_point_id: null
            },
            receiver: {
                name: order.customer_name,
                country: "ro",
                county: shippingAddress.county || order.county,
                locality_id: receiverLocalityId,
                locality: shippingAddress.city || order.city,
                postal_code: order.postal_code || null,
                street_name: (shippingAddress.line || order.address_line || "").split(',')[0].trim(),
                street_number: "1", // default
                block: null,
                entrance: null,
                floor: null,
                flat: null,
                contact_person: order.customer_name,
                email: order.customer_email || null,
                phone: order.customer_phone.replace(/\s/g, ''),
                has_map_point: order.shipping_method === 'easybox' && order.locker_id ? true : false,
                map_point_id: order.locker_id || null
            },
            parcel: {
                type: "package",
                weight: items.reduce((sum, item) => sum + (item.quantity * 0.5), 1), // kg
                dimensions: {
                    length: 30,
                    width: 20,
                    height: 10
                },
                shape: "standard",
                declared_value: null,
                amount: 1,
                content: items.map(i => i.name).join(', ').substring(0, 100),
                observations: `Comandă OCLAR #${order.id}`
            },
            additional_services: {
                cod: {
                    status: order.payment_method === 'ramburs',
                    amount: order.payment_method === 'ramburs' ? parseFloat(order.total_amount) : 0
                },
                open_package: { status: false },
                rod: { status: false },
                rop: { status: false },
                saturday_delivery: { status: false },
                sms_notify: { status: false },
                swap: { status: false },
                epod: { status: false }
            },
            courier: {
                service: process.env.ECOLET_DEFAULT_SERVICE || "dpd_standard",
                pickup: {
                    type: "courier",
                    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // mâine
                    time: "13:00"
                },
                contract_id: parseInt(process.env.ECOLET_CONTRACT_ID || "4")
            },
            shipment_details: {
                uit_code: null,
                sender_forklift: false,
                receiver_forklift: false
            },
            coupon: {
                code: null
            }
        };

        console.log('📦 Creating Ecolet draft for order', order.id);

        // REQUEST EXACT
        const response = await fetch(`${ECOLET_BASE_URL}/add-parcel/save-order-to-send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        
        if (!response.ok) {
            console.error('❌ Ecolet API error:', response.status, text);
            
            // Parse error
            let errorMsg = 'Failed to create draft';
            try {
                const errorData = JSON.parse(text);
                errorMsg = errorData.message || errorData.error || JSON.stringify(errorData);
            } catch {}

            throw new Error(errorMsg);
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Invalid response from Ecolet');
        }

        // Extract order ID
        const orderId = data.id || data.order_id || data.data?.id;

        if (!orderId) {
            console.error('❌ No order ID in response:', data);
            throw new Error('No order ID returned');
        }

        console.log('✅ Ecolet draft created:', orderId);

        return {
            success: true,
            ecolet_shipment_id: orderId.toString(),
            status: 'draft',
            message: 'Draft creat în Ecolet'
        };

    } catch (error) {
        console.error('❌ createDraftShipment error:', error);
        return {
            success: false,
            ecolet_shipment_id: null,
            status: 'error',
            message: error.message
        };
    }
}

/**
 * Obține detalii comandă și AWB
 * Endpoint: GET /order/{id}
 */
export async function getShipmentStatus(shipmentId) {
    try {
        const token = await authenticate();

        const response = await fetch(`${ECOLET_BASE_URL}/order/${shipmentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get order: ${response.status}`);
        }

        const result = await response.json();
        const data = result.data || result;

        if (data.awb && data.status !== 'new') {
            return {
                success: true,
                awb_number: data.awb,
                label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill`,
                status: 'completed',
                message: 'AWB disponibil'
            };
        } else {
            return {
                success: false,
                awb_number: null,
                label_url: null,
                status: data.status || 'draft',
                message: 'AWB încă nedisponibil'
            };
        }

    } catch (error) {
        console.error('❌ getShipmentStatus error:', error);
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
 * Obține link label AWB
 * Endpoint: GET /order/{id}/download-waybill
 */
export async function getShipmentLabel(shipmentId) {
    try {
        const token = await authenticate();

        return {
            success: true,
            label_url: `${ECOLET_BASE_URL}/order/${shipmentId}/download-waybill?access_token=${token}`,
            message: 'Label disponibil'
        };

    } catch (error) {
        console.error('❌ getShipmentLabel error:', error);
        return {
            success: false,
            label_url: null,
            message: error.message
        };
    }
}