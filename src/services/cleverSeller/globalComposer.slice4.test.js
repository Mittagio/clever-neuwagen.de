/**
 * Slice 4: Verifiziertes Fahrzeugwissen + natürliche Kundennachricht
 * node --test src/services/cleverSeller/globalComposer.slice4.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { containsSellerCommandInMessage } from './validateSellerCommandMessage.js';
import { resolveGroundedVehicleKnowledge } from './resolveGroundedVehicleKnowledge.js';
import { prepareGroundedCustomerMessageSync } from './prepareGroundedCustomerMessageSync.js';
import { lookupPackageContents, lookupRelevantEquipment } from '../crm/magic/magicKnowledgeTools.js';
import { COMPOSER_MODES } from '../crm/composerMode.js';

function createGarritanoLead(overrides = {}) {
  return {
    id: 'lead-demo-garritano',
    name: 'Herr Garritano',
    contact: { name: 'Herr Garritano' },
    paymentType: 'cash',
    vehicle: { model: 'Picanto', label: 'Kia Picanto' },
    wish: { paymentType: 'cash' },
    crm: {
      needProfile: {
        priorities: ['Platz für Hund wichtig'],
        labels: ['Hund / Platz hinten'],
      },
      kundenhelfer: {
        conversationNotes: ['Kunde hat Hund – Platz hinten wichtig'],
      },
      ...(overrides.crm || {}),
    },
    ...overrides,
  };
}

const GOLDEN = [
  'Schreib Garritano,',
  'dass wir einen schwarzen Picanto GT-Line',
  'mit Technologie-Paket und Schiebedach da haben.',
  'Erklär ihm kurz das Technologie-Paket und die Ausstattung.',
].join(' ');

const garritano = createGarritanoLead();
const leads = [garritano];

// --- Intents ---
{
  const interpreted = interpretSellerInput(GOLDEN);
  const types = interpreted.intents.map((i) => i.type);
  assert.ok(types.includes(SELLER_TURN_INTENTS.FIND_CUSTOMER));
  assert.ok(types.includes(SELLER_TURN_INTENTS.RESOLVE_VEHICLE));
  assert.ok(types.includes(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE));
  assert.ok(types.includes(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_EQUIPMENT));
  assert.ok(types.includes(SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  assert.ok(!types.includes(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
  assert.ok(!types.includes(SELLER_TURN_INTENTS.PREPARE_OFFER));
}

// --- Seller Facts / Knowledge Resolver ---
{
  const knowledge = resolveGroundedVehicleKnowledge({ sellerInput: GOLDEN });
  assert.equal(knowledge.vehicleIdentity?.modelKey, 'picanto');
  assert.match(String(knowledge.vehicleIdentity?.trimId || ''), /gt-line/i);
  assert.ok(knowledge.sellerFacts.some((f) => f.type === 'color' && /schwarz/i.test(f.value)));
  assert.ok(knowledge.sellerFacts.some((f) => f.type === 'availability'));
  assert.ok(knowledge.sellerFacts.some((f) => f.type === 'sunroof'));
  assert.ok(knowledge.sellerFacts.some((f) => f.type === 'package_present'));
  assert.ok(knowledge.sellerFacts.every((f) => f.source === 'seller_input'));
  assert.ok(knowledge.missingKnowledge.includes('exact_technology_package_contents'));
  assert.ok(knowledge.verifiedEquipmentFacts?.items?.length > 0);
}

// --- Package / Equipment Lookup Priority ---
{
  const picantoPkg = lookupPackageContents({
    modelKey: 'picanto',
    trim: 'gt-line',
    packageName: 'Technologie-Paket',
  });
  assert.equal(picantoPkg.ok, false);
  assert.equal(picantoPkg.missingKnowledgeKey, 'exact_technology_package_contents');

  const eq = lookupRelevantEquipment({ modelKey: 'picanto', trim: 'gt-line' });
  assert.equal(eq.ok, true);
  assert.ok(eq.items.length > 0);

  const ev5 = lookupPackageContents({
    modelKey: 'ev5',
    trim: 'earth',
    packageName: 'Technologie-Paket',
  });
  assert.equal(ev5.ok, true);
  assert.ok(ev5.package.items.length > 0);
}

// --- Golden Turn ---
{
  const before = JSON.stringify(garritano);
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.equal(JSON.stringify(garritano), before, 'keine Customer-Truth-Mutation');
  assert.equal(turn.proposedUpdates?.length || 0, 0);
  assert.equal(turn.autoSent, false);
  assert.ok(turn.resolvedCustomer?.id === garritano.id);
  assert.ok(turn.sellerFacts?.length > 0);
  assert.ok(turn.sellerFacts.some((f) => f.type === 'color'));
  assert.ok(turn.sellerFacts.some((f) => f.type === 'sunroof'));
  assert.ok(turn.sellerFacts.some((f) => f.type === 'availability'));

  const body = typeof turn.messageDraft === 'string'
    ? turn.messageDraft
    : turn.messageDraft?.body;
  assert.ok(body);
  assert.match(body, /Garritano/i);
  assert.match(body, /Picanto/i);
  assert.match(body, /GT-Line|gt-line/i);
  assert.match(body, /schwarz/i);
  assert.match(body, /Technologie/i);
  assert.match(body, /Schiebedach/i);
  assert.equal(containsSellerCommandInMessage(body), false);
  assert.doesNotMatch(body, /^Schreib Garritano/i);
  assert.doesNotMatch(body, /Erstell dem Kunden/i);
  assert.doesNotMatch(body, /360° Kamera/);
  assert.doesNotMatch(body, /Head-Up Display/i);
  assert.doesNotMatch(body, /\b\d{1,2}\s*Wochen\b/);
  assert.doesNotMatch(body, /\b\d{1,3}\.\d{3}\s*€\b/);

  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'knowledge_and_message_review');
  assert.ok(review.actionSections.some((s) => s.kind === 'knowledge_and_message_review'));
  assert.ok(turn.handoffWorkingContext);
  assert.equal(turn.handoffWorkingContext.composerMode, COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT);
  assert.ok(turn.uiEffects?.progressLines?.some((l) => /gefunden|erkannt|Seller Facts|Nachricht/i.test(l)));
  assert.ok((turn.missingInformation || []).some((m) => m.id === 'exact_technology_package_contents'));
}

// --- Gegenprobe A: kurze Verfügbarkeit ohne Paketdetails ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Schreib Garritano, dass wir einen schwarzen GT-Line da haben.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
  assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.LOOKUP_VEHICLE_PACKAGE));
  const body = typeof turn.messageDraft === 'string' ? turn.messageDraft : turn.messageDraft?.body;
  assert.ok(body);
  assert.doesNotMatch(body, /360° Kamera/);
  assert.doesNotMatch(body, /Technologie-Paket umfasst/i);
}

// --- Gegenprobe B: Technologie-Paket ohne Fahrzeug ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Erklär Garritano das Technologie-Paket.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.RESOLVE_VEHICLE));
  assert.ok(
    (turn.missingInformation || []).some((m) => m.id === 'clarify_vehicle_for_knowledge')
    || turn.preparedActions.some((a) => (
      a.type === SELLER_TURN_INTENTS.RESOLVE_VEHICLE && a.status === 'blocked'
    ))
    || turn.preparedActions.some((a) => a.payload?.groundedStatus === 'needs_vehicle_clarification'),
  );
}

// --- Gegenprobe C: Konflikt Serien-Schiebedach ---
{
  const knowledge = resolveGroundedVehicleKnowledge({
    sellerInput: 'Schreib Garritano, der Picanto GT-Line hat serienmäßig ein Schiebedach.',
  });
  assert.ok(knowledge.conflicts.some((c) => c.factType === 'sunroof_as_standard' || c.factType === 'sunroof'));
  assert.ok(knowledge.warnings.some((w) => /sunroof|standard/i.test(w)));

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Schreib Garritano, der Picanto GT-Line hat serienmäßig ein Schiebedach.',
    leadsSnapshot: leads,
  });
  const body = typeof turn.messageDraft === 'string' ? turn.messageDraft : turn.messageDraft?.body;
  if (body) {
    assert.doesNotMatch(body, /serienm[aä](?:ss|ß)ig.{0,40}Schiebedach/i);
  }
  assert.ok((turn.warnings || []).length > 0 || knowledge.conflicts.length > 0);
}

// --- Gegenprobe D: Unterlagen ohne Fahrzeugdetails ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Schreib ihm wegen der Unterlagen.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  const body = typeof turn.messageDraft === 'string' ? turn.messageDraft : turn.messageDraft?.body;
  if (body) {
    assert.doesNotMatch(body, /Technologie-Paket/i);
    assert.doesNotMatch(body, /Schiebedach/i);
    assert.doesNotMatch(body, /360°/);
  }
}

// --- Message uses verified facts only (EV5 mit Paket) ---
{
  const prepared = prepareGroundedCustomerMessageSync({
    sellerInput: 'Schreib Garritano, schwarzer EV5 Earth mit Technologie-Paket. Erklär das Technologie-Paket und die Ausstattung.',
    lead: garritano,
    customerName: 'Herr Garritano',
    workingContext: { modelKey: 'ev5', trimId: 'earth', shortLabel: 'EV5 Earth' },
  });
  assert.ok(prepared.knowledge.verifiedPackageFacts?.items?.length > 0);
  assert.ok(prepared.messageDraft);
  for (const item of prepared.knowledge.verifiedPackageFacts.items.slice(0, 3)) {
    assert.ok(
      prepared.messageDraft.includes(item)
      || (prepared.usedFacts || []).some((f) => String(f.value).includes(item)),
      `verified item referenced: ${item}`,
    );
  }
  assert.doesNotMatch(prepared.messageDraft, /^Schreib/i);
}

// --- Ohne Paketdetails ---
{
  const prepared = prepareGroundedCustomerMessageSync({
    sellerInput: GOLDEN,
    lead: garritano,
    allowWithoutPackageDetails: true,
  });
  assert.ok(!prepared.knowledge.missingKnowledge.includes('exact_technology_package_contents')
    || prepared.status === 'prepared');
  assert.ok(prepared.messageDraft);
  assert.doesNotMatch(prepared.messageDraft, /360° Kamera/);
}

// --- Handoff / kein Doppel-Composer ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: leads,
  });
  assert.equal(turn.handoffWorkingContext.composerMode, COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT);
  assert.ok(turn.handoffWorkingContext.messageDraft || turn.messageDraft);
  assert.match(
    String(turn.handoffWorkingContext.shortLabel || turn.handoffWorkingContext.label || ''),
    /Picanto|GT-Line|Schwarz/i,
  );

  function shouldShowGlobal(pathname) {
    const path = String(pathname).split('?')[0];
    return path === '/backend' || path === '/backend/';
  }
  assert.equal(shouldShowGlobal('/backend'), true);
  assert.equal(shouldShowGlobal('/backend/kundenakte/lead-demo-garritano'), false);
}

// --- Minimale OpenAI-Daten (Context-Builder) ---
{
  const prepared = prepareGroundedCustomerMessageSync({
    sellerInput: GOLDEN,
    lead: garritano,
  });
  assert.equal(prepared.mutatesCustomer, false);
  assert.ok(prepared.handoff);
  assert.equal(prepared.handoff.composerMode, COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT);
}

console.log('globalComposer.slice4.test.js: ok');
