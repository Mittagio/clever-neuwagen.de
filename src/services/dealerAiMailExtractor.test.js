/**
 * Tests: Mail-Extraktion für Verkaufsassistent (Weiterleitungen Outlook/Gmail/Apple)
 */
import assert from 'node:assert/strict';
import { parseDealerAiInput, parseCustomerPhone } from './dealerAiParser.js';
import {
  cleanMailHtmlArtifacts,
  enrichFieldsFromCustomerMail,
  inferDeliveryBeforeLeasingEnd,
  parseDesiredDeliveryFromMail,
  parseForwardBlock,
  parseLeasingEndFromMail,
  parseOnBehalfOf,
  parseSubjectVehicleHints,
  parseUrgentDeliveryNeed,
  preprocessCustomerMail,
  splitCustomerName,
} from './dealerAiMailExtractor.js';

assert.deepEqual(splitCustomerName('Michael Kübler'), {
  salutation: null,
  firstName: 'Michael',
  lastName: 'Kübler',
  fullName: 'Michael Kübler',
});

assert.equal(parseLeasingEndFromMail('Leasing läuft im November aus'), 'November');
assert.equal(inferDeliveryBeforeLeasingEnd('November'), 'vor November');
assert.equal(parseDesiredDeliveryFromMail('Fahrzeug wird im August benötigt'), 'August');
assert.ok(parseUrgentDeliveryNeed('so schnell wie möglich'));
assert.equal(parseDesiredDeliveryFromMail('so schnell wie möglich'), 'sofort');

const htmlCleaned = cleanMailHtmlArtifacts('Kia&nbsp;EV4<br>Leasing 48 Monate');
assert.equal(htmlCleaned, 'Kia EV4\nLeasing 48 Monate');

const subjectHints = parseSubjectVehicleHints('KIA EV4 81kWh EARTH - Bitte um ein Angebot');
assert.equal(subjectHints.modelId, 'ev4');
assert.equal(subjectHints.trimLabel, 'Earth');
assert.equal(subjectHints.batteryKwh, 81);

// Outlook Deutsch Weiterleitung
const outlookForward = [
  'FYI – Kundenanfrage',
  '',
  '-----Ursprüngliche Nachricht-----',
  'Von: Michael Kübler <emerka@icloud.com>',
  'Gesendet: Montag, 12. Mai 2025 10:23',
  'An: vertrieb@autohaus-trinkle.de',
  'Betreff: KIA EV4 81kWh EARTH - Bitte um ein Angebot',
  '',
  'Guten Tag,',
  'ich interessiere mich für Leasing 48 Monate, 15.000 km, Budget bis 790 €.',
  'Leasing läuft im November aus.',
  '',
  'Mit freundlichen Grüßen',
  'Michael Kübler',
  '0173 1855152',
  '',
  'Impressum: Autohaus Trinkle GmbH',
  'Geschäftsführer: Max Mustermann',
].join('\n');

const outlookCtx = preprocessCustomerMail(outlookForward);
assert.ok(outlookCtx.isForwarded);
assert.equal(outlookCtx.customerName, 'Michael Kübler');
assert.equal(outlookCtx.customerEmail, 'emerka@icloud.com');
assert.equal(outlookCtx.subject, 'KIA EV4 81kWh EARTH - Bitte um ein Angebot');
assert.match(outlookCtx.inquiryText, /Leasing 48 Monate/);
assert.doesNotMatch(outlookCtx.inquiryText, /Impressum/);
assert.doesNotMatch(outlookCtx.inquiryText, /Ursprüngliche Nachricht/);

const outlookParsed = parseDealerAiInput(outlookForward);
assert.equal(outlookParsed.fields.customerFirstName, 'Michael');
assert.equal(outlookParsed.fields.customerEmail, 'emerka@icloud.com');
assert.equal(outlookParsed.fields.customerPhone, '0173 1855152');
assert.equal(outlookParsed.fields.modelId, 'ev4');
assert.equal(outlookParsed.fields.trimLabel, 'Earth');
assert.equal(outlookParsed.fields.desiredRate, 790);
assert.notEqual(outlookParsed.fields.customerEmail, 'vertrieb@autohaus-trinkle.de');

// Gmail Forward
const gmailForward = [
  '---------- Forwarded message ---------',
  'From: Anna Schmidt <anna.schmidt@gmail.com>',
  'Date: Wed, 5 Jun 2025 09:12:00 +0200',
  'Subject: EV3 Earth Leasing',
  'To: sales@autohaus-trinkle.de',
  '',
  'Hallo, bitte Angebot für EV3 Earth, 48 Monate, 15.000 km.',
  '',
  'Viele Grüße',
  'Anna Schmidt',
  '0151 99887766',
].join('\n');

