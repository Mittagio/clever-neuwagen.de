import assert from 'node:assert/strict';
import {
  buildHomePrepareOfferComposerTask,
  resolveEmpfiehltCleverAction,
} from './backendHomeEmpfiehltActions.js';

const tel = resolveEmpfiehltCleverAction({
  leadId: 'l1',
  customerName: 'Aalen',
  ctaHref: 'tel:+497361123',
  ctaLabel: 'Heute anrufen',
});
assert.equal(tel.kind, 'tel');
assert.equal(tel.href, 'tel:+497361123');

const selection = resolveEmpfiehltCleverAction({
  leadId: 'l2',
  customerName: 'Brandes',
  actionId: 'selection_send',
  ctaLabel: 'EV2-Auswahl senden',
});
assert.equal(selection.kind, 'run_turn');
assert.match(selection.sellerInput, /Auswahl zum Senden/i);

const docs = resolveEmpfiehltCleverAction({
  leadId: 'l3',
  customerName: 'Müller',
  actionId: 'documents_missing',
  ctaLabel: 'Unterlagen fehlen',
});
assert.equal(docs.kind, 'run_turn');
assert.match(docs.sellerInput, /fehlender Unterlagen/i);

const offerSend = resolveEmpfiehltCleverAction({
  leadId: 'l4',
  customerName: 'Schmidt',
  actionId: 'offer_send',
  ctaLabel: 'Angebot prüfen und senden',
});
assert.equal(offerSend.kind, 'run_turn');
assert.match(offerSend.sellerInput, /Angebot und Nachricht/i);

const fallback = resolveEmpfiehltCleverAction({
  leadId: 'l5',
  customerName: 'Unklar',
  actionId: 'delivery_ready',
  ctaLabel: 'Übergabe planen',
});
assert.equal(fallback.kind, 'fallback_akte');
assert.equal(fallback.fallbackReason, 'no_action_path');

const task = buildHomePrepareOfferComposerTask();
assert.equal(task.composerTitle, 'ANGEBOT VORBEREITEN');
assert.equal(task.placeholder, 'Für welchen Kunden oder welches Fahrzeug?');
assert.equal(task.intentChipId, 'angebot');

console.log('backendHomeEmpfiehltActions.test.js: ok');
