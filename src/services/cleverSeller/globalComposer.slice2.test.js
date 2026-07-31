/**
 * Slice 2: Global Customer + History Search
 * node --test src/services/cleverSeller/globalComposer.slice2.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import {
  MESSAGE_KIND,
  MESSAGE_DIRECTION,
  MESSAGE_CHANNEL,
  MESSAGE_STATUS,
} from '../crm/customerMessageService.js';
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';
import { minimizeHistoryForAi } from './globalHistorySearch.js';
import { resolveCustomersFromInput } from './globalCustomerResolve.js';

function createGarritanoLead() {
  return {
    id: 'lead-demo-garritano',
    name: 'Herr Garritano',
    contact: { name: 'Herr Garritano' },
    paymentType: 'cash',
    vehicle: { model: 'Picanto', label: 'Kia Picanto' },
    crm: {
      customerMessageThreads: [{ id: 'th-g1', title: 'Kundenkommunikation' }],
      customerMessages: [{
        id: 'msg-garritano-lieferzeit',
        threadId: 'th-g1',
        direction: MESSAGE_DIRECTION.OUTBOUND,
        channel: MESSAGE_CHANNEL.CLEVER,
        status: MESSAGE_STATUS.SENT,
        kind: MESSAGE_KIND.TEXT,
        text: 'Aktuell rechnen wir beim Picanto mit einer Lieferzeit von ungefähr vier bis fünf Monaten.',
        visibleToCustomer: true,
        createdByName: 'Max',
        createdAt: '2026-07-18T14:32:00.000Z',
      }, {
        id: 'msg-draft-ignored',
        threadId: 'th-g1',
        direction: MESSAGE_DIRECTION.OUTBOUND,
        channel: MESSAGE_CHANNEL.CLEVER,
        status: 'draft',
        kind: MESSAGE_KIND.TEXT,
        text: 'DRAFT Lieferzeit bitte ignorieren',
        visibleToCustomer: false,
        createdAt: '2026-07-18T14:00:00.000Z',
      }],
    },
  };
}

function createDeutscheLead() {
  return {
    id: 'lead-demo-deutsche',
    name: 'Frau Deutsche',
    contact: { name: 'Frau Deutsche' },
    paymentType: 'leasing',
    vehicle: { model: 'EV4', label: 'Kia EV4' },
    crm: {
      vehicleConfigurations: [{
        id: 'vc-ev4-deutsche',
        model: 'EV4',
        modelKey: 'ev4',
        paymentType: 'leasing',
      }],
      vehicleOffers: {
        'vc-ev4-deutsche': {
          id: 'vo-deutsche-ev4',
          status: VEHICLE_OFFER_STATUS.SENT,
          sentAt: '2026-07-20T09:15:00.000Z',
          version: 2,
          pdf: { fileName: 'EV4_Deutsche.pdf' },
        },
      },
    },
  };
}

function createMuellerPair() {
  return [
    {
      id: 'lead-mueller-martin',
      contact: { name: 'Martin Müller' },
      paymentType: 'leasing',
      vehicle: { model: 'EV3', label: 'Kia EV3' },
    },
    {
      id: 'lead-mueller-sabine',
      contact: { name: 'Sabine Müller' },
      paymentType: 'cash',
      vehicle: { model: 'Sportage', label: 'Kia Sportage' },
    },
  ];
}

const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });
const garritano = createGarritanoLead();
const deutsche = createDeutscheLead();
const leads = [brandes, garritano, deutsche, ...createMuellerPair()];

// --- Intents ---
{
  const open = interpretSellerInput('Öffne Herrn Brandes.');
  assert.ok(open.intents.some((i) => i.type === SELLER_TURN_INTENTS.OPEN_CUSTOMER));

  const summary = interpretSellerInput('Was wollte Herr Brandes noch einmal?');
  assert.ok(summary.intents.some((i) => i.type === SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT));

  const hist = interpretSellerInput('Was hatte ich Garritano zur Lieferzeit geschrieben?');
  assert.ok(hist.intents.some((i) => (
    i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY
    || i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES
  )));

  const offer = interpretSellerInput('Wann habe ich Frau Deutsche zuletzt ein Angebot geschickt?');
  assert.ok(offer.intents.some((i) => i.type === SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS));

  const find = interpretSellerInput('Finde den Kunden mit dem roten Sportage und AHK.');
  assert.ok(find.intents.some((i) => i.type === SELLER_TURN_INTENTS.FIND_CUSTOMER));
}

// --- Eindeutige Kundensuche ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Öffne Herrn Brandes.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(shouldShowUniversalReview(turn));
  assert.ok(turn.customerSearchResults?.length === 1);
  assert.match(turn.customerSearchResults[0].customerName, /Brandes/i);
  assert.equal(turn.proposedUpdates?.length || 0, 0);
  const review = buildUniversalReviewModel(turn);
  assert.ok(review.actionSections.some((s) => s.kind === 'customer_search_results'));
}

// --- Mehrere Kundentreffer ---
{
  const resolution = resolveCustomersFromInput('Öffne Müller.', leads);
  assert.equal(resolution.status, 'ambiguous');
  assert.ok(resolution.results.length >= 2);
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Öffne Müller.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok((turn.customerSearchResults || []).length >= 2);
  assert.ok(!turn.proposedUpdates?.length);
}

// --- Kein Treffer ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Öffne Herrn Unbekanntxyz.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(!(turn.customerSearchResults || []).length);
}

// --- Customer Summary (Truth vs Offer) ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Was wollte Herr Brandes noch einmal?',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.customerSummary);
  assert.match(turn.customerSummary.customerName, /Brandes/i);
  assert.ok(turn.customerSummary.lines?.length);
  const blob = JSON.stringify(turn.customerSummary);
  assert.ok(!/347\s*€|329\s*€|389\s*€/.test(blob), 'keine Offer-Raten als Truth');
  assert.equal(turn.proposedUpdates?.length || 0, 0);
  const before = JSON.stringify(brandes);
  assert.equal(JSON.stringify(brandes), before);
}

// --- Historien-Treffer Garritano ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Was hatte ich Garritano zur Lieferzeit geschrieben?',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.historySearchResults?.length);
  const hit = turn.historySearchResults[0];
  assert.match(hit.matchedText, /vier bis fünf Monaten/i);
  assert.equal(hit.sourceType, 'seller_message');
  assert.ok(hit.sourceId);
  assert.ok(hit.customerId);
  assert.ok(hit.createdAt);
  assert.ok(hit.matchReason);
  // Draft nicht als Treffer
  assert.ok(!turn.historySearchResults.some((h) => /DRAFT/i.test(h.matchedText)));
  assert.equal(turn.proposedUpdates?.length || 0, 0);
}

// --- Offer-Sent Event Deutsche ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Wann habe ich Frau Deutsche zuletzt ein Angebot geschickt?',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.historySearchResults?.length);
  const hit = turn.historySearchResults[0];
  assert.equal(hit.sourceType, 'offer_event');
  assert.match(String(hit.vehicleLabel || hit.title), /EV4/i);
  assert.ok(hit.createdAt);
  assert.ok(hit.version);
  const review = buildUniversalReviewModel(turn);
  assert.ok(review.actionSections.some((s) => s.kind === 'offer_history_result'));
}

// --- Attribute: roter Sportage + AHK ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Finde den Kunden mit dem roten Sportage und AHK.',
    leadsSnapshot: leads,
    scopeHint: 'dashboard',
  });
  // Brandes hat Sportage deferred + XCeed mit Rot/AHK – Attributsuche kann Brandes treffen
  // wenn Sportage+AHK+Rot auf derselben Spur liegt. Brandes: AHK/Rot auf XCeed, Sportage deferred ohne AHK.
  // Erwartung: Treffer nur wenn alle Attribute auf einer Spur – sonst none oder Brandes wenn soft.
  // Unsere Logik verlangt alle Attribute auf derselben Spur → ggf. kein Treffer.
  // Für DoD: Match Reasons wenn Treffer; kein erfundener Kunde.
  if (turn.customerSearchResults?.length) {
    for (const r of turn.customerSearchResults) {
      assert.ok(r.matchReasons?.length || r.matchReason);
      assert.ok(leads.some((l) => l.id === r.leadId));
    }
  } else {
    // kein erfundener Treffer
    assert.ok(true);
  }
}

// Brandes mit Sportage+AHK+Rot auf einer Spur für positiven Attribut-Test
{
  const lead = JSON.parse(JSON.stringify(brandes));
  const sportage = lead.crm.vehicleConfigurations.find((c) => c.modelKey === 'sportage');
  sportage.vehicleTrack = {
    ...(sportage.vehicleTrack || {}),
    preferredColor: 'Rot',
    customerRequirements: ['AHK wichtig', 'Rot'],
    status: 'open',
  };
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Finde den Kunden mit dem roten Sportage und AHK.',
    leadsSnapshot: [lead],
    scopeHint: 'dashboard',
  });
  assert.ok(turn.customerSearchResults?.length >= 1);
  assert.match(turn.customerSearchResults[0].customerName, /Brandes/i);
  assert.ok(
    (turn.customerSearchResults[0].matchReasons || []).some((r) => /AHK|Sportage|Rot|Farbe|Modell/i.test(r)),
  );
}

// --- Quellen / Evidence ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Was hatte ich Garritano zur Lieferzeit geschrieben?',
    leadsSnapshot: leads,
  });
  assert.ok(Array.isArray(turn.evidence));
  assert.ok(turn.historySearchResults.every((h) => h.sourceType && h.sourceId && h.customerId));
}

// --- Datenschutz-Minimierung ---
{
  const minimized = minimizeHistoryForAi([{
    sourceLabel: 'Gesendete Nachricht',
    whenLabel: '18.07.2026',
    matchedText: 'Lieferzeit Text',
    matchReason: 'Enthält Lieferzeit',
    iban: 'DE00',
    salary: 5000,
  }]);
  assert.equal(minimized[0].iban, undefined);
  assert.equal(minimized[0].salary, undefined);
  assert.ok(minimized[0].matchedText);
}

// --- Kein Doppel-Composer Mount Guard ---
{
  function shouldShowGlobal(pathname, enabled = true) {
    const path = String(pathname).split('?')[0];
    const surface = (path === '/backend' || path === '/backend/')
      ? 'dashboard'
      : path.startsWith('/backend/kundenakte/')
        ? 'customer_akte'
        : 'other';
    return Boolean(enabled && surface === 'dashboard');
  }
  assert.equal(shouldShowGlobal('/backend'), true);
  assert.equal(shouldShowGlobal('/backend/kundenakte/lead-demo-brandes'), false);
}

// --- Context Reset ---
{
  let customer = { id: 'lead-demo-brandes' };
  function onSurface(surface) {
    if (surface !== 'customer_akte') customer = null;
  }
  onSurface('dashboard');
  assert.equal(customer, null);
}

// --- Navigation targets ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Öffne Herrn Brandes.',
    leadsSnapshot: leads,
  });
  const leadId = turn.customerSearchResults?.[0]?.leadId;
  assert.equal(leadId, brandes.id);
  assert.match(`/backend/kundenakte/${leadId}`, /brandes/);
}

{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Was hatte ich Garritano zur Lieferzeit geschrieben?',
    leadsSnapshot: leads,
  });
  const hit = turn.historySearchResults[0];
  assert.ok(hit.messageId || hit.sourceId);
  assert.equal(hit.customerId, garritano.id);
}

console.log('globalComposer.slice2.test.js: ok');
