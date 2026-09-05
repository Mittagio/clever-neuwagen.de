/**
 * Offer Intake Freeze – PDF/Seller-Refinement auf denselben Offer Draft.
 *
 * „Composer erstellt das Konzept.
 * PDF und Verkäufer präzisieren denselben Draft.
 * Unvollständig ist erlaubt. Geraten ist nicht erlaubt.“
 *
 * @see docs/CLEVER_OFFER_INTAKE_FREEZE.md
 */

import { RATE_AUTHORITY } from './captureThenOffer.js';
import {
  applyIdentityFollowUpPatch,
  buildCommercialScenarioFromLead,
  IDENTITY_SLOT_STATUS,
  resolveIdentityModelKey,
} from './vehicleIdentityDraft.js';
import { getModelColorCatalog } from '../../data/manufacturer/configureModelColorCatalog.js';
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import {
  getOfferDraftById,
  resolveActiveOfferDraft,
} from './cleverWorkingDraft.js';
import { OFFER_MUTATION_MODE } from './offerVehicleIdentity.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizeKey(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

function slotValue(slotOrNull) {
  if (!slotOrNull) return null;
  const v = slotOrNull.canonical || slotOrNull.raw;
  return v != null && String(v).trim() !== '' ? String(v).trim() : null;
}

function isSlotEmpty(slotOrNull) {
  return !slotValue(slotOrNull);
}

