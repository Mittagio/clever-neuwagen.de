/**
 * Seller Offer Assist – Inline Angebot vorbereiten aus natürlicher Sprache.
 * Wiederverwendet Magic Offer + Customer Understanding / Wish – keine neue Offer-Engine.
 */
import { buildAttributedWishChips } from './customerUnderstanding.js';
import { detectSellerActionIntent, SELLER_ACTION_INTENTS } from './sellerActionIntent.js';
import {
  applyMagicOfferCorrection,
  prepareMagicOffer,
  MAGIC_DECISION,
} from './magicOfferService.js';
import { getVerifiedVehicleFacts } from '../clever/openai/tools/getVerifiedVehicleFacts.js';
import { INLINE_RESULT_TYPES } from './sellerInlineComposerAssist.js';

const AHK_RE = /ahk|anhänger|anhanger|kupplung|zuglast|schwenkbar/i;
const PROBEFAHRT_RE = /probefahrt|termin|rückruf|anrufen|bestätig/i;

function customerDisplayName(lead = {}) {
  const raw = lead?.name
    || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ')
    || lead?.crm?.customerName
    || '';
  return String(raw).trim() || 'Kunde';
}

function resolveModelKey(lead = {}, magic = null) {
  return magic?.grounded?.modelKey
    || lead?.crm?.needProfile?.selectedModelKey
    || lead?.wish?.modelKey
    || null;
}

/**
 * Kundenseitige Konditionen in den Freitext übernehmen,
 * damit Clever Laufzeit/km/AZ nicht erneut fragt.
 */
export function enrichOfferTextWithCustomerWish(lead = {}, text = '') {
  const wish = lead?.wish ?? {};
  const need = lead?.crm?.needProfile ?? {};
  const parts = [String(text ?? '').trim()];
  const blob = parts[0].toLowerCase();

  const term = wish.termMonths ?? need.leaseDurationMonths ?? null;
  const km = wish.mileagePerYear ?? need.annualKm ?? null;
  const down = wish.downPayment ?? need.budget?.downPayment;
  const payment = lead?.paymentType ?? wish.paymentType ?? need.paymentType ?? null;

  if (term && !/\b(24|36|48|60)\s*monate?\b/i.test(blob)) {
    parts.push(`${term} Monate`);
  }
  if (km && !/\b\d{1,3}(?:[.\s]\d{3})*\s*km\b/i.test(blob)) {
    parts.push(`${Number(km).toLocaleString('de-DE')} km/Jahr`);
  }
  if (down != null && String(down).trim() !== '' && !/anzahlung|sonderzahlung/i.test(blob)) {
    parts.push(`${Number(down) === 0 ? 'keine' : Number(down).toLocaleString('de-DE')} € Anzahlung`);
  }
  if (/leasing/i.test(blob) === false && payment === 'leasing' && /angebot|vorbereiten|erstellen/i.test(blob)) {
    parts.push('Leasing');
  }
  if (/kauf|barangebot|barkauf/i.test(blob) === false && payment === 'cash' && /angebot|vorbereiten|erstellen/i.test(blob)) {
    parts.push('Kauf');
  }

  return parts.filter(Boolean).join(', ');
}

export function isOfferAssistFollowUp(text = '', previousPreparation = null) {
  if (!previousPreparation) return false;
  const t = String(text ?? '').trim();
  if (!t) return false;
  if (detectSellerActionIntent(t) === SELLER_ACTION_INTENTS.PREPARE_OFFER) return true;
  if (/^\d{1,2}\s*(?:%|prozent)?$/i.test(t)) return true;
  if (/^(ja|nein|mit|ohne)\b/i.test(t)) return true;
  if (/\b(rabatt|prozent|rate|€|euro|drive\s*wise|ahk|anhäng|leasing|kauf|finanz)\b/i.test(t)) {
    return t.length <= 80;
  }
  return false;
}

