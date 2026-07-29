/**
 * Clever-Suche im Composer + klassische Akte-Suche (Header).
 * Durchsucht nur den aktuellen Kundenvorgang.
 */
import { MESSAGE_KIND } from './customerMessageService.js';
import { buildSharedWorkspaceTimeline } from './sharedWorkspaceService.js';
import {
  buildVehicleOpportunityCards,
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
} from '../customerAkte.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';

const SEARCH_PATTERNS = [
  /was\s+habe\s+ich\b/i,
  /welche[snr]?\s+angebot/i,
  /wo\s+(?:steht|habe|find)/i,
  /(?:finde|such(?:e|en)?|zeig(?:e|en)?)\b/i,
  /wann\s+(?:habe|wurde|hast)\b/i,
  /damals\b/i,
  /nochmal\b.*(?:geschrieben|gesagt|geschickt)/i,
];

const NOISE_WORDS = new Set([
  'was', 'habe', 'ich', 'ihr', 'ihm', 'der', 'die', 'das', 'dem', 'den', 'des',
  'und', 'oder', 'mit', 'für', 'von', 'vom', 'zur', 'zum', 'bei', 'noch',
  'mal', 'bitte', 'mir', 'uns', 'ein', 'eine', 'einer', 'eines', 'einem',
  'geschrieben', 'gesagt', 'geschickt', 'gesendet', 'gefunden', 'finde',
  'suche', 'suchen', 'zeige', 'zeigen', 'welches', 'welche', 'welcher',
  'angebot', 'angebote', 'nachricht', 'nachrichten', 'damals', 'wegen',
  'frau', 'herr', 'kunde', 'kundin',
]);

/**
 * @param {string} text
 */
export function isComposerAkteSearchQuery(text = '') {
  const t = String(text ?? '').trim();
  if (!t || t.length < 8 || t.length > 180) return false;
  return SEARCH_PATTERNS.some((re) => re.test(t));
}

/**
 * @param {string} text
 * @param {{ freeText?: boolean }} [options]
 * @returns {string[]}
 */
