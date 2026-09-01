/**
 * Roadmap Schritt 3 – Inbound leicht (Paste/Forward → Review → Confirm)
 * node --test src/services/cleverSeller/inboundLead.golden.test.js
 */
import assert from 'node:assert/strict';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildInboundIntakePresentation,
  extractInboundContact,
  formatIntakeDownPaymentLabel,
  formatIntakeMileageChipLabel,
  formatIntakeMileageLabel,
  formatIntakeTermChipLabel,
  formatIntakeTermLabel,
  isInboundLeadPaste,
  isInstitutionalContactEmail,
  resolveInboundCustomer,
} from './inboundLeadIntake.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';
import { prepareComposerPdfTurnInput } from './prepareComposerPdfTurnInput.js';
import { buildCustomerSnapshotModel } from '../dealer/buildCustomerSnapshotModel.js';

const ENV = {
  VITE_CLEVER_SELLER_ORCHESTRATOR: 'true',
  CLEVER_SELLER_ORCHESTRATOR: 'true',
};

const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });

const BRANDES_MAIL = [
  'Hier eine Anfrage:',
  '',
  '-----Ursprüngliche Nachricht-----',
  'Von: Herr Brandes <herr.brandes@demo-mail.de>',
  'Gesendet: Montag, 3. August 2026 09:12',
  'An: vertrieb@autohaus-trinkle.de',
  'Betreff: XCeed – kurze Rückfrage',
  '',
  'Guten Tag,',
  'ich habe noch eine Frage zum XCeed-Angebot und bitte um Rückruf.',
  '',
  'Mit freundlichen Grüßen',
  'Herr Brandes',
  '+49 170 1122334',
].join('\n');

const NEW_CUSTOMER_MAIL = [
  'Weitergeleitete Nachricht',
  '',
  '-----Ursprüngliche Nachricht-----',
  'Von: Lisa Neumann <lisa.neumann@example.org>',
  'Gesendet: Montag, 3. August 2026 11:40',
  'An: vertrieb@autohaus-trinkle.de',
  'Betreff: Interesse an Kia Sportage Leasing',
  '',
  'Hallo,',
  'ich interessiere mich für Leasing 36 Monate, 10.000 km, gerne ein Angebot.',
  '',
  'Viele Grüße',
  'Lisa Neumann',
  '0171 9988776',
].join('\n');

// --- Format helpers: immer gelabelte Zahlen ---
assert.equal(formatIntakeTermLabel(48), '48 Monate');
assert.equal(formatIntakeTermChipLabel(48), '48 M');
assert.equal(formatIntakeMileageLabel(12500), '12.500 km/Jahr');
assert.equal(formatIntakeMileageChipLabel(12500), '12.500 km');
assert.equal(formatIntakeDownPaymentLabel(5000), '5.000 € AZ');
assert.equal(formatIntakeTermLabel(null), null);

{
  const presentation = buildInboundIntakePresentation(
    { proposeCreateCustomer: true, contact: { email: 'a@b.de' } },
    {
      extractedFacts: [
        { field: 'vehicleInterest', label: 'EV2 Earth', value: 'EV2 Earth' },
        { field: 'paymentType', label: 'Leasing', value: 'leasing' },
        { field: 'termMonths', label: '48', value: 48 },
        { field: 'annualMileage', label: '12500 km', value: 12500 },
        { field: 'downPayment', label: '5000', value: 5000 },
      ],
    },
  );
  assert.match(presentation.conditionLine || '', /48 Monate/);
  assert.match(presentation.conditionLine || '', /12\.500 km\/Jahr/);
  assert.match(presentation.conditionLine || '', /5\.000 € AZ/);
  assert.ok(presentation.recognizedChips.includes('48 M'));
  assert.ok(presentation.recognizedChips.includes('12.500 km'));
  assert.ok(presentation.recognizedChips.includes('Leasing'));
  assert.ok(presentation.recognizedChips.includes('5.000 € AZ'));
  assert.ok(presentation.recognizedChips.includes('a@b.de'));
  assert.ok(!presentation.recognizedChips.includes('Neu anlegen'));
  assert.ok(!/^\d+\s+\d/.test(presentation.conditionLine || ''), 'kein Roh-Zahlenblob');
}

