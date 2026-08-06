/**
 * node src/services/dealer/buildCustomerSnapshotModel.test.js
 */
import assert from 'node:assert/strict';
import {
  buildCustomerSnapshotModel,
  buildSnapshotSummary,
  collectOfferCommercialRates,
  flattenSnapshotChips,
  resolveConfirmedWishRate,
  splitExpandedChips,
  SNAPSHOT_EXPANDED_VISIBLE_CHIPS,
  SNAPSHOT_GROUP,
  SNAPSHOT_GROUP_TITLE,
  SNAPSHOT_MINI_EDITOR,
  SNAPSHOT_SUMMARY_MAX_TOKENS,
  SNAPSHOT_TINT,
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

// --- Category order (feste Gruppen-Reihenfolge) ---
{
  const lead = baseLead({
    vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line' },
    wish: { ...baseLead().wish, equipment: 'GT-Line' },
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
        modelHint: 'ev2',
        equipmentWishes: ['GT-Line'],
      },
      vehicleConfigurations: [
        {
          id: 'vc-1',
          model: 'EV2',
          modelKey: 'ev2',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE, preferredColor: 'Blau' },
        },
      ],
    },
  });
  const snap = buildCustomerSnapshotModel(lead);
  const ids = snap.groups.map((g) => g.id);
  assert.deepEqual(ids, [
    SNAPSHOT_GROUP.BEDARF,
    SNAPSHOT_GROUP.BESTAND,
    SNAPSHOT_GROUP.BUDGET_VERTRAG,
    SNAPSHOT_GROUP.WUNSCH,
  ], 'Gruppen-Reihenfolge: Alltag → Bestand → Budget/Vertrag → Wunsch');
  assert.equal(snap.groups[0].title, SNAPSHOT_GROUP_TITLE[SNAPSHOT_GROUP.BEDARF]);
  assert.equal(snap.groups[1].title, 'Bestandsfahrzeug');
  assert.equal(snap.groups[2].title, 'Budget und Vertrag');
  assert.equal(snap.groups[3].title, 'Fahrzeugwunsch');
  const flat = flattenSnapshotChips(snap.groups);
  const firstBedarf = flat.findIndex((c) => c.groupId === SNAPSHOT_GROUP.BEDARF);
  const firstBestand = flat.findIndex((c) => c.groupId === SNAPSHOT_GROUP.BESTAND);
  const firstBudget = flat.findIndex((c) => c.groupId === SNAPSHOT_GROUP.BUDGET_VERTRAG);
  const firstWunsch = flat.findIndex((c) => c.groupId === SNAPSHOT_GROUP.WUNSCH);
  assert.ok(firstBedarf < firstBestand && firstBestand < firstBudget && firstBudget < firstWunsch);
  console.log('✓ Category order fixed');
}

// --- Overflow +N (expanded chips) ---
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
  const chips = flattenSnapshotChips(snap.groups);
  assert.ok(chips.length > SNAPSHOT_EXPANDED_VISIBLE_CHIPS, 'genug Chips für Overflow');
  const split = splitExpandedChips(chips, SNAPSHOT_EXPANDED_VISIBLE_CHIPS, false);
  assert.equal(split.visible.length, SNAPSHOT_EXPANDED_VISIBLE_CHIPS);
  assert.ok(split.overflow > 0);
  const open = splitExpandedChips(chips, SNAPSHOT_EXPANDED_VISIBLE_CHIPS, true);
  assert.equal(open.overflow, 0);
  assert.equal(open.visible.length, chips.length);
  console.log('✓ Overflow +N weitere');
}

