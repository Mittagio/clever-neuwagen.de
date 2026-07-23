/**
 * node src/services/consultation/notepadChipBundling.test.js
 */
import assert from 'node:assert/strict';
import {
  buildBundledNotepadItems,
  buildStructuredNotepadSummary,
  classifyNotepadLabel,
  corePriority,
  findBundleForLabel,
} from './notepadChipBundling.js';
import { labelsFromEquipmentIds } from './wishHandoffEquipment.js';
import { buildWishHandoffNotepadLabels, mergeWishHandoffNotepadLabels } from './wishHandoffEnrichment.js';
import { applyInterestedDirectionToNotepad } from './progressiveVehicleDirections.js';

{
  assert.equal(classifyNotepadLabel('SUV'), 'core');
  assert.equal(classifyNotepadLabel('Elektro'), 'core');
  assert.equal(classifyNotepadLabel('7 Sitze'), 'core');
  assert.equal(classifyNotepadLabel('EV9 interessant'), 'core');
  assert.equal(classifyNotepadLabel('mindestens 1.500 kg Anhängelast'), 'core');
  assert.equal(classifyNotepadLabel('Parksensoren vorne'), 'equipment');
  assert.equal(classifyNotepadLabel('Head-up-Display'), 'equipment');
  assert.equal(classifyNotepadLabel('Leasing'), 'payment');
  assert.equal(classifyNotepadLabel('Budget bis 350 €/Monat'), 'payment');
  assert.equal(classifyNotepadLabel('48 Monate'), 'payment');
  assert.equal(classifyNotepadLabel('15.000 km'), 'payment');
  assert.equal(classifyNotepadLabel('Sobald wie möglich'), 'timing');
  assert.ok(corePriority('EV9 interessant') > corePriority('Familie'));
  console.log('✓ Label-Klassifikation + Kernpriorität');
}

{
  const labels = [
    'Elektro',
    'SUV',
    '7 Sitze',
    'mindestens 1.500 kg Anhängelast',
    'Leasing',
    'Budget bis 350 €/Monat',
    '48 Monate',
    '15.000 km',
    'Head-up-Display',
    'Sitzheizung',
  ];
  const items = buildBundledNotepadItems(labels);

  const chipLabels = items.filter((i) => i.type === 'chip').map((i) => i.label);
  assert.ok(chipLabels.includes('Elektro'));
  assert.ok(chipLabels.includes('SUV'));
  assert.ok(chipLabels.includes('7 Sitze'));
  assert.ok(chipLabels.includes('mindestens 1.500 kg Anhängelast'));

  // Keine dauerhafte Doppelung: Konditions-Kinder nicht als Einzelchips
  assert.ok(!chipLabels.includes('Leasing'));
  assert.ok(!chipLabels.includes('48 Monate'));
  assert.ok(!chipLabels.includes('Head-up-Display'));

  const payment = items.find((i) => i.id === 'bundle:payment');
  assert.ok(payment);
  assert.equal(payment.count, 4);
  assert.equal(payment.title, 'Konditionen');
  assert.equal(payment.icon, '💶');
  assert.deepEqual(payment.labels, [
    'Leasing',
    'Budget bis 350 €/Monat',
    '48 Monate',
    '15.000 km',
  ]);

  const wishes = items.find((i) => i.id === 'bundle:wishes');
  assert.ok(wishes);
  assert.equal(wishes.count, 2);
  assert.equal(wishes.title, 'Wünsche');
  assert.equal(wishes.icon, '✨');
  console.log('✓ Kernchips + Konditionen/Wünsche ohne Doppelung');
}

{
  const labels = ['Leasing', 'Budget bis 350 €/Monat'];
  const items = buildBundledNotepadItems(labels);
  const payment = items.find((i) => i.id === 'bundle:payment');
  assert.ok(payment);
  assert.equal(payment.count, 2);
  assert.equal(items.filter((i) => i.type === 'chip').length, 0);
  assert.ok(payment.labels.includes('Leasing'));
  assert.ok(payment.labels.includes('Budget bis 350 €/Monat'));
  console.log('✓ Zwei Konditionen → geschlossene Gruppe Count 2');
}

{
  const before = buildBundledNotepadItems(['Leasing', '48 Monate']);
  assert.equal(before.find((i) => i.id === 'bundle:payment').count, 2);

  const after = buildBundledNotepadItems(['Leasing', '48 Monate', '15.000 km']);
  assert.equal(after.find((i) => i.id === 'bundle:payment').count, 3);

  const withWish = buildBundledNotepadItems([
    'Leasing', '48 Monate', '15.000 km', 'Sitzheizung', 'Head-up-Display',
  ]);
  assert.equal(withWish.find((i) => i.id === 'bundle:wishes').count, 2);
  console.log('✓ Count steigt bei neuen Konditionen/Wünschen');
}

