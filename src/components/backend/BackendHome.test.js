import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(join(__dirname, 'BackendHome.jsx'), 'utf8');
const tilesSource = readFileSync(join(__dirname, 'BackendMainTiles.jsx'), 'utf8');
const sellSource = readFileSync(join(__dirname, 'BackendVerkaufenHub.jsx'), 'utf8');
const heroSource = readFileSync(join(__dirname, 'BackendAdvisorHero.jsx'), 'utf8');
const headerSource = readFileSync(join(__dirname, '../layout/Header.jsx'), 'utf8');
const backendPageSource = readFileSync(join(__dirname, '../../pages/BackendPage.jsx'), 'utf8');
const composerSource = readFileSync(join(__dirname, '../clever/CleverGlobalComposer.jsx'), 'utf8');
const todaySource = readFileSync(join(__dirname, 'CleverEmpfiehltToday.jsx'), 'utf8');

assert.ok(tilesSource.includes('Clever Eingang'), 'Kachel Clever Eingang');
assert.ok(tilesSource.includes('Fahrzeugverwaltung'), 'Kachel Fahrzeugverwaltung');
assert.ok(tilesSource.includes('Inseratsgenerator'), 'Kachel Inseratsgenerator');
assert.ok(!tilesSource.includes("title: 'Verkaufen'"), 'Keine Verkaufen-Kachel – Einstieg über Composer');
assert.ok(!tilesSource.includes("title: 'Verwaltung'"), 'Keine Verwaltungs-Kachel');
assert.ok(tilesSource.indexOf('Clever Eingang') < tilesSource.indexOf('Fahrzeugverwaltung'), 'Clever Eingang links');
assert.ok(tilesSource.indexOf('Inseratsgenerator') > tilesSource.indexOf('Fahrzeugverwaltung'), 'Inseratsgenerator nach Fahrzeuge');
assert.ok(tilesSource.includes('ungelesen'), 'Eingang-Counts: ungelesen');
assert.ok(tilesSource.includes('offene Vorgänge'), 'Eingang-Counts: offene Vorgänge');
assert.ok(tilesSource.includes('IconInbox') || tilesSource.includes('IconCar'), 'Line-Icons statt Emoji');
assert.ok(!tilesSource.includes("icon: '📥'"), 'Kein Emoji-Icon für Clever Eingang');

assert.ok(sellSource.includes('Showroom Modus'), 'Verkaufen-Hub bleibt Deep-Link (Showroom)');
assert.ok(sellSource.includes('Modell wählen'), 'Verkaufen-Hub bleibt Deep-Link (Modell)');
assert.ok(sellSource.includes('Clever-Lexikon'), 'Verkaufen-Hub bleibt Deep-Link (Lexikon)');
assert.ok(sellSource.includes('Clever Beratung'), 'Verkaufen-Hub bleibt Deep-Link (Beratung)');
assert.ok(!homeSource.includes('Showroom Modus'), 'Showroom nicht auf Dashboard');
assert.ok(!homeSource.includes('Clever-Lexikon'), 'Lexikon nicht auf Dashboard');

