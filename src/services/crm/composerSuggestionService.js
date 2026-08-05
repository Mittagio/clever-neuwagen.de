/**
 * Composer-Suggestion-Chips – Cursor-/ChatGPT-artig über dem Eingabefeld.
 * Primär-Chips sichtbar; seltenere rechts hinter „+“.
 */
import {
  buildCleverAntwortenContext,
  buildCleverGreeting,
  generateCleverAntwortText,
} from '../cleverAntworten.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';

/** Alltag – immer sichtbar */
export const COMPOSER_PRIMARY_CHIPS = [
  { id: 'nachfassen', label: 'Nachfassen', antwortType: 'nachfassen' },
  { id: 'lieferzeit', label: 'Lieferzeit', antwortType: 'lieferzeit' },
  { id: 'angebot', label: 'Angebot', antwortType: 'angebot_senden' },
  { id: 'danke', label: 'Danke', antwortType: 'danke' },
  { id: 'rueckfrage', label: 'Rückfrage', antwortType: 'rueckfrage' },
  { id: 'kundenlink', label: 'Kundenlink', action: 'portfolio' },
];

/** Bei offener Appointment-Review – keine generischen Alltagschips */
export const APPOINTMENT_REVIEW_CHIPS = [
  { id: 'appt_change_time', label: 'Uhrzeit ändern' },
  { id: 'appt_other_day', label: 'Anderen Tag' },
  { id: 'appt_personal', label: 'Persönlicher schreiben' },
  { id: 'appt_calendar', label: 'Kalender prüfen' },
];

/**
 * @param {object|null} reviewModel
 * @returns {{ chips: object[], moreChips: object[] }}
 */
export function resolveComposerChipsForReview(reviewModel = null) {
  if (reviewModel?.reviewType === 'appointment_and_message_review') {
    // Review hat klare Primary-Actions → generische Chips ausblenden
    if (Array.isArray(reviewModel?.actionSections)
      && reviewModel.actionSections.some((s) => (
        s.kind === 'appointment_and_message_review'
        && Array.isArray(s.primaryActions)
        && s.primaryActions.length > 0
      ))) {
      return { chips: [], moreChips: [] };
    }
    return { chips: APPOINTMENT_REVIEW_CHIPS, moreChips: [] };
  }
  return { chips: COMPOSER_PRIMARY_CHIPS, moreChips: COMPOSER_MORE_CHIPS };
}

/** Seltener – hinter „+“ rechts */
export const COMPOSER_MORE_CHIPS = [
  { id: 'selbstauskunft', label: 'Selbstauskunft', antwortType: 'unterlagen' },
  { id: 'unterlagen', label: 'Unterlagen', antwortType: 'unterlagen' },
  { id: 'termin', label: 'Termin', antwortType: 'termin' },
  { id: 'probefahrt', label: 'Probefahrt', antwortType: 'probefahrt' },
  { id: 'nicht_erreicht', label: 'Nicht erreicht', antwortType: 'nicht_erreicht' },
  { id: 'angebot_angepasst', label: 'Angebot angepasst', antwortType: 'angebot_angepasst' },
];

export const COMPOSER_SUGGESTION_CHIPS = [
  ...COMPOSER_PRIMARY_CHIPS,
  ...COMPOSER_MORE_CHIPS,
];

