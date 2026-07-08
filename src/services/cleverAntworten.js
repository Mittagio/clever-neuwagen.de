/**
 * Clever Antworten – Textvorschläge für Kundenakte (regelbasiert, ohne externes LLM)
 */
import { formatCustomerDisplayName, PAYMENT_TYPE_LABELS } from './dealerAiParser.js';
import { parseKundenhelferNotes } from './cleverKundenhelfer.js';
import { buildCustomerUnderstanding } from './dealer/customerUnderstanding.js';
import { getSellerInsightsFromLead } from './dealer/sellerInsights.js';
import { getPrimaryRequestedStockVehicle } from './inquiry/stockVehicleInquiryFlow.js';
import {
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
} from './customerAkte.js';
import { getSelbstauskunft } from './cleverSelbstauskunft.js';

export const CLEVER_ANTWORTEN_TYPES = [
  { id: 'danke', label: 'Danke für Anfrage' },
  { id: 'rueckfrage', label: 'Rückfrage stellen' },
  { id: 'angebot_senden', label: 'Angebot senden' },
  { id: 'nachfassen', label: 'Nachfassen' },
  { id: 'probefahrt', label: 'Probefahrt anbieten' },
  { id: 'unterlagen', label: 'Unterlagen anfordern' },
  { id: 'termin', label: 'Termin vorschlagen' },
  { id: 'nicht_erreicht', label: 'Kunde nicht erreicht' },
  { id: 'angebot_angepasst', label: 'Angebot angepasst' },
  { id: 'frei', label: 'Frei formulieren' },
];

export const CLEVER_ANTWORTEN_HISTORY = {
  created: 'Clever Antwort erstellt',
  copied: 'Antworttext kopiert',
  whatsapp: 'Nachricht per WhatsApp vorbereitet',
  email: 'Antwort per E-Mail vorbereitet',
  note_saved: 'Antwort als Notiz gespeichert',
  refined: 'Antwort neu formuliert',
};

const KUNDENHELFER_HINTS = {
  'Kofferraum wichtig': 'Da Ihnen der Kofferraum wichtig ist, prüfe ich gerne zusätzlich eine passende Alternative mit mehr Platz.',
  Hund: 'Für Ihren Hund schaue ich auch nach passenden Fahrzeugen mit genug Platz hinten.',
  'entscheidet mit Partner': 'Gerne können Sie das Angebot in Ruhe gemeinsam besprechen.',
  'braucht Auto sofort': 'Ich halte auch schnell verfügbare Fahrzeuge im Blick.',
  'Unfall / Ersatzfahrzeug': 'Für Ihren schnellen Ersatz schaue ich nach passenden sofort verfügbaren Optionen.',
  'Leasing läuft aus': 'Mit Blick auf Ihr auslaufendes Leasing finde ich eine passende Anschlusslösung.',
  'Preis sehr wichtig': 'Ich achte besonders auf ein attraktives Preis-Leistungs-Verhältnis.',
  'will Probefahrt': 'Eine Probefahrt können wir gerne früh einplanen.',
  'Inzahlungnahme vorhanden': 'Ihre Inzahlungnahme berücksichtige ich bei der Kalkulation.',
};