assert.ok(composerSource.includes("label: 'Showroom starten'"), 'Composer-Chip Showroom');
assert.ok(composerSource.includes("label: 'Modellwelt öffnen'"), 'Composer-Chip Modellwelt');
assert.ok(!composerSource.includes("label: 'Modell auswählen'"), 'Kein Chip Modell auswählen');
assert.ok(!composerSource.includes("label: 'Neue Anfrage'"), 'Keine Chip Neue Anfrage');
assert.ok(composerSource.includes('Anfrage einfügen'), 'Plus-Menü Anfrage einfügen');
assert.ok(composerSource.includes("/verkaufsassistent?view=showroom"), 'Showroom-Workspace-Pfad');
assert.ok(composerSource.includes("/verkaufsassistent?view=model"), 'Modell-Workspace-Pfad');
assert.ok(composerSource.includes('createPortal'), 'Ein Composer, Hero via Portal');
assert.ok(composerSource.includes('resolveComposerSurfaceState'), 'Idle/Expanded State');
assert.ok(composerSource.includes('resolveComposerDockMode'), 'Hero/Dock Mode');
assert.ok(composerSource.includes('data-composer-instance="global"'), 'Eine Composer-Instanz');
assert.ok(composerSource.includes('DealerAiInlineMic'), 'Voice im Dock/Hero');
assert.ok(composerSource.includes('hideSuggestionChips'), 'Keine Suggestion-Chips im Dock');
assert.ok(composerSource.includes('COMPOSER_INTENT_CHIPS'), 'Optional Intent-Chips im Global Composer');
assert.ok(composerSource.includes('intentConstraint'), 'intentConstraint an Seller-Turn');
assert.ok(!composerSource.includes('COMPOSER_LEITFRAGE'), 'Keine Clever-Überschrift im Dock');
assert.ok(
  composerSource.includes("reviewType === 'customer_intake_review'")
  && composerSource.includes("reviewType === 'inbound_lead_review'"),
  'Accept akzeptiert customer_intake_review + Alias',
);

const composerCss = readFileSync(join(__dirname, '../clever/CleverGlobalComposer.css'), 'utf8');
assert.ok(composerCss.includes('--docked-composer-spacer') || composerCss.includes('docked-composer'), 'Spacer bei Dock');
assert.ok(composerCss.includes('max-height: 76px') || composerCss.includes('76px'), 'Dock-Idle Desktop-Höhe');
assert.ok(composerCss.includes('88px'), 'Dock-Idle Mobile-Höhe');
assert.ok(composerCss.includes('220ms') || composerCss.includes('180ms'), 'Subtile Hero↔Dock Animation');

assert.ok(!todaySource.includes('starLabel'), 'Keine Sterne in Clever empfiehlt heute');
assert.ok(!todaySource.includes('closureChance'), 'Keine Prozentwerte in Clever empfiehlt heute');
assert.ok(todaySource.includes('ctaLabel') || todaySource.includes('cta'), 'Klare CTA');

assert.ok(headerSource.includes('header-settings'), 'Header Zahnrad');
assert.ok(headerSource.includes('/backend/verwaltung'), 'Zahnrad öffnet Verwaltung');
assert.ok(backendPageSource.includes('BackendVerkaufenHub'), 'Backend bindet Verkaufen-Hub ein (Deep-Link)');

assert.ok(!homeSource.includes('BackendAdvisorHero'), 'Kein paralleler Clever-Beratung-Hero auf Dashboard');
assert.ok(homeSource.includes('CleverEmpfiehltToday'), 'Clever empfiehlt heute auf Dashboard');
assert.ok(!homeSource.includes('BackendCustomerSearch'), 'Keine Kundensuche-Karte auf Dashboard');
assert.ok(!homeSource.includes('Kundenakte finden'), 'Keine Kundenakte-finden-Sektion auf Dashboard');
assert.ok(homeSource.includes('Guten Tag'), 'Begrüßung oben');
assert.ok(homeSource.includes('composer-hero-slot') || homeSource.includes('composerSlotRef'), 'Composer-Hero-Slot');
assert.ok(homeSource.includes('buildDashboardTodayRecommendations'), 'Empfehlungen ohne Score-Engine');
assert.ok(heroSource.includes('Clever Beratung'), 'Advisor-Hero-Komponente bleibt für Verkaufen-Pfad');

const renderBlock = homeSource.slice(homeSource.indexOf('return ('));
assert.ok(
  renderBlock.indexOf('backend-home__greeting') < renderBlock.indexOf('composerSlotRef')
  && renderBlock.indexOf('composerSlotRef') < renderBlock.indexOf('<BackendMainTiles')
  && renderBlock.indexOf('<BackendMainTiles') < renderBlock.indexOf('<CleverEmpfiehltToday'),
  'Reihenfolge: Greeting → Composer-Slot → Kacheln → Clever heute',
);

console.log('BackendHome.test.js: ok');