const SHORTCUT_ALIASES = [
  { id: 'nachfassen', pattern: /^(?:nachfassen|follow[\s-]?up|nachhaken)(?:\s*[!.…]*)?$/i },
  { id: 'lieferzeit', pattern: /^(?:lieferzeit|verf[uü]gbarkeit|lieferung)(?:\s*[!.…]*)?$/i },
  { id: 'angebot', pattern: /^(?:angebot(?:\s+senden)?|offer)(?:\s*[!.…]*)?$/i },
  { id: 'danke', pattern: /^(?:danke|eingangsbestätigung|eingangsbestaetigung)(?:\s*[!.…]*)?$/i },
  { id: 'rueckfrage', pattern: /^(?:r[uü]ckfrage|nachfrage)(?:\s*[!.…]*)?$/i },
  { id: 'kundenlink', pattern: /^(?:kundenlink|portfolio|link\s+senden)(?:\s*[!.…]*)?$/i },
  { id: 'selbstauskunft', pattern: /^(?:selbstauskunft)(?:\s*[!.…]*)?$/i },
  { id: 'unterlagen', pattern: /^(?:unterlagen)(?:\s*[!.…]*)?$/i },
  { id: 'termin', pattern: /^(?:termin|beratung)(?:\s*[!.…]*)?$/i },
  { id: 'probefahrt', pattern: /^(?:probefahrt)(?:\s*[!.…]*)?$/i },
  { id: 'nicht_erreicht', pattern: /^(?:nicht\s+erreicht|nicht\s+erreicht)(?:\s*[!.…]*)?$/i },
  { id: 'angebot_angepasst', pattern: /^(?:angebot\s+angepasst|anpassung)(?:\s*[!.…]*)?$/i },
];

/**
 * @param {string} text
 * @returns {object|null}
 */
export function resolveComposerShortcut(text = '') {
  const t = String(text ?? '').trim();
  if (!t || t.length > 48) return null;
  for (const alias of SHORTCUT_ALIASES) {
    if (alias.pattern.test(t)) {
      return COMPOSER_SUGGESTION_CHIPS.find((c) => c.id === alias.id) ?? null;
    }
  }
  return null;
}

/**
 * Chip / Shortcut → Seller-Input für den zentralen Composer-Turn.
 * Chips inspirieren – sie ersetzen nicht den Orchestrator.
 */
export function buildChipSellerInput(chipId = '', options = {}) {
  const name = String(options.customerName || '').trim();
  const him = name || 'dem Kunden';
  const map = {
    nachfassen: `Schreib ${him} eine kurze Nachfassnachricht.`,
    lieferzeit: `Schreib ${him} kurz zur Lieferzeit und Verfügbarkeit.`,
    angebot: `Bereite für ${him} ein Angebot vor und schreib eine kurze Kundennachricht dazu.`,
    danke: `Schreib ${him} eine kurze Dankes-/Eingangsbestätigung.`,
    rueckfrage: `Schreib ${him} eine höfliche Rückfrage zu offenen Punkten.`,
    kundenlink: 'Schick ihm die Angebote per Mail / Kundenlink.',
    selbstauskunft: `Welche Unterlagen fehlen bei ${him}? Bitte Selbstauskunft anfordern.`,
    unterlagen: `Welche Unterlagen fehlen bei ${him}?`,
    termin: `Schlag ${him} einen Termin im Autohaus vor.`,
    probefahrt: `Schlag ${him} eine Probefahrt vor.`,
    nicht_erreicht: `Schreib ${him}, dass wir ihn nicht erreicht haben und melde dich.`,
    angebot_angepasst: `Schreib ${him}, dass ich das Angebot angepasst habe.`,
    appt_change_time: 'Lieber um 16 Uhr.',
    appt_other_day: 'Lieber einen anderen Tag.',
    appt_personal: 'Schreib die Terminnachricht persönlicher.',
    appt_calendar: 'Prüfe den Kalender für den Terminvorschlag.',
  };
  return map[chipId] || null;
}

function textLieferzeit(ctx = {}) {
  const vehicle = ctx.vehicleTitle || 'Wunschfahrzeug';
  const seller = ctx.sellerName?.trim();
  const closing = seller && seller !== 'Ihr Verkaufsteam'
    ? `\n\nViele Grüße\n${seller}`
    : '\n\nViele Grüße';
  return [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `zur Verfügbarkeit und Lieferzeit beim ${vehicle} melde ich mich kurz bei Ihnen.`,
    '',
    'Aktuell prüfe ich den Bestand und die nächsten möglichen Liefertermine und komme mit einem konkreten Vorschlag auf Sie zu.',
    '',
    'Passt Ihnen eher eine zeitnahe Übergabe, oder ist ein späterer Termin in Ordnung?',
    closing,
  ].join('\n').trim();
}

/**
 * @param {object} lead
 * @param {string} chipId
 * @param {{ customerName?: string }} [options]
 */
