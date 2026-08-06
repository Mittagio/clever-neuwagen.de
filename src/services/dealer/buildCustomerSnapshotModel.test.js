/**
 * node src/services/dealer/buildCustomerSnapshotModel.test.js
 */
import assert from 'node:assert/strict';
import {
  buildCustomerSnapshotModel,
  buildKernKonditionen,
  buildSnapshotSummary,
  buildWorkingContextStrip,
  classifySnapshotNoteLabel,
  collectOfferCommercialRates,
  flattenSnapshotChips,
  formatLeasingEndLabel,
  isActivitySnapshotNote,
  isStructuredSnapshotNote,
  resolveConfirmedWishRate,
  splitExpandedChips,
  SNAPSHOT_EXPANDED_VISIBLE_CHIPS,
  SNAPSHOT_MINI_EDITOR,
  SNAPSHOT_TINT,
  SOFT_SNAPSHOT_GROUP,
  SOFT_SNAPSHOT_GROUP_TITLE,
  KERN_SNAPSHOT_FACT_IDS,
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
    paymentType: 'financing',
    desiredRate: 300,
    wish: {
      paymentType: 'financing',
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

// --- Kern: nur Laufzeit · km · AZ · Ende; kein Header-Duplikat ---
{
  const lead = baseLead({
    vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line' },
    wish: {
      ...baseLead().wish,
      equipment: 'GT-Line',
      leasingEndDate: '2026-07',
      mileagePerYear: 20000,
      downPayment: 6000,
      paymentType: 'financing',
    },
    paymentType: 'financing',
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
        modelHint: 'ev2',
        priorities: ['charging', 'range', 'space'],
        equipmentWishes: ['heat_pump'],
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

  assert.ok(snap.kern?.hasData, 'Kernkonditionen vorhanden');
  assert.match(snap.kern.line, /48 Monate/);
  assert.match(snap.kern.line, /20\.000 km/);
  assert.match(snap.kern.line, /6\.000 € AZ/);
  assert.match(snap.kern.line, /Ende Juli 2026/);
  assert.ok(!/Finanzierung|Leasing/i.test(snap.kern.line), 'Zahlungsart nicht im Kern (Header)');
  assert.ok(!/EV2|GT-Line/i.test(snap.kern.line), 'Fahrzeugtrack nicht im Kern (Header)');
  assert.deepEqual(
    snap.kernChips.map((c) => c.id).sort(),
    [...KERN_SNAPSHOT_FACT_IDS].sort(),
  );
  assert.ok(!snap.kernChips.some((c) => c.id === 'paymentType'));
  assert.ok(!snap.kernChips.some((c) => c.id === 'rate'));
  assert.ok(!snap.kernChips.some((c) => c.id === 'vehicleWish'));

  // Soft enthält keine Header-/Kern-Duplikate
  assert.ok(!snap.softChips.some((c) => c.id === 'termMonths'), 'Laufzeit nicht in Soft');
  assert.ok(!snap.softChips.some((c) => c.id === 'mileagePerYear'), 'km nicht in Soft');
  assert.ok(!snap.softChips.some((c) => c.id === 'downPayment'), 'AZ nicht in Soft');
  assert.ok(!snap.softChips.some((c) => c.id === 'paymentType'), 'Zahlungsart nicht in Soft');
  assert.ok(!snap.softChips.some((c) => c.id === 'leasingEndDate'), 'Ende nicht in Soft');
  assert.ok(!snap.softChips.some((c) => /EV2\s*·\s*GT-Line/i.test(c.label)), 'Track nicht in Soft');
  assert.ok(!snap.softChips.some((c) => c.label === 'Finanzierung'), 'Zahlungsart nicht in Soft');

  assert.ok(snap.softChips.some((c) => /Kinder/i.test(c.label)), 'Kinder in Soft');
  assert.ok(snap.softChips.some((c) => /Hund/i.test(c.label)), 'Hund in Soft');
  assert.ok(snap.softChips.some((c) => /Ford Focus/i.test(c.label)), 'GW in Soft');
  assert.ok(snap.softChips.some((c) => c.label === 'Blau'), 'Farbe in Soft');
  assert.ok(snap.softChips.some((c) => /Ladezeit/i.test(c.label)), 'Ladezeit in Soft');
  assert.ok(snap.softChips.some((c) => c.label === 'Wärmepumpe'), 'Ausstattung confirmed in Soft');
  console.log('✓ Kern only term/km/AZ/end; no header dupes');
}

// --- Soft-Gruppen Taxonomie + Titel Kundenwissen ---
{
  const lead = appendSellerInsightToLead(
    baseLead({
      crm: {
        ...baseLead().crm,
        needProfile: {
          ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
          priorities: ['charging'],
          equipmentWishes: ['heat_pump'],
          modelHint: 'ev2',
        },
        kundenhelfer: {
          conversationNotes: [{ text: 'kommt samstags vorbei' }],
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
    }),
    'Kaffee schwarz',
  );
  const snap = buildCustomerSnapshotModel(lead);
  assert.equal(snap.soft.title, 'Kundenwissen');
  const ids = snap.soft.groups.map((g) => g.id);
  assert.ok(ids.includes(SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG));
  assert.ok(ids.includes(SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ));
  assert.ok(ids.includes(SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK));
  assert.ok(ids.includes(SOFT_SNAPSHOT_GROUP.BESTAND));
  assert.ok(ids.includes(SOFT_SNAPSHOT_GROUP.PERSOENLICH));
  assert.equal(
    snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG)?.title,
    SOFT_SNAPSHOT_GROUP_TITLE[SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG],
  );
  assert.equal(
    snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ)?.title,
    'Fahrzeugpräferenz',
  );
  assert.equal(
    snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK)?.title,
    'Ausstattung & Technik',
  );
  const persoenlich = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.PERSOENLICH);
  assert.ok(persoenlich.facts.some((f) => /samstags/i.test(f.label)), 'Freinotiz in Persönlich');
  assert.ok(persoenlich.facts.some((f) => /Kaffee/i.test(f.label)), 'Kaffee schwarz als Persönlich');
  console.log('✓ Soft taxonomy groups + Kundenwissen title');
}

// --- Note classifier + Kai Drechsel cleanup ---
{
  assert.equal(classifySnapshotNoteLabel('Grau').slot, 'color');
  assert.equal(classifySnapshotNoteLabel('Automatik').slot, 'drive');
  assert.equal(classifySnapshotNoteLabel('Elektro').slot, 'drive');
  assert.equal(classifySnapshotNoteLabel('Totwinkelassistent').slot, 'equipment');
  assert.equal(classifySnapshotNoteLabel('Spurhalteassistent').slot, 'equipment');
  assert.equal(classifySnapshotNoteLabel('Verkehrszeichenerkennung').slot, 'equipment');
  assert.equal(classifySnapshotNoteLabel('Totwinkelassistent · muss').priority, 'required');
  assert.equal(classifySnapshotNoteLabel('EV2 interessant').slot, 'vehicleTrack');
  assert.equal(classifySnapshotNoteLabel('GT-Line').slot, 'vehicleTrack');
  assert.ok(isActivitySnapshotNote('Beratungsgespräch · 27.07.2026 · 14:44'));
  assert.ok(isStructuredSnapshotNote('Grau'));
  assert.equal(classifySnapshotNoteLabel('Kaffee schwarz').kind, 'free');
  assert.equal(classifySnapshotNoteLabel('Frau entscheidet mit').kind, 'free');

  let lead = baseLead({
    vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line' },
    wish: { ...baseLead().wish, equipment: 'GT-Line', paymentType: 'financing' },
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
  for (const text of [
    'EV2 interessant',
    'Elektro',
    'GT-Line',
    'Grau',
    'Automatik',
    'Totwinkelassistent',
    'Spurhalteassistent',
    'Verkehrszeichenerkennung',
    'Beratungsgespräch · 27.07.2026 · 14:44',
    'Kaffee schwarz',
    'Frau entscheidet mit',
  ]) {
    lead = appendSellerInsightToLead(lead, text);
  }
  const snap = buildCustomerSnapshotModel(lead);
  const noteLabels = snap.softChips
    .filter((c) => c.tint === SNAPSHOT_TINT.NOTIZ || String(c.id).startsWith('note:'))
    .map((c) => c.label);
  assert.ok(!noteLabels.some((l) => /EV2|Elektro|GT-Line|Grau|Automatik|Totwinkel|Spurhalte|Verkehrszeichen|Beratungsgespräch/i.test(l)),
    `strukturierte/activity nicht als Notiz: ${noteLabels.join(', ')}`);
  assert.ok(noteLabels.some((l) => /Kaffee/i.test(l)));
  assert.ok(noteLabels.some((l) => /Frau entscheidet/i.test(l)));

  const mensch = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG);
  assert.ok(!mensch?.facts.some((f) => /Totwinkel|Spurhalte|Verkehrszeichen/i.test(f.label)),
    'Equipment nicht in Mensch & Alltag');

  const praef = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  assert.ok(praef?.facts.some((f) => f.label === 'Grau'), 'Grau → Fahrzeugpräferenz');
  assert.ok(praef?.facts.some((f) => f.label === 'Automatik'), 'Automatik → Fahrzeugpräferenz');
  assert.ok(praef?.facts.some((f) => f.label === 'Elektro'), 'Elektro → Fahrzeugpräferenz');
  assert.ok(!praef?.facts.some((f) => /EV2 interessant|GT-Line/i.test(f.label)),
    'Modell/Trim nicht in Soft (Header)');

  const equip = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK);
  assert.ok(equip?.facts.some((f) => /Totwinkel/i.test(f.label)), 'Totwinkel → Ausstattung');
  assert.ok(equip?.facts.some((f) => /Spurhalte/i.test(f.label)), 'Spurhalte → Ausstattung');
  assert.ok(equip?.facts.some((f) => /Verkehrszeichen/i.test(f.label)), 'VZE → Ausstattung');

  assert.ok(!snap.softChips.some((f) => /Beratungsgespräch/i.test(f.label)),
    'Activity nicht in Kundenwissen');
  console.log('✓ Note filter + Kai Drechsel reslot');
}

// --- Collapsed soft summary person-first ---
{
  const lead = baseLead({
    vehicle: { brand: 'Kia', model: 'EV2', trim: 'GT-Line' },
    wish: { ...baseLead().wish, equipment: 'GT-Line', termMonths: 48 },
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
        modelHint: 'ev2',
        priorities: ['charging'],
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
  assert.match(snap.soft.summary.line, /Kinder/i);
  assert.match(snap.soft.summary.line, /Hund/i);
  assert.match(snap.soft.summary.line, /Ford Focus/i);
  assert.ok(!/48 Monate|15\.000 km|Leasing|Finanzierung/i.test(snap.soft.summary.line),
    'keine Kernkonditionen in Soft-Summary');
  assert.ok(!/\b300\b/.test(snap.soft.summary.line), 'keine Rate in Soft-Summary');
  console.log('✓ Collapsed soft summary person-first');
}

// --- Ausstattung confirmed-only + CTA auf Ausstattung & Technik ---
{
  const lead = baseLead({
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('Hund', createEmptyNeedProfile()),
        equipmentWishes: ['heat_pump', 'GT-Line'],
        modelHint: 'ev2',
      },
    },
  });
  const snap = buildCustomerSnapshotModel(lead);
  const equip = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK);
  assert.ok(equip, 'Ausstattung-&-Technik-Gruppe');
  assert.equal(equip.showEquipmentCta, true, 'Ausstattung-CTA Flag');
  assert.ok(equip.facts.some((f) => f.label === 'Wärmepumpe'), 'confirmed equipment chip');
  assert.ok(!equip.facts.some((f) => f.label === 'GT-Line' && f.id.startsWith('equip:')),
    'Trim nicht als Ausstattungs-Chip');
  const alltag = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG);
  assert.ok(!alltag?.facts.some((f) => f.label === 'Wärmepumpe'), 'Equipment nicht in Alltag');
  console.log('✓ Ausstattung confirmed-only + CTA');
}

