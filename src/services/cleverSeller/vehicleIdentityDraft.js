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
import { resolveConfigureModel } from '../configuration/configureModelBridge.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { validateOfferPackageAgainstCatalog } from './offerVehicleIdentity.js';

export const IDENTITY_SLOT_STATUS = Object.freeze({
  CAPTURED: 'captured',
  NEEDS_REFINEMENT: 'needs_refinement',
  OPEN: 'open',
  RESOLVED: 'resolved',
});

/**
 * Package-Resolution (orthogonal zu Review-Chip):
 * - unresolved: Kandidat, noch nicht bestätigt
 * - seller_confirmed: Verkäufer bestätigt, Katalog nicht validiert
 * - catalog_validated: eindeutiger Katalogtreffer für Model/Trim
 */
export const PACKAGE_RESOLUTION = Object.freeze({
  UNRESOLVED: 'unresolved',
  SELLER_CONFIRMED: 'seller_confirmed',
  CATALOG_VALIDATED: 'catalog_validated',
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

/**
 * Package-Slot mit getrennter Seller-/Katalog-Semantik.
 * @param {{
 *   raw?: string|null,
 *   canonical?: string|null,
 *   status?: string|null,
 *   resolution?: string|null,
 *   catalogValidated?: boolean|null,
 *   packageId?: string|null,
 * }} opts
 */
export function packageSlot(opts = {}) {
  const raw = opts.raw != null ? String(opts.raw).replace(/\s*prüfen\s*$/i, '').trim() : null;
  const catalogValidated = opts.catalogValidated === true;
  let resolution = opts.resolution || null;
  if (!resolution) {
    if (opts.unresolved === true || /prüfen/i.test(String(opts.raw || ''))) {
      resolution = PACKAGE_RESOLUTION.UNRESOLVED;
    } else if (catalogValidated) {
      resolution = PACKAGE_RESOLUTION.CATALOG_VALIDATED;
    } else if (opts.sellerConfirmed === true || opts.status === IDENTITY_SLOT_STATUS.CAPTURED) {
      resolution = PACKAGE_RESOLUTION.SELLER_CONFIRMED;
    } else {
      resolution = PACKAGE_RESOLUTION.UNRESOLVED;
    }
  }
  let status = opts.status || null;
  if (!status) {
    if (resolution === PACKAGE_RESOLUTION.CATALOG_VALIDATED) status = IDENTITY_SLOT_STATUS.RESOLVED;
    else if (resolution === PACKAGE_RESOLUTION.SELLER_CONFIRMED) status = IDENTITY_SLOT_STATUS.CAPTURED;
    else status = IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT;
  }
  const canonical = catalogValidated && opts.canonical
    ? opts.canonical
    : (resolution === PACKAGE_RESOLUTION.CATALOG_VALIDATED ? (opts.canonical || raw) : null);
  return {
    ...slot({
      raw: opts.raw != null && /prüfen/i.test(String(opts.raw)) && resolution === PACKAGE_RESOLUTION.UNRESOLVED
        ? String(opts.raw).trim()
        : raw,
      canonical,
      status,
    }),
    resolution,
    catalogValidated,
    packageId: opts.packageId || null,
  };
}

function resolveColorAgainstCatalog(modelKey, colorRaw) {
  if (!colorRaw) return { canonical: null, colorId: null, status: IDENTITY_SLOT_STATUS.OPEN };
  const key = String(modelKey || '').toLowerCase().replace(/\s+/g, '');
  const entry = key ? resolveConfigureModel(key) : null;
  const fromModel = entry?.data?.colors || [];
  const fromCatalog = getModelColorCatalog(key) || [];
  const catalog = fromModel.length ? fromModel : fromCatalog;
  const needle = normalizeKey(colorRaw);
  const hits = catalog.filter((c) => {
    const id = normalizeKey(c.id);
    const label = normalizeKey(c.label);
    return id === needle
      || label === needle
      || label.includes(needle)
      || needle.includes(label.slice(0, Math.min(6, label.length)));
  });
  if (hits.length === 1) {
    return {
      canonical: hits[0].label,
      colorId: hits[0].id,
      status: IDENTITY_SLOT_STATUS.RESOLVED,
    };
  }
  if (hits.length > 1) {
    return {
      canonical: null,
      colorId: null,
      status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
      candidates: hits.map((h) => ({ id: h.id, label: h.label })),
    };
  }
  // Basisfarbe als Kundenwunsch sicher speichern – Katalogfarbe später lokal im Offer
  const basePreference = /^(weiss|weiß|schwarz|blau|grau|silber|rot|gruen|grün|terracotta)(?:\s*metallic)?$/i
    .test(String(colorRaw || '').trim())
    || /^(weiss|weiß|schwarz|blau|grau|silber|rot|gruen|grün)/i.test(needle);
  if (basePreference) {
    return {
      canonical: null,
      colorId: null,
      status: IDENTITY_SLOT_STATUS.CAPTURED,
    };
  }
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
    || interest?.value?.trimCandidate?.raw
    || (typeof trimFact?.value === 'object' ? trimFact.value?.trim : trimFact?.value)
    || (Array.isArray(trimFact?.value) ? trimFact.value[0] : null)
    || trimFact?.label
    || existing?.trim?.raw
    || null;
  const trimCanonical = interest?.value?.trimCandidate
    ? null
    : displayTrim(trimRaw);
  const trimSlot = interest?.value?.trimCandidate
    ? slot({
      raw: interest.value.trimCandidate.raw || trimRaw,
      canonical: null,
      status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
    })
    : null;

  let colorRaw = interest?.value?.color
    || interest?.value?.preferredColor
    || colorRawFromFact(colorFact)
    || existing?.color?.raw
    || null;
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
  const pushPackage = (raw, meta = null) => {
    if (!raw) return;
    const text = String(raw).trim();
    if (!text) return;
    if (/\d+[.,]?\d*\s*kwh/i.test(text)) return;
    const key = normalizeKey(text.replace(/\s*prüfen\s*$/i, ''));
    if (!key || seenPkg.has(key)) return;
    seenPkg.add(key);
    const m = meta && typeof meta === 'object' ? meta : {};
    const unresolved = m.unresolved === true
      || m.validationStatus === 'needs_review'
      || /prüfen/i.test(text);
    const catalogOk = m.catalogValidated === true
      || (m.validationStatus === 'ok' && m.packageId);
    if (catalogOk) {
      packages.push(packageSlot({
        raw: text.replace(/\s*prüfen\s*$/i, '').trim(),
        canonical: m.canonical || text.replace(/\s*prüfen\s*$/i, '').trim(),
        resolution: PACKAGE_RESOLUTION.CATALOG_VALIDATED,
        catalogValidated: true,
        packageId: m.packageId || m.canonicalId || null,
      }));
      return;
    }
    if (unresolved) {
      packages.push(packageSlot({
        raw: /prüfen/i.test(text) ? text : `${text.replace(/\s*prüfen\s*$/i, '').trim()} prüfen`,
        resolution: PACKAGE_RESOLUTION.UNRESOLVED,
        catalogValidated: false,
      }));
      return;
    }
    if (m.sellerConfirmed || m.resolution === PACKAGE_RESOLUTION.SELLER_CONFIRMED) {
      packages.push(packageSlot({
        raw: text.replace(/\s*prüfen\s*$/i, '').trim(),
        resolution: PACKAGE_RESOLUTION.SELLER_CONFIRMED,
        catalogValidated: false,
        sellerConfirmed: true,
      }));
      return;
    }
    // Haystack-Kandidat ohne Confirm → unresolved
    packages.push(packageSlot({
      raw: text,
      resolution: PACKAGE_RESOLUTION.UNRESOLVED,
      catalogValidated: false,
      unresolved: true,
    }));
  };
  for (const fact of packageFacts) {
    if (fact?.value?.kind === 'motor') continue;
    const unresolved = fact.needsConfirmation
      || fact.value?.validationStatus === 'needs_review'
      || /prüfen/i.test(String(fact.label || ''));
    const catalogOk = fact.value?.validationStatus === 'ok' && fact.value?.id;
    const sellerConfirmed = fact.value?.resolution === PACKAGE_RESOLUTION.SELLER_CONFIRMED
      || fact.value?.validationStatus === 'seller_confirmed'
      || fact.value?.catalogValidated === false && !unresolved && fact.needsConfirmation === false;
    pushPackage(packageLabelFromFact(fact), {
      unresolved,
      catalogValidated: Boolean(catalogOk),
      validationStatus: fact.value?.validationStatus,
      packageId: catalogOk ? fact.value.id : null,
      canonical: catalogOk ? (fact.value?.label || null) : null,
      sellerConfirmed,
      resolution: fact.value?.resolution || null,
    });
  }
  // Zero-Loss: Paket oft in vehicleInterest.value statt separatem equipmentWish
  if (interest?.value && typeof interest.value === 'object') {
    pushPackage(interest.value.package || interest.value.equipmentPackage || interest.value.packageLabel);
    if (Array.isArray(interest.value.packages)) {
      for (const p of interest.value.packages) {
        pushPackage(typeof p === 'string' ? p : (p?.label || p?.name || p?.raw));
      }
    }
    if (Array.isArray(interest.value.packageCandidates)) {
      for (const p of interest.value.packageCandidates) {
        const raw = typeof p === 'string' ? p : (p?.raw || p?.label);
        if (!raw) continue;
        pushPackage(typeof p === 'string' ? p : (p?.label || raw), { unresolved: true });
      }
    }
  }
  // Seller-Text + unresolvedNotes Fallback (Zero-Loss, keine Erfindung)
  // Bei scoped Interest mit eigener Farbe/Kandidaten: kein globales Package-Scannen
  const packageHaystack = (interest?.value?.color || interest?.value?.trimCandidate || interest?.value?.packageCandidates?.length)
    ? ''
    : [input.sellerInput, ...unresolvedNotes].filter(Boolean).join(' ');
  const isPackageRemoveCue = /\b(?:raus|weg|entfernen|ohne)\b/i.test(packageHaystack)
    || /\b(?:nimm|entferne|streich).{0,40}\b(?:raus|weg|entfernen)\b/i.test(packageHaystack);
  if (packageHaystack && !isPackageRemoveCue) {
    const winterWheels = packageHaystack.match(/Winterr[aä]der(?:\s+\d+\s*Zoll)?/i);
    if (winterWheels) pushPackage(String(winterWheels[0]).replace(/\s+/g, ' ').trim());
    const winter = packageHaystack.match(/\bwinter(?:\s*|-)?(?:connect(?:[\s-]?paket)?|paket)\b/i);
    if (winter) pushPackage(/connect/i.test(winter[0]) ? 'Winter-Connect-Paket' : 'Winterpaket');
    const driveWise = packageHaystack.match(/\bdrive\s*wise(?:\s*-?\s*paket)?\b/i);
    if (driveWise) pushPackage('Drive Wise');
    // Nur explizites „Business Paket“ – nacktes „Business“ → customerType, kein Paket raten
    const businessPaket = packageHaystack.match(/\bbusiness\s*-?\s*paket\b/i);
    if (businessPaket) pushPackage('Business Paket');
    const upDrive = packageHaystack.match(/\bup\s*-?\s*drive\b/i);
    if (upDrive) pushPackage('Up Drive');
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
    const longRange = kwhHaystack.match(/\blong\s*range\b/i);
    const standardRange = kwhHaystack.match(/\bstandard\s*range\b/i);
    const kwh = kwhHaystack.match(/(\d{2,3}(?:[.,]\d+)?)\s*kwh/i);
    if (longRange) {
      powertrain = slot({
        raw: 'Long Range',
        canonical: 'long_range',
        status: IDENTITY_SLOT_STATUS.CAPTURED,
      });
    } else if (standardRange) {
      powertrain = slot({
        raw: 'Standard Range',
        canonical: 'standard_range',
        status: IDENTITY_SLOT_STATUS.CAPTURED,
      });
    } else if (kwh) {
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
    trim: trimSlot || slot({
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
          || colorResolved.status === IDENTITY_SLOT_STATUS.CAPTURED
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
          || resolved.status === IDENTITY_SLOT_STATUS.CAPTURED
          ? IDENTITY_SLOT_STATUS.CAPTURED
          : IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
      });
      next.colorId = resolved.colorId;
    }
  }
  if (Array.isArray(patch.removePackages)) {
    const removeKeys = patch.removePackages.map(normalizeKey).filter(Boolean);
    next.packages = next.packages.filter((p) => {
      const pk = normalizeKey(p.raw);
      if (!pk) return true;
      if (removeKeys.includes(pk)) return false;
      // WIC / Winter Connect / Winterpaket – gleiche Absicht trotz Label-Varianten
      return !removeKeys.some((r) => (
        (r.includes('winter') || r.includes('wic') || pk.includes('winter') || pk.includes('wic'))
        && (pk.includes(r) || r.includes(pk) || (r.includes('winter') && pk.includes('winter')))
      ));
    });
  }
  if (patch.clearPackages === true) {
    next.packages = [];
  }
  if (Array.isArray(patch.addPackages)) {
    for (const entry of patch.addPackages) {
      const isObj = entry && typeof entry === 'object';
      const rawIn = isObj
        ? (entry.raw || entry.label || entry.insertText || '')
        : entry;
      const clean = String(rawIn || '').replace(/\s*prüfen\s*$/i, '').trim();
      if (!clean) continue;
      const key = normalizeKey(clean);

      // Ersetzt unsichere/Alias-Varianten derselben Paketfamilie (kein Doppel-Chip)
      next.packages = next.packages.filter((p) => {
        const pk = normalizeKey(String(p.raw || '').replace(/\s*prüfen\s*$/i, ''));
        if (!pk) return true;
        if (pk === key) return false;
        const winterNew = key.includes('winter') || key.includes('wic');
        const winterOld = pk.includes('winter') || pk.includes('wic');
        if (winterNew && winterOld) return false;
        return true;
      });

      // Explizite Meta aus Choice-Patch hat Vorrang; sonst Katalog prüfen
      let catalogValidated = isObj && typeof entry.catalogValidated === 'boolean'
        ? entry.catalogValidated
        : null;
      let resolution = isObj && entry.resolution ? entry.resolution : null;
      let packageId = isObj ? (entry.packageId || entry.id || null) : null;
      let canonical = isObj ? (entry.canonical || null) : null;

      if (isObj && entry.unresolved === true) {
        resolution = PACKAGE_RESOLUTION.UNRESOLVED;
        catalogValidated = false;
      } else if (catalogValidated == null || !resolution) {
        const validated = next.modelKey
          ? validateOfferPackageAgainstCatalog({
            modelKey: next.modelKey,
            packageLabel: clean,
            trim: next.trim?.canonical || next.trim?.raw || null,
          })
          : null;
        if (validated?.ok) {
          catalogValidated = true;
          resolution = PACKAGE_RESOLUTION.CATALOG_VALIDATED;
          packageId = packageId || validated.packageId;
          canonical = canonical || validated.packageLabel;
        } else if (!resolution) {
          // Seller-Intent (Choice/Composer), kein Katalogtreffer
          resolution = PACKAGE_RESOLUTION.SELLER_CONFIRMED;
          catalogValidated = false;
        } else {
          catalogValidated = resolution === PACKAGE_RESOLUTION.CATALOG_VALIDATED;
        }
      }

      if (resolution === PACKAGE_RESOLUTION.CATALOG_VALIDATED) {
        catalogValidated = true;
        if (!canonical) canonical = clean;
      } else if (resolution === PACKAGE_RESOLUTION.SELLER_CONFIRMED) {
        catalogValidated = false;
        canonical = null;
        packageId = null;
      } else {
        catalogValidated = false;
        canonical = null;
        packageId = null;
      }

      next.packages.push(packageSlot({
        raw: resolution === PACKAGE_RESOLUTION.UNRESOLVED && /prüfen/i.test(String(rawIn))
          ? String(rawIn).trim()
          : clean,
        canonical,
        resolution,
        catalogValidated,
        packageId,
        sellerConfirmed: resolution === PACKAGE_RESOLUTION.SELLER_CONFIRMED,
      }));
    }
  }
  if (patch.powertrain !== undefined) {
    if (patch.powertrain == null || patch.powertrain === '') {
      next.powertrainVariant = slot({ status: IDENTITY_SLOT_STATUS.OPEN });
    } else {
      next.powertrainVariant = slot({
        raw: String(patch.powertrain),
        canonical: null,
        status: IDENTITY_SLOT_STATUS.NEEDS_REFINEMENT,
      });
    }
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
  const customerTypeFromFact = facts.find((f) => f.field === 'customerType');

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
  const customerTypeRaw = customerTypeFromFact?.value
    || wish.customerType
    || lead?.customerType
    || null;
  const customerType = customerTypeRaw === 'privat' || customerTypeRaw === 'private'
    ? 'private'
    : (customerTypeRaw === 'business' || customerTypeRaw === 'gewerbe'
      ? 'business'
      : (customerTypeRaw || null));

  return {
    id: uid('com'),
    paymentType: paymentType === 'unknown' ? null : paymentType,
    customerType,
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
  offerDraftId = null,
  createdAt = null,
} = {}) {
  const now = new Date().toISOString();
  const hasAuthRate = rateAuthority === RATE_AUTHORITY.AUTHORITATIVE
    && monthlyRate != null
    && Number.isFinite(Number(monthlyRate));
  const invalidateVehicleRate = !hasAuthRate && (
    createNewAlternative === true
    || Boolean(vehicleIdentityDraft?.modelKey)
  );
  const safeRate = hasAuthRate
    ? Number(monthlyRate)
    : (invalidateVehicleRate ? null : monthlyRate);

  return {
    // Bestehenden Concept-Draft weiterverwenden, wenn ID bekannt – kein stiller Zweit-Draft
    offerDraftId: offerDraftId || uid('ofd'),
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
    createdAt: createdAt || now,
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
    canCreateOffer: extras.canCreateOffer === true
      || (offerDraft?.rate != null && offerDraft?.rateAuthority === RATE_AUTHORITY.AUTHORITATIVE),
    fromPdf: Boolean(extras.fromPdf)
      || offerDraft?.rateAuthority === RATE_AUTHORITY.AUTHORITATIVE,
    offerDraftId: offerDraft?.offerDraftId || extras.offerDraftId || null,
    vehicleIdentityDraftId: identity?.id || null,
    vehicleIdentityDraft: identity,
    commercialScenario: commercial,
    createNewAlternative: Boolean(offerDraft?.createNewAlternative ?? extras.createNewAlternative),
    invalidateVehicleRate: offerDraft?.rate != null
      && offerDraft?.rateAuthority === RATE_AUTHORITY.AUTHORITATIVE
      ? false
      : (offerDraft?.invalidateVehicleRate !== false),
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
    paymentType: commercial?.paymentType || extras.paymentType || null,
    customerType: commercial?.customerType
      || extras.customerType
      || null,
    rateAuthority: offerDraft?.rateAuthority || RATE_AUTHORITY.NON_AUTHORITATIVE,
    missingRate: offerDraft?.rate == null,
  };
}

/**
 * Aus PREPARE_OFFER-Payload + Facts den vollständigen Handoff bauen.
 */
function readStoredOfferDraftLoose(lead, offerDraftId) {
  if (!lead || !offerDraftId) return null;
  const state = lead?.crm?.cleverWorkingState;
  const draft = state?.offerDrafts?.[offerDraftId] || null;
  if (!draft) return null;
  return {
    ...draft,
    vehicleIdentityDraft: state?.vehicleIdentityDrafts?.[draft.vehicleIdentityDraftId]
      || draft.vehicleIdentityDraft
      || null,
    commercialScenario: state?.commercialScenarios?.[draft.commercialScenarioId]
      || draft.commercialScenario
      || null,
  };
}

export function enrichPrepareOfferPayloadWithIdentityDraft(payload = {}, {
  facts = [],
  sellerInput = '',
  lead = null,
} = {}) {
  if (!payload || typeof payload !== 'object') return payload;

  const createNew = payload.createNewAlternative === true
    || payload.mutationMode === 'create_new';

  // Bestehenden Concept-Draft wiederverwenden (Payload-ID oder aktueller Lead-Draft)
  let reuseOfferDraftId = payload.offerDraftId
    || payload.offerDraft?.offerDraftId
    || null;
  if (!createNew && !reuseOfferDraftId) {
    reuseOfferDraftId = lead?.crm?.cleverWorkingState?.currentOfferDraftId || null;
  }
  const existingStored = !createNew
    ? readStoredOfferDraftLoose(lead, reuseOfferDraftId)
    : null;
  if (!createNew && !existingStored) {
    // Unbekannte ID nicht erzwingen – sonst Upsert mit leerem Zweit-Draft
    if (reuseOfferDraftId && !payload.offerDraft?.vehicleIdentityDraft
      && !payload.vehicleIdentityDraft) {
      reuseOfferDraftId = null;
    }
  }

  const identity = buildVehicleIdentityDraftFromFacts({
    facts,
    sellerInput,
    customerId: payload.customerId || lead?.id || null,
    modelKey: payload.modelKey
      || payload.focusModelKey
      || payload.vehicle?.modelKey
      || payload.preparedOffer?.vehicle?.modelKey
      || null,
    model: payload.vehicle?.model || payload.model || null,
    trim: payload.vehicle?.trim || payload.trim || null,
    vehicleLabel: payload.vehicleLabel || null,
    existingDraft: payload.vehicleIdentityDraft
      || existingStored?.vehicleIdentityDraft
      || null,
  });

  const commercial = payload.commercialScenario
    || existingStored?.commercialScenario
    || buildCommercialScenarioFromLead(lead || {}, facts);

  // Autoritativer PDF-/Bank-Rate auch bei neuem Draft behalten (nicht still strippen)
  const authoritativeIncomingRate = payload.rateAuthority === RATE_AUTHORITY.AUTHORITATIVE
    && payload.monthlyRate != null
    && Number.isFinite(Number(payload.monthlyRate));
  const monthlyRateForDraft = authoritativeIncomingRate
    ? Number(payload.monthlyRate)
    : (createNew ? null : (payload.monthlyRate ?? existingStored?.rate ?? null));
  const rateAuthorityForDraft = authoritativeIncomingRate
    ? RATE_AUTHORITY.AUTHORITATIVE
    : (createNew
      ? RATE_AUTHORITY.NON_AUTHORITATIVE
      : (payload.rateAuthority || existingStored?.rateAuthority || RATE_AUTHORITY.NON_AUTHORITATIVE));

  const offerDraft = buildOfferDraftFromIdentity({
    vehicleIdentityDraft: identity,
    commercialScenario: commercial,
    customerId: payload.customerId || lead?.id || null,
    vehicleTrackId: payload.vehicleTrackId
      || existingStored?.vehicleTrackId
      || null,
    createNewAlternative: createNew,
    mutationMode: payload.mutationMode || null,
    monthlyRate: monthlyRateForDraft,
    rateAuthority: rateAuthorityForDraft,
    sellerInput,
    offerDraftId: createNew ? null : (reuseOfferDraftId || null),
    createdAt: existingStored?.createdAt || null,
  });

  const handoff = buildComposerOfferHandoff(offerDraft, {
    sellerInput,
    paymentType: payload.paymentType || commercial.paymentType,
    customerType: payload.customerType || commercial.customerType,
    vehicleTrackId: payload.vehicleTrackId,
    createNewAlternative: createNew,
    mutationMode: payload.mutationMode,
    vehicleLabel: payload.vehicleLabel,
    fromPdf: authoritativeIncomingRate || Boolean(payload.fromPdf),
    canCreateOffer: authoritativeIncomingRate
      ? Boolean(payload.canCreateOffer !== false)
      : false,
  });

  const hasAuthRate = offerDraft.rate != null
    && offerDraft.rateAuthority === RATE_AUTHORITY.AUTHORITATIVE;

  return {
    ...payload,
    vehicleIdentityDraft: identity,
    vehicleIdentityDraftId: identity.id,
    offerDraftId: offerDraft.offerDraftId,
    offerDraft,
    commercialScenario: commercial,
    identityExtrasLine: formatIdentityDraftExtrasLine(identity),
    // Magic-kompatible Felder direkt am Payload (Handoff = Payload)
    ...handoff,
    // Payload-Felder nicht überschreiben die expliziten vehicle-Keys falsch
    vehicle: {
      ...(payload.vehicle || {}),
      ...handoff.vehicle,
    },
    vehicleLabel: (() => {
      let label = handoff.vehicleLabel || payload.vehicleLabel || null;
      const transmissionLabel = (facts || []).find((f) => (
        f.field === 'transmissionPreference' && f.label
      ))?.label || null;
      if (
        label
        && transmissionLabel
        && !new RegExp(String(transmissionLabel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(label)
      ) {
        label = `${label} ${transmissionLabel}`;
      }
      return label;
    })(),
    // Autoritativer Rate-Handoff: nicht durch createNew-/Default-Flags löschen
    monthlyRate: hasAuthRate ? offerDraft.rate : (createNew ? null : payload.monthlyRate),
    rateAuthority: hasAuthRate
      ? RATE_AUTHORITY.AUTHORITATIVE
      : (createNew ? RATE_AUTHORITY.NON_AUTHORITATIVE : (payload.rateAuthority || handoff.rateAuthority)),
    missingRate: !hasAuthRate && (createNew || payload.monthlyRate == null),
    canCreateOffer: hasAuthRate
      ? Boolean(payload.canCreateOffer !== false)
      : false,
    invalidateVehicleRate: !hasAuthRate,
    fromPdf: hasAuthRate || Boolean(payload.fromPdf) || Boolean(handoff.fromPdf),
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
