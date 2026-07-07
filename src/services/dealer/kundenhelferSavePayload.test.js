/**
 * kundenhelferSavePayload – Phase 3b Tests.
 * Sicherstellen, dass ein allgemeiner Lead-Save kundenhelfer.notes nicht überschreibt.
 */
import assert from 'node:assert/strict';
import {
  buildKundenhelferDisplayNotes,
  buildKundenhelferSavePatch,
  collectNewKundenhelferChips,
} from './kundenhelferSavePayload.js';
import { appendSellerInsightsFromTexts } from './sellerInsights.js';

// A: Allgemeiner Save reicht bestehende notes unverändert durch.
const existing = {
  notes: 'Hund, AHK',
  chipCategories: { info: ['Hund'] },
  voiceMemos: [{ id: 'vm-old' }],
  conversationNotes: [{ id: 'cn-old' }],
};

const patchA = buildKundenhelferSavePatch({
  existingKundenhelfer: existing,
  voiceMemos: [{ id: 'vm-new' }],
  conversationNotes: [{ id: 'cn-new' }],
});

assert.equal(patchA.notes, 'Hund, AHK', 'A: notes unverändert durchgereicht');
assert.deepEqual(patchA.chipCategories, existing.chipCategories, 'A: chipCategories legacy erhalten');
assert.deepEqual(patchA.voiceMemos, [{ id: 'vm-new' }], 'A: voiceMemos speicherbar');
assert.deepEqual(patchA.conversationNotes, [{ id: 'cn-new' }], 'A: conversationNotes speicherbar');
assert.equal(existing.notes, 'Hund, AHK', 'A: Original-Objekt nicht mutiert');

// B: React-State-Notes werden NICHT übernommen (kein notes-Argument existiert mehr).
const patchB = buildKundenhelferSavePatch({
  existingKundenhelfer: { notes: 'bestehend' },
  voiceMemos: [],
  conversationNotes: [],
});
assert.equal(patchB.notes, 'bestehend', 'B: nur bestehende notes, kein State-Rewrite');

// C: Explizite extraKundenhelfer.notes (anderer Schreibpfad) dürfen überschreiben.
const patchC = buildKundenhelferSavePatch({
  existingKundenhelfer: { notes: 'alt' },
  extraKundenhelfer: { notes: 'neu vom anderen Pfad' },
  voiceMemos: [],
  conversationNotes: [],
});
assert.equal(patchC.notes, 'neu vom anderen Pfad', 'C: extraKundenhelfer.notes gewinnt');

// D: Leere Eingaben führen nicht zu Fehlern.
const patchD = buildKundenhelferSavePatch();
assert.deepEqual(patchD.voiceMemos, [], 'D: default voiceMemos []');
assert.deepEqual(patchD.conversationNotes, [], 'D: default conversationNotes []');
assert.equal(patchD.notes, undefined, 'D: keine notes ohne Bestand');

assert.equal(patchD.notes, undefined, 'D: keine notes ohne Bestand');

// E: Neue Chips zwischen zwei Notes-Strings erkennen.
const added = collectNewKundenhelferChips('Hund, AHK', 'Hund, AHK, Dachzelt');
assert.deepEqual(added, ['Dachzelt'], 'E: nur neu hinzugefügte Chips');
assert.deepEqual(
  collectNewKundenhelferChips('Hund', 'AHK'),
  ['AHK'],
  'E: Ersetzen liefert neuen Chip',
);
assert.deepEqual(
  collectNewKundenhelferChips('Hund, AHK', 'Hund'),
  [],
  'E: Toggle-off liefert keine neuen Chips',
);

// F: Anzeige-Notes aus sellerInsights (inkl. Lazy-Migration).
const displayLead = {
  crm: {
    kundenhelfer: { notes: 'Hund, AHK' },
    sellerInsights: [{ id: 'si-1', text: 'Dachzelt', source: 'seller', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
  },
};
const displayNotes = buildKundenhelferDisplayNotes(displayLead);
assert.ok(displayNotes.includes('Hund'), 'F: migrierte Notes sichtbar');
assert.ok(displayNotes.includes('AHK'), 'F: migrierte Notes sichtbar');
assert.ok(displayNotes.includes('Dachzelt'), 'F: sellerInsights sichtbar');

// G: Lexikon-/Sheet-Muster – sellerInsights ohne notes-Schreiben.
const lexLead = {
  crm: {
    needProfile: { rawMessages: ['EV3'], version: 1 },
    kundenhelfer: { notes: 'Hund' },
  },
};
const lexResult = appendSellerInsightsFromTexts(lexLead, ['Head-up-Display gewünscht']);
assert.equal(lexResult.crm.kundenhelfer.notes, 'Hund', 'G: kundenhelfer.notes unverändert');
assert.ok(
  lexResult.crm.sellerInsights.some((i) => /head-up/i.test(i.text)),
  'G: Lexikon-Chip in sellerInsights',
);
assert.deepEqual(lexResult.crm.needProfile, lexLead.crm.needProfile, 'G: needProfile unverändert');

console.log('kundenhelferSavePayload.test.js: ok');
