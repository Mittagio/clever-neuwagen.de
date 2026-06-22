import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDealerAiInput } from './dealerAiParser.js';
import { buildCustomerRecognitionInsight, applyRecognitionInsightToParsed } from './dealerAiRecognitionInsight.js';
import { buildVehicleOpportunityCards } from './customerAkte.js';
import { joinKundenhelferNotes } from './cleverKundenhelfer.js';
import {
  DIRECT_AKTE_SAMPLE_TEXT,
  applyDirectCustomerAkteFromRecognition,
  buildReservedModelFromInsight,
  mergeKundenhelferChipLists,
  mergeReservedModels,
} from './dealerAiDirectCustomerAkte.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = DIRECT_AKTE_SAMPLE_TEXT;

const parsed = parseDealerAiInput(SAMPLE);
assert.equal(parsed.ok, true, 'Beispieltext wird geparst');

const insight = buildCustomerRecognitionInsight(SAMPLE, parsed);

assert.equal(insight.customer.firstName, 'Peter', 'Peter Schwan wird als Vorname erkannt');
assert.equal(insight.customer.lastName, 'Schwan', 'Peter Schwan wird als Nachname erkannt');
assert.notEqual(insight.customer.firstName, 'Keine', 'Keine Förderung wird nicht als Vorname erkannt');
assert.notEqual(insight.customer.lastName, 'Förderung', 'Keine Förderung wird nicht als Nachname erkannt');
assert.ok(insight.customer.phone?.includes('01755'), 'Telefonnummer wird erkannt');
assert.equal(insight.customer.email, 'peterschwan@gmail.com', 'E-Mail wird erkannt');

const notes = insight.customerHelperNotes;
assert.ok(notes.some((n) => /e-soul.*gebrauchtwagen/i.test(n)), 'E-Soul GW wird als Gebrauchtwagen erkannt');
assert.ok(notes.some((n) => /28\.07\.2026/.test(n)), '28.07.2026 wird als Wunschdatum erkannt');
assert.ok(notes.some((n) => /30\.000\s*€/.test(n)), 'bis 30.000 € wird als Budget erkannt');
assert.ok(notes.includes('Wohnmobil'), 'Wohnmobil wird als Kundeninfo gespeichert');
assert.ok(notes.some((n) => /50\s*k(?:w|wh)\s*batterie/i.test(n)), '50 kW Batterie wird gespeichert');
assert.ok(notes.some((n) => /farbe\s+blau/i.test(n)), 'Farbe blau wird gespeichert');

assert.equal(insight.vehicleWish.modelKey, 'esoul', 'E-Soul als Fahrzeugwunsch erkannt');
assert.equal(insight.vehicleWish.vehicleType, 'Gebrauchtwagen', 'Gebrauchtwagen erkannt');
assert.equal(insight.vehicleWish.colorPreference, 'blau', 'Farbpräferenz blau erkannt');
assert.equal(insight.vehicleWish.budget, 30000, 'Budget 30000 erkannt');
assert.equal(insight.vehicleWish.desiredDate, '2026-07-28', 'Wunschdatum ISO erkannt');
assert.equal(insight.recommendation?.modelLabel, 'Kia e-Soul', 'Empfehlung Kia e-Soul');
assert.equal(insight.recommendation?.status, 'prüfen', 'Empfehlung Status prüfen');

const enriched = applyRecognitionInsightToParsed(parsed, insight);
const leads = [];
const created = applyDirectCustomerAkteFromRecognition(enriched, insight, {
  conditions: { dealerId: 'autohaus-trinkle' },
  leads,
  addLead: (lead) => leads.push(lead),
  updateLead: () => {},
  getExistingCodes: () => [],
});

assert.equal(created.type, 'lead', 'Nach KI-Check wird Kundenakte erstellt');
assert.ok(created.leadId, 'Lead-ID vorhanden');
const lead = leads.find((item) => item.id === created.leadId);
assert.ok(lead, 'Lead wurde angelegt');
assert.ok(joinKundenhelferNotes(insight.customerHelperNotes).includes('Wohnmobil'), 'Chips in Kundenakte gespeichert');

const cards = buildVehicleOpportunityCards({
  lead,
  wishFields: enriched.fields,
  reservedModels: lead.crm?.reservedModels ?? [],
});
assert.ok(cards.some((card) => /e-soul/i.test(card.modelName)), 'Fahrzeugvorschlag auf dem Tisch');
assert.ok(cards.some((card) => card.badge === 'Vorschlag / prüfen'), 'Status Vorschlag / prüfen');

const existingLead = {
  id: 'lead-existing',
  customerId: 'cust-1',
  contact: { name: 'Peter Schwan', phone: '', email: '' },
  crm: {
    kundenhelfer: { notes: 'Wohnmobil', voiceMemos: [] },
    reservedModels: buildReservedModelFromInsight(insight, enriched),
  },
  history: [],
  vehicle: { brand: 'Kia', model: '', label: 'Kia – Modell offen' },
  wish: {},
};
const extendedLeads = [existingLead];
const extended = applyDirectCustomerAkteFromRecognition(enriched, insight, {
  conditions: { dealerId: 'autohaus-trinkle' },
  leads: extendedLeads,
  addLead: () => {},
  updateLead: (id, patch) => {
    const index = extendedLeads.findIndex((item) => item.id === id);
    if (index >= 0) extendedLeads[index] = { ...extendedLeads[index], ...patch };
  },
  getExistingCodes: () => [],
  addVehicleContext: { opportunityId: 'lead-existing' },
});
assert.equal(extended.extendedExisting, true, 'Bestehende Kundenakte wird erweitert');
assert.equal(extendedLeads.length, 1, 'Keine zweite Kundenakte erstellt');

const duplicateMerge = mergeReservedModels(
  buildReservedModelFromInsight(insight, enriched),
  buildReservedModelFromInsight(insight, enriched),
);
assert.equal(duplicateMerge.models.length, 1, 'Duplikat-Fahrzeugwunsch wird vermieden');
assert.equal(duplicateMerge.duplicates.length, 1, 'Duplikat erkannt');

const mergedNotes = mergeKundenhelferChipLists('Wohnmobil', ['Farbe blau', 'Wohnmobil']);
assert.equal(mergedNotes.split(',').map((s) => s.trim()).filter(Boolean).length, 2, 'Chip-Duplikate vermieden');

const pageSource = readFileSync(join(__dirname, '../pages/DealerAIPage.jsx'), 'utf8');
assert.ok(pageSource.includes('handleApplyDirectCustomerAkte'), 'Direkt-Flow in DealerAIPage');
assert.ok(pageSource.includes("setPhase('followup')"), 'Nach KI-Check direkt Kundenakte');
assert.ok(!pageSource.includes("setPhase('recognition-review')"), 'Kein Pflicht-Zwischenschritt mehr');

console.log('dealerAiDirectCustomerAkte.test.js: ok');
