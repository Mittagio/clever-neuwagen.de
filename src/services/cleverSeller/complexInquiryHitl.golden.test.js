/**
 * HITL komplexe Kundenanfragen – Goldens A–E
 * node src/services/cleverSeller/complexInquiryHitl.golden.test.js
 */
import assert from 'node:assert/strict';
import { interpretSellerInput } from './interpretSellerInput.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';
import { NEXT_BEST_ACTION_ID } from './determineNextBestSellerAction.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { getNeedProfileFromLead } from '../consultation/needProfileService.js';
import { resolveActiveOfferDraft } from './cleverWorkingDraft.js';

const JENS_REILE_MAIL = `Sehr geehrte Damen und Herren,

ich suche aktuell ein vollelektrisches Fahrzeug, möglichst kurzfristig verfügbar oder mit einer Lieferzeit von maximal 2–4 Wochen.

Meine Anforderungen:

* Akku über 50 kWh
* ca. 400 km WLTP oder mehr
* gute DC-Schnellladefähigkeit
* Wärmepumpe
* Neuwagen, gerne Lagerfahrzeug.

Besonders interessant sind für mich z. B. Renault 4/5 E-Tech, Kia Niro EV oder Hyundai KONA Elektro bzw. vergleichbare Modelle.

Ich möchte das Fahrzeug finanzieren, mit maximal 7.000 € Anzahlung. Entscheidend ist für mich ein möglichst niedriger effektiver Jahreszins (aktuell z. B. 0 % bzw. 0,99 % bei verschiedenen Herstellern).

Option A: Sofern es sich um einen förderfähigen Neuwagen handelt, möchte ich außerdem die staatliche E-Auto-Förderung 2026 berücksichtigen. Bitte teilen Sie mir mit, ob das angebotene Fahrzeug grundsätzlich dafür infrage kommt.

Bitte senden Sie mir bei passenden Fahrzeugen möglichst kurz:
Modell/Ausstattung, Preis inkl. Nebenkosten, Akku/Reichweite, Wärmepumpe, Verfügbarkeit, Lieferzeit sowie Finanzierungsangebot (Anzahlung, Laufzeit, Rate, effektiver Jahreszins und Schlussrate).

Falls aktuell kein passendes Fahrzeug verfügbar ist, freue ich mich über eine kurze Information zu Beschaffungsmöglichkeit und Lieferzeit.

Vielen Dank.

Mit freundlichen Grüßen

Jens Reile
Tel.: 0176 84962478
jensreile@proton.me
`;

function emptyLead(id = 'lead-hitl') {
  return {
    id,
    name: null,
    contact: {},
    wish: {},
    crm: {
      needProfile: {},
      vehicleConfigurations: [],
      cleverWorkingState: null,
    },
  };
}

function applyTurn(lead, sellerInput, facts) {
  const accepted = applyAcceptedSellerTurn(lead, {
    extractedFacts: facts,
    sellerInput,
    preparedActions: [],
    intents: [],
  }, { postFeedCard: false });
  assert.equal(accepted.ok, true);
  return accepted.lead;
}

