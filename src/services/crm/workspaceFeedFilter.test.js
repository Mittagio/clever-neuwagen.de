/**
 * node src/services/crm/workspaceFeedFilter.test.js
 */
import assert from 'node:assert/strict';
import { MESSAGE_KIND } from './customerMessageService.js';
import {
  WORKSPACE_FEED_FILTERS,
  classifyWorkspaceFeedItem,
  countWorkspaceFeedFilters,
  filterWorkspaceFeedItems,
} from './workspaceFeedFilter.js';

assert.ok(WORKSPACE_FEED_FILTERS.some((f) => f.id === 'all'));
assert.equal(classifyWorkspaceFeedItem({ kind: MESSAGE_KIND.TEXT }), 'messages');
assert.equal(classifyWorkspaceFeedItem({ kind: MESSAGE_KIND.OFFER_CARD }), 'offers');
assert.equal(classifyWorkspaceFeedItem({ kind: MESSAGE_KIND.DOCUMENT_REQUEST }), 'documents');
assert.equal(classifyWorkspaceFeedItem({ kind: MESSAGE_KIND.APPOINTMENT_CARD }), 'appointments');
assert.equal(
  classifyWorkspaceFeedItem({
    kind: MESSAGE_KIND.SYSTEM_STATUS,
    text: 'Fahrzeugschein eingegangen',
  }),
  'documents',
);
assert.equal(
  classifyWorkspaceFeedItem({
    kind: MESSAGE_KIND.SYSTEM_STATUS,
    text: 'Angebot aktualisiert',
  }),
  'offers',
);

const items = [
  { id: '1', kind: MESSAGE_KIND.TEXT, text: 'Hallo' },
  { id: '2', kind: MESSAGE_KIND.OFFER_CARD, text: 'EV4' },
  { id: '3', kind: MESSAGE_KIND.DOCUMENT_REQUEST, text: 'Ausweis' },
  { id: '4', kind: MESSAGE_KIND.APPOINTMENT_CARD, text: 'Termin' },
  { id: '5', kind: MESSAGE_KIND.SYSTEM_STATUS, text: 'Gehaltsnachweis eingegangen' },
];

assert.equal(filterWorkspaceFeedItems(items, 'all').length, 5);
assert.equal(filterWorkspaceFeedItems(items, 'messages').length, 1);
assert.equal(filterWorkspaceFeedItems(items, 'offers').length, 1);
assert.equal(filterWorkspaceFeedItems(items, 'documents').length, 2);
assert.equal(filterWorkspaceFeedItems(items, 'appointments').length, 1);

const counts = countWorkspaceFeedFilters(items);
assert.equal(counts.all, 5);
assert.equal(counts.messages, 1);
assert.equal(counts.offers, 1);
assert.equal(counts.documents, 2);
assert.equal(counts.appointments, 1);

console.log('workspaceFeedFilter.test.js: OK');
