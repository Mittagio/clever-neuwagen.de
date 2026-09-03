import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildBackendHomeWorkStats,
  formatCleverEingangHomeStats,
} from '../../logic/backendHomeStats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(join(__dirname, 'BackendHome.jsx'), 'utf8');
const widgetsSource = readFileSync(join(__dirname, 'BackendHomeWidgets.jsx'), 'utf8');
const toolsSource = readFileSync(join(__dirname, 'BackendHomeTools.jsx'), 'utf8');
const sellSource = readFileSync(join(__dirname, 'BackendVerkaufenHub.jsx'), 'utf8');
const heroSource = readFileSync(join(__dirname, 'BackendAdvisorHero.jsx'), 'utf8');
const headerSource = readFileSync(join(__dirname, '../layout/Header.jsx'), 'utf8');
const backendPageSource = readFileSync(join(__dirname, '../../pages/BackendPage.jsx'), 'utf8');
const composerSource = readFileSync(join(__dirname, '../clever/CleverGlobalComposer.jsx'), 'utf8');
const todaySource = readFileSync(join(__dirname, 'CleverEmpfiehltToday.jsx'), 'utf8');
const surfaceSource = readFileSync(
  join(__dirname, '../../services/cleverSeller/composerSurfaceState.js'),
  'utf8',
);

assert.ok(widgetsSource.includes('Clever Eingang'), 'Widget Clever Eingang');
assert.ok(widgetsSource.includes('Meine Arbeit'), 'Widget Meine Arbeit');
assert.ok(widgetsSource.includes('Zum Eingang'), 'Link Zum Eingang');
assert.ok(widgetsSource.includes('Meine Übersicht'), 'Link Meine Übersicht');
assert.ok(widgetsSource.includes('CleverEmpfiehltToday'), 'Empfiehlt im Widgets-Row');
assert.ok(widgetsSource.includes('variant="home"'), 'Empfiehlt Home-Variante');

assert.ok(toolsSource.includes('Werkzeuge'), 'Sektion Werkzeuge');
assert.ok(toolsSource.includes('Fahrzeugverwaltung'), 'Tool Fahrzeugverwaltung');
assert.ok(toolsSource.includes('Inseratsgenerator'), 'Tool Inseratsgenerator');
assert.ok(toolsSource.includes('Showroom'), 'Tool Showroom');
assert.ok(toolsSource.includes('Modellwelt'), 'Tool Modellwelt');
assert.ok(toolsSource.includes("/verkaufsassistent?view=showroom"), 'Showroom-Route');
assert.ok(toolsSource.includes("/verkaufsassistent?view=model"), 'Modellwelt-Route');

assert.ok(sellSource.includes('Showroom Modus'), 'Verkaufen-Hub bleibt Deep-Link (Showroom)');
assert.ok(sellSource.includes('Modell wählen'), 'Verkaufen-Hub bleibt Deep-Link (Modell)');
assert.ok(sellSource.includes('Clever-Lexikon'), 'Verkaufen-Hub bleibt Deep-Link (Lexikon)');
assert.ok(sellSource.includes('Clever Beratung'), 'Verkaufen-Hub bleibt Deep-Link (Beratung)');
assert.ok(!homeSource.includes('Showroom Modus'), 'Showroom nicht als Composer-Chip auf Dashboard');
assert.ok(!homeSource.includes('Clever-Lexikon'), 'Lexikon nicht auf Dashboard');