// --- Offer-rate must NOT leak into Wunschrate ---
{
  const lead = {
    id: 'lead-offer-leak',
    name: 'Test',
    // Top-level equals offer PDF rate – ohne wish.desiredRate
    desiredRate: 132,
    wish: {
      paymentType: 'leasing',
      termMonths: 48,
      mileagePerYear: 15000,
      // kein desiredRate = kein bestätigter Kundenwunsch
    },
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [
        {
          id: 'vc-pdf',
          model: 'EV3',
          monthlyRate: 132,
          vehicleOffer: { monthlyRate: 132 },
          source: { createdFrom: 'magic_offer_pdf' },
        },
      ],
    },
  };
  const working = [
    buildOfferWorkingContextItem({
      id: 'vc-pdf',
      modelName: 'EV3',
      desiredRate: 132,
      termMonths: 48,
      mileagePerYear: 15000,
      paymentType: 'leasing',
      downPayment: 0,
    }),
  ];
  const offerRates = collectOfferCommercialRates(lead, working);
  assert.ok(offerRates.has(132), 'Offer-Rate erkannt');
  assert.equal(resolveConfirmedWishRate(lead, {}, { workingContextItems: working }), null);

  const snap = buildCustomerSnapshotModel(lead, { workingContextItems: working });
  const blob = JSON.stringify(snap);
  assert.ok(!/\b132\b/.test(blob), 'Offer-PDF-Rate 132 € darf nicht als Wunschrate erscheinen');
  assert.ok(!snap.groups.flatMap((g) => g.facts).some((f) => f.id === 'rate'));
  assert.ok(!snap.chips.some((c) => c.id === 'rate' || /132/.test(c.label)));

  // Auch wenn Offer-Rate fälschlich in wish.desiredRate gespiegelt wurde
  const contaminatedWish = {
    ...lead,
    desiredRate: 132,
    wish: { ...lead.wish, desiredRate: 132 },
    crm: {
      ...lead.crm,
      needProfile: {
        ...createEmptyNeedProfile(),
        budget: { paymentType: 'leasing', maxMonthlyRate: 132, maxPrice: null },
      },
    },
  };
  const snapContam = buildCustomerSnapshotModel(contaminatedWish, { workingContextItems: working });
  assert.ok(
    !snapContam.chips.some((c) => c.id === 'rate' || /\b132\b/.test(c.label)),
    'gespiegelte Offer-Rate 132 € darf kein Wunschrate-Chip sein',
  );
  assert.equal(
    resolveConfirmedWishRate(contaminatedWish, contaminatedWish.crm.needProfile, {
      workingContextItems: working,
    }),
    null,
  );

  // Mit bestätigtem Wunsch: 300 bleibt, 132 bleibt draußen
  const withWish = {
    ...lead,
    desiredRate: 300,
    wish: { ...lead.wish, desiredRate: 300 },
    crm: {
      ...lead.crm,
      needProfile: {
        ...createEmptyNeedProfile(),
        budget: { paymentType: 'leasing', maxMonthlyRate: 300, maxPrice: null },
      },
    },
  };
  const snapWish = buildCustomerSnapshotModel(withWish, { workingContextItems: working });
  const rateFact = snapWish.groups.flatMap((g) => g.facts).find((f) => f.id === 'rate');
  assert.ok(rateFact, 'Wunschrate vorhanden');
  assert.match(rateFact.label, /300/);
  assert.ok(!/132/.test(rateFact.label));
  assert.equal(rateFact.category, SNAPSHOT_TINT.BUDGET);
  console.log('✓ No offer-rate leak into wish');
}

// --- Flat chips array with category tint ---
{
  const lead = baseLead({
    vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line' },
    wish: { ...baseLead().wish, equipment: 'GT-Line' },
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
        modelHint: 'ev2',
      },
      vehicleConfigurations: [
        {
          id: 'vc-1',
          model: 'EV2',
          modelKey: 'ev2',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE, preferredColor: 'Blau' },
        },
      ],
    },
  });
  const snap = buildCustomerSnapshotModel(lead);
  assert.ok(Array.isArray(snap.chips) && snap.chips.length > 0, 'chips flat array');
  assert.equal(snap.chips.length, snap.groups.flatMap((g) => g.facts).length);
  for (const chip of snap.chips) {
    assert.ok(chip.category, `chip ${chip.id} has category`);
    assert.ok(chip.tint, `chip ${chip.id} has tint`);
    assert.equal(chip.category, chip.tint);
    assert.ok(
      Object.values(SNAPSHOT_TINT).includes(chip.category),
      `chip ${chip.id} tint is known category`,
    );
  }
  const byId = Object.fromEntries(snap.chips.map((c) => [c.id, c]));
  assert.equal(byId.children?.category, SNAPSHOT_TINT.ALLTAG);
  assert.equal(byId.rate?.category, SNAPSHOT_TINT.BUDGET);
  assert.equal(byId.termMonths?.category, SNAPSHOT_TINT.VERTRAG);
  assert.equal(byId.existingVehicle?.category, SNAPSHOT_TINT.INZAHLUNGNAHME);
  assert.ok(
    snap.chips.some((c) => c.category === SNAPSHOT_TINT.FAHRZEUG),
    'Fahrzeug-Chip vorhanden',
  );
  // Kein joined Summary-Blob als einzelner Chip
  assert.ok(
    !snap.chips.some((c) => /Leasing.*Monate|€.*AZ.*Leasing/i.test(c.label)),
    'keine zusammengeklebten Gruppen-Texte als Chip',
  );
  console.log('✓ Flat chips with category tint');
}

// --- Working context model leak ---
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

