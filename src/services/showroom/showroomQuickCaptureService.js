/**
 * Showroom Modus – Schnellaufnahme speichern und in Kundenakte überführen.
 */
import { generateOfferNumber } from '../../logic/offerService.js';
import { normalizeLead } from '../../logic/leadNormalization.js';
import { buildDefaultCrm, buildLeadSubline } from '../dealerAiLeadCrm.js';
import { createCustomerId } from '../dealerAiCustomer.js';
import { buildDealerAiTextFromWishes } from '../dealerAiFromWishes.js';
import { paymentTypeFromChipIds } from '../dealerAiBudget.js';
import { getSalesChipById } from '../../data/salesAdvisorChips.js';
import {
  getShowroomChipById,
  getShowroomChipLabels,
} from '../../data/showroom/showroomModeChipGroups.js';
import { joinKundenhelferNotes, parseKundenhelferNotes } from '../cleverKundenhelfer.js';

export const SHOWROOM_CAPTURE_STATUS = {
  PENDING: 'pending',
  APPLIED: 'applied',
};

function uid(prefix = 'sqc') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function historyEntry(text, type = 'system') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

function chipLabel(chipId) {
  return getShowroomChipById(chipId)?.label
    ?? getSalesChipById(chipId)?.label
    ?? chipId;
}

function mergeChipLists(existing = [], additions = []) {
  return [...new Set([...existing, ...additions])];
}

/**
 * @param {object} input
 */
export function buildShowroomCaptureDraft(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id ?? uid(),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    status: input.status ?? SHOWROOM_CAPTURE_STATUS.PENDING,
    autoChipIds: input.autoChipIds ?? [],
    paymentChipIds: input.paymentChipIds ?? [],
    customerChipIds: input.customerChipIds ?? [],
    note: String(input.note ?? '').trim(),
    source: 'showroom_mode',
  };
}

export function hasShowroomCaptureContent(capture = {}) {
  return (capture.autoChipIds?.length ?? 0) > 0
    || (capture.paymentChipIds?.length ?? 0) > 0
    || (capture.customerChipIds?.length ?? 0) > 0
    || Boolean(String(capture.note ?? '').trim());
}

export function buildShowroomCaptureSummary(capture = {}) {
  const lines = [];
  const auto = getShowroomChipLabels(capture.autoChipIds ?? []);
  const payment = getShowroomChipLabels(capture.paymentChipIds ?? []);
  const customer = getShowroomChipLabels(capture.customerChipIds ?? []);

  if (auto.length) lines.push(`Auto: ${auto.join(', ')}`);
  if (payment.length) lines.push(`Bezahlung: ${payment.join(', ')}`);
  if (customer.length) lines.push(`Kunde: ${customer.join(', ')}`);
  if (capture.note?.trim()) lines.push(`Notiz: ${capture.note.trim()}`);

  return lines;
}

export function buildShowroomCaptureHelperNotes(capture = {}) {
  const chips = [
    ...(capture.autoChipIds ?? []),
    ...(capture.paymentChipIds ?? []),
    ...(capture.customerChipIds ?? []),
  ].map(chipLabel);

  const parts = ['Showroom Schnellaufnahme'];
  if (chips.length) parts.push(chips.join(' · '));
  if (capture.note?.trim()) parts.push(capture.note.trim());
  return parts.join(' – ');
}

function extractBudgetFromChips(chipIds = []) {
  for (const id of chipIds) {
    const sales = getSalesChipById(id);
    if (sales?.budgetMax) return sales.budgetMax;
  }
  return null;
}

function extractTermFromChips(chipIds = []) {
  for (const id of chipIds) {
    const sales = getSalesChipById(id);
    if (sales?.termMonths) return sales.termMonths;
  }
  return null;
}

function extractMileageFromChips(chipIds = []) {
  for (const id of chipIds) {
    const sales = getSalesChipById(id);
    if (sales?.mileagePerYear) return sales.mileagePerYear;
  }
  return null;
}

