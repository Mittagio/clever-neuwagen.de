/**
 * Zero-Loss Intake – kein bedeutungstragender Seller-Input darf verloren gehen.
 * @see docs/CLEVER_ZERO_LOSS_INTAKE.md
 */
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';

export const ZERO_LOSS_BUCKET = {
  STRUCTURED_CUSTOMER_FACT: 'structured_customer_fact',
  VEHICLE_PREFERENCE: 'vehicle_preference',
  COMMERCIAL_PREFERENCE: 'commercial_preference',
  EXISTING_VEHICLE_OR_TRADE_IN: 'existing_vehicle_or_trade_in',
  EQUIPMENT_OR_TECHNICAL_NEED: 'equipment_or_technical_need',
  PERSONAL_NOTE: 'personal_note',
  PREPARED_ACTION: 'prepared_action',
  UNRESOLVED_NOTE: 'unresolved_note',
};

/** Bekannte Kia-Tippfehler / Umgangssprache → kanonisches Modell (nur mit Registry-Support). */
export const SELLER_MODEL_ALIASES = Object.freeze({
  eq2: 'ev2',
  eq3: 'ev3',
  eq4: 'ev4',
  eq5: 'ev5',
  pv2: 'ev2',
  pv3: 'ev3',
  pv4: 'ev4',
  pv5: 'ev5',
  'e v2': 'ev2',
  'e-v2': 'ev2',
});

const FILLER_TOKENS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'einer',
  'und', 'oder', 'aber', 'auch', 'noch', 'mal', 'dann', 'denn',
  'hat', 'habt', 'haben', 'ist', 'sind', 'war', 'wird', 'werden',
  'er', 'sie', 'ihm', 'ihr', 'ihn', 'herr', 'frau', 'kunde', 'kundin',
  'gern', 'gerne', 'hätte', 'haette', 'mag', 'am', 'besten', 'lieber',
  'ca', 'circa', 'etwa', 'vielleicht', 'wohl', 'schon', 'sehr',
  'für', 'fuer', 'von', 'mit', 'ohne', 'wie', 'sein', 'seinen', 'seiner',
  'wäre', 'waere', 'wichtig', 'sofort', 'fährt', 'faehrt', 'fahren',
]);

/**
 * @param {string} rawMention
 * @returns {{ canonical: string|null, ambiguous: boolean, rawExpression: string }}
 */
export function resolveSellerModelAlias(rawMention = '') {
  const rawExpression = String(rawMention || '').trim();
  const key = rawExpression.toLowerCase().replace(/\s+/g, ' ');
  const canonical = SELLER_MODEL_ALIASES[key] || null;
  if (!canonical) {
    // Kein Alias-Treffer ≠ Unsicherheit: „EV4“/„Sportage“ sind kanonisch und
    // brauchen keine Confirm nur weil sie nicht in der Tippfehler-Tabelle stehen.
    return { canonical: null, ambiguous: false, rawExpression };
  }
  return { canonical, ambiguous: false, rawExpression };
}

/**
 * @param {object} fact
 * @returns {string}
 */
export function bucketForFact(fact = {}) {
  const cls = fact.factClass;
  if (fact.field === 'unresolvedNote' || fact.preserveAsNote) {
    return ZERO_LOSS_BUCKET.UNRESOLVED_NOTE;
  }
  if (cls === SELLER_FACT_CLASS.CUSTOMER_FACT || cls === SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT) {
    return ZERO_LOSS_BUCKET.STRUCTURED_CUSTOMER_FACT;
  }
  if (cls === SELLER_FACT_CLASS.CUSTOMER_NEED || cls === SELLER_FACT_CLASS.VEHICLE_REQUIREMENT) {
    return ZERO_LOSS_BUCKET.EQUIPMENT_OR_TECHNICAL_NEED;
  }
  if (cls === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE || cls === SELLER_FACT_CLASS.FINANCE_FACT) {
    return ZERO_LOSS_BUCKET.COMMERCIAL_PREFERENCE;
  }
  if (cls === SELLER_FACT_CLASS.VEHICLE_INTEREST || cls === SELLER_FACT_CLASS.OFFER_INSTRUCTION) {
    return ZERO_LOSS_BUCKET.VEHICLE_PREFERENCE;
  }
  if (cls === SELLER_FACT_CLASS.EXISTING_VEHICLE || cls === SELLER_FACT_CLASS.TRADE_IN_FACT) {
    return ZERO_LOSS_BUCKET.EXISTING_VEHICLE_OR_TRADE_IN;
  }
  if (cls === SELLER_FACT_CLASS.SELLER_NOTE) {
    return fact.field === 'unresolvedNote'
      ? ZERO_LOSS_BUCKET.UNRESOLVED_NOTE
      : ZERO_LOSS_BUCKET.PERSONAL_NOTE;
  }
  if (cls === SELLER_FACT_CLASS.PROCESS_INSTRUCTION || cls === SELLER_FACT_CLASS.MESSAGE_INSTRUCTION) {
    return ZERO_LOSS_BUCKET.PREPARED_ACTION;
  }
  return ZERO_LOSS_BUCKET.PERSONAL_NOTE;
}

