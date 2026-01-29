/**
 * SERVICIU ECOLET (ALSENDO)
 * Gestionează exportul de draft-uri și sincronizarea AWB-urilor
 */

import dotenv from 'dotenv';
dotenv.config();

const ECOLET_API_URL = process.env.ECOLET_API_URL || 'https://api.alsendo.com/v1';
const ECOLET_API_KEY = process.env.ECOLET_API_KEY;
const ECOLET_CLIENT_ID = process.env.ECOLET_CLIENT_ID;

/**
 * Autentificare Ecolet (dacă este necesar)
 * Returnează token de acces
 */
async function authenticate() {
    if (!ECOLET_API_KEY || !ECOLET_CLIENT_ID) {
        throw new Error('Ecolet API credentials missing in .env');
    }

    try {
        const response = await fetch(`${ECOLET_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: ECOLET_CLIENT_ID,
                api_key: ECOLET_API_KEY
            })
        });

        if (!response.ok) {
            throw new Error(`Ecolet auth failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.access_token;
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

        // Pregătim payload-ul Ecolet
        let payload;

        if (order.shipping_method === 'easybox' && order.locker_id) {
            // LIVRARE EASYBOX (LOCKER)
            payload = {
                recipient_name: order.customer_name,
                recipient_phone: order.customer_phone,
                delivery_type: 'LOCKER',
                locker_id: order.locker_id,
                locker_name: order.locker_name || null,
                city: shippingAddress.city || order.city,
                county: shippingAddress.county || order.county,
                // Pentru EasyBox NU trimitem: address, postal_code
                
                // Detalii colet
                products: items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                
                // Greutate estimată (kg) - poți ajusta logica
                weight: items.reduce((sum, item) => sum + (item.quantity * 0.5), 0.5),
                
                // Ramburs (doar pentru plata ramburs)
                cash_on_delivery: order.payment_method === 'ramburs' ? order.total_amount : 0,
                
                // Referință internă
                reference: `ORDER-${order.id}`,
                
                // NU emite AWB automat
                auto_awb: false
            };

        } else {
            // LIVRARE CURIER CLASIC
            payload = {
                recipient_name: order.customer_name,
                recipient_phone: order.customer_phone,
                delivery_type: 'COURIER',
                
                // Adresa completă
                address: shippingAddress.line || order.address_line || shippingAddress.line1,
                city: shippingAddress.city || order.city,
                county: shippingAddress.county || order.county,
                postal_code: order.postal_code,
                
                // Detalii colet
                products: items.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                
                // Greutate estimată (kg)
                weight: items.reduce((sum, item) => sum + (item.quantity * 0.5), 0.5),
                
                // Ramburs
                cash_on_delivery: order.payment_method === 'ramburs' ? order.total_amount : 0,
                
                // Referință
                reference: `ORDER-${order.id}`,
                
                // NU emite AWB automat
                auto_awb: false
            };
        }

        // Apel API Ecolet
        const response = await fetch(`${ECOLET_API_URL}/shipments/draft`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create draft shipment');
        }

        const data = await response.json();

        return {
            success: true,
            ecolet_shipment_id: data.shipment_id,
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

        const response = await fetch(`${ECOLET_API_URL}/shipments/${shipmentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch shipment status: ${response.statusText}`);
        }

        const data = await response.json();

        // Verificăm dacă AWB-ul a fost generat
        if (data.awb_number && data.status === 'completed') {
            return {
                success: true,
                awb_number: data.awb_number,
                label_url: data.label_url || null,
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

        const response = await fetch(`${ECOLET_API_URL}/shipments/${shipmentId}/label`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch label: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            success: true,
            label_url: data.label_url,
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