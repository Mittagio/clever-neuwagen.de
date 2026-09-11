/**
 * Di Frisco Real-World – Flotten-Leasing PV5 + EV9 (Mengen + Gesamtlaufleistung) · FREEZE
 * Muster: Firmenflotte, Stückzahlen, Gesamtkm → Jahres-km, kein Fake-Draft-Matrix
 * node src/services/cleverSeller/diFriscoFleetLeasing.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { getCleverWorkingState, resolveActiveOfferDraft } from './cleverWorkingDraft.js';

const BODY = `Sehr geehrte Damen und Herren,

wir sind auf der Suche nach einem zuverlässigen Autohaus im Raum Stuttgart und bitten Sie um die Erstellung eines Angebots für folgende Leasingfahrzeuge:

- 1 × Kia PV5 Passenger (5-Sitzer) mit großer Batterie
- 3 × Kia EV9

Für die Kia EV9 benötigen wir folgende Leasingkonditionen:

- 2 Fahrzeuge mit einer Laufzeit von 48 Monaten und 80.000 km Gesamtlaufleistung.
- 1 Fahrzeug mit einer Laufzeit von 48 Monaten und 100.000 km Gesamtlaufleistung.

Wir sind ein bundesweit tätiges Unternehmen der Gebäudedienstleistungsbranche mit über 850 Mitarbeitenden und einem Fuhrpark von derzeit 85 Fahrzeugen. Da wir unseren Fahrzeugbestand kontinuierlich erweitern, sind wir an einer langfristigen Zusammenarbeit interessiert.

Wir würden uns freuen, wenn Sie uns ein attraktives Leasingangebot unter Berücksichtigung unserer Unternehmensgröße erstellen könnten. Bitte teilen Sie uns auch die voraussichtlichen Lieferzeiten sowie mögliche Flottenkonditionen mit.

Für Ihre Mühe bedanken wir uns im Voraus und freuen uns auf Ihre Rückmeldung.

Mit freundlichen Grüßen 
  
Di Frisco GmbH & Co. Gebäudereinigung`;

const MAIL = `Gesendet von Outlook für iOS
Von: Gioacchino Di Frisco <g.difrisco@difrisco.de>
Gesendet: Sunday, 19 July 2026 14:38:36
An: info@autohaus-trinkle.de <info@autohaus-trinkle.de>
Betreff: Fwd: Anfrage für ein Leasingangebot – Kia PV5 und Kia EV9

${BODY}`;

function emptyLead() {
  return {
    id: 'lead-difrisco',
    name: null,
    contact: {},
    wish: {},
    crm: {
      needProfile: {},
      vehicleConfigurations: [],
      cleverWorkingState: null,
      vehicleOffers: [],
    },
  };
}

{
  const interpreted = interpretSellerInput(MAIL);
  const accepted = applyAcceptedSellerTurn(emptyLead(), {
    extractedFacts: interpreted.facts,
    sellerInput: MAIL,
    preparedActions: [],
    intents: interpreted.intents || [],
  }, { postFeedCard: false });
  assert.equal(accepted.ok, true);
  const lead = accepted.lead;
  const byField = (field) => interpreted.facts.filter((f) => f.field === field);
  const fields = Object.fromEntries(
    interpreted.facts.filter((f) => f.field).map((f) => [f.field, f]),
  );
  const profile = getNeedProfileFromLead(lead);
  const name = String(lead.contact?.name || lead.name || '');
  const tracks = listCustomerVehicleTracks(lead);
  const drafts = Object.values(getCleverWorkingState(lead).offerDrafts || {});

  assert.match(name, /Gioacchino\s+Di\s+Frisco/i);
  assert.ok(!/Trinkle|Damen|Herren/i.test(name));
  assert.match(String(lead.contact?.email || fields.email?.value || ''), /difrisco\.de/i);

  const multi = byField('vehicleInterestMulti')[0];
  assert.ok(multi, 'PV5 + EV9 als Multi');
  const items = multi.value || [];
  assert.ok(items.some((i) => String(i.modelKey).toLowerCase() === 'pv5' && Number(i.quantity) === 1));
  assert.ok(items.some((i) => String(i.modelKey).toLowerCase() === 'ev9' && Number(i.quantity) === 3));
  assert.ok(items.some((i) => String(i.modelKey).toLowerCase() === 'pv5' && /passenger/i.test(String(i.trim || ''))));

  assert.equal(fields.paymentType?.value || lead.wish?.paymentType, 'leasing');
  assert.equal(Number(fields.termMonths?.value || lead.wish?.termMonths), 48);
  assert.ok(
    !interpreted.facts.some((f) => f.field === 'termMonths' && Number(f.value) === 36),
    'Uhrzeit :36 darf keine Laufzeit 36 erzeugen',
  );

  const variants = fields.annualMileageVariants?.value || profile.annualMileageVariants || [];
  assert.deepEqual(
    [...variants].map(Number).sort((a, b) => a - b),
    [20000, 25000],
    'Gesamtlaufleistung → Jahres-km',
  );
  assert.ok(
    !interpreted.facts.some((f) => f.field === 'annualMileage' && Number(f.value) === 80000),
    '80.000 Gesamtkm nicht als Jahres-km',
  );

  const totals = fields.leaseTotalMileageWishes?.value || profile.leaseTotalMileageWishes || [];
  assert.ok(totals.some((s) => Number(s.totalKm) === 80000 && Number(s.quantity) === 2));
  assert.ok(totals.some((s) => Number(s.totalKm) === 100000 && Number(s.quantity) === 1));

  assert.equal(fields.batteryPreference?.value?.id, 'large');
  assert.ok(!fields.batteryPreference?.value?.kWh, 'keine Fake-kWh');

  assert.ok(byField('openCustomerQuestion').some((f) => f.value?.topic === 'delivery_times'));
  assert.ok(byField('openCustomerQuestion').some((f) => f.value?.topic === 'fleet_terms'));

  assert.equal(tracks.length, 2, 'genau PV5 + EV9 Tracks');
  assert.equal(drafts.length, 0, 'keine Fake-Draft-Matrix aus Mengen');
  assert.equal(resolveActiveOfferDraft({ lead }), null);
  assert.ok(drafts.every((d) => (d.monthlyRate ?? d.rate ?? null) == null));

  const briefing = buildSellerWorkBriefing({
    lead,
    facts: interpreted.facts,
    draft: null,
  });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.PREPARE_OFFER);
  assert.match(briefing.text, /1\s*×\s*PV5|PV5 Passenger/i);
  assert.match(briefing.text, /3\s*×\s*EV9/i);
  assert.match(briefing.text, /48\s*Monate/i);
  assert.match(briefing.text, /20\.000|20000/);
  assert.match(briefing.text, /25\.000|25000/);
  assert.ok(!/80\.000 km\/Jahr|80000 km\/Jahr/i.test(briefing.text));
  assert.ok(!/36\s*Monate/i.test(briefing.text));
  assert.match(briefing.text, /Lieferzeiten|Flottenkonditionen/i);

  console.log('✓ Di Frisco Fleet Leasing Golden');
}

console.log('\nDi Frisco Fleet Leasing Golden: OK');
