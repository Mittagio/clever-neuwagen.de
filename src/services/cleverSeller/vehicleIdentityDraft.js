/**
 * Vehicle Identity Draft + Offer Draft Handoff
 *
 * Composer nimmt das Konzept auf. Angebotstool präzisiert es.
 * Kein stilles Default-Modell. Keine erfundenen Pakete. Keine falsche Rate.
 *
 * @see docs/CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md
 * @see docs/CLEVER_CAPTURE_THEN_OFFER.md
 */

import { getModelColorCatalog } from '../../data/manufacturer/configureModelColorCatalog.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';

export const IDENTITY_SLOT_STATUS = Object.freeze({
  CAPTURED: 'captured',
  NEEDS_REFINEMENT: 'needs_refinement',
  OPEN: 'open',
  RESOLVED: 'resolved',
});

export const OFFER_DRAFT_STATUS = Object.freeze({
  DRAFT: 'draft',
  NEEDS_REFINEMENT: 'needs_refinement',
  READY_FOR_TOOL: 'ready_for_tool',
});

function uid(prefix = 'vid') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

/** Lokale Model-Key-Auflösung – kein Import aus magicOfferService (Zyklus). */
export function resolveIdentityModelKey(hint) {
  if (hint == null || hint === '') return null;
  const raw = String(hint).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/^kia\s+/i, '').trim();
  if (/^ev\s*[2-9]$/i.test(lower)) return lower.replace(/\s+/g, '');
  if (/^(ev[2-9]|sportage(?:-hybrid|-phev)?|ceed|picanto|niro|sorento|stonic|xceed|esoul)$/.test(lower)) {
    return lower;
  }
  const key = normalizeKey(raw).replace(/^(kia|hyundai)+/, '');
  const ev = key.match(/^ev([2-9])/);
  if (ev) return `ev${ev[1]}`;
  return null;
}

function displayModel(keyOrLabel = '') {
  const key = String(keyOrLabel || '').replace(/^kia\s+/i, '').trim();
  if (/^ev\s*\d$/i.test(key.replace(/\s+/g, ''))) {
    return key.replace(/\s+/g, '').toUpperCase();
  }
  return key || '';
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

function slot({ raw = null, canonical = null, status = null } = {}) {
  const hasRaw = raw != null && String(raw).trim() !== '';
  const hasCanonical = canonical != null && String(canonical).trim() !== '';
  let resolvedStatus = status;
  if (!resolvedStatus) {
    if (hasCanonical) resolvedStatus = IDENTITY_SLOT_STATUS.RESOLVED;
    else if (hasRaw) resolvedStatus = IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT;
    else resolvedStatus = IDENTITY_SLOT_STATUS.OPEN;
  }
  return {
    raw: hasRaw ? String(raw).trim() : null,
    canonical: hasCanonical ? canonical : null,
    status: resolvedStatus,
  };
}

function resolveColorAgainstCatalog(modelKey, colorRaw) {
  if (!colorRaw) return { canonical: null, colorId: null, status: IDENTITY_SLOT_STATUS.OPEN };
  const catalog = getModelColorCatalog(modelKey) || [];
  const needle = normalizeKey(colorRaw);
  const hit = catalog.find((c) => {
    const id = normalizeKey(c.id);
    const label = normalizeKey(c.label);
    return id === needle
      || label === needle
      || label.includes(needle)
      || needle.includes(label.slice(0, Math.min(6, label.length)));
  });
  if (hit) {
    return {
      canonical: hit.label,
      colorId: hit.id,
      status: IDENTITY_SLOT_STATUS.RESOLVED,
    };
  }
  // „weiß“ / „schwarz“ etc. behalten – Angebotstool präzisiert
  return {
    canonical: null,
    colorId: null,
    status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
  };
}

function packageLabelFromFact(fact) {
  if (!fact) return null;
  if (fact.label) return String(fact.label).trim();
  const v = fact.value;
  if (v == null) return null;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    return String(v.label || v.name || v.id || v.wish || '').trim() || null;
  }
  return String(v).trim() || null;
}