// --- Mini-editor keys ---
{
  const lead = baseLead({
    crm: {
      ...baseLead().crm,
      vehicleConfigurations: [
        {
          id: 'vc-1',
          model: 'EV2',
          modelKey: 'ev2',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE, preferredColor: 'Blau' },
        },
      ],
    },
  });
  const snap = buildCustomerSnapshotModel(lead);
  const byId = Object.fromEntries(
    snap.groups.flatMap((g) => g.facts).map((f) => [f.id, f]),
  );
  assert.equal(byId.rate?.miniEditor, SNAPSHOT_MINI_EDITOR.DESIRED_RATE);
  assert.equal(byId.children?.miniEditor, SNAPSHOT_MINI_EDITOR.CHILDREN);
  assert.equal(byId.termMonths?.miniEditor, SNAPSHOT_MINI_EDITOR.TERM_MONTHS);
  assert.equal(byId.mileagePerYear?.miniEditor, SNAPSHOT_MINI_EDITOR.MILEAGE);
  assert.equal(byId['color:Blau']?.miniEditor, SNAPSHOT_MINI_EDITOR.COLOR);
  assert.equal(byId.existingVehicle?.miniEditor, SNAPSHOT_MINI_EDITOR.TRADE_IN);
  assert.equal(byId.dog?.miniEditor, SNAPSHOT_MINI_EDITOR.DOG);
  assert.equal(byId.paymentType?.miniEditor, SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE);
  const editors = new Set(
    snap.groups.flatMap((g) => g.facts).map((f) => f.miniEditor).filter(Boolean),
  );
  assert.ok(editors.has(SNAPSHOT_MINI_EDITOR.DESIRED_RATE));
  assert.ok(editors.has(SNAPSHOT_MINI_EDITOR.CHILDREN));
  console.log('✓ Mini-editor keys');
}

// --- Soft tints ---
{
  const snap = buildCustomerSnapshotModel(baseLead());
  const rate = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'rate');
  const term = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'termMonths');
  const children = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'children');
  const bestand = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'existingVehicle');
  assert.equal(children?.tint, SNAPSHOT_TINT.ALLTAG);
  assert.equal(rate?.tint, SNAPSHOT_TINT.BUDGET);
  assert.equal(term?.tint, SNAPSHOT_TINT.VERTRAG);
  assert.equal(bestand?.tint, SNAPSHOT_TINT.INZAHLUNGNAHME);
  console.log('✓ Soft category tints');
}

// --- Collapsed summary ---
{
  const lead = baseLead({
    vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line' },
    wish: { ...baseLead().wish, equipment: 'GT-Line' },
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
        modelHint: 'ev2',
      },
      vehicleConfigurations: [
        {
          id: 'vc-1',
          model: 'EV2',
          modelKey: 'ev2',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE },
        },
      ],
    },
  });
  const snap = buildCustomerSnapshotModel(lead);
  assert.ok(snap.summary.line.length > 0);
  assert.ok(snap.summary.tokens.length <= SNAPSHOT_SUMMARY_MAX_TOKENS);
  assert.match(snap.summary.line, /Kinder|Hund|300|Ford|EV2/i);
  if (snap.meta.factCount > SNAPSHOT_SUMMARY_MAX_TOKENS) {
    assert.match(snap.summary.line, /\+\d+/);
  }
  // Kategorie-Reihenfolge in Summary: Bedarf vor Bestand vor Budget vor Wunsch
  const tokenGroups = snap.summary.tokens.map((t) => t.groupId);
  for (let i = 1; i < tokenGroups.length; i += 1) {
    const order = [
      SNAPSHOT_GROUP.BEDARF,
      SNAPSHOT_GROUP.BESTAND,
      SNAPSHOT_GROUP.BUDGET_VERTRAG,
      SNAPSHOT_GROUP.WUNSCH,
    ];
    assert.ok(
      order.indexOf(tokenGroups[i - 1]) <= order.indexOf(tokenGroups[i]),
      'Summary folgt Kategorie-Reihenfolge',
    );
  }
  const short = buildSnapshotSummary(snap.groups, 2);
  assert.equal(short.tokens.length, 2);
  assert.ok(short.overflow >= 1);
  assert.match(short.line, /\+\d+/);
  console.log('✓ Collapsed summary');
}

// --- Seller insights ---
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
  assert.ok(snap.groups.some((g) => g.id === SNAPSHOT_GROUP.BUDGET_VERTRAG), 'Budget/Vertrag mit Inhalt');
  assert.ok(snap.groups.every((g) => g.facts.length > 0), 'keine leeren Gruppen');
  console.log('✓ Empty groups omitted');
}

// --- Relevance / highlight ---
{
  const snap = buildCustomerSnapshotModel(baseLead(), {
    relevantKeys: ['desiredRate', 'children'],
  });
  const rate = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'rate');
  const children = snap.groups.flatMap((g) => g.facts).find((f) => f.id === 'children');
  assert.equal(rate?.relevant, true);
  assert.equal(children?.relevant, true);
  const hi = buildCustomerSnapshotModel(baseLead(), { highlightLabels: ['Hund'] });
  const dog = hi.groups.flatMap((g) => g.facts).find((f) => f.id === 'dog');
  assert.equal(dog?.highlighted, true);
  console.log('✓ Relevance / highlight keys');
}

// --- Trim → Fahrzeugwunsch ---
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
