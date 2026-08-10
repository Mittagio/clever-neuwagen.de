/**
 * Angebote-Liste: „Öffnen“ darf nicht in einer role=button-Karte stecken
 * und navigiert zu Angebot prüfen (nicht nur Akte-Workspace).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, 'CustomerAkteVehicleTracks.jsx'), 'utf8');
const followUp = readFileSync(join(__dirname, 'DealerAiLeadFollowUp.jsx'), 'utf8');

assert.ok(source.includes('vt-card__body--selectable'), 'Select nur auf Body-Zone');
assert.ok(source.includes('onOpenTrack?.(track)'), 'Öffnen ruft onOpenTrack');
assert.ok(
  source.includes('className="vt-card__actions"'),
  'Aktionen liegen außerhalb der Select-Zone',
);

const bodyStart = source.indexOf('vt-card__body--selectable');
const actionsStart = source.indexOf('className="vt-card__actions"');
const openHandler = source.indexOf('onOpenTrack?.(track)');
assert.ok(bodyStart > 0 && actionsStart > bodyStart, 'Actions nach Body');
assert.ok(openHandler > actionsStart, 'Öffnen-Handler in Actions');

assert.ok(
  followUp.includes('SHEETS.boardOffers')
    && followUp.includes('onOpenTrack={(track) => {')
    && followUp.includes('openVehicleTrack(track)'),
  'Angebote-Sheet verdrahtet Öffnen → openVehicleTrack',
);

const openFnStart = followUp.indexOf('function openVehicleTrack(track)');
assert.ok(openFnStart > 0, 'openVehicleTrack definiert');
const openFnSlice = followUp.slice(openFnStart, openFnStart + 900);
assert.ok(
  openFnSlice.includes('onOpenOfferEdit(card)'),
  'openVehicleTrack öffnet Angebot prüfen via onOpenOfferEdit',
);
assert.ok(
  openFnSlice.indexOf('onOpenOfferEdit(card)')
    < openFnSlice.indexOf('openOfferInWorkspace(card)'),
  'Prüfen-Pfad vor Workspace-Fallback',
);

console.log('CustomerAkteVehicleTracks.open.test.js: ok');