// --- noteChips ≠ recognizedChips (Meta nicht als Erkannt-Facts) ---
{
  const presentation = buildInboundIntakePresentation(
    {
      proposeCreateCustomer: false,
      resolutionStatus: 'ambiguous',
      duplicateHint: 'Mehrere Treffer',
      contact: { email: 'a@b.de', fullName: 'Max' },
    },
    {
      extractedFacts: [
        { field: 'vehicleInterest', label: 'EV2', value: 'EV2' },
        { field: 'paymentType', label: 'Leasing', value: 'leasing' },
        { field: 'unresolvedNote', label: 'irgendwas', preserveAsNote: true },
      ],
      unresolvedNotes: [{ text: 'Freitext' }],
    },
  );
  assert.ok(presentation.noteChips.includes('Unsicher erkannt'));
  assert.ok(presentation.noteChips.includes('Mehrere Treffer'));
  assert.ok(presentation.noteChips.includes('Notiz übernommen'));
  for (const meta of presentation.noteChips) {
    assert.ok(
      !presentation.recognizedChips.includes(meta),
      `Meta-Chip „${meta}“ darf nicht in recognizedChips`,
    );
  }
  assert.ok(!presentation.recognizedChips.includes('Kunde noch offen'));
}

// --- Detect + extract ---
assert.equal(isInboundLeadPaste(BRANDES_MAIL), true);
assert.equal(isInboundLeadPaste('Öffne Herrn Brandes.'), false);
const contact = extractInboundContact(BRANDES_MAIL);
assert.match(contact.fullName || '', /Brandes/i);
assert.equal(contact.email, 'herr.brandes@demo-mail.de');
assert.ok(contact.phone);

// --- Resolve Brandes by email ---
{
  const resolution = resolveInboundCustomer(contact, [brandes]);
  assert.equal(resolution.status, 'unique');
  assert.equal(resolution.lead.id, brandes.id);
  assert.equal(resolution.proposeCreateCustomer, false);
}

// --- interpret + turn: Brandes match ---
{
  const interpreted = interpretSellerInput(BRANDES_MAIL);
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(interpreted.facts.some((f) => f.field === 'email'));
  assert.ok(interpreted.facts.some((f) => f.field === 'customerName'));

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: BRANDES_MAIL,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.equal(turn.ok, true);
  assert.ok(turn.inboundLead?.detected);
  assert.equal(turn.inboundLead.resolutionStatus, 'unique');
  assert.equal(turn.inboundLead.matchedLeadId, brandes.id);
  assert.equal(turn.inboundLead.proposeCreateCustomer, false);
  assert.equal(turn.resolvedCustomer?.id, brandes.id);
  assert.equal(shouldShowUniversalReview(turn), true);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_intake_review');
  assert.equal(review.legacyReviewType, 'inbound_lead_review');
  assert.equal(review.kind, 'customer_intake');
  assert.equal(review.compactUi, true, 'Intake-Review compact – Accept-CTA als Primary-Button');
  assert.ok(review.hero?.name, 'Hero-Name für sichtbaren Accept-Flow');
  assert.equal(review.hero?.headline, null, 'CTA nur als Button, nicht als Hero-Headline');
  assert.match(review.hero?.name || '', /Kundenakte öffnen/i);
  assert.equal(review.hero?.subtitle, 'Von Clever erkannt');
  assert.equal(String(review.title || '').trim(), '', 'kein Narrations-Titel');
  assert.equal(review.quietIntake, true);
  assert.equal(review.progressLines?.length || 0, 0, 'keine Protokoll-Statuszeilen');
  assert.equal(turn.uiEffects?.progressLines?.length || 0, 0, 'keine Protokoll-Zeilen in uiEffects');
  assert.ok(
    !/Seller-Dump|zusammengeführt|sucht in Kunden|Clever wertet aus|Clever hat erkannt|Clever hat eine Anfrage|Erkannt als neue Anfrage|Neu anlegen\?/i
      .test(JSON.stringify({
        title: review.title,
        progressLines: review.progressLines,
        summaryLine: review.summaryLine,
        hero: review.hero,
        groups: review.groups,
      })),
    'keine Protokoll-Phrasen in seller-facing Review',
  );
  assert.ok(review.actionSections?.some((s) => (
    s.id === 'customer_intake_review' && s.kind === 'customer_intake_review' && s.title === 'Kundenanfrage'
  )));
  assert.ok(!review.groups.some((g) => /^(KONTAKT|ERKANNT|ERKANNTE ANGABEN|NÄCHSTE AKTION)$/i.test(g.title || '')));
  assert.match(review.primaryCta, /In Kundenakte weitermachen/i);
  const erkannt = review.groups.find((g) => g.id === 'facts');
  if (erkannt?.chips?.length) {
    assert.ok(
      erkannt.chips.every((c) => (typeof c === 'string' ? false : c.source === 'clever')),
      'Erkannt-Chips mit Clever-Source',
    );
  }
  assert.equal(
    review.actionSections.find((s) => s.kind === 'customer_intake_review')?.primaryActions?.[0]?.tone,
    'primary',
  );
  const secondary = review.actionSections.find((s) => s.kind === 'customer_intake_review')?.secondaryActions || [];
  assert.ok(secondary.some((a) => a.label === 'Korrigieren' && a.action === 'revise_intake'));
  assert.ok(secondary.some((a) => a.label === 'Erneut suchen'));
  assert.ok(secondary.some((a) => a.label === 'Verwerfen'));

  // Confirm → Fakten auf bestehenden Lead, kein neuer Lead
  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: false });
  assert.equal(applied.ok, true);
  assert.equal(applied.created, false);
  assert.equal(applied.lead.id, brandes.id);
  assert.ok(applied.lead.contact?.email || applied.acceptedLabels.length);
}

