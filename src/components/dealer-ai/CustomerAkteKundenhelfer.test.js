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
assert.ok(empfiehltSource.includes('Angebotsdetails anzeigen'), 'Stage: Angebotsdetails-Link');
assert.ok(empfiehltSource.includes('Letzte Aktivitäten'), 'Stage: Aktivitäten-Strip');
assert.ok(empfiehltSource.includes('clever-empfiehlt--stage'), 'Stage-Klasse');
assert.ok(empfiehltSource.includes('clever-empfiehlt__stage'), 'Eine Stage-Karte');
assert.ok(empfiehltSource.includes('clever-empfiehlt__col--recommend'), 'Empfehlungs-Spalte');
assert.ok(empfiehltSource.includes('clever-empfiehlt__col--offer'), 'Angebots-Spalte');
assert.ok(empfiehltSource.includes('clever-empfiehlt__col--next'), 'Nächster-Schritt-Spalte');
assert.ok(empfiehltSource.includes('clever-empfiehlt__media'), 'Stage: Fahrzeugbild-Region');
assert.ok(empfiehltSource.includes('clever-empfiehlt-activities'), 'Aktivitäten-Zeile unter Stage');
assert.ok(empfiehltSource.includes('clever-empfiehlt__activity-avatar'), 'Aktivitäts-Avatare');
assert.ok(empfiehltSource.includes('clever-empfiehlt-availability'), 'Verfügbar-Badge Region');
assert.ok(empfiehltSource.includes('IconSparkle'), 'Primary CTA mit Sparkles');
assert.ok(empfiehltSource.includes('IconPaperPlane'), 'Send-CTA mit Paper-Plane');
assert.ok(empfiehltSource.includes('title={primaryHelp}'), 'Erklärung als Button-Tooltip');
assert.ok(empfiehltSource.includes('isHeadlineRedundantWithCta'), 'Doppel-Headline wird unterdrückt');
assert.ok(!empfiehltSource.includes('Clever empfiehlt'), 'Kein Clever-empfiehlt-Eyebrow');
assert.ok(!empfiehltSource.includes('Nächster Schritt'), 'Kein Nächster-Schritt-Eyebrow');
assert.ok(!empfiehltSource.includes('Dein digitaler Verkaufsassistent'), 'Keine Trust-Zeile');
assert.ok(!empfiehltSource.includes('clever-empfiehlt__subline'), 'Keine sichtbare Subline');
assert.ok(!empfiehltSource.includes('clever-empfiehlt__card--recommend'), 'Keine getrennten Glob-Karten');

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
assert.ok(!/>\s*Bearbeiten\s*</.test(kundenbildSource), 'Kein sichtbares Bearbeiten');
assert.ok(!kundenbildSource.includes('IconChevronRight'), 'Kein Edit-Chevron am Textlink');
assert.ok(kundenbildSource.includes('GroupCategoryIcon'), 'Kundenwissen Kategorie-Icons');
assert.ok(kundenbildSource.includes('title={ariaLabel}'), 'Edit-Links mit Hover-Tooltip');
assert.ok(!kundenbildSource.includes('cust-kundenbild__soft-footer'), 'Kein Footer-Zähler');
assert.ok(!kundenbildSource.includes('cust-kundenbild__kern-title'), 'Kein Konditionen-Eyebrow');
assert.ok(!kundenbildSource.includes('cust-kundenbild__title'), 'Kein Kundenwissen-Eyebrow');
assert.ok(kundenbildSource.includes('IconPencil'), 'Konditionen-Stift bleibt');
assert.ok(kundenbildSource.includes('cust-kundenbild__kern-row'), 'Konditionen Chip-Zeile mit Stift');
assert.ok(kundenbildSource.includes('cust-kundenbild__soft-row'), 'Kundenwissen kompakte Aktionszeile');
assert.ok(kundenbildSource.includes('cust-kundenbild__chevron-btn'), 'Kundenwissen Collapse-Chevron');
assert.ok(
  kundenbildSource.includes('if (!facts.length) return null'),
  'Leere Soft-Buckets ausgeblendet',
);
assert.ok(
  kundenbildSource.includes('cust-kundenbild__soft-row-spacer')
  || kundenbildSource.includes('head-actions'),
  'Chevron-Anker in Soft-Zeile',
);
const kundenbildCss = readFileSync(
  join(__dirname, 'CustomerAkteKundenbild.css'),
  'utf8',
);
assert.ok(
  kundenbildCss.includes('margin-left: auto'),
  'Chevron fest rechts (margin-left auto)',
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
  'Neue Taxonomie Persönliches verdrahtet',
);
assert.ok(
  kundenbildSource.includes('SOFT_SNAPSHOT_GROUP.SONSTIGES'),
  'Neue Taxonomie Sonstiges verdrahtet',
);
assert.ok(
  kundenbildSource.includes('GROUP_CHIP_VISIBLE_MAX'),
  'Bucket-Chip-Limit +N',
);

const headerSource = readFileSync(
  join(__dirname, 'CustomerAkteCompactHeader.jsx'),
  'utf8',
);
assert.ok(headerSource.includes('Kundenakte öffnen'), 'Header CTA Kundenakte öffnen');
assert.ok(headerSource.includes('IconFolder'), 'Header CTA mit Ordner-Icon');

const followUpStage = readFileSync(
  join(__dirname, 'DealerAiLeadFollowUp.jsx'),
  'utf8',
);
assert.ok(followUpStage.includes('onOpenOfferDetails'), 'Stage Details verdrahtet');
assert.ok(followUpStage.includes('onSendToCustomer'), 'Stage Senden verdrahtet');
assert.ok(followUpStage.includes('onEditConditions'), 'Konditionen-Sheet verdrahtet');
assert.ok(followUpStage.includes('recentActivities'), 'Aktivitäten an Stage');

assert.ok(typeof buildUnterlagenKundenwissenItems === 'function');

console.log('CustomerAkteKundenhelfer.test.js: ok');