const gmailCtx = preprocessCustomerMail(gmailForward);
assert.equal(gmailCtx.customerName, 'Anna Schmidt');
assert.equal(gmailCtx.customerEmail, 'anna.schmidt@gmail.com');
const gmailParsed = parseDealerAiInput(gmailForward);
assert.equal(gmailParsed.fields.modelId, 'ev3');
assert.equal(gmailParsed.fields.trimLabel, 'Earth');

// Apple Mail Forward
const appleForward = [
  'Anfang der weitergeleiteten Nachricht:',
  '',
  'Von: Thomas Weber <t.weber@web.de>',
  'Datum: 4. Juni 2025 um 14:30:00 MESZ',
  'Betreff: Sportage Anfrage',
  'An: info@autohaus-trinkle.de',
  '',
  'Sportage Vision Hybrid, Finanzierung 48 Monate.',
].join('\n');

const appleCtx = preprocessCustomerMail(appleForward);
assert.equal(appleCtx.customerName, 'Thomas Weber');
assert.equal(appleCtx.customerEmail, 't.weber@web.de');

// Signatur mit Telefon – Impressum ignorieren
const sigMail = [
  'Guten Tag, EV4 Earth bitte.',
  '',
  'Mit freundlichen Grüßen',
  'Michael Kübler',
  '0173 1855152',
  'emerka@icloud.com',
  '',
  'Diese E-Mail enthält vertrauliche Informationen.',
  'Amtsgericht Stuttgart · USt-IdNr. DE123456789',
].join('\n');

const sigCtx = preprocessCustomerMail(sigMail);
assert.match(sigCtx.inquiryText, /EV4 Earth/);
assert.doesNotMatch(sigCtx.inquiryText, /Amtsgericht/);
assert.equal(parseCustomerPhone(`${sigCtx.inquiryText}\n${sigCtx.signatureBlock}`), '0173 1855152');

// Alte Mailverläufe erzeugen keine doppelten Fahrzeugwünsche
const threadMail = [
  '-----Ursprüngliche Nachricht-----',
  'Von: Michael Kübler <emerka@icloud.com>',
  'Gesendet: Montag, 12. Mai 2025',
  'An: vertrieb@autohaus-trinkle.de',
  'Betreff: EV4 Anfrage',
  '',
  'Bitte Angebot für Kia EV4 Earth 81 kWh, Leasing 48 Monate.',
  '',
  'Am Montag, 10. März 2025 schrieb Max Verkäufer:',
  'Hier nochmal der alte Sportage Spirit Vorschlag mit 399 € Rate.',
].join('\n');

const threadParsed = parseDealerAiInput(threadMail);
assert.equal(threadParsed.fields.modelId, 'ev4');
assert.notEqual(threadParsed.fields.modelId, 'sportage');

// Im Auftrag von Bruder
const behalfMail = [
  '-----Ursprüngliche Nachricht-----',
  'Von: Michael Kübler <emerka@icloud.com>',
  'Betreff: Anfrage',
  '',
  'Ich schreibe im Auftrag meines Bruders Andreas Kübler.',
  'EV4 Earth, Leasing 48 Monate.',
].join('\n');

const behalfCtx = preprocessCustomerMail(behalfMail);
assert.equal(behalfCtx.customerName, 'Michael Kübler');
assert.equal(behalfCtx.onBehalfOf, 'Andreas Kübler');
assert.equal(behalfCtx.customerMailNote, 'Sucht im Auftrag von Andreas Kübler.');

const behalfParsed = parseDealerAiInput(behalfMail);
assert.equal(behalfParsed.fields.customerName, 'Michael Kübler');
assert.equal(behalfParsed.fields.customerMailNote, 'Sucht im Auftrag von Andreas Kübler.');

// Direkte Mail ohne Weiterleitung (Regression)
const directMail = [
  'Guten Tag,',
  'Kia EV4 Earth 81 kWh, Leasing, 48 Monate, 15.000 km, Budget bis 790 €.',
  'Leasing läuft im November aus, Fahrzeugwechsel geplant.',
  'Bitte Anhängerkupplung und Winterräder separat anbieten.',
  '',
  'Mit freundlichen Grüßen',
  'Michael Kübler',
  '0173 1855152',
  'emerka@icloud.com',
].join('\n');

const directEnriched = enrichFieldsFromCustomerMail(directMail, {});
assert.equal(directEnriched.customerFirstName, 'Michael');
assert.equal(directEnriched.customerEmail, 'emerka@icloud.com');
assert.equal(directEnriched.leasingEndDate, 'November');
assert.ok(directEnriched.extrasFromMail.ahk);

const forwardBlock = parseForwardBlock(outlookForward);
assert.equal(forwardBlock.fromName, 'Michael Kübler');
assert.equal(forwardBlock.fromEmail, 'emerka@icloud.com');
assert.equal(forwardBlock.subject, 'KIA EV4 81kWh EARTH - Bitte um ein Angebot');

console.log('dealerAiMailExtractor tests OK');
