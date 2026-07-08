/**
 * Verkäufer-Spracharbeitsplatz – Parser-Erweiterung (gleiche Pipeline wie Kunde)
 */
import assert from 'node:assert/strict';
import { mergeTextIntoNeedProfile } from './needProfileService.js';
import { appendSellerInsightToLead, createSellerInsight } from '../dealer/sellerInsights.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';

function assertLabelsInclude(profile, expected = []) {
  for (const label of expected) {
    assert.ok(
      profile.understoodLabels.some((entry) => entry.includes(label) || label.includes(entry)),
      `Label „${label}“ fehlt in: ${profile.understoodLabels.join(', ')}`,
    );
  }
}

function assertUnderstandingIncludes(lead, expected = []) {
  const understanding = buildCustomerUnderstanding(lead);
  const labels = understanding?.verstaendnis?.labels ?? [];
  const openPoints = understanding?.verstaendnis?.openPoints ?? [];
  const corpus = [...labels, ...openPoints].join(' | ');
  for (const label of expected) {
    assert.ok(
      labels.some((entry) => entry.includes(label) || label.includes(entry))
        || openPoints.some((entry) => entry.includes(label) || label.includes(entry)),
      `Understanding „${label}“ fehlt in: ${corpus}`,
    );
  }
}

const kugaTimeline = mergeTextIntoNeedProfile('Der Kuga läuft im November 2026 aus.');
assertLabelsInclude(kugaTimeline, ['Fahrzeugwechsel November 2026']);

const leasingFruehjahr = mergeTextIntoNeedProfile('Leasing endet im Frühjahr.');
assertLabelsInclude(leasingFruehjahr, ['Fahrzeugwechsel Frühjahr']);

const lieferzeit = mergeTextIntoNeedProfile(
  'Lieferzeit ist ihm wichtiger als die letzte Rate.',
);
assertLabelsInclude(lieferzeit, ['Lieferzeit wichtiger als Rate']);

const antriebOffen = mergeTextIntoNeedProfile(
  'Er schwankt noch zwischen Hybrid und Elektro.',
);
assertLabelsInclude(antriebOffen, ['Hybrid oder Elektro offen']);

const dachzelt = mergeTextIntoNeedProfile('Das Dachzelt wäre wichtig.');
assertLabelsInclude(dachzelt, ['Dachzelt']);

const rateBudget = mergeTextIntoNeedProfile(
  'Eigentlich möchte er die Rate unter 500 Euro halten.',
);
assertLabelsInclude(rateBudget, ['500']);

const hauptfahrerin = mergeTextIntoNeedProfile(
  'Die Frau fährt das Fahrzeug überwiegend.',
);
assertLabelsInclude(hauptfahrerin, ['Hauptfahrerin']);

const designPrioritaet = mergeTextIntoNeedProfile(
  'Optik ist ihm wichtiger als maximale Ausstattung.',
);
assertLabelsInclude(designPrioritaet, ['Design wichtiger als Ausstattung']);

const urlaubSorgen = mergeTextIntoNeedProfile(
  'Urlaub in Italien machen ihnen Sorgen.',
);
assertLabelsInclude(urlaubSorgen, ['Reichweitenbedenken']);

const evTrims = mergeTextIntoNeedProfile('EV3 Earth in Silber, GT-Line offen.');
assertLabelsInclude(evTrims, ['EV3', 'Earth', 'Silber']);

const telefonat = [
  'Sportage Spirit in Grün.',
  'Tönungscheiben wichtig.',
  'Anhängerkupplung notwendig.',
  'Leasing 48 Monate mit 15.000 km.',
  'Restwertübernahme später gewünscht.',
  'Ford Kuga läuft im November 2026 aus.',
].join(' ');

const telefonatProfile = mergeTextIntoNeedProfile(telefonat);
assertLabelsInclude(telefonatProfile, [
  'Sportage',
  'Spirit',
  'Grün',
  'Tönung',
  'Anhängerkupplung',
  'Leasing',
  '48 Monate',
  '15.000 km',
  'Restwertübernahme',
  'Fahrzeugwechsel November 2026',
]);

let sellerLead = { id: 'lead-seller-speech', crm: {} };
sellerLead = appendSellerInsightToLead(sellerLead, telefonat, { context: 'phone_call' });
const insight = createSellerInsight(telefonat, { context: 'phone_call' });
assert.ok(insight.understoodLabels.length >= 8, 'sellerInsight Parser erzeugt viele Labels');

assertUnderstandingIncludes(sellerLead, [
  'Sportage',
  'Anhängerkupplung',
  '48 Monate',
  'Fahrzeugwechsel November 2026',
]);

const hybridUnsicher = mergeTextIntoNeedProfile(
  'Er ist sich noch nicht sicher ob Hybrid oder Elektro besser passt. Das Dachzelt ist wichtig. Lieferzeit ist wichtiger als die letzte Rate.',
);
assertLabelsInclude(hybridUnsicher, ['Hybrid oder Elektro offen', 'Dachzelt', 'Lieferzeit wichtiger als Rate']);

console.log('sellerSpeechRecognition.test.js: ok');
