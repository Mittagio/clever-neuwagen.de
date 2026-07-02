/**
 * Verkäufer-Karte „Antrag & Unterlagen“ in der Kundenakte – Tests A–J
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCustomerAkteApplicationDocumentsCardModel,
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
  buildCleverActionContext,
  CLEVER_ACTION_IDS,
  recommendCleverAction,
} from './cleverActionEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MS_DAY = 86400000;

const uploadLink = {
  url: 'http://localhost:5173/mein-bereich/unterlagen/req-docs?token=abc',
  requestId: 'req-docs',
  token: 'abc',
};

const baseLead = {
  id: 'lead-akte-docs',
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

const cardSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerAkteApplicationDocumentsCard.jsx'),
  'utf8',
);
const followUpSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/DealerAiLeadFollowUp.jsx'),
  'utf8',
);

// A) Karte ausblenden ohne Selbstauskunft und ohne Unterlagen
const emptyLead = { id: 'lead-empty', paymentType: 'leasing' };
const hidden = buildCustomerAkteApplicationDocumentsCardModel(emptyLead);
assert.equal(hidden.visible, false);

const visible = buildCustomerAkteApplicationDocumentsCardModel(baseLead);
assert.equal(visible.visible, true);
assert.equal(visible.title, 'Antrag & Unterlagen');

// B) in_progress zeigt Prozent
let lead = startSelfDisclosure(baseLead, SELF_DISCLOSURE_TYPES.PRIVATE).lead;
lead = saveSelfDisclosureStep(lead, {
  stepId: 'personalData',
  data: {
    firstName: 'Anna',
    lastName: 'Kunde',
    phone: '0170',
    email: 'a@b.de',
    birthDate: '1990-01-01',
    birthPlace: 'Berlin',
    nationality: 'deutsch',
  },
  advance: true,
}).lead;
const inProgressCard = buildCustomerAkteApplicationDocumentsCardModel(lead);
assert.match(inProgressCard.selfDisclosureLabel, /In Bearbeitung · \d+ %/);

// C) submitted zeigt Eingereicht + Prüfen-Aktion
lead = {
  ...baseLead,
  crm: {
    ...baseLead.crm,
    selfDisclosure: {
      type: SELF_DISCLOSURE_TYPES.PRIVATE,
      status: SELF_DISCLOSURE_STATUS.SUBMITTED,
      submittedAt: new Date().toISOString(),
      answers: {
        personalData: { firstName: 'Anna', lastName: 'Kunde' },
        income: { netMonthly: 4200 },
        employer: { name: 'Geheim GmbH' },
      },
    },
  },
};
const submittedCard = buildCustomerAkteApplicationDocumentsCardModel(lead);
assert.match(submittedCard.subline, /Selbstauskunft eingereicht/i);
assert.equal(submittedCard.selfDisclosureLabel, 'Eingereicht');
assert.ok(submittedCard.actions.some((action) => action.label === 'Selbstauskunft prüfen'));

// D) needs_correction zeigt Korrektur nötig
const correctionLead = {
  ...baseLead,
  crm: {
    ...baseLead.crm,
    selfDisclosure: {
      type: SELF_DISCLOSURE_TYPES.PRIVATE,
      status: SELF_DISCLOSURE_STATUS.NEEDS_CORRECTION,
      review: { status: 'needs_correction' },
    },
  },
};
const correctionCard = buildCustomerAkteApplicationDocumentsCardModel(correctionLead);
assert.equal(correctionCard.selfDisclosureLabel, 'Korrektur nötig');
assert.ok(correctionCard.actions.some((action) => action.label === 'Korrektur ansehen'));

// E) Nachweise offen / hochgeladen / geprüft
const evidenceLead = {
  ...baseLead,
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'open' },
        gehaltsnachweis: { status: 'open' },
        bankverbindung: { status: 'uploaded' },
        selbstauskunft: { status: 'checked' },
      },
      uploadLink,
    },
  },
};
const evidenceCard = buildCustomerAkteApplicationDocumentsCardModel(evidenceLead);
const evidenceOverview = buildDealerPortalDocumentsOverview(evidenceLead).evidence;
assert.ok(evidenceOverview.open > 0);
assert.ok(evidenceOverview.uploaded > 0);
assert.match(evidenceCard.evidenceSummaryLine, new RegExp(`${evidenceOverview.open} offen`));
assert.match(evidenceCard.evidenceSummaryLine, new RegExp(`${evidenceOverview.uploaded} hochgeladen`));

const checkedLead = {
  ...baseLead,
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'checked' },
        gehaltsnachweis: { status: 'open' },
        bankverbindung: { status: 'uploaded' },
        selbstauskunft: { status: 'checked' },
      },
      uploadLink,
    },
  },
};
const checkedOverview = buildDealerPortalDocumentsOverview(checkedLead).evidence;
const checkedCard = buildCustomerAkteApplicationDocumentsCardModel(checkedLead);
assert.ok(checkedOverview.checked > 0);
assert.match(checkedCard.evidenceSummaryLine, /geprüft/);

// F) Keine sensiblen Finanzwerte in der Karte
const sensitiveJson = JSON.stringify(submittedCard);
assert.ok(!sensitiveJson.includes('4200'));
assert.ok(!sensitiveJson.includes('Geheim GmbH'));
assert.ok(!sensitiveJson.includes('netMonthly'));

// G) Selbstauskunft prüfen → self_disclosure_review
const reviewAction = submittedCard.actions.find((action) => action.label === 'Selbstauskunft prüfen');
assert.equal(reviewAction.handlerType, 'self_disclosure_review');
assert.ok(cardSource.includes("handler === 'self_disclosure_review'"));
assert.ok(followUpSource.includes("handler === 'self_disclosure_review'"));
assert.ok(followUpSource.includes('SHEETS.selfDisclosureReview'));

// H) Unterlagen ansehen → unterlagen-Sheet
const docsAction = submittedCard.actions.find((action) => action.label === 'Unterlagen ansehen');
assert.equal(docsAction.handlerType, 'unterlagen');
assert.ok(followUpSource.includes('onOpenUnterlagen={() => openSheet(SHEETS.unterlagen)}'));

// I) Nächster guter Schritt: submitted → Selbstauskunft prüfen
const submittedRec = recommendCleverAction(buildCleverActionContext({
  lead: {
    ...baseLead,
    crm: {
      ...baseLead.crm,
      selfDisclosure: {
        type: SELF_DISCLOSURE_TYPES.PRIVATE,
        status: SELF_DISCLOSURE_STATUS.SUBMITTED,
        submittedAt: new Date().toISOString(),
      },
    },
  },
  vehicleCards: [],
}));
assert.equal(submittedRec.actionId, CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW);
assert.equal(submittedRec.title, 'Selbstauskunft prüfen');

// J) buildDealerPortalDocumentsOverview bleibt konsistent
const overview = buildDealerPortalDocumentsOverview(evidenceLead);
assert.equal(typeof overview.evidence.open, 'number');
assert.equal(typeof overview.allDone, 'boolean');

// Upload-Link fehlt → Mehr-Aktion
const noLinkLead = {
  ...baseLead,
  crm: {
    cleverUnterlagen: {
      items: {
        ausweis: { status: 'open' },
        selbstauskunft: { status: 'open' },
      },
    },
  },
};
const noLinkCard = buildCustomerAkteApplicationDocumentsCardModel(noLinkLead);
assert.ok(noLinkCard.moreActions.some((action) => action.label === 'Upload-Link erstellen'));

// Letzte Aktivität formatiert
const recentLead = {
  ...baseLead,
  crm: {
    ...baseLead.crm,
    selfDisclosure: {
      type: SELF_DISCLOSURE_TYPES.PRIVATE,
      status: SELF_DISCLOSURE_STATUS.IN_PROGRESS,
      lastSavedAt: new Date().toISOString(),
    },
  },
};
const recentCard = buildCustomerAkteApplicationDocumentsCardModel(recentLead);
assert.match(recentCard.lastActivityLabel ?? '', /heute \d{2}:\d{2}/);

// Selbstauskunft nachfassen nach 24h
const staleLead = {
  ...baseLead,
  crm: {
    ...baseLead.crm,
    selfDisclosure: {
      type: SELF_DISCLOSURE_TYPES.PRIVATE,
      status: SELF_DISCLOSURE_STATUS.IN_PROGRESS,
      startedAt: new Date(Date.now() - MS_DAY * 2).toISOString(),
      lastSavedAt: new Date(Date.now() - MS_DAY * 2).toISOString(),
    },
  },
};
const staleRec = recommendCleverAction(buildCleverActionContext({
  lead: staleLead,
  vehicleCards: [],
}));
assert.equal(staleRec.actionId, CLEVER_ACTION_IDS.SELF_DISCLOSURE_FOLLOWUP);

console.log('customerAkteApplicationDocuments.test.js: alle Tests bestanden');