// --- Summary-Priorität: Mensch · Bestand · entscheidend · Präferenz · Ausstattung ---
{
  const lead = appendSellerInsightToLead(
    appendSellerInsightToLead(
      appendSellerInsightToLead(
        baseLead({
          crm: {
            ...baseLead().crm,
            needProfile: {
              ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
              priorities: ['charging'],
              equipmentWishes: ['heat_pump'],
              colorPreference: 'grau',
              transmission: 'automatic',
            },
          },
        }),
        'Totwinkelassistent · muss',
      ),
      'Grau',
    ),
    'Automatik',
  );
  const snap = buildCustomerSnapshotModel(lead);
  const tokens = snap.soft.summary.tokens.map((t) => t.label);
  const idxKinder = tokens.findIndex((l) => /Kinder/i.test(l));
  const idxHund = tokens.findIndex((l) => /Hund/i.test(l));
  const idxGw = tokens.findIndex((l) => /Ford Focus/i.test(l));
  assert.ok(idxKinder >= 0 && idxHund >= 0, 'Mensch in Summary');
  assert.ok(idxGw >= 0, 'Bestand in Summary');
  assert.ok(idxKinder < idxGw || idxHund < idxGw, 'Mensch vor Bestand');
  console.log('✓ Summary priority human/bestand first');
}

