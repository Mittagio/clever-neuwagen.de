/**
 * node src/services/dealer/buildCustomerSnapshotModel.test.js
 */
import assert from 'node:assert/strict';
import {
  buildCustomerSnapshotModel,
  buildKernKonditionen,
  buildKnowledgeChipProvenanceTitle,
  buildSnapshotSummary,
  buildSoftPanelTopics,
  buildWorkingContextStrip,
  isDecisionSoftFactLabel,
  classifySnapshotNoteLabel,
  collectHistoryKnowledgeLabels,
  collectOfferCommercialRates,
  harvestHistoryKnowledgeAtoms,
  EQUIPMENT_WISH_PRIORITY,
  flattenSnapshotChips,
  formatEquipmentWishLabel,
  formatLeasingEndLabel,
  isActivitySnapshotNote,
  isSnapshotContactIdentityLabel,
  isSnapshotSystemNoiseLabel,
  isStructuredSnapshotNote,
  normalizeKnowledgeChipSource,
  resolveConfirmedWishRate,
  resolveCustomerSourceChannelLabel,
  splitExpandedChips,
  stripEquipmentPrioritySuffix,
  SNAPSHOT_EXPANDED_VISIBLE_CHIPS,
  SNAPSHOT_MINI_EDITOR,
  SNAPSHOT_TINT,
  SOFT_SNAPSHOT_GROUP,
  KERN_SNAPSHOT_FACT_IDS,
} from './buildCustomerSnapshotModel.js';
import {
  createEmptyNeedProfile,
  mergeTextIntoNeedProfile,
} from '../consultation/needProfileService.js';
import {
  appendSellerInsightToLead,
  appendSellerInsightsFromTexts,
} from './sellerInsights.js';
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

  assert.ok(snap.kern?.hasData, 'Konditionen vorhanden');
  assert.equal(snap.kern.title, 'Konditionen');
  assert.match(snap.kern.line, /48 Monate/);
  assert.match(snap.kern.line, /20\.000 km/);
  assert.match(snap.kern.line, /6\.000 € AZ/);
  assert.match(snap.kern.line, /Ende Juli 2026/);
  assert.ok(snap.kernChips.some((c) => c.id === 'paymentType'), 'Zahlungsart in Konditionen');
  assert.ok(!/EV2|GT-Line/i.test(snap.kern.line), 'Fahrzeugtrack nicht im Kern (Header)');
  assert.deepEqual(
    snap.kernChips.map((c) => c.id).sort(),
    [...KERN_SNAPSHOT_FACT_IDS].sort(),
  );
  assert.ok(snap.kernChips.every((c) => !c.empty), 'gefüllte Konditionen nicht empty');
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
  assert.ok(!snap.softChips.some((c) => /Ford Focus/i.test(c.label)), 'GW nicht in Kundenwissen');
  assert.ok(!snap.soft.groups.some((g) => g.id === SOFT_SNAPSHOT_GROUP.BESTAND), 'kein Bestand-Bucket');
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
  assert.deepEqual(ids, [
    SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
    SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
    SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK,
    SOFT_SNAPSHOT_GROUP.SONSTIGES,
  ]);
  assert.equal(
    snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.PERSOENLICHES)?.title,
    'Persönliches',
  );
  assert.ok(
    !snap.soft.groups.some((g) => g.id === SOFT_SNAPSHOT_GROUP.BESTAND),
    'Fahrzeug & Bestand nicht sichtbar',
  );
  assert.equal(
    snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ)?.title,
    'Fahrzeugwunsch',
  );
  assert.equal(
    snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK)?.title,
    'Ausstattung',
  );
  assert.equal(
    snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.SONSTIGES)?.title,
    'Sonstiges',
  );
  const sonstiges = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.SONSTIGES);
  assert.ok(sonstiges.facts.some((f) => /samstags/i.test(f.label)), 'Soft-Termin unter Sonstiges');
  assert.ok(sonstiges.facts.some((f) => /Kaffee/i.test(f.label)), 'Kaffee schwarz unter Sonstiges');
  assert.equal(
    classifySnapshotNoteLabel('bevorzugt Samstag').groupId,
    SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
    'bevorzugt Samstag → Persönliches',
  );
  assert.ok(snap.soft.groups.every((g) => g.facts.length > 0), 'nur Groups mit Facts');
  assert.ok(
    Array.isArray(snap.soft.topics) && snap.soft.topics.length > 0,
    'Panel-Topics aus Soft-Facts',
  );
  console.log('✓ Soft taxonomy groups + Kundenwissen title');
}

