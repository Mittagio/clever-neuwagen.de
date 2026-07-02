/**
 * Verkäufer-Prüfung für digitale Selbstauskunft – Tests A–J
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SELF_DISCLOSURE_TYPES,
  SELF_DISCLOSURE_STATUS,
  applyMarkSelfDisclosureReviewed,
  applyRequestSelfDisclosureCorrection,
  buildSelfDisclosureCardModel,
  buildSelfDisclosureInterviewModel,
  buildSelfDisclosureReviewModel,
  getStepsForType,
  startSelfDisclosure,
  submitSelfDisclosure,
} from './customerPortalSelfDisclosureService.js';
import {
  buildInboxActionAkteUrl,
  buildInboxKundenakteUrl,
} from './cleverInboxQuestionRoute.js';
import {
  __resetInboxStoreForTests,
  getInboxDisplayMessage,
  INBOX_EVENT_TYPES,
  listInboxItems,
} from './cleverInboxService.js';
import { sanitizeCustomerVisibleText } from './customerMessageService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

__resetInboxStoreForTests([]);

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
    income: { netMonthly: '3500' },
    expenses: { warmRent: '900' },
    declarations: { confirmed: true },
  };
}

function submittedLead(type = SELF_DISCLOSURE_TYPES.PRIVATE) {
  const started = startSelfDisclosure({ id: 'lead-sd-review', contact: { name: 'Anna Kunde' }, history: [] }, type);
  const lead = {
    ...started.lead,
    crm: {
      ...started.lead.crm,
      selfDisclosure: {
        ...started.lead.crm.selfDisclosure,
        sections: type === SELF_DISCLOSURE_TYPES.PRIVATE
          ? fillPrivateSections()
          : started.lead.crm.selfDisclosure.sections,
      },
    },
  };
  if (type !== SELF_DISCLOSURE_TYPES.PRIVATE) {
    const steps = getStepsForType(type).filter((step) => step.id !== 'review');
    const sections = { ...lead.crm.selfDisclosure.sections };
    for (const step of steps) {
      sections[step.sectionKey] = sections[step.sectionKey] ?? {};
      for (const field of step.fields) {
        if (field.required) {
          sections[step.sectionKey][field.key] = field.type === 'yesno' ? true : 'Test';
        }
      }
    }
    sections.declarations = { confirmed: true };
    lead.crm.selfDisclosure.sections = sections;
  }
  return submitSelfDisclosure(lead).lead;
}

const privateSubmitted = submittedLead(SELF_DISCLOSURE_TYPES.PRIVATE);
const freelancerSubmitted = submittedLead(SELF_DISCLOSURE_TYPES.FREELANCER);
const corporationSubmitted = submittedLead(SELF_DISCLOSURE_TYPES.CORPORATION);

const inboxItem = {
  id: 'inbox-sd-1',
  type: INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
  actionTarget: 'self_disclosure_review',
  metadata: { selfDisclosureType: SELF_DISCLOSURE_TYPES.PRIVATE },
};

// A) self_disclosure_submitted öffnet Prüfansicht
const actionUrl = buildInboxActionAkteUrl('lead-sd-review', inboxItem);
assert.ok(actionUrl.includes('sheet=self_disclosure_review'));
assert.ok(actionUrl.includes('inboxItemId=inbox-sd-1'));
const akteUrl = buildInboxKundenakteUrl('lead-sd-review', inboxItem);
assert.ok(akteUrl.includes('sheet=self_disclosure_review'));

const reviewSheetSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerSelfDisclosureReviewSheet.jsx'),
  'utf8',
);
assert.ok(reviewSheetSource.includes('buildSelfDisclosureReviewModel'));
assert.ok(reviewSheetSource.includes('cust-sd-review'));

// B–D) Abschnitte je Typ
const privateReview = buildSelfDisclosureReviewModel(privateSubmitted);
assert.equal(privateReview.sections.length, 6);
assert.ok(privateReview.sections.some((section) => section.title === 'Persönliche Daten'));
assert.ok(privateReview.sections.some((section) => section.title === 'Einkommen'));

const freelancerReview = buildSelfDisclosureReviewModel(freelancerSubmitted);
assert.equal(freelancerReview.sections.length, 4);
assert.ok(freelancerReview.sections.some((section) => section.title === 'Unternehmensdaten'));

const corporationReview = buildSelfDisclosureReviewModel(corporationSubmitted);
assert.equal(corporationReview.sections.length, 3);
assert.ok(corporationReview.sections.some((section) => section.title === 'Ansprechpartner'));

// E) Als geprüft markieren
const reviewed = applyMarkSelfDisclosureReviewed(privateSubmitted, { reviewedBy: 'seller-1' });
assert.ok(reviewed.ok);
assert.equal(reviewed.selfDisclosure.status, SELF_DISCLOSURE_STATUS.REVIEWED);
assert.ok(reviewed.selfDisclosure.reviewedAt);
assert.equal(reviewed.selfDisclosure.review.status, 'reviewed');

// F) Korrektur anfordern
const correction = applyRequestSelfDisclosureCorrection(privateSubmitted, {
  correctionFields: [{
    sectionId: 'personalData',
    fieldId: 'birthDate',
    label: 'Geburtsdatum fehlt',
  }],
  correctionNotes: 'Bitte Datum prüfen',
  reviewedBy: 'seller-1',
});
assert.ok(correction.ok);
assert.equal(correction.selfDisclosure.status, SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION);
assert.equal(correction.selfDisclosure.review.correctionFields.length, 1);
assert.ok(correction.selfDisclosure.review.correctionRequestedAt);
assert.ok(correction.customerMessageDraft.includes('Geburtsdatum fehlt'));

// G) Kundenportal zeigt Korrekturstatus
const card = buildSelfDisclosureCardModel(correction.lead);
assert.equal(card.statusLabel, 'Bitte Angaben prüfen');
assert.equal(card.actionLabel, 'Korrektur bearbeiten');

// H) Korrektur bearbeiten startet beim betroffenen Abschnitt
const interview = buildSelfDisclosureInterviewModel(correction.lead);
assert.equal(interview.currentStep.id, 'personalData');
assert.ok(interview.correctionNotice);

// I) Erneutes Absenden erzeugt neues Event
const resubmitted = submitSelfDisclosure({
  ...correction.lead,
  crm: {
    ...correction.lead.crm,
    selfDisclosure: {
      ...correction.lead.crm.selfDisclosure,
      sections: fillPrivateSections(),
    },
  },
});
assert.ok(resubmitted.ok);
assert.equal(resubmitted.inboxItem.title, 'Selbstauskunft erneut eingereicht');
assert.equal(resubmitted.selfDisclosure.status, SELF_DISCLOSURE_STATUS.SUBMITTED);
listInboxItems({ leadId: 'lead-sd-review' });

// J) Sensible Werte nicht in Inbox-Vorschau / Nachrichten
const display = getInboxDisplayMessage({
  type: INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
  message: 'Typ: Privatperson',
  metadata: { selfDisclosureType: SELF_DISCLOSURE_TYPES.PRIVATE },
});
assert.equal(display, 'Typ: Privatperson');
assert.equal(getInboxDisplayMessage({
  type: INBOX_EVENT_TYPES.SELF_DISCLOSURE_SUBMITTED,
  message: 'Nettoeinkommen 3200 Euro',
}), 'Selbstauskunft eingereicht');
assert.equal(sanitizeCustomerVisibleText('Mein Nettoeinkommen beträgt 3200 Euro'), '');

const followUpSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/DealerAiLeadFollowUp.jsx'),
  'utf8',
);
assert.ok(followUpSource.includes('selfDisclosureReview'));
assert.ok(followUpSource.includes('CustomerSelfDisclosureReviewSheet'));

console.log('customerPortalSelfDisclosureReview.test.js: ok');