// --- Offer/PDF überschreibt Customer Truth nicht (Kern nur bestätigt) ---
{
  const lead = {
    id: 'lead-offer-leak',
    name: 'Test',
    desiredRate: 132,
    wish: {
      paymentType: 'leasing',
      termMonths: 36,
      mileagePerYear: 15000,
      downPayment: 6000,
      leasingEndDate: '2026-07',
    },
    crm: {
      needProfile: createEmptyNeedProfile(),
      vehicleConfigurations: [
        {
          id: 'vc-pdf',
          model: 'EV2',
          modelName: 'EV2',
          monthlyRate: 132,
          termMonths: 36,
          mileagePerYear: 15000,
          downPayment: 6000,
          paymentType: 'leasing',
          leasingEndDate: '2026-07',
          vehicleOffer: { monthlyRate: 132 },
          source: { createdFrom: 'magic_offer_pdf' },
        },
      ],
    },
  };
  const working = [
    buildOfferWorkingContextItem({
      id: 'vc-pdf',
      modelName: 'EV2',
      desiredRate: 132,
      termMonths: 36,
      mileagePerYear: 15000,
      paymentType: 'leasing',
      downPayment: 6000,
      leasingEndDate: '2026-07',
    }),
  ];
  const offerRates = collectOfferCommercialRates(lead, working);
  assert.ok(offerRates.has(132), 'Offer-Rate erkannt');
  assert.equal(resolveConfirmedWishRate(lead, {}, { workingContextItems: working }), null);

  const snap = buildCustomerSnapshotModel(lead, { workingContextItems: working });
  assert.ok(!snap.softChips.some((c) => c.id === 'rate' || /\b132\b/.test(c.label)),
    'Offer-Rate nicht in Soft');
  assert.ok(!snap.softChips.some((c) => c.id === 'termMonths'), 'Offer-Laufzeit nicht in Soft');
  // Wish-Werte die 1:1 Offer spiegeln → nicht als Customer Truth im Kern
  assert.ok(!snap.kernChips.some((c) => c.id === 'termMonths' && /36/.test(c.label))
    || snap.kern.source === 'wish',
  'Offer-Spiegelung nicht als Deal-Kern erzwingen');
  assert.ok(!snap.kernChips.some((c) => c.id === 'rate' || /\b132\b/.test(c.label)),
    'Offer-Monatsrate nicht als Wunschrate im Kern');
  assert.ok(snap.workingContext?.line, 'Working Context zeigt Angebot separat');

  // Bestätigter Wunsch (abweichend vom Offer) erscheint im Kern
  const withWish = {
    ...lead,
    desiredRate: 300,
    wish: { ...lead.wish, desiredRate: 300, termMonths: 48, mileagePerYear: 20000 },
    crm: {
      ...lead.crm,
      needProfile: {
        ...createEmptyNeedProfile(),
        budget: { paymentType: 'leasing', maxMonthlyRate: 300, maxPrice: null },
      },
    },
  };
  const snapWish = buildCustomerSnapshotModel(withWish, { workingContextItems: working });
  assert.ok(snapWish.kernChips.some((c) => c.id === 'termMonths' && /48/.test(c.label)));
  assert.ok(snapWish.kernChips.some((c) => c.id === 'mileagePerYear' && /20\.000/.test(c.label)));
  assert.ok(!snapWish.kernChips.some((c) => c.id === 'paymentType'));
  assert.ok(!snapWish.softChips.some((c) => c.id === 'termMonths'));
  console.log('✓ Offer does not overwrite customer truth');
}