// --- Kein leeres Soft-Gerüst; kein Kontakt-Fallback in Kundenwissen ---
{
  const emptyLead = {
    id: 'lead-empty-soft',
    name: 'Leer',
    wish: { paymentType: 'leasing' },
    crm: { needProfile: createEmptyNeedProfile(), sellerInsights: [] },
  };
  const snap = buildCustomerSnapshotModel(emptyLead);
  assert.deepEqual(snap.soft.groups.map((g) => g.id), [], 'keine Soft-Groups ohne Facts');
  assert.deepEqual(snap.soft.topics || [], [], 'keine Panel-Topics ohne Facts');
  assert.ok(snap.kern?.hasData, 'Konditionen bleiben');
  assert.equal(snap.meta.hasSoftFacts, false);
  assert.equal(snap.soft.contactChips?.length || 0, 0, 'kein Kontakt in Kundenwissen');
  assert.ok(
    !(snap.soft.summary?.line || '').match(/Telefon fehlt|E-Mail fehlt/i),
    'kein Telefon/E-Mail-fehlt in Summary',
  );
  assert.equal(snap.soft.summary?.tokens?.length || 0, 0);
  console.log('✓ Empty soft without contact fallback');
}

// --- System-Noise nie in Soft/Sonstiges (Norz) ---
{
  const norzNoise = {
    id: 'lead-norz-noise',
    name: 'R Norz',
    wish: { paymentType: 'financing' },
    history: [
      { text: 'Wunschkonditionen aktualisiert', type: 'note' },
      { text: 'Clever Kundenhelfer aktualisiert', type: 'note' },
      { text: 'Kundenbild aktualisiert', type: 'note' },
      { text: 'Wunschfarbe schwarz gemerkt', type: 'note' },
    ],
    crm: {
      needProfile: createEmptyNeedProfile(),
      sellerInsights: [],
      kundenhelfer: {
        notes: 'Wunschkonditionen aktualisiert, Clever Kundenhelfer aktualisiert',
      },
    },
  };
  assert.equal(classifySnapshotNoteLabel('Wunschkonditionen aktualisiert').kind, 'activity');
  assert.equal(classifySnapshotNoteLabel('Clever Kundenhelfer aktualisiert').kind, 'activity');
  assert.equal(classifySnapshotNoteLabel('schwarz').slot, 'color');
  assert.equal(classifySnapshotNoteLabel('schwarz').groupId, SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);

  const snap = buildCustomerSnapshotModel(norzNoise);
  const softBlob = JSON.stringify(snap.softChips);
  assert.ok(!/Wunschkonditionen aktualisiert/i.test(softBlob), 'Wunschkonditionen-Noise nicht in Soft');
  assert.ok(!/Kundenhelfer aktualisiert/i.test(softBlob), 'Kundenhelfer-Noise nicht in Soft');
  assert.ok(!/Kundenbild aktualisiert/i.test(softBlob), 'Kundenbild-Noise nicht in Soft');
  const sonstiges = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.SONSTIGES);
  assert.ok(
    !sonstiges?.facts?.some((f) => /aktualisiert/i.test(f.label)),
    'System-Noise nicht unter Sonstiges',
  );
  const praef = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  assert.ok(praef?.facts.some((f) => /schwarz/i.test(f.label)), 'schwarz → Fahrzeugwunsch');
  assert.ok(
    snap.soft.groups.every((g) => g.facts.length > 0),
    'nur Soft-Groups mit Facts',
  );
  console.log('✓ System noise filtered; Farbe → Fahrzeugwunsch; keine leeren Soft-Groups');
}

// --- History/Activity → Soft (Norz: Wunschfarbe nur in Timeline) ---
{
  const norzLike = {
    id: 'lead-norz-history',
    name: 'R Norz',
    wish: { model: 'EV3', equipment: 'GT-Line', paymentType: 'financing' },
    contact: { name: 'R Norz' },
    history: [
      { text: 'Wunschfarbe schwarz gemerkt', type: 'note' },
      { text: 'Clever empfahl: Angebot erstellen', type: 'clever_action' },
    ],
    crm: {
      needProfile: createEmptyNeedProfile(),
      sellerInsights: [],
      vehicleConfigurations: [
        {
          id: 'vc-ev3',
          model: 'EV3',
          modelKey: 'ev3',
          paymentType: 'financing',
          vehicleTrack: { status: VEHICLE_TRACK_STATUS.FAVORITE },
        },
      ],
    },
  };
  const snap = buildCustomerSnapshotModel(norzLike);
  const praef = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  assert.ok(praef, 'Fahrzeugwunsch-Bucket aus History');
  assert.ok(
    praef.facts.some((f) => /schwarz/i.test(f.label)),
    'Wunschfarbe schwarz → Soft Farbe',
  );
  assert.equal(snap.meta.hasSoftFacts, true);
  assert.equal(snap.soft.contactChips?.length || 0, 0, 'kein Kontakt-Fallback wenn Soft-Facts da');
  const summaryLabels = (snap.soft.summary?.tokens || []).map((t) => t.label);
  assert.ok(
    summaryLabels.some((l) => /schwarz/i.test(l)),
    'Summary-Token enthält Schwarz',
  );
  console.log('✓ History Wunschfarbe → Fahrzeugwunsch Soft + Summary');
}

