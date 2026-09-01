/**
 * Notizzettel in der Kundenakte – Chips statt Kategorie-Kacheln
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildKundenwissenOverview,
  countKundenwissenItems,
  buildUnterlagenKundenwissenItems,
} from '../../services/kundenwissenCategories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const followUpSource = readFileSync(
  join(__dirname, 'DealerAiLeadFollowUp.jsx'),
  'utf8',
);

const notes = [
  'Kaffee mit Milch',
  'Preis sehr wichtig',
  'mag dunkle Autos',
  'Inzahlungnahme vorhanden',
  'Hund',
  '2 Kinder',
  'bevorzugt WhatsApp',
].join(', ');

const overview = buildKundenwissenOverview(notes);
assert.ok(overview.length >= 4, 'Kategorien für Sheet/Fallback');
assert.ok(!overview.some((cat) => cat.label === 'Kaffee mit Milch'));
assert.equal(countKundenwissenItems(notes), 7);

const withoutSlots = buildKundenwissenOverview(notes, null, {}, { includeUnterlagen: false });
assert.ok(!withoutSlots.some((cat) => cat.items.some((i) => i.fromUnterlagen)));

const khSource = readFileSync(
  join(__dirname, 'CustomerAkteKundenhelfer.jsx'),
  'utf8',
);
assert.ok(khSource.includes('Notizzettel'), 'Profil zeigt Notizzettel');
assert.ok(khSource.includes('cust-akte-kw__chip'), 'Wunsch-Chips');
assert.ok(khSource.includes('buildAttributedWishChips'), 'Attributed Chips');
assert.ok(khSource.includes('filterNotepadChipsExcludingKonditionen'), 'Konditionen nicht doppelt am Notizzettel');
assert.ok(khSource.includes('CustomerAkteNotepadCapture'), 'Memo/Scan am Notizzettel');
assert.ok(!khSource.includes('cust-akte-kw__cat'), 'keine Kategorie-Kacheln mehr im Profil');

assert.ok(
  followUpSource.includes("from './CustomerAkteKundenhelfer.jsx'")
  || followUpSource.includes('openKundenhelferSheet'),
  'Kundenhelfer ist in der Kundenakte verdrahtet',
);
assert.ok(
  followUpSource.includes('openKundenhelferSheet'),
  'Follow-up öffnet Kundenhelfer',
);
assert.ok(
  followUpSource.includes('CleverKundenhelferSheet')
  || followUpSource.includes('onCaptureCommit'),
  'Follow-up verdrahtet Memo/Scan bzw. Kundenhelfer-Sheet',
);

const empfiehltSource = readFileSync(
  join(__dirname, 'CleverEmpfiehltCard.jsx'),
  'utf8',
);
assert.ok(
  empfiehltSource.includes('Angebotsdetails')
  || empfiehltSource.includes('detailsLinkLabel'),
  'Stage: Angebotsdetails-Link',
);
assert.ok(empfiehltSource.includes('Letzte Aktivitäten'), 'Stage: Aktivitäten-Strip');
assert.ok(empfiehltSource.includes('Alle Aktivitäten'), 'Timeline: Alle Aktivitäten');
assert.ok(empfiehltSource.includes('clever-empfiehlt--stage'), 'Stage-Klasse');
assert.ok(empfiehltSource.includes('clever-empfiehlt--hierarchy'), 'Hierarchy-Klasse');
assert.ok(empfiehltSource.includes('clever-empfiehlt__stage'), 'Eine Stage-Karte');
assert.ok(empfiehltSource.includes('clever-empfiehlt__work'), 'Ein Arbeitsblock');
assert.ok(empfiehltSource.includes('clever-empfiehlt__next'), 'Next-Step-Block');
assert.ok(empfiehltSource.includes('clever-empfiehlt__recommend-label'), 'Ruhiges Clever-empfiehlt-Label');
assert.ok(empfiehltSource.includes('clever-empfiehlt__secondary-link'), 'Max. 1 sekundärer Link');
assert.ok(empfiehltSource.includes('clever-empfiehlt__media'), 'Stage: Fahrzeugbild-Region');
assert.ok(empfiehltSource.includes('clever-empfiehlt-activities'), 'Aktivitäten-Zeile unter Stage');
assert.ok(empfiehltSource.includes('activities--timeline'), 'Aktivitäten als Timeline');
assert.ok(empfiehltSource.includes('slice(0, 3)'), 'Timeline max. 3 Aktivitäten');
assert.ok(empfiehltSource.includes('IconSparkle'), 'Primary CTA mit Sparkles');
assert.ok(empfiehltSource.includes('IconPaperPlane'), 'Send-CTA mit Paper-Plane');
assert.ok(empfiehltSource.includes('title={reasonTitle}'), 'reasonSource als Button-Tooltip');
assert.ok(empfiehltSource.includes('nextStep'), 'nextStep Surface verdrahtet');
assert.ok(!empfiehltSource.includes('Nächster Schritt'), 'Kein Nächster-Schritt-Eyebrow');
assert.ok(!empfiehltSource.includes('Dein digitaler Verkaufsassistent'), 'Keine Trust-Zeile');
assert.ok(!empfiehltSource.includes('clever-empfiehlt__subline'), 'Keine sichtbare Subline');
assert.ok(!empfiehltSource.includes('clever-empfiehlt__card--recommend'), 'Keine getrennten Glob-Karten');
assert.ok(!empfiehltSource.includes('clever-empfiehlt__col--recommend'), 'Keine 3-Spalten-Chrome');
assert.ok(!empfiehltSource.includes('activity-avatar'), 'Keine Aktivitäts-Avatare');
assert.ok(!empfiehltSource.includes('clever-empfiehlt-availability'), 'Kein Verfügbar-Badge');

const kundenbildSource = readFileSync(
  join(__dirname, 'CustomerAkteKundenbild.jsx'),
  'utf8',
);
assert.ok(
  kundenbildSource.includes('ariaLabel="Konditionen bearbeiten"'),
  'Konditionen-Edit aria-label',
);
assert.ok(
  !kundenbildSource.includes('ariaLabel="Kundenwissen bearbeiten"'),
  'Kein Kundenwissen-Stift über den Buckets',
);
assert.ok(!/>\s*Konditionen bearbeiten\s*</.test(kundenbildSource), 'Kein sichtbarer Konditionen-Text');
assert.ok(kundenbildSource.includes('Alles anzeigen'), 'Alles-anzeigen-Link');
assert.ok(kundenbildSource.includes('Bearbeiten'), 'Bearbeiten-Link wenn leer');
assert.ok(kundenbildSource.includes('+ Wissen ergänzen'), 'Wissen ergänzen statt Chip-Picker');
assert.ok(!kundenbildSource.includes('GroupCategoryIcon'), 'Keine Soft-Kategorie-Icons');
assert.ok(!kundenbildSource.includes('SoftKnowledgeGroup'), 'Keine Soft-Bucket-Boxen');
assert.ok(kundenbildSource.includes('title={ariaLabel}'), 'Edit-Links mit Hover-Tooltip');
assert.ok(!kundenbildSource.includes('cust-kundenbild__soft-footer'), 'Kein Footer-Zähler');
assert.ok(!kundenbildSource.includes('cust-kundenbild__kern-title'), 'Kein Konditionen-Eyebrow');
assert.ok(kundenbildSource.includes('cust-kundenbild__title'), 'Kundenwissen-Titel bleibt sichtbar');
assert.ok(kundenbildSource.includes('SoftKnowledgeEmptyState'), 'Leerer Soft-Zustand');
assert.ok(!kundenbildSource.includes('contactChips'), 'Kein Kontakt in Kundenwissen');
assert.ok(kundenbildSource.includes('IconPencil'), 'Konditionen-Stift bleibt');
assert.ok(kundenbildSource.includes('cust-kundenbild__kern-row'), 'Konditionen Chip-Zeile mit Stift');
assert.ok(kundenbildSource.includes('leanHeaderActive'), 'Lean-Header steuert Hierarchy-Styling');
assert.ok(!kundenbildSource.includes('cust-kundenbild__kern--lean'), 'Kern-Chips nicht durch Lean-Header geleert');
assert.ok(kundenbildSource.includes('cust-kundenbild--hierarchy'), 'Hierarchy-Band-Klasse');
assert.ok(kundenbildSource.includes('cust-kundenbild__soft-row'), 'Kundenwissen kompakte Aktionszeile');
assert.ok(kundenbildSource.includes('cust-kundenbild__soft-link'), 'Ruhiger Alles-anzeigen-Link');
assert.ok(kundenbildSource.includes('cust-kundenbild__summary-chips'), 'Summary-Chips light');
assert.ok(kundenbildSource.includes('SummaryChipLight'), 'SummaryChipLight-Komponente');
assert.ok(kundenbildSource.includes('SoftTopicLine'), 'Themenzeilen im Panel');
assert.ok(kundenbildSource.includes('ProvenanceFact'), 'Provenance auf Fakten');
assert.ok(kundenbildSource.includes('showProvenanceMeta'), 'Provenance im Expanded-Detail');
assert.ok(!kundenbildSource.includes('LONG_PRESS_MS'), 'Kein Long-Press in Summary');
assert.ok(
  !kundenbildSource.includes('is-empty-scaffold'),
  'Kein leeres Soft-Gerüst',
);
assert.ok(
  kundenbildSource.includes('cust-kundenbild__soft-row-spacer')
  || kundenbildSource.includes('head-actions'),
  'Link-Anker in Soft-Zeile',
);
const kundenbildCss = readFileSync(
  join(__dirname, 'CustomerAkteKundenbild.css'),
  'utf8',
);
assert.ok(
  kundenbildCss.includes('margin-left: auto'),
  'Link fest rechts (margin-left auto)',
);
assert.ok(
  !kundenbildSource.includes('Person & Alltag'),
  'Alte Taxonomie Person & Alltag entfernt',
);
assert.ok(
  !kundenbildSource.includes('Mensch & Alltag'),
  'Alte Taxonomie Mensch & Alltag entfernt',
);
assert.ok(
  kundenbildSource.includes('SOFT_SNAPSHOT_GROUP.PERSOENLICHES'),
  'Taxonomie Persönliches verdrahtet (Fallback Merken)',
);
assert.ok(
  kundenbildSource.includes('buildSoftPanelTopics'),
  'Panel-Topics verdrahtet',
);

const headerSource = readFileSync(
  join(__dirname, 'CustomerAkteCompactHeader.jsx'),
  'utf8',
);
assert.ok(!/>\s*Kundenakte öffnen\s*</.test(headerSource), 'Kein CTA Kundenakte öffnen in der Akte');
assert.ok(!headerSource.includes('IconFolder'), 'Kein Ordner-CTA im Akte-Header');
assert.ok(headerSource.includes('Telefon fehlt'), 'Telefon-fehlt-Hint bleibt');
assert.ok(headerSource.includes('onOpenProfile'), 'Identity öffnet Kundendaten-Sheet');
assert.ok(
  !headerSource.includes('cust-akte-compact-header__cta'),
  'Keine CTA-Button-Klasse im Akte-Header',
);

const followUpStage = readFileSync(
  join(__dirname, 'DealerAiLeadFollowUp.jsx'),
  'utf8',
);
assert.ok(followUpStage.includes('onOpenOfferDetails'), 'Stage Details verdrahtet');
assert.ok(followUpStage.includes('onSendToCustomer'), 'Stage Senden verdrahtet');
assert.ok(followUpStage.includes('onEditConditions'), 'Konditionen-Sheet verdrahtet');
assert.ok(followUpStage.includes('recentActivities'), 'Aktivitäten an Stage');
assert.ok(followUpStage.includes('buildAkteLeanContextLine'), 'Lean Header-Kontextzeile');
assert.ok(followUpStage.includes('leanHeaderActive'), 'Kundenbild Hierarchy-Styling');
assert.ok(
  /buildAkteLeanContextLine\(\{\s*vehicleLabel\s*\}\)/.test(followUpStage),
  'Header-Kontext nur Fahrzeug/Modell',
);
assert.ok(
  !/return buildAkteLeanContextLine\(\{[^}]*paymentType/.test(followUpStage),
  'Header bekommt keine payment/term/km/AZ',
);
assert.ok(
  /kundenbildExpanded,\s*setKundenbildExpanded\]\s*=\s*useState\(false\)/.test(followUpStage),
  'Kundenwissen startet collapsed (Summary-Chips light sichtbar)',
);

assert.ok(typeof buildUnterlagenKundenwissenItems === 'function');

console.log('CustomerAkteKundenhelfer.test.js: ok');
