/**
 * Digitale Selbstauskunft im Kundenportal – Tests A–J
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SELF_DISCLOSURE_TYPES,
  SELF_DISCLOSURE_STATUS,
  SELF_DISCLOSURE_STEP_MAP,
  buildSelfDisclosureCardModel,
  buildDealerSelfDisclosureSummary,
  calculateSelfDisclosureProgress,
  getStepsForType,
  isSelfDisclosureSensitiveText,
  startSelfDisclosure,
  saveSelfDisclosureStep,
  submitSelfDisclosure,
  validateSelfDisclosureForSubmit,
  buildSelfDisclosureInterviewModel,
} from './customerPortalSelfDisclosureService.js';
import {
  applyCustomerPortalSelfDisclosureStart,
  applyCustomerPortalSelfDisclosureSave,
  applyCustomerPortalSelfDisclosureSubmit,
  buildPortfolioCustomerContext,
  prepareCustomerOfferPortfolio,
} from './customerOfferPortfolioService.js';
import { buildCustomerPortalDocumentsModel } from './customerPortalShellPresenter.js';
import { buildCustomerPortalStatusCardModel } from './customerPortalAccessService.js';
import { sanitizeCustomerVisibleText } from './customerMessageService.js';
import { createOfferSelectionGroup } from '../sales/offerSelectionGroup.js';
import {
  __resetInboxStoreForTests,
  INBOX_EVENT_TYPES,
  listInboxItems,
} from './cleverInboxService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

__resetInboxStoreForTests([]);

const ev3Group = createOfferSelectionGroup({
  modelKey: 'ev3',
  modelLabel: 'Kia EV3',
  wishConditions: { paymentType: 'leasing' },
});

const baseLead = {
  id: 'lead-sd-1',
  contact: { name: 'Anna Kunde', email: 'anna@example.de' },
  paymentType: 'leasing',
  crm: {
    offerSelectionGroups: [ev3Group],
    reservedModels: [],
    cleverUnterlagen: {
      items: { selbstauskunft: { status: 'open' } },
      uploadLink: {
        url: 'http://localhost:5173/mein-bereich/unterlagen/req-sd?token=abc',
        requestId: 'req-sd',
        token: 'abc',
      },
    },
  },
  history: [],
};

function fillPrivateSections() {
  return {
    personalData: {
      firstName: 'Anna',
      lastName: 'Kunde',
      phone: '01701234567',
      email: 'anna@example.de',
      birthDate: '1990-01-01',
      birthPlace: 'Berlin',
      nationality: 'deutsch',
    },
    address: {
      street: 'Musterweg',
      houseNumber: '1',
      zip: '10115',
      city: 'Berlin',
      country: 'DE',
      housingType: 'Miete',
      livedOverThreeYears: true,
    },
    housing: {
      maritalStatus: 'ledig',
      dependentChildren: 0,
    },
    employment: {
      employer: 'Firma GmbH',
      jobGroup: 'Angestellte',
      employedSince: '2020-01-01',
      permanentContract: true,
      probation: false,
    },
    income: {
      netMonthly: '3500',
    },
    expenses: {
      warmRent: '900',
    },
    declarations: {
      confirmed: true,
    },
  };
}

// A) Start mit Typ private
const started = startSelfDisclosure(baseLead, SELF_DISCLOSURE_TYPES.PRIVATE);
assert.ok(started.ok);
assert.equal(started.selfDisclosure.type, SELF_DISCLOSURE_TYPES.PRIVATE);
assert.equal(started.selfDisclosure.status, SELF_DISCLOSURE_STATUS.IN_PROGRESS);
assert.equal(started.selfDisclosure.currentStep, 'personalData');

const apiStart = applyCustomerPortalSelfDisclosureStart(baseLead, { type: SELF_DISCLOSURE_TYPES.PRIVATE });
assert.ok(apiStart.ok);
assert.equal(apiStart.selfDisclosure.type, SELF_DISCLOSURE_TYPES.PRIVATE);

// B) Zwischenspeichern
const saved = saveSelfDisclosureStep(started.lead, {
  stepId: 'personalData',
  data: fillPrivateSections().personalData,
  advance: true,
});
assert.ok(saved.ok);
assert.equal(saved.selfDisclosure.status, SELF_DISCLOSURE_STATUS.IN_PROGRESS);
assert.equal(saved.selfDisclosure.currentStep, 'address');
assert.ok(saved.selfDisclosure.lastSavedAt);

// C) Fortschritt
const partialLead = saved.lead;
const partialProgress = calculateSelfDisclosureProgress(partialLead.crm.selfDisclosure);
assert.ok(partialProgress > 0 && partialProgress < 100);

// D) Pflichtfelder verhindern submit
const incompleteSubmit = submitSelfDisclosure(partialLead);
assert.equal(incompleteSubmit.ok, false);
assert.equal(incompleteSubmit.error, 'incomplete');

// E) Submit + Clever Eingang
let workingLead = {
  ...partialLead,
  crm: {
    ...partialLead.crm,
    selfDisclosure: {
      ...partialLead.crm.selfDisclosure,
      sections: fillPrivateSections(),
      progress: 100,
    },
  },
};
const validation = validateSelfDisclosureForSubmit(workingLead.crm.selfDisclosure);
assert.ok(validation.ok);

const submitted = submitSelfDisclosure(workingLead);
assert.ok(submitted.ok);
assert.equal(submitted.selfDisclosure.status, SELF_DISCLOSURE_STATUS.SUBMITTED);
assert.ok(submitted.selfDisclosure.submittedAt);
assert.equal(submitted.inboxItem?.type, INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED);
assert.equal(submitted.inboxItem?.title, 'Selbstauskunft eingereicht');
const inboxItems = listInboxItems({ leadId: baseLead.id });
assert.ok(inboxItems.some((item) => item.type === INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED));

// F) Fortsetzen an currentStep
const resumeStart = startSelfDisclosure(baseLead, SELF_DISCLOSURE_TYPES.PRIVATE);
const resumeSave = saveSelfDisclosureStep(resumeStart.lead, {
  stepId: 'personalData',
  data: fillPrivateSections().personalData,
  advance: true,
});
const interview = buildSelfDisclosureInterviewModel(resumeSave.lead);
assert.equal(interview.currentStep.id, 'address');
assert.equal(interview.selfDisclosure.currentStep, 'address');

// G) Unterschiedliche Schritte je Typ
assert.equal(getStepsForType(SELF_DISCLOSURE_TYPES.PRIVATE).length, 7);
assert.equal(getStepsForType(SELF_DISCLOSURE_TYPES.FREELANCER).length, 5);
assert.equal(getStepsForType(SELF_DISCLOSURE_TYPES.CORPORATION).length, 4);
assert.notDeepEqual(
  SELF_DISCLOSURE_STEP_MAP[SELF_DISCLOSURE_TYPES.PRIVATE].map((s) => s.id),
  SELF_DISCLOSURE_STEP_MAP[SELF_DISCLOSURE_TYPES.CORPORATION].map((s) => s.id),
);

// H) Sensible Felder nicht in Nachrichten
assert.ok(isSelfDisclosureSensitiveText('Mein monatliches Nettoeinkommen beträgt 4000'));
assert.equal(sanitizeCustomerVisibleText('Mein Nettoeinkommen ist 4000 Euro'), '');

// I) Unterlagen-Tab Status
const cardNotStarted = buildSelfDisclosureCardModel(baseLead);
assert.equal(cardNotStarted.statusLabel, 'Noch nicht begonnen');
assert.equal(cardNotStarted.actionLabel, 'Selbstauskunft starten');

const cardInProgress = buildSelfDisclosureCardModel(resumeSave.lead);
assert.match(cardInProgress.statusLabel, /% ausgefüllt/);
assert.equal(cardInProgress.actionLabel, 'Weiter ausfüllen');

const cardSubmitted = buildSelfDisclosureCardModel(submitted.lead);
assert.equal(cardSubmitted.statusLabel, 'Abgesendet');

const documents = buildCustomerPortalDocumentsModel(baseLead);
assert.ok(documents.selfDisclosure);
assert.equal(documents.selfDisclosure.title, 'Selbstauskunft');

const dealerSummary = buildDealerSelfDisclosureSummary(submitted.lead);
assert.equal(dealerSummary.status, SELF_DISCLOSURE_STATUS.SUBMITTED);
const statusCard = buildCustomerPortalStatusCardModel({
  ...submitted.lead,
  crm: {
    ...submitted.lead.crm,
    customerPortalAccess: {
      status: 'viewed',
      portfolioUrl: 'http://localhost/angebot/auswahl/anna',
      lastActivityAt: new Date().toISOString(),
    },
  },
});
assert.equal(statusCard.selfDisclosure.label, 'Abgesendet');

// J) Upload-Link unverändert
assert.ok(documents.hasUploadLink);
assert.ok(documents.uploadUrl?.includes('/mein-bereich/unterlagen/'));

const docsSectionSource = readFileSync(
  join(__dirname, '../../components/customer/CustomerPortalDocumentsSection.jsx'),
  'utf8',
);
assert.ok(docsSectionSource.includes('Nachweise hochladen'));
assert.ok(docsSectionSource.includes('upload.url'));

const portfolioPageSource = readFileSync(
  join(__dirname, '../../pages/CustomerOfferPortfolioPage.jsx'),
  'utf8',
);
assert.ok(portfolioPageSource.includes('selbstauskunft'));

console.log('customerPortalSelfDisclosure.test.js: ok');