// --- Clever-Nachricht „in schwarz“ / „in terracotta“ → Soft (Norz Live) ---
{
  assert.equal(classifySnapshotNoteLabel('in schwarz').slot, 'color');
  assert.equal(classifySnapshotNoteLabel('in schwarz').remapLabel, 'Schwarz');
  assert.ok(
    harvestHistoryKnowledgeAtoms(
      'Clever Nachricht gesendet: „telefongespräch. kd möchte ein angebot für einen ev5 gt line in schwarz“',
    ).some((l) => /schwarz/i.test(l)),
    'Atom-Harvest: in schwarz',
  );

  const norzLive = {
    id: 'lead-1784903226019-ofgz9',
    name: 'R Norz',
    wish: { equipment: 'GT-Line', paymentType: 'financing' },
    contact: { name: 'R Norz' },
    history: [
      { text: 'Wunschkonditionen aktualisiert', type: 'note' },
      {
        type: 'customer_message',
        text: 'Clever Nachricht gesendet: „angebot ev3 allrad gt line in terracotta“',
      },
      {
        type: 'customer_message',
        text: 'Clever Nachricht gesendet: „schrieb ihm, dass ein fahrzeug sofort verfügbar ist“',
      },
      {
        type: 'customer_message',
        text: 'Clever Nachricht gesendet: „telefongespräch. kd möchte ein angebot für einen ev5 gt line in schwarz“',
      },
      { text: 'Wunschkonditionen aktualisiert', type: 'note' },
    ],
    crm: {
      needProfile: createEmptyNeedProfile(),
      sellerInsights: [],
      kundenhelfer: { notes: '' },
    },
  };

  const labels = collectHistoryKnowledgeLabels(norzLive);
  assert.ok(labels.some((l) => /schwarz/i.test(l)), 'History-Labels: Schwarz');
  assert.ok(labels.some((l) => /terracotta/i.test(l)), 'History-Labels: Terracotta');
  assert.ok(labels.some((l) => /allrad/i.test(l)), 'History-Labels: Allrad');
  assert.ok(
    !labels.some((l) => /wunschkonditionen|sofort verfügbar/i.test(l)),
    'kein System-Noise / Fließtext in History-Labels',
  );

  const snap = buildCustomerSnapshotModel(norzLive);
  assert.equal(snap.meta.hasSoftFacts, true);
  const praef = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  assert.ok(praef?.facts.some((f) => /schwarz/i.test(f.label)), 'Soft: Schwarz');
  assert.ok(praef?.facts.some((f) => /terracotta/i.test(f.label)), 'Soft: Terracotta');
  assert.ok(praef?.facts.some((f) => /allrad/i.test(f.label)), 'Soft: Allrad');
  const softBlob = JSON.stringify(snap.softChips);
  assert.ok(!/Wunschkonditionen aktualisiert/i.test(softBlob), 'Noise nicht in Soft');
  assert.ok(!/sofort verfügbar/i.test(softBlob), 'Fließtext-Nachricht nicht in Soft');
  const summaryLabels = (snap.soft.summary?.tokens || []).map((t) => t.label);
  assert.ok(
    summaryLabels.some((l) => /schwarz|terracotta|allrad/i.test(l)),
    'Summary-Chips light aus Soft-Facts',
  );
  console.log('✓ Clever-Nachricht in schwarz/terracotta → Soft + Summary');
}

