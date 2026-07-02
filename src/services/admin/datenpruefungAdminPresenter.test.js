import assert from 'node:assert/strict';
import {
  buildDatenpruefungKpis,
  DATENPRUEFUNG_TABS,
} from './datenpruefungAdminPresenter.js';

const kpis = buildDatenpruefungKpis({ pendingImports: 2, technicalMismatch: 1, technicalPendingProfiles: 5 });
assert.equal(kpis.pendingImports, 2);
assert.equal(kpis.technicalMismatch, 1);
assert.equal(kpis.technicalPendingProfiles, 5);
assert.ok(typeof kpis.openLearningRequests === 'number');
assert.ok(typeof kpis.pendingKnowledgeAnswers === 'number');
assert.ok(typeof kpis.openCustomerQuestions === 'number');

assert.ok(DATENPRUEFUNG_TABS.some((t) => t.id === 'technisch'));
assert.ok(DATENPRUEFUNG_TABS.some((t) => t.id === 'preislisten'));

console.log('datenpruefungAdminPresenter.test.js: ok');
