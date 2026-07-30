/**
 * Lieferzeit als offene Kundenfrage (Customer Truth).
 * Status: open → answered. Keine Kaufwahrscheinlichkeiten.
 */

export const DELIVERY_TIME_QUESTION_ID = 'delivery_time';
export const DELIVERY_TIME_FIELD = 'deliveryTime';

export const DELIVERY_TIME_STATUS = {
  OPEN: 'open',
  ANSWERED: 'answered',
};

export const DELIVERY_TIME_PENDING_PORTAL = 'Die Lieferzeit wird aktuell noch geprüft.';

/**
 * @param {object} [overrides]
 */
export function createOpenDeliveryTimeQuestion(overrides = {}) {
  return {
    id: DELIVERY_TIME_QUESTION_ID,
    field: DELIVERY_TIME_FIELD,
    status: DELIVERY_TIME_STATUS.OPEN,
    question: 'Wie ist die Lieferzeit?',
    label: 'Lieferzeit beantworten',
    answerText: null,
    answerDisplay: null,
    approximate: true,
    weeksMin: null,
    weeksMax: null,
    months: null,
    source: null,
    answeredAt: null,
    answeredBy: null,
    ...overrides,
    id: DELIVERY_TIME_QUESTION_ID,
    field: DELIVERY_TIME_FIELD,
    status: overrides.status || DELIVERY_TIME_STATUS.OPEN,
  };
}

/**
 * @param {object} lead
 * @returns {object|null}
 */
export function getDeliveryTimeQuestion(lead = {}) {
  const q = lead?.crm?.customerTruth?.deliveryTimeQuestion;
  if (q && typeof q === 'object') {
    return {
      ...createOpenDeliveryTimeQuestion(),
      ...q,
      id: DELIVERY_TIME_QUESTION_ID,
      field: DELIVERY_TIME_FIELD,
    };
  }
  if (lead?.crm?.customerTruth?.deliveryTimeOpen === true) {
    return createOpenDeliveryTimeQuestion();
  }
  return null;
}

/**
 * @param {object} lead
 */
export function isDeliveryTimeOpen(lead = {}) {
  const q = getDeliveryTimeQuestion(lead);
  if (q) return q.status === DELIVERY_TIME_STATUS.OPEN;
  return lead?.crm?.customerTruth?.deliveryTimeOpen === true;
}

/**
 * Portal-Text: pending oder „Aktuelle Lieferzeit: ungefähr …“
 * @param {object|null} question
 * @param {object} [lead]
 */
export function formatDeliveryTimePortalNote(question = null, lead = {}) {
  const q = question || getDeliveryTimeQuestion(lead);
  if (!q) {
    if (lead?.crm?.customerTruth?.deliveryTimePlaceholder) {
      return lead.crm.customerTruth.deliveryTimePlaceholder;
    }
    return null;
  }
  if (q.status === DELIVERY_TIME_STATUS.OPEN) {
    return DELIVERY_TIME_PENDING_PORTAL;
  }
  if (q.status === DELIVERY_TIME_STATUS.ANSWERED && q.answerDisplay) {
    return q.answerDisplay;
  }
  if (q.status === DELIVERY_TIME_STATUS.ANSWERED && q.answerText) {
    return buildAnswerDisplay(q.answerText);
  }
  return null;
}

/**
 * @param {string} answerText
 */
export function buildAnswerDisplay(answerText = '') {
  const cleaned = String(answerText)
    .replace(/^\s*(?:ca\.?|circa|ungefähr|ungefaehr)\s*/i, '')
    .trim();
  if (!cleaned) return null;
  return `Aktuelle Lieferzeit: ungefähr ${cleaned}`;
}

/**
 * Notizzettel-Label für beantwortete Lieferzeit.
 * @param {object} question
 */
export function formatDeliveryTimeAnsweredChip(question = {}) {
  const text = question.answerText || question.answerDisplay;
  if (!text) return 'Lieferzeit beantwortet';
  const cleaned = String(text)
    .replace(/^Aktuelle Lieferzeit:\s*/i, '')
    .replace(/^\s*(?:ca\.?|circa|ungefähr|ungefaehr)\s*/i, '')
    .trim();
  return cleaned ? `Lieferzeit ca. ${cleaned}` : 'Lieferzeit beantwortet';
}

/**
 * Seller-/Fact-Antwort auf die offene Frage anwenden.
 *
 * @param {object} lead
 * @param {{
 *   answerText?: string,
 *   weeksMin?: number|null,
 *   weeksMax?: number|null,
 *   months?: number|null,
 *   approximate?: boolean,
 *   source?: string|null,
 *   answeredBy?: string|null,
 *   answeredAt?: string|null,
 * }} answer
 */
