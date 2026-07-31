/**
 * Globale Kundenauflösung für den Clever Composer (Slice 2).
 * Deterministisch über leadsSnapshot – kein OpenAI-Lookup.
 */
import {
  buildCustomerSearchResult,
  searchCustomers,
} from '../crm/customerSearchService.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
} from '../crm/vehicleTrack.js';
import { PAYMENT_TYPES } from '../../data/leadTypes.js';

const HONORIFIC = /^(herrn?|frau|fr\.?|hr\.?)$/i;
const STOP_NAME = /^(kunde|kundin|ihnen|mich|mir|heute|angebot|nachricht|termin|sportage|xceed|ev\d|picanto|kia|roten?|rote|ahk|anhänger)$/i;

/**
 * Kundennamen / Suchbegriff aus Seller-Input ziehen.
 * @param {string} sellerInput
 * @returns {{ nameQuery: string|null, raw: string }}
 */
export function extractCustomerNameQuery(sellerInput = '') {
  const raw = String(sellerInput || '').trim();
  if (!raw) return { nameQuery: null, raw: '' };

  const patterns = [
    /(?:^|[^\wäöüÄÖÜß])(?:öffne|zeige|zeig|finde|suche)\s+(?:den\s+|die\s+|das\s+)?(?:kunden?\s+)?(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\b(?:was\s+wollte|was\s+wünscht|wie\s+steht.?s\s+(?:bei|mit)|zusammenfassung\s+(?:für|von))\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\b(?:was\s+hatte\s+ich|was\s+habe\s+ich|wann\s+habe\s+ich)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\b(?:an|für|bei)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\b(?:herrn?\s+|frau\s+)([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1] && !HONORIFIC.test(m[1]) && !STOP_NAME.test(m[1])) {
      return { nameQuery: m[1], raw };
    }
  }

  // Einwort-Nachname nach „Öffne …“ ohne Großschreibung erzwingen
  const openLoose = raw.match(/(?:^|[^\wäöüÄÖÜß])(?:öffne|finde)\s+(?:den\s+|die\s+)?(?:kunden?\s+)?(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i);
  if (openLoose?.[1] && !HONORIFIC.test(openLoose[1]) && !STOP_NAME.test(openLoose[1])) {
    return { nameQuery: openLoose[1], raw };
  }

  return { nameQuery: null, raw };
}

/**
 * Attributsuche: Farbe / Modell / AHK aus Customer Truth / Tracks.
 * @param {string} sellerInput
 */
export function extractCustomerAttributeQuery(sellerInput = '') {
  const t = String(sellerInput || '').toLowerCase();
  const wantsCustomerFind = /\b(finde|suche|welcher\s+kunde|kunden?\s+mit)\b/i.test(t)
    || (/\bsportage\b/i.test(t) && /\b(ahk|rot|anhänger)/i.test(t) && !/\banhängelast\b/i.test(t));

  if (!wantsCustomerFind && !(/\bkunden?\b/i.test(t) && /\b(mit|und)\b/i.test(t))) {
    return null;
  }

  // Reine Fahrzeugfragen (Anhängelast etc.) nicht als Kundensuche
  if (/\banhängelast|reichweite|wltp|listenpreis\b/i.test(t) && !/\bkunden?\b/i.test(t)) {
    return null;
  }

  const colorMatch = t.match(/\b(rot(?:en|e|er)?|blau(?:en|e|er)?|schwarz(?:en|e|er)?|weiß(?:en|e|er)?|weiss(?:en|e|er)?|grau(?:en|e|er)?|grün(?:en|e|er)?|silber(?:n|ne)?)\b/i);
  const modelMatch = t.match(/\b(sportage|xceed|ceed|ev\s*[2-9]|ev9|picanto|niro|sorento|stonic|soul|tivoli)\b/i);
  const wantsAhk = /\bahk\b|anhängerkupplung|tow\s*hitch/i.test(t);

  if (!colorMatch && !modelMatch && !wantsAhk) return null;

  const colorRaw = colorMatch ? String(colorMatch[1]).toLowerCase() : null;
  let color = null;
  if (colorRaw?.startsWith('rot')) color = 'Rot';
  else if (colorRaw?.startsWith('weiss') || colorRaw?.startsWith('weiß')) color = 'Weiß';
  else if (colorRaw?.startsWith('blau')) color = 'Blau';
  else if (colorRaw?.startsWith('schwarz')) color = 'Schwarz';
  else if (colorRaw?.startsWith('grau')) color = 'Grau';
  else if (colorRaw?.startsWith('grün') || colorRaw?.startsWith('gruen')) color = 'Grün';
  else if (colorRaw?.startsWith('silber')) color = 'Silber';

  return {
    color,
    modelKey: modelMatch
      ? String(modelMatch[1]).replace(/\s+/g, '').toLowerCase()
      : null,
    ahk: wantsAhk,
  };
}

function normalizeColorToken(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

function trackMatchesAttributes(track = {}, attrs = {}) {
  const reasons = [];
  const modelKey = String(track.modelKey || track.model || '').toLowerCase().replace(/\s+/g, '');
  const color = track.preferredColor || track.vehicleTrack?.preferredColor || '';
  const reqs = [
    ...(track.customerRequirements || []),
    ...(track.requirementLabels || []),
    ...(track.vehicleTrack?.customerRequirements || []),
  ].map((r) => String(r).toLowerCase());

  if (attrs.modelKey) {
    if (modelKey.includes(attrs.modelKey) || attrs.modelKey.includes(modelKey)) {
      reasons.push(`Modell ${track.model || attrs.modelKey}`);
    } else {
      return null;
    }
  }

  if (attrs.color) {
    const wanted = normalizeColorToken(attrs.color);
    const have = normalizeColorToken(color);
    const inReqs = reqs.some((r) => normalizeColorToken(r).includes(wanted));
    if (have.includes(wanted) || wanted.includes(have) || inReqs) {
      reasons.push(`Farbe ${color || attrs.color}`);
    } else {
      return null;
    }
  }

  if (attrs.ahk) {
    const hasAhk = reqs.some((r) => /ahk|anhänger|tow/.test(r))
      || track.towHitchRequired === true
      || track.vehicleTrack?.towHitchRequired === true;
    if (hasAhk) reasons.push('AHK bestätigt');
    else return null;
  }

  return reasons.length ? reasons : null;
}

/**
 * @param {object[]} leads
 * @param {object} attrs
 * @param {{ limit?: number }} [options]
 */
export function findCustomersByAttributes(leads = [], attrs = {}, options = {}) {
  const limit = options.limit ?? 6;
  const results = [];
  for (const lead of leads) {
    const tracks = listCustomerVehicleTracks(lead) || [];
    const matchReasons = [];
    for (const track of tracks) {
      const reasons = trackMatchesAttributes(track, attrs);
      if (reasons) matchReasons.push(...reasons);
    }
    if (!matchReasons.length) continue;
    const base = buildCustomerSearchResult(lead);
    results.push({
      ...base,
      matchReasons: [...new Set(matchReasons)],
      matchReason: [...new Set(matchReasons)].join(' · '),
      sourceType: 'customer_truth',
      customerId: lead.id,
      lead,
    });
  }
  return results.slice(0, limit);
}

/**
 * @param {string} sellerInput
 * @param {object[]} leads
 * @param {{ limit?: number }} [options]
 */
export function resolveCustomersFromInput(sellerInput = '', leads = [], options = {}) {
  const limit = options.limit ?? 6;
  const attrs = extractCustomerAttributeQuery(sellerInput);
  if (attrs && (attrs.color || attrs.modelKey || attrs.ahk)) {
    const attrHits = findCustomersByAttributes(leads, attrs, { limit });
    if (attrHits.length) {
      return {
        ok: true,
        mode: 'attributes',
        status: attrHits.length === 1 ? 'unique' : 'ambiguous',
        nameQuery: null,
        attributes: attrs,
        results: attrHits,
        lead: attrHits.length === 1 ? attrHits[0].lead : null,
      };
    }
    return {
      ok: true,
      mode: 'attributes',
      status: 'none',
      nameQuery: null,
      attributes: attrs,
      results: [],
      lead: null,
      message: 'Ich habe dazu keinen passenden Kunden gefunden.',
    };
  }

  const { nameQuery } = extractCustomerNameQuery(sellerInput);
  if (!nameQuery) {
    return {
      ok: false,
      mode: 'name',
      status: 'missing_query',
      nameQuery: null,
      results: [],
      lead: null,
    };
  }

  const hits = searchCustomers(nameQuery, leads, { limit });
  const enriched = hits.map((hit) => {
    const lead = leads.find((l) => l.id === hit.leadId) || null;
    return {
      ...hit,
      matchReasons: [`Name passt zu „${nameQuery}“`],
      matchReason: `Name passt zu „${nameQuery}“`,
      sourceType: 'customer_truth',
      customerId: hit.leadId,
      lead,
    };
  });

  return {
    ok: true,
    mode: 'name',
    status: enriched.length === 0 ? 'none' : enriched.length === 1 ? 'unique' : 'ambiguous',
    nameQuery,
    results: enriched,
    lead: enriched.length === 1 ? enriched[0].lead : null,
    message: enriched.length === 0
      ? `Ich habe keinen Kunden zu „${nameQuery}“ gefunden.`
      : null,
  };
}

/**
 * Kompakte Kundenkarte für Review (ohne Offer-Werte als Truth).
 * @param {object} lead
 */
export function buildCustomerCardSummary(lead = {}) {
  if (!lead?.id) return null;
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead) || []);
  const payment = PAYMENT_TYPES[lead.paymentType]?.label
    || (lead.paymentType === 'leasing' ? 'Leasing' : null)
    || null;
  const vehicles = tracks.map((t) => {
    const label = t.model || t.modelKey || 'Fahrzeug';
    const status = t.status || t.vehicleTrack?.status || 'open';
    const statusLabel = status === 'favorite'
      ? 'Favorit'
      : status === 'deferred'
        ? 'zurückgestellt'
        : null;
    return {
      trackId: t.id,
      label,
      status,
      statusLabel,
      line: statusLabel ? `${label} ${statusLabel}` : label,
    };
  });

  const favorite = vehicles.find((v) => v.status === 'favorite');
  const deferred = vehicles.filter((v) => v.status === 'deferred');
  const requirements = [];
  for (const t of tracks) {
    for (const r of (t.customerRequirements || t.requirementLabels || [])) {
      if (r && !requirements.includes(r)) requirements.push(r);
    }
    if (t.preferredColor && !requirements.includes(t.preferredColor)) {
      requirements.push(t.preferredColor);
    }
  }

  return {
    customerId: lead.id,
    customerName: lead.contact?.name || lead.name || 'Kunde',
    paymentLabel: payment,
    vehicleCount: vehicles.length,
    vehicles,
    favoriteLine: favorite?.line || null,
    deferredLines: deferred.map((d) => d.line),
    requirementLabels: requirements.slice(0, 8),
    headline: [
      vehicles.length ? `${vehicles.length} Fahrzeug${vehicles.length === 1 ? '' : 'e'}` : null,
      payment,
    ].filter(Boolean).join(' · ') || null,
  };
}
