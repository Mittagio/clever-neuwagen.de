/**
 * Seller Assistant Orchestrator – Input → Action Result (ohne Auto-Send).
 */
import { buildCleverGreeting } from '../cleverAntworten.js';
import { prepareMagicOffer } from './magicOfferService.js';
import {
  buildAttributedWishChips,
  buildCustomerUnderstanding,
} from './customerUnderstanding.js';
import {
  SELLER_ACTION_INTENTS,
  buildSellerActionIntent,
} from './sellerActionIntent.js';
import { filterNotepadChipsExcludingKonditionen } from '../customerAkte.js';
import { proposeSellerInsightLabels } from './sellerInsights.js';

function customerDisplayName(lead = {}) {
  const raw = lead?.name
    || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ')
    || lead?.crm?.customerName
    || '';
  return String(raw).trim() || 'der Kunde';
}

function salutationName(lead = {}) {
  const name = customerDisplayName(lead);
  if (/^(herr|frau)\b/i.test(name)) return name;
  const first = lead?.firstName || name.split(/\s+/)[0];
  return first || name;
}

/**
 * Kundenkontext-Chips vs. Verkäuferkontext (aktuell).
 */
export function buildSellerAssistantContextChips(lead = {}, sellerFacts = []) {
  const attributed = filterNotepadChipsExcludingKonditionen(
    buildAttributedWishChips(lead),
  );
  const customer = attributed
    .filter((c) => c.origin === 'customer')
    .slice(0, 6)
    .map((c) => ({ ...c, group: 'customer' }));

  const sellerFromAkte = attributed
    .filter((c) => c.origin === 'seller')
    .slice(0, 4)
    .map((c) => ({ ...c, group: 'seller' }));

  const sellerCurrent = (sellerFacts ?? []).map((f) => ({
    label: f.label,
    origin: 'seller',
    badge: null,
    group: 'seller_current',
    source: f.source ?? 'seller_input',
  }));

  return {
    customer,
    seller: [...sellerCurrent, ...sellerFromAkte],
  };
}

function findCustomerLabel(labels = [], patterns = []) {
  return labels.find((label) => patterns.some((re) => re.test(label))) ?? null;
}

/**
 * Deterministischer Nachrichtenentwurf (Golden Flow) – nutzt Kundenkontext.
 * Erfindet keine technischen Werte.
 */
export function buildSellerMessageDraft(lead = {}, sellerInput = '', sellerFacts = []) {
  const understanding = buildCustomerUnderstanding(lead);
  const labels = understanding?.verstaendnis?.labels ?? [];
  const greeting = buildCleverGreeting(
    salutationName(lead),
    lead?.salutation ?? null,
  );

  const vehicleFact = sellerFacts.find((f) => f.key === 'vehicle');
  const colorFact = sellerFacts.find((f) => f.key === 'color');
  const availFact = sellerFacts.find((f) => f.key === 'availability');

  const preferredColor = findCustomerLabel(labels, [/terracotta/i, /farbe/i, /blau/i, /weiß|weiss/i, /schwarz/i]);
  const towWish = findCustomerLabel(labels, [/ahk|anhänger|kupplung|zug/i]);
  const modelWish = findCustomerLabel(labels, [/ev\d|sportage|sorento|gt-line/i]);

  const vehicleLine = [
    vehicleFact?.label || modelWish || 'passendes Fahrzeug',
    colorFact?.label,
    availFact?.label,
  ].filter(Boolean).join(' ');

  const paragraphs = [
    greeting.replace(/!$/, ','),
  ];

  if (vehicleFact || colorFact || availFact) {
    paragraphs.push(
      `ich hätte sogar einen ${vehicleLine}`.replace(/\s+/g, ' ').trim() + '.',
    );
  } else if (sellerInput) {
    paragraphs.push(sellerInput.trim().replace(/\.$/, '') + '.');
  }

  if (preferredColor && colorFact && !new RegExp(preferredColor.split(/\s+/)[0], 'i').test(colorFact.label)) {
    paragraphs.push(
      `Ursprünglich hatten Sie ${preferredColor.replace(/ interessiert| gewünscht| interessant/gi, '')} angefragt. `
      + `Falls ${colorFact.label} für Sie ebenfalls infrage kommt, könnte ich Ihnen das Fahrzeug direkt anbieten.`,
    );
  } else if (preferredColor && !colorFact) {
    paragraphs.push(
      `Ihre Farbpräferenz (${preferredColor}) habe ich natürlich im Blick.`,
    );
  }

  if (towWish) {
    paragraphs.push(
      'Die Anhängerkupplung berücksichtige ich natürlich ebenfalls für Sie. '
      + 'Die genaue Anhängelast prüfe ich noch und gebe sie Ihnen verbindlich durch.',
    );
  }

  paragraphs.push('Soll ich Ihnen das Fahrzeug kurz vorstellen?');

  const body = paragraphs.filter(Boolean).join('\n\n');
  const sellerName = lead?.ownerName ?? 'Ihr Verkaufsteam';
  const withClose = `${body}\n\nViele Grüße\n${sellerName}`;

  return {
    channel: 'preferred',
    subject: vehicleFact
      ? `${vehicleFact.label} für Sie`
      : 'Kurze Rückmeldung zu Ihrem Wunsch',
    body: withClose,
    contextUsed: [
      modelWish,
      preferredColor,
      towWish,
      ...sellerFacts.map((f) => f.label),
    ].filter(Boolean),
  };
}