/**
 * Heuristik: bedeutungstragende Segmente, die nicht durch Fact-Labels abgedeckt sind.
 * @param {string} sellerInput
 * @param {object[]} facts
 * @returns {string[]}
 */
export function findUnconsumedMeaningSpans(sellerInput = '', facts = []) {
  const raw = String(sellerInput || '').trim();
  if (!raw) return [];

  let remaining = raw;
  for (const fact of facts) {
    const needles = [
      fact.rawExpression,
      fact.span,
      fact.label,
      typeof fact.value === 'string' ? fact.value : null,
    ].filter(Boolean);
    for (const needle of needles) {
      const n = String(needle).trim();
      if (n.length < 2) continue;
      remaining = remaining.replace(new RegExp(escapeRegExp(n), 'ig'), ' ');
    }
    if (fact.field === 'childrenCount' && fact.value != null) {
      remaining = remaining.replace(
        new RegExp(`\\b${fact.value}\\s*kinder?\\b|\\bzwei\\s*kinder\\b`, 'ig'),
        ' ',
      );
    }
    if (fact.field === 'pet' || fact.field === 'hasPet') {
      remaining = remaining.replace(/\b(?:einen?\s+)?hund(?:e)?\b|\bkatze\b/ig, ' ');
    }
    if (fact.field === 'monthlyBudget' && fact.value != null) {
      remaining = remaining.replace(
        new RegExp(
          `\\b${fact.value}\\s*(?:€|euro)?\\s*(?:wunsch)?rate\\b|\\bwunschrate\\s*(?:ca\\.?\\s*)?${fact.value}\\s*(?:€|euro)?\\b|\\b${fact.value}\\s*(?:€|euro)\\b`,
          'ig',
        ),
        ' ',
      );
    }
    if (fact.field === 'termMonths' && fact.value != null) {
      remaining = remaining.replace(
        new RegExp(`\\b${fact.value}\\s*(?:monate?|mts?)?\\b`, 'ig'),
        ' ',
      );
    }
    if (
      (fact.field === 'annualMileage' || fact.field === 'mileagePerYear')
      && fact.value != null
    ) {
      const plain = String(fact.value);
      const de = Number(fact.value).toLocaleString('de-DE');
      remaining = remaining.replace(
        new RegExp(
          `\\b(?:${escapeRegExp(de)}|${escapeRegExp(plain)})\\s*(?:tkm|km)\\b`,
          'ig',
        ),
        ' ',
      );
    }
    if (fact.field === 'downPayment' && fact.value != null) {
      const num = String(fact.value).replace(/\./g, '\\.?');
      remaining = remaining.replace(
        new RegExp(
          `\\banzahlung\\s*(?:von\\s*)?${num}\\s*(?:€|euro)?\\b|\\b${num}\\s*(?:€|euro)?\\s*(?:az|anzahlung)\\b|\\b${num}\\s*(?:€|euro)\\b`,
          'ig',
        ),
        ' ',
      );
    }
    if (
      fact.field === 'street'
      || fact.field === 'postalCode'
      || fact.field === 'zip'
      || fact.field === 'city'
      || fact.field === 'address'
    ) {
      const addrNeedles = [
        fact.label,
        typeof fact.value === 'string' ? fact.value : null,
        fact.value?.street,
        fact.value?.houseNumber,
        fact.value?.postalCode,
        fact.value?.zip,
        fact.value?.city,
        fact.value?.formattedAddress,
      ].filter(Boolean);
      for (const needle of addrNeedles) {
        const n = String(needle).trim();
        if (n.length < 2) continue;
        remaining = remaining.replace(new RegExp(escapeRegExp(n), 'ig'), ' ');
      }
    }
    if (fact.field === 'vehicleInterest' || fact.field === 'vehicleInterestAlias') {
      remaining = remaining.replace(/\beq[2-9]\b|\bev[2-9]\b/ig, ' ');
      const trim = fact.value?.trim || fact.value?.trimLabel;
      if (trim) {
        remaining = remaining.replace(new RegExp(`\\b${escapeRegExp(String(trim))}\\b`, 'ig'), ' ');
      }
      const modelKey = fact.value?.modelKey || fact.value?.model;
      if (modelKey) {
        remaining = remaining.replace(new RegExp(`\\b${escapeRegExp(String(modelKey))}\\b`, 'ig'), ' ');
      }
    }
    if (fact.field === 'colorPreference') {
      remaining = remaining.replace(/\b(rot|blau|schwarz|weiß|weiss|grau|grün|gruen)\w*\b/ig, ' ');
    }
    if (fact.field === 'availabilityPreference' || /sofort/i.test(String(fact.label || ''))) {
      remaining = remaining.replace(/\bsofort(?:\s+verfügbar|\s+verfuegbar)?\b/ig, ' ');
    }
    if (
      fact.factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE
      || fact.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT
    ) {
      remaining = remaining.replace(
        /\b(?:gw|gebrauchtwagen)?\s*(?:smart\s+)?fortwo\b|\bsmart\s+fortwo\b|\bfährt\s+einen?\s+[\w-]+\b/ig,
        ' ',
      );
    }
  }

  remaining = remaining
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/\bquelle\s*:/gi, ' ')
    .replace(/\bes ist eine kontaktanfrage\b[^.!?\n]*/gi, ' ')
    .replace(/\b(?:über\s+das\s+)?kontaktformular\b/gi, ' ')
    .replace(/-----.*?-----/g, ' ')
    .replace(/^(?:von|from|gesendet|sent|an|to|betreff|subject)\s*:.*$/gim, ' ')
    .replace(/\bherrn?\s+\w+(?:\s+\w+)?\b/ig, ' ')
    .replace(/\bfrau\s+\w+(?:\s+\w+)?\b/ig, ' ')
    .replace(/\b(?:leasing|finanzierung|kauf)\b/ig, ' ')
    .replace(/[.,;:!?\-–—'"„“()€]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!remaining) return [];

  const clauses = remaining
    .split(/\s+(?:und|aber|sowie|außerdem|ausserdem)\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const out = [];
  for (const clause of clauses) {
    const tokens = clause.toLowerCase().split(/\s+/).filter(Boolean);
    const meaningful = tokens.filter((t) => (
      t.length > 2
      && !FILLER_TOKENS.has(t)
      && !/^\d+$/.test(t)
    ));
    if (meaningful.length >= 2 || (meaningful.length === 1 && meaningful[0].length >= 5)) {
      out.push(clause.replace(/\s+/g, ' ').trim());
    }
  }
  return dedupeStrings(out).slice(0, 8);
}

/**
 * Stellt sicher: jeder Rest landet als unresolved_note.
 * @param {{ sellerInput?: string, facts?: object[], observedAt?: string, customerName?: string }} params
 */
export function ensureZeroLossCoverage(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  const observedAt = params.observedAt || new Date().toISOString();
  const baseFacts = Array.isArray(params.facts) ? [...params.facts] : [];

  const facts = baseFacts.map((f) => enrichFactMeta(f, observedAt));
  const unconsumed = findUnconsumedMeaningSpans(sellerInput, facts);
  const unresolvedNotes = [];

  for (const text of unconsumed) {
    if (facts.some((f) => (
      f.field === 'unresolvedNote'
      && String(f.value?.text || f.label || '').toLowerCase() === text.toLowerCase()
    ))) continue;

    const noteFact = createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_NOTE,
      field: 'unresolvedNote',
      value: {
        text,
        source: 'seller_input',
        status: 'unclassified',
      },
      label: text.slice(0, 160),
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
      confidence: 0.55,
      needsConfirmation: false,
      preserveAsNote: true,
      rawExpression: text,
      observedAt,
    });
    facts.push(noteFact);
    unresolvedNotes.push({
      text,
      source: 'seller_input',
      status: 'unclassified',
      observedAt,
    });
  }

  const groups = groupFactsForIntakeUi(facts);
  const summary = buildZeroLossIntakeSummary(facts, { customerName: params.customerName });

  const noteFacts = facts.filter((f) => f.field === 'unresolvedNote');
  return {
    facts,
    unresolvedNotes: [
      ...unresolvedNotes,
      ...noteFacts.map((f) => ({
        text: f.value?.text || f.label,
        source: f.value?.source || 'seller_input',
        status: f.value?.status || 'unclassified',
        observedAt: f.observedAt || observedAt,
      })),
    ].filter((n, i, arr) => (
      arr.findIndex((x) => String(x.text).toLowerCase() === String(n.text).toLowerCase()) === i
    )),
    unconsumedInputSpans: unconsumed,
    consumedFactCount: facts.filter((f) => f.field !== 'unresolvedNote').length,
    groups,
    summary,
    zeroLoss: true,
  };
}