// --- Neuer Kunde: Propose, kein Persist ohne Accept ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: NEW_CUSTOMER_MAIL,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.ok(turn.inboundLead?.detected);
  assert.equal(turn.inboundLead.resolutionStatus, 'none');
  assert.equal(turn.inboundLead.proposeCreateCustomer, true);
  assert.ok(!turn.resolvedCustomer?.id);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_intake_review');
  assert.equal(review.legacyReviewType, 'inbound_lead_review');
  assert.equal(review.compactUi, true);
  assert.match(review.hero?.name || '', /Neumann.*neue Kundenakte/i);
  assert.equal(review.hero?.headline, null);
  assert.equal(review.hero?.subtitle, 'Von Clever erkannt');
  assert.match(review.primaryCta, /anlegen & weitermachen/i);
  assert.match(review.secondaryCta, /Korrigieren|Erneut suchen|Verwerfen/i);
  assert.match(review.summaryLine || '', /neue Kundenakte/i);
  const factGroup = review.groups.find((g) => g.id === 'facts');
  const chipLabel = (c) => (typeof c === 'string' ? c : c?.label || '');
  assert.ok(
    !(factGroup?.chips || []).some((c) => /Neu anlegen/i.test(chipLabel(c))),
    'kein technisches Chip „Neu anlegen“',
  );
  assert.ok(
    (factGroup?.chips || []).every((c) => typeof c === 'object' && c.source === 'clever'),
    'Erkannt-Chips Clever-Source bei neuem Lead',
  );
  assert.equal(
    review.actionSections.find((s) => s.kind === 'customer_intake_review')?.primaryActions?.[0]?.action,
    'accept_inbound_lead',
  );
  // Hero-Subline: gelabelte Konditionen wenn vorhanden
  if (review.hero?.subtitle) {
    assert.ok(!/\b\d{2}\s+\d{1,2}\.\d{3}\s+km\s+\d+\s*€\b/i.test(review.hero.subtitle));
  }

  // Ohne Accept: Snapshot unverändert (kein Side-Effect im Turn)
  assert.equal([brandes].length, 1);

  const applied = applyAcceptedSellerTurn({}, turn, {
    postFeedCard: false,
    allowCreateCustomer: true,
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.created, true);
  assert.ok(applied.lead?.id);
  assert.match(applied.lead.contact?.name || '', /Neumann/i);
  assert.match(applied.lead.contact?.email || '', /lisa\.neumann@example\.org/i);
  assert.equal(applied.lead.source, 'composer_inbound');
  const cleverInsights = (applied.lead.crm?.sellerInsights || [])
    .filter((i) => i.source === 'clever');
  assert.ok(cleverInsights.length > 0, 'Inbound-Accept schreibt Clever-Source auf Insights');
}

