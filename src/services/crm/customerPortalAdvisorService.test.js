/**
 * Kundenportal – Ansprechpartner Resolver
 */
import assert from 'node:assert/strict';
import {
  buildCustomerPortalAdvisorModel,
  buildPortalAdvisorHintFromLead,
  mergeAdvisorSnapshot,
} from './customerPortalAdvisorService.js';
import { prepareCustomerPortalAccess } from './customerPortalAccessService.js';

const dealerLead = {
  id: 'lead-advisor-1',
  dealerId: 'autohaus-trinkle',
  contact: { name: 'Anna Kunde', email: 'anna@example.de' },
  history: [],
};

// A) ownerName hat Priorität
const withOwnerName = {
  ...dealerLead,
  ownerName: 'Mike Quach',
  ownerId: 'mike-quach',
};
const advisorA = buildCustomerPortalAdvisorModel(withOwnerName);
assert.equal(advisorA.name, 'Mike Quach');
assert.equal(advisorA.phone, '+49 170 5550199');
assert.equal(advisorA.email, 'mike.quach@autohaus-trinkle.de');
assert.equal(advisorA.initials, 'MQ');
assert.equal(advisorA.showCallAction, true);
assert.equal(advisorA.showEmailAction, true);

// B) Seller über ownerId, wenn ownerName fehlt
const withSellerOnly = {
  ...dealerLead,
  ownerId: 'lisa',
};
const advisorB = buildCustomerPortalAdvisorModel(withSellerOnly);
assert.equal(advisorB.name, 'Lisa');
assert.equal(advisorB.phone, '+49 160 1122334');

// C) Dealer-Fallback ohne Verkäufer
const dealerOnly = buildCustomerPortalAdvisorModel(dealerLead);
assert.equal(dealerOnly.name, 'Max Trinkle');
assert.equal(dealerOnly.dealerLabel, 'Autohaus Trinkle · Heilbronn');
assert.equal(dealerOnly.phone, '+49 7131 123456');
assert.equal(dealerOnly.email, 'verkauf@autohaus-trinkle.de');

// D) Telefon/E-Mail Priorität: Seller vor CRM vor Dealer
const withCrmOverride = {
  ...withOwnerName,
  crm: {
    advisorPhone: '+49 111 222333',
    advisorEmail: 'crm@example.de',
  },
};
const advisorD = buildCustomerPortalAdvisorModel(withCrmOverride);
assert.equal(advisorD.phone, '+49 170 5550199');
assert.equal(advisorD.email, 'mike.quach@autohaus-trinkle.de');

// E) Leere Kontaktfelder werden nicht als Aktion angezeigt
const noContact = buildCustomerPortalAdvisorModel({
  ...dealerLead,
  dealerId: null,
  ownerName: 'Nur Name',
});
assert.equal(noContact.showCallAction, false);
assert.equal(noContact.showEmailAction, false);
assert.equal(noContact.phone, null);
assert.equal(noContact.email, null);
assert.equal(noContact.showMessageAction, true);

// F) Nachrichten-Tab-Wechsel ist in der Portfolio-Seite verdrahtet
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTAL_NAV_IDS } from './customerPortalShellPresenter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const portfolioPage = readFileSync(
  join(__dirname, '../../pages/CustomerOfferPortfolioPage.jsx'),
  'utf8',
);
assert.match(portfolioPage, /onWriteMessage=\{\(\) => setActiveSection\(PORTAL_NAV_IDS\.MESSAGES\)\}/);

// G) Beim Kundenlink-Vorbereiten werden advisor-Daten ergänzt
const prepared = prepareCustomerPortalAccess(withOwnerName, {
  portfolioUrl: 'http://localhost/angebot/auswahl/anna?leadId=lead-advisor-1&token=abc',
  email: 'anna@example.de',
});
assert.ok(prepared.ok);
assert.equal(prepared.access.advisor?.name, 'Mike Quach');
assert.equal(prepared.access.advisor?.userId, 'mike-quach');
assert.equal(prepared.lead.crm.advisor?.name, 'Mike Quach');
assert.equal(prepared.lead.crm.advisorPhone, '+49 170 5550199');

const merged = mergeAdvisorSnapshot(
  { userId: 'lisa', name: 'Lisa', phone: '+49 160 1122334' },
  { userId: 'mike-quach', name: 'Mike Quach', phone: '+49 170 5550199' },
);
assert.equal(merged.name, 'Lisa');
assert.equal(merged.phone, '+49 160 1122334');

const filled = mergeAdvisorSnapshot(
  { userId: 'mike-quach', name: 'Mike Quach' },
  { userId: 'mike-quach', phone: '+49 170 5550199', email: 'mike@example.de' },
);
assert.equal(filled.phone, '+49 170 5550199');
assert.equal(filled.email, 'mike@example.de');

const hint = buildPortalAdvisorHintFromLead(withOwnerName);
assert.equal(hint.name, 'Mike Quach');
assert.ok(hint.dealerLabel?.includes('Autohaus Trinkle'));

console.log('customerPortalAdvisorService.test.js: ok');