function collectReferenceCodes(getExistingCodes, leads = []) {
  const codes = [];
  const existing = getExistingCodes?.();
  if (existing) {
    for (const code of existing) codes.push({ code });
  }
  for (const lead of leads) {
    if (lead.referenceCode) codes.push({ code: lead.referenceCode });
    if (lead.offerCode) codes.push({ code: lead.offerCode });
  }
  return codes;
}

/**
 * Neue Kundenakte oder Schnellaufnahme an bestehenden Lead anhängen.
 */
export function saveShowroomQuickCapture({
  capture,
  existingLead = null,
  dealerConditions = {},
  getExistingCodes,
  leads = [],
  contact = null,
}) {
  const draft = buildShowroomCaptureDraft({
    ...capture,
    status: SHOWROOM_CAPTURE_STATUS.PENDING,
  });

  if (!hasShowroomCaptureContent(draft)) {
    return { ok: false, message: 'Bitte mindestens einen Hinweis oder eine Notiz erfassen.' };
  }

  const summaryLines = buildShowroomCaptureSummary(draft);
  const helperNote = buildShowroomCaptureHelperNotes(draft);
  const allChipIds = mergeChipLists(
    mergeChipLists(draft.autoChipIds, draft.paymentChipIds),
    draft.customerChipIds,
  );
  const paymentType = paymentTypeFromChipIds(draft.paymentChipIds);
  const desiredRate = extractBudgetFromChips(draft.paymentChipIds);
  const termMonths = extractTermFromChips(draft.paymentChipIds);
  const mileagePerYear = extractMileageFromChips(draft.paymentChipIds);
  const sourceText = buildDealerAiTextFromWishes({
    chipIds: allChipIds.filter((id) => getSalesChipById(id)),
    transcript: draft.note,
  });

  if (existingLead) {
    const now = new Date().toISOString();
    const existingNotes = existingLead.crm?.kundenhelfer?.notes ?? '';
    const mergedNotes = joinKundenhelferNotes([
      ...parseKundenhelferNotes(existingNotes),
      helperNote,
    ]);

    return {
      ok: true,
      leadId: existingLead.id,
      leadPatch: {
        updatedAt: now,
        paymentType: paymentType !== 'unknown' ? paymentType : existingLead.paymentType,
        desiredRate: desiredRate ?? existingLead.desiredRate ?? null,
        wish: {
          ...(existingLead.wish ?? {}),
          termMonths: termMonths ?? existingLead.wish?.termMonths ?? null,
          mileagePerYear: mileagePerYear ?? existingLead.wish?.mileagePerYear ?? null,
          paymentType: paymentType !== 'unknown' ? paymentType : existingLead.wish?.paymentType,
        },
        notes: existingLead.notes
          ? `${existingLead.notes}\n\n${summaryLines.join('\n')}`
          : summaryLines.join('\n'),
        crm: {
          ...(existingLead.crm ?? {}),
          pendingShowroomCapture: draft,
          hasPendingShowroomCapture: true,
          nextStepLabel: 'Schnellaufnahme prüfen',
          kundenhelfer: {
            ...(existingLead.crm?.kundenhelfer ?? {}),
            notes: mergedNotes,
          },
          showroomSourceText: sourceText,
        },
        history: [
          historyEntry('Showroom Schnellaufnahme erfasst'),
          historyEntry(summaryLines.join(' · '), 'note'),
        ],
      },
      capture: draft,
      isNew: false,
    };
  }

  const now = new Date().toISOString();
  const referenceCode = generateOfferNumber(collectReferenceCodes(getExistingCodes, leads));
  const contactData = {
    name: contact?.name?.trim() || 'Interessent (Showroom)',
    phone: contact?.phone?.trim() || '',
    email: contact?.email?.trim() || '',
  };

  const lead = normalizeLead({
    id: uid('lead'),
    createdAt: now,
    updatedAt: now,
    status: 'neu',
    source: 'showroomMode',
    referenceCode,
    customerId: createCustomerId(),
    contact: contactData,
    vehicle: {
      brand: 'Kia',
      model: '',
      trim: '',
      label: 'Modell offen',
    },
    paymentType: paymentType !== 'unknown' ? paymentType : 'unknown',
    desiredRate,
    wish: {
      paymentType: paymentType !== 'unknown' ? paymentType : 'unknown',
      termMonths,
      mileagePerYear,
      showroomChipIds: allChipIds,
    },
    notes: summaryLines.join('\n'),
    crm: {
      ...buildDefaultCrm(),
      pendingShowroomCapture: draft,
      hasPendingShowroomCapture: true,
      nextStepId: 'showroom_capture_review',
      nextStepLabel: 'Schnellaufnahme prüfen',
      kundenhelfer: {
        notes: helperNote,
        voiceMemos: [],
      },
      showroomSourceText: sourceText,
    },
    history: [
      historyEntry('Showroom Schnellaufnahme – neuer Interessent'),
      ...summaryLines.map((line) => historyEntry(line, 'note')),
    ],
    subline: buildLeadSubline({
      brand: 'Kia',
      model: '',
      paymentType,
      desiredRate,
    }),
    dealerId: dealerConditions?.dealerId ?? dealerConditions?.slug ?? null,
  });

  return {
    ok: true,
    lead,
    leadId: lead.id,
    capture: draft,
    isNew: true,
  };
}

