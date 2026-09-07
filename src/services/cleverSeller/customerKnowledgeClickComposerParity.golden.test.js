/**
 * Click / Composer Parity – Kundenwissen Golden A–E
 *
 * node --test src/services/cleverSeller/customerKnowledgeClickComposerParity.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile, getNeedProfileFromLead } from '../consultation/needProfileService.js';
import {
  applyCustomerKnowledgeChange,
  CUSTOMER_KNOWLEDGE_KIND,
} from './applyCustomerKnowledgeChange.js';
import { applyStructuredFactsToLead } from './applyAcceptedSellerTurn.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE } from './sellerFactTypes.js';
import { buildCustomerSnapshotModel } from '../dealer/buildCustomerSnapshotModel.js';

function baseLead(profileOverrides = {}) {
  return {
    id: 'lead-knowledge-parity',
    name: 'Parity Kunde',
    contact: { name: 'Parity Kunde' },
    crm: {
      needProfile: {
        ...createEmptyNeedProfile(),
        ...profileOverrides,
      },
      vehicleConfigurations: [],
      sellerInsights: [],
    },
  };
}

function childrenLabel(lead) {
  const snap = buildCustomerSnapshotModel(lead);
  const chips = (snap.soft?.groups || []).flatMap((g) => g.facts || []);
  return chips.find((c) => c.id === 'children' || /^children/.test(c.id))?.label || null;
}

function colorLabels(lead) {
  const snap = buildCustomerSnapshotModel(lead);
  const chips = (snap.soft?.groups || []).flatMap((g) => g.facts || []);
  return chips
    .filter((c) => String(c.id || '').startsWith('color:') || c.relevanceKey === 'preferredColor')
    .map((c) => c.label);
}

function equipmentLabels(lead) {
  const profile = getNeedProfileFromLead(lead) || {};
  return (profile.equipmentWishes || []).map((w) => String(w));
}

{
  // A) Kinder: Click 2→3, Composer zurück auf 2
  let lead = baseLead({
    children: 2,
    household: { childrenCount: 2 },
  });
  assert.match(String(childrenLabel(lead) || ''), /2\s*Kinder/i);

  const click = applyCustomerKnowledgeChange(lead, {
    kind: CUSTOMER_KNOWLEDGE_KIND.CHILDREN,
    draft: { children: 3 },
  });
  lead = click.lead;
  const profileAfterClick = getNeedProfileFromLead(lead);
  assert.equal(profileAfterClick.children, 3);
  assert.equal(profileAfterClick.household?.childrenCount, 3);
  assert.match(String(childrenLabel(lead) || ''), /3\s*Kinder/i);

  const viaComposer = applyStructuredFactsToLead(lead, [
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'childrenCount',
      value: 2,
      label: '2 Kinder',
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
    }),
  ]);
  lead = viaComposer;
  assert.equal(getNeedProfileFromLead(lead).children, 2);
  assert.equal(getNeedProfileFromLead(lead).household?.childrenCount, 2);
  console.log('✓ Golden A – Kinder Click/Composer');
}

{
  // B) Farbe: Click Schwarz→Weiß, Composer zurück Schwarz
  let lead = baseLead({ colorPreference: 'schwarz' });
  let colors = colorLabels(lead);
  assert.ok(colors.some((c) => /schwarz/i.test(c)));

  lead = applyCustomerKnowledgeChange(lead, {
    kind: CUSTOMER_KNOWLEDGE_KIND.COLOR,
    draft: { preferredColor: 'Weiß' },
  }).lead;
  assert.match(String(getNeedProfileFromLead(lead).colorPreference || ''), /wei[sß]/i);
  colors = colorLabels(lead);
  assert.equal(colors.filter((c) => /schwarz/i.test(c)).length, 0);
  assert.ok(colors.some((c) => /wei[sß]/i.test(c)));

  lead = applyStructuredFactsToLead(lead, [
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'colorPreference',
      value: { color: 'Schwarz' },
      label: 'Schwarz',
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
    }),
  ]);
  assert.match(String(getNeedProfileFromLead(lead).colorPreference || ''), /schwarz/i);
  console.log('✓ Golden B – Farbe Click/Composer');
}

{
  // C) Ausstattung remove + Composer wieder rein
  let lead = baseLead({
    equipmentWishes: ['elektrische Heckklappe'],
  });
  assert.ok(equipmentLabels(lead).some((l) => /heckklappe/i.test(l)));

  lead = applyCustomerKnowledgeChange(lead, {
    kind: CUSTOMER_KNOWLEDGE_KIND.EQUIPMENT,
    draft: { equipmentLabel: 'elektrische Heckklappe', remove: true, status: 'remove' },
  }).lead;
  assert.equal(equipmentLabels(lead).filter((l) => /heckklappe/i.test(l)).length, 0);

  lead = applyStructuredFactsToLead(lead, [
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'equipmentWish',
      value: { id: 'elektrische Heckklappe', label: 'elektrische Heckklappe' },
      label: 'elektrische Heckklappe',
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
    }),
  ]);
  assert.ok(equipmentLabels(lead).some((l) => /heckklappe/i.test(l)));
  console.log('✓ Golden C – Ausstattung remove/restore');
}

{
  // D) Modell Preference EV2→EV3, kein Offer-Draft
  let lead = baseLead({ selectedModelKey: 'ev2', modelHint: 'ev2', fuel: 'electric' });
  assert.equal(lead.crm?.cleverWorkingState?.offerDrafts, undefined);

  lead = applyCustomerKnowledgeChange(lead, {
    kind: CUSTOMER_KNOWLEDGE_KIND.MODEL,
    draft: { modelKey: 'ev3', modelLabel: 'EV3' },
  }).lead;
  const profile = getNeedProfileFromLead(lead);
  assert.equal(profile.selectedModelKey, 'ev3');
  assert.equal(lead.crm?.cleverWorkingState?.offerDrafts, undefined);
  console.log('✓ Golden D – Modell Preference ohne Offer-Mutation');
}

{
  // E) Parity: gleicher Endstate für Fuel via Click vs Facts
  const start = baseLead({ fuel: 'electric' });
  const viaClick = applyCustomerKnowledgeChange(start, {
    kind: CUSTOMER_KNOWLEDGE_KIND.FUEL,
    draft: { fuel: 'hybrid', fuelLabel: 'Hybrid' },
  }).lead;
  const viaFacts = applyStructuredFactsToLead(start, [
    createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'fuelPreference',
      value: 'hybrid',
      label: 'Hybrid',
      source: SELLER_FACT_SOURCE.MANUAL_EDIT,
    }),
  ]);
  assert.equal(getNeedProfileFromLead(viaClick).fuel, getNeedProfileFromLead(viaFacts).fuel);
  assert.equal(getNeedProfileFromLead(viaClick).fuel, 'hybrid');
  console.log('✓ Golden E – Fuel Click/Composer Parity');
}

console.log('customerKnowledgeClickComposerParity.golden.test.js: ok');
