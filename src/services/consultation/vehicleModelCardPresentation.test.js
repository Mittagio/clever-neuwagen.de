/**
 * node src/services/consultation/vehicleModelCardPresentation.test.js
 */
import assert from 'node:assert/strict';
import {
  buildVehicleModelCard,
  buildVehicleModelCardsFromAiDirections,
  shouldEmphasizeTowing,
} from './vehicleModelCardPresentation.js';

{
  assert.equal(shouldEmphasizeTowing({ towCapacityKg: 1500 }), true);
  assert.equal(shouldEmphasizeTowing({}, 'Hybrid mit 1.500 kg Anhängelast'), true);
  assert.equal(shouldEmphasizeTowing({ fuel: 'hybrid' }, 'Ich suche Hybrid'), false);
  console.log('✓ Towing-Kontext erkennen');
}

{
  const card = buildVehicleModelCard('sportage', {
    needProfile: { towCapacityKg: 1500, fuel: 'hybrid' },
    customerText: 'Hybrid mit 1.500 kg Anhängelast',
  });
  assert.ok(card);
  assert.equal(card.name, 'Sportage');
  assert.ok(card.contextAnswer?.label === 'Anhängelast');
  assert.ok(card.contextAnswer?.value);
  assert.ok(card.uvpLabel == null || /UVP ab/.test(card.uvpLabel));
  // PS nur wenn verifiziert – darf null sein, dann UI zeigt „–“
  console.log('✓ Sportage-Kachel mit Anhängelast + UVP-Feld');
}

{
  const cards = buildVehicleModelCardsFromAiDirections([
    { modelKey: 'sportage', status: 'candidate', reason: 'hohe Anhängelast' },
    { modelKey: 'sorento', status: 'candidate' },
    { modelKey: 'seltos', status: 'candidate' },
    { modelKey: 'ev6', status: 'candidate' },
    { modelKey: 'niro', status: 'candidate' },
  ], { needProfile: { towCapacityKg: 1500 } });

  assert.equal(cards.length, 4);
  assert.ok(cards.every((c) => c.modelKey && c.name));
  assert.ok(cards.some((c) => c.contextAnswer?.value));
  // Keine verwaiste kg-Liste – jeder Wert hängt am Modell
  for (const card of cards) {
    if (card.contextAnswer) {
      assert.match(card.contextAnswer.value, /kg/i);
    }
  }
  console.log('✓ Bis 4 Kacheln, Anhängelast modellbezogen');
}

{
  const card = buildVehicleModelCard('sorento', {
    needProfile: { towCapacityKg: 1500 },
  });
  assert.ok(card.contextAnswer?.value?.includes('2.500') || card.contextAnswer?.value?.includes('2500'));
  assert.equal(card.isElectric, false);
  assert.equal(card.rangeLabel, null);
  console.log('✓ Sorento Anhängelast klar am Modell');
}

{
  const card = buildVehicleModelCard('ev9', {
    needProfile: { bodyType: 'suv' },
    notepadLabels: ['SUV', '7 Sitze', 'Familie'],
  });
  assert.equal(card.isElectric, true);
  assert.ok(card.rangeLabel, 'Elektro-Kachel braucht Reichweite');
  assert.match(card.rangeLabel, /km WLTP/i);
  assert.ok(card.uvpLabel, 'EV9 UVP muss da sein');
  assert.ok(card.powerLabel, 'EV9 PS muss da sein');
  assert.ok(card.matchChips?.includes('7 Sitze'));
  assert.ok(card.matchChips?.includes('SUV'));
  console.log('✓ EV9 Reichweite + UVP/PS + Match-Chips');
}

{
  const card = buildVehicleModelCard('sorento', {
    notepadLabels: ['SUV', '7 Sitze'],
  });
  assert.ok(card.uvpLabel);
  assert.ok(card.powerLabel, 'Sorento PS aus Preisliste');
  assert.ok(card.matchChips?.includes('7 Sitze'));
  console.log('✓ Sorento UVP/PS + 7-Sitze-Chip');
}

{
  const card = buildVehicleModelCard('ev2', {});
  assert.equal(card.isElectric, true);
  assert.ok(card.rangeLabel);
  assert.match(card.rangeLabel, /km WLTP/i);
  console.log('✓ EV2 Reichweite auf Elektro-Kachel');
}

console.log('\nvehicleModelCardPresentation.test.js: ok');