function displayTrim(raw = '') {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (/^gt-?\s*line$/i.test(t)) return 'GT-Line';
  if (/^air$/i.test(t)) return 'Air';
  if (/^earth$/i.test(t)) return 'Earth';
  if (/^spirit$/i.test(t)) return 'Spirit';
  if (/^vision$/i.test(t)) return 'Vision';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function colorsCompatible(a, b, modelKey) {
  const na = normalizeKey(a);
  const nb = normalizeKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // schwarz ↔ Aurora Black Pearl via Katalog
  const catalog = getModelColorCatalog(modelKey) || [];
  const hitA = catalog.find((c) => {
    const id = normalizeKey(c.id);
    const label = normalizeKey(c.label);
    return id === na || label === na || label.includes(na) || na.includes(label.slice(0, 6));
  });
  const hitB = catalog.find((c) => {
    const id = normalizeKey(c.id);
    const label = normalizeKey(c.label);
    return id === nb || label === nb || label.includes(nb) || nb.includes(label.slice(0, 6));
  });
  if (hitA && hitB && hitA.id === hitB.id) return true;
  // Basis: schwarz/weiß Familie
  if (/schwarz|black|aurora/.test(na) && /schwarz|black|aurora/.test(nb)) return true;
  if (/weiss|weiß|white|snow|carrara|clear/.test(na) && /weiss|weiß|white|snow|carrara|clear/.test(nb)) {
    return true;
  }
  return false;
}

function trimsCompatible(a, b) {
  return normalizeKey(displayTrim(a) || a) === normalizeKey(displayTrim(b) || b);
}

/**
 * Identity aus PDF-/Seller-Facts für Merge extrahieren.
 */
export function extractIdentityPatchFromOfferFacts(facts = []) {
  const list = Array.isArray(facts) ? facts : [];
  const interest = list.find((f) => f.field === 'vehicleInterest');
  const trimFact = list.find((f) => f.field === 'trimPreference');
  const colorFact = list.find((f) => f.field === 'colorPreference');
  const powerFact = list.find((f) => (
    f.field === 'powertrain'
    || f.field === 'battery'
    || f.field === 'motor'
    || /kwh|long\s*range|antrieb/i.test(String(f.label || ''))
  ));

  const modelKey = resolveIdentityModelKey(
    interest?.value?.modelKey || interest?.value?.model || interest?.label,
  );
  const trim = interest?.value?.trim
    || (typeof trimFact?.value === 'object' ? trimFact?.value?.trim : trimFact?.value)
    || (Array.isArray(trimFact?.value) ? trimFact.value[0] : null)
    || trimFact?.label
    || null;
  const color = colorFact?.value?.color
    || (typeof colorFact?.value === 'string' ? colorFact.value : null)
    || colorFact?.label
    || interest?.value?.color
    || null;
  const powertrain = powerFact?.value?.label
    || powerFact?.value?.raw
    || (typeof powerFact?.value === 'string' ? powerFact.value : null)
    || powerFact?.label
    || interest?.value?.powertrain
    || interest?.value?.battery
    || null;

  const packages = [];
  for (const f of list.filter((x) => x.field === 'equipmentWish')) {
    const label = f.value?.label || f.value?.name || f.label
      || (typeof f.value === 'string' ? f.value : null);
    if (label) packages.push(String(label));
  }
  if (Array.isArray(interest?.value?.packages)) {
    for (const p of interest.value.packages) {
      packages.push(typeof p === 'string' ? p : (p?.label || p?.name));
    }
  }
  if (interest?.value?.package) packages.push(String(interest.value.package));

  return {
    modelKey: modelKey || null,
    model: modelKey ? String(modelKey).toUpperCase().replace(/^EV/, 'EV') : null,
    trim: trim ? displayTrim(trim) : null,
    color: color ? String(color).trim() : null,
    powertrain: powertrain ? String(powertrain).trim() : null,
    addPackages: packages.filter(Boolean),
    source: SELLER_FACT_SOURCE.OFFER_PDF,
  };
}

/**
 * Commercial-Felder aus Facts.
 */
export function extractCommercialPatchFromOfferFacts(facts = [], lead = null) {
  const list = Array.isArray(facts) ? facts : [];
  const pick = (field) => list.find((f) => f.field === field);
  const payment = pick('paymentType')?.value || null;
  const term = pick('termMonths')?.value ?? pick('leasingTermMonths')?.value ?? null;
  const mileage = pick('annualMileage')?.value ?? pick('mileagePerYear')?.value ?? null;
  const down = pick('downPayment')?.value ?? null;
  const transfer = pick('transferFee')?.value ?? pick('ueberfuehrung')?.value ?? null;
  const rateFact = pick('desiredRate') || pick('monthlyRate') || pick('leasingRate');
  const rate = typeof rateFact?.value === 'object'
    ? (rateFact.value?.amount ?? rateFact.value?.value ?? null)
    : (rateFact?.value ?? null);
  const finalPayment = pick('finalPayment')?.value ?? null;
  const base = buildCommercialScenarioFromLead(lead || {}, list);

  return {
    ...base,
    paymentType: payment || base.paymentType || null,
    termMonths: term != null ? Number(term) : base.termMonths,
    annualMileage: mileage != null ? Number(mileage) : base.annualMileage,
    downPayment: down != null ? Number(down) : base.downPayment,
    transferFee: transfer != null ? Number(transfer) : base.transferFee ?? null,
    finalPayment: finalPayment != null ? Number(finalPayment) : null,
    rate: rate != null && Number.isFinite(Number(rate)) ? Number(rate) : null,
    rateAuthority: rate != null ? RATE_AUTHORITY.AUTHORITATIVE : RATE_AUTHORITY.NON_AUTHORITATIVE,
    source: SELLER_FACT_SOURCE.OFFER_PDF,
  };
}

/**
 * Slot-Merge: empty → fill, compatible → normalize, conflict → keep + flag.
 */
export function mergeIdentitySlot({
  existingSlot = null,
  incomingRaw = null,
  field = 'slot',
  modelKey = null,
} = {}) {
  const incoming = incomingRaw != null && String(incomingRaw).trim() !== ''
    ? String(incomingRaw).trim()
    : null;
  if (!incoming) {
    return { slot: existingSlot || null, conflict: null, filled: false };
  }
  if (isSlotEmpty(existingSlot)) {
    const patchKey = field === 'trim' ? 'trim'
      : field === 'color' ? 'color'
        : field === 'powertrain' ? 'powertrain'
          : field;
    return {
      slot: {
        raw: incoming,
        canonical: field === 'trim' ? displayTrim(incoming) : null,
        status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
        source: SELLER_FACT_SOURCE.OFFER_PDF,
      },
      conflict: null,
      filled: true,
      patch: { [patchKey]: incoming },
    };
  }

  const existing = slotValue(existingSlot);
  let compatible = false;
  if (field === 'trim') compatible = trimsCompatible(existing, incoming);
  else if (field === 'color') compatible = colorsCompatible(existing, incoming, modelKey);
  else compatible = normalizeKey(existing) === normalizeKey(incoming)
    || normalizeKey(existing).includes(normalizeKey(incoming))
    || normalizeKey(incoming).includes(normalizeKey(existing));

  if (compatible) {
    // PDF-Detail (Aurora Black Pearl) bevorzugt behalten wenn Katalog-treffsicherer
    const preferIncoming = field === 'color'
      && incoming.length > String(existing).length;
    return {
      slot: preferIncoming
        ? {
          raw: incoming,
          canonical: existingSlot?.canonical || null,
          status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
          source: SELLER_FACT_SOURCE.OFFER_PDF,
        }
        : existingSlot,
      conflict: null,
      filled: preferIncoming,
      patch: preferIncoming ? { color: incoming } : null,
    };
  }

  return {
    slot: existingSlot,
    conflict: {
      field,
      label: field === 'trim' ? 'Variante prüfen' : `${field} prüfen`,
      draftValue: existing,
      pdfValue: incoming,
      choices: [
        { id: 'take_pdf', label: `${incoming} übernehmen`, value: incoming },
        { id: 'keep_draft', label: `${existing} behalten`, value: existing },
      ],
    },
    filled: false,
  };
}

/**
 * Merged PDF in aktiven Offer Draft. Behält offerDraftId + vehicleIdentityDraftId.
 *
 * @returns {{ ok: true, mutation, conflicts, commercial, rate } | { ok: false, reason }}
 */
export function mergePdfIntoActiveOfferDraft({
  lead = null,
  workingMemory = null,
  facts = [],
  sellerInput = '',
  offerDraftId = null,
} = {}) {
  const active = offerDraftId
    ? getOfferDraftById(lead, offerDraftId)
    : resolveActiveOfferDraft({ lead, workingMemory });
  if (!active?.offerDraftId || !active?.vehicleIdentityDraft) {
    return { ok: false, reason: 'no_active_offer_draft' };
  }

  const identityPatch = extractIdentityPatchFromOfferFacts(facts);
  const commercialPatch = extractCommercialPatchFromOfferFacts(facts, lead);
  const identity = active.vehicleIdentityDraft;
  const modelKey = identity.modelKey
    || resolveIdentityModelKey(identity.model?.canonical || identity.model?.raw)
    || identityPatch.modelKey;

  const conflicts = [];
  const patch = { addPackages: [] };

  // Model: nur Konflikt flaggen, Draft-Modell behalten (Focus)
  if (identityPatch.modelKey
    && modelKey
    && normalizeKey(identityPatch.modelKey) !== normalizeKey(modelKey)) {
    conflicts.push({
      field: 'model',
      label: 'Modell prüfen',
      draftValue: modelKey,
      pdfValue: identityPatch.modelKey,
      choices: [
        { id: 'take_pdf', label: String(identityPatch.modelKey).toUpperCase(), value: identityPatch.modelKey },
        { id: 'keep_draft', label: String(modelKey).toUpperCase(), value: modelKey },
      ],
    });
  }

  const trimMerge = mergeIdentitySlot({
    existingSlot: identity.trim,
    incomingRaw: identityPatch.trim,
    field: 'trim',
    modelKey,
  });
  if (trimMerge.conflict) conflicts.push(trimMerge.conflict);
  else if (trimMerge.patch?.trim) patch.trim = trimMerge.patch.trim;

  const colorMerge = mergeIdentitySlot({
    existingSlot: identity.color,
    incomingRaw: identityPatch.color,
    field: 'color',
    modelKey,
  });
  if (colorMerge.conflict) conflicts.push(colorMerge.conflict);
  else if (colorMerge.patch?.color) patch.color = colorMerge.patch.color;

  const powerMerge = mergeIdentitySlot({
    existingSlot: identity.powertrainVariant,
    incomingRaw: identityPatch.powertrain,
    field: 'powertrain',
    modelKey,
  });
  if (powerMerge.conflict) conflicts.push(powerMerge.conflict);
  else if (powerMerge.patch?.powertrain) patch.powertrain = powerMerge.patch.powertrain;

  for (const pkg of identityPatch.addPackages || []) {
    const key = normalizeKey(pkg);
    const exists = (identity.packages || []).some((p) => normalizeKey(p.raw || p.canonical) === key);
    if (!exists) patch.addPackages.push(pkg);
  }
  if (!patch.addPackages.length) delete patch.addPackages;

  const nextIdentity = applyIdentityFollowUpPatch(identity, patch);
  nextIdentity.id = identity.id;
  nextIdentity.source = nextIdentity.source || 'seller_input';
  nextIdentity.lastPdfMergedAt = nowIso();

  const prevCommercial = active.commercialScenario || buildCommercialScenarioFromLead(lead || {});
  const nextCommercial = {
    ...prevCommercial,
    id: prevCommercial.id || `csc_${Date.now().toString(36)}`,
    // PDF-Konditionen sind offer-spezifisch und gewinnen, wenn gesetzt
    paymentType: commercialPatch.paymentType || prevCommercial.paymentType || null,
    termMonths: commercialPatch.termMonths ?? prevCommercial.termMonths ?? null,
    annualMileage: commercialPatch.annualMileage ?? prevCommercial.annualMileage ?? null,
    downPayment: commercialPatch.downPayment != null
      ? commercialPatch.downPayment
      : (prevCommercial.downPayment ?? null),
    transferFee: commercialPatch.transferFee != null
      ? commercialPatch.transferFee
      : (prevCommercial.transferFee ?? null),
    finalPayment: commercialPatch.finalPayment != null
      ? commercialPatch.finalPayment
      : (prevCommercial.finalPayment ?? null),
    source: SELLER_FACT_SOURCE.OFFER_PDF,
    updatedAt: nowIso(),
  };

  const rateFromPdf = commercialPatch.rate;
  const nextRate = rateFromPdf != null
    ? rateFromPdf
    : (active.invalidateVehicleRate ? null : active.rate);

  const nextOffer = {
    ...active,
    offerDraftId: active.offerDraftId,
    vehicleIdentityDraftId: nextIdentity.id,
    vehicleIdentityDraft: nextIdentity,
    commercialScenarioId: nextCommercial.id,
    commercialScenario: nextCommercial,
    rate: nextRate,
    rateAuthority: rateFromPdf != null
      ? RATE_AUTHORITY.AUTHORITATIVE
      : (active.rateAuthority || RATE_AUTHORITY.NON_AUTHORITATIVE),
    invalidateVehicleRate: rateFromPdf == null,
    status: 'draft',
    mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
    createNewAlternative: false,
    pdfSource: {
      mergedAt: nowIso(),
      sellerInput: sellerInput || null,
      factFields: (facts || []).map((f) => f.field).filter(Boolean),
    },
    updatedAt: nowIso(),
    lastChangedFields: [
      ...Object.keys(patch),
      ...(rateFromPdf != null ? ['rate'] : []),
      'commercial',
    ],
    sellerInput: sellerInput || active.sellerInput,
  };

  return {
    ok: true,
    mutation: {
      offerDraft: nextOffer,
      vehicleIdentityDraft: nextIdentity,
      changedFields: nextOffer.lastChangedFields,
      retargeted: false,
      fromPdf: true,
    },
    conflicts,
    commercial: nextCommercial,
    rate: nextRate,
  };
}

/**
 * True wenn Attachments ein Angebots-/Konfigurator-PDF sind und ein Draft existiert.
 */
export function shouldRefineActiveOfferFromPdf({
  lead = null,
  workingMemory = null,
  attachments = [],
  facts = [],
} = {}) {
  const hasPdfFact = (facts || []).some((f) => (
    f.source === SELLER_FACT_SOURCE.OFFER_PDF
    || f.value?.fromOfferPdf === true
  ));
  const hasPdfAttach = (attachments || []).some((a) => (
    a?.kind === 'configurator_pdf'
    || a?.kind === 'offer_pdf'
    || a?.documentClass === 'configurator_pdf'
    || /leasing|finanz|angebot|hap/i.test(String(a?.name || a?.fileName || ''))
  ));
  if (!hasPdfFact && !hasPdfAttach) return false;
  return Boolean(resolveActiveOfferDraft({ lead, workingMemory })?.offerDraftId);
}
