/**
 * Natürliche Bezüge auf Angebote in der Kundenakte auflösen.
 * z. B. „das neue Sportage-Angebot“, „152,36 €“, „beide offenen Angebote“.
 */
import { parseGermanMoney } from '../dealer/parseGermanMoney.js';
import { listCustomerVehicleTracks, sortTracksForOverview } from './vehicleTrack.js';

function normalize(text = '') {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/€/g, ' euro ')
    .replace(/[,.]/g, (m) => (m === ',' ? '.' : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function rateClose(a, b, epsilon = 0.51) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= epsilon;
}

function trackMatchesModel(track, needle) {
  if (!needle) return true;
  const hay = normalize(`${track.modelLabel || ''} ${track.displayName || ''} ${track.vehicleKey || ''}`);
  return hay.includes(needle);
}

function extractModelNeedle(text) {
  const n = normalize(text);
  const models = [
    'sportage', 'xceed', 'ceed', 'tivoli', 'ev3', 'ev4', 'ev5', 'ev6', 'ev9',
    'niro', 'picanto', 'stonic', 'sorento', 'soul', 'carnival',
  ];
  return models.find((m) => new RegExp(`\\b${m}\\b`).test(n)) || null;
}

function extractMoneyHints(text) {
  const raw = String(text ?? '');
  const hints = [];
  const re = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:€|euro)?/gi;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const parsed = parseGermanMoney(m[1]);
    if (parsed != null && Number.isFinite(parsed) && parsed > 0) {
      hints.push(parsed);
    }
  }
  return hints;
}

function extractKmHint(text) {
  const m = String(text ?? '').match(/(\d{1,3}(?:\.\d{3})?)\s*(?:km|kilometer)/i);
  if (!m) return null;
  return parseGermanMoney(m[1]);
}

