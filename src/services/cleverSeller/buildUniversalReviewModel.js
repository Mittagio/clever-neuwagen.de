/**
 * Review-Model für „Clever hat verstanden“ (Display only).
 */
import { SELLER_FACT_CLASS, SELLER_INPUT_MODE } from './sellerFactTypes.js';

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

  return {
    title: '✨ Clever hat verstanden',
    groups,
    factCount: facts.length,
    summaryLine: `Neu erkannt: ${facts.length} Angabe${facts.length === 1 ? '' : 'n'}`,
    missingLine: openMissing.length
      ? `Noch offen: ${openMissing.map((m) => m.label).join('; ')}`
      : null,
    warnings: turn.warnings ?? [],
    assistantReply: turn.assistantReply ?? null,
    primaryCta: 'Übernehmen',
    secondaryCta: 'Verwerfen',
  };
}

/**
 * Wann die Universal-Review Vorrang vor Offer/Inline hat.
 * @param {object} turn
 */
export function shouldShowUniversalReview(turn = {}) {
  if (turn.inputMode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE) return false;
  if (turn.intents?.some((i) => i.type === 'send_portfolio')) return false;

  const facts = turn.extractedFacts ?? [];
  if (!facts.length) return false;
  if (facts.length >= 2) return true;
  if (turn.intents?.some((i) => i.type === 'update_customer_context')) return true;
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
  return facts.some((f) => dumpClass.has(f.factClass));
}