// --- Current Truth Kinder: nur letzter Wert ---
{
  let lead = {
    id: 'lead-children-truth',
    name: 'Familie',
    source: 'landing',
    crm: {
      needProfile: mergeTextIntoNeedProfile('2 Kinder', createEmptyNeedProfile()),
      sellerInsights: [],
    },
  };
  const beforeSeller = buildCustomerSnapshotModel(lead);
  const childrenCustomer = beforeSeller.softChips.find((f) => f.id === 'children');
  assert.match(childrenCustomer?.label || '', /2\s*Kinder/i);
  assert.equal(childrenCustomer?.source, 'customer', 'needProfile-Kinder → customer');
  assert.equal(childrenCustomer?.sourceChannel, 'Landingpage');

  lead = appendSellerInsightToLead(lead, '2 Kinder', { sellerName: 'Anna Berger' });
  lead = appendSellerInsightToLead(lead, '3 Kinder', { sellerName: 'Anna Berger' });
  const snap = buildCustomerSnapshotModel(lead);
  const persoenliches = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.PERSOENLICHES);
  const childrenChips = (persoenliches?.facts ?? []).filter((f) => /kinder?|kind/i.test(f.label));
  assert.equal(childrenChips.length, 1, 'nur ein Kinder-Chip');
  assert.match(childrenChips[0].label, /3\s*Kinder/i);
  assert.equal(childrenChips[0].source, 'seller', 'Current Truth nach VK-Korrektur → seller');
  assert.match(childrenChips[0].actorName || '', /Anna/i);
  assert.ok(
    (childrenChips[0].historicalValues ?? []).some((v) => /2\s*Kinder/i.test(v)),
    '2 Kinder in History',
  );
  assert.ok(!snap.softChips.some((c) => /2\s*Kinder/i.test(c.label)), 'alte Kinder nicht als Current');
  const title = buildKnowledgeChipProvenanceTitle(childrenChips[0]);
  assert.match(title || '', /Von Anna Berger ergänzt/);
  console.log('✓ Children current-truth only + source');
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
  assert.equal(classifySnapshotNoteLabel('Wunschfarbe schwarz').slot, 'color');
  assert.equal(classifySnapshotNoteLabel('Wunschfarbe schwarz').remapLabel, 'Schwarz');
  assert.equal(classifySnapshotNoteLabel('schwarz').slot, 'color');
  assert.equal(classifySnapshotNoteLabel('schwarz').remapLabel, 'Schwarz');
  assert.equal(classifySnapshotNoteLabel('Farbe: grau').slot, 'color');
  assert.ok(isSnapshotSystemNoiseLabel('Wunschkonditionen aktualisiert'));
  assert.ok(isSnapshotSystemNoiseLabel('Clever Kundenhelfer aktualisiert'));
  assert.ok(isSnapshotSystemNoiseLabel('Kunde angelegt'));
  assert.ok(isSnapshotSystemNoiseLabel('Angebotsauftrag vorbereitet'));
  assert.ok(isSnapshotSystemNoiseLabel('Kunde verknüpft'));
  assert.ok(isSnapshotSystemNoiseLabel('Kundenakte aus Multi-Source-Intake vorgeschlagen und bestätigt'));
  assert.ok(isSnapshotSystemNoiseLabel('Altvertrag erfasst'));
  assert.ok(isSnapshotSystemNoiseLabel('Vertrag bereits vorhanden'));
  assert.ok(isSnapshotSystemNoiseLabel('Quelle: https://www.kia-trinkle-schorndorf.de/angebote'));
  assert.ok(isSnapshotSystemNoiseLabel('Es ist eine Kontaktanfrage über das Kontaktformular'));
  assert.ok(isSnapshotContactIdentityLabel('07151 1234567'));
  assert.ok(isSnapshotContactIdentityLabel('marcel.grube@example.org'));
  assert.ok(isSnapshotContactIdentityLabel('Herr Marcel Grube'));
  assert.ok(isSnapshotContactIdentityLabel('Marcel', {
    contact: { name: 'Marcel Grube', firstName: 'Marcel', lastName: 'Grube' },
  }));
  assert.ok(isSnapshotContactIdentityLabel('Marcel', {
    contact: { name: 'Marcel Grube' },
  }), 'Vorname aus contact.name ohne firstName-Feld');
  {
    const visionClass = classifySnapshotNoteLabel('Vision');
    assert.equal(visionClass.kind, 'structured');
    assert.equal(visionClass.groupId, SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  }
  assert.equal(classifySnapshotNoteLabel('Kundenservice in der Leasingrate').kind, 'free');
  assert.ok(isActivitySnapshotNote('Wunschkonditionen aktualisiert'));
  assert.equal(classifySnapshotNoteLabel('Frau entscheidet mit').slot, 'human');
  assert.equal(classifySnapshotNoteLabel('Frau entscheidet mit').groupId, SOFT_SNAPSHOT_GROUP.PERSOENLICHES);
  assert.equal(classifySnapshotNoteLabel('Altes Auto: Kia Picanto').slot, 'human');
  assert.equal(classifySnapshotNoteLabel('Altes Auto: Kia Picanto').groupId, SOFT_SNAPSHOT_GROUP.PERSOENLICHES);

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
  assert.ok(!noteLabels.some((l) => /Frau entscheidet/i.test(l)), 'Frau entscheidet nicht als Freinotiz');

  const persoenliches = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.PERSOENLICHES);
  assert.ok(persoenliches?.facts.some((f) => /Frau entscheidet/i.test(f.label)),
    'Frau entscheidet mit → Persönliches');
  assert.ok(!persoenliches?.facts.some((f) => /Totwinkel|Spurhalte|Verkehrszeichen/i.test(f.label)),
    'Equipment nicht in Persönliches');

  const praef = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  assert.ok(praef?.facts.some((f) => f.label === 'Grau'), 'Grau → Fahrzeugwunsch');
  assert.ok(praef?.facts.some((f) => f.label === 'Automatik'), 'Automatik → Fahrzeugwunsch');
  assert.ok(praef?.facts.some((f) => f.label === 'Elektro'), 'Elektro → Fahrzeugwunsch');
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