{
  // GOLDEN A – Jens Reile Beratungsfall
  const interpreted = interpretSellerInput(JENS_REILE_MAIL);
  const fields = Object.fromEntries(
    interpreted.facts.map((f) => [f.field, f]),
  );

  assert.ok(fields.customerName || fields.email || fields.phone, 'Kontakt erkannt');
  assert.match(String(fields.customerName?.value || fields.customerName?.label || 'Jens Reile'), /Jens\s+Reile/i);
  assert.ok(fields.email || /proton\.me/i.test(JENS_REILE_MAIL));
  assert.ok(fields.phone);

  assert.equal(fields.fuelPreference?.value, 'electric');
  assert.equal(fields.rangeNeed?.value?.km, 400);
  assert.equal(fields.annualMileage, undefined, 'WLTP ≠ Jahreskilometer');
  assert.ok(
    interpreted.facts.some((f) => f.field === 'equipmentWish' && /wärmepumpe|heat_pump/i.test(`${f.label}${f.value?.id || ''}`)),
    'Wärmepumpe',
  );
  assert.ok(
    interpreted.facts.some((f) => f.field === 'equipmentWish' && /dc/i.test(`${f.label}${f.value?.id || ''}`)),
    'DC-Laden',
  );
  assert.equal(fields.paymentType?.value, 'financing');
  assert.equal(Number(fields.downPayment?.value), 7000);
  assert.ok(fields.financeWish, 'Zinswunsch verdichtet');
  assert.equal(fields.discountPercent, undefined, 'Zins ≠ Rabatt');
  assert.equal(fields.colorPreference, undefined, 'grundsätzlich ≠ Farbe');
  assert.equal(fields.existingVehicle, undefined, 'Kona ≠ existingVehicle');
  assert.equal(fields.vehicleInterest, undefined, 'kein Fokusmodell');

  const multi = fields.vehicleInterestMulti;
  assert.ok(multi?.consultationCandidates === true, 'consultationCandidates');
  const keys = (multi.value || []).map((v) => String(v.modelKey || v).toLowerCase());
  assert.ok(keys.includes('niro'));
  assert.ok(keys.includes('kona'));
  assert.ok(keys.includes('renault-4-5'));
  assert.ok(
    interpreted.facts.some((f) => f.field === 'openCustomerQuestion' && /förder/i.test(f.label || '')),
    'Förderung offen',
  );

  let lead = applyTurn(emptyLead('jens-a'), JENS_REILE_MAIL, interpreted.facts);
  const profile = getNeedProfileFromLead(lead);
  assert.ok(profile.modelCandidates?.length >= 2);
  assert.equal(profile.selectedModelKey, null);
  assert.equal(profile.consultationPending, true);
  assert.equal(profile.rangeKmMin, 400);
  assert.equal(profile.fuel, 'electric');
  assert.equal(listCustomerVehicleTracks(lead).length, 0, 'keine Offer-Tracks aus Kandidaten');
  assert.equal(resolveActiveOfferDraft({ lead }), null, 'kein Concept Draft');

  const briefing = buildSellerWorkBriefing({ lead, facts: interpreted.facts });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.CONSULTATION);
  assert.equal(briefing.nextBestAction?.label, 'Passende Fahrzeuge finden');
  assert.match(briefing.text, /400 km|Reichweite/i);
  assert.match(briefing.text, /Wärmepumpe/i);
  assert.match(briefing.text, /Niro|Kona|Renault/i);
  assert.match(briefing.text, /Förderung/i);
  assert.ok(!/Angebot vorbereiten/i.test(briefing.sections.nextStep));
  console.log('✓ GOLDEN A – Jens Reile Beratungsfall');
}

{
  // GOLDEN B – EV4 Entscheidung nach A
  const interpreted = interpretSellerInput(JENS_REILE_MAIL);
  let lead = applyTurn(emptyLead('jens-b'), JENS_REILE_MAIL, interpreted.facts);
  const beforeRange = getNeedProfileFromLead(lead).rangeKmMin;
  const beforeCandidates = [...(getNeedProfileFromLead(lead).modelCandidates || [])];

  const ev4 = interpretSellerInput('EV4', { lead });
  assert.equal(ev4.facts.find((f) => f.field === 'vehicleInterest')?.value?.modelKey, 'ev4');
  lead = applyTurn(lead, 'EV4', ev4.facts);

  const profile = getNeedProfileFromLead(lead);
  assert.equal(profile.selectedModelKey, 'ev4');
  assert.deepEqual(profile.modelCandidates, beforeCandidates);
  assert.equal(profile.rangeKmMin, beforeRange);
  assert.equal(profile.fuel, 'electric');

  const trackKey = (t) => String(t.modelKey || t.config?.modelKey || t.modelLabel || '');
  const tracks = listCustomerVehicleTracks(lead).filter((t) => /ev4/i.test(trackKey(t)));
  assert.equal(tracks.length, 1, 'genau ein EV4-Track');
  assert.ok(
    !listCustomerVehicleTracks(lead).some((t) => /niro|kona|renault/i.test(trackKey(t))),
    'Kandidaten keine Offer-Tracks',
  );

  const draft = resolveActiveOfferDraft({ lead });
  assert.ok(draft?.offerDraftId, 'Concept Draft');
  assert.match(String(draft.vehicleIdentityDraft?.modelKey || draft.modelKey || ''), /ev4/i);
  assert.equal(draft.monthlyRate ?? draft.rate ?? null, null);

  const briefing = buildSellerWorkBriefing({ lead, facts: [] });
  assert.equal(briefing.nextBestAction?.label, 'Angebot vorbereiten');
  console.log('✓ GOLDEN B – EV4 Concept Draft');
}