assert.ok(composerSource.includes("label: 'Was liegt heute an?'"), 'Quick Action Heute');
assert.ok(composerSource.includes("label: 'Neue Anfrage'"), 'Quick Action Neue Anfrage');
assert.ok(composerSource.includes("label: 'Angebot vorbereiten'"), 'Quick Action Angebot');
assert.ok(!composerSource.includes("label: 'Showroom starten'"), 'Kein Showroom-Chip unter Composer');
assert.ok(!composerSource.includes("label: 'Modellwelt öffnen'"), 'Kein Modellwelt-Chip unter Composer');
assert.ok(composerSource.includes('Anfrage einfügen'), 'Plus-Menü Anfrage einfügen');
assert.ok(
  composerSource.includes('Anfrage hier einfügen und absenden'),
  'Anfrage einfügen führt zu Paste-Hinweis (kein No-Op)',
);
assert.ok(
  composerSource.includes('quietReviewFeedback')
  || composerSource.includes('isQuietIntakeReview'),
  'Intake ohne Clever-Narrations-Feedback',
);
assert.ok(!composerSource.includes('Clever wertet aus'), 'kein „Clever wertet aus“ im Composer');
assert.ok(!composerSource.includes('Clever hat eine Anfrage erkannt'), 'kein Erkannt-Hint unter Composer');
assert.ok(
  composerSource.includes('buildHomePrepareOfferComposerTask')
  || composerSource.includes('ANGEBOT VORBEREITEN'),
  'Angebot-Quick → Composer-Task',
);
assert.ok(!composerSource.includes("navigate('/backend/angebot-vorbereiten')"), 'Kein Queue-Jump als Erstschritt');
assert.ok(
  composerSource.includes("type: 'today_overview'")
  || composerSource.includes('applyDashboardComposerRequest'),
  'Heute-Quick → echter Today-Turn',
);
assert.ok(!composerSource.includes("setDraft('Was liegt heute an?')"), 'Heute nicht nur Draft');
assert.ok(composerSource.includes('createPortal'), 'Ein Composer, Hero via Portal');
assert.ok(composerSource.includes('resolveComposerSurfaceState'), 'Idle/Expanded State');
assert.ok(composerSource.includes('resolveComposerDockMode'), 'Hero/Dock Mode');
assert.ok(composerSource.includes('data-composer-instance="global"'), 'Eine Composer-Instanz');
assert.ok(composerSource.includes('DealerAiInlineMic'), 'Voice im Dock/Hero');
assert.ok(composerSource.includes('hideSuggestionChips'), 'Keine Suggestion-Chips im Dock');
assert.ok(composerSource.includes('COMPOSER_INTENT_CHIPS'), 'Optional Intent-Chips im Global Composer');
assert.ok(composerSource.includes('hideIntentChips={Boolean(reviewModel) || dockCompact || useHeroPortal}'), 'Keine Intent-Tabs auf Home-Hero');
assert.ok(composerSource.includes('intentConstraint'), 'intentConstraint an Seller-Turn');
assert.ok(!composerSource.includes('COMPOSER_LEITFRAGE'), 'Keine Clever-Überschrift im Dock');
assert.ok(
  composerSource.includes("reviewType === 'customer_intake_review'")
  && composerSource.includes("reviewType === 'inbound_lead_review'"),
  'Accept akzeptiert customer_intake_review + Alias',
);
assert.ok(surfaceSource.includes('Frag Clever'), 'Hero-Placeholder laut Mockup');

const composerCss = readFileSync(join(__dirname, '../clever/CleverGlobalComposer.css'), 'utf8');
assert.ok(composerCss.includes('--docked-composer-spacer') || composerCss.includes('docked-composer'), 'Spacer bei Dock');
assert.ok(composerCss.includes('max-height: 76px') || composerCss.includes('76px'), 'Dock-Idle Desktop-Höhe');
assert.ok(composerCss.includes('88px'), 'Dock-Idle Mobile-Höhe');
assert.ok(composerCss.includes('220ms') || composerCss.includes('180ms'), 'Subtile Hero↔Dock Animation');

assert.ok(!todaySource.includes('starLabel'), 'Keine Sterne in Clever empfiehlt heute');
assert.ok(!todaySource.includes('closureChance'), 'Keine Prozentwerte in Clever empfiehlt heute');
assert.ok(todaySource.includes('ctaLabel') || todaySource.includes('cta'), 'Klare CTA');
assert.ok(todaySource.includes('ctaHref') || todaySource.includes('tel:'), 'Anruf-CTA nutzt tel: wenn möglich');
assert.ok(todaySource.includes('clever-today__action--cta'), 'CTA ist eigenständiger Link/Button');
assert.ok(todaySource.includes('resolveEmpfiehltCleverAction'), 'Empfiehlt → Clever-Fortsetzung');
assert.ok(todaySource.includes('requestComposerAction'), 'Empfiehlt nutzt Composer-Request');
assert.ok(todaySource.includes("variant === 'home'") || todaySource.includes('variant="home"') || todaySource.includes("isHome"), 'Home-Kompaktvariante');
assert.ok(todaySource.includes('slice(0, 3)') || todaySource.includes('maxItems: 3'), 'Max 3 auf Home');

