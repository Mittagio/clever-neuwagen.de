/**
 * Clever Lernfragen – Service-Tests
 */
import assert from 'node:assert/strict';
import {
  createLearningRequest,
  customerEquipmentSearchNeedsLearningFeedback,
  dealerEquipmentSearchNeedsLearningFeedback,
  findExistingLearningRequest,
  ignoreLearningRequest,
  LEARNING_SOURCE_AREAS,
  lexiconNeedsLearningFeedback,
  listLearningRequests,
  markLearningRequestResolved,
  resetLearningRequestsStore,
} from './cleverLearningRequestService.js';
import { searchCleverLexicon } from '../lexicon/cleverLexiconSearchService.js';

resetLearningRequestsStore();

// 1. Keine Antwort → Learning-Feedback nötig
const unknownLex = searchCleverLexicon('EV4 Flugmodus');
assert.equal(unknownLex.ok, false);
assert.equal(lexiconNeedsLearningFeedback(unknownLex), true);

// 2. Klick erstellt learningRequest
const created = createLearningRequest({
  query: 'EV4 elektrische Beifahrersitzverstellung',
  modelKey: 'ev4',
  modelLabel: 'Kia EV4',
  sourceArea: LEARNING_SOURCE_AREAS.LEXICON,
  pageContext: 'Clever-Lexikon',
  detectedIntent: 'equipment',
  userId: 'seller-1',
  userName: 'Max',
});
assert.equal(created.created, true);
assert.ok(created.request?.id);
assert.equal(created.request.status, 'open');

// 3. Query, Modell und Kontext werden gespeichert
assert.equal(created.request.query, 'EV4 elektrische Beifahrersitzverstellung');
assert.equal(created.request.modelKey, 'ev4');
assert.equal(created.request.sourceArea, 'lexicon');
assert.equal(created.request.pageContext, 'Clever-Lexikon');
assert.ok(created.request.normalizedQuery);
assert.ok(Array.isArray(created.request.suggestedGlobalFeatureIds));

// 4. Doppelte Anfrage wird nicht doppelt gespeichert
const duplicate = createLearningRequest({
  query: 'EV4 elektrische Beifahrersitzverstellung',
  modelKey: 'ev4',
  sourceArea: LEARNING_SOURCE_AREAS.LEXICON,
  userId: 'seller-2',
});
assert.equal(duplicate.duplicate, true);
assert.equal(listLearningRequests().length, 1);

// 5. existingRequestCount wird erhöht
assert.equal(duplicate.request.existingRequestCount, 2);
assert.ok(duplicate.request.reporterIds.includes('seller-1'));
assert.ok(duplicate.request.reporterIds.includes('seller-2'));

// 6. Erfolgsmeldung bei Duplikat
assert.match(duplicate.message, /bereits vorgemerkt/i);

// 7. Admin-Liste zeigt offene Lernfragen
const open = listLearningRequests({ status: 'open' });
assert.equal(open.length, 1);
assert.equal(open[0].query, 'EV4 elektrische Beifahrersitzverstellung');

// 8. Status resolved
const resolved = markLearningRequestResolved(open[0].id);
assert.equal(resolved.status, 'resolved');

// 9. Status ignored (neuer Eintrag)
const second = createLearningRequest({
  query: 'BYD Seal Beifahrersitz elektrisch',
  modelKey: 'seal-u',
  sourceArea: LEARNING_SOURCE_AREAS.DEALER_EQUIPMENT_SEARCH,
  pageContext: 'Ausstattung prüfen',
});
assert.equal(second.created, true);
const ignored = ignoreLearningRequest(second.request.id);
assert.equal(ignored.status, 'ignored');

// 10. sourceArea lexicon
assert.equal(created.request.sourceArea, 'lexicon');

// 11. sourceArea customer_equipment_search
const customer = createLearningRequest({
  query: 'Beifahrersitz elektrisch',
  modelKey: 'ev4',
  sourceArea: LEARNING_SOURCE_AREAS.CUSTOMER_EQUIPMENT_SEARCH,
  pageContext: 'Ausstattungssuche',
});
assert.equal(customer.request.sourceArea, 'customer_equipment_search');

// 12. Keine E-Mail – Service erzeugt nur Store-Einträge
assert.ok(!created.request.mailto);
assert.ok(!created.message.includes('mailto'));

// Hilfsfunktionen Ausstattungssuche
assert.equal(dealerEquipmentSearchNeedsLearningFeedback({ type: 'not_recognized' }), true);
assert.equal(dealerEquipmentSearchNeedsLearningFeedback({ type: 'pending' }), true);
assert.equal(dealerEquipmentSearchNeedsLearningFeedback({ type: 'match' }), false);
assert.equal(customerEquipmentSearchNeedsLearningFeedback({ type: 'not_found' }), true);
assert.equal(customerEquipmentSearchNeedsLearningFeedback({ type: 'match' }), false);

// findExisting nur offene
resetLearningRequestsStore();
createLearningRequest({
  query: 'Test Query',
  modelKey: 'ev3',
  sourceArea: LEARNING_SOURCE_AREAS.LEXICON,
});
const existing = findExistingLearningRequest({
  query: 'Test Query',
  modelKey: 'ev3',
  sourceArea: LEARNING_SOURCE_AREAS.LEXICON,
});
assert.ok(existing);

console.log('cleverLearningRequestService.test.js: ok');