function extractTermHint(text) {
  const m = String(text ?? '').match(/(\d{1,2})\s*(?:monate|monat|m\b)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function scoreTrack(track, {
  modelNeedle,
  moneyHints,
  kmHint,
  termHint,
  preferNewest,
  preferOpen,
}) {
  let score = 0;
  if (modelNeedle && trackMatchesModel(track, modelNeedle)) score += 40;
  else if (modelNeedle) score -= 20;

  for (const money of moneyHints) {
    if (rateClose(track.monthlyRate, money)) score += 50;
    if (rateClose(track.downPayment, money)) score += 35;
  }

  if (kmHint != null && Number(track.annualMileage) === Number(kmHint)) score += 25;
  if (termHint != null && Number(track.termMonths) === Number(termHint)) score += 20;

  if (preferOpen && track.status !== 'deferred' && track.status !== 'lost') score += 8;
  if (preferNewest && track.lastActivityAt) {
    const age = Date.now() - new Date(track.lastActivityAt).getTime();
    if (Number.isFinite(age) && age < 1000 * 60 * 60 * 24) score += 15;
    else if (Number.isFinite(age) && age < 1000 * 60 * 60 * 24 * 7) score += 6;
  }

  return score;
}

/**
 * @param {object} lead
 * @param {string} text
 * @returns {{
 *   status: 'none'|'resolved'|'ambiguous',
 *   tracks: object[],
 *   question: string|null,
 *   options: Array<{ id: string, label: string, detail: string }>,
 * }}
 */
export function resolveOfferReferenceFromText(lead = {}, text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) {
    return { status: 'none', tracks: [], question: null, options: [] };
  }

  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  if (!tracks.length) {
    return { status: 'none', tracks: [], question: null, options: [] };
  }

  const n = normalize(raw);
  const mentionsOffer = /\bangebot|\bangebote|\brate\b|\bleasing\b|\bkundenlink\b|\bvergleich/i.test(raw)
    || /\bsportage|\bxceed|\btivoli|\bev\d\b/i.test(raw);
  if (!mentionsOffer && !/\d+[,.]?\d*\s*€/.test(raw)) {
    return { status: 'none', tracks: [], question: null, options: [] };
  }

  const modelNeedle = extractModelNeedle(raw);
  const moneyHints = extractMoneyHints(raw);
  const kmHint = extractKmHint(raw);
  const termHint = extractTermHint(raw);
  const preferNewest = /\bneuest|\bneue[snr]?\b|\bgerade\b|\bfrisch\b/.test(n);
  const preferOpen = /\boffen|\baktive?\b|\bvorbereitet/.test(n);
  const wantBoth = /\bbeide|\balle\b|\bmehrere/.test(n);
  const wantLastTwo = /\b(letzten|letzte)\s+(beiden|zwei)\b|\bbeiden\s+letzten/.test(n);

  const scored = tracks
    .map((track) => ({
      track,
      score: scoreTrack(track, {
        modelNeedle,
        moneyHints,
        kmHint,
        termHint,
        preferNewest,
        preferOpen,
      }),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || String(b.track.lastActivityAt || '').localeCompare(String(a.track.lastActivityAt || '')));

  if (wantLastTwo || (wantBoth && scored.length >= 2)) {
    const picked = (preferNewest
      ? [...tracks].sort((a, b) => String(b.lastActivityAt || '').localeCompare(String(a.lastActivityAt || '')))
      : scored.map((s) => s.track)
    ).slice(0, 2);
    if (picked.length >= 2) {
      return {
        status: 'resolved',
        tracks: picked,
        question: null,
        options: picked.map(toOption),
      };
    }
  }

  if (!scored.length) {
    const modelTracks = modelNeedle
      ? tracks.filter((t) => trackMatchesModel(t, modelNeedle))
      : [];
    if (modelTracks.length > 1) {
      return {
        status: 'ambiguous',
        tracks: modelTracks,
        question: `Welches ${capitalize(modelNeedle)}-Angebot meinst du?`,
        options: modelTracks.map(toOption),
      };
    }
    if (modelTracks.length === 1) {
      return {
        status: 'resolved',
        tracks: modelTracks,
        question: null,
        options: modelTracks.map(toOption),
      };
    }
    return { status: 'none', tracks: [], question: null, options: [] };
  }

  const top = scored[0];
  const close = scored.filter((s) => s.score >= top.score - 8 && s.score >= 30);

  if (close.length > 1 && !preferNewest && moneyHints.length === 0) {
    return {
      status: 'ambiguous',
      tracks: close.map((c) => c.track),
      question: modelNeedle
        ? `Welches ${capitalize(modelNeedle)}-Angebot meinst du?`
        : 'Welches Angebot meinst du?',
      options: close.map((c) => toOption(c.track)),
    };
  }

  if (preferNewest && modelNeedle) {
    const modelTracks = tracks
      .filter((t) => trackMatchesModel(t, modelNeedle))
      .sort((a, b) => String(b.lastActivityAt || '').localeCompare(String(a.lastActivityAt || '')));
    if (modelTracks[0]) {
      return {
        status: 'resolved',
        tracks: [modelTracks[0]],
        question: null,
        options: [toOption(modelTracks[0])],
      };
    }
  }

  if (top.score < 25) {
    return { status: 'none', tracks: [], question: null, options: [] };
  }

  return {
    status: 'resolved',
    tracks: [top.track],
    question: null,
    options: [toOption(top.track)],
  };
}

function toOption(track) {
  const rate = track.monthlyRate != null
    ? `${Number(track.monthlyRate).toLocaleString('de-DE')} €`
    : null;
  const term = track.termMonths != null ? `${track.termMonths} Monate` : null;
  const detail = [rate, term].filter(Boolean).join(' · ') || track.offerStatus || '';
  return {
    id: track.id,
    label: track.displayName || track.modelLabel || 'Angebot',
    detail,
    monthlyRate: track.monthlyRate ?? null,
    termMonths: track.termMonths ?? null,
  };
}

function capitalize(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Track → Card-Shape für Working Context / Workspace.
 */
export function trackToComposerCard(track) {
  if (!track) return null;
  return {
    ...(track.config || {}),
    id: track.id,
    vehicleOffer: track.vehicleOffer,
    desiredRate: track.monthlyRate,
    termMonths: track.termMonths,
    mileagePerYear: track.annualMileage,
    downPayment: track.downPayment,
    paymentType: track.config?.paymentType,
  };
}