assert.ok(headerSource.includes('header-settings'), 'Header Zahnrad');
assert.ok(headerSource.includes('/backend/verwaltung'), 'Zahnrad öffnet Verwaltung');
assert.ok(headerSource.includes('header-profile'), 'Header Profil-Pill');
assert.ok(headerSource.includes('getCurrentSeller'), 'Profil aus Auth/Seller');
assert.ok(headerSource.includes('Verkäufer'), 'Rolle Verkäufer');
assert.ok(backendPageSource.includes('BackendVerkaufenHub'), 'Backend bindet Verkaufen-Hub ein (Deep-Link)');

assert.ok(!homeSource.includes('BackendAdvisorHero'), 'Kein paralleler Clever-Beratung-Hero auf Dashboard');
assert.ok(homeSource.includes('BackendHomeWidgets'), 'Widgets-Row auf Dashboard');
assert.ok(homeSource.includes('BackendHomeTools'), 'Werkzeuge auf Dashboard');
assert.ok(!homeSource.includes('BackendCustomerSearch'), 'Keine Kundensuche-Karte auf Dashboard');
assert.ok(!homeSource.includes('Kundenakte finden'), 'Keine Kundenakte-finden-Sektion auf Dashboard');
assert.ok(homeSource.includes('Was brauchst'), 'Begrüßung oben');
assert.ok(homeSource.includes('composer-hero-slot') || homeSource.includes('composerSlotRef'), 'Composer-Hero-Slot');
assert.ok(homeSource.includes('buildDashboardTodayRecommendations'), 'Empfehlungen ohne Score-Engine');
assert.ok(homeSource.includes('maxItems: 3'), 'Empfehlungen auf Home auf 3 begrenzt');
assert.ok(heroSource.includes('Clever Beratung'), 'Advisor-Hero-Komponente bleibt für Verkaufen-Pfad');

const renderBlock = homeSource.slice(homeSource.indexOf('return ('));
assert.ok(
  renderBlock.indexOf('backend-home__greeting') < renderBlock.indexOf('composerSlotRef')
  && renderBlock.indexOf('composerSlotRef') < renderBlock.indexOf('<BackendHomeWidgets')
  && renderBlock.indexOf('<BackendHomeWidgets') < renderBlock.indexOf('<BackendHomeTools'),
  'Reihenfolge: Greeting → Composer-Slot → Widgets → Werkzeuge',
);

const eingang = formatCleverEingangHomeStats({
  openCount: 38,
  summary: { review: 3, duplicates: 2, ready: 8 },
});
assert.equal(eingang.openLabel, '38 offen');
assert.equal(eingang.needsYouLabel, '5 brauchen dich');
assert.equal(eingang.breakdown.find((b) => b.id === 'ready').count, 8);
assert.ok(widgetsSource.includes('backend-home__eingang-breakdown'), 'Eingang-Breakdown');
assert.ok(widgetsSource.includes('heute fällig'), 'Meine Arbeit: heute fällig');
assert.ok(widgetsSource.includes('work.links.dueToday'), 'Meine Arbeit: klickbare Due-Today-Stats');

const work = buildBackendHomeWorkStats([], [], []);
assert.equal(work.offers, 0);
assert.equal(work.dueToday, 0);
assert.equal(work.appointmentsToday, 0);
assert.match(work.offersLabel, /Angebote/);
assert.match(work.dueTodayLabel, /heute fällig/);
assert.match(work.appointmentsLabel, /Termine heute/);
assert.equal(work.links.dueToday, '/backend/verkaufschancen?filter=followup');
assert.ok(!/131 Wiedervorlagen/.test(work.followUpsLabel || ''));

assert.ok(
  surfaceSource.includes('ANGEBOT VORBEREITEN') || surfaceSource.includes('offer_prepare'),
  'Task-Titel Angebot vorbereiten',
);

console.log('BackendHome.test.js: ok');
