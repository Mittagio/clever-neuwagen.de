/**
 * node src/services/dealer/buildCustomerSnapshotModel.test.js
 */
import assert from 'node:assert/strict';
import {
  buildCustomerSnapshotModel,
  buildGroupSummaryLines,
  buildSnapshotSummary,
  SNAPSHOT_GROUP,
  SNAPSHOT_GROUP_TITLE,
  SNAPSHOT_SUMMARY_MAX_TOKENS,
} from './buildCustomerSnapshotModel.js';
import {
  createEmptyNeedProfile,
  mergeTextIntoNeedProfile,
} from '../consultation/needProfileService.js';
import { appendSellerInsightToLead } from './sellerInsights.js';
import { VEHICLE_TRACK_STATUS } from '../crm/vehicleTrack.js';
import { buildOfferWorkingContextItem } from '../crm/composerWorkingContext.js';

function baseLead(overrides = {}) {
  return {
    id: 'lead-snapshot-1',
    name: 'Kai Drechsel',
    paymentType: 'leasing',
    desiredRate: 300,
    wish: {
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 0,
      desiredRate: 300,
    },
    crm: {
      needProfile: mergeTextIntoNeedProfile(
        '2 Kinder, Hund, viel Platz',
        createEmptyNeedProfile('2 Kinder, Hund'),
      ),
      tradeIn: {
        vehicle: 'Ford Focus',
        datValue: 8000,
        payoffAmount: 2000,
      },
      vehicleConfigurations: [],
      sellerInsights: [],
    },
    ...overrides,
  };
}

// --- Nur confirmed facts ---
{
  const lead = baseLead();
  const snap = buildCustomerSnapshotModel(lead);
  assert.equal(snap.meta.hasData, true);
  const labels = snap.groups.flatMap((g) => g.facts.map((f) => f.label));
  assert.ok(labels.some((l) => /Kinder/i.test(l)), 'Kinder aus needProfile');
  assert.ok(labels.some((l) => /Hund/i.test(l)), 'Hund aus needProfile');
  assert.ok(labels.some((l) => /300/i.test(l)), 'Rate aus wish');
  assert.ok(labels.some((l) => /Ford Focus/i.test(l)), 'GW aus tradeIn');
  assert.ok(labels.some((l) => /Leasing/i.test(l)), 'Zahlungsart');
  console.log('✓ Snapshot nur confirmed facts');
}

// --- Seller insights (bestätigt auf Lead) ---
{
  const withInsight = appendSellerInsightToLead(
    baseLead(),
    'Anhängerkupplung wichtig',
  );
  const snap = buildCustomerSnapshotModel(withInsight);
  const bedarf = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.BEDARF);
  assert.ok(bedarf, 'Bedarf-Gruppe vorhanden');
  assert.ok(
    bedarf.facts.some((f) => /Anhänger/i.test(f.label)),
    'bestätigtes sellerInsight im Bedarf',
  );
  console.log('✓ Bestätigte sellerInsights enthalten');
}

// --- Empty groups omitted ---
{
  const emptyish = {
    id: 'l2',
    wish: { paymentType: 'leasing', desiredRate: 250 },
    desiredRate: 250,
    paymentType: 'leasing',
    crm: { needProfile: createEmptyNeedProfile() },
  };
  const snap = buildCustomerSnapshotModel(emptyish);
  assert.ok(!snap.groups.some((g) => g.id === SNAPSHOT_GROUP.BEDARF), 'leerer Bedarf weggelassen');
  assert.ok(!snap.groups.some((g) => g.id === SNAPSHOT_GROUP.BESTAND), 'leerer Bestand weggelassen');
  assert.ok(snap.groups.some((g) => g.id === SNAPSHOT_GROUP.BUDGET), 'Budget mit Inhalt');
  assert.ok(snap.groups.some((g) => g.id === SNAPSHOT_GROUP.VERTRAG), 'Vertrag mit Inhalt');
  assert.ok(snap.groups.every((g) => g.facts.length > 0), 'keine leeren Gruppen');
  console.log('✓ Empty groups omitted');
}

// --- Wireframe groups: ids, titles, Budget ≠ Vertrag ---
{
  const lead = baseLead({
    wish: {
      ...baseLead().wish,
      downPayment: 6000,
      termMonths: 36,
      leasingEndDate: 'Juli 2026',
    },
  });
  const snap = buildCustomerSnapshotModel(lead);
  const ids = snap.groups.map((g) => g.id);
  assert.deepEqual(
    ids.filter((id) => [
      SNAPSHOT_GROUP.BEDARF,
      SNAPSHOT_GROUP.BUDGET,
      SNAPSHOT_GROUP.VERTRAG,
      SNAPSHOT_GROUP.BESTAND,
    ].includes(id)),
    [
      SNAPSHOT_GROUP.BEDARF,
      SNAPSHOT_GROUP.BUDGET,
      SNAPSHOT_GROUP.VERTRAG,
      SNAPSHOT_GROUP.BESTAND,
    ],
    'Gruppen-Reihenfolge Wireframe',
  );
  const bedarf = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.BEDARF);
  const budget = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.BUDGET);
  const vertrag = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.VERTRAG);
  assert.equal(bedarf.title, SNAPSHOT_GROUP_TITLE[SNAPSHOT_GROUP.BEDARF]);
  assert.equal(bedarf.title, 'Alltag & Bedarf');
  assert.equal(budget.title, 'Budget');
  assert.equal(vertrag.title, 'Vertrag');
  assert.ok(budget.facts.every((f) => ['rate', 'downPayment'].includes(f.id)));
  assert.ok(vertrag.facts.some((f) => f.id === 'paymentType'));
  assert.ok(vertrag.facts.some((f) => f.id === 'termMonths'));
  assert.ok(!budget.facts.some((f) => f.id === 'paymentType'), 'Zahlungsart nicht in Budget');
  assert.ok(budget.editKey === 'desiredRate');
  assert.ok(vertrag.editKey === 'paymentType');
  assert.ok(budget.summaryLines?.[0]?.includes('Wunschrate'));
  assert.ok(budget.summaryLines?.[0]?.includes('Anzahlung'));
  assert.ok(vertrag.summaryLines?.length >= 1);
  assert.ok(vertrag.summaryLines.some((l) => /Vertragsende/i.test(l)));
  console.log('✓ Wireframe groups split/titles/summaries');
}