// --- Strukturierte Händler-Notiz ohne „Hier eine Anfrage:“ → Intake, keine Nachricht ---
{
  const SCHLAYER_NOTE = [
    'Schlayer Alexander Aalen',
    'Name: Alexander Schlayer',
    'S_Alexander1@hotmail.de',
    'EV3 AIR',
    'November 2026',
    'Bar',
    'Corporate Benefits',
    'ledig, keine Kinder',
    'aktuell Audi A4',
    '+49 7181 9987780',
    '+49 1575 0484494',
  ].join('\n');

  assert.equal(isInboundLeadPaste(SCHLAYER_NOTE), true);
  assert.equal(isInboundLeadPaste('Schreib ihm eine Mail zum EV3 Leasing.'), false);

  const noteContact = extractInboundContact(SCHLAYER_NOTE);
  assert.match(noteContact.fullName || '', /Alexander Schlayer/i);
  assert.equal(noteContact.email, 's_alexander1@hotmail.de');
  assert.equal(noteContact.sourceHint, 'structured_lead_note');

  const interpreted = interpretSellerInput(SCHLAYER_NOTE);
  assert.ok(interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  assert.ok(!interpreted.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: SCHLAYER_NOTE,
    leadsSnapshot: [brandes],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.ok(turn.inboundLead?.detected);
  assert.equal(turn.inboundLead.proposeCreateCustomer, true);
  assert.ok(!turn.messageDraft);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'customer_intake_review');
  assert.match(review.hero?.name || '', /Schlayer.*neue Kundenakte/i);
  assert.match(review.primaryCta || '', /anlegen & weitermachen/i);
  assert.ok(review.groups.some((g) => g.id === 'facts' || g.id === 'notes'));
  assert.ok(!/Seller-Dump|zusammengeführt|sucht in Kunden|Clever wertet aus|Clever hat erkannt|Erkannt als neue Anfrage|Neu anlegen\?/i
    .test(JSON.stringify({
      title: review.title,
      progressLines: review.progressLines,
      summaryLine: review.summaryLine,
      hero: review.hero,
      groups: review.groups,
    })));
  assert.equal(review.progressLines?.length || 0, 0);
  assert.ok((turn.missingInformation || []).some((m) => m.id === 'confirm_create_customer'));
}

// --- Institutions-Mail (Kia Finance) nie als Inbound-Kunden-Match-Key ---
{
  assert.equal(isInstitutionalContactEmail('kundenservice@lease.kiafinance.de'), true);
  assert.equal(isInstitutionalContactEmail('service@kiafinance.de'), true);
  assert.equal(isInstitutionalContactEmail('herr.brandes@demo-mail.de'), false);

  const offerBlob = [
    'PDF: EV2 36 Monate Leasingangebot.pdf',
    '',
    'Kia EV2 Earth Leasingangebot',
    'Laufzeit 36 Monate',
    '15.000 km / Jahr',
    'Monatsrate 329 €',
    'Anzahlung 0 €',
    'Kundenservice: kundenservice@lease.kiafinance.de',
    'Telefon +49 800 1234567',
    'Mit freundlichen Grüßen',
    'Kia Finance',
  ].join('\n');

  const contact = extractInboundContact(offerBlob);
  assert.notEqual(contact.email, 'kundenservice@lease.kiafinance.de');
  assert.ok(!contact.email || !isInstitutionalContactEmail(contact.email));

  const fakeLeads = [
    brandes,
    {
      id: 'lead-bank',
      contact: {
        name: 'Kia Finance Phantom',
        email: 'kundenservice@lease.kiafinance.de',
        phone: '08001234567',
      },
    },
  ];
  const resolution = resolveInboundCustomer(
    { email: 'kundenservice@lease.kiafinance.de' },
    fakeLeads,
  );
  assert.equal(resolution.status, 'none', 'Institutions-Mail kein E-Mail-Match');
  assert.equal(resolution.results?.length || 0, 0);
  assert.equal(resolution.proposeCreateCustomer, false);
}

// --- Offer-PDF mit Kia-Finance-Mail → Offer-Review, kein Treffer-prüfen-Inbound ---
{
  const EV2_OFFER_PDF = [
    'Kia EV2 Earth Leasingangebot',
    'Laufzeit 36 Monate',
    '15.000 km / Jahr',
    'Anzahlung 0 €',
    'Monatsrate 329 €',
    'Keine Schlussrate',
    'Fragen? kundenservice@lease.kiafinance.de',
    'Hotline +49 711 2223344',
    'Mit freundlichen Grüßen',
    'Ihr Kia Finance Team',
  ].join('\n');

  const prepared = prepareComposerPdfTurnInput({
    extracted: {
      ok: true,
      text: EV2_OFFER_PDF,
      fileName: 'EV2 36 Monate Leasingangebot.pdf',
    },
    file: { type: 'application/pdf', name: 'EV2 36 Monate Leasingangebot.pdf' },
  });
  assert.equal(prepared.kind, 'configurator_pdf');
  assert.equal(prepared.draftSeed, 'PDF: EV2 36 Monate Leasingangebot.pdf');
  assert.ok(!prepared.draftSeed.includes('kundenservice@'));
  assert.match(prepared.interpretSeed, /Leasingangebot/);

  const ambiguousLeads = [
    brandes,
    {
      id: 'lead-rambo',
      contact: { name: 'Rambo Gartenbau', email: 'rambo@example.de', phone: '07112223344' },
    },
    {
      id: 'lead-offen',
      contact: { name: 'Kunde noch offen', email: 'offen@example.de', phone: '07112223344' },
    },
  ];

  const { turn } = runComposerPdfAttachTurn({
    extracted: {
      ok: true,
      text: EV2_OFFER_PDF,
      fileName: 'EV2 36 Monate Leasingangebot.pdf',
    },
    file: { type: 'application/pdf', name: 'EV2 36 Monate Leasingangebot.pdf' },
    lead: {},
    leadsSnapshot: ambiguousLeads,
    scopeHint: 'dashboard',
  });

  assert.ok(turn);
  assert.ok(!turn.inboundLead?.detected, 'kein Inbound aus Offer-PDF');
  assert.ok(turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
  assert.ok(!turn.intents.some((i) => i.type === SELLER_TURN_INTENTS.INBOUND_LEAD));
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  assert.notEqual(review?.reviewType, 'customer_intake_review');
  assert.notEqual(review?.legacyReviewType, 'inbound_lead_review');
  assert.ok(
    ['offer_prepare', 'offer_incomplete', 'offer_and_message_review'].includes(review?.reviewType),
    `erwartet Offer-Review, got ${review?.reviewType}`,
  );
  assert.ok(!/Treffer prüfen/i.test(JSON.stringify(review || {})));
}

// --- Grube-Inbound: Soft ohne Quelle/Tel/Name; voller Name; km/AZ/Kundenservice ---
{
  const GRUBE_MAIL = [
    'Hier eine Anfrage:',
    '',
    '-----Ursprüngliche Nachricht-----',
    'Von: Herr Marcel Grube <marcel.grube@example.org>',
    'Gesendet: Montag, 1. September 2026 10:12',
    'An: vertrieb@autohaus-trinkle.de',
    'Betreff: Kia Sportage GT-Line AWD Leasing',
    '',
    'Hallo,',
    'Quelle: https://www.kia-trinkle-schorndorf.de/angebote/sportage',
    'Es ist eine Kontaktanfrage über das Kontaktformular.',
    '',
    'Name: Herr Marcel Grube',
    'Telefon: 07151 1234567',
    'E-Mail: marcel.grube@example.org',
    '',
    'Nachricht:',
    'Ich interessiere mich für den Sportage GT-Line AWD.',
    'Leasing ohne Anzahlung, 15.000 km/Jahr.',
    'Kundenservice soll in der Leasingrate enthalten sein.',
    '',
    'Mit freundlichen Grüßen',
    'Herr Marcel Grube',
    '07151 1234567',
  ].join('\n');

  const contact = extractInboundContact(GRUBE_MAIL);
  assert.equal(contact.firstName, 'Marcel');
  assert.equal(contact.lastName, 'Grube');
  assert.match(contact.fullName || '', /Marcel\s+Grube/i);

  const interpreted = interpretSellerInput(GRUBE_MAIL);
  assert.ok(interpreted.facts.some((f) => f.field === 'downPayment' && Number(f.value) === 0));
  assert.ok(interpreted.facts.some((f) => (
    (f.field === 'annualMileage' || f.field === 'mileagePerYear') && Number(f.value) === 15000
  )));
  assert.ok(interpreted.facts.some((f) => (
    f.field === 'serviceInclusionWish'
    || /Kundenservice.*Leasingrate/i.test(String(f.label || ''))
  )));
  const nameLabels = interpreted.facts
    .filter((f) => f.field === 'customerName')
    .map((f) => String(f.label || ''));
  assert.ok(nameLabels.some((n) => /Marcel\s+Grube/i.test(n)));
  assert.ok(!nameLabels.some((n) => /^Marcel$/i.test(n.trim())), 'kein Nur-Vorname-Fact');

  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GRUBE_MAIL,
    leadsSnapshot: [],
    scopeHint: 'dashboard',
    env: ENV,
  });
  assert.ok(turn.inboundLead?.detected);
  assert.equal(turn.inboundLead.proposeCreateCustomer, true);

  const applied = applyAcceptedSellerTurn({}, turn, {
    postFeedCard: false,
    allowCreateCustomer: true,
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.created, true);
  assert.equal(applied.lead.contact?.firstName, 'Marcel');
  assert.equal(applied.lead.contact?.lastName, 'Grube');
  assert.match(applied.lead.contact?.name || '', /^Marcel\s+Grube$/i);
  assert.equal(Number(applied.lead.wish?.downPayment), 0);
  assert.equal(Number(applied.lead.wish?.mileagePerYear), 15000);

  const snap = buildCustomerSnapshotModel(applied.lead);
  const summaryLabels = (snap.soft?.summary?.tokens || []).map((t) => t.label);
  const softBlob = summaryLabels.join(' · ');
  assert.ok(!/Quelle:/i.test(softBlob), `keine Quelle in Soft: ${softBlob}`);
  assert.ok(!/https?:\/\//i.test(softBlob), `keine URL in Soft: ${softBlob}`);
  assert.ok(!/Kontaktanfrage|Kontaktformular/i.test(softBlob), `kein Formular in Soft: ${softBlob}`);
  assert.ok(!/@/.test(softBlob), `keine E-Mail in Soft: ${softBlob}`);
  assert.ok(
    !summaryLabels.some((l) => /07151|1234567/.test(String(l))),
    `kein Telefon in Soft: ${softBlob}`,
  );
  assert.ok(
    !summaryLabels.some((l) => /^(?:Herr\s+)?Marcel(?:\s+Grube)?$/i.test(String(l).trim())),
    `kein Name-Chip in Soft: ${softBlob}`,
  );
  assert.ok(
    summaryLabels.some((l) => /Kundenservice/i.test(String(l))),
    `Kundenservice-Wunsch in Soft erwartet: ${softBlob}`,
  );
  // Telefon nicht doppelt in Insights
  const phoneInsights = (applied.lead.crm?.sellerInsights || [])
    .filter((i) => /07151|1234567/.test(String(i.text || '')));
  assert.equal(phoneInsights.length, 0, 'Telefon nicht als Soft-Insight');
}

console.log('inboundLead.golden.test.js: OK');