// --- Merken (sellerInsights only) → Persönliches (inkl. Unfall) ---
{
  assert.equal(classifySnapshotNoteLabel('2 Kinder').slot, 'human');
  assert.equal(classifySnapshotNoteLabel('1 Hund').slot, 'human');
  assert.equal(classifySnapshotNoteLabel('Hund').slot, 'human');
  assert.equal(classifySnapshotNoteLabel('braucht Auto sofort').slot, 'human');
  assert.equal(classifySnapshotNoteLabel('Unfall / Ersatzfahrzeug').slot, 'human');
  assert.equal(
    classifySnapshotNoteLabel('Unfall / Ersatzfahrzeug').groupId,
    SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
  );

  // Wie remember_customer_information: Labels in sellerInsights, needProfile leer
  let lead = {
    id: 'lead-remember-soft',
    name: 'Herr Aalen',
    crm: {
      needProfile: createEmptyNeedProfile(),
      sellerInsights: [],
      kundenhelfer: {
        notes: 'braucht Auto sofort\nUnfall / Ersatzfahrzeug',
      },
      vehicleConfigurations: [],
    },
  };
  lead = appendSellerInsightToLead(lead, '2 Kinder');
  lead = appendSellerInsightToLead(lead, '1 Hund');

  const snap = buildCustomerSnapshotModel(lead);
  const persoenliches = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.PERSOENLICHES);
  const bestand = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.BESTAND);
  const sonstiges = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.SONSTIGES);

  assert.ok(persoenliches?.facts.some((f) => /2\s*Kinder/i.test(f.label)), '2 Kinder in Persönliches');
  assert.ok(persoenliches?.facts.some((f) => /^1\s*Hund$/i.test(f.label)), '1 Hund (nicht nur Hund) in Persönliches');
  assert.ok(persoenliches?.facts.some((f) => /braucht Auto sofort/i.test(f.label)),
    'braucht Auto sofort → Persönliches');
  assert.ok(!persoenliches?.facts.some((f) => /^Familie$/i.test(f.label)),
    'generisches Familie nicht zusätzlich zu 2 Kinder');
  assert.ok(persoenliches?.facts.some((f) => /Unfall/i.test(f.label)),
    'Unfall / Ersatzfahrzeug → Persönliches');
  assert.ok(!bestand, 'kein sichtbarer Bestand-Bucket');
  assert.ok(!sonstiges?.facts?.some((f) => /Kinder|Hund|Unfall|sofort/i.test(f.label)),
    'strukturierte Facts nicht unter Sonstiges');

  const persoTopic = (snap.soft.topics || []).find((t) => t.id === 'persoenlich');
  assert.match(persoTopic?.line || '', /2\s*Kinder/i, 'Expanded Themenzeile Persönlich: Kinder');
  assert.match(persoTopic?.line || '', /1\s*Hund/i, 'Expanded Themenzeile Persönlich: 1 Hund');
  assert.ok(
    (snap.soft.summary?.tokens || []).some((t) => /2\s*Kinder/i.test(t.label)),
    'Collapsed Summary: 2 Kinder',
  );
  assert.ok(
    (snap.soft.summary?.tokens || []).some((t) => /Hund/i.test(t.label)),
    'Collapsed Summary: Hund',
  );

  // Undo-Simulation: Insights entfernen → Kinder/Hund weg; Notizen aus kundenhelfer bleiben
  const undone = buildCustomerSnapshotModel({
    ...lead,
    crm: { ...lead.crm, sellerInsights: [] },
  });
  const persoenlichesUndone = undone.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.PERSOENLICHES);
  assert.ok(!persoenlichesUndone?.facts.some((f) => /Kinder|Hund/i.test(f.label)),
    'nach Undo keine Kinder/Hund-Chips');
  assert.ok(
    persoenlichesUndone?.facts.some((f) => /braucht Auto sofort/i.test(f.label))
    || persoenlichesUndone?.facts.some((f) => /Unfall/i.test(f.label)),
    'kundenhelfer-Notizen bleiben nach Insight-Undo',
  );
  console.log('✓ Remember sellerInsights → Persönliches (+ Undo)');
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
  assert.ok(!/Ford Focus/i.test(snap.soft.summary.line), 'GW nicht in Soft-Summary');
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
  assert.ok(equip, 'Ausstattung-Gruppe');
  assert.equal(equip.showEquipmentCta, false, 'kein per-Group Chip-Picker-CTA');
  assert.equal(equip.showAddCta, false, 'Erfassung über Composer/+ Wissen ergänzen');
  assert.equal(equip.title, 'Ausstattung');
  assert.ok(equip.facts.some((f) => f.label === 'Wärmepumpe'), 'confirmed equipment chip');
  assert.ok(!equip.facts.some((f) => f.label === 'GT-Line' && f.id.startsWith('equip:')),
    'Trim nicht als Ausstattungs-Chip');
  const persoenliches = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.PERSOENLICHES);
  assert.ok(!persoenliches?.facts.some((f) => f.label === 'Wärmepumpe'), 'Equipment nicht in Persönliches');
  const wichtig = (snap.soft.topics || []).find((t) => t.id === 'wichtig');
  assert.ok(wichtig?.facts?.some((f) => f.label === 'Wärmepumpe'), 'Panel-Thema Wichtig');
  console.log('✓ Ausstattung confirmed-only + Panel-Thema');
}