export function buildComposerCustomerMessage(lead = {}, chipId = 'nachfassen', options = {}) {
  const chip = COMPOSER_SUGGESTION_CHIPS.find((c) => c.id === chipId)
    || COMPOSER_PRIMARY_CHIPS[0];

  if (chip.action === 'portfolio') {
    return {
      chipId: chip.id,
      label: chip.label,
      body: '',
      action: 'portfolio',
      context: {},
    };
  }

  const vehicleCards = (() => {
    try {
      return buildVehicleOpportunityCards({ lead, wishFields: lead?.wish ?? {} }) ?? [];
    } catch {
      return [];
    }
  })();

  const focusCard = options.focusOfferId
    ? vehicleCards.find((c) => c.id === options.focusOfferId || c.configurationId === options.focusOfferId)
    : null;

  const context = buildCleverAntwortenContext({
    lead,
    customerName: options.customerName
      || lead?.name
      || lead?.contact?.name
      || '',
    phone: lead?.contact?.phone || lead?.phone || '',
    email: lead?.contact?.email || lead?.email || '',
    vehicleCards: Array.isArray(vehicleCards) ? vehicleCards : [],
    wishPaymentType: lead?.paymentType || lead?.wish?.paymentType || 'unknown',
    sellerName: lead?.crm?.sellerName || 'Ihr Verkaufsteam',
    dealerName: lead?.crm?.dealerName || '',
    primaryCard: focusCard || undefined,
  });

  if (focusCard) {
    const title = focusCard.modelName || focusCard.model || '';
    const trim = focusCard.trimLabel || '';
    if (title) {
      context.vehicleTitle = `Kia ${String(title).replace(/^Kia\s+/i, '')}${trim ? ` ${trim}` : ''}`.trim();
    }
  }

  if (!context.vehicleTitle) {
    const model = lead?.wish?.model
      || lead?.vehicle?.model
      || lead?.crm?.needProfile?.preferredModels?.[0]
      || '';
    const trim = lead?.wish?.trim || lead?.vehicle?.trim || '';
    if (model) {
      context.vehicleTitle = `Kia ${String(model).replace(/^Kia\s+/i, '')}${trim ? ` ${trim}` : ''}`.trim();
    }
  }

  let body;
  if (chip.antwortType === 'lieferzeit') {
    body = textLieferzeit(context);
  } else {
    body = generateCleverAntwortText(chip.antwortType, context);
  }

  return {
    chipId: chip.id,
    label: chip.label,
    body: String(body || '').trim(),
    action: null,
    context,
  };
}

/**
 * @param {object} lead
 * @param {string} chipId
 * @param {{ customerName?: string }} [options]
 */
export function buildComposerSuggestionAssist(lead = {}, chipId = 'nachfassen', options = {}) {
  const message = buildComposerCustomerMessage(lead, chipId, options);

  if (message.action === 'portfolio') {
    return {
      ok: true,
      mode: 'act',
      results: [{
        type: INLINE_RESULT_TYPES.PORTFOLIO_SEND,
        title: '✨ Kundenlink senden',
        body: 'Versandbereite Angebote als Kundenlink per Mail vorbereiten.',
        primaryCta: 'Kundenlink senden',
        secondaryCta: null,
        action: 'portfolio',
      }],
    };
  }

  if (!message.body) {
    return { ok: false, results: [] };
  }

  const vehicleHint = message.context?.vehicleTitle
    ? ` · ${message.context.vehicleTitle}`
    : '';

  return {
    ok: true,
    mode: 'write',
    results: [{
      type: INLINE_RESULT_TYPES.MESSAGE_DRAFT,
      title: `✨ ${message.label}${vehicleHint}`,
      headline: message.context?.customerName
        ? `Nachricht an ${message.context.customerName}`
        : 'Nachricht an Kundin',
      body: message.body,
      draft: { body: message.body, channel: 'preferred' },
      primaryCta: 'Senden',
      secondaryCta: 'Bearbeiten',
      copyCta: 'Kopieren',
    }],
  };
}
