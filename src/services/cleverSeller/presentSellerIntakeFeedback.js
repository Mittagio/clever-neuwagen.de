/**
 * Presenter: Interpretation → Composer-Feedback / Chips / Warning.
 * Keine neue Interpret-Logik – nur Anzeige & Partial-Success-Policy.
 */

const ZERO_MILEAGE_LABEL_RE = /^0(\.0+)?\s*km(\s*\/?\s*jahr)?$/i;
const NOTE_COUNTER_RE = /^notizen\s*·\s*\d+$/i;
const HINT_COUNTER_RE = /^\d+\s*hinweise?$/i;

/**
 * Fachlich sinnvolle Facts (nicht nur unresolved note).
 * @param {object[]} facts
 */
export function countUsableIntakeFacts(facts = []) {
  return (facts || []).filter((f) => {
    if (!f || typeof f !== 'object') return false;
    if (f.field === 'unresolvedNote' || f.preserveAsNote) return false;
    if (isBogusZeroCommercialFact(f)) return false;
    const label = String(f.label || '').trim();
    return Boolean(label || f.field);
  }).length;
}

/**
 * annualMileage/termMonths mit Wert 0 sind Missing – kein Fachwert.
 * downPayment 0 bleibt gültig.
 * @param {object} fact
 */
export function isBogusZeroCommercialFact(fact = {}) {
  const field = String(fact.field || '');
  if (field === 'annualMileage' || field === 'mileagePerYear') {
    const n = Number(fact.value);
    if (Number.isFinite(n) && n <= 0) return true;
    if (ZERO_MILEAGE_LABEL_RE.test(String(fact.label || '').trim())) return true;
  }
  if (field === 'termMonths' || field === 'durationMonths') {
    const n = Number(fact.value);
    if (Number.isFinite(n) && n <= 0) return true;
  }
  return false;
}

/**
 * Chip-Label für Display – null wenn nicht rendern.
 * @param {string|object} chipOrFact
 */
export function sanitizeIntakeChipLabel(chipOrFact) {
  if (chipOrFact == null) return null;
  if (typeof chipOrFact === 'object') {
    if (isBogusZeroCommercialFact(chipOrFact)) return null;
    if (chipOrFact.field === 'unresolvedNote' || chipOrFact.preserveAsNote) return null;
    const base = String(chipOrFact.label || '').trim();
    if (!base || NOTE_COUNTER_RE.test(base) || HINT_COUNTER_RE.test(base)) return null;
    if (ZERO_MILEAGE_LABEL_RE.test(base)) return null;
    if (chipOrFact.needsConfirmation) {
      return /prüfen/i.test(base) ? base : `${base} · prüfen`;
    }
    return base;
  }
  const label = String(chipOrFact || '').trim();
  if (!label || NOTE_COUNTER_RE.test(label) || HINT_COUNTER_RE.test(label)) return null;
  if (ZERO_MILEAGE_LABEL_RE.test(label)) return null;
  return label;
}

/**
 * @param {Array<string|object>} chipsOrFacts
 * @returns {string[]}
 */
