/**
 * Voller Akte-Kontext für Magic Message Payload (ohne Full-Lead-PII).
 */
import { buildCustomerUnderstanding } from '../../dealer/customerUnderstanding.js';
import { getSellerInsightsFromLead } from '../../dealer/sellerInsights.js';
import {
  listCustomerVehicleTracks,
  VEHICLE_TRACK_STATUS,
  VEHICLE_TRACK_STATUS_UI,
} from '../vehicleTrack.js';
import { resolveComposerShortcut } from '../composerSuggestionService.js';

/**
 * Chip-/Shortcut-Intent aus Seller-Input (Nachfassen, Kundenlink, …).
 * @param {string} rawSellerInput
 * @returns {string|null}
 */
export function detectChipIntent(rawSellerInput = '') {
  const raw = String(rawSellerInput || '').trim();
  if (!raw) return null;
  const shortcut = resolveComposerShortcut(raw);
  if (shortcut?.id) return shortcut.id;
  const t = raw.toLowerCase();
  if (/nachfass|follow[\s-]?up|nachhaken/.test(t)) return 'nachfassen';
  if (/kundenlink|portfolio|angebote per mail|link\s+senden/.test(t)) return 'kundenlink';
  if (/r[uü]ckfrage|nachfrage|offene\s+punkte/.test(t)) return 'rueckfrage';
  if (/danke|eingangsbestätigung|eingangsbestaetigung/.test(t)) return 'danke';
  if (/lieferzeit|verf[uü]gbar/.test(t)) return 'lieferzeit';
  if (/angebot\s+angepasst|anpassung/.test(t)) return 'angebot_angepasst';
  if (/\bangeb[o0]t[eo]?\b/.test(t) && /schreib|bereit|schick|mail|nachricht|senden|kunde/.test(t)) {
    return 'angebot';
  }
  if (/mail\s+an\s+(kunde|ihm|ihr|den\s+kunden)/.test(t) && /angeb|offer/.test(t)) return 'angebot';
  if (/selbstauskunft|unterlagen/.test(t)) return 'unterlagen';
  if (/termin|probefahrt/.test(t)) return /probefahrt/.test(t) ? 'probefahrt' : 'termin';
  return null;
}

function cleanModelLabel(value = '') {
  return String(value || '')
    .replace(/^kia\s+/i, '')
    .replace(/\s*·\s*.*$/, '')
    .trim();
}

/**
 * @param {object} lead
 * @returns {{ modelKey: string|null, modelLabel: string|null, source: string }|null}
 */
export function resolveCustomerInclination(lead = {}) {
  const tracks = listCustomerVehicleTracks(lead);
  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
  if (favorite) {
    return {
      modelKey: favorite.config?.modelKey || null,
      modelLabel: cleanModelLabel(favorite.displayName || favorite.modelLabel),
      source: 'favorite_track',
      status: VEHICLE_TRACK_STATUS.FAVORITE,
    };
  }

  try {
    const understanding = buildCustomerUnderstanding(lead);
    const vehicles = understanding?.verstaendnis?.vehicles ?? [];
    const labels = understanding?.verstaendnis?.labels ?? [];
    const leanLabel = labels.find((l) => /neigt|favorit|gefällt|bevorzug/i.test(String(l)));
    if (leanLabel) {
      const m = String(leanLabel).match(/\b(xceed|tivoli|sportage|picanto|niro|sorento|stonic|ceed|ev\s?[2-9])\b/i);
      return {
        modelKey: m?.[1] ? String(m[1]).toLowerCase().replace(/\s+/g, '') : null,
        modelLabel: cleanModelLabel(leanLabel),
        source: 'understanding_label',
        status: null,
      };
    }
    if (vehicles.length === 1) {
      return {
        modelKey: null,
        modelLabel: cleanModelLabel(vehicles[0]),
        source: 'understanding_vehicle',
        status: null,
      };
    }
  } catch {
    /* ignore */
  }

  const selected = lead?.crm?.needProfile?.selectedModelKey
    || lead?.crm?.needProfile?.modelHint
    || null;
  if (selected) {
    return {
      modelKey: String(selected).toLowerCase(),
      modelLabel: cleanModelLabel(selected),
      source: 'need_profile',
      status: null,
    };
  }

  return null;
}

/**
 * CLEVER-Zusammenfassung / Notizen (kurz, ohne PII).
 * @param {object} lead
 */
