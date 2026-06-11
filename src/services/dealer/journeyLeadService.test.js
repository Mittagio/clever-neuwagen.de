import assert from 'node:assert/strict';
import { autohausTrinkleSeed } from '../../data/dealers/autohausTrinkle.js';
import { buildDealerJourneySnapshot } from './purchaseTypeOptions.js';
import { createDefaultConfiguration } from './modelConfiguratorCatalog.js';
import {
  buildJourneyInquiryBrief,
  createLeadFromJourney,
  formatJourneyLeadDossierLines,
  prepareJourneyLeadContext,
} from './journeyLeadService.js';
import { buildJourneyOffers } from './journeyOfferService.js';

const config = createDefaultConfiguration('sorento');
config.trimId = 'platinum';
config.packageIds = ['ahk'];

const snapshot = buildDealerJourneySnapshot({
  configSummary: {
    modelKey: 'sorento',
    modelLabel: 'Sorento',
    trimLabel: 'Platinum',
    colorLabel: 'Schwarz',
    powertrainLabel: 'Benzin',
    packageLabels: ['AHK'],
  },
  purchaseType: 'leasing',
  specialConditions: ['gewerbe'],
  configuration: config,
});

const { offerBundle } = prepareJourneyLeadContext(snapshot, autohausTrinkleSeed);
assert.ok(offerBundle);
assert.equal(offerBundle.offers.length, 1);

const contact = { name: 'Max Mustermann', email: 'max@test.de', phone: '+49 123' };
const cleverQuote = { percent: 78, matched: 7, scorableTotal: 9 };

const brief = buildJourneyInquiryBrief({
  contact,
  journeySnapshot: snapshot,
  offerBundle,
  cleverQuote,
  searchQuery: 'Sorento Wohnwagen',
  dealer: autohausTrinkleSeed,
});

assert.equal(brief.customerName, 'Max Mustermann');
assert.equal(brief.cleverQuotePercent, 78);
assert.ok(brief.recommended.title);
assert.equal(brief.configuration.color, 'Schwarz');
assert.equal(brief.variant.payment, 'leasing');
assert.ok(brief.specialConditions.length);

const dossier = formatJourneyLeadDossierLines(brief);
assert.ok(dossier.some((l) => l.includes('Max Mustermann')));
assert.ok(dossier.some((l) => l.includes('CleverQuote')));
assert.ok(dossier.some((l) => l.includes('Wohnwagen')));

const lead = createLeadFromJourney({
  contact,
  journeySnapshot: snapshot,
  offerBundle,
  cleverQuote,
  searchQuery: 'Sorento Wohnwagen',
  dealerConditions: autohausTrinkleSeed,
  message: 'Bitte Rückruf',
});

assert.equal(lead.source, 'dealerJourney');
assert.equal(lead.contact.email, 'max@test.de');
assert.equal(lead.cleverQuotePercent, 78);
assert.equal(lead.paymentType, 'leasing');
assert.ok(lead.desiredRate > 0);
assert.ok(lead.inquiryBrief);
assert.ok(lead.history.length >= 3);
assert.ok(lead.notes.includes('Max Mustermann'));

const openSnapshot = { ...snapshot, purchaseType: 'open' };
const openBundle = buildJourneyOffers(openSnapshot, autohausTrinkleSeed);
const openLead = createLeadFromJourney({
  contact,
  journeySnapshot: openSnapshot,
  offerBundle: openBundle,
  dealerConditions: autohausTrinkleSeed,
});
assert.equal(openLead.paymentType, 'leasing');
assert.ok(openLead.desiredRate > 0);

console.log('journeyLeadService.test.js: ok');
