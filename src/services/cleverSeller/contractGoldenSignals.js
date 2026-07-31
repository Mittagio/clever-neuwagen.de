/**
 * Contract Golden Signals – erklärbare Horizonte aus bestätigten Altverträgen.
 * Keine zweite Reminder-Engine; speist bestehende Journey-/Golden-Moment-Logik.
 */
import { listCustomerContracts } from '../crm/customerContracts.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';

export const CONTRACT_HORIZON = {
  M12: 12,
  M6: 6,
  M3: 3,
};

/**
 * Primärer bestätigter Vertrag (nächstes Vertragsende zuerst).
 * @param {object} lead
 */
export function getPrimaryCustomerContract(lead = {}) {
  const list = listCustomerContracts(lead)
    .filter((c) => c && (c.status === 'confirmed' || !c.status) && c.dates?.contractEndDate);
  if (!list.length) return null;
  return [...list].sort((a, b) => (
    String(a.dates.contractEndDate).localeCompare(String(b.dates.contractEndDate))
  ))[0];
}

/**
 * Vertragsende: Contract Record > wish.leasingEndDate > Fallbacks.
 * @param {object} lead
 * @returns {string|null} ISO date (YYYY-MM-DD or ISO string)
 */
export function resolveContractEndDate(lead = {}) {
  const primary = getPrimaryCustomerContract(lead);
  if (primary?.dates?.contractEndDate) return primary.dates.contractEndDate;

  const raw = lead?.wish?.leasingEndDate
    ?? lead?.leasingEndDate
    ?? lead?.crm?.leasingEndDate
    ?? null;
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(String(raw))) return String(raw).slice(0, 10);
  if (/^\d{4}-\d{2}/.test(String(raw))) return String(raw);
  return String(raw);
}

/**
 * @param {string} iso
 * @param {Date} [now]
 * @returns {number|null}
 */
export function monthsUntilContractEnd(iso, now = new Date()) {
  if (!iso) return null;
  let end;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
    const [y, m, d] = String(iso).split('-').map(Number);
    end = new Date(y, m - 1, d || 1);
  } else {
    end = new Date(iso);
  }
  if (Number.isNaN(end.getTime())) return null;
  const n = now instanceof Date ? now : new Date(now);
  return (end.getFullYear() - n.getFullYear()) * 12 + (end.getMonth() - n.getMonth());
}

function formatDeDate(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    try {
      return new Date(iso).toLocaleDateString('de-DE');
    } catch {
      return String(iso);
    }
  }
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/**
 * Prüft, ob zum Favoriten bereits ein „passendes“ Nachfolgeangebot existiert.
 * Konservativ: Favorit ohne Angebots-Sent/Opened oder mit offenen Requirements → fehlt.
 */
export function isFollowUpOfferMissing(lead = {}, favorite = null) {
  if (!favorite) return false;
  const reqs = favorite.requirementLabels ?? [];
  const hasLiveOffer = Boolean(
    favorite.sentAt
    || favorite.offerStatus === 'sent'
    || favorite.offerStatus === 'opened'
    || favorite.offerStatus === 'accepted',
  );
  if (!hasLiveOffer) return true;
  if (reqs.length > 0) return true;
  return false;
}

/**
 * @param {object} lead
 * @param {{ now?: Date|string|number }} [options]
 */
export function evaluateContractGoldenSignals(lead = {}, options = {}) {
  const now = options.now != null ? new Date(options.now) : new Date();
  const contract = getPrimaryCustomerContract(lead);
  const endDate = resolveContractEndDate(lead);
  const months = monthsUntilContractEnd(endDate, now);

  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE) || null;

  if (months == null || months < 0) {
    return {
      ok: Boolean(contract || endDate),
      contract,
      endDate,
      endDateLabel: formatDeDate(endDate),
      monthsUntil: months,
      within12m: false,
      within6m: false,
      within3m: false,
      needsMileageCheck: false,
      needsReturnPrep: false,
      favorite,
      followUpOfferMissing: false,
      reasons: [],
      active: false,
    };
  }

  const within12m = months <= CONTRACT_HORIZON.M12;
  const within6m = months <= CONTRACT_HORIZON.M6;
  const within3m = months <= CONTRACT_HORIZON.M3;
  const followUpOfferMissing = Boolean(favorite && isFollowUpOfferMissing(lead, favorite));

  const reasons = [];
  if (within12m && endDate) {
    reasons.push(`Vertrag endet in ${months} Monat${months === 1 ? '' : 'en'} (${formatDeDate(endDate)})`);
  }
  if (within6m) reasons.push('Kilometerstand sollte geprüft werden');
  if (within3m) reasons.push('Rückgabe muss vorbereitet werden');
  if (favorite) {
    reasons.push(`Fahrzeuginteresse: ${favorite.modelLabel}`);
    if (followUpOfferMissing) reasons.push('Noch kein passendes Nachfolgeangebot');
  }

  return {
    ok: true,
    contract,
    endDate,
    endDateLabel: formatDeDate(endDate),
    monthsUntil: months,
    within12m,
    within6m,
    within3m,
    needsMileageCheck: within6m,
    needsReturnPrep: within3m,
    favorite,
    followUpOfferMissing,
    reasons,
    active: within12m,
    source: contract ? 'customer_contract' : 'wish_projection',
  };
}

/**
 * Body-Zeilen für Golden-Moment / Review (keine Kaufwahrscheinlichkeit).
 */
export function buildContractGoldenBodyLines(lead = {}, signals = null, options = {}) {
  const s = signals || evaluateContractGoldenSignals(lead, options);
  if (!s?.active || !s.endDateLabel) return [];

  const customerName = lead?.contact?.name || lead?.name || 'Der Kunde';
  const lines = [
    `Der Leasingvertrag von ${customerName} endet am ${s.endDateLabel}.`,
  ];
  if (s.favorite) {
    lines.push(`Er tendiert aktuell zum ${s.favorite.modelLabel}.`);
    const reqs = s.favorite.requirementLabels || [];
    if (reqs.length) {
      lines.push(`${reqs.join(' und ')} sind ihm wichtig.`);
    }
  }
  if (s.followUpOfferMissing) {
    lines.push('Es liegt noch kein passendes Nachfolgeangebot vor.');
  } else if (s.needsReturnPrep) {
    lines.push('Die Rückgabe sollte vorbereitet werden.');
  } else if (s.needsMileageCheck) {
    lines.push('Der Kilometerstand sollte geprüft werden.');
  }
  return lines;
}
