/**
 * Angebot prüfen – Identity Fact-Chips, Rate-Stale, PDF/Edit/Historie.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyCommercialConfirmPatch,
  editablePriceDetailFields,
} from '../../services/dealer/sellerOfferConfirmGate.js';
import {
  listOfferIdentityColorChoices,
  listOfferIdentityModelChoices,
  listOfferIdentityTrimChoices,
} from '../../services/cleverSeller/offerVehicleIdentity.js';
import {
  buildOfferVersionHistory,
  createNextOfferVersion,
  VEHICLE_OFFER_STATUS,
} from '../../services/vehicleOffer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, 'DealerAiOfferPreview.jsx'), 'utf8');
const css = readFileSync(join(__dirname, 'DealerAiOfferPreview.css'), 'utf8');

assert.ok(source.includes('Aktuelles PDF ersetzen'), 'PDF-Replace-Pfad bleibt erhalten');
assert.ok(source.includes('dai-opreview-identity'), 'Identity-Zeile in Angebot prüfen');
assert.ok(source.includes('Fahrzeugidentität'), 'Identity aria-label');
assert.ok(source.includes('IdentityFactPopover'), 'Identity nutzt Fact-Popover');
assert.ok(source.includes('listOfferIdentityModelChoices'), 'Modell-Choices aus Lexikon-Pfad');
assert.ok(source.includes('listOfferIdentityTrimChoices'), 'Linien-Choices modellbezogen');
assert.ok(source.includes('listOfferIdentityColorChoices'), 'Farb-Choices mit Swatch');
assert.ok(source.includes('applyIdentityChoice'), 'Identity-Choice schreibt denselben State');
assert.ok(source.includes('Rate prüfen'), 'Stale-Rate Copy');
assert.ok(source.includes('Fahrzeug wurde geändert'), 'Identity-Change Hinweis');
assert.ok(source.includes('rateNeedsReview'), 'Rate-Stale-Flag in Preview');
assert.ok(!source.includes('Klicken zum Bearbeiten'), 'Kein Freitext-Hilfetext');
assert.ok(!source.includes('openIdentityEdit'), 'Kein Freitext-Identity-Edit als Default');
assert.ok(!source.includes('identityDraft'), 'Kein Freitext-Identity-Draft');
assert.ok(source.includes('Werte bearbeiten'), 'Manueller Edit-Pfad ist sichtbar');
assert.ok(css.includes('dai-opreview-identity'), 'Identity Styles');
assert.ok(css.includes('dai-opreview-identity__popover'), 'Popover Styles');
assert.ok(css.includes('dai-opreview-summary__rate--stale'), 'Stale-Rate Styles');
assert.ok(source.includes('editablePriceDetailFields'), 'Preisdetails nutzen editierbare Felder');
assert.ok(source.includes("editMode ? 'Fertig' : 'Werte bearbeiten'"), 'Preisdetails-Header toggelt Bearbeiten');
assert.ok(source.includes('aria-label="Preisdetails bearbeiten"'), 'Preisdetails haben Edit-Modus');
assert.ok(
  source.includes('onCommercialChange?.(draftValues)'),
  'Speichern schreibt manuelle Werte in denselben Draft',
);
assert.ok(
  !source.includes('if (requireConfirm && onCommercialChange)'),
  'Commercial-Flush ist nicht mehr nur für PDF-Confirm',
);

// Entfernte Bild-2-Elemente
assert.ok(!source.includes('In neuem Tab öffnen'), 'Kein „In neuem Tab öffnen“');
assert.ok(!source.includes('2 Wege'), 'Kein „2 Wege“-Marketing');
assert.ok(!source.includes('Angebot korrigieren – 2 Wege'), 'Keine Dual-Path-Überschrift');
assert.ok(!source.includes('Verbrauch'), 'Kein Verbrauch & CO₂-Block');
assert.ok(!source.includes('cn-customer-fold'), 'Kein Kunde-Feld');
assert.ok(!source.includes('An Kunden senden'), 'Kein Fake-Send ohne Handler');
assert.ok(!source.includes('Entwurf wird automatisch gespeichert'), 'Kein Fake-Autosave');

// Mockup-Struktur
assert.ok(source.includes('resolveConfigureHeroImage'), 'Fahrzeugbild in Summary-Card');
assert.ok(source.includes('dai-opreview-summary'), 'Summary-Card-Markup');
assert.ok(source.includes('dai-opreview-summary__image'), 'Bild als Card-Media');
assert.ok(source.includes('dai-opreview-summary__rate'), 'Purple Rate-Box');
assert.ok(source.includes('dai-opreview-summary__swatch'), 'Farb-Swatch');
assert.ok(source.includes('Angebot geprüft'), 'Grünes Checked-Badge');
assert.ok(source.includes("title: 'Preisdetails'"), 'Preisdetails-Header');
assert.ok(source.includes('dai-opreview-pdf-btn-row'), 'PDF-Buttons nebeneinander');
assert.ok(source.includes('PDF-Vorschau'), 'PDF-Vorschau bleibt');
assert.ok(source.includes('kein Einmal-Limit'), 'PDF als Replace klar kommuniziert');
assert.ok(source.includes('buildOfferVersionHistory'), 'Historie aus Version-Metadaten');
assert.ok(source.includes('Historie'), 'Historie-Eyebrow');
assert.ok(source.includes('Angebotsversionen'), 'Angebotsversionen-Heading');
assert.ok(source.includes('Aktuell'), 'AKTUELL-Badge in Historie');
assert.ok(source.includes('Angebot speichern'), 'Primary Save-CTA');
assert.ok(css.includes('--op-clever'), 'Clever-Purple Token in CSS');
assert.ok(css.includes('dai-opreview-summary'), 'Summary-Card Styles');
assert.ok(css.includes('grid-template-columns: 1fr 1fr'), 'PDF-Buttons Side-by-Side Desktop');

assert.deepEqual(
  editablePriceDetailFields('leasing'),
  ['offerType', 'termMonths', 'annualMileage', 'downPayment', 'transferFee', 'monthlyRate'],
);
assert.deepEqual(
  editablePriceDetailFields('financing'),
  ['offerType', 'termMonths', 'downPayment', 'transferFee', 'monthlyRate'],
);
assert.deepEqual(
  editablePriceDetailFields('cash'),
  ['offerType', 'transferFee', 'monthlyRate'],
);

{
  const patched = applyCommercialConfirmPatch(
    {
      payment: {
        type: 'leasing',
        calculatedRate: 281,
        termMonths: 48,
        mileagePerYear: 35000,
        downPayment: 2000,
        transferCost: 1290,
      },
      offerPreview: { monthlyRate: 281 },
      offerCalculation: { monthlyRate: 281, preparationFee: 1290 },
    },
    {
      monthlyRate: 299,
      termMonths: 36,
      annualMileage: 20000,
      downPayment: 0,
      transferFee: 990,
      offerType: 'leasing',
    },
  );
  assert.equal(patched.payment.calculatedRate, 299);
  assert.equal(patched.payment.termMonths, 36);
  assert.equal(patched.payment.mileagePerYear, 20000);
  assert.equal(patched.payment.downPayment, 0);
  assert.equal(patched.payment.transferCost, 990);
  assert.equal(patched.offerPreview.monthlyRate, 299);
  assert.equal(patched.rateNeedsReview, false);
}

// Identity-Change → Rate stale, keine erfundene Neuberechnung
{
  const base = {
    payment: { type: 'leasing', calculatedRate: 233 },
    offerPreview: { monthlyRate: 233 },
    offerCalculation: { monthlyRate: 233 },
    vehicle: { model: 'EV2', modelKey: 'ev2', trimLabel: 'Earth', color: 'Schwarz' },
    vehicleConfiguration: {
      model: 'EV2',
      modelKey: 'ev2',
      trimLabel: 'Earth',
      trimId: 'earth',
      colorLabel: 'Schwarz',
      colorId: 'schwarz',
    },
  };
  const afterTrim = applyCommercialConfirmPatch(base, {
    trimLabel: 'Air',
    trimId: 'air',
  });
  assert.equal(afterTrim.vehicleConfiguration.trimLabel, 'Air');
  assert.equal(afterTrim.payment.calculatedRate, 233, 'Rate bleibt zahlenmäßig, wird nicht neu erfunden');
  assert.equal(afterTrim.rateNeedsReview, true, 'Identity-Change markiert Rate stale');
  assert.equal(afterTrim.rateCalibratedFor, 'Earth');

  const afterRate = applyCommercialConfirmPatch(afterTrim, { monthlyRate: 219 });
  assert.equal(afterRate.payment.calculatedRate, 219);
  assert.equal(afterRate.rateNeedsReview, false, 'PDF/Bank/manuelle Rate hebt Stale auf');
  assert.equal(afterRate.rateCalibratedFor, 'Air');
}

{
  const models = listOfferIdentityModelChoices({ currentModelKey: 'ev2' });
  assert.ok(models.some((m) => m.id === 'ev2'), 'EV2 in Modell-Choices');
  assert.ok(models.some((m) => m.id === 'ev3'), 'EV3 in Modell-Choices');
  const trims = listOfferIdentityTrimChoices('ev2');
  assert.ok(trims.length >= 2, 'EV2 hat Linien-Choices');
  assert.ok(trims.some((t) => /air|earth|gt/i.test(t.label)), 'Bekannte Linien für EV2');
  const colors = listOfferIdentityColorChoices('ev3');
  assert.ok(colors.length >= 2, 'Farben für EV3');
  assert.ok(colors.every((c) => c.swatch), 'Farb-Choices haben Swatch');
}

{
  const v1 = {
    id: 'vo-hist',
    status: VEHICLE_OFFER_STATUS.PREPARED,
    version: 1,
    monthlyRate: 399,
    preparedAt: '2026-07-30T10:00:00.000Z',
  };
  const v2 = createNextOfferVersion(v1, { monthlyRate: 379 });
  const history = buildOfferVersionHistory({
    ...v2,
    payment: { calculatedRate: 379 },
  });
  assert.ok(history.length >= 2, 'Historie zeigt aktuelle + ältere Version');
  assert.equal(history[0].isCurrent, true);
  assert.equal(history[0].label, 'v2');
  assert.equal(history[1].label, 'v1');
  assert.ok(history[0].summary?.includes('379'), 'Aktuelle Rate in Historie');
}

console.log('DealerAiOfferPreview.test.js OK');