export function answerDeliveryTimeOnLead(lead = {}, answer = {}) {
  const answerText = String(answer.answerText ?? '').trim();
  if (!answerText) return lead;

  const prev = getDeliveryTimeQuestion(lead) || createOpenDeliveryTimeQuestion();
  const answerDisplay = buildAnswerDisplay(answerText);
  const question = {
    ...prev,
    status: DELIVERY_TIME_STATUS.ANSWERED,
    answerText,
    answerDisplay,
    approximate: answer.approximate !== false,
    weeksMin: answer.weeksMin ?? prev.weeksMin ?? null,
    weeksMax: answer.weeksMax ?? prev.weeksMax ?? null,
    months: answer.months ?? prev.months ?? null,
    source: answer.source || 'seller_input',
    answeredAt: answer.answeredAt || new Date().toISOString(),
    answeredBy: answer.answeredBy ?? null,
    label: formatDeliveryTimeAnsweredChip({ answerText }),
  };

  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      customerTruth: {
        ...(lead.crm?.customerTruth ?? {}),
        deliveryTimeQuestion: question,
        deliveryTimeOpen: false,
        deliveryTimePlaceholder: answerDisplay,
      },
    },
  };
}

/**
 * Offene Lieferzeitfrage auf Lead setzen (Customer Truth).
 * @param {object} lead
 * @param {object} [overrides]
 */
export function openDeliveryTimeOnLead(lead = {}, overrides = {}) {
  const question = createOpenDeliveryTimeQuestion(overrides);
  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      customerTruth: {
        ...(lead.crm?.customerTruth ?? {}),
        deliveryTimeQuestion: question,
        deliveryTimeOpen: true,
        deliveryTimePlaceholder: DELIVERY_TIME_PENDING_PORTAL,
      },
    },
  };
}

/**
 * Seller-Text → strukturierte Lieferzeit-Antwort (keine Erfindung).
 * @param {string} text
 * @returns {object|null}
 */
export function parseDeliveryTimeAnswerFromText(text = '') {
  const t = String(text ?? '').trim();
  if (!t) return null;

  // ca. 8–12 Wochen / 8 bis 12 Wochen / ungefähr 8-12 Wochen
  const weeksRange = t.match(
    /\b(?:lieferzeit|lieferbar)?\s*(?:ca\.?\s*|circa\s*|ungefähr\s*|ungefaehr\s*)?(\d{1,2})\s*(?:–|-|bis)\s*(\d{1,2})\s*wochen?\b/i,
  ) || t.match(
    /\b(\d{1,2})\s*(?:–|-|bis)\s*(\d{1,2})\s*wochen?\b/i,
  );
  if (weeksRange && (/\bliefer/i.test(t) || /\bwochen?\b/i.test(t))) {
    const weeksMin = Number(weeksRange[1]);
    const weeksMax = Number(weeksRange[2]);
    if (weeksMin && weeksMax && weeksMax >= weeksMin) {
      return {
        answerText: `${weeksMin}–${weeksMax} Wochen`,
        weeksMin,
        weeksMax,
        months: null,
        approximate: true,
      };
    }
  }

  // ca. 10 Wochen
  const weeksSingle = t.match(
    /\b(?:lieferzeit|lieferbar)\s*(?:ca\.?\s*|circa\s*|ungefähr\s*|ungefaehr\s*)?(\d{1,2})\s*wochen?\b/i,
  ) || (/\bliefer/i.test(t) && t.match(/\b(?:ca\.?\s*|circa\s*|ungefähr\s*)?(\d{1,2})\s*wochen?\b/i));
  if (weeksSingle) {
    const weeks = Number(weeksSingle[1]);
    if (weeks) {
      return {
        answerText: `${weeks} Wochen`,
        weeksMin: weeks,
        weeksMax: weeks,
        months: null,
        approximate: true,
      };
    }
  }

  // ca. 2–3 Monate / Lieferzeit ca. 3 Monate
  const monthsRange = t.match(
    /\b(?:lieferzeit|lieferbar)\s*(?:ca\.?\s*|circa\s*|ungefähr\s*)?(\d{1,2})\s*(?:–|-|bis)\s*(\d{1,2})\s*monate?\b/i,
  );
  if (monthsRange) {
    const a = Number(monthsRange[1]);
    const b = Number(monthsRange[2]);
    if (a && b && b >= a) {
      return {
        answerText: `${a}–${b} Monate`,
        weeksMin: null,
        weeksMax: null,
        months: b,
        approximate: true,
      };
    }
  }

  const monthsSingle = t.match(
    /\b(?:lieferzeit|lieferbar)\s*(?:ca\.?\s*|circa\s*|ungefähr\s*)?(\d{1,2})\s*monate?\b/i,
  );
  if (monthsSingle) {
    const months = Number(monthsSingle[1]);
    if (months) {
      return {
        answerText: `${months} Monate`,
        weeksMin: null,
        weeksMax: null,
        months,
        approximate: true,
      };
    }
  }

  return null;
}
