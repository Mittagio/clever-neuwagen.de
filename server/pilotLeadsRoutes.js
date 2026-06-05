import express from 'express';
import { listPilotLeads, upsertPilotLead } from './pilotLeadsStore.js';

const router = express.Router();

router.get('/pilot/leads', (req, res) => {
  const dealerId = req.query.dealerId ?? null;
  const data = listPilotLeads(dealerId || null);
  res.json({
    ok: true,
    leads: data.leads,
    lastUpdated: data.lastUpdated,
    count: data.leads.length,
  });
});

router.post('/pilot/leads', express.json({ limit: '256kb' }), (req, res) => {
  const lead = req.body?.lead;
  if (!lead?.id) {
    return res.status(400).json({ error: true, message: 'lead.id required' });
  }
  const data = upsertPilotLead(lead);
  res.json({ ok: true, count: data.leads.length, lastUpdated: data.lastUpdated });
});

router.patch('/pilot/leads/:id', express.json({ limit: '256kb' }), (req, res) => {
  const { id } = req.params;
  const partial = req.body ?? {};
  const data = listPilotLeads();
  const existing = data.leads.find((l) => l.id === id);
  if (!existing) {
    return res.status(404).json({ error: true, message: 'lead not found' });
  }
  const updated = upsertPilotLead({ ...existing, ...partial, id });
  res.json({ ok: true, count: updated.leads.length });
});

export default router;
