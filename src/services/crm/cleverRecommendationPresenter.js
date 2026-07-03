/**
 * Clever empfiehlt 2.0 – Präsentationsschicht (keine doppelte Regellogik).
 * Baut auf cleverActionEngine auf: Abschlusschance, Warum-Bullets, Headlines, Dashboard.
 */
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { resolveOfferSelectionGroups } from '../sales/offerSelectionGroup.js';
import {
  buildCleverActionContext,
  buildCleverActionRecommendation,
  CLEVER_ACTION_IDS,
  evaluateCleverActions,
  formatCleverRecommendationHistoryText,
} from './cleverActionEngine.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { PORTAL_ACCESS_STATUS, getCustomerPortalAccess } from './customerPortalAccessService.js';
import { INTEREST_STATUS, getCustomerOfferInteraction } from '../customerOfferInteraction.js';

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function starsFromClosure(closureChance) {
  if (closureChance >= 88) return 5;
  if (closureChance >= 72) return 4;
  if (closureChance >= 55) return 3;
  if (closureChance >= 38) return 2;
  return 1;
}

function starLabel(count) {
  return '⭐'.repeat(Math.max(1, Math.min(5, count)));
}

/** Kurz-Headline für Verkäufer – nicht technischer action title */
const HEADLINE_BY_ACTION = {
  [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]: 'Heute anrufen',
  [CLEVER_ACTION_IDS.OFFER_FOLLOWUP]: 'Heute nachfassen',
  [CLEVER_ACTION_IDS.OFFER_SEND]: 'Angebot jetzt senden',
  [CLEVER_ACTION_IDS.OFFER_CREATED_SEND]: 'Angebot an Kunden senden',
  [CLEVER_ACTION_IDS.DOCUMENTS_MISSING]: 'Unterlagen anfordern',
  [CLEVER_ACTION_IDS.DOCUMENTS_INBOX_CHECK]: 'Unterlagen prüfen',
  [CLEVER_ACTION_IDS.LEASING_READY]: 'Leasingantrag starten',
  [CLEVER_ACTION_IDS.LEASING_APPROVED]: 'Fahrzeug bestellen',
  [CLEVER_ACTION_IDS.DELIVERY_READY]: 'Übergabe planen',
  [CLEVER_ACTION_IDS.VEHICLE_ARRIVING]: 'Liefertermin vereinbaren',
  [CLEVER_ACTION_IDS.PORTAL_LINK_SEND]: 'Kundenlink senden',
  [CLEVER_ACTION_IDS.PORTAL_LINK_FOLLOWUP]: 'Kundenlink nachfassen',
  [CLEVER_ACTION_IDS.PORTAL_CODE_REMIND]: 'Zugangscode erinnern',
  [CLEVER_ACTION_IDS.PORTAL_VIEWED_FOLLOWUP]: 'Nach Angebotsansicht nachfassen',
  [CLEVER_ACTION_IDS.SELECTION_SEND]: 'Auswahl an Kunden senden',
  [CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER]: 'Kundenfrage beantworten',
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REQUEST]: 'Selbstauskunft anfordern',
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW]: 'Selbstauskunft prüfen',
  [CLEVER_ACTION_IDS.VEHICLE_SUGGESTION_REVIEW]: 'Fahrzeugwunsch prüfen',
  [CLEVER_ACTION_IDS.GENERAL_REMINDER]: 'Kurz Kontakt aufnehmen',
};

const DONE_OPTIONS_BY_HANDLER = {
  call: { id: 'called', label: '✓ Kunde angerufen', historyText: '✓ Kunde angerufen – Clever berechnet neu' },
  offer_followup: { id: 'followed_up', label: '✓ Nachfassung erledigt', historyText: '✓ Nachfassung erledigt' },
  portal_followup: { id: 'portal_done', label: '✓ Kunde kontaktiert', historyText: '✓ Portal-Nachfassung erledigt' },
  documents: { id: 'docs_done', label: '✓ Unterlagen besprochen', historyText: '✓ Unterlagen besprochen' },
  default: { id: 'done', label: '✓ Erledigt', historyText: '✓ Clever-Empfehlung erledigt' },
};

