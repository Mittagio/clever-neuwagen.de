/**
 * Golden: Freibleibende Kalkulation (Kia EV6 GT) – PDF-Wahrheit → Review/Presenter
 *
 * node --test src/services/cleverSeller/freibleibendeKalkulationEv6Gt.golden.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { parseMagicOfferIntent } from '../dealer/magicOfferIntentParser.js';
import { extractSellerFactsFromOfferPdfText } from './mapMagicOfferIntentToSellerFacts.js';
import { runComposerPdfAttachTurn } from './runComposerPdfAttachTurn.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';

/** Extrahierter Text aus u:\…\Freibleibende Kalkulation.pdf (Kernstellen) */
const FREIBLEIBENDE_KALKULATION_TEXT = `
Freibleibende Kalkulation
Sehr geehrte Damen und Herren wir freuen uns, dass Sie Ihr Auto leasen möchten
Konfiguration und Ausstattung Ihres Fahrzeuges
Kia EV6 84 kWh 478 kW Allradantrieb GT Sports Utility Vehicle, 5 Türen, Elektro, 1-Gang Automatik
Fahrzeugnutzung - Standard
Lackierung: Auroraschwarz Metallic
Polsterung: Wildlederoptik Schwarz mit Neon-Akzenten
Listenpreis
Grundlistenpreis 58.815,13 EUR
Gewähltes Zubehör 2.016,80 EUR
Winterräder 21 Zoll 2.016,80 EUR
Gesamtlistenpreis inkl. Sonderausstattung & Zubehör 61.655,46 EUR
Alle Preise ohne USt

Kostenübersicht
Monatliche Gesamtrate
Die monatliche Gesamtrate ist jeweils zum Ersten eines Kalendermonats vorschüssig fällig,
beginnend ab Übergabe des Fahrzeugs 759,46 EUR
Monatsrate Finanzleasing 733,69 EUR
Monatsrate Service-Produkte 0,00 EUR
Monatsrate Logistik 25,77 EUR
Alle Preise ohne USt
Einmalige Kosten 145,00 EUR
Anzahlung 0,00 EUR
Gutachten bei Fahrzeugrückgabe 115,00 EUR
Abmeldekosten 30,00 EUR
Alle Preise ohne USt
Leasingkonditionen
Anschaffungspreis (= Nettodarlehensbetrag) 61.655,46 EUR
Laufzeit 48 Monate
Laufleistung / Jahr 20.000 km
Leasingfaktor 1,151%
Anzahl Raten 48
Alle Preise ohne USt
Mehrkilometer: 21,58 ct pro Mehrkilometer/ 12,33 ct pro Minderkilometer
`;