function collectUnderstandingChips(lead) {
  const understanding = buildCustomerUnderstanding(lead);
  const labels = understanding?.verstaendnis?.labels ?? [];
  const insightTexts = getSellerInsightsFromLead(lead).map((insight) => insight.text);
  const merged = [];
  const seen = new Set();
  for (const item of [...labels, ...insightTexts]) {
    const trimmed = String(item ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }
  return merged;
}

export function resolveLegacyKundenhelferNotes(lead, kundenhelferNotes = '') {
  if (lead && buildCustomerUnderstanding(lead)) return '';
  if (!lead) return kundenhelferNotes;
  return kundenhelferNotes || lead?.crm?.kundenhelfer?.notes || '';
}

function resolveKundenhelferChips(lead, kundenhelferNotes = '') {
  if (lead && buildCustomerUnderstanding(lead)) {
    return collectUnderstandingChips(lead);
  }
  return parseKundenhelferNotes(resolveLegacyKundenhelferNotes(lead, kundenhelferNotes));
}

function pickPrimaryCard(vehicleCards = []) {
  const opened = vehicleCards.find((c) => {
    const s = c.vehicleOffer?.status ?? c.offer?.status;
    return s === 'opened';
  });
  const sent = vehicleCards.find((c) => {
    const s = c.vehicleOffer?.status ?? c.offer?.status;
    return s === 'sent';
  });
  return opened ?? sent ?? vehicleCards[0] ?? null;
}

function resolveOfferUrl(card) {
  if (!card) return '';
  const url = card.vehicleOffer?.onlineLink?.url ?? card.offer?.code ?? '';
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window !== 'undefined' && url.startsWith('/')) {
    return `${window.location.origin}${url}`;
  }
  return url;
}

function resolveUnterlagenUrl(lead) {
  const unterlagen = lead?.crm?.cleverUnterlagen;
  const uploadUrl = unterlagen?.uploadLink?.url;
  if (uploadUrl) return uploadUrl;
  const sa = getSelbstauskunft(unterlagen);
  return sa?.link?.url ?? '';
}

function paymentLabel(paymentType) {
  const raw = PAYMENT_TYPE_LABELS[paymentType] ?? paymentType;
  if (!raw || paymentType === 'unknown') return null;
  return String(raw).replace(' / Barzahlung', '').replace('Kauf / Barzahlung', 'Kauf');
}

export function buildCleverGreeting(name = '', salutation = '') {
  const display = formatCustomerDisplayName(name);
  if (!display) return 'Guten Tag,';

  const parts = display.split(/\s+/).filter(Boolean);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const sal = String(salutation || '').toLowerCase().trim();

  if (lastName && (sal === 'herr' || sal === 'mr' || sal === 'male' || sal === 'm')) {
    return `Hallo Herr ${lastName},`;
  }
  if (lastName && (sal === 'frau' || sal === 'mrs' || sal === 'female' || sal === 'w' || sal === 'f')) {
    return `Hallo Frau ${lastName},`;
  }
  if (parts.length >= 2) {
    return `Hallo ${display},`;
  }
  return `Hallo ${parts[0]},`;
}

function pickKundenhelferHint(chips = [], typeId = '') {
  const preferred = {
    rueckfrage: ['Kofferraum wichtig', 'Hund', 'Preis sehr wichtig', 'Leasing läuft aus'],
    nachfassen: ['entscheidet mit Partner', 'Preis sehr wichtig'],
    angebot_senden: ['entscheidet mit Partner', 'Kofferraum wichtig', 'braucht Auto sofort'],
    probefahrt: ['will Probefahrt', 'Kofferraum wichtig', 'Hund'],
    danke: ['braucht Auto sofort', 'Unfall / Ersatzfahrzeug'],
  };
  const order = preferred[typeId] ?? Object.keys(KUNDENHELFER_HINTS);
  for (const key of order) {
    if (chips.some((c) => c.toLowerCase() === key.toLowerCase())) {
      return KUNDENHELFER_HINTS[key] ?? null;
    }
  }
  for (const chip of chips) {
    const hint = KUNDENHELFER_HINTS[chip];
    if (hint) return hint;
  }
  return null;
}

function buildClosing(ctx) {
  const seller = ctx.sellerName?.trim();
  if (!seller || seller === 'Ihr Verkaufsteam') {
    return '\n\nViele Grüße';
  }
  return `\n\nViele Grüße\n${seller}`;
}