export function recommendCleverActionExcluding(context, excludedActionIds = []) {
  const exclude = new Set(excludedActionIds);
  const candidates = evaluateCleverActions(context).filter((c) => !exclude.has(c.actionId));
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Abschlusschance 0–100 aus vorhandenen Signalen (heuristisch, erklärbar).
 */
export function computeAbschlusschance(context = {}) {
  const {
    lead,
    vehicleCards = [],
    primaryCard,
    offerStatus,
    daysSinceOpened,
    daysSinceSent,
    daysSinceActivity,
    unterlagenSummary,
    selbstauskunftComplete,
    leasingStatus,
    vehicleFulfillmentStatus,
  } = context;

  let score = 42;

  if (offerStatus === VEHICLE_OFFER_STATUS.OPENED) score += 22;
  if (offerStatus === VEHICLE_OFFER_STATUS.SENT && daysSinceSent != null && daysSinceSent <= 3) score += 12;
  if (offerStatus === VEHICLE_OFFER_STATUS.ACCEPTED) score += 35;

  const interested = vehicleCards.some((card) => {
    const interaction = getCustomerOfferInteraction(lead, card.id);
    return interaction?.interestStatus === INTEREST_STATUS.INTERESTED;
  });
  if (interested) score += 28;

  const portal = getCustomerPortalAccess(lead);
  if (portal?.status === PORTAL_ACCESS_STATUS.VIEWED) score += 14;
  if (portal?.status === PORTAL_ACCESS_STATUS.OPENED) score += 8;

  if (vehicleCards.length >= 2) score += 8;
  if (lead?.status === 'probefahrt' || lead?.wantTestDrive) score += 16;

  if (selbstauskunftComplete) score += 12;
  if (unterlagenSummary?.doneCount >= Math.max(1, (unterlagenSummary?.totalCount ?? 0) - 1)) score += 10;

  if (leasingStatus === 'approved') score += 25;
  if (leasingStatus === 'submitted') score += 8;

  if (vehicleFulfillmentStatus === 'delivery_ready' || vehicleFulfillmentStatus === 'ready_for_handover') {
    score += 30;
  }
  if (vehicleFulfillmentStatus === 'in_transit' || vehicleFulfillmentStatus === 'arriving') score += 18;

  if (daysSinceOpened === 0) score += 10;
  if (daysSinceOpened === 1) score += 6;

  if (daysSinceActivity != null && daysSinceActivity > 7) score -= 12;
  if (daysSinceSent != null && daysSinceSent >= 5 && offerStatus === VEHICLE_OFFER_STATUS.SENT) score -= 8;

  if (lead?.status === 'verloren') return 5;
  if (lead?.status === 'ausgeliefert' || lead?.status === 'auslieferung_bestaetigt') return 95;

  return clampScore(score);
}

/**
 * Erklärbare Warum-Bullets für Vertrauen in die KI.
 */
export function collectWhyBullets(context = {}, recommendation = null) {
  const bullets = [];
  const {
    lead,
    vehicleCards = [],
    offerStatus,
    daysSinceOpened,
    daysSinceSent,
    unterlagenSummary,
    selbstauskunftComplete,
    leasingStatus,
    vehicleFulfillmentStatus,
    primaryCard,
  } = context;

  if (offerStatus === VEHICLE_OFFER_STATUS.OPENED) {
    const when = daysSinceOpened === 0 ? 'heute' : daysSinceOpened === 1 ? 'gestern' : `vor ${daysSinceOpened} Tagen`;
    bullets.push({ id: 'offer_opened', text: `Angebot wurde ${when} geöffnet` });
  }

  const portal = getCustomerPortalAccess(lead);
  if (portal?.openedAt || portal?.status === PORTAL_ACCESS_STATUS.OPENED) {
    bullets.push({ id: 'portal', text: 'Kunde war im Portal aktiv' });
  }
  if (portal?.viewedAt || portal?.status === PORTAL_ACCESS_STATUS.VIEWED) {
    bullets.push({ id: 'portal_viewed', text: 'Fahrzeugauswahl wurde angesehen' });
  }

  const interested = vehicleCards.some((card) => {
    const interaction = getCustomerOfferInteraction(lead, card.id);
    return interaction?.interestStatus === INTEREST_STATUS.INTERESTED;
  });
  if (interested) bullets.push({ id: 'interest', text: 'Kunde hat Interesse signalisiert' });

  if (lead?.desiredRate || lead?.currentRate) {
    bullets.push({ id: 'budget', text: 'Budget und Wunschrate sind hinterlegt' });
  }

  if (vehicleFulfillmentStatus === 'in_transit' || vehicleFulfillmentStatus === 'arriving') {
    bullets.push({ id: 'vehicle_arriving', text: 'Fahrzeug ist unterwegs / verfügbar' });
  }
  if (vehicleFulfillmentStatus === 'delivery_ready') {
    bullets.push({ id: 'delivery_ready', text: 'Fahrzeug und Zulassung sind bereit' });
  }

  if (leasingStatus === 'approved') {
    bullets.push({ id: 'leasing', text: 'Finanzierung / Leasing vorbereitet' });
  }

  const docsMissing = unterlagenSummary?.totalCount
    && unterlagenSummary.doneCount < Math.max(1, unterlagenSummary.totalCount - 1);
  if (docsMissing) {
    bullets.push({ id: 'docs_missing', text: 'Unterlagen fehlen noch' });
  } else if (selbstauskunftComplete) {
    bullets.push({ id: 'docs_ok', text: 'Unterlagen weitgehend vollständig' });
  }

  if (vehicleCards.length >= 2) {
    bullets.push({ id: 'multi_offer', text: 'Mehrere Angebote im Gespräch' });
  }

  if (daysSinceSent != null && daysSinceSent >= 2 && offerStatus === VEHICLE_OFFER_STATUS.SENT) {
    bullets.push({ id: 'no_reaction', text: `Seit ${daysSinceSent} Tagen keine Reaktion` });
  }

  if (recommendation?.reason && !bullets.some((b) => b.text === recommendation.reason)) {
    bullets.push({ id: 'engine_reason', text: recommendation.reason });
  }

  if (primaryCard?.model || primaryCard?.trim) {
    bullets.push({
      id: 'vehicle',
      text: `Fahrzeug: ${[primaryCard.model, primaryCard.trim].filter(Boolean).join(' ')}`.trim(),
    });
  }

  return bullets.slice(0, 7);
}

function resolveHeadline(recommendation) {
  return HEADLINE_BY_ACTION[recommendation?.actionId]
    ?? recommendation?.ctaLabel
    ?? recommendation?.title
    ?? 'Jetzt handeln';
}

function resolveDoneOption(recommendation) {
  const handler = recommendation?.handlerType;
  if (handler === 'call') return DONE_OPTIONS_BY_HANDLER.call;
  if (handler === 'offer_followup' || handler === 'portal_viewed_followup') {
    return DONE_OPTIONS_BY_HANDLER.offer_followup;
  }
  if (handler === 'portal_followup' || handler === 'portal_code_remind') {
    return DONE_OPTIONS_BY_HANDLER.portal_followup;
  }
  if (handler === 'documents' || handler === 'leasing_submit' || handler === 'unterlagen') {
    return DONE_OPTIONS_BY_HANDLER.documents;
  }
  return DONE_OPTIONS_BY_HANDLER.default;
}

function buildContactActions({ recommendation, phone, email, telHref, offerPath }) {
  const actions = [];
  const canCall = Boolean(telHref || phone);

  if (canCall) {
    actions.push({
      id: 'call',
      label: '📞 Anrufen',
      type: 'call',
      href: telHref ?? (phone ? `tel:${phone.replace(/\s/g, '')}` : null),
      primary: recommendation?.handlerType === 'call',
    });
  }

  if (phone) {
    const digits = phone.replace(/\D/g, '');
    const waMessage = recommendation?.explanation
      ? `Hallo, ${recommendation.explanation}`
      : 'Hallo, kurze Rückmeldung zu Ihrem Fahrzeugangebot.';
    actions.push({
      id: 'whatsapp',
      label: '💬 WhatsApp',
      type: 'whatsapp',
      href: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(waMessage)}` : null,
    });
  }

  if (email) {
    const subject = encodeURIComponent('Ihr Fahrzeugangebot');
    const body = encodeURIComponent(recommendation?.explanation ?? '');
    actions.push({
      id: 'email',
      label: '✉️ Mail',
      type: 'email',
      href: `mailto:${email}?subject=${subject}&body=${body}`,
    });
  }

  if (offerPath) {
    actions.push({
      id: 'offer',
      label: '📄 Angebot öffnen',
      type: 'offer',
      href: offerPath,
    });
  }

  return actions.filter((a) => a.href || a.type === 'offer');
}

/**
 * Vollständiges View-Model für Clever-Empfiehlt-Karte.
 */
export function buildCleverEmpfiehltView({
  lead = null,
  vehicleCards = [],
  offerSelectionGroups = [],
  customerName = '',
  excludedActionIds = [],
  telHref = null,
  offerPath = null,
} = {}) {
  const context = buildCleverActionContext({
    lead,
    vehicleCards,
    offerSelectionGroups,
    customerName,
  });

  const recommendation = recommendCleverActionExcluding(context, excludedActionIds)
    ?? buildCleverActionRecommendation({ lead, vehicleCards, offerSelectionGroups, customerName });

  if (!recommendation) return null;

  const closureChance = computeAbschlusschance(context);
  const whyBullets = collectWhyBullets(context, recommendation);
  const phone = lead?.contact?.phone ?? '';
  const email = lead?.contact?.email ?? '';

  return {
    actionId: recommendation.actionId,
    headline: resolveHeadline(recommendation),
    subline: recommendation.explanation ?? recommendation.reason ?? '',
    closureChance,
    closureLabel: `${closureChance} %`,
    stars: starsFromClosure(closureChance),
    starLabel: starLabel(starsFromClosure(closureChance)),
    whyBullets,
    whySummary: whyBullets.slice(0, 3).map((b) => b.text).join(' · '),
    actions: buildContactActions({
      recommendation,
      phone,
      email,
      telHref,
      offerPath,
    }),
    doneOption: resolveDoneOption(recommendation),
    recommendation,
    analyticsText: formatCleverRecommendationHistoryText(recommendation),
    handlerType: recommendation.handlerType,
    meta: recommendation.meta,
    title: recommendation.title,
    ctaLabel: recommendation.ctaLabel,
  };
}

/**
 * Verkäufer-Dashboard: priorisierte Liste über alle Leads.
 */
export function buildCleverEmpfiehltToday(leads = [], { maxItems = 12 } = {}) {
  const items = [];

  for (const lead of leads) {
    if (!lead?.id || lead.status === 'verloren') continue;

    const vehicleCards = buildVehicleOpportunityCards({ lead });
    const groups = resolveOfferSelectionGroups({ lead });
    const view = buildCleverEmpfiehltView({
      lead,
      vehicleCards,
      offerSelectionGroups: groups,
      customerName: lead.contact?.name ?? '',
    });

    if (!view) continue;

    items.push({
      leadId: lead.id,
      customerName: lead.contact?.name ?? 'Kunde',
      headline: view.headline,
      subline: view.subline,
      closureChance: view.closureChance,
      stars: view.stars,
      starLabel: view.starLabel,
      actionId: view.actionId,
      whySummary: view.whySummary,
      priority: view.recommendation?.priority ?? 99,
    });
  }

  return items
    .sort((a, b) => {
      if (b.closureChance !== a.closureChance) return b.closureChance - a.closureChance;
      return a.priority - b.priority;
    })
    .slice(0, maxItems);
}

export function buildLeadEmpfiehltContext(lead) {
  const vehicleCards = buildVehicleOpportunityCards({ lead });
  const offerSelectionGroups = resolveOfferSelectionGroups({ lead });
  return { lead, vehicleCards, offerSelectionGroups };
}