// --- Ausstattungswünsche-Picker → Ausstattung-Bucket (auch früher korrumpierte Labels) ---
{
  assert.equal(classifySnapshotNoteLabel('Klimaautomatik').slot, 'equipment');
  assert.equal(classifySnapshotNoteLabel('Leder').slot, 'equipment');
  assert.equal(classifySnapshotNoteLabel('Apple CarPlay').slot, 'equipment');
  assert.equal(classifySnapshotNoteLabel('Navigationssystem').slot, 'equipment');
  assert.equal(classifySnapshotNoteLabel('Ambientebeleuchtung').slot, 'equipment');

  // Wie saveKundenhelferSheet: neue Picker-Chips → sellerInsights
  let lead = appendSellerInsightsFromTexts(
    baseLead({
      crm: {
        ...baseLead().crm,
        needProfile: createEmptyNeedProfile(),
        sellerInsights: [],
      },
    }),
    ['Klimaautomatik', 'Leder', 'Apple CarPlay', 'Navigationssystem', 'Sitzheizung'],
  );

  // Legacy-Korruption: text bleibt Katalog, understoodLabels falsch (Automatik)
  lead = {
    ...lead,
    crm: {
      ...lead.crm,
      sellerInsights: [
        ...(lead.crm.sellerInsights ?? []),
        {
          id: 'si-legacy-klima',
          text: 'Memory-Sitze',
          understoodLabels: ['Automatik'],
          source: 'seller',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  };

  const snap = buildCustomerSnapshotModel(lead);
  const equip = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.AUSSTATTUNG_TECHNIK);
  const sonstiges = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.SONSTIGES);
  const praef = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ);
  const bestand = snap.soft.groups.find((g) => g.id === SOFT_SNAPSHOT_GROUP.BESTAND);

  for (const label of [
    'Klimaautomatik',
    'Leder',
    'Apple CarPlay',
    'Navigationssystem',
    'Sitzheizung',
    'Memory-Sitze',
  ]) {
    assert.ok(
      equip?.facts.some((f) => f.label === label),
      `Picker-Wunsch „${label}“ in Ausstattung`,
    );
    assert.ok(
      !sonstiges?.facts?.some((f) => f.label === label),
      `„${label}“ nicht unter Sonstiges`,
    );
  }
  assert.ok(
    !praef?.facts?.some((f) => /Memory-Sitze|Klimaautomatik/i.test(f.label)),
    'Picker-Equipment nicht in Fahrzeugwunsch',
  );
  assert.ok(!bestand, 'kein Bestand-Bucket für Equipment');
  console.log('✓ Ausstattungswünsche-Picker → Ausstattung-Bucket');
}

// --- Summary-Priorität: Persönliches · entscheidend · Präferenz · Ausstattung ---
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
  const idxMuss = tokens.findIndex((l) => /Totwinkel/i.test(l));
  assert.ok(idxKinder >= 0 && idxHund >= 0, 'Persönliches in Summary');
  assert.equal(idxGw, -1, 'Bestand nicht in Summary');
  if (idxMuss >= 0) {
    assert.ok(idxKinder < idxMuss || idxHund < idxMuss, 'Persönliches vor Ausstattung');
  }
  console.log('✓ Summary priority persönliches first');
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
  // Deal-Konditionen (Laufzeit/km/AZ) aus Wish/Offer im Kern sichtbar
  assert.ok(snap.kernChips.some((c) => c.id === 'termMonths' && /36/.test(c.label) && !c.empty),
    'Laufzeit im Konditionen-Strip');
  assert.ok(snap.kernChips.some((c) => c.id === 'mileagePerYear' && /15\.000/.test(c.label) && !c.empty),
    'km/Jahr im Konditionen-Strip');
  assert.ok(snap.kernChips.some((c) => c.id === 'downPayment' && /6\.000/.test(c.label) && !c.empty),
    'Anzahlung im Konditionen-Strip');
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
  assert.ok(snapWish.kernChips.some((c) => c.id === 'paymentType' && /Leasing/i.test(c.label)));
  assert.ok(!snapWish.softChips.some((c) => c.id === 'termMonths'));

  // Leerer Wish + aktiver Offer-Kontext → Kern aus Offer
  const emptyWishLead = {
    id: 'lead-offer-fill',
    name: 'Leer',
    wish: {},
    crm: { needProfile: createEmptyNeedProfile(), vehicleConfigurations: [] },
  };
  const snapOfferFill = buildCustomerSnapshotModel(emptyWishLead, { workingContextItems: working });
  assert.ok(snapOfferFill.kernChips.some((c) => c.id === 'termMonths' && /36/.test(c.label) && !c.empty),
    'leerer Wish: Laufzeit aus Offer');
  assert.ok(snapOfferFill.kernChips.some((c) => c.id === 'downPayment' && /6\.000/.test(c.label) && !c.empty),
    'leerer Wish: AZ aus Offer');
  console.log('✓ Offer deal conditions fill Konditionen; rates stay filtered');
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
  assert.equal(softById.existingVehicle, undefined, 'GW nicht im Kundenwissen');
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
  assert.equal(bestand, undefined, 'GW-Tint nicht in Kundenwissen');
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
  assert.equal(kern.title, 'Konditionen');
  assert.match(kern.line, /Monate|km/i);
  assert.match(kern.line, /Finanzierung|Leasing|Bar/i);
  console.log('✓ buildKernKonditionen');
}