export function buildCleverAntwortenContext({
  lead = null,
  customerName = '',
  phone = '',
  email = '',
  vehicleCards = [],
  kundenhelferNotes = '',
  sellerName = 'Ihr Verkaufsteam',
  dealerName = '',
  wishPaymentType = 'unknown',
} = {}) {
  const primaryCard = pickPrimaryCard(vehicleCards);
  const offerStatus = primaryCard?.vehicleOffer?.status ?? primaryCard?.offer?.status ?? null;
  const vehicleTitle = primaryCard ? formatVehicleCardTitle(primaryCard) : (
    lead?.vehicle?.model ? `Kia ${String(lead.vehicle.model).replace(/^Kia\s+/i, '')}` : ''
  );
  const paymentType = primaryCard?.paymentType ?? wishPaymentType ?? lead?.paymentType ?? 'unknown';
  const chips = resolveKundenhelferChips(lead, kundenhelferNotes);

  return {
    customerName,
    salutation: lead?.contact?.salutation ?? lead?.crm?.salutation ?? '',
    phone,
    email,
    sellerName: sellerName || lead?.crm?.sellerName || 'Ihr Verkaufsteam',
    dealerName: dealerName || lead?.crm?.dealerName || '',
    vehicleTitle,
    vehicleCards,
    primaryCard,
    paymentType,
    paymentLabel: paymentLabel(paymentType),
    conditions: primaryCard ? formatVehicleCardConditions(primaryCard) : null,
    priceLine: primaryCard ? formatVehicleCardPrice(primaryCard) : null,
    offerUrl: resolveOfferUrl(primaryCard),
    offerStatus,
    offerOpened: offerStatus === 'opened',
    offerSent: offerStatus === 'sent' || offerStatus === 'opened',
    unterlagenUrl: resolveUnterlagenUrl(lead),
    kundenhelferChips: chips,
    nextStepText: lead?.crm?.nextStepLabel ?? '',
    requestedStockVehicle: getPrimaryRequestedStockVehicle(lead),
  };
}

export function suggestCleverAntwortType(context = {}) {
  if (context.offerOpened) return 'nachfassen';
  if (context.offerSent) return 'nachfassen';
  if (context.offerUrl && context.vehicleTitle) return 'angebot_senden';
  if (context.unterlagenUrl) return 'unterlagen';
  if (!context.paymentLabel || context.paymentType === 'unknown') return 'rueckfrage';
  if (context.kundenhelferChips?.includes('will Probefahrt')) return 'probefahrt';
  return 'danke';
}

function textDanke(ctx) {
  const hint = pickKundenhelferHint(ctx.kundenhelferChips, 'danke');
  const vehicleBit = ctx.vehicleTitle
    ? ` zu Ihrem Wunsch ${ctx.vehicleTitle}`
    : '';
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `vielen Dank für Ihre Anfrage${vehicleBit}. Ich schaue mir Ihren Wunsch direkt an und melde mich zeitnah mit einem passenden Vorschlag.`,
  ];
  if (hint) lines.push('', hint);
  lines.push(buildClosing(ctx));
  return lines.join('\n').trim();
}

function textRueckfrage(ctx) {
  const hint = pickKundenhelferHint(ctx.kundenhelferChips, 'rueckfrage');
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    'damit ich Ihnen direkt das passende Angebot vorbereiten kann, habe ich noch eine kurze Rückfrage:',
  ];

  if (!ctx.paymentLabel || ctx.paymentType === 'unknown') {
    lines.push('', 'Soll es eher Leasing, Finanzierung oder Kauf werden?');
  } else if (ctx.primaryCard?.mileagePerYear && ctx.paymentType !== 'cash') {
    const km = Number(ctx.primaryCard.mileagePerYear);
    const alt = km <= 10000 ? 15000 : 10000;
    lines.push('', `Soll ich eher mit ${km.toLocaleString('de-DE')} km oder ${alt.toLocaleString('de-DE')} km pro Jahr rechnen?`);
  } else if (!ctx.vehicleTitle) {
    lines.push('', 'Welches Modell oder welche Ausstattung ist Ihnen besonders wichtig?');
  } else {
    lines.push('', `Passt ${ctx.vehicleTitle} grundsätzlich, oder soll ich eine Alternative mit ähnlichen Konditionen prüfen?`);
  }

  if (hint) lines.push('', hint);
  lines.push(buildClosing(ctx));
  return lines.join('\n').trim();
}

