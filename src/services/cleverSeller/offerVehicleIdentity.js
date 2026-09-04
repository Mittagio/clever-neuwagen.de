/**
 * Offer Vehicle Identity Freeze – Zielspur für Angebots-Cues + Mutation-Modus.
 * Kein stilles Default-Modell (EV3 Earth / Picanto).
 *
 * @see docs/CLEVER_OFFER_VEHICLE_IDENTITY_FREEZE.md
 */

import {
  listCustomerVehicleTracks,
  resolveActiveSellerModelInterest,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';
import {
  listResolvableConfigureModelKeys,
  resolveConfigureModel,
} from '../configuration/configureModelBridge.js';
import { getModelColorCatalog } from '../../data/manufacturer/configureModelColorCatalog.js';

export const OFFER_VEHICLE_TARGET_STATUS = Object.freeze({
  RESOLVED: 'resolved',
  NEEDS_CLARIFICATION: 'needs_clarification',
  UNRESOLVED: 'unresolved',
});

export const OFFER_MUTATION_MODE = Object.freeze({
  UPDATE_EXISTING: 'update_existing',
  CREATE_NEW: 'create_new',
  UNKNOWN: 'unknown',
});

export const CLARIFY_VEHICLE_FOR_OFFER_PROMPT = 'Für welches Fahrzeug?';

const MODEL_RE = /\b(ev\s*[2-9]|pv\s*[2-9]|sportage|sorento|ceed|xceed|niro|picanto|stonic|e-?soul)\b/i;
const TRIM_RE = /\b(gt-?\s*line|x-?\s*line(?:\s*\d+)?|earth|air|spirit|vision|drive\s*wise|core|cor)\b/i;
// Kein \\b vor/nach ß – JS-Word-Boundary bricht „weiß“
const COLOR_RE = /(?:^|[^A-Za-zÄÖÜäöüß])(schwarz\w*|weiß\w*|weiss\w*|terracotta|blau\w*|grau\w*|silber\w*|rot\w*|gr[uü]n\w*|clear\s*white)(?=$|[^A-Za-zÄÖÜäöüß])/i;

function normalizeModelKey(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .replace(/^kia\s+/i, '')
    .replace(/\s+/g, '')
    .replace(/^ev([2-9])$/i, 'ev$1')
    .trim();
}

function displayModel(keyOrLabel = '') {
  const key = normalizeModelKey(keyOrLabel);
  if (/^ev\d$/i.test(key)) return key.toUpperCase();
  if (!key) return '';
  return String(keyOrLabel).replace(/^kia\s*/i, '') || key;
}

function openOfferTracks(lead = {}) {
  return listCustomerVehicleTracks(lead).filter((t) => (
    t.status === VEHICLE_TRACK_STATUS.OPEN
    || t.status === VEHICLE_TRACK_STATUS.ACTIVE
    || t.status === VEHICLE_TRACK_STATUS.FAVORITE
  ));
}

function focusedTrack(lead = {}) {
  const tracks = listCustomerVehicleTracks(lead);
  const focusedId = lead?.crm?.focusedVehicleTrackId;
  if (focusedId) {
    const hit = tracks.find((t) => t.id === focusedId);
    if (hit) return hit;
  }
  return tracks.find((t) => (
    t.status === VEHICLE_TRACK_STATUS.ACTIVE
    || t.status === VEHICLE_TRACK_STATUS.FAVORITE
  )) || null;
}

function trackChoice(track) {
  const modelKey = normalizeModelKey(
    track.config?.modelKey || track.modelLabel || track.vehicleKey?.replace(/^kia-/, ''),
  );
  return {
    id: track.id,
    vehicleTrackId: track.id,
    modelKey,
    label: track.displayName || track.modelLabel || displayModel(modelKey),
    insertText: track.displayName || displayModel(modelKey),
  };
}

function modelFromFacts(facts = []) {
  const interest = (facts || []).find((f) => f?.field === 'vehicleInterest' && f.value);
  if (!interest) return null;
  if (interest.value?.conflictWithActive && interest.value?.preserveActiveFocus) {
    return {
      modelKey: normalizeModelKey(interest.value.activeModelKey || interest.value.activeModel),
      model: interest.value.activeModel || displayModel(interest.value.activeModelKey),
      trim: null,
      label: interest.value.activeLabel || null,
      fromConflictPreserve: true,
    };
  }
  const modelKey = normalizeModelKey(interest.value?.modelKey || interest.value?.model || interest.label);
  if (!modelKey) return null;
  return {
    modelKey,
    model: interest.value?.model || displayModel(modelKey),
    trim: interest.value?.trim || null,
    label: interest.label || interest.value?.label || null,
  };
}

function modelFromText(text = '') {
  const m = String(text || '').match(MODEL_RE);
  if (!m?.[1]) return null;
  const modelKey = normalizeModelKey(m[1]);
  return modelKey
    ? { modelKey, model: displayModel(modelKey), trim: null, label: displayModel(modelKey) }
    : null;
}

/**
 * Bare / weak Angebots-Cue ohne explizites Modell (z. B. „Angebot“, „EV Angebot“).
 * @param {string} text
 */
export function isBareOrGenericOfferCue(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isBatchOfferCueLocal(t)) return false;
  // Explizites Modell + Angebot → nicht bare
  if (MODEL_RE.test(t) && !/\bev\s+angebot\b/i.test(t) && !/^ev\s*angebot\b/i.test(t)) {
    // „EV2 Angebot“ hat Modellziffer
    if (/\bev\s*[2-9]\b/i.test(t) || /\b(sportage|sorento|ceed|xceed|niro|picanto)\b/i.test(t)) {
      return false;
    }
  }
  return /^(?:ev\s+)?angebot[.!?]?$/i.test(t)
    || /^(?:mach(?:e|en)?|erstell(?:e|en)?)\s+(?:mir\s+)?(?:ein\s+)?(?:ev\s+)?angebot[.!?]?$/i.test(t)
    || /^angebot\s+(?:vorbereiten|machen|erstellen)[.!?]?$/i.test(t)
    || /\bev\s+angebot\b/i.test(t) && !/\bev\s*[2-9]\b/i.test(t);
}

