/**
 * Review-Model für „Clever hat verstanden“ (Display only).
 */
import { SELLER_FACT_CLASS, SELLER_INPUT_MODE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { INLINE_RESULT_TYPES } from '../dealer/sellerInlineComposerAssist.js';

const GROUP_ORDER = [
  { id: 'customer', title: 'Kunde', classes: [SELLER_FACT_CLASS.CUSTOMER_FACT] },
  {
    id: 'appointment',
    title: 'Termin',
    classes: [SELLER_FACT_CLASS.APPOINTMENT_FACT],
  },
  {
    id: 'wish',
    title: 'Interesse',
    classes: [
      SELLER_FACT_CLASS.VEHICLE_INTEREST,
      SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      SELLER_FACT_CLASS.CUSTOMER_NEED,
    ],
  },
  {
    id: 'vehicle_current',
    title: 'Aktuelles Fahrzeug',
    classes: [SELLER_FACT_CLASS.EXISTING_VEHICLE, SELLER_FACT_CLASS.TRADE_IN_FACT],
  },
  {
    id: 'finance',
    title: 'Finanziell',
    classes: [SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT, SELLER_FACT_CLASS.FINANCE_FACT, SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE],
  },
  { id: 'contract', title: 'Vertrag', classes: [SELLER_FACT_CLASS.CONTRACT_FACT] },
  {
    id: 'offer',
    title: 'Angebot',
    classes: [SELLER_FACT_CLASS.OFFER_INSTRUCTION],
  },
  {
    id: 'other',
    title: 'Weiteres',
    classes: [
      SELLER_FACT_CLASS.DOCUMENT_FACT,
      SELLER_FACT_CLASS.SELLER_FACT,
      SELLER_FACT_CLASS.SELLER_NOTE,
      SELLER_FACT_CLASS.PROCESS_INSTRUCTION,
      SELLER_FACT_CLASS.MESSAGE_INSTRUCTION,
      SELLER_FACT_CLASS.VEHICLE_FACT_REQUEST,
    ],
  },
];

function formatKm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('de-DE')} km/Jahr`;
}

/**
 * Offer-Delta + Nachrichten-Entwurf aus Turn ableiten.
 * @param {object} turn
 */
export function buildUniversalActionSections(turn = {}) {
  const sections = [];
  const facts = turn.extractedFacts ?? [];
  const offerCtx = turn.currentOfferContext
    || turn.relevantCustomerContext?.currentOffer
    || null;
  const prepared = turn.preparedActions ?? [];

  const offerUpdate = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.PREPARE_OFFER
    && a.status === 'prepared'
    && a.payload?.updateOnly
  ));
  const commercialFacts = facts.filter(
    (f) => f.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
  );

  if (offerCtx && (offerUpdate || commercialFacts.length)) {
    const changes = [];
    const mileageFact = commercialFacts.find((f) => f.field === 'annualMileage');
    const termFact = commercialFacts.find((f) => (
      f.field === 'termMonths' || f.field === 'durationMonths'
    ));
    const rateFact = commercialFacts.find((f) => (
      f.field === 'monthlyBudget' || f.field === 'desiredRate'
    ));
    const downFact = commercialFacts.find((f) => f.field === 'downPayment');

    if (mileageFact && offerCtx.mileagePerYear != null) {
      changes.push({
        id: 'mileage',
        label: 'Fahrleistung',
        from: formatKm(offerCtx.mileagePerYear),
        to: formatKm(mileageFact.value) || mileageFact.label,
      });
    } else if (mileageFact) {
      changes.push({
        id: 'mileage',
        label: 'Fahrleistung',
        from: null,
        to: formatKm(mileageFact.value) || mileageFact.label,
      });
    }

    if (termFact && offerCtx.termMonths != null) {
      changes.push({
        id: 'term',
        label: 'Laufzeit',
        from: `${offerCtx.termMonths} Monate`,
        to: termFact.value != null ? `${termFact.value} Monate` : termFact.label,
      });
    }

    if (rateFact) {
      changes.push({
        id: 'rate',
        label: 'Rate',
        from: offerCtx.monthlyRate != null
          ? `${Number(offerCtx.monthlyRate).toLocaleString('de-DE')} €/Monat`
          : null,
        to: rateFact.label,
      });
    }

    if (downFact) {
      changes.push({
        id: 'down',
        label: 'Sonderzahlung',
        from: null,
        to: downFact.label,
      });
    }

    if (!changes.length && commercialFacts.length) {
      changes.push({
        id: 'commercial',
        label: 'Konditionen',
        from: offerCtx.summary || null,
        to: commercialFacts.map((f) => f.label).join(' · '),
      });
    }

    if (changes.length) {
      sections.push({
        id: 'offer_change',
        kind: 'offer_change',
        title: 'Angebot',
        headline: offerCtx.title || offerCtx.summary || 'Aktives Angebot',
        changes,
        line: changes
          .map((c) => (c.from && c.to ? `${c.from} → ${c.to}` : c.to))
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  const draftAction = prepared.find((a) => (
    a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.status === 'prepared'
  ));
  const draftResult = draftAction?.legacy?.results?.find(
    (r) => r.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT,
  ) || draftAction?.legacy?.results?.[0] || null;
  const draftBody = draftResult?.draft?.body || draftResult?.body || null;
  if (draftBody) {
    sections.push({
      id: 'message_draft',
      kind: 'message_draft',
      title: 'Nachricht',
      body: String(draftBody).trim(),
    });
  }

  return sections;
}

/**
 * @param {object} turn – CleverSellerTurnResult
 */
export function buildUniversalReviewModel(turn = {}) {
  const facts = turn.extractedFacts ?? [];
  if (!facts.length) return null;

  const used = new Set();
  const groups = [];

  for (const def of GROUP_ORDER) {
    const items = [];
    for (const factClass of def.classes) {
      for (const f of facts) {
        if (f.factClass !== factClass || !f.label) continue;
        const key = `${f.factClass}:${f.field}:${f.label}`;
        if (used.has(key)) continue;
        used.add(key);
        items.push(f);
      }
    }
    if (!items.length) continue;
    groups.push({
      id: def.id,
      title: def.title,
      items: items.map((f) => ({
        label: f.label,
        field: f.field,
        factClass: f.factClass,
        needsConfirmation: Boolean(f.needsConfirmation),
        confidence: f.confidence,
      })),
      line: items.map((f) => f.label).join(' · '),
    });
  }

  if (!groups.length) return null;

  const openMissing = (turn.missingInformation ?? []).slice(0, 3);
  const actionSections = buildUniversalActionSections(turn);
  const multiAction = actionSections.length > 1;

  return {
    title: multiAction ? '✨ Clever hat vorbereitet' : '✨ Clever hat verstanden',
    groups,
    actionSections,
    factCount: facts.length,
    summaryLine: multiAction
      ? `${actionSections.length} Aktionen vorbereitet`
      : `Neu erkannt: ${facts.length} Angabe${facts.length === 1 ? '' : 'n'}`,
    missingLine: openMissing.length
      ? `Noch offen: ${openMissing.map((m) => m.label).join('; ')}`
      : null,
    warnings: turn.warnings ?? [],
    assistantReply: turn.assistantReply ?? null,
    primaryCta: multiAction ? 'Änderungen prüfen' : 'Übernehmen',
    secondaryCta: 'Verwerfen',
  };
}

/**
 * Wann die Universal-Review Vorrang vor Offer/Inline hat.
 * @param {object} turn
 */
export function shouldShowUniversalReview(turn = {}) {
  const facts = turn.extractedFacts ?? [];
  if (!facts.length) return false;

  const dumpClass = new Set([
    SELLER_FACT_CLASS.CUSTOMER_FACT,
    SELLER_FACT_CLASS.CUSTOMER_NEED,
    SELLER_FACT_CLASS.VEHICLE_INTEREST,
    SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
    SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
    SELLER_FACT_CLASS.OFFER_INSTRUCTION,
    SELLER_FACT_CLASS.EXISTING_VEHICLE,
    SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
    SELLER_FACT_CLASS.CONTRACT_FACT,
    SELLER_FACT_CLASS.APPOINTMENT_FACT,
  ]);

  // Reine Kundennachricht ohne CRM-Kontext → kein Review (nur Message-Draft)
  if (turn.inputMode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE) {
    if (!facts.some((f) => dumpClass.has(f.factClass))) return false;
  }

  const hasPortfolio = turn.intents?.some((i) => i.type === 'send_portfolio');
  const hasContextIntent = turn.intents?.some((i) => i.type === 'update_customer_context');
  // Reiner Portfolio-Cue ohne Kontext-Fakten → Inline-CTA (kein Review)
  if (hasPortfolio && !hasContextIntent && facts.length < 2) {
    const portfolioDump = new Set([
      SELLER_FACT_CLASS.CUSTOMER_FACT,
      SELLER_FACT_CLASS.CUSTOMER_NEED,
      SELLER_FACT_CLASS.VEHICLE_INTEREST,
      SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      SELLER_FACT_CLASS.EXISTING_VEHICLE,
      SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
      SELLER_FACT_CLASS.CONTRACT_FACT,
      SELLER_FACT_CLASS.APPOINTMENT_FACT,
    ]);
    if (!facts.some((f) => portfolioDump.has(f.factClass))) return false;
  }

  // Multi-Aktion (Offer-Update + Nachricht) immer als Review
  if (buildUniversalActionSections(turn).length > 1) return true;

  if (facts.length >= 2) return true;
  if (hasContextIntent) return true;
  return facts.some((f) => dumpClass.has(f.factClass));
}