describe('Freibleibende Kalkulation EV6 GT – PDF-Wahrheit', () => {
  it('parst Primary-Gesamtrate, Netto, Identity, Winterräder, 0 € AZ', () => {
    const intent = parseMagicOfferIntent(FREIBLEIBENDE_KALKULATION_TEXT);
    assert.equal(intent.commercialInput.monthlyTotalRate, 759.46);
    assert.equal(intent.commercialInput.financeLeaseRate, 733.69);
    assert.equal(intent.commercialInput.logisticsMonthlyRate, 25.77);
    assert.equal(intent.commercialInput.monthlyRate, 759.46);
    assert.equal(intent.commercialInput.monthlyRateBasis, 'net');
    assert.equal(intent.commercialInput.listPrice, 61655.46);
    assert.equal(intent.commercialInput.listPriceBasis, 'net');
    assert.equal(intent.commercialInput.durationMonths, 48);
    assert.equal(intent.commercialInput.annualMileageKm, 20000);
    assert.equal(intent.commercialInput.downPayment, 0);
    assert.equal(intent.commercialInput.specialPayment, 0);
    assert.equal(intent.commercialInput.discountPercent, null, 'Leasingfaktor ≠ Rabatt');
    assert.equal(intent.vehicleRequest.modelHint, 'ev6');
    assert.equal(intent.vehicleRequest.trimHint, 'gt');
    assert.equal(intent.vehicleRequest.motorHint, 'ev-84-awd');
    assert.equal(intent.vehicleRequest.colorHint, 'aurorablackpearl');
    assert.ok(intent.vehicleRequest.packageLabels.some((l) => /Winterräder\s+21\s*Zoll/i.test(l)));

    const facts = extractSellerFactsFromOfferPdfText(FREIBLEIBENDE_KALKULATION_TEXT);
    const rate = facts.find((f) => f.field === 'monthlyBudget');
    assert.equal(rate?.value?.amount ?? rate?.value, 759.46);
    assert.equal(rate?.value?.monthlyTotalRate, 759.46);
    assert.equal(rate?.value?.financeLeaseRate, 733.69);
    assert.equal(rate?.value?.logisticsMonthlyRate, 25.77);
    assert.equal(rate?.value?.basis, 'net');
    assert.equal(rate?.needsConfirmation, false);
    assert.ok(facts.some((f) => f.field === 'financeLeaseRate' && f.value?.amount === 733.69));
    assert.ok(facts.some((f) => f.field === 'logisticsMonthlyRate' && f.value?.amount === 25.77));
    assert.ok(facts.some((f) => f.field === 'downPayment' && f.value === 0));
    assert.ok(facts.some((f) => f.field === 'vehicleInterest' && /GT/i.test(f.label)));
    assert.ok(facts.some((f) => f.field === 'colorPreference' && /Auroraschwarz/i.test(f.label)));
    assert.ok(facts.some((f) => (
      f.field === 'equipmentWish'
      && /84\s*kWh/i.test(f.label)
      && /AWD/i.test(f.label)
    )));
    assert.ok(facts.some((f) => f.field === 'equipmentWish' && /Winterräder\s+21/i.test(f.label)));
    assert.ok(!facts.some((f) => /Komfort-Paket|Technologie-Paket|Premium-Paket/i.test(f.label)));
    assert.ok(!facts.some((f) => /Standard Range 63|Long Range 84 kWh RWD/i.test(f.label)));
    assert.ok(!facts.some((f) => f.field === 'discountPercent'), 'kein Fake-Rabatt aus Leasingfaktor');
  });

  it('Review: Gesamtrate primär, keine Netto-Warnung, keine Katalog-Chips, CTA nicht unnötig incomplete', () => {
    const lead = {
      id: 'lead-ev6-gt-pdf',
      name: 'Test Kunde',
      contact: { name: 'Test Kunde' },
      wish: {},
      crm: { needProfile: createEmptyNeedProfile() },
    };
    const { turn } = runComposerPdfAttachTurn({
      extracted: {
        ok: true,
        text: FREIBLEIBENDE_KALKULATION_TEXT,
        fileName: 'Freibleibende Kalkulation.pdf',
      },
      file: { type: 'application/pdf', name: 'Freibleibende Kalkulation.pdf' },
      lead,
      leadsSnapshot: [lead],
      scopeHint: 'dashboard',
      customerName: 'Test Kunde',
    });
    assert.ok(turn, 'Turn erwartet');

    const winter = (turn.extractedFacts || []).filter((f) => (
      f.field === 'equipmentWish' && /Winterräder/i.test(f.label || '')
    ));
    assert.ok(winter.length >= 1, 'Winterräder im Turn erhalten');

    const review = buildUniversalReviewModel(turn);
    const hero = review.offerReview || {};
    assert.match(String(hero.heroLine || hero.vehicleLabel || ''), /EV6\s+GT/i);
    assert.match(String(hero.heroLine || ''), /84\s*kWh/i);
    assert.match(String(hero.heroLine || ''), /AWD/i);
    assert.match(String(hero.heroLine || ''), /Auroraschwarz/i);
    assert.match(String(hero.conditionsLine || ''), /759,46/);
    assert.match(String(hero.conditionsLine || ''), /0\s*€\s*Sonderzahlung/i);
    assert.match(String(hero.conditionsLine || ''), /48\s*Monate/);
    assert.match(String(hero.conditionsLine || ''), /20\.000/);
    assert.match(String(hero.rateBreakdownLine || ''), /733,69/);
    assert.match(String(hero.rateBreakdownLine || ''), /25,77/);
    assert.match(String(hero.extrasLine || ''), /Winterräder/i);
    assert.match(String(hero.listPriceLine || ''), /61\.655,46/);
    assert.equal(review.conflictBox, null);
    assert.ok(!/Netto.*prüfen|bitte prüfen/i.test(JSON.stringify(review.conflictBox || {})));

    const identityChips = (review.actionSections || [])
      .flatMap((s) => s.primaryActions || [])
      .filter((a) => a.action === 'clarify_offer_identity')
      .map((a) => a.label);
    assert.ok(!identityChips.some((l) => /Komfort-Paket|Technologie-Paket|Premium-Paket/i.test(l)));
    assert.ok(!identityChips.some((l) => /Standard Range|Long Range 84/i.test(l)));

    const offer = (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
    assert.ok(offer);
    assert.equal(offer.payload?.monthlyRate, 759.46);
    assert.equal(offer.payload?.missingRate, false);
    assert.equal(offer.payload?.canCreateOffer, true);
    assert.match(String(review.primaryCta || ''), /An Kunden senden|Angebot/i);
  });
});