function isBatchOfferCueLocal(text = '') {
  const t = String(text || '');
  return /\b(?:mach(?:e|en)?|erstell(?:e|en)?)\s+(?:mir\s+)?(?:die\s+)?(?:\d+\s+)?angebote\b/i.test(t)
    || /\bangebote\s+(?:für|fuer)\s+alle\b/i.test(t)
    || /\balle\s+(?:\d+\s+)?angebote\b/i.test(t);
}

/**
 * „noch einen …“ → neue Alternative; „änder / mach X zu / doch …“ → bestehend.
 * @param {string} text
 */
export function detectOfferMutationMode(text = '') {
  const t = String(text || '').trim();
  if (!t) return OFFER_MUTATION_MODE.UNKNOWN;
  if (/\bnoch\s+(?:ein(?:en|em)?|eins)\b/i.test(t)
    || /\bzusätzlich(?:es|en)?\b/i.test(t)
    || /\balternativ(?:e|es)?\b/i.test(t)
    || /\bzweites?\s+angebot\b/i.test(t)
    || /\bneben\s+(?:dem|der)\b/i.test(t)) {
    return OFFER_MUTATION_MODE.CREATE_NEW;
  }
  if (/\bänder(?:e|n)?\b/i.test(t)
    || /\bmach(?:e|en)?\s+.+\s+zu\b/i.test(t)
    || /\bdoch\b/i.test(t)
    || /\bstatt\b/i.test(t)
    || /\bauf\s+(?:air|earth|spirit|vision|gt)/i.test(t)
    || /\bwechsel(?:e|n)?\s+(?:auf|zu)\b/i.test(t)) {
    return OFFER_MUTATION_MODE.UPDATE_EXISTING;
  }
  return OFFER_MUTATION_MODE.UNKNOWN;
}

/**
 * Trim-Wechsel-Phrase: „Mach Earth zu Air.“ / „Earth zu Air“
 * @param {string} text
 * @returns {{ from: string|null, to: string }|null}
 */
export function parseTrimSwitchPhrase(text = '') {
  const t = String(text || '').trim();
  const m = t.match(
    /(?:mach(?:e|en)?\s+)?(earth|air|spirit|vision|gt-?\s*line)\s+(?:zu|auf|nach)\s+(earth|air|spirit|vision|gt-?\s*line)\b/i,
  );
  if (!m) return null;
  const norm = (s) => {
    const x = String(s).toLowerCase().replace(/\s+/g, '');
    if (x.startsWith('gt')) return 'GT-Line';
    return x.charAt(0).toUpperCase() + x.slice(1);
  };
  return { from: norm(m[1]), to: norm(m[2]) };
}