function textAngebotSenden(ctx) {
  const hint = pickKundenhelferHint(ctx.kundenhelferChips, 'angebot_senden');
  const lines = [buildCleverGreeting(ctx.customerName, ctx.salutation), ''];

  if (ctx.offerUrl && ctx.vehicleTitle) {
    lines.push(`ich habe Ihnen ein passendes Angebot zum ${ctx.vehicleTitle} vorbereitet. Sie können es hier online ansehen:`, '', ctx.offerUrl);
    if (ctx.priceLine) lines.push('', `Kondition: ${ctx.priceLine}`);
  } else if (ctx.vehicleTitle) {
    lines.push(`ich bereite Ihnen gerade ein passendes Angebot zum ${ctx.vehicleTitle} vor und sende es Ihnen anschließend zu.`);
  } else {
    lines.push('ich bereite Ihnen das Angebot gerade vor und sende es Ihnen anschließend zu.');
  }

  if (hint) lines.push('', hint);
  lines.push(buildClosing(ctx));
  return lines.join('\n').trim();
}

function textNachfassen(ctx) {
  const hint = pickKundenhelferHint(ctx.kundenhelferChips, 'nachfassen');
  const lines = [buildCleverGreeting(ctx.customerName, ctx.salutation), ''];

  if (ctx.offerOpened) {
    lines.push('ich habe gesehen, dass Sie sich das Angebot angeschaut haben. Passt das grundsätzlich für Sie oder soll ich noch etwas an Laufzeit, Kilometer oder Anzahlung anpassen?');
  } else if (ctx.offerSent) {
    lines.push('ich wollte kurz nachfragen, ob mein Angebot bei Ihnen angekommen ist und ob ich noch etwas anpassen darf.');
    if (ctx.offerUrl) lines.push('', ctx.offerUrl);
  } else {
    lines.push('ich wollte kurz nachfragen, ob Sie noch Fragen haben oder ob ich Ihnen bei der Entscheidung helfen kann.');
  }

  if (hint) lines.push('', hint);
  lines.push(buildClosing(ctx));
  return lines.join('\n').trim();
}

function textProbefahrt(ctx) {
  const model = ctx.vehicleTitle || 'Wunschfahrzeug';
  const hint = pickKundenhelferHint(ctx.kundenhelferChips, 'probefahrt');
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `wenn Sie möchten, können wir gerne eine Probefahrt mit dem ${model} vereinbaren. Wann würde es Ihnen zeitlich passen?`,
  ];
  if (hint) lines.push('', hint);
  lines.push(buildClosing(ctx));
  return lines.join('\n').trim();
}

function textUnterlagen(ctx) {
  const lines = [buildCleverGreeting(ctx.customerName, ctx.salutation), ''];

  if (ctx.unterlagenUrl) {
    lines.push('wenn das Angebot für Sie passt, können Sie die nächsten Unterlagen bequem hier hochladen:', '', ctx.unterlagenUrl);
  } else {
    lines.push('wenn das Angebot für Sie passt, sende ich Ihnen gerne den Link zur Selbstauskunft und zum Hochladen der Unterlagen.');
  }

  lines.push(buildClosing(ctx));
  return lines.join('\n').trim();
}

function textTermin(ctx) {
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    'ich kann Ihnen gerne einen kurzen Termin zur Besprechung anbieten. Passt es Ihnen eher vormittags oder nachmittags?',
    buildClosing(ctx),
  ];
  return lines.join('\n').trim();
}

function textNichtErreicht(ctx) {
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    'ich habe Sie gerade telefonisch leider nicht erreicht. Ich melde mich gerne später nochmal oder Sie schreiben mir kurz, wann es Ihnen passt.',
    buildClosing(ctx),
  ];
  return lines.join('\n').trim();
}

