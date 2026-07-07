import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDealerAiInput } from './dealerAiParser.js';
import { buildCustomerRecognitionInsight, applyRecognitionInsightToParsed } from './dealerAiRecognitionInsight.js';
import { buildVehicleOpportunityCards, formatVehicleCardTitle } from './customerAkte.js';
import { joinKundenhelferNotes } from './cleverKundenhelfer.js';
import { getSellerInsightsFromLead } from './dealer/sellerInsights.js';
import {
  DIRECT_AKTE_SAMPLE_TEXT,
  SCHLAYER_SAMPLE_TEXT,
  applyDirectCustomerAkteFromRecognition,
  buildReservedModelFromInsight,
  mergeKundenhelferChipLists,
  mergeReservedModels,
} from './dealerAiDirectCustomerAkte.js';
import { buildWishConditionChips } from './customerAkte.js';

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
const leadInsights = getSellerInsightsFromLead(lead).map((item) => item.text);
assert.ok(leadInsights.some((t) => /wohnmobil/i.test(t)), 'Erkenntnis in sellerInsights gespeichert');
assert.equal(lead.crm?.kundenhelfer?.notes, undefined, 'kundenhelfer.notes nicht neu geschrieben');

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
const extendedInsights = getSellerInsightsFromLead(extendedLeads[0]).map((item) => item.text);
assert.ok(extendedInsights.some((t) => /farbe\s+blau/i.test(t)), 'KI-Check schreibt neue Erkenntnisse nach sellerInsights');
assert.equal(extendedLeads[0].crm?.kundenhelfer?.notes, 'Wohnmobil', 'bestehende kundenhelfer.notes unverändert');

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

// --- Schlayer Alexander (strukturierte Verkäufernotizen) ---
const schlayerParsed = parseDealerAiInput(SCHLAYER_SAMPLE_TEXT);
assert.equal(schlayerParsed.ok, true, 'Schlayer-Beispiel wird geparst');
const schlayerInsight = buildCustomerRecognitionInsight(SCHLAYER_SAMPLE_TEXT, schlayerParsed);
const schlayerEnriched = applyRecognitionInsightToParsed(schlayerParsed, schlayerInsight);

assert.equal(schlayerInsight.customer.firstName, 'Alexander', 'Header: Vorname Alexander');
assert.equal(schlayerInsight.customer.lastName, 'Schlayer', 'Header: Nachname Schlayer');
assert.notEqual(schlayerInsight.customer.lastName, 'Aalen', 'Aalen wird nicht als Nachname erkannt');
assert.equal(schlayerInsight.customer.address?.street, 'Buchsweg', 'Straße Buchsweg erkannt');
assert.equal(schlayerInsight.customer.address?.houseNumber, '38', 'Hausnummer 38 erkannt');
assert.equal(schlayerInsight.customer.address?.postalCode, '73547', 'PLZ 73547 erkannt');
assert.equal(schlayerInsight.customer.address?.city, 'Aalen', 'Ort Aalen erkannt');
assert.equal(schlayerParsed.fields.trimLabel, 'Air', 'EV3 AIR: Linie Air erkannt');
assert.equal(schlayerParsed.fields.model, 'EV3', 'EV3 AIR: Modell EV3 erkannt');
assert.equal(schlayerParsed.fields.desiredDeliveryDate, 'November 2026', 'November 2026 als Wunschlieferdatum');
assert.equal(schlayerParsed.fields.paymentType, 'leasing', 'LEASING erkennt paymentType leasing');
assert.equal(schlayerParsed.fields.termMonths, 48, '48 Monate Laufzeit erkannt');
assert.equal(schlayerParsed.fields.mileagePerYear, 10000, '10.000 km/Jahr erkannt');
assert.equal(schlayerParsed.fields.downPayment, 2000, '2.000 € Anzahlung erkannt');
assert.equal(schlayerParsed.fields.desiredRate, null, '2.000 € Anzahlung nicht als Rate/Budget');
assert.ok(schlayerInsight.customerHelperNotes.includes('Corporate Benefits'), 'Corporate Benefits als Kundeninfo');
assert.equal(schlayerInsight.paymentWish.specialCondition, 'corporate_benefits', 'Corporate Benefits Sonderkondition');
assert.ok(schlayerInsight.customerHelperNotes.includes('ledig'), 'ledig als Kundeninfo');
assert.ok(schlayerInsight.customerHelperNotes.includes('keine Kinder'), 'keine Kinder als Kundeninfo');
assert.equal(schlayerInsight.vehicleWish.currentVehicle, 'Audi A4', 'Audi A4 als aktuelles Fahrzeug');
assert.ok(schlayerInsight.customerHelperNotes.some((n) => /fährt aktuell audi a4/i.test(n)), 'Chip fährt aktuell Audi A4');

const schlayerLeads = [];
const schlayerCreated = applyDirectCustomerAkteFromRecognition(schlayerEnriched, schlayerInsight, {
  conditions: { dealerId: 'autohaus-trinkle' },
  leads: schlayerLeads,
  addLead: (lead) => schlayerLeads.push(lead),
  updateLead: () => {},
  getExistingCodes: () => [],
});
const schlayerLead = schlayerLeads.find((item) => item.id === schlayerCreated.leadId);
assert.ok(schlayerLead?.contact?.address?.includes('Buchsweg'), 'Kundenakte zeigt Adresse im Header');
assert.ok(schlayerLead?.crm?.address?.includes('73547'), 'Adresse in CRM gespeichert');

const wishChips = buildWishConditionChips({
  paymentType: schlayerParsed.fields.paymentType,
  termMonths: schlayerParsed.fields.termMonths,
  mileagePerYear: schlayerParsed.fields.mileagePerYear,
  downPayment: schlayerParsed.fields.downPayment,
  desiredRate: schlayerParsed.fields.desiredRate,
  delivery: schlayerParsed.fields.desiredDeliveryDate,
});
assert.ok(wishChips.includes('Leasing'), 'Wunschkonditionen: Leasing');
assert.ok(wishChips.some((c) => /48\s*Monate/.test(c)), 'Wunschkonditionen: 48 Monate');
assert.ok(wishChips.some((c) => /10\.000\s*km\/Jahr/.test(c)), 'Wunschkonditionen: 10.000 km/Jahr');
assert.ok(wishChips.some((c) => /2\.000\s*€\s*Anzahlung/.test(c)), 'Wunschkonditionen: 2.000 € Anzahlung');
assert.ok(wishChips.some((c) => /Wunschlieferdatum November 2026/.test(c)), 'Wunschlieferdatum November 2026');
assert.ok(!wishChips.includes('Budget offen'), 'Kein Budget offen bei Anzahlung ohne Rate');

const schlayerCards = buildVehicleOpportunityCards({
  lead: schlayerLead,
  wishFields: schlayerEnriched.fields,
  reservedModels: schlayerLead.crm?.reservedModels ?? [],
});
assert.ok(schlayerCards.some((card) => /kia ev3 air/i.test(formatVehicleCardTitle(card))), 'Auf dem Tisch: Kia EV3 Air');
assert.ok(schlayerCards.some((card) => card.badge === 'Vorschlag / prüfen'), 'Status Idee / Fahrzeugvorschlag');

console.log('dealerAiDirectCustomerAkte.test.js: ok');