// --- Konditionen: leere Slots ausgegraut, editierbar ---
{
  const emptyLead = {
    id: 'lead-empty-kern',
    name: 'Garritano',
    wish: { paymentType: 'leasing' },
    crm: { needProfile: createEmptyNeedProfile() },
  };
  const kern = buildKernKonditionen(emptyLead, createEmptyNeedProfile());
  assert.equal(kern.title, 'Konditionen');
  assert.equal(kern.hasData, true);
  assert.ok(kern.chips.some((c) => c.id === 'termMonths' && c.empty && c.label === 'Laufzeit'));
  assert.ok(kern.chips.some((c) => c.id === 'mileagePerYear' && c.empty && c.label === 'km/Jahr'));
  assert.ok(kern.chips.some((c) => c.id === 'downPayment' && c.empty));
  assert.ok(kern.chips.some((c) => c.id === 'leasingEndDate' && c.empty));
  assert.ok(kern.chips.some((c) => c.id === 'paymentType' && !c.empty && c.label === 'Leasing'));
  assert.ok(kern.chips.every((c) => c.miniEditor || c.editKey));
  console.log('✓ Konditionen empty slots');
}

// --- Konditionen auch bei Bar immer sichtbar ---
{
  const cashLead = {
    id: 'lead-cash-kern',
    wish: { paymentType: 'cash' },
    crm: { needProfile: createEmptyNeedProfile() },
  };
  const kern = buildKernKonditionen(cashLead, createEmptyNeedProfile());
  assert.equal(kern.hasData, true);
  assert.ok(kern.chips.some((c) => c.id === 'termMonths'));
  assert.ok(kern.chips.some((c) => c.id === 'mileagePerYear'));
  assert.ok(kern.chips.some((c) => c.id === 'downPayment'));
  assert.ok(kern.chips.some((c) => c.id === 'paymentType' && c.label === 'Bar'));
  assert.ok(!kern.chips.some((c) => c.id === 'leasingEndDate'), 'Bar: kein leeres Vertragsende');
  console.log('✓ Konditionen cash always visible');
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
  assert.equal(short.overflow, 1);
  assert.equal(short.line, 'A');
  assert.ok(!/\+\d+/.test(short.line), 'kein +N in Summary-Zeile (Rest über Alles anzeigen)');

  // Fallback-Pfad: flat chips ohne summary.tokens (wie UI resolveCollapsedSummaryTokens)
  const fromChips = buildSnapshotSummary([
    { id: 'c1', label: '2 Kinder', empty: false, summaryPriority: 10 },
    { id: 'c2', label: 'Hund', empty: false, summaryPriority: 11 },
    { id: 'c3', label: 'Sitzheizung', empty: false, summaryPriority: 40 },
    { id: 'c4', label: '', empty: false },
    { id: 'c5', label: 'Telefon fehlt', empty: false },
  ], 3);
  assert.equal(fromChips.tokens.length, 3);
  assert.deepEqual(fromChips.tokens.map((t) => t.label), ['2 Kinder', 'Hund', 'Sitzheizung']);
  assert.equal(fromChips.overflow, 0);
  console.log('✓ Summary helper');
}

// --- flattenSnapshotChips ---
{
  const flat = flattenSnapshotChips([
    { id: SOFT_SNAPSHOT_GROUP.PERSOENLICHES, title: 'X', facts: [{ id: 'c', label: 'Kinder', tint: 'alltag' }] },
  ]);
  assert.equal(flat[0].groupId, SOFT_SNAPSHOT_GROUP.PERSOENLICHES);
  console.log('✓ flattenSnapshotChips');
}

