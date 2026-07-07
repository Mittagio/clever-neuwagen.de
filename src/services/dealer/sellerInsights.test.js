/**
 * sellerInsights – Service-Tests
 */
import assert from 'node:assert/strict';
import {
  appendSellerInsightsFromTexts,
  appendSellerInsightToLead,
  createSellerInsight,
  getSellerInsightsFromLead,
  hasSellerInsights,
  migrateKundenhelferToSellerInsights,
  MIGRATED_FROM_KUNDENHELFER,
  normalizeSellerInsights,
  SELLER_INSIGHT_SOURCE,
} from './sellerInsights.js';
import { buildCustomerUnderstanding } from './customerUnderstanding.js';
import {
  createEmptyNeedProfile,
  mergeTextIntoNeedProfile,
} from '../consultation/needProfileService.js';

const insight = createSellerInsight(
  'Anhängelast jetzt doch 2.500 kg. Hund fährt regelmäßig mit.',
  { context: 'phone_call' },
);
assert.ok(insight, 'Insight erstellt');
assert.equal(insight.source, SELLER_INSIGHT_SOURCE);
assert.equal(insight.context, 'phone_call');
assert.ok(insight.understoodLabels.length >= 1, 'Parser erzeugt Labels');
assert.ok(
  insight.understoodLabels.some((label) => /anhängelast|hund/i.test(label)),
  `Labels: ${insight.understoodLabels.join(', ')}`,
);

const lead = appendSellerInsightToLead({ id: 'lead-1', crm: {} }, insight.text, {
  context: 'phone_call',
});
assert.ok(hasSellerInsights(lead));
assert.equal(getSellerInsightsFromLead(lead).length, 1);
assert.equal(getSellerInsightsFromLead(lead)[0].text, insight.text);

const leadTwo = appendSellerInsightToLead(lead, 'Dachzelt wird regelmäßig genutzt.');
assert.equal(getSellerInsightsFromLead(leadTwo).length, 2);

const normalized = normalizeSellerInsights([
  { text: 'Hund fährt mit', createdAt: '2026-01-02T10:00:00.000Z' },
  { text: 'Lieferzeit wichtiger als Preis', createdAt: '2026-01-01T10:00:00.000Z' },
]);
assert.equal(normalized[0].text, 'Lieferzeit wichtiger als Preis', 'chronologisch sortiert');

const baseLead = {
  id: 'lead-need-profile',
  crm: {
    needProfile: {
      rawMessages: ['Ich suche einen EV3'],
      initialWish: 'Ich suche einen EV3',
      version: 1,
    },
  },
};
const withInsight = appendSellerInsightToLead(baseLead, 'Hund fährt regelmäßig mit.');
assert.deepEqual(withInsight.crm.needProfile, baseLead.crm.needProfile, 'needProfile bleibt unverändert');
assert.equal(withInsight.crm.sellerInsights.length, 1);

// ── Phase 3a: kundenhelfer → sellerInsights Migration ───────────────────────

const m1Lead = {
  id: 'm1',
  crm: {
    kundenhelfer: { notes: 'Hund, AHK' },
  },
};

const m1Understanding = buildCustomerUnderstanding(m1Lead);
assert.ok(m1Understanding, 'M1: Understanding aus kundenhelfer');
const m1Labels = m1Understanding.verstaendnis.labels.join(' ');
assert.ok(/hund/i.test(m1Labels), `M1: Hund fehlt in ${m1Labels}`);
assert.ok(/ahk|anhäng/i.test(m1Labels), `M1: AHK fehlt in ${m1Labels}`);
assert.equal(m1Lead.crm.needProfile, undefined, 'M1: needProfile unverändert am Original-Lead');

const m2Lead = {
  id: 'm2',
  crm: {
    needProfile: mergeTextIntoNeedProfile(
      'Ich suche einen EV3, Hund fährt mit',
      createEmptyNeedProfile('Ich suche einen EV3, Hund fährt mit'),
    ),
    kundenhelfer: { notes: 'Hund, AHK' },
  },
};
const m2Insights = getSellerInsightsFromLead(m2Lead);
assert.equal(m2Insights.length, 1, 'M2: nur AHK migriert, Hund dedupliziert');
assert.ok(/ahk/i.test(m2Insights[0].text), 'M2: migrierter Text ist AHK');
const m2Understanding = buildCustomerUnderstanding(m2Lead);
const m2HundCount = m2Understanding.verstaendnis.labels.filter((l) => /hund/i.test(l)).length;
assert.ok(m2HundCount <= 1, 'M2: Hund nicht doppelt im Verständnis');