export function extractAkteSearchTerms(text = '', options = {}) {
  const freeText = options.freeText === true;
  const raw = String(text ?? '')
    .toLowerCase()
    .replace(/[?!.,;:„“"']/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= (freeText ? 2 : 3) && (freeText || !NOISE_WORDS.has(w)));
  const unique = [...new Set(raw)].slice(0, 8);
  if (unique.length) return unique;
  if (freeText) {
    const fallback = String(text ?? '').toLowerCase().trim();
    return fallback.length >= 2 ? [fallback] : [];
  }
  return [];
}

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function scoreText(haystack, terms) {
  const h = String(haystack || '').toLowerCase();
  if (!h || !terms.length) return 0;
  let score = 0;
  for (const term of terms) {
    if (h.includes(term)) score += term.length >= 5 ? 3 : 2;
  }
  return score;
}

function collectNoteHits(lead = {}, terms = []) {
  const notes = lead?.crm?.kundenhelfer?.conversationNotes
    ?? lead?.crm?.kundenhelfer?.notes
    ?? [];
  const list = Array.isArray(notes) ? notes : [];
  const hits = [];
  for (const note of list) {
    const text = typeof note === 'string' ? note : String(note?.text ?? note?.body ?? '');
    const score = scoreText(text, terms);
    if (score <= 0) continue;
    hits.push({
      kind: 'note',
      score,
      id: note?.id || `note-${hits.length}`,
      when: note?.createdAt || null,
      whenLabel: formatWhen(note?.createdAt),
      title: 'Notiz',
      snippet: text.trim().slice(0, 220),
      offerId: null,
      messageKind: null,
    });
  }
  return hits;
}

/**
 * Freitext-Suche im aktuellen Vorgang (Header & Composer).
 * @param {object} lead
 * @param {string} query
 * @param {{ limit?: number, freeText?: boolean }} [options]
 */
export function searchAkteByQuery(lead = {}, query = '', options = {}) {
  const q = String(query ?? '').trim();
  const limit = options.limit ?? 12;
  const freeText = options.freeText !== false;
  if (!q) return { ok: false, hits: [], terms: [] };

  const terms = extractAkteSearchTerms(q, { freeText });
  if (!terms.length) return { ok: true, hits: [], terms: [] };

  const timeline = buildSharedWorkspaceTimeline(lead, { role: 'seller' });
  const messageHits = [];
  for (const item of timeline.items ?? []) {
    const blob = [
      item.text,
      item.payload?.title,
      item.payload?.subtitle,
      item.payload?.rateLine,
      item.senderLabel,
    ].filter(Boolean).join(' ');
    const score = scoreText(blob, terms);
    if (score <= 0) continue;
    messageHits.push({
      kind: 'message',
      score,
      id: item.id,
      when: item.createdAt,
      whenLabel: formatWhen(item.createdAt),
      title: item.kind === MESSAGE_KIND.OFFER_CARD
        ? (item.payload?.title || 'Angebot')
        : (item.senderLabel || 'Nachricht'),
      snippet: String(item.text || item.payload?.title || '').trim().slice(0, 220),
      offerId: item.relatedOfferId || item.payload?.offerId || null,
      messageKind: item.kind,
    });
  }

  const offerHits = [];
  let cards = [];
  try {
    cards = buildVehicleOpportunityCards({ lead, wishFields: lead?.wish ?? {} }) ?? [];
  } catch {
    cards = [];
  }
  for (const card of cards) {
    const title = formatVehicleCardTitle(card);
    const blob = [
      title,
      formatVehicleCardConditions(card),
      formatVehicleCardPrice(card),
      card.modelKey,
      card.trimLabel,
    ].filter(Boolean).join(' ');
    const score = scoreText(blob, terms);
    const bonus = /angebot/i.test(q) ? 2 : 0;
    if (score + bonus <= 0) continue;
    offerHits.push({
      kind: 'offer',
      score: score + bonus + 1,
      id: card.id,
      offerId: card.id,
      title,
      snippet: [formatVehicleCardConditions(card), formatVehicleCardPrice(card)]
        .filter(Boolean)
        .join(' · '),
      when: card.updatedAt || card.createdAt || null,
      whenLabel: formatWhen(card.updatedAt || card.createdAt),
      messageKind: null,
    });
  }

  const hits = [...messageHits, ...offerHits, ...collectNoteHits(lead, terms)]
    .sort((a, b) => b.score - a.score || new Date(b.when || 0) - new Date(a.when || 0))
    .slice(0, limit);

  return { ok: true, hits, terms };
}

function buildSearchAssistFromHits(hits = [], terms = []) {
  if (!hits.length) {
    return {
      ok: true,
      mode: 'search',
      results: [{
        type: INLINE_RESULT_TYPES.SEARCH_HIT,
        title: '✨ Nichts gefunden',
        body: terms.length
          ? `Im Verlauf dieses Vorgangs nichts Passendes zu „${terms.join(' ')}“.`
          : 'Bitte etwas Konkreteres nennen – z. B. „Lieferzeit“ oder „EV4“.',
        primaryCta: null,
        secondaryCta: null,
        hits: [],
        searchTerms: terms,
      }],
    };
  }

  const top = hits[0];
  const lines = hits.map((hit) => {
    const when = hit.whenLabel ? `${hit.whenLabel}\n` : '';
    return `${when}„${hit.snippet || hit.title}“`;
  });
  const openOffer = hits.find((h) => h.offerId);

  return {
    ok: true,
    mode: 'search',
    results: [{
      type: INLINE_RESULT_TYPES.SEARCH_HIT,
      title: hits.length === 1 ? '✨ Gefunden' : `✨ ${hits.length} Treffer`,
      headline: top.title,
      body: lines.join('\n\n'),
      primaryCta: openOffer ? 'Angebot öffnen' : null,
      secondaryCta: null,
      offerId: openOffer?.offerId || null,
      messageId: top.kind === 'message' ? top.id : null,
      hits,
      searchTerms: terms,
    }],
  };
}

/**
 * @param {object} lead
 * @param {string} sellerInput
 * @param {{ customerName?: string }} [options]
 */
export function runComposerAkteSearch(lead = {}, sellerInput = '', options = {}) {
  void options;
  const query = String(sellerInput ?? '').trim();
  if (!isComposerAkteSearchQuery(query)) {
    return { ok: false, results: [] };
  }

  const terms = extractAkteSearchTerms(query);
  if (!terms.length) {
    return buildSearchAssistFromHits([], []);
  }

  const found = searchAkteByQuery(lead, query, { limit: 4, freeText: false });
  return buildSearchAssistFromHits(found.hits, found.terms.length ? found.terms : terms);
}
