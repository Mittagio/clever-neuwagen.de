/**
 * Tests: Eingefügte Anfragen – Klassifizierung & Bestandsfahrzeug-Flow
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPasteInquiryPreview,
  classifyPastedInquiry,
  extractStockVehicleInquiry,
  INQUIRY_TYPES,
} from './pasteInquiryClassifier.js';
import {
  __clearInboxTestMode,
  __resetInboxStoreForTests,
  INBOX_EVENT_TYPES,
  listInboxItems,
} from '../crm/cleverInboxService.js';
import { resolveInboxReplyIntent } from '../crm/cleverInboxQuestionRoute.js';
import { generateCleverAnswerDraft } from '../cleverAnswerDraftService.js';
import {
  applyStockVehicleInquiry,
  buildStockVehicleCalculatorNavigateState,
  findLeadForStockInquiry,
} from './stockVehicleInquiryFlow.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WEBSITE_MAIL = `Neue Fahrzeuganfrage über Ihre Website

Name: Alexander Wagner
Telefon: 0171 2345678
E-Mail: alexander.wagner@example.com

Fahrzeug: Kia Picanto 1.0 VISION AMT
Preis: 17.990 €
Fahrzeug-Nr.: GW-2024-1234
https://www.autohaus-trinkle.de/gebrauchtwagen/kia-picanto-123

Nachricht des Kunden:
Wir benötigen zeitnah ein zusätzliches Fahrzeug für unseren Fuhrpark.`;

// A) Händlerwebsite-Mail → stock_vehicle_request
const classification = classifyPastedInquiry(WEBSITE_MAIL);
assert.equal(classification.type, INQUIRY_TYPES.STOCK_VEHICLE_REQUEST);
assert.equal(classification.confidence, 'high');

// B) Extraktion Fahrzeug + Link + Nummer + Preis
const extraction = extractStockVehicleInquiry(WEBSITE_MAIL);
assert.match(extraction.vehicle.vehicleTitle ?? '', /Picanto/i);
assert.equal(extraction.vehicle.price, 17990);
assert.equal(extraction.vehicle.stockNumber, 'GW-2024-1234');
assert.ok(extraction.vehicle.vehicleUrl?.includes('picanto'));

// C) Kundendaten
assert.match(extraction.customer.fullName ?? '', /Alexander Wagner/i);
assert.ok(extraction.customer.phone);
assert.match(extraction.customer.email ?? '', /wagner@example.com/i);

// D) Unsichere Anfrage
const uncertain = classifyPastedInquiry('Bitte Rückruf wegen Fahrzeug-Nr. 12345');
assert.ok(uncertain.uncertain);
const uncertainPreview = buildPasteInquiryPreview(uncertain, extractStockVehicleInquiry('Bitte Rückruf wegen Fahrzeug-Nr. 12345'));
assert.equal(uncertainPreview.title, 'Clever ist nicht sicher');

// E) Kundenakte erstellen / finden
__resetInboxStoreForTests([]);
const leads = [];
const created = applyStockVehicleInquiry({
  extraction,
  stockVehicle: buildPasteInquiryPreview(classification, extraction).stockVehicle,
  classification,
}, {
  leads,
  addLead: (lead) => leads.push(lead),
  updateLead: (id, patch) => {
    const index = leads.findIndex((entry) => entry.id === id);
    if (index >= 0) leads[index] = { ...leads[index], ...patch };
  },
  conditions: { dealerId: 'autohaus-trinkle' },
  getExistingCodes: () => [],
});
assert.ok(created.leadId);
assert.equal(leads.length, 1);
assert.ok(leads[0].crm?.requestedStockVehicle?.vehicleTitle?.includes('Picanto'));

const found = findLeadForStockInquiry(extraction, leads);
assert.equal(found?.id, created.leadId);

const extended = applyStockVehicleInquiry({
  extraction,
  stockVehicle: buildPasteInquiryPreview(classification, extraction).stockVehicle,
  classification,
}, {
  leads,
  addLead: (lead) => leads.push(lead),
  updateLead: (id, patch) => {
    const index = leads.findIndex((entry) => entry.id === id);
    if (index >= 0) leads[index] = { ...leads[index], ...patch };
  },
  conditions: { dealerId: 'autohaus-trinkle' },
  getExistingCodes: () => [],
});
assert.equal(extended.extendedExisting, true);
assert.equal(leads.length, 1);

// F) Clever Eingang Item
const inboxItems = listInboxItems({ status: 'open' });
assert.ok(inboxItems.some((item) => item.type === INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST));
const stockItem = inboxItems.find((item) => item.type === INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST);
assert.match(stockItem.title, /Bestandsfahrzeug/i);
assert.match(stockItem.customerName, /Alexander Wagner/i);

// G) Inserat-Link gespeichert
assert.ok(leads[0].crm.requestedStockVehicle.vehicleUrl?.includes('picanto'));

// H) Antwort-Intent
assert.equal(resolveInboxReplyIntent({ type: INBOX_EVENT_TYPES.STOCK_VEHICLE_REQUEST }), 'answer_stock_vehicle_request');
const draft = generateCleverAnswerDraft({
  intentId: 'answer_stock_vehicle_request',
  context: {
    customer: { name: 'Alexander Wagner', salutation: 'Herr' },
    legacy: {
      requestedStockVehicle: {
        vehicleTitle: 'Kia Picanto 1.0 VISION AMT',
        price: 17990,
      },
    },
  },
});
assert.match(draft, /Picanto/i);
assert.match(draft, /laut Inserat/i);

// I) Angebotskalkulator mit Bestandsdaten
const navState = buildStockVehicleCalculatorNavigateState(leads[0], leads[0].crm.requestedStockVehicle);
assert.equal(navState.addVehicleContext.openConditions, true);
assert.equal(navState.addVehicleContext.skipConfigure, true);
assert.ok(navState.addVehicleContext.stockVehicle);

const dealerAiSource = readFileSync(join(__dirname, '../../pages/DealerAIPage.jsx'), 'utf8');
const startSource = readFileSync(join(__dirname, '../../components/dealer-ai/DealerAiStartScreen.jsx'), 'utf8');
assert.ok(startSource.includes('Anfrage einfügen'));
assert.ok(startSource.includes('Clever erkennen'));
assert.ok(dealerAiSource.includes('paste-inquiry'));
assert.ok(dealerAiSource.includes('PasteInquiryPreview'));

__clearInboxTestMode();

console.log('pasteInquiryClassifier.test.js: ok');