// --- Working context does not leak into soft ---
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
  const softBlob = JSON.stringify(snap.softChips);
  assert.ok(!/Geheim-Modell|XYZ|999/i.test(softBlob), 'Working Context nicht in Soft');
  assert.ok(snap.kern?.hasData);
  console.log('✓ Working context does not leak into soft');
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
  const kernById = Object.fromEntries(snap.kernChips.map((f) => [f.id, f]));
  const softById = Object.fromEntries(snap.softChips.map((f) => [f.id, f]));
  assert.equal(softById.children?.miniEditor, SNAPSHOT_MINI_EDITOR.CHILDREN);
  assert.equal(kernById.termMonths?.miniEditor, SNAPSHOT_MINI_EDITOR.TERM_MONTHS);
  assert.equal(kernById.mileagePerYear?.miniEditor, SNAPSHOT_MINI_EDITOR.MILEAGE);
  assert.equal(softById['color:Blau']?.miniEditor, SNAPSHOT_MINI_EDITOR.COLOR);
  assert.equal(softById.existingVehicle?.miniEditor, SNAPSHOT_MINI_EDITOR.TRADE_IN);
  assert.equal(softById.dog?.miniEditor, SNAPSHOT_MINI_EDITOR.DOG);
  console.log('✓ Mini-editor keys');
}