export function buildCleverSummaryNotes(lead = {}) {
  const notes = [];
  try {
    const understanding = buildCustomerUnderstanding(lead);
    const labels = (understanding?.verstaendnis?.labels ?? []).slice(0, 8);
    const concerns = (understanding?.verstaendnis?.concerns ?? []).slice(0, 4);
    const vehicles = (understanding?.verstaendnis?.vehicles ?? []).slice(0, 4);
    if (labels.length) notes.push(`Schwerpunkte: ${labels.join(', ')}`);
    if (concerns.length) notes.push(`Unsicherheiten: ${concerns.join(', ')}`);
    if (vehicles.length) notes.push(`Fahrzeuge im Blick: ${vehicles.join(', ')}`);
    const leadLine = understanding?.gespraechseinstieg?.lead;
    if (leadLine) notes.push(String(leadLine).slice(0, 200));
  } catch {
    /* ignore */
  }

  const insights = getSellerInsightsFromLead(lead)
    .slice(-4)
    .map((i) => String(i.text || '').trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 180));
  return {
    cleverSummary: notes.slice(0, 6).join(' · ').slice(0, 600) || null,
    customerNotes: insights,
  };
}

/**
 * Spuren kompakt für Magic.
 * @param {object} lead
 */
export function buildOpenVehicleTracksForMagic(lead = {}) {
  return listCustomerVehicleTracks(lead).slice(0, 8).map((track) => ({
    id: track.id,
    modelKey: track.config?.modelKey || null,
    modelLabel: cleanModelLabel(track.displayName || track.modelLabel),
    status: track.status,
    statusLabel: track.statusLabel
      || VEHICLE_TRACK_STATUS_UI[track.status]?.label
      || null,
    monthlyRate: track.monthlyRate ?? null,
    termMonths: track.termMonths ?? null,
    offerStatus: track.offerStatus ?? null,
  }));
}

/**
 * @param {object} params
 * @param {object} [params.lead]
 * @param {string} [params.rawSellerInput]
 * @param {object} [params.workingContext]
 * @param {object} [params.offerContext]
 * @param {object[]} [params.openVehicles]
 */
export function buildMagicAkteContext(params = {}) {
  const lead = params.lead || null;
  const rawSellerInput = String(params.rawSellerInput || '').trim();
  const chipIntent = detectChipIntent(rawSellerInput);
  const inclination = lead ? resolveCustomerInclination(lead) : null;
  const { cleverSummary, customerNotes } = lead
    ? buildCleverSummaryNotes(lead)
    : { cleverSummary: null, customerNotes: [] };
  const vehicleTracks = lead ? buildOpenVehicleTracksForMagic(lead) : [];

  const working = params.workingContext || null;
  const selectedChip = working
    ? {
      shortLabel: working.shortLabel || working.label || null,
      label: working.label || working.shortLabel || null,
      modelKey: working.modelKey || working.card?.modelKey || null,
      trimId: working.trimId || working.card?.trimId || null,
      offerId: working.offerId || null,
      color: working.color || working.card?.color || null,
    }
    : null;

  return {
    chipIntent,
    rawSellerInput: rawSellerInput.slice(0, 2000),
    cleverSummary,
    customerNotes,
    inclination,
    vehicleTracks,
    selectedWorkingChip: selectedChip,
    openVehicles: Array.isArray(params.openVehicles)
      ? params.openVehicles.slice(0, 8).map((v) => ({
        modelKey: v.modelKey || v.model || null,
        label: v.label || v.shortLabel || null,
        shortLabel: v.shortLabel || null,
        status: v.status || null,
        offerId: v.offerId || v.id || null,
        monthlyRate: v.monthlyRate ?? null,
        termMonths: v.termMonths ?? null,
        summary: v.summary || null,
      }))
      : [],
    offerContext: params.offerContext
      ? {
        offerId: params.offerContext.offerId || null,
        title: params.offerContext.title || null,
        monthlyRate: params.offerContext.monthlyRate ?? null,
        termMonths: params.offerContext.termMonths ?? null,
        mileagePerYear: params.offerContext.mileagePerYear ?? null,
        paymentType: params.offerContext.paymentType || null,
        summary: params.offerContext.summary
          ? String(params.offerContext.summary).slice(0, 240)
          : null,
      }
      : null,
  };
}