/**
 * Standalone Trim / Farbe für offenen Offer-Kontext.
 * @param {string} text
 */
export function parseOfferIdentityFollowUp(text = '') {
  const t = String(text || '').trim();
  if (!t) return null;
  const trimSwitch = parseTrimSwitchPhrase(t);
  if (trimSwitch) {
    return { kind: 'trim', trim: trimSwitch.to, fromTrim: trimSwitch.from, raw: t };
  }
  // Nur Trim / Farbe / kurzes „Doch EV2 Earth“
  const color = t.match(COLOR_RE);
  const trim = t.match(TRIM_RE);
  const model = t.match(MODEL_RE);
  if (model && (trim || color || /\bdoch\b/i.test(t))) {
    return {
      kind: 'vehicle_identity',
      modelKey: normalizeModelKey(model[1]),
      model: displayModel(model[1]),
      trim: trim ? normalizeTrimLabel(trim[1]) : null,
      color: color ? normalizeColorBase(color[1]) : null,
      raw: t,
    };
  }
  if (trim && t.length <= 40 && !/\b(?:monat|km|rate|anzahlung|leasing|finanz)\b/i.test(t)) {
    return { kind: 'trim', trim: normalizeTrimLabel(trim[1]), raw: t };
  }
  if (color && t.length <= 32 && !MODEL_RE.test(t) && !/\b(?:monat|km|rate|anzahlung)\b/i.test(t)) {
    return { kind: 'color', color: normalizeColorBase(color[1]), raw: t };
  }
  return null;
}

function normalizeTrimLabel(raw = '') {
  const x = String(raw).toLowerCase().replace(/\s+/g, '');
  if (x.startsWith('gt')) return 'GT-Line';
  if (x.startsWith('xline') || x.startsWith('x-line')) return 'X-Line';
  if (x === 'cor') return 'Core';
  if (x === 'drivewise') return 'DriveWise';
  return x.charAt(0).toUpperCase() + x.slice(1);
}

function normalizeColorBase(raw = '') {
  const lower = String(raw || '').toLowerCase();
  if (lower.startsWith('schwarz')) return 'schwarz';
  if (lower.startsWith('weiß') || lower.startsWith('weiss')) return 'weiß';
  if (/clear\s*white/.test(lower)) return 'weiß';
  if (lower.startsWith('blau')) return 'blau';
  if (lower.startsWith('grau')) return 'grau';
  if (lower.startsWith('silber')) return 'silber';
  if (lower.startsWith('rot')) return 'rot';
  if (lower.startsWith('grün') || lower.startsWith('gruen')) return 'grün';
  if (lower.includes('terracotta')) return 'terracotta';
  return lower;
}

/** Primäre Angebots-Modelle für Fact-Popover (kein Carwow-Katalog-Dump). */
const PRIMARY_OFFER_MODEL_KEYS = Object.freeze([
  'ev2', 'ev3', 'ev4', 'ev5', 'ev6', 'ev9',
  'pv5',
  'sportage', 'sorento', 'niro', 'ceed', 'picanto', 'stonic', 'xceed',
]);

const FALLBACK_TRIM_CHOICES = Object.freeze([
  { id: 'air', label: 'Air' },
  { id: 'earth', label: 'Earth' },
  { id: 'gt-line', label: 'GT-Line' },
  { id: 'spirit', label: 'Spirit' },
  { id: 'vision', label: 'Vision' },
  { id: 'core', label: 'Core' },
]);

const FALLBACK_COLOR_CHOICES = Object.freeze([
  { id: 'schwarz', label: 'Schwarz', swatch: '#1a1a1a' },
  { id: 'weiss', label: 'Weiß', swatch: '#f4f4f0' },
  { id: 'grau', label: 'Grau', swatch: '#8b939e' },
  { id: 'silber', label: 'Silber', swatch: '#c0c6ce' },
  { id: 'blau', label: 'Blau', swatch: '#2d4a6e' },
  { id: 'rot', label: 'Rot', swatch: '#8b1e2f' },
  { id: 'gruen', label: 'Grün', swatch: '#3d5c4a' },
  { id: 'terracotta', label: 'Terracotta', swatch: '#8b1e2f' },
]);

