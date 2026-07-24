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
import { PORTFOLIO_REACTION_STATUS } from '../crm/customerOfferPortfolioService.js';
import { prepareSellerWorkspacePackage } from '../crm/sharedWorkspaceService.js';

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

/**
 * Nächster Clever-Moment aus Portfolio-/Portal-Aktivitäten (kein Match-Score).
 */
export function buildSellerCleverMoment(lead = {}) {
  const name = customerDisplayName(lead);
  const short = name.replace(/^(Herr|Frau)\s+/i, '') || name;
  const items = lead?.crm?.customerOfferPortfolio?.items ?? [];
  const reactions = items
    .map((item) => ({
      item,
      status: item?.customerReaction?.status ?? PORTFOLIO_REACTION_STATUS.NONE,
      question: String(item?.customerReaction?.questionText ?? '').trim(),
      reactedAt: item?.customerReaction?.reactedAt ?? null,
      label: item.trimLabel
        ? `${item.modelLabel} · ${item.trimLabel}`
        : (item.modelLabel || 'Angebot'),
    }))
    .filter((entry) => entry.status && entry.status !== PORTFOLIO_REACTION_STATUS.NONE)
    .sort((a, b) => String(b.reactedAt || '').localeCompare(String(a.reactedAt || '')));

  const opened = lead?.crm?.customerOfferPortfolio?.tracking?.lastOpenedAt
    || lead?.crm?.customerOfferPortfolio?.tracking?.firstOpenedAt
    || null;

  if (!reactions.length && !opened) return null;

  const interested = reactions.find((r) => r.status === PORTFOLIO_REACTION_STATUS.INTERESTED);
  const question = reactions.find((r) => (
    r.status === PORTFOLIO_REACTION_STATUS.MORE_INFO && r.question
  ));
  const change = reactions.find((r) => (
    r.status === PORTFOLIO_REACTION_STATUS.CHANGE_REQUESTED && r.question
  ));

  const parts = [];
  if (interested) {
    parts.push(`${interested.label} interessiert ${short} besonders`);
  } else if (opened) {
    const first = items[0];
    const label = first?.modelLabel || 'das Angebot';
    parts.push(`${short} hat ${label} angesehen`);
  }

  if (question) {
    const q = question.question.replace(/^["„]|["“]$/g, '');
    if (/anhängelast|ziehen|ahk|kupplung/i.test(q)) {
      parts.push('Er hat nach der Anhängelast gefragt');
    } else {
      parts.push(`Er hat gefragt: „${q.slice(0, 80)}${q.length > 80 ? '…' : ''}“`);
    }
  }

  if (change) {
    parts.push(`${change.label}: Änderungswunsch „${change.question.slice(0, 60)}${change.question.length > 60 ? '…' : ''}“`);
  }

  if (!parts.length) return null;

  const summary = parts.join('. ').replace(/\.\./g, '.') + (parts.length ? '.' : '');
  const primaryAction = change
    ? { id: 'adapt_offer', label: 'Angebot anpassen', modeHint: 'offer' }
    : { id: 'prepare_message', label: 'Nachricht vorbereiten', modeHint: 'message' };

  return {
    summary,
    primaryAction,
    secondaryAction: change
      ? { id: 'prepare_message', label: 'Nachricht vorbereiten', modeHint: 'message' }
      : { id: 'adapt_offer', label: 'Angebot anpassen', modeHint: 'offer' },
    reactions: reactions.slice(0, 5),
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

  if (actionIntent.intent === SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS) {
    const pkg = prepareSellerWorkspacePackage(lead, actionIntent.sellerInput);
    return {
      ...base,
      result: {
        type: 'workspace_package',
        title: 'Clever hat vorbereitet',
        draft: { body: pkg.body, channel: 'preferred' },
        actions: pkg.actions,
        primaryCta: 'Senden',
        secondaryCta: 'Bearbeiten',
      },
    };
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
        primaryCta: `Angebot an ${customerDisplayName(lead)} senden`,
        secondaryCta: 'Details ansehen',
        tertiaryCta: 'Bearbeiten',
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
