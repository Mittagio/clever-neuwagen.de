import express from 'express';
import { generateOfferAccessToken } from '../src/logic/offerAccessToken.js';
import {
  buildShareCompareRows,
  snapshotModelLineGroup,
} from '../src/services/advisor/advisorSnapshot.js';
import {
  runServerDiscoverySearchAsync,
  runServerSalesSearch,
  getServerVehicleBySlug,
} from './advisorEngine.js';
import { parseCustomerWish } from '../src/services/wish/wishParser.js';
import { deriveAdvisorChipIds } from '../src/services/sales/advisorRanking.js';
import {
  createAdvisorShareSession,
  getAdvisorShareSession,
  confirmAdvisorShareInquiry,
  listAdvisorShareSessionsByEmail,
} from './advisorShareStore.js';
import { syncShareSessionToPilotLead } from './sharePilotLeadSync.js';
import { patchCustomerRecord, upsertCustomerRecord } from './customerRecordsStore.js';
import { customerRecordIdForShareToken } from '../src/services/sales/customerRecordModel.js';
import { getAdvisorStorageStatus } from './jsonStore.js';

const router = express.Router();

router.get('/advisor/health', (_req, res) => {
  res.json({ ok: true, service: 'advisor', ts: new Date().toISOString() });
});

router.get('/advisor/storage', (_req, res) => {
  res.json({ ok: true, ...getAdvisorStorageStatus() });
});

router.post('/advisor/search', express.json({ limit: '512kb' }), async (req, res) => {
  try {
    const data = await runServerDiscoverySearchAsync(req.body ?? {});
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error('[advisor/search]', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.post('/advisor/sales', express.json({ limit: '256kb' }), (req, res) => {
  try {
    const data = runServerSalesSearch(req.body ?? {});
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error('[advisor/sales]', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.get('/advisor/vehicles/:slug', (req, res) => {
  const query = req.query.query ?? '';
  const features = req.query.features
    ? String(req.query.features).split(',').map((f) => f.trim()).filter(Boolean)
    : [];
  const filters = {
    query,
    fuel: req.query.fuel ?? null,
    useCase: req.query.useCase ?? null,
    type: req.query.type ?? null,
  };
  const hasWishContext = Boolean(query || features.length || filters.fuel || filters.useCase);
  const wishes = hasWishContext ? parseCustomerWish(query, features) : null;
  if (filters.fuel === 'elektro' && wishes && !wishes.features.includes('elektro')) {
    wishes.features.push('elektro');
  }
  const chipIds = wishes ? deriveAdvisorChipIds(filters, wishes) : [];

  const result = getServerVehicleBySlug(req.params.slug, req.query.dealerSlug, {
    wishes,
    chipIds,
    filters,
  });
  if (!result) {
    return res.status(404).json({ ok: false, message: 'vehicle not found' });
  }
  res.json({ ok: true, ...result });
});

router.post('/advisor/share', express.json({ limit: '512kb' }), (req, res) => {
  const body = req.body ?? {};
  const matches = body.matches ?? [];
  if (!matches.length) {
    return res.status(400).json({ ok: false, message: 'matches required' });
  }

  const token = generateOfferAccessToken();
  const modelLineGroups = (body.modelLineGroups ?? []).map(snapshotModelLineGroup);

  const session = createAdvisorShareSession({
    token,
    chipIds: body.chipIds ?? [],
    customer: body.customer ?? {},
    sellerName: body.sellerName ?? '',
    dealerName: body.dealerName ?? '',
    dealerSlug: body.dealerSlug ?? null,
    matches: buildShareCompareRows(matches),
    modelLineGroups,
    wishLabels: body.wishLabels ?? [],
  });

  const lead = syncShareSessionToPilotLead(session, 'created');

  upsertCustomerRecord({
    id: customerRecordIdForShareToken(session.token),
    shareToken: session.token,
    leadId: lead?.id ?? null,
    customer: session.customer ?? {},
    wishLabels: session.wishLabels ?? [],
    selectedVehicles: (session.matches ?? []).map((m) => ({
      title: m.title,
      slug: m.slug,
      trimLabel: m.trimLabel,
      cleverQuote: m.cleverQuote?.percent,
    })),
    modelLineSummary: (session.modelLineGroups ?? []).map((g) => ({
      modelLineKey: g.modelLineKey,
      label: g.label,
      primarySlug: g.primaryMatch?.slug,
      trimLabel: g.primaryMatch?.trimLabel,
      variantCount: g.variantCount,
    })),
    shareUrl: `/vergleich/${encodeURIComponent(session.token)}`,
    sellerName: session.sellerName ?? '',
    dealerName: session.dealerName ?? '',
    dealerSlug: session.dealerSlug ?? null,
    sentVia: [],
    nextStep: 'Angebot versenden',
    savedAt: session.createdAt ?? Date.now(),
  });

  res.json({
    ok: true,
    token: session.token,
    url: `/vergleich/${encodeURIComponent(session.token)}`,
    expiresAt: session.expiresAt,
    leadId: lead?.id ?? null,
  });
});

router.get('/advisor/customer-shares', (req, res) => {
  const email = req.query.email ?? '';
  const sessions = listAdvisorShareSessionsByEmail(email);
  res.json({ ok: true, sessions });
});

router.get('/advisor/share/:token', (req, res) => {
  const session = getAdvisorShareSession(req.params.token);
  if (!session) {
    return res.status(404).json({ ok: false, message: 'share session not found or expired' });
  }
  res.json({ ok: true, session });
});

router.post('/advisor/share/:token/inquiry', express.json({ limit: '32kb' }), (req, res) => {
  const customerPatch = req.body?.customer ?? {};
  const session = confirmAdvisorShareInquiry(req.params.token, { customer: customerPatch });
  if (!session) {
    return res.status(404).json({ ok: false, message: 'share session not found or expired' });
  }
  const lead = syncShareSessionToPilotLead(session, 'inquiry_confirmed');
  patchCustomerRecord(customerRecordIdForShareToken(session.token), {
    nextStep: 'Kunde hat Anfrage bestätigt',
    inquiryConfirmed: true,
    inquiryConfirmedAt: session.inquiryConfirmedAt ?? Date.now(),
    customer: session.customer ?? {},
  });
  res.json({ ok: true, session, leadId: lead?.id ?? null, lead });
});

export default router;
