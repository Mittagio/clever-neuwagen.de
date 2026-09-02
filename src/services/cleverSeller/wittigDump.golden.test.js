/**
 * Wittig-Dump: AZ ≠ Wunschrate, DE-Adresse strukturiert.
 * node --test src/services/cleverSeller/wittigDump.golden.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { parseCustomerAddressFromText } from '../dealerAiParser.js';
import {
  applyStructuredFactsToLead,
} from './applyAcceptedSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';

const WITTIG_DUMP = [
  'EV2 Earth',
  '48 12.500 km',
  '5000 €',
  '',
  'Matthias Wittig',
  'Hauptstraße 12-3',
  '73614 Schorndorf',
  'm.wittig@wittig.de',
].join('\n');

{
  const parsed = parseCustomerAddressFromText(WITTIG_DUMP);
  assert.ok(parsed, 'Adresse erkannt');
  assert.equal(parsed.street, 'Hauptstraße');
  assert.equal(parsed.houseNumber, '12-3');
  assert.equal(parsed.postalCode, '73614');
  assert.equal(parsed.city, 'Schorndorf');
}

{
  const interpreted = interpretSellerInput(WITTIG_DUMP);
  const fields = new Set(interpreted.facts.map((f) => f.field));

  assert.ok(fields.has('downPayment'), '5000 € → downPayment');
  const down = interpreted.facts.find((f) => f.field === 'downPayment');
  assert.equal(Number(down.value), 5000);
  assert.ok(
    !interpreted.facts.some((f) => (
      (f.field === 'monthlyBudget' || f.field === 'desiredRate')
      && Number(f.value) === 5000
    )),
    '5000 € NICHT als desiredRate/monthlyBudget',
  );

  assert.ok(fields.has('street'), 'street');
  assert.ok(fields.has('postalCode') || fields.has('city'), 'PLZ/Ort');
  const street = interpreted.facts.find((f) => f.field === 'street');
  assert.match(String(street.label || ''), /Hauptstraße/i);
  assert.match(String(street.label || street.value?.houseNumber || ''), /12-3/);
  const postal = interpreted.facts.find((f) => f.field === 'postalCode');
  assert.equal(String(postal?.value || ''), '73614');
  const city = interpreted.facts.find((f) => f.field === 'city');
  assert.match(String(city?.value?.city || city?.label || ''), /Schorndorf/i);

  assert.ok(
    !interpreted.facts.some((f) => (
      f.field === 'unresolvedNote'
      && /Hauptstraße|73614|Schorndorf/i.test(String(f.label || f.value?.text || ''))
    )),
    'klare Adresse nicht nur als Notiz',
  );

  const lead = {
    id: 'lead-wittig',
    name: 'Neuer Kunde',
    contact: { name: 'Neuer Kunde' },
    wish: {},
    crm: { needProfile: createEmptyNeedProfile() },
  };
  const applied = applyStructuredFactsToLead(lead, interpreted.facts);
  assert.equal(Number(applied.wish?.downPayment), 5000, 'AZ Apply');
  assert.notEqual(Number(applied.desiredRate ?? applied.wish?.desiredRate), 5000);
  assert.match(String(applied.contact?.street || applied.crm?.customerAddress?.street || ''), /Hauptstraße/i);
  assert.equal(
    String(applied.contact?.postalCode || applied.contact?.zip || applied.crm?.customerAddress?.postalCode || ''),
    '73614',
  );
  assert.match(
    String(applied.contact?.city || applied.crm?.customerAddress?.city || ''),
    /Schorndorf/i,
  );
  console.log('✓ Wittig: AZ 5000 + Adresse strukturiert');
}