export function sanitizeIntakeDisplayChips(chipsOrFacts = []) {
  const out = [];
  const seen = new Set();
  for (const item of chipsOrFacts || []) {
    const label = sanitizeIntakeChipLabel(item);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Partial Success mit brauchbaren Facts ≠ globaler Interpretationsausfall.
 * @param {object} turn
 */
export function hasUsablePartialSuccess(turn = {}) {
  const facts = turn.extractedFacts || turn.rememberDecision?.safeFacts || [];
  if (countUsableIntakeFacts(facts) >= 1) return true;
  const chips = turn.zeroLossIntake?.summary?.chips || [];
  if (sanitizeIntakeDisplayChips(chips).length >= 1) return true;
  const mode = turn.rememberDecision?.mode;
  if (mode === 'save_with_undo' || mode === 'partial_save_with_undo') {
    return countUsableIntakeFacts(turn.rememberDecision?.safeFacts || facts) >= 1;
  }
  return false;
}

/**
 * Globaler Warning nur bei echtem Ausfall ohne brauchbaren Fallback.
 * @param {object} turn
 */
export function shouldShowGlobalInterpretWarning(turn = {}) {
  if (!turn || typeof turn !== 'object') return false;
  if (hasUsablePartialSuccess(turn)) return false;

  const source = turn.interpreterDiagnostics?.interpreterSource
    || turn.openaiEscalation?.interpreterSource
    || null;
  const hardError = Boolean(
    turn.interpreterDiagnostics?.error
    || turn.openaiEscalation?.error,
  );
  const isFallback = source === 'fallback' || source === 'openai_fallback';

  // Kein Fact, kein Remember – und Fallback/Hard-Error
  if (isFallback || hardError) return true;

  const warnings = turn.warnings || [];
  return warnings.some((w) => /gesamten Fall nicht vollständig|fachlich gar nicht verarbeitet/i.test(String(w || '')));
}

/**
 * Kurzer Next-Step für Composer (ohne System-Essay).
 * @param {object|null} next
 */
export function presentIntakeNextStepLabel(next = null) {
  if (!next) return null;
  const id = String(next.id || '');
  if (id === 'capture_then_consult') return 'Passende Fahrzeuge finden';
  const label = String(next.label || '').trim();
  if (/Elektrofahrzeuge finden|Fahrzeugberatung|passende Fahrzeuge/i.test(label)) {
    return 'Passende Fahrzeuge finden';
  }
  if (/Angebot vorbereiten/i.test(label)) return 'Angebot vorbereiten';
  if (/welches Fahrzeug/i.test(label)) return 'Fahrzeug für Angebot wählen';
  return label || String(next.cta || '').trim() || null;
}

/**
 * Compact Confirmation für Composer/Feed.
 * @param {object} turn
 * @returns {{
 *   title: string,
 *   message: string,
 *   chips: string[],
 *   nextStepLabel: string|null,
 *   showGlobalWarning: boolean,
 *   noteCount: number,
 * }}
 */
export function presentCompactConfirmation(turn = {}) {
  const facts = turn.extractedFacts || [];
  const safeFacts = turn.rememberDecision?.safeFacts
    || facts.filter((f) => !f.needsConfirmation && f.field !== 'unresolvedNote' && !f.preserveAsNote);
  const reviewFacts = turn.rememberDecision?.reviewFacts
    || facts.filter((f) => f.needsConfirmation);
  const zeroLoss = turn.zeroLossIntake?.summary || null;
  const next = turn.captureNextStep || turn.uiEffects?.captureNextStep || null;
  const nextStepLabel = presentIntakeNextStepLabel(next);

  const chipSource = [
    ...safeFacts,
    ...reviewFacts,
  ];
  const chips = sanitizeIntakeDisplayChips(
    chipSource.length ? chipSource : (zeroLoss?.chips || facts),
  );

  const noteCount = Number(zeroLoss?.noteCount || 0)
    || (facts.filter((f) => f.field === 'unresolvedNote' || f.preserveAsNote).length);

  const isConsult = next?.id === 'capture_then_consult'
    || /Fahrzeuge finden|Fahrzeugberatung/i.test(String(next?.label || ''));
  const title = isConsult ? 'Bedarf aufgenommen' : (zeroLoss?.title || 'Aufgenommen');

  const lines = [title];
  if (nextStepLabel) {
    lines.push('', 'Nächster Schritt:', nextStepLabel);
  }

  return {
    title,
    message: lines.join('\n'),
    chips,
    nextStepLabel,
    showGlobalWarning: shouldShowGlobalInterpretWarning(turn),
    noteCount,
  };
}

/**
 * Warnings für Turn entschärfen: Partial Success → kein „gesamter Fall“-Text.
 * @param {string[]} warnings
 * @param {object} turnLike – mind. extractedFacts / rememberDecision
 */
export function softenInterpretWarnings(warnings = [], turnLike = {}) {
  const list = Array.isArray(warnings) ? warnings : [];
  if (!hasUsablePartialSuccess(turnLike)) return list;
  return list.filter((w) => {
    const t = String(w || '');
    if (/gesamten Fall nicht vollständig/i.test(t)) return false;
    if (/Semantische Interpretation – bitte in der Review prüfen/i.test(t)) return false;
    if (/OpenAI nicht verfügbar – Regel-Fallback aktiv/i.test(t)) return false;
    if (/Semantische Interpretation fehlgeschlagen – Regel-Fallback aktiv/i.test(t)) return false;
    return true;
  });
}