/**
 * @param {object} lead
 * @param {string} sellerInput
 * @param {{ modeHint?: string|null }} [options]
 */
export function runSellerAssistantTurn(lead = {}, sellerInput = '', options = {}) {
  const actionIntent = buildSellerActionIntent(lead, sellerInput, options);
  const contextChips = buildSellerAssistantContextChips(lead, actionIntent.sellerFacts);
  const understanding = buildCustomerUnderstanding(lead);

  const base = {
    ok: true,
    actionIntent,
    contextChips,
    contextUsed: contextChips.customer.map((c) => c.label),
    requiresSellerConfirmation: true,
    result: null,
  };

  if (!actionIntent.sellerInput) {
    return { ...base, ok: false, error: 'empty_input', result: null };
  }

  if (actionIntent.intent === SELLER_ACTION_INTENTS.PREPARE_OFFER) {
    const wish = lead?.wish ?? {};
    const need = lead?.crm?.needProfile ?? {};
    const magic = prepareMagicOffer(actionIntent.sellerInput, {
      modelKey: need.selectedModelKey ?? null,
    });

    const inherited = [];
    const km = wish.mileagePerYear ?? need.annualKm ?? null;
    const down = wish.downPayment ?? need.budget?.downPayment ?? null;
    const term = wish.termMonths ?? need.leaseDurationMonths ?? null;
    if (km) inherited.push({ label: `${Number(km).toLocaleString('de-DE')} km/Jahr`, source: 'customer_need' });
    if (down != null && down !== '') {
      inherited.push({ label: `Anzahlung ${Number(down).toLocaleString('de-DE')} €`, source: 'customer_need' });
    }
    if (term && !actionIntent.sellerFacts.some((f) => f.key === 'termMonths')) {
      inherited.push({ label: `${term} Monate`, source: 'customer_need' });
    }

    const important = contextChips.customer
      .filter((c) => /ahk|anhänger|kupplung|kinder|leasing/i.test(c.label))
      .slice(0, 4);

    return {
      ...base,
      result: {
        type: 'offer_draft',
        title: 'Angebot vorbereitet',
        headline: magic.headline || magic.grounded?.modelLabel || 'Angebot',
        subline: magic.subline || null,
        magic,
        inheritedFromCustomer: inherited,
        importantForCustomer: important,
        sellerFacts: actionIntent.sellerFacts,
        primaryCta: 'An Kunden senden',
        secondaryCta: 'Details ansehen',
      },
    };
  }

  if (actionIntent.intent === SELLER_ACTION_INTENTS.ADD_NOTE) {
    const labels = proposeSellerInsightLabels(actionIntent.sellerInput);
    return {
      ...base,
      result: {
        type: 'customer_note',
        title: 'Notiz gespeichert',
        text: actionIntent.sellerInput,
        labels,
        primaryCta: 'Übernehmen',
      },
    };
  }

  if (actionIntent.intent === SELLER_ACTION_INTENTS.PREPARE_CALLBACK) {
    return {
      ...base,
      result: {
        type: 'callback',
        title: 'Rückruf vorgemerkt',
        text: actionIntent.sellerInput,
        primaryCta: 'Vormerken',
      },
    };
  }

  // Default: message
  const draft = buildSellerMessageDraft(lead, actionIntent.sellerInput, actionIntent.sellerFacts);
  const opportunity = actionIntent.sellerFacts.some((f) => f.key === 'vehicle' || f.key === 'availability')
    ? {
      title: 'Passendes Fahrzeug verfügbar',
      vehicleLabel: actionIntent.sellerFacts.find((f) => f.key === 'vehicle')?.label ?? 'Fahrzeug',
      color: actionIntent.sellerFacts.find((f) => f.key === 'color')?.label ?? null,
      availability: actionIntent.sellerFacts.find((f) => f.key === 'availability')?.label ?? null,
      source: 'seller_input',
    }
    : null;

  return {
    ...base,
    contextUsed: draft.contextUsed,
    result: {
      type: 'message_draft',
      title: 'Clever Vorschlag für Ihre Nachricht',
      draft,
      opportunity,
      understandingSummary: understanding?.gespraechseinstieg ?? null,
      primaryCta: 'Nachricht senden',
      secondaryActions: ['whatsapp', 'email', 'edit'],
    },
  };
}