function swatchForColorLabel(label = '', id = '') {
  const haystack = `${id} ${label}`.toLowerCase();
  if (/black|schwarz|pearl.*black|aurora/.test(haystack)) return '#1a1a1a';
  if (/white|weiss|weiß|snow|carrara|deluxe|clear/.test(haystack)) return '#f4f4f0';
  if (/red|rot|magma|runway|terracotta|signal/.test(haystack)) return '#8b1e2f';
  if (/blue|blau|frost|ocean|yacht|smoke/.test(haystack)) return '#2d4a6e';
  if (/green|grün|gruen|aventurine|experience|adventurous/.test(haystack)) return '#3d5c4a';
  if (/grey|gray|grau|wolf|shale|pentametal|astro|sparkling|ivory|lunar|silver|silber/.test(haystack)) {
    return '#8b939e';
  }
  return '#cbd5e1';
}

/**
 * Gültige Modell-Choices für Angebot-prüfen Fact-Popover.
 * @param {{ currentModelKey?: string|null }} [opts]
 */
export function listOfferIdentityModelChoices(opts = {}) {
  const resolvable = new Set(listResolvableConfigureModelKeys());
  const keys = [];
  const seen = new Set();
  for (const key of PRIMARY_OFFER_MODEL_KEYS) {
    if (resolvable.has(key) || /^ev\d$/i.test(key)) {
      keys.push(key);
      seen.add(key);
    }
  }
  const current = normalizeModelKey(opts.currentModelKey);
  if (current && !seen.has(current)) {
    keys.unshift(current);
    seen.add(current);
  }
  if (!keys.length) {
    return PRIMARY_OFFER_MODEL_KEYS.map((id) => ({ id, label: displayModel(id) }));
  }
  return keys.map((id) => ({ id, label: displayModel(id) }));
}

/**
 * Gültige Linien/Trims für ein Modell (Lexikon → Fallback ohne Fake-Genauigkeit).
 * @param {string} [modelKey]
 */