{
  // GOLDEN C – manuelle Reichweiten-Korrektur
  const interpreted = interpretSellerInput(JENS_REILE_MAIL);
  let lead = applyTurn(emptyLead('jens-c'), JENS_REILE_MAIL, interpreted.facts);
  const draftBefore = resolveActiveOfferDraft({ lead });

  const corr = interpretSellerInput('mindestens 450 km statt 400', { lead });
  const range = corr.facts.find((f) => f.field === 'rangeNeed');
  assert.equal(range?.value?.km, 450);
  assert.ok(!corr.facts.some((f) => f.field === 'annualMileage'));
  lead = applyTurn(lead, 'mindestens 450 km statt 400', corr.facts);

  assert.equal(getNeedProfileFromLead(lead).rangeKmMin, 450);
  assert.equal(resolveActiveOfferDraft({ lead }), draftBefore);
  assert.equal(listCustomerVehicleTracks(lead).length, 0);
  console.log('✓ GOLDEN C – Reichweite 450 ersetzt 400');
}

{
  // GOLDEN D – Modellliste
  const interpreted = interpretSellerInput(
    'Interessant sind Niro EV, Kona Elektro oder vergleichbare Modelle.',
  );
  const multi = interpreted.facts.find((f) => f.field === 'vehicleInterestMulti');
  assert.ok(multi?.consultationCandidates);
  const keys = (multi.value || []).map((v) => String(v.modelKey || v).toLowerCase());
  assert.ok(keys.includes('niro'));
  assert.ok(keys.includes('kona'));
  assert.equal(interpreted.facts.find((f) => f.field === 'vehicleInterest'), undefined);
  assert.equal(interpreted.facts.find((f) => f.field === 'existingVehicle'), undefined);

  const lead = applyTurn(emptyLead('list-d'), 'Interessant sind Niro EV, Kona Elektro oder vergleichbare Modelle.', interpreted.facts);
  const profile = getNeedProfileFromLead(lead);
  assert.equal(profile.selectedModelKey, null);
  assert.equal(resolveActiveOfferDraft({ lead }), null);
  const briefing = buildSellerWorkBriefing({ lead, facts: interpreted.facts });
  assert.equal(briefing.nextBestAction?.id, NEXT_BEST_ACTION_ID.CONSULTATION);
  console.log('✓ GOLDEN D – Modellliste Consultation');
}

{
  // GOLDEN E – Zahlenkontext WLTP + Zins
  const interpreted = interpretSellerInput(
    '400 km WLTP, Finanzierung möglichst 0,99 % effektiv.',
  );
  assert.equal(interpreted.facts.find((f) => f.field === 'rangeNeed')?.value?.km, 400);
  assert.equal(interpreted.facts.find((f) => f.field === 'annualMileage'), undefined);
  assert.equal(interpreted.facts.find((f) => f.field === 'discountPercent'), undefined);
  assert.ok(
    interpreted.facts.some((f) => f.field === 'paymentType' && f.value === 'financing')
    || interpreted.facts.some((f) => f.field === 'financeWish'),
    'Finance-Kontext',
  );
  console.log('✓ GOLDEN E – WLTP/Zins Safety');
}

console.log('complexInquiryHitl.golden ok');