function colorRawFromFact(fact) {
  if (!fact) return null;
  if (fact.label) {
    const fromLabel = String(fact.label)
      .replace(/^farbe\s*/i, '')
      .replace(/^color\s*/i, '')
      .trim();
    if (fromLabel) return fromLabel;
  }
  const v = fact.value;
  if (v == null) return null;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    return String(v.color || v.label || v.name || v.id || '').trim() || null;
  }
  return String(v).trim() || null;
}

function powertrainFromFacts(facts = []) {
  for (const fact of facts) {
    if (!fact) continue;
    if (fact.field === 'motorPreference' || fact.field === 'batteryPreference') {
      const raw = fact.label
        || (typeof fact.value === 'object'
          ? (fact.value.label || fact.value.hint || fact.value.kWh)
          : fact.value);
      if (raw != null && String(raw).trim()) {
        return slot({
          raw: String(raw).trim(),
          canonical: typeof fact.value === 'object' ? (fact.value.id || null) : null,
        });
      }
    }
    if (fact.field === 'equipmentWish') {
      const label = packageLabelFromFact(fact) || '';
      if (/\d+[.,]?\d*\s*kwh/i.test(label) || /\b\d{2,3}\s*kwh\b/i.test(label)) {
        return slot({ raw: label, canonical: null });
      }
    }
  }
  return slot({ status: IDENTITY_SLOT_STATUS.OPEN });
}

/**
 * Baut Vehicle Identity Draft nur aus expliziten Seller-Facts (+ optional Text).
 * Erfindet keine Pakete.
 *
 * @param {{
 *   facts?: object[],
 *   sellerInput?: string,
 *   customerId?: string|null,
 *   modelKey?: string|null,
 *   model?: string|null,
 *   trim?: string|null,
 *   vehicleLabel?: string|null,
 *   existingDraft?: object|null,
 * }} input
 */