function textAngebotAngepasst(ctx) {
  const lines = [buildCleverGreeting(ctx.customerName, ctx.salutation), ''];

  if (ctx.offerUrl) {
    lines.push('ich habe das Angebot angepasst. Die neue Variante können Sie sich hier ansehen:', '', ctx.offerUrl);
    if (ctx.priceLine) lines.push('', `Neue Kondition: ${ctx.priceLine}`);
  } else {
    lines.push('ich habe das Angebot angepasst und sende Ihnen die neue Variante in Kürze zu.');
  }

  lines.push(buildClosing(ctx));
  return lines.join('\n').trim();
}

function textFrei(ctx) {
  const vehicleBit = ctx.vehicleTitle ? ` zum ${ctx.vehicleTitle}` : '';
  return [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `bezüglich Ihrer Anfrage${vehicleBit} melde ich mich gerne bei Ihnen.`,
    '',
    '',
    buildClosing(ctx),
  ].join('\n').trim();
}

const GENERATORS = {
  danke: textDanke,
  rueckfrage: textRueckfrage,
  angebot_senden: textAngebotSenden,
  nachfassen: textNachfassen,
  probefahrt: textProbefahrt,
  unterlagen: textUnterlagen,
  termin: textTermin,
  nicht_erreicht: textNichtErreicht,
  angebot_angepasst: textAngebotAngepasst,
  frei: textFrei,
};

export function generateCleverAntwortText(typeId = 'danke', context = {}) {
  const fn = GENERATORS[typeId] ?? GENERATORS.danke;
  return fn(context);
}

export function buildCleverAntwortEmailSubject(context = {}) {
  const dealer = context.dealerName?.trim();
  const vehicle = context.vehicleTitle?.replace(/^Kia\s+/i, '').trim();
  if (vehicle && dealer) return `Ihr Angebot: ${vehicle} · ${dealer}`;
  if (vehicle) return `Ihr Angebot: ${vehicle}`;
  if (dealer) return `Ihre Anfrage bei ${dealer}`;
  return 'Ihre Fahrzeuganfrage';
}

function shortenText(text = '') {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 4) return text;
  const greeting = lines[0];
  const body = lines.slice(1, -2).join(' ');
  const closing = lines.slice(-2).join('\n');
  const shortBody = body.length > 160 ? `${body.slice(0, 157).trim()}…` : body;
  return [greeting, '', shortBody, '', closing].join('\n');
}

function warmifyText(text = '') {
  return text
    .replace(/^Guten Tag,/m, 'Guten Tag,')
    .replace(/ich schaue mir/gi, 'ich schaue mir gerne')
    .replace(/ich bereite/gi, 'ich bereite Ihnen gerne')
    .replace(/ich wollte kurz nachfragen/gi, 'ich wollte mich freundlich kurz nachfragen');
}

function firmifyText(text = '') {
  if (!/Passt es Ihnen|Wann würde|melden Sie sich|schreiben Sie mir/i.test(text)) {
    return `${text.trim()}\n\nBitte geben Sie mir kurz Bescheid, wie wir fortfahren sollen.`;
  }
  return text;
}

function casualizeText(text = '') {
  return text
    .replace(/Sie können/g, 'Du kannst')
    .replace(/\bIhnen\b/g, 'dir')
    .replace(/\bIhre\b/g, 'deine')
    .replace(/\bIhr\b/g, 'dein')
    .replace(/\bSie\b/g, 'du');
}

export function refineCleverAntwortText(text = '', variant = '', context = {}, typeId = 'danke') {
  const v = String(variant).toLowerCase();
  if (v === 'neu' || v === 'neu_formulieren') {
    return generateCleverAntwortText(typeId, context);
  }
  if (v === 'kuerzer' || v === 'kürzer') return shortenText(text);
  if (v === 'freundlicher') return warmifyText(text);
  if (v === 'verbindlicher') return firmifyText(text);
  if (v === 'lockerer') return casualizeText(text);
  return text;
}

export function getCleverAntwortTypeLabel(typeId) {
  return CLEVER_ANTWORTEN_TYPES.find((t) => t.id === typeId)?.label ?? 'Antwort';
}
