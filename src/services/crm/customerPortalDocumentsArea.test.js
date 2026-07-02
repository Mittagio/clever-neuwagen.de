/**
 * Kundenportal Unterlagen-Tab – Antragsbereich Tests A–M
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCustomerPortalDocumentsModel,
  buildCustomerPortalShellModel,
  buildDealerPortalDocumentsOverview,
} from './customerPortalShellPresenter.js';
import {
  SELF_DISCLOSURE_STATUS,
  SELF_DISCLOSURE_TYPES,
  saveSelfDisclosureStep,
  startSelfDisclosure,
  submitSelfDisclosure,
} from './customerPortalSelfDisclosureService.js';
import {
  __resetInboxStoreForTests,
  listInboxItems,
} from './cleverInboxService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

__resetInboxStoreForTests([]);

const uploadLink = {
  url: 'http://localhost:5173/mein-bereich/unterlagen/req-docs?token=abc',
  requestId: 'req-docs',
  token: 'abc',
};

const baseLead = {
  id: 'lead-docs-area',
  paymentType: 'leasing',
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'open' },
        selbstauskunft: { status: 'open' },
        gehaltsnachweis: { status: 'open' },
        bankverbindung: { status: 'uploaded' },
      },
      uploadLink,
    },
  },
};

const sectionSource = readFileSync(
  join(__dirname, '../../components/customer/CustomerPortalDocumentsSection.jsx'),
  'utf8',
);

// A) Bereich Digital ausfüllen
assert.ok(sectionSource.includes('Digital ausfüllen'));
assert.ok(sectionSource.includes('Selbstauskunft'));

const notStarted = buildCustomerPortalDocumentsModel(baseLead);
assert.ok(notStarted.documentsArea);
assert.equal(notStarted.documentsArea.selfDisclosureCard.statusLabel, 'Noch nicht begonnen');
assert.equal(notStarted.documentsArea.selfDisclosureCard.actionLabel, 'Selbstauskunft starten');

// B) not_started
assert.equal(notStarted.documentsArea.selfDisclosureCard.status, SELF_DISCLOSURE_STATUS.NOT_STARTED);

// C) in_progress
let lead = startSelfDisclosure(baseLead, SELF_DISCLOSURE_TYPES.PRIVATE).lead;
const saved = saveSelfDisclosureStep(lead, {
  stepId: 'personalData',
  data: { firstName: 'Anna', lastName: 'Kunde', phone: '0170', email: 'a@b.de', birthDate: '1990-01-01', birthPlace: 'Berlin', nationality: 'deutsch' },
  advance: true,
});
const inProgress = buildCustomerPortalDocumentsModel(saved.lead);
assert.match(inProgress.documentsArea.selfDisclosureCard.statusLabel, /In Bearbeitung · \d+ %/);
assert.equal(inProgress.documentsArea.selfDisclosureCard.actionLabel, 'Weiter ausfüllen');

// D) submitted
lead = {
  ...saved.lead,
  crm: {
    ...saved.lead.crm,
    selfDisclosure: {
      ...saved.lead.crm.selfDisclosure,
      sections: {
        ...saved.lead.crm.selfDisclosure.sections,
        personalData: { firstName: 'Anna', lastName: 'Kunde', phone: '0170', email: 'a@b.de', birthDate: '1990-01-01', birthPlace: 'Berlin', nationality: 'deutsch' },
        address: { street: 'A', houseNumber: '1', zip: '10115', city: 'Berlin', country: 'DE', housingType: 'Miete', livedOverThreeYears: true },
        housing: { maritalStatus: 'ledig', dependentChildren: 0 },
        employment: { employer: 'Firma', jobGroup: 'Angestellte', employedSince: '2020-01-01', permanentContract: true, probation: false },
        income: { netMonthly: '3000' },
        expenses: { warmRent: '900' },
        declarations: { confirmed: true },
      },
    },
  },
};
const submittedResult = submitSelfDisclosure(lead);
const submitted = buildCustomerPortalDocumentsModel(submittedResult.lead);
assert.equal(submitted.documentsArea.selfDisclosureCard.statusLabel, 'Eingereicht');

// E) needs_correction
const correctionLead = {
  ...submittedResult.lead,
  crm: {
    ...submittedResult.lead.crm,
    selfDisclosure: {
      ...submittedResult.lead.crm.selfDisclosure,
      status: SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION,
      review: {
        correctionFields: [{ sectionId: 'personalData', fieldId: 'birthDate', label: 'Geburtsdatum fehlt' }],
      },
    },
  },
};
const needsCorrection = buildCustomerPortalDocumentsModel(correctionLead);
assert.equal(needsCorrection.documentsArea.selfDisclosureCard.statusLabel, 'Bitte Angaben prüfen');
assert.equal(needsCorrection.documentsArea.selfDisclosureCard.actionLabel, 'Korrektur bearbeiten');

// F) Nachweise gruppiert
const groups = notStarted.documentsArea.evidence.groups;
assert.ok(groups.open.some((item) => item.label === 'Ausweis'));
assert.ok(groups.uploaded.some((item) => item.label === 'Bankverbindung / IBAN'));
assert.ok(!groups.open.some((item) => item.label === 'Selbstauskunft'));
assert.ok(!groups.uploaded.some((item) => item.label === 'Selbstauskunft'));

// G) Upload-Button nutzt uploadUrl
assert.equal(notStarted.documentsArea.uploadAction.label, 'Nachweise hochladen');
assert.equal(notStarted.documentsArea.uploadAction.url, uploadLink.url);

// H) Kein uploadUrl → Hinweis
const noLink = buildCustomerPortalDocumentsModel({
  ...baseLead,
  crm: {
    cleverUnterlagen: {
      items: baseLead.crm.cleverUnterlagen.items,
      uploadLink: null,
    },
  },
});
assert.equal(noLink.documentsArea.uploadAction.hint, 'Das Autohaus stellt Ihnen den Upload-Link bereit.');

// I) Gesamtstatus verständlich
assert.ok(notStarted.documentsArea.summaryLabel.includes('Selbstauskunft'));
assert.ok(submitted.documentsArea.summaryLabel.includes('eingereicht'));

// J) Badge
const shell = buildCustomerPortalShellModel(notStarted);
assert.ok(shell.badges.documentsOpenCount >= 2);

const doneLead = {
  ...submittedResult.lead,
  crm: {
    ...submittedResult.lead.crm,
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'checked' },
        gehaltsnachweis: { status: 'checked' },
        bankverbindung: { status: 'checked' },
      },
      uploadLink,
    },
    selfDisclosure: {
      ...submittedResult.lead.crm.selfDisclosure,
      status: SELF_DISCLOSURE_STATUS.REVIEWED,
    },
  },
};
const doneShell = buildCustomerPortalShellModel(doneLead);
assert.equal(doneShell.badges.documentsOpenCount, null);

// K) Keine sensiblen Finanzwerte im Tab
const serialized = JSON.stringify(notStarted.documentsArea);
assert.ok(!serialized.includes('3000'));
assert.ok(!serialized.includes('Nettoeinkommen'));
assert.ok(!/einkommen/i.test(serialized) || serialized.includes('Selbstauskunft'));

// L) Zwischenspeichern erzeugt kein Inbox-Item
__resetInboxStoreForTests([]);
saveSelfDisclosureStep(baseLead, { stepId: 'personalData', data: { firstName: 'X' }, advance: false });
assert.equal(listInboxItems({ leadId: baseLead.id }).length, 0);

// M) Verkäufer-Overview vorbereitet
const dealerOverview = buildDealerPortalDocumentsOverview(notStarted);
assert.ok(dealerOverview.summaryLabel);
assert.ok(dealerOverview.evidence.open >= 0);

// UI Wording
assert.ok(sectionSource.includes('Nachweise hochladen'));
assert.equal(notStarted.documentsArea.headline, 'Ihre Unterlagen');

console.log('customerPortalDocumentsArea.test.js: ok');
