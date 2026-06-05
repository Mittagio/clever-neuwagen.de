import express from 'express';
import {
  listCustomerRecords,
  getCustomerRecordById,
  upsertCustomerRecord,
  patchCustomerRecord,
} from './customerRecordsStore.js';

const router = express.Router();

router.get('/advisor/customer-records', (req, res) => {
  const dealerId = req.query.dealerId ?? req.query.dealerSlug ?? null;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const data = listCustomerRecords(dealerId, limit);
  res.json({ ok: true, ...data });
});

router.get('/advisor/customer-records/:id', (req, res) => {
  const record = getCustomerRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ ok: false, message: 'record not found' });
  }
  res.json({ ok: true, record });
});

router.post('/advisor/customer-records', express.json({ limit: '512kb' }), (req, res) => {
  const record = req.body?.record;
  if (!record?.id) {
    return res.status(400).json({ ok: false, message: 'record.id required' });
  }
  const data = upsertCustomerRecord(record);
  res.json({
    ok: true,
    record: getCustomerRecordById(record.id),
    count: data.records.length,
    lastUpdated: data.lastUpdated,
  });
});

router.patch('/advisor/customer-records/:id', express.json({ limit: '256kb' }), (req, res) => {
  const updated = patchCustomerRecord(req.params.id, req.body ?? {});
  if (!updated) {
    return res.status(404).json({ ok: false, message: 'record not found' });
  }
  res.json({
    ok: true,
    record: getCustomerRecordById(req.params.id),
    count: updated.records.length,
  });
});

export default router;