// --- Knowledge source normalize + equipment label strip ---
{
  assert.equal(normalizeKnowledgeChipSource('landing'), 'customer');
  assert.equal(normalizeKnowledgeChipSource('portal'), 'customer');
  assert.equal(normalizeKnowledgeChipSource('customerAdvisor'), 'customer');
  assert.equal(normalizeKnowledgeChipSource('seller'), 'seller');
  assert.equal(normalizeKnowledgeChipSource('document'), 'document');
  assert.equal(normalizeKnowledgeChipSource('clever'), 'clever');
  assert.equal(normalizeKnowledgeChipSource('openai_interpretation'), 'clever');
  assert.equal(normalizeKnowledgeChipSource('wish'), 'seller', 'wish/kern → seller-neutral');
  assert.equal(resolveCustomerSourceChannelLabel({ source: 'landing' }), 'Landingpage');

  const withPrio = formatEquipmentWishLabel('Sitzheizung', EQUIPMENT_WISH_PRIORITY.PREFERRED, {
    explicitPreferred: true,
  });
  assert.match(withPrio, /·\s*wunsch/i, 'internes Label behält Priorität');
  assert.equal(stripEquipmentPrioritySuffix(withPrio), 'Sitzheizung', 'UI strippt Suffix');
  assert.equal(
    stripEquipmentPrioritySuffix(formatEquipmentWishLabel('Kofferraum', EQUIPMENT_WISH_PRIORITY.IMPORTANT)),
    'Kofferraum',
  );

  const customerTitle = buildKnowledgeChipProvenanceTitle({
    source: 'customer',
    sourceChannel: 'Landingpage',
    createdAt: '2026-05-28T12:00:00.000Z',
  });
  assert.match(customerTitle || '', /Vom Kunden angegeben · \d{2}\.\d{2}\.\d{4}/);
  assert.ok(!/Landingpage/.test(customerTitle || ''), 'Kanal nicht in Hover-Zeile');

  assert.equal(isDecisionSoftFactLabel('entscheidet mit Partner'), true);
  assert.equal(isDecisionSoftFactLabel('2 Kinder'), false);
  const panelTopics = buildSoftPanelTopics([
    {
      id: SOFT_SNAPSHOT_GROUP.PERSOENLICHES,
      facts: [
        { id: 'c', label: '2 Kinder' },
        { id: 'd', label: 'entscheidet mit Partner' },
      ],
    },
    {
      id: SOFT_SNAPSHOT_GROUP.FAHRZEUGPRAEFERENZ,
      facts: [{ id: 'e', label: 'Elektro' }],
    },
  ]);
  assert.deepEqual(panelTopics.map((t) => t.id), ['persoenlich', 'entscheidung', 'fahrzeugwunsch']);
  assert.match(panelTopics.find((t) => t.id === 'persoenlich')?.line || '', /2 Kinder/);
  assert.match(panelTopics.find((t) => t.id === 'entscheidung')?.line || '', /Partner/);

  const lead = baseLead({
    source: 'landing',
    crm: {
      ...baseLead().crm,
      needProfile: mergeTextIntoNeedProfile('2 Kinder Hund', createEmptyNeedProfile()),
      sellerInsights: [],
    },
  });
  let withSeller = appendSellerInsightToLead(lead, 'Totwinkelassistent · muss', {
    sellerName: 'Max Verkäufer',
  });
  const snap = buildCustomerSnapshotModel(withSeller);
  const dog = snap.softChips.find((f) => f.id === 'dog');
  const children = snap.softChips.find((f) => f.id === 'children');
  const equip = snap.softChips.find((f) => /Totwinkel/i.test(f.label));
  assert.equal(dog?.source, 'customer');
  assert.equal(dog?.confirmed, true);
  assert.equal(children?.source, 'customer');
  assert.equal(equip?.source, 'seller');
  assert.equal(equip?.confirmed, true);
  assert.equal(equip?.priority, EQUIPMENT_WISH_PRIORITY.REQUIRED);
  assert.match(equip?.label || '', /·\s*muss/i, 'internes Fact-Label darf Suffix tragen');
  assert.equal(stripEquipmentPrioritySuffix(equip.label), 'Totwinkelassistent');

  let withClever = appendSellerInsightToLead(lead, 'Anhängerkupplung wichtig', {
    source: 'clever',
  });
  const snapClever = buildCustomerSnapshotModel(withClever);
  const ahk = snapClever.softChips.find((f) => /Anhänger|AHK/i.test(f.label || ''));
  assert.ok(ahk, 'Clever-Insight landet als Soft-Chip');
  assert.equal(ahk?.source, 'clever');
  assert.equal(ahk?.confirmed, false, 'Clever-Vermutung unconfirmed');
  assert.match(
    buildKnowledgeChipProvenanceTitle(ahk) || '',
    /Von Clever erkannt · noch nicht bestätigt/,
  );
  assert.match(
    buildKnowledgeChipProvenanceTitle({
      source: 'clever',
      confirmed: true,
      createdAt: '2026-05-28T12:00:00.000Z',
    }) || '',
    /Von Clever aus Gespräch erkannt · \d{2}\.\d{2}\.\d{4}/,
  );
  console.log('✓ Knowledge source + equipment strip + provenance');
}

console.log('\nbuildCustomerSnapshotModel.test.js: OK');