// --- Soft tints ---
{
  const snap = buildCustomerSnapshotModel(baseLead({
    crm: {
      ...baseLead().crm,
      needProfile: {
        ...mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
        priorities: ['charging'],
      },
    },
  }));
  const term = snap.kernChips.find((f) => f.id === 'termMonths');
  const children = snap.softChips.find((f) => f.id === 'children');
  const bestand = snap.softChips.find((f) => f.id === 'existingVehicle');
  const ladezeit = snap.softChips.find((f) => /Ladezeit/i.test(f.label));
  assert.equal(children?.tint, SNAPSHOT_TINT.ALLTAG);
  assert.equal(term?.tint, SNAPSHOT_TINT.VERTRAG);
  assert.equal(bestand?.tint, SNAPSHOT_TINT.INZAHLUNGNAHME);
  assert.equal(ladezeit?.tint, SNAPSHOT_TINT.WICHTIG);
  console.log('✓ Soft category tints');
}

// --- Flat soft chips with category ---
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
  assert.ok(Array.isArray(snap.chips) && snap.chips.length > 0);
  assert.equal(snap.chips.length, snap.softChips.length);
  for (const chip of snap.softChips) {
    assert.ok(chip.category, `chip ${chip.id} has category`);
    assert.ok(Object.values(SNAPSHOT_TINT).includes(chip.category));
  }
  assert.ok(!snap.softChips.some((c) => /EV2\s*·\s*GT-Line/i.test(c.label)),
    'Fahrzeugtrack nicht als Soft-Chip');
  console.log('✓ Flat soft chips with category tint');
}