function findAhkWish(lead = {}) {
  const chips = buildAttributedWishChips(lead) ?? [];
  return chips.find((c) => AHK_RE.test(c.label)) ?? null;
}

function buildAhkRelevance(lead, magic) {
  if (PROBEFAHRT_RE.test(magic?.intent?.rawText ?? '')) return null;
  const wish = findAhkWish(lead);
  if (!wish) return null;

  const modelKey = resolveModelKey(lead, magic);
  let towLabel = null;
  if (modelKey) {
    const verified = getVerifiedVehicleFacts({
      modelKey,
      requestedFacts: ['towingCapacity'],
    });
    const fact = verified.facts?.find((f) => f.key === 'towingCapacity');
    if (fact?.value != null) {
      towLabel = `${Number(fact.value).toLocaleString('de-DE')} kg`;
    }
  }

  return {
    label: wish.label,
    towingCapacityLabel: towLabel,
    modelKey,
    verified: Boolean(towLabel),
  };
}

function paymentLabel(type) {
  if (type === 'purchase' || type === 'cash') return 'Kauf';
  if (type === 'leasing') return 'Leasing';
  if (type === 'financing') return 'Finanzierung';
  return null;
}

function summarizeKnown(magic = {}, inherited = []) {
  const lines = [];
  const g = magic.grounded;
  if (g) {
    const title = [`Kia ${g.model}`, g.trimLabel].filter(Boolean).join(' ');
    if (title) lines.push(title);
    if (g.colorLabel) lines.push(g.colorLabel);
  }
  const pay = paymentLabel(magic.intent?.offerType || magic.paymentType);
  if (pay) lines.push(pay);
  const c = magic.intent?.commercialInput ?? {};
  if (c.discountPercent != null) lines.push(`${c.discountPercent} % Rabatt`);
  if (c.monthlyRate != null) lines.push(`${Number(c.monthlyRate).toLocaleString('de-DE')} €/Monat`);
  if (c.durationMonths != null) lines.push(`${c.durationMonths} Monate`);
  if (c.annualMileageKm != null) {
    lines.push(`${Number(c.annualMileageKm).toLocaleString('de-DE')} km/Jahr`);
  }
  for (const item of inherited) {
    if (item?.label && !lines.some((l) => l === item.label)) lines.push(item.label);
  }
  return lines.slice(0, 6);
}

function buildInheritedFromLead(lead = {}) {
  const wish = lead?.wish ?? {};
  const need = lead?.crm?.needProfile ?? {};
  const inherited = [];
  const km = wish.mileagePerYear ?? need.annualKm ?? null;
  const down = wish.downPayment ?? need.budget?.downPayment;
  const term = wish.termMonths ?? need.leaseDurationMonths ?? null;
  if (term) inherited.push({ label: `${term} Monate`, source: 'customer_need' });
  if (km) inherited.push({ label: `${Number(km).toLocaleString('de-DE')} km/Jahr`, source: 'customer_need' });
  if (down != null && String(down).trim() !== '') {
    inherited.push({
      label: Number(down) === 0 ? '0 € Anzahlung' : `Anzahlung ${Number(down).toLocaleString('de-DE')} €`,
      source: 'customer_need',
    });
  }
  return inherited;
}

function buildChoicesForDecision(magic = {}) {
  const decision = magic.decision ?? {};
  if (decision.action === MAGIC_DECISION.ASK_OFFER_TYPE) {
    return [
      { id: 'purchase', label: 'Kauf', insertText: 'Kauf' },
      { id: 'leasing', label: 'Leasing', insertText: 'Leasing' },
      { id: 'financing', label: 'Finanzierung', insertText: 'Finanzierung' },
    ];
  }
  if (decision.reason === 'missing_discount' || /rabatt/i.test(decision.message ?? '')) {
    return [
      { id: 'd15', label: '15 %', insertText: '15 %' },
      { id: 'd20', label: '20 %', insertText: '20 %' },
      { id: 'd21', label: '21 %', insertText: '21 %' },
    ];
  }
  if (decision.action === MAGIC_DECISION.ASK_RATE) {
    return [];
  }
  return [];
}