export function listOfferIdentityTrimChoices(modelKey = '') {
  const key = normalizeModelKey(modelKey);
  const entry = key ? resolveConfigureModel(key) : null;
  const trims = entry?.data?.trims || [];
  if (trims.length) {
    const seen = new Set();
    return trims
      .map((tr) => ({
        id: String(tr.id || normalizeModelKey(tr.name)),
        label: String(tr.name || tr.id || '').trim(),
      }))
      .filter((t) => {
        if (!t.label || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
  }
  return [...FALLBACK_TRIM_CHOICES];
}

/**
 * Gültige Farben für ein Modell (+ Swatch). Fallback: sinnvolle Basisfarben.
 * @param {string} [modelKey]
 */
export function listOfferIdentityColorChoices(modelKey = '') {
  const key = normalizeModelKey(modelKey);
  const entry = key ? resolveConfigureModel(key) : null;
  const fromModel = entry?.data?.colors || [];
  const fromCatalog = getModelColorCatalog(key) || [];
  const source = fromModel.length ? fromModel : fromCatalog;
  if (source.length) {
    const seen = new Set();
    return source
      .map((c) => ({
        id: String(c.id || normalizeModelKey(c.label)),
        label: String(c.label || c.id || '').trim(),
        swatch: swatchForColorLabel(c.label, c.id),
      }))
      .filter((c) => {
        if (!c.label || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
  }
  return FALLBACK_COLOR_CHOICES.map((c) => ({ ...c }));
}

/**
 * Lexikon-Validierung für Trim/Farbe gegen verifizierte Modelldaten.
 * @param {{ modelKey?: string, trim?: string, color?: string }} identity
 */
export function validateOfferVehicleIdentity(identity = {}) {
  const modelKey = normalizeModelKey(identity.modelKey);
  if (!modelKey) {
    return { ok: false, reason: 'missing_model', uncertainty: true };
  }
  const entry = resolveConfigureModel(modelKey);
  const data = entry?.data;
  if (!data) {
    return {
      ok: false,
      reason: 'unknown_model',
      uncertainty: true,
      modelKey,
    };
  }

  let trimId = null;
  let trimLabel = identity.trim || null;
  let trimOk = !identity.trim;
  if (identity.trim) {
    const needle = normalizeModelKey(identity.trim);
    const hit = (data.trims || []).find((tr) => (
      normalizeModelKey(tr.id) === needle
      || normalizeModelKey(tr.name) === needle
    ));
    if (hit) {
      trimOk = true;
      trimId = hit.id;
      trimLabel = hit.name;
    } else {
      trimOk = false;
    }
  }

  let colorId = null;
  let colorLabel = identity.color || null;
  let colorOk = !identity.color;
  if (identity.color) {
    const needle = normalizeModelKey(identity.color);
    const hit = (data.colors || []).find((c) => (
      normalizeModelKey(c.id) === needle
      || normalizeModelKey(c.label) === needle
      || normalizeModelKey(c.label).includes(needle)
      || needle.includes(normalizeModelKey(c.label).slice(0, 6))
    ));
    if (hit) {
      colorOk = true;
      colorId = hit.id;
      colorLabel = hit.label;
    } else {
      // Freie Farbwort-Basis (schwarz) oft ohne Exact-Match → Uncertainty, Fact behalten
      colorOk = false;
    }
  }

  return {
    ok: trimOk && (colorOk || !identity.color),
    uncertainty: !trimOk || (Boolean(identity.color) && !colorOk),
    modelKey,
    model: data.model || displayModel(modelKey),
    trimId,
    trimLabel,
    colorId,
    colorLabel,
    trimOk,
    colorOk,
  };
}

/**
 * Löst Ziel-Fahrzeugspur für PREPARE_OFFER auf.
 *
 * @param {{
 *   lead?: object,
 *   sellerInput?: string,
 *   facts?: object[],
 *   currentOfferContext?: object|null,
 *   workingContext?: object|null,
 * }} params
 */
export function resolveOfferVehicleTarget({
  lead = {},
  sellerInput = '',
  facts = [],
  currentOfferContext = null,
  workingContext = null,
} = {}) {
  const mutationMode = detectOfferMutationMode(sellerInput);
  const fromFacts = modelFromFacts(facts);
  const fromText = modelFromText(sellerInput);
  const explicit = fromFacts || fromText;
  const tracks = openOfferTracks(lead);
  const focus = focusedTrack(lead);
  const offerTrackId = currentOfferContext?.vehicleTrackId
    || currentOfferContext?.vehicleCardId
    || currentOfferContext?.configId
    || workingContext?.attachedVehicle?.vehicleTrackId
    || workingContext?.offer?.vehicleTrackId
    || null;

  // Explizites Modell + CREATE_NEW → neue Alternative (nicht still überschreiben)
  if (explicit?.modelKey && mutationMode === OFFER_MUTATION_MODE.CREATE_NEW) {
    const existing = tracks.find((t) => (
      normalizeModelKey(t.config?.modelKey || t.modelLabel) === explicit.modelKey
    ));
    return {
      status: OFFER_VEHICLE_TARGET_STATUS.RESOLVED,
      vehicleTrackId: null,
      createNew: true,
      modelKey: explicit.modelKey,
      model: explicit.model,
      trim: explicit.trim || null,
      label: explicit.label || displayModel(explicit.modelKey),
      source: 'explicit_create_new',
      mutationMode,
      relatedTrackId: existing?.id || null,
    };
  }

  // Explizites Modell → bestehende Spur matchen oder neue Zielspur anlegen/fokus
  if (explicit?.modelKey) {
    const match = tracks.find((t) => (
      normalizeModelKey(t.config?.modelKey || t.modelLabel) === explicit.modelKey
    ));
    const updateExisting = mutationMode === OFFER_MUTATION_MODE.UPDATE_EXISTING
      || Boolean(offerTrackId && match && match.id === offerTrackId)
      || Boolean(focus && match && match.id === focus.id);
    const createNew = !match && mutationMode !== OFFER_MUTATION_MODE.UPDATE_EXISTING;
    return {
      status: OFFER_VEHICLE_TARGET_STATUS.RESOLVED,
      vehicleTrackId: match?.id || (updateExisting ? offerTrackId : null) || null,
      createNew,
      modelKey: explicit.modelKey,
      model: explicit.model,
      trim: explicit.trim || match?.config?.trimLabel || null,
      label: explicit.label
        || match?.displayName
        || displayModel(explicit.modelKey),
      source: 'explicit_model',
      mutationMode: updateExisting
        ? OFFER_MUTATION_MODE.UPDATE_EXISTING
        : (createNew ? OFFER_MUTATION_MODE.CREATE_NEW : mutationMode),
    };
  }

  // Offenes Angebot / Working Context
  if (offerTrackId) {
    const track = tracks.find((t) => t.id === offerTrackId)
      || listCustomerVehicleTracks(lead).find((t) => t.id === offerTrackId);
    if (track) {
      const modelKey = normalizeModelKey(track.config?.modelKey || track.modelLabel);
      return {
        status: OFFER_VEHICLE_TARGET_STATUS.RESOLVED,
        vehicleTrackId: track.id,
        createNew: false,
        modelKey,
        model: displayModel(modelKey || track.modelLabel),
        trim: track.config?.trimLabel || null,
        color: track.config?.colorLabel || track.config?.vehicleTrack?.preferredColor || null,
        label: track.displayName,
        source: 'open_offer',
        mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
      };
    }
  }

  // Working-Context attached vehicle ohne Track-Id
  const attached = workingContext?.attachedVehicle;
  if (attached?.modelKey) {
    const modelKey = normalizeModelKey(attached.modelKey);
    const match = tracks.find((t) => (
      normalizeModelKey(t.config?.modelKey || t.modelLabel) === modelKey
    ));
    return {
      status: OFFER_VEHICLE_TARGET_STATUS.RESOLVED,
      vehicleTrackId: match?.id || null,
      createNew: false,
      modelKey,
      model: displayModel(modelKey),
      trim: attached.trimId || attached.trim || null,
      color: attached.color || null,
      label: attached.label || displayModel(modelKey),
      source: 'working_attached_vehicle',
      mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
    };
  }

  // Klarer Fokus / aktiver Track
  if (focus) {
    const modelKey = normalizeModelKey(focus.config?.modelKey || focus.modelLabel);
    return {
      status: OFFER_VEHICLE_TARGET_STATUS.RESOLVED,
      vehicleTrackId: focus.id,
      createNew: false,
      modelKey,
      model: displayModel(modelKey || focus.modelLabel),
      trim: focus.config?.trimLabel || null,
      color: focus.config?.colorLabel
        || focus.config?.vehicleTrack?.preferredColor
        || null,
      label: focus.displayName,
      source: 'active_track',
      mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
    };
  }

  // Mehrere Spuren ohne Fokus → Clarification (kein Raten)
  if (tracks.length >= 2) {
    return {
      status: OFFER_VEHICLE_TARGET_STATUS.NEEDS_CLARIFICATION,
      vehicleTrackId: null,
      question: CLARIFY_VEHICLE_FOR_OFFER_PROMPT,
      choices: tracks.map(trackChoice),
      source: 'multi_track_no_focus',
      mutationMode,
    };
  }

  // Genau eine offene Spur
  if (tracks.length === 1) {
    const track = tracks[0];
    const modelKey = normalizeModelKey(track.config?.modelKey || track.modelLabel);
    return {
      status: OFFER_VEHICLE_TARGET_STATUS.RESOLVED,
      vehicleTrackId: track.id,
      createNew: false,
      modelKey,
      model: displayModel(modelKey || track.modelLabel),
      trim: track.config?.trimLabel || null,
      label: track.displayName,
      source: 'single_track',
      mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
    };
  }

  // Aktives Seller-Interest ohne Track-Shell
  const activeInterest = resolveActiveSellerModelInterest(lead);
  if (activeInterest?.modelKey) {
    return {
      status: OFFER_VEHICLE_TARGET_STATUS.RESOLVED,
      vehicleTrackId: null,
      createNew: false,
      modelKey: activeInterest.modelKey,
      model: activeInterest.model,
      trim: activeInterest.trim || null,
      label: activeInterest.label,
      source: 'active_seller_interest',
      mutationMode,
    };
  }

  return {
    status: OFFER_VEHICLE_TARGET_STATUS.UNRESOLVED,
    vehicleTrackId: null,
    question: 'Welches Modell soll angeboten werden?',
    choices: [],
    source: 'no_vehicle',
    mutationMode,
  };
}

/**
 * Ob Identity-Follow-up auf offenen Offer gebunden werden soll.
 */
export function shouldBindIdentityToOpenOffer({
  sellerInput = '',
  currentOfferContext = null,
  workingContext = null,
} = {}) {
  const hasOffer = Boolean(
    currentOfferContext?.offerId
    || currentOfferContext?.summary
    || currentOfferContext?.title
    || workingContext?.attachedVehicle
    || workingContext?.offer,
  );
  if (!hasOffer) return false;
  return Boolean(parseOfferIdentityFollowUp(sellerInput));
}
