/**
 * node src/services/consultation/notepadChipBundling.test.js
 */
import assert from 'node:assert/strict';
import { buildBundledNotepadItems, classifyNotepadLabel } from './notepadChipBundling.js';
import { labelsFromEquipmentIds } from './wishHandoffEquipment.js';
import { buildWishHandoffNotepadLabels, mergeWishHandoffNotepadLabels } from './wishHandoffEnrichment.js';

{
  assert.equal(classifyNotepadLabel('SUV'), 'wish');
  assert.equal(classifyNotepadLabel('Parksensoren vorne'), 'equipment');
  assert.equal(classifyNotepadLabel('Leasing'), 'payment');
  assert.equal(classifyNotepadLabel('Sobald wie möglich'), 'timing');
  console.log('✓ Label-Klassifikation');
}

{
  const labels = ['SUV', 'Familie', '7 Sitze', 'Parksensoren vorne', 'Anhängerkupplung', 'Elektrische Heckklappe', 'Notrufassistent'];
  const items = buildBundledNotepadItems(labels);
  assert.ok(items.some((i) => i.type === 'chip' && i.label === 'SUV'));
  const bundle = items.find((i) => i.id === 'bundle:equipment');
  assert.ok(bundle);
  assert.equal(bundle.count, 4);
  assert.equal(bundle.icon, '💺');
  console.log('✓ Ausstattung wird gebündelt');
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
  console.log('✓ Equipment → Notizzettel');
}

{
  assert.deepEqual(
    labelsFromEquipmentIds(['frontParkingSensors', 'eCall']),
    ['Parksensoren vorne', 'Notrufassistent'],
  );
  console.log('✓ Equipment Labels');
}

console.log('\nnotepadChipBundling.test.js: ok');
