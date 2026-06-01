import { Router } from 'express';
import documentRoutes from './documentRoutes.js';
import { createSelbstauskunft, listSelbstauskunft } from './selbstauskunftStore.js';

const router = Router();

router.use(documentRoutes);

router.get('/selbstauskunft', (_req, res) => {
  res.json({ items: listSelbstauskunft() });
});

router.post('/selbstauskunft', (req, res) => {
  const body = req.body ?? {};
  if (!body.personal?.firstName || !body.personal?.lastName) {
    res.status(400).json({ error: 'Vor- und Nachname sind Pflicht' });
    return;
  }

  const record = createSelbstauskunft({
    leadId: body.leadId ?? null,
    personal: body.personal,
    housing: body.housing,
    employment: body.employment,
    income: body.income,
    obligations: body.obligations,
    consent: Boolean(body.consent),
  });

  res.status(201).json({ item: record });
});

export default router;