/**
 * @returns {{ ok: boolean, results: object[], previousPreparation: object|null, mode: string }|null}
 */
export function runSellerOfferAssist(lead = {}, draftText = '', options = {}) {
  const text = String(draftText ?? '').trim();
  if (!text || text.length < 3) return null;

  const previous = options.previousPreparation ?? null;
  const intent = detectSellerActionIntent(text);
  const followUp = isOfferAssistFollowUp(text, previous);

  if (intent !== SELLER_ACTION_INTENTS.PREPARE_OFFER && !followUp) {
    return null;
  }

  // Probefahrt etc. → kein Offer-Flow (AHK nicht reinmischen)
  if (PROBEFAHRT_RE.test(text) && !followUp) {
    return null;
  }

  const modelKey = resolveModelKey(lead, previous);
  const enriched = followUp
    ? text
    : enrichOfferTextWithCustomerWish(lead, text);

  const magic = followUp && previous
    ? applyMagicOfferCorrection(previous, text, { modelKey })
    : prepareMagicOffer(enriched, {
      modelKey,
      previousPreparation: previous ?? undefined,
    });

  const inherited = buildInheritedFromLead(lead);
  const known = summarizeKnown(magic, inherited);
  const ahk = buildAhkRelevance(lead, magic);
  const choices = buildChoicesForDecision(magic);
  const name = customerDisplayName(lead);

  const openParts = [];
  if (magic.decision?.message) openParts.push(magic.decision.message);
  if (magic.decision?.reason === 'missing_discount') openParts.push('Rabatt');
  if (magic.decision?.action === MAGIC_DECISION.ASK_RATE) openParts.push('Rate');
  if (magic.decision?.action === MAGIC_DECISION.ASK_OFFER_TYPE) openParts.push('Angebotsart');

  const bodyLines = [];
  if (known.length) bodyLines.push(known.join(' · '));
  if (inherited.length && !followUp) {
    bodyLines.push(`Aus Notizzettel: ${inherited.map((i) => i.label).join(' · ')}`);
  }
  if (openParts.length && !magic.canCreateOffer) {
    bodyLines.push(`Noch offen: ${[...new Set(openParts)].join(' · ')}`);
  }
  if (ahk) {
    bodyLines.push(
      ahk.towingCapacityLabel
        ? `Für ${name} relevant: ${ahk.label} · Anhängelast ${ahk.towingCapacityLabel}`
        : `Für ${name} relevant: ${ahk.label}`,
    );
  }
  if (magic.canCreateOffer && magic.calculation?.endPrice != null) {
    bodyLines.push(`Endpreis ${Number(magic.calculation.endPrice).toLocaleString('de-DE')} €`);
  }

  const result = {
    type: INLINE_RESULT_TYPES.OFFER_DRAFT,
    title: magic.canCreateOffer ? '✨ Angebot bereit' : '✨ Clever bereitet vor',
    headline: magic.headline || known[0] || 'Angebot',
    body: bodyLines.filter(Boolean).join('\n'),
    hint: magic.canCreateOffer
      ? null
      : (magic.decision?.message || 'Sag Clever den fehlenden Wert – z. B. „21 %“.'),
    magic,
    inheritedFromCustomer: inherited,
    ahkRelevance: ahk,
    choices,
    primaryCta: magic.canCreateOffer ? 'Angebot vorbereiten' : null,
    secondaryCta: ahk?.towingCapacityLabel ? 'Anhängelast erwähnen' : null,
    insertText: ahk?.towingCapacityLabel
      ? `Die Anhängelast beträgt ${ahk.towingCapacityLabel}.`
      : null,
  };

  return {
    ok: true,
    mode: 'offer',
    results: [result],
    previousPreparation: magic,
    context: { customerName: name },
  };
}
