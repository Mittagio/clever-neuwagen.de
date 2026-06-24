/**
 * Clever Verkaufsberater – Fragenkette & Empfehlung
 */
import assert from 'node:assert/strict';
import {
  answerConsultationQuestion,
  buildConsultationHandoffSummary,
  createConsultationProfile,
  getNextConsultationQuestion,
  hasEnoughForRecommendation,
} from './cleverSalesAdvisor.js';

const profile = createConsultationProfile('Elektro-SUV für Familie bis 400 €');
assert.equal(profile.initialWish, 'Elektro-SUV für Familie bis 400 €');

const q1 = getNextConsultationQuestion(profile, { searchProfile: null, searchFilters: null });
assert.ok(q1?.id, 'Erste Frage vorhanden');

const answered = answerConsultationQuestion(profile, q1.id, q1.options[0].id);
assert.ok(answered.answers[q1.id], 'Antwort gespeichert');

const next = getNextConsultationQuestion(answered, { searchProfile: null, searchFilters: null });
assert.ok(next?.id !== q1.id, 'Nächste Frage ist anders');

let working = answered;
const steps = new Set();
while (working && steps.size < 12) {
  const question = getNextConsultationQuestion(working, { searchProfile: null, searchFilters: null });
  if (!question) break;
  steps.add(question.id);
  working = answerConsultationQuestion(working, question.id, question.options[0].id);
}

assert.ok(steps.size >= 3, 'Mehrere Fragen durchlaufen');
assert.ok(
  hasEnoughForRecommendation(working, { primaryModelKey: 'ev3' }),
  'Genug Antworten für Empfehlung',
);

const handoff = buildConsultationHandoffSummary(working, {
  ready: true,
  vehicleTitle: 'Kia EV3 Earth',
  whyLines: ['passt ins Budget'],
});
assert.ok(handoff.lines.some((l) => l.label === 'Ausgangswunsch'));
assert.ok(handoff.lines.some((l) => l.highlight));

console.log('cleverSalesAdvisor.test.js: ok');
