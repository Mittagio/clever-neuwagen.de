import express from 'express';
import { processCustomerInquiry } from './customerInquiryService.js';

const router = express.Router();

/**
 * POST /api/v1/customer/inquiries
 * Kundenanfrage (Fahrzeugseite, Angebotslink, Berater) → Verkaufschance im Backend.
 */
router.post('/customer/inquiries', express.json({ limit: '512kb' }), async (req, res) => {
  try {
    const result = await processCustomerInquiry(req.body ?? {});
    if (!result.ok) {
      return res.status(400).json({ error: true, message: result.message });
    }
    res.json(result);
  } catch (err) {
    console.error('[customer/inquiries]', err);
    res.status(500).json({ error: true, message: err.message ?? 'Inquiry failed' });
  }
});

export default router;