/**
 * Schnellaufnahme in Kundenakte übernehmen (PC-Bearbeitung).
 */
export function applyShowroomCaptureToLead(lead, capture = null) {
  const pending = capture ?? lead?.crm?.pendingShowroomCapture;
  if (!pending || pending.status === SHOWROOM_CAPTURE_STATUS.APPLIED) {
    return { ok: false, message: 'Keine offene Schnellaufnahme vorhanden.' };
  }

  const allChipIds = mergeChipLists(
    mergeChipLists(pending.autoChipIds ?? [], pending.paymentChipIds ?? []),
    pending.customerChipIds ?? [],
  );
  const paymentType = paymentTypeFromChipIds(pending.paymentChipIds ?? []);
  const helperNote = buildShowroomCaptureHelperNotes(pending);
  const existingNotes = lead.crm?.kundenhelfer?.notes ?? '';
  const mergedNotes = joinKundenhelferNotes([
    ...parseKundenhelferNotes(existingNotes),
    helperNote,
  ]);

  return {
    ok: true,
    leadPatch: {
      updatedAt: new Date().toISOString(),
      paymentType: paymentType !== 'unknown' ? paymentType : lead.paymentType,
      desiredRate: extractBudgetFromChips(pending.paymentChipIds) ?? lead.desiredRate,
      wish: {
        ...(lead.wish ?? {}),
        showroomChipIds: mergeChipLists(lead.wish?.showroomChipIds ?? [], allChipIds),
        termMonths: extractTermFromChips(pending.paymentChipIds) ?? lead.wish?.termMonths,
        mileagePerYear: extractMileageFromChips(pending.paymentChipIds) ?? lead.wish?.mileagePerYear,
        paymentType: paymentType !== 'unknown' ? paymentType : lead.wish?.paymentType,
      },
      crm: {
        ...(lead.crm ?? {}),
        pendingShowroomCapture: {
          ...pending,
          status: SHOWROOM_CAPTURE_STATUS.APPLIED,
          appliedAt: new Date().toISOString(),
        },
        hasPendingShowroomCapture: false,
        kundenhelfer: {
          ...(lead.crm?.kundenhelfer ?? {}),
          notes: mergedNotes,
        },
      },
      history: [
        historyEntry('Showroom Schnellaufnahme übernommen'),
      ],
    },
  };
}

export function buildShowroomAkteChips(capture = {}) {
  if (!capture || capture.status === SHOWROOM_CAPTURE_STATUS.APPLIED) return [];
  const chips = ['Schnellaufnahme'];
  const topic = getShowroomChipLabels(capture.autoChipIds ?? []).slice(0, 2);
  if (topic.length) chips.push(topic.join(' / '));
  if (capture.note?.trim()) chips.push('Notiz erfasst');
  return chips;
}