const m3Base = { id: 'm3', crm: { kundenhelfer: { notes: 'Hund, AHK' } } };
const m3First = migrateKundenhelferToSellerInsights(m3Base);
const m3Second = migrateKundenhelferToSellerInsights(m3First);
assert.equal(
  getSellerInsightsFromLead(m3Second).length,
  getSellerInsightsFromLead(m3First).length,
  'M3: zweite Migration erzeugt keine Duplikate',
);
assert.ok(m3First.crm.migration?.kundenhelferV1At, 'M3: Migrationsmarker gesetzt');

const m3LazyOnce = getSellerInsightsFromLead(m3Base);
const m3LazyTwice = getSellerInsightsFromLead(m3Base);
assert.equal(m3LazyOnce.length, m3LazyTwice.length, 'M3: Lazy Read idempotent');

const m4Notes = [{ id: 'cn-1', text: 'Kunde ruft Montag zurück', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' }];
const m4Lead = {
  id: 'm4',
  crm: {
    kundenhelfer: {
      notes: 'Hund',
      conversationNotes: m4Notes,
    },
  },
};
const m4Migrated = migrateKundenhelferToSellerInsights(m4Lead);
assert.deepEqual(m4Migrated.crm.kundenhelfer.conversationNotes, m4Notes, 'M4: conversationNotes erhalten');
assert.equal(m4Migrated.crm.kundenhelfer.notes, 'Hund', 'M5: kundenhelfer.notes erhalten');
assert.equal(m4Lead.crm.kundenhelfer.notes, 'Hund', 'M5: Original-notes unverändert');

const m5Insight = getSellerInsightsFromLead(m4Migrated)[0];
assert.equal(m5Insight.migratedFrom, MIGRATED_FROM_KUNDENHELFER, 'migriertes Insight markiert');

// ── Phase 3b: appendSellerInsightsFromTexts ─────────────────────────────────

const b1Lead = {
  id: 'b1',
  crm: {
    needProfile: mergeTextIntoNeedProfile(
      'Ich suche einen EV3',
      createEmptyNeedProfile('Ich suche einen EV3'),
    ),
    kundenhelfer: { notes: 'Hund' },
  },
};
const b1NeedProfileBefore = JSON.stringify(b1Lead.crm.needProfile);
const b1NotesBefore = b1Lead.crm.kundenhelfer.notes;

const b1Result = appendSellerInsightsFromTexts(
  b1Lead,
  ['Dachzelt wird regelmäßig genutzt.', 'Kunde will Probefahrt am Samstag'],
  { context: 'phone_call' },
);
const b1Insights = b1Result.crm.sellerInsights;
assert.ok(
  b1Insights.some((i) => /dachzelt/i.test(i.text)),
  'B1: Dachzelt als sellerInsight geschrieben',
);
assert.ok(
  b1Insights.some((i) => /probefahrt/i.test(i.text)),
  'B1: Probefahrt als sellerInsight geschrieben',
);
assert.equal(
  JSON.stringify(b1Result.crm.needProfile),
  b1NeedProfileBefore,
  'B1: needProfile unverändert',
);
assert.equal(
  b1Result.crm.kundenhelfer.notes,
  b1NotesBefore,
  'B1: kundenhelfer.notes unverändert',
);
assert.equal(b1Lead.crm.kundenhelfer.notes, 'Hund', 'B1: Original-Lead notes unverändert');

// leere Texte werden ignoriert
const b2Lead = { id: 'b2', crm: {} };
const b2Result = appendSellerInsightsFromTexts(b2Lead, ['', '   ', null, undefined]);
assert.equal(b2Result, b2Lead, 'B2: nur leere Texte → Lead unverändert');
assert.equal(getSellerInsightsFromLead(b2Result).length, 0, 'B2: keine Insights erzeugt');

// Deduplizierung gegen Bestand und untereinander
const b3Lead = appendSellerInsightsFromTexts({ id: 'b3', crm: {} }, ['Hund fährt mit']);
const b3Result = appendSellerInsightsFromTexts(b3Lead, ['Hund fährt mit', 'hund fährt mit', 'Neu: AHK']);
assert.equal(
  b3Result.crm.sellerInsights.length,
  2,
  'B3: Duplikate übersprungen, nur neues AHK ergänzt',
);

console.log('sellerInsights.test.js: ok');