export function buildVehicleIdentityDraftFromFacts(input = {}) {
  const facts = Array.isArray(input.facts) ? input.facts.filter(Boolean) : [];
  const now = new Date().toISOString();
  const existing = input.existingDraft && typeof input.existingDraft === 'object'
    ? input.existingDraft
    : null;

  const interest = facts.find((f) => f.field === 'vehicleInterest');
  const trimFact = facts.find((f) => f.field === 'trimPreference');
  const colorFact = facts.find((f) => f.field === 'colorPreference');
  const unresolvedNotes = facts
    .filter((f) => f.field === 'unresolvedNote' || f.preserveAsNote)
    .map((f) => String(f.value?.text || f.label || f.value || ''))
    .filter(Boolean);

  const modelRaw = input.model
    || interest?.value?.model
    || interest?.value?.modelKey
    || interest?.label
    || existing?.model?.raw
    || null;
  const modelKey = resolveIdentityModelKey(
    input.modelKey
    || interest?.value?.modelKey
    || interest?.value?.model
    || modelRaw
    || existing?.model?.canonical,
  );
  const modelCanonical = modelKey
    ? displayModel(modelKey)
    : (modelRaw ? displayModel(modelRaw) : null);

  const trimRaw = input.trim
    || interest?.value?.trim
    || (typeof trimFact?.value === 'object' ? trimFact.value?.trim : trimFact?.value)
    || (Array.isArray(trimFact?.value) ? trimFact.value[0] : null)
    || trimFact?.label
    || existing?.trim?.raw
    || null;
  const trimCanonical = displayTrim(trimRaw);

  let colorRaw = colorRawFromFact(colorFact) || existing?.color?.raw || null;
  if (!colorRaw) {
    const colorHaystack = [input.sellerInput, ...unresolvedNotes, interest?.label].filter(Boolean).join(' ');
    const colorMatch = colorHaystack.match(
      /\b(aurora(?:schwarz|black)?(?:\s*pearl)?|schneeweiß(?:\s*pearl)?|snow\s*white(?:\s*pearl)?|zilina(?:schwarz)?|carrara(?:weiß|weiss)?|terracotta|schwarz\w*|weiß\w*|weiss\w*|blau\w*|grau\w*|silber\w*|rot\w*|gr[uü]n\w*)\b/i,
    );
    if (colorMatch) colorRaw = colorMatch[1];
  }
  const colorResolved = resolveColorAgainstCatalog(modelKey, colorRaw);

  const packageFacts = facts.filter((f) => f.field === 'equipmentWish');
  const packages = [];
  const seenPkg = new Set();
  const pushPackage = (raw, canonical = null) => {
    if (!raw) return;
    const text = String(raw).trim();
    if (!text) return;
    if (/\d+[.,]?\d*\s*kwh/i.test(text)) return;
    const key = normalizeKey(text);
    if (!key || seenPkg.has(key)) return;
    seenPkg.add(key);
    packages.push(slot({
      raw: text,
      canonical: canonical && typeof canonical === 'string' ? canonical : null,
      status: canonical ? IDENTITY_SLOT_STATUS.RESOLVED : IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
    }));
  };
  for (const fact of packageFacts) {
    pushPackage(packageLabelFromFact(fact), fact.value?.id);
  }
  // Zero-Loss: Paket oft in vehicleInterest.value statt separatem equipmentWish
  if (interest?.value && typeof interest.value === 'object') {
    pushPackage(interest.value.package || interest.value.equipmentPackage || interest.value.packageLabel);
    if (Array.isArray(interest.value.packages)) {
      for (const p of interest.value.packages) {
        pushPackage(typeof p === 'string' ? p : (p?.label || p?.name || p?.raw));
      }
    }
  }
  // Seller-Text + unresolvedNotes Fallback (Zero-Loss, keine Erfindung)
  const packageHaystack = [input.sellerInput, ...unresolvedNotes].filter(Boolean).join(' ');
  if (packageHaystack) {
    const winter = packageHaystack.match(/\bwinter(?:\s*|-)?(?:connect(?:[\s-]?paket)?|paket)\b/i);
    if (winter) pushPackage(/connect/i.test(winter[0]) ? 'Winter-Connect-Paket' : 'Winterpaket');
    const driveWise = packageHaystack.match(/\bdrive\s*wise(?:\s*-?\s*paket)?\b/i);
    if (driveWise) pushPackage('DriveWise Paket');
    const business = packageHaystack.match(/\bbusiness(?:\s*-?\s*paket)?\b/i);
    if (business) pushPackage('Business Paket');
    const upgrade = packageHaystack.match(/\bupgrade(?:\s*-?\s*paket)?\b/i);
    if (upgrade) pushPackage('Upgrade Paket');
  }

  // Powertrain / Batterie aus Text oder unresolvedNotes
  let powertrain = (() => {
    const fromFacts = powertrainFromFacts(facts);
    if (fromFacts.raw) return fromFacts;
    return existing?.powertrainVariant || slot({ status: IDENTITY_SLOT_STATUS.OPEN });
  })();
  if (!powertrain.raw) {
    const kwhHaystack = [input.sellerInput, ...unresolvedNotes].filter(Boolean).join(' ');
    const kwh = kwhHaystack.match(/(\d{2,3}(?:[.,]\d+)?)\s*kwh/i);
    if (kwh) {
      powertrain = slot({
        raw: `${kwh[1].replace(',', '.')} kWh`,
        canonical: null,
        status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
      });
    }
  }
  // Bestehende Pakete behalten, wenn neuer Turn keine packages hat (Follow-up)
  if (packages.length === 0 && Array.isArray(existing?.packages)) {
    for (const pkg of existing.packages) {
      if (pkg?.raw) packages.push({ ...pkg });
    }
  }

  const equipment = Array.isArray(existing?.equipment) ? [...existing.equipment] : [];

  return {
    id: existing?.id || uid('vid'),
    customerId: input.customerId || existing?.customerId || null,
    model: slot({
      raw: modelRaw ? String(modelRaw).replace(/^kia\s+/i, '').trim() : null,
      canonical: modelCanonical,
      status: modelCanonical
        ? IDENTITY_SLOT_STATUS.CAPTURED
        : (modelRaw ? IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT : IDENTITY_SLOT_STATUS.OPEN),
    }),
    trim: slot({
      raw: trimRaw ? String(trimRaw).trim() : null,
      canonical: trimCanonical,
      status: trimCanonical
        ? IDENTITY_SLOT_STATUS.CAPTURED
        : (trimRaw ? IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT : IDENTITY_SLOT_STATUS.OPEN),
    }),
    powertrainVariant: powertrain,
    color: slot({
      raw: colorRaw,
      canonical: colorResolved.canonical,
      status: colorRaw
        ? (colorResolved.status === IDENTITY_SLOT_STATUS.RESOLVED
          ? IDENTITY_SLOT_STATUS.CAPTURED
          : IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT)
        : IDENTITY_SLOT_STATUS.OPEN,
    }),
    colorId: colorResolved.colorId || existing?.colorId || null,
    packages,
    equipment,
    modelKey: modelKey || null,
    vehicleLabel: [
      modelCanonical ? `Kia ${modelCanonical}` : null,
      trimCanonical,
    ].filter(Boolean).join(' ')
      || input.vehicleLabel
      || existing?.vehicleLabel
      || null,
    source: 'seller_input',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Mutiert denselben Draft (Follow-up: „doch Earth“, „schwarz“, „Winterpaket raus“).
 */
export function applyIdentityFollowUpPatch(draft, patch = {}) {
  if (!draft) return draft;
  const next = {
    ...draft,
    packages: Array.isArray(draft.packages) ? [...draft.packages] : [],
    equipment: Array.isArray(draft.equipment) ? [...draft.equipment] : [],
    updatedAt: new Date().toISOString(),
  };

  if (patch.model != null || patch.modelKey != null) {
    const modelKey = resolveIdentityModelKey(patch.modelKey || patch.model);
    next.modelKey = modelKey || next.modelKey;
    next.model = slot({
      raw: patch.model || displayModel(modelKey) || next.model?.raw,
      canonical: modelKey ? displayModel(modelKey) : next.model?.canonical,
      status: IDENTITY_SLOT_STATUS.CAPTURED,
    });
  }
  if (patch.trim !== undefined) {
    if (patch.trim == null || patch.trim === '') {
      next.trim = slot({ status: IDENTITY_SLOT_STATUS.OPEN });
    } else {
      next.trim = slot({
        raw: String(patch.trim),
        canonical: displayTrim(patch.trim),
        status: IDENTITY_SLOT_STATUS.CAPTURED,
      });
    }
  }
  if (patch.color !== undefined) {
    if (patch.color == null || patch.color === '') {
      next.color = slot({ status: IDENTITY_SLOT_STATUS.OPEN });
      next.colorId = null;
    } else {
      const resolved = resolveColorAgainstCatalog(next.modelKey, patch.color);
      next.color = slot({
        raw: String(patch.color),
        canonical: resolved.canonical,
        status: resolved.status === IDENTITY_SLOT_STATUS.RESOLVED
          ? IDENTITY_SLOT_STATUS.CAPTURED
          : IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
      });
      next.colorId = resolved.colorId;
    }
  }
  if (Array.isArray(patch.addPackages)) {
    for (const raw of patch.addPackages) {
      const key = normalizeKey(raw);
      if (!key) continue;
      if (next.packages.some((p) => normalizeKey(p.raw) === key)) continue;
      next.packages.push(slot({
        raw: String(raw),
        canonical: null,
        status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
      }));
    }
  }
  if (Array.isArray(patch.removePackages)) {
    const remove = new Set(patch.removePackages.map(normalizeKey));
    next.packages = next.packages.filter((p) => !remove.has(normalizeKey(p.raw)));
  }
  if (patch.clearPackages === true) {
    next.packages = [];
  }

  next.vehicleLabel = [
    next.model?.canonical ? `Kia ${next.model.canonical}` : null,
    next.trim?.canonical || next.trim?.raw,
  ].filter(Boolean).join(' ') || next.vehicleLabel;

  return next;
}

/**
 * Kompakte Subtitle-Zeile: „Winterpaket · Weiß“
 */
export function formatIdentityDraftExtrasLine(draft) {
  if (!draft) return null;
  const parts = [];
  for (const pkg of draft.packages || []) {
    if (pkg?.raw || pkg?.canonical) parts.push(pkg.canonical || pkg.raw);
  }
  const color = draft.color?.canonical || draft.color?.raw;
  if (color) {
    const pretty = /^weiß|^weiss/i.test(color)
      ? 'Weiß'
      : (/^schwarz/i.test(color) ? 'Schwarz' : color);
    parts.push(pretty);
  }
  const power = draft.powertrainVariant?.canonical || draft.powertrainVariant?.raw;
  if (power) parts.push(power);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Commercial Scenario getrennt von Identity – ohne Rate.
 */
export function buildCommercialScenarioFromLead(lead = {}, facts = []) {
  const wish = lead?.wish || {};
  const termFromFact = facts.find((f) => f.field === 'termMonths' || f.field === 'leasingTermMonths');
  const kmFromFact = facts.find((f) => f.field === 'annualMileage' || f.field === 'mileagePerYear');
  const azFromFact = facts.find((f) => f.field === 'downPayment');
  const paymentFromFact = facts.find((f) => f.field === 'paymentType');

  const termMonths = termFromFact?.value ?? wish.termMonths ?? lead?.termMonths ?? null;
  const annualMileage = kmFromFact?.value
    ?? wish.mileagePerYear
    ?? wish.annualMileage
    ?? lead?.mileagePerYear
    ?? null;
  const downPayment = azFromFact?.value ?? wish.downPayment ?? null;
  const paymentType = paymentFromFact?.value
    || wish.paymentType
    || lead?.paymentType
    || null;

  return {
    id: uid('com'),
    paymentType: paymentType === 'unknown' ? null : paymentType,
    termMonths: termMonths != null ? Number(termMonths) : null,
    annualMileage: annualMileage != null ? Number(annualMileage) : null,
    downPayment: downPayment != null ? Number(downPayment) : null,
    rate: null,
    rateAuthority: RATE_AUTHORITY.NON_AUTHORITATIVE,
    source: 'customer_truth',
  };
}

/**
 * Offer Draft – Konzept, noch nicht finale Konfiguration.
 */
export function buildOfferDraftFromIdentity({
  vehicleIdentityDraft,
  commercialScenario = null,
  customerId = null,
  vehicleTrackId = null,
  createNewAlternative = false,
  mutationMode = null,
  monthlyRate = null,
  rateAuthority = RATE_AUTHORITY.NON_AUTHORITATIVE,
  sellerInput = '',
} = {}) {
  const now = new Date().toISOString();
  const invalidateVehicleRate = createNewAlternative === true
    || Boolean(vehicleIdentityDraft?.modelKey);
  const safeRate = invalidateVehicleRate && rateAuthority !== RATE_AUTHORITY.AUTHORITATIVE
    ? null
    : monthlyRate;

  return {
    offerDraftId: uid('ofd'),
    customerId: customerId || vehicleIdentityDraft?.customerId || null,
    vehicleIdentityDraftId: vehicleIdentityDraft?.id || null,
    vehicleIdentityDraft: vehicleIdentityDraft || null,
    vehicleTrackId: vehicleTrackId || null,
    commercialScenarioId: commercialScenario?.id || null,
    commercialScenario: commercialScenario || null,
    createNewAlternative: Boolean(createNewAlternative),
    mutationMode: mutationMode || null,
    invalidateVehicleRate: Boolean(invalidateVehicleRate),
    rate: safeRate,
    rateAuthority: safeRate != null ? rateAuthority : RATE_AUTHORITY.NON_AUTHORITATIVE,
    status: OFFER_DRAFT_STATUS.DRAFT,
    sellerInput: sellerInput || null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Handoff-Shape für Verkaufsassistent / Magic-Pipeline.
 * resolveMagicVehicleFields + advanceMagicPreparationToPreview lesen diese Felder.
 */
export function buildComposerOfferHandoff(offerDraft, extras = {}) {
  const identity = offerDraft?.vehicleIdentityDraft || extras.vehicleIdentityDraft || null;
  const commercial = offerDraft?.commercialScenario || extras.commercialScenario || null;
  const modelKey = identity?.modelKey
    || resolveIdentityModelKey(identity?.model?.canonical || identity?.model?.raw)
    || extras.modelKey
    || null;
  const model = identity?.model?.canonical
    || identity?.model?.raw
    || (modelKey ? displayModel(modelKey) : null);
  const trimLabel = identity?.trim?.canonical || identity?.trim?.raw || extras.trim || null;
  const colorRaw = identity?.color?.canonical || identity?.color?.raw || null;
  const packageLabels = (identity?.packages || [])
    .map((p) => p.canonical || p.raw)
    .filter(Boolean);

  const headline = identity?.vehicleLabel
    || [model ? `Kia ${String(model).replace(/^kia\s*/i, '')}` : null, trimLabel]
      .filter(Boolean)
      .join(' ')
    || extras.vehicleLabel
    || null;

  return {
    mode: 'composer_identity_draft',
    skipMagicReview: true,
    canCreateOffer: false,
    fromPdf: false,
    offerDraftId: offerDraft?.offerDraftId || extras.offerDraftId || null,
    vehicleIdentityDraftId: identity?.id || null,
    vehicleIdentityDraft: identity,
    commercialScenario: commercial,
    createNewAlternative: Boolean(offerDraft?.createNewAlternative ?? extras.createNewAlternative),
    invalidateVehicleRate: offerDraft?.invalidateVehicleRate !== false,
    mutationMode: offerDraft?.mutationMode || extras.mutationMode || null,
    vehicleTrackId: offerDraft?.vehicleTrackId || extras.vehicleTrackId || null,
    focusModelKey: modelKey,
    vehicleLabel: headline,
    vehicle: {
      make: 'Kia',
      model,
      modelKey,
      trim: trimLabel,
      color: colorRaw,
      colorId: identity?.colorId || null,
      packages: packageLabels,
      packageIds: [],
      powertrain: identity?.powertrainVariant?.raw || null,
    },
    identityPatch: {
      modelKey,
      model,
      trim: trimLabel,
      color: colorRaw,
      colorId: identity?.colorId || null,
      packages: packageLabels,
    },
    headline,
    seedText: extras.sellerInput || offerDraft?.sellerInput || '',
    intent: {
      rawText: extras.sellerInput || offerDraft?.sellerInput || '',
      vehicleRequest: {
        brandHint: 'Kia',
        modelHint: model || modelKey,
        trimHint: trimLabel,
        colorHint: colorRaw,
        packageHints: packageLabels,
      },
      commercialInput: {
        durationMonths: commercial?.termMonths ?? null,
        annualMileageKm: commercial?.annualMileage ?? null,
        downPayment: commercial?.downPayment ?? null,
        // Rate bewusst leer – alte Fahrzeugrate darf nicht leaken
        monthlyRate: offerDraft?.rate ?? null,
      },
    },
    grounded: modelKey
      ? {
        brand: 'Kia',
        model,
        modelKey,
        trimLabel,
        colorLabel: colorRaw,
        colorId: identity?.colorId || null,
        packageIds: [],
        packageLabels,
      }
      : null,
    calculation: {
      monthlyRate: offerDraft?.rate ?? null,
    },
    paymentType: commercial?.paymentType || extras.paymentType || 'leasing',
    rateAuthority: offerDraft?.rateAuthority || RATE_AUTHORITY.NON_AUTHORITATIVE,
    missingRate: offerDraft?.rate == null,
  };
}

/**
 * Aus PREPARE_OFFER-Payload + Facts den vollständigen Handoff bauen.
 */
export function enrichPrepareOfferPayloadWithIdentityDraft(payload = {}, {
  facts = [],
  sellerInput = '',
  lead = null,
} = {}) {
  if (!payload || typeof payload !== 'object') return payload;

  const identity = buildVehicleIdentityDraftFromFacts({
    facts,
    sellerInput,
    customerId: payload.customerId || lead?.id || null,
    modelKey: payload.vehicle?.modelKey || payload.preparedOffer?.vehicle?.modelKey || null,
    model: payload.vehicle?.model || null,
    trim: payload.vehicle?.trim || null,
    vehicleLabel: payload.vehicleLabel || null,
    existingDraft: payload.vehicleIdentityDraft || null,
  });

  const commercial = payload.commercialScenario
    || buildCommercialScenarioFromLead(lead || {}, facts);

  const createNew = payload.createNewAlternative === true
    || payload.mutationMode === 'create_new';

  const offerDraft = buildOfferDraftFromIdentity({
    vehicleIdentityDraft: identity,
    commercialScenario: commercial,
    customerId: payload.customerId || lead?.id || null,
    vehicleTrackId: payload.vehicleTrackId || null,
    createNewAlternative: createNew,
    mutationMode: payload.mutationMode || null,
    monthlyRate: createNew ? null : (payload.monthlyRate ?? null),
    rateAuthority: createNew
      ? RATE_AUTHORITY.NON_AUTHORITATIVE
      : (payload.rateAuthority || RATE_AUTHORITY.NON_AUTHORITATIVE),
    sellerInput,
  });

  const handoff = buildComposerOfferHandoff(offerDraft, {
    sellerInput,
    paymentType: payload.paymentType || commercial.paymentType,
    vehicleTrackId: payload.vehicleTrackId,
    createNewAlternative: createNew,
    mutationMode: payload.mutationMode,
    vehicleLabel: payload.vehicleLabel,
  });

  return {
    ...payload,
    vehicleIdentityDraft: identity,
    vehicleIdentityDraftId: identity.id,
    offerDraftId: offerDraft.offerDraftId,
    offerDraft,
    commercialScenario: commercial,
    identityExtrasLine: formatIdentityDraftExtrasLine(identity),
    invalidateVehicleRate: true,
    monthlyRate: createNew ? null : payload.monthlyRate,
    missingRate: createNew || payload.monthlyRate == null,
    canCreateOffer: false,
    // Magic-kompatible Felder direkt am Payload (Handoff = Payload)
    ...handoff,
    // Payload-Felder nicht überschreiben die expliziten vehicle-Keys falsch
    vehicle: {
      ...(payload.vehicle || {}),
      ...handoff.vehicle,
    },
    vehicleLabel: handoff.vehicleLabel || payload.vehicleLabel,
  };
}

/**
 * Liest Identity aus einer Magic-/Handoff-Preparation (für resolveMagicVehicleFields).
 */
export function readIdentityFromPreparation(preparation) {
  if (!preparation || typeof preparation !== 'object') return null;
  if (preparation.vehicleIdentityDraft) return preparation.vehicleIdentityDraft;
  if (preparation.offerDraft?.vehicleIdentityDraft) {
    return preparation.offerDraft.vehicleIdentityDraft;
  }
  const v = preparation.vehicle;
  if (!v?.modelKey && !v?.model) return null;
  return {
    modelKey: v.modelKey || resolveIdentityModelKey(v.model),
    model: {
      raw: v.model || null,
      canonical: v.model || displayModel(v.modelKey),
      status: IDENTITY_SLOT_STATUS.CAPTURED,
    },
    trim: {
      raw: v.trim || null,
      canonical: displayTrim(v.trim),
      status: v.trim ? IDENTITY_SLOT_STATUS.CAPTURED : IDENTITY_SLOT_STATUS.OPEN,
    },
    color: {
      raw: v.color || null,
      canonical: null,
      status: v.color ? IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT : IDENTITY_SLOT_STATUS.OPEN,
    },
    colorId: v.colorId || null,
    packages: (v.packages || []).map((raw) => slot({
      raw,
      canonical: null,
      status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
    })),
    powertrainVariant: slot({
      raw: v.powertrain || null,
      status: v.powertrain ? IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT : IDENTITY_SLOT_STATUS.OPEN,
    }),
  };
}
