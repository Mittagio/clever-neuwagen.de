/**
 * kundenhelferSavePayload – Phase 3b Tests.
 * Sicherstellen, dass ein allgemeiner Lead-Save kundenhelfer.notes nicht überschreibt.
 */
import assert from 'node:assert/strict';
import { buildKundenhelferSavePatch } from './kundenhelferSavePayload.js';

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

console.log('kundenhelferSavePayload.test.js: ok');
