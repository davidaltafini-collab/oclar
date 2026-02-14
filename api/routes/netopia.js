import express from "express";
import { encryptRequest, buildPaymentFormHtml, decryptIPN, buildIPNResponse } from "../services/netopia.js";

const router = express.Router();

// IMPORTANT: confirm endpoint must accept x-www-form-urlencoded
router.use("/api/netopia/confirm", express.urlencoded({ extended: false }));

// INIT PAYMENT (called from React)
router.post("/api/netopia/init", express.json(), async (req, res) => {
  try {
    const paymentData = req.body;

    // Mandatory fields (keep it strict)
    if (!paymentData?.orderId) return res.status(400).json({ error: "orderId missing" });
    if (!paymentData?.amount) return res.status(400).json({ error: "amount missing" });

    // TODO: Save order in DB with status "pending" (highly recommended)
    // await db.orders.create({ ... })

    const { gatewayUrl, env_key, data } = encryptRequest(paymentData);

    const formHtml = buildPaymentFormHtml({ gatewayUrl, env_key, data });

    // Return HTML form to frontend (frontend will write it and redirect)
    res.status(200).json({ formHtml });
  } catch (e) {
    console.error("NETOPIA INIT ERROR:", e);
    res.status(500).json({ error: "netopia_init_failed", details: String(e?.message || e) });
  }
});

// CONFIRM (IPN) — Netopia posts env_key & data here
router.post("/api/netopia/confirm", async (req, res) => {
  try {
    const envKey = req.body?.env_key;
    const data = req.body?.data;

    if (!envKey || !data) {
      const xmlResp = buildIPNResponse({ ok: false, message: "missing env_key/data" });
      res.set("Content-Type", "application/xml").status(200).send(xmlResp);
      return;
    }

    const ipn = decryptIPN(envKey, data);

    // TODO: Update order in DB based on ipn.action / errorCode
    // Examples (you must map based on Netopia’s actual IPN action values you receive):
    // if (ipn.errorCode || ipn.action === 'canceled') => failed
    // if (ipn.action === 'confirmed' || ipn.action === 'paid') => paid

    console.log("NETOPIA IPN:", { orderId: ipn.orderId, action: ipn.action, errorCode: ipn.errorCode });

    const xmlResp = buildIPNResponse({ ok: true, message: "OK" });
    res.set("Content-Type", "application/xml").status(200).send(xmlResp);
  } catch (e) {
    console.error("NETOPIA CONFIRM ERROR:", e);
    const xmlResp = buildIPNResponse({ ok: false, message: "decrypt_failed" });
    res.set("Content-Type", "application/xml").status(200).send(xmlResp);
  }
});

export default router;