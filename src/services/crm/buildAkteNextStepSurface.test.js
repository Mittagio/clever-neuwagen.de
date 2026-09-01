/**
 * Tests: Kundenakte Next-Step Surface (Hierarchy v2)
 * node src/services/crm/buildAkteNextStepSurface.test.js
 */
import assert from 'node:assert/strict';
import {
  buildAkteLeanContextLine,
  buildAkteNextStepSurface,
} from './buildAkteNextStepSurface.js';
import { CLEVER_ACTION_IDS } from './cleverActionEngine.js';

// Lean context line: nur Fahrzeug/Modell (keine Deal-Konditionen im Header)
{
  const line = buildAkteLeanContextLine({
    vehicleLabel: 'Kia EV4 Earth',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 15000,
    downPayment: 0,
  });
  assert.equal(line, 'EV4 Earth');
  assert.ok(!/^Kia\s/i.test(line), 'Kia-Prefix wird gestrippt');
  assert.ok(!/Leasing|Monate|km|AZ/i.test(line), 'Keine Konditionen im Header');
}

{
  const line = buildAkteLeanContextLine({
    vehicleLabel: 'Sportage',
    paymentType: 'financing',
    termMonths: 60,
  });
  assert.equal(line, 'Sportage');
}

{
  assert.equal(buildAkteLeanContextLine({}), '', 'Leere Inputs → leere Zeile');
}

// reasonSource aus realem Action-Status (nie generisch)
{
  const surface = buildAkteNextStepSurface({
    recommendation: {
      actionId: CLEVER_ACTION_IDS.OFFER_DRAFT_CREATE,
      ctaLabel: 'Angebot vervollständigen',
      title: 'Angebot anlegen',
      handlerType: 'offer_create',
      reason: 'Rate und Laufzeit fehlen noch',
    },
    canSend: true,
    canCall: true,
    telHref: 'tel:+491701234567',
  });
  assert.ok(surface, 'Surface gebaut');
  assert.equal(surface.recommendLabel, 'Clever empfiehlt');
  assert.equal(surface.reasonSource.kind, 'missing_offer_data');
  assert.equal(surface.reasonSource.detail, 'Rate und Laufzeit fehlen noch');
  assert.equal(surface.reasonSource.actionId, CLEVER_ACTION_IDS.OFFER_DRAFT_CREATE);
  assert.equal(surface.showExplanation, false);
  assert.equal(surface.primary.label, 'Angebot vervollständigen');
  assert.ok(surface.secondary, 'Sekundär-CTA vorhanden');
  assert.equal(surface.secondary.type, 'call');
}

{
  const surface = buildAkteNextStepSurface({
    recommendation: {
      actionId: CLEVER_ACTION_IDS.OFFER_OPENED_CALL,
      ctaLabel: 'Heute anrufen',
      handlerType: 'call',
      reason: 'Angebot wurde heute geöffnet',
    },
    actions: [{ id: 'call', type: 'call', label: 'Anrufen', primary: true, href: 'tel:1' }],
    canSend: true,
    canCall: true,
    telHref: 'tel:1',
  });
  assert.equal(surface.reasonSource.kind, 'customer_reaction');
  assert.equal(surface.primary.type, 'call');
  assert.equal(surface.secondary?.type, 'send');
  assert.notEqual(surface.secondary?.label, surface.primary.label);
}

{
  const surface = buildAkteNextStepSurface({
    recommendation: {
      actionId: CLEVER_ACTION_IDS.OFFER_FOLLOWUP,
      ctaLabel: 'Nachfassen',
      handlerType: 'offer_followup',
      reason: 'Seit 5 Tagen keine Reaktion',
    },
    canCall: true,
    canSend: false,
    telHref: 'tel:1',
  });
  assert.equal(surface.reasonSource.kind, 'last_contact');
  assert.equal(surface.secondary?.type, 'call');
}

{
  const surface = buildAkteNextStepSurface({
    recommendation: {
      actionId: CLEVER_ACTION_IDS.SELF_DISCLOSURE_FOLLOWUP,
      ctaLabel: 'Selbstauskunft nachfassen',
      reason: 'Frist läuft ab',
    },
    canCall: false,
    canSend: true,
  });
  assert.equal(surface.reasonSource.kind, 'deadline');
}

{
  const surface = buildAkteNextStepSurface({
    recommendation: {
      actionId: CLEVER_ACTION_IDS.GENERAL_REMINDER,
      ctaLabel: 'Kurz melden',
      reason: 'Offene Aufgabe',
    },
  });
  assert.equal(surface.reasonSource.kind, 'open_task');
  assert.equal(surface.secondary, null, 'Ohne canCall/canSend kein Sekundär-CTA');
}

{
  assert.equal(
    buildAkteNextStepSurface({ recommendation: null }),
    null,
    'Ohne Recommendation keine Surface',
  );
}

console.log('buildAkteNextStepSurface.test.js: ok');