/**
 * Kompakte Aufnahme-Zusammenfassung für Composer-Feedback.
 * @param {object[]} facts
 * @param {{ customerName?: string }} [opts]
 */
export function buildZeroLossIntakeSummary(facts = [], opts = {}) {
  let name = String(opts.customerName || '').trim();
  if (name && !/^(herr|frau)\b/i.test(name)) {
    name = `Herrn ${name}`;
  }
  const title = name ? `Für ${name} aufgenommen` : 'Aufgenommen';

  const structured = [];
  const notes = [];
  for (const f of facts) {
    const label = String(f.label || '').trim();
    if (!label) continue;
    if (f.field === 'unresolvedNote' || f.preserveAsNote) {
      notes.push(label);
    } else {
      structured.push(label);
    }
  }

  return {
    title,
    chipLine: structured.slice(0, 12).join(' · '),
    chips: structured.slice(0, 12),
    notes,
    noteCount: notes.length,
    feedbackLine: [
      structured.length ? structured.slice(0, 8).join(' · ') : null,
      notes.length ? `Notizen · ${notes.length}` : null,
    ].filter(Boolean).join(' · ') || 'Nichts Neues',
  };
}

/**
 * @param {object[]} facts
 */
export function groupFactsForIntakeUi(facts = []) {
  const buckets = {
    mensch: { id: 'persoenliches', title: 'Persönliches', items: [] },
    bestand: { id: 'bestand', title: 'Bestandsfahrzeug', items: [] },
    budget: { id: 'budget', title: 'Budget', items: [] },
    wunsch: { id: 'wunsch', title: 'Fahrzeugwunsch', items: [] },
    wichtig: { id: 'wichtig', title: 'Ausstattung', items: [] },
    notizen: { id: 'sonstiges', title: 'Sonstiges', items: [] },
  }

  for (const f of facts) {
    const label = String(f.label || '').trim();
    if (!label) continue;
    const bucket = bucketForFact(f);
    if (bucket === ZERO_LOSS_BUCKET.UNRESOLVED_NOTE || f.field === 'unresolvedNote') {
      buckets.notizen.items.push({ label, status: 'unclassified' });
      continue;
    }
    if (bucket === ZERO_LOSS_BUCKET.STRUCTURED_CUSTOMER_FACT) {
      buckets.mensch.items.push({ label });
      continue;
    }
    if (bucket === ZERO_LOSS_BUCKET.EXISTING_VEHICLE_OR_TRADE_IN) {
      buckets.bestand.items.push({ label: label.replace(/^Inzahlungnahme:\s*/i, '') });
      continue;
    }
    if (bucket === ZERO_LOSS_BUCKET.COMMERCIAL_PREFERENCE) {
      buckets.budget.items.push({ label });
      continue;
    }
    if (bucket === ZERO_LOSS_BUCKET.VEHICLE_PREFERENCE) {
      buckets.wunsch.items.push({ label });
      continue;
    }
    if (
      bucket === ZERO_LOSS_BUCKET.EQUIPMENT_OR_TECHNICAL_NEED
      || /sofort|verfügbar|verfuegbar|dringend/i.test(label)
    ) {
      buckets.wichtig.items.push({ label });
      continue;
    }
    buckets.notizen.items.push({ label, status: 'note' });
  }

  return Object.values(buckets).filter((g) => g.items.length);
}

function enrichFactMeta(fact, observedAt) {
  if (!fact || typeof fact !== 'object') return fact;
  return {
    ...fact,
    observedAt: fact.observedAt || observedAt,
    rawExpression: fact.rawExpression || fact.span || null,
    source: fact.source || SELLER_FACT_SOURCE.SELLER_INPUT,
  };
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupeStrings(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