// --- Group summary lines helper ---
{
  const lines = buildGroupSummaryLines([
    { label: 'Leasing', cardLabel: 'Leasing', cardLine: 1 },
    { label: '36 Monate', cardLabel: '36 Monate', cardLine: 1 },
    { label: 'Ende Juli 2026', cardLabel: 'Vertragsende Juli 2026', cardLine: 2 },
  ]);
  assert.equal(lines[0], 'Leasing · 36 Monate');
  assert.equal(lines[1], 'Vertragsende Juli 2026');
  console.log('✓ buildGroupSummaryLines');
}

// --- Summary length / +N overflow ---
{
  const lead = appendSellerInsightToLead(
    baseLead({
      crm: {
        ...baseLead().crm,
        needProfile: mergeTextIntoNeedProfile(
          '2 Kinder Hund Familie Erstwagen Langstrecke Anhängerkupplung Wärmepumpe',
          createEmptyNeedProfile(),
        ),
        vehicleConfigurations: [
          {
            id: 'vc-1',
            model: 'EV2',
            modelKey: 'ev2',
            vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE, preferredColor: 'Grau' },
          },
        ],
      },
    }),
    'HUD gewünscht',
  );
  const snap = buildCustomerSnapshotModel(lead);
  assert.ok(snap.summary.tokens.length <= SNAPSHOT_SUMMARY_MAX_TOKENS);
  assert.ok(snap.summary.overflow >= 0);
  if (snap.meta.factCount > SNAPSHOT_SUMMARY_MAX_TOKENS) {
    assert.ok(snap.summary.overflow > 0, 'Overflow +N bei vielen Fakten');
    assert.match(snap.summary.line, /\+\d+/);
  }
  const short = buildSnapshotSummary(snap.groups.flatMap((g) => g.facts), 2);
  assert.equal(short.tokens.length, 2);
  assert.ok(short.overflow >= 1);
  assert.match(short.line, /\+\d+/);
  console.log('✓ Summary line length / +N overflow');
}

// --- Working context does not leak ---
{
  const lead = baseLead();
  const working = [
    buildOfferWorkingContextItem({
      id: 'vc-secret',
      modelName: 'Geheim-Modell XYZ',
      modelKey: 'secret',
      desiredRate: 999,
      termMonths: 12,
      mileagePerYear: 5000,
      paymentType: 'leasing',
      downPayment: 0,
    }),
  ];
  const snap = buildCustomerSnapshotModel(lead, { workingContextItems: working });
  const blob = JSON.stringify(snap);
  assert.ok(!/Geheim-Modell|XYZ|999/i.test(blob), 'Working Context darf nicht leaken');
  assert.ok(!/vc-secret/i.test(blob));
  console.log('✓ Working context does not leak into snapshot');
}

// --- Relevance highlight keys ---
{
  const snap = buildCustomerSnapshotModel(baseLead(), {
    relevantKeys: ['desiredRate', 'children'],
  });
  const rate = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'rate');
  const children = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'children');
  assert.equal(rate?.relevant, true);
  assert.equal(children?.relevant, true);
  const payment = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'paymentType');
  assert.equal(payment?.relevant, false);
  const budget = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.BUDGET);
  const bedarf = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.BEDARF);
  assert.equal(budget?.relevant, true);
  assert.equal(bedarf?.relevant, true);
  console.log('✓ Relevance keys mark facts');
}

// --- Tap targets: editKeys vorhanden ---
{
  const snap = buildCustomerSnapshotModel(baseLead());
  for (const group of snap.groups) {
    for (const f of group.facts) {
      assert.ok(f.editKey, `editKey für ${f.id}`);
      assert.ok(typeof f.label === 'string' && f.label.length > 0);
    }
  }
  console.log('✓ Tap target editKeys present');
}

// --- Trim/Ausstattung → Fahrzeugwunsch, nicht Bedarf ---
{
  const lead = baseLead({
    vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line' },
    wish: {
      ...baseLead().wish,
      equipment: 'GT-Line',
    },
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('Hund', createEmptyNeedProfile()),
        equipmentWishes: ['GT-Line', 'heat_pump'],
        modelHint: 'ev2',
      },
    },
  });
  const snap = buildCustomerSnapshotModel(lead);
  const bedarf = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.BEDARF);
  const wunsch = snap.groups.find((g) => g.id === SNAPSHOT_GROUP.WUNSCH);
  assert.ok(wunsch?.facts.some((f) => f.label === 'GT-Line'), 'GT-Line im Wunsch');
  assert.ok(!bedarf?.facts.some((f) => f.label === 'GT-Line'), 'GT-Line nicht im Bedarf');
  assert.ok(bedarf?.facts.some((f) => f.label === 'Wärmepumpe'), 'echte Ausstattung im Bedarf');
  console.log('✓ Trim routed to Fahrzeugwunsch');
}

console.log('\nbuildCustomerSnapshotModel.test.js: OK');
