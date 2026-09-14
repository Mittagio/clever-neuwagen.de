/**
 * Leichte Portal-Freitext-Signale (Frage vs. Change) – keine NLP-Pipeline.
 */
import {
  parseRequestedMileageFromChangeText,
  parseRequestedDownPaymentFromChangeText,
} from '../crm/customerOfferPortfolioService.js';

const COLOR_NAMES = 'grau|grauen|schwarz|schwarzen|weiß|weisse|weiße|weiss|weißen|blau|blauen|rot|roten|grün|grünen|silber|silbernen|beige';

/**
 * Strukturiert nur sichere km/AZ; Farbe als Frage vs. Änderungswunsch trennen.
 */
export function classifyPortalFreitextSignals(questionText = '') {
  const raw = String(questionText || '').trim();
  const lower = raw.toLowerCase();
  const requestedMileage = parseRequestedMileageFromChangeText(raw);
  const requestedDownPayment = parseRequestedDownPaymentFromChangeText(raw);
  const hasKmCue = requestedMileage != null || /\b(?:km|kilometer)\b/i.test(raw);
  const hasAzCue = requestedDownPayment != null
    || /\b(?:anzahlung|sonderzahlung|ohne\s+anzahlung)\b/i.test(raw);
  const hasTermCue = /\b(?:laufzeit|monate?)\b/i.test(raw);

  const colorQuestionRe = new RegExp(
    `(?:gibt\\s+es|habt\\s+ihr|ist\\s+(?:er|sie|das|der\\s+wagen|das\\s+fahrzeug)?\\s*(?:auch)?|auch)\\s+[^.?!\\n]{0,40}\\b(?:${COLOR_NAMES})\\b`
    + `|\\b(?:${COLOR_NAMES})\\b[^.?!\\n]{0,24}(?:verfügbar|möglich|geben)`,
    'i',
  );
  const colorChangeRe = new RegExp(
    `(?:lieber|möchte(?:\\s+ihn|\\s+sie|\\s+das)?|gerne|wechsel(?:n)?\\s+(?:auf|zu)|statt)\\s+[^.?!\\n]{0,24}\\b(?:${COLOR_NAMES})\\b`
    + `|\\b(?:${COLOR_NAMES})\\b[^.?!\\n]{0,16}(?:haben|nehmen|wechseln)`,
    'i',
  );

  const hasColorQuestion = colorQuestionRe.test(raw) && !colorChangeRe.test(raw);
  const hasColorChange = colorChangeRe.test(raw) && !hasColorQuestion;
  const hasQuestionMark = /\?/.test(raw);
  const hasQuestionCue = /^(?:gibt\s+es|habt\s+ihr|wie\s+(?:lange|schnell)|wann|kann\s+(?:man|ich)|ist\s+(?:das|er|sie)\s+auch)/im.test(raw)
    || hasColorQuestion
    || (hasQuestionMark && !hasKmCue && !hasAzCue && !hasTermCue);

  const hasPositive = /\b(?:gefällt|passt(?:\s+so)?|würde\s+ich\s+nehmen|nehme\s+ich|zusagen|interessiert)\b/i.test(lower);

  const hasStructuredChange = requestedMileage != null
    || requestedDownPayment != null
    || hasKmCue
    || hasAzCue
    || hasTermCue
    || hasColorChange;

  const openQuestions = [];
  if (hasColorQuestion) {
    const colorMatch = raw.match(new RegExp(`\\b(${COLOR_NAMES})\\b`, 'i'));
    const colorLabel = colorMatch
      ? colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1).toLowerCase()
      : 'Farbe';
    openQuestions.push({
      kind: 'color_availability',
      text: `Gibt es den Wagen auch in ${colorLabel}?`,
      colorLabel,
    });
  } else if (hasQuestionCue && !hasStructuredChange) {
    openQuestions.push({
      kind: 'general',
      text: raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0] || raw,
    });
  } else if (hasQuestionCue && hasStructuredChange) {
    const questionLines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean)
      .filter((line) => (
        /\?/.test(line)
        || /^(?:gibt\s+es|habt\s+ihr)/i.test(line)
        || colorQuestionRe.test(line)
      ));
    for (const line of questionLines) {
      openQuestions.push({ kind: 'general', text: line });
    }
  }

  return {
    requestedMileage,
    requestedDownPayment,
    hasStructuredChange,
    hasQuestionCue: hasQuestionCue || openQuestions.length > 0,
    hasColorQuestion,
    hasColorChange,
    hasPositive,
    openQuestions,
  };
}