// --- Overflow helper still works ---
{
  const chips = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, label: `L${i}` }));
  assert.ok(chips.length > SNAPSHOT_EXPANDED_VISIBLE_CHIPS);
  const split = splitExpandedChips(chips, SNAPSHOT_EXPANDED_VISIBLE_CHIPS, false);
  assert.equal(split.visible.length, SNAPSHOT_EXPANDED_VISIBLE_CHIPS);
  assert.ok(split.overflow > 0);
  console.log('✓ Overflow helper');
}

// --- Relevance / highlight on soft ---
{
  const snap = buildCustomerSnapshotModel(baseLead(), {
    relevantKeys: ['termMonths', 'children'],
  });
  const term = snap.kernChips.find((f) => f.id === 'termMonths');
  const children = snap.softChips.find((f) => f.id === 'children');
  assert.equal(term?.relevant, true);
  assert.equal(children?.relevant, true);
  const hi = buildCustomerSnapshotModel(baseLead(), { highlightLabels: ['Hund'] });
  const dog = hi.softChips.find((f) => f.id === 'dog');
  assert.equal(dog?.highlighted, true);
  console.log('✓ Relevance / highlight keys');
}

// --- Leasingende Format ---
{
  assert.equal(formatLeasingEndLabel('2026-07'), 'Ende Juli 2026');
  assert.equal(formatLeasingEndLabel('2026-07-15'), 'Ende Juli 2026');
  assert.equal(formatLeasingEndLabel('Ende Q3'), 'Ende Q3');
  console.log('✓ Leasingende Format');
}

// --- buildKernKonditionen direct ---
{
  const kern = buildKernKonditionen(baseLead(), getNeedProfileLike());
  assert.ok(kern.hasData);
  assert.match(kern.line, /Monate|km/i);
  assert.ok(!/Leasing|Finanzierung/i.test(kern.line));
  console.log('✓ buildKernKonditionen');
}

function getNeedProfileLike() {
  return mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile());
}

// --- Working context strip builder (legacy) ---
{
  const strip = buildWorkingContextStrip([
    buildOfferWorkingContextItem({
      id: 'o1',
      modelName: 'EV2',
      termMonths: 36,
      mileagePerYear: 15000,
      downPayment: 6000,
    }),
  ]);
  assert.ok(strip);
  assert.equal(strip.title, 'Aktueller Arbeitskontext');
  assert.match(strip.line, /EV2-Angebot/);
  assert.match(strip.line, /36 Monate/);
  console.log('✓ Working context strip');
}

// --- Summary helper ---
{
  const short = buildSnapshotSummary([
    { facts: [{ id: 'a', label: 'A', summaryPriority: 1 }, { id: 'b', label: 'B', summaryPriority: 2 }] },
  ], 1);
  assert.equal(short.tokens.length, 1);
  assert.match(short.line, /\+\d+/);
  console.log('✓ Summary helper');
}

// --- flattenSnapshotChips ---
{
  const flat = flattenSnapshotChips([
    { id: SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG, title: 'X', facts: [{ id: 'c', label: 'Kinder', tint: 'alltag' }] },
  ]);
  assert.equal(flat[0].groupId, SOFT_SNAPSHOT_GROUP.MENSCH_ALLTAG);
  console.log('✓ flattenSnapshotChips');
}

console.log('\nbuildCustomerSnapshotModel.test.js: OK');