{
  const items = buildBundledNotepadItems(['Leasing', '48 Monate', 'Sitzheizung', 'HUD']);
  // HUD may not match equipment set - Head-up-Display does
  const items2 = buildBundledNotepadItems(['Leasing', '48 Monate', 'Sitzheizung', 'Head-up-Display']);
  const removed = buildBundledNotepadItems(['Leasing', '48 Monate', 'Sitzheizung']);
  assert.equal(items2.find((i) => i.id === 'bundle:wishes').count, 2);
  assert.equal(removed.find((i) => i.id === 'bundle:wishes'), undefined);
  assert.ok(removed.some((i) => i.type === 'chip' && i.label === 'Sitzheizung'));
  console.log('✓ Entfernen reduziert Wünsche-Count');
}

{
  const labels = ['Leasing', '48 Monate'];
  const items = buildBundledNotepadItems(labels);
  assert.equal(findBundleForLabel('48 Monate', items)?.id, 'bundle:payment');
  assert.equal(findBundleForLabel('SUV', items), null);
  console.log('✓ Magic-Einsortierung in Konditionen-Gruppe');
}

{
  const summary = buildStructuredNotepadSummary([
    'Elektro',
    'SUV',
    '7 Sitze',
    'mindestens 1.500 kg Anhängelast',
    'Leasing',
    '15.000 km',
    '48 Monate',
    '0 € Sonderzahlung',
    'Head-up-Display',
    'Sitzheizung',
  ]);
  assert.ok(summary.vehicle.includes('Elektro'));
  assert.ok(summary.vehicle.includes('mindestens 1.500 kg Anhängelast'));
  assert.ok(summary.conditions.includes('Leasing'));
  assert.ok(summary.wishes.includes('Head-up-Display'));
  console.log('✓ Wunschübergabe-Zusammenfassung strukturiert');
}

{
  const labels = [
    'SUV', 'Familie', '7 Sitze',
    'Parksensoren vorne', 'Anhängerkupplung', 'Elektrische Heckklappe', 'Notrufassistent',
  ];
  const items = buildBundledNotepadItems(labels);
  assert.ok(items.some((i) => i.type === 'chip' && i.label === 'SUV'));
  const bundle = items.find((i) => i.id === 'bundle:wishes');
  assert.ok(bundle);
  assert.ok(bundle.count >= 4);
  assert.equal(bundle.icon, '✨');
  console.log('✓ Ausstattung wird als Wünsche gebündelt');
}

{
  const labels = buildWishHandoffNotepadLabels({
    vehicleNeedTiming: 'asap',
    acquisitionType: 'leasing',
    equipmentWishIds: ['frontParkingSensors', 'towbar', 'powerTailgate', 'eCall'],
    leasing: { termId: 'term_48', mileageId: 'km_10000' },
    finance: {},
  });
  assert.ok(labels.includes('48 Monate'));
  assert.ok(labels.includes('Parksensoren vorne'));
  assert.ok(labels.includes('Notrufassistent'));

  const merged = mergeWishHandoffNotepadLabels(['SUV', 'Familie'], {
    vehicleNeedTiming: 'asap',
    acquisitionType: 'leasing',
    equipmentWishIds: ['towbar'],
    leasing: {},
    finance: {},
  });
  assert.ok(merged.includes('SUV'));
  assert.ok(merged.includes('Anhängerkupplung'));
  console.log('✓ Equipment → Notizzettel (Wahrheit unverändert)');
}

{
  assert.deepEqual(
    labelsFromEquipmentIds(['frontParkingSensors', 'eCall']),
    ['Parksensoren vorne', 'Notrufassistent'],
  );
  console.log('✓ Equipment Labels');
}

{
  // Interessant → Modellinteresse; Mehr erfahren → kein Wunsch
  let session = {
    notepadLabels: ['Elektro'],
    needProfile: { fuel: 'electric' },
    vehicleDirectionReactions: {},
    vehicleDirectionsView: { directions: [{ modelKey: 'ev3', label: 'EV3' }], reactions: {} },
    turns: [],
    phase: 'conversation',
  };

  const interested = applyInterestedDirectionToNotepad(session, 'ev3', 'interested');
  assert.ok(interested.notepadLabels.some((l) => /EV3.*interessant/i.test(l)));

  const explore = applyInterestedDirectionToNotepad(session, 'ev3', 'explore');
  assert.deepEqual(explore.notepadLabels, ['Elektro']);
  console.log('✓ Interessant notiert, Mehr erfahren nicht');
}

console.log('\nnotepadChipBundling.test.js: ok');
