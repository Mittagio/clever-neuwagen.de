import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  addressFromLead,
  formatAddressLine,
  isAddressComplete,
  normalizeAddressResult,
  parseFormattedAddressLine,
} from './customerAddressModel.js';
import {
  isAutocompleteEnabled,
  isLiveAutocompleteProvider,
  searchAddressSuggestions,
} from './addressAutocompleteService.js';
import { getDealerLocation } from './dealerLocationService.js';
import {
  buildDealerToCustomerRouteUrl,
  hasGoogleMapsApiKey,
} from './mapsRouteService.js';
import {
  calculateCustomerDistance,
  formatDistanceSummary,
  getCachedDistanceInfo,
  shouldRecalculateDistance,
  DISTANCE_CACHE_MAX_AGE_MS,
} from './customerDistanceService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const headerSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/CustomerAkteHeader.jsx'),
  'utf8',
);

const sampleLead = {
  dealerId: 'autohaus-trinkle',
  contact: {
    address: 'Buchsweg 38 · 73547 Aalen',
  },
  crm: {
    address: 'Buchsweg 38 · 73547 Aalen',
    customerAddress: {
      street: 'Buchsweg',
      houseNumber: '38',
      postalCode: '73547',
      city: 'Aalen',
      country: 'Deutschland',
      formattedAddress: 'Buchsweg 38 · 73547 Aalen',
      lat: 48.8378,
      lng: 10.0933,
    },
  },
};

const address = addressFromLead(sampleLead);
assert.equal(address.formattedAddress, 'Buchsweg 38 · 73547 Aalen', 'Adresse wird im Kundenkopf angezeigt');
assert.ok(headerSource.includes('addressLine'), 'Kundenkopf rendert Adresszeile');
assert.ok(headerSource.includes('distanceSummary'), 'Entfernungszeile im Kundenkopf');
assert.ok(headerSource.includes('+ Adresse hinzufügen'), 'fehlende Adresse zeigt Hinweis');

const emptyLead = { contact: {}, crm: {} };
const emptyAddress = addressFromLead(emptyLead);
assert.equal(emptyAddress.formattedAddress, '', 'leere Adresse erkannt');
assert.ok(headerSource.includes('Adresse kopiert'), 'Copy-Feedback vorbereitet');

const dealer = getDealerLocation('autohaus-trinkle');
const routeUrl = buildDealerToCustomerRouteUrl(address, dealer);
assert.ok(routeUrl?.includes('google.com/maps/dir'), 'Route-URL wird erzeugt');
assert.ok(routeUrl.includes('origin='), 'Route mit Autohaus-Ursprung');
assert.ok(routeUrl.includes('destination='), 'Route mit Kunden-Ziel');
assert.ok(decodeURIComponent(routeUrl).includes('Buchsweg'), 'Kundenadresse in Route');

const distance = await calculateCustomerDistance(address, dealer);
assert.ok(distance?.distanceKm > 38 && distance?.distanceKm < 48, 'Entfernung Aalen–Heilbronn plausibel');
const summary = formatDistanceSummary(distance);
assert.ok(summary?.includes('km'), 'distanceInfo wird formatiert');
assert.ok(summary?.includes('Min'), 'Fahrzeit wird formatiert');

const cached = getCachedDistanceInfo({
  distanceInfo: distance,
  customerAddress: address,
  dealerLocation: dealer,
});
assert.deepEqual(cached, distance, 'gültiger Cache wird wiederverwendet');
assert.equal(
  shouldRecalculateDistance({ distanceInfo: distance, customerAddress: address, dealerLocation: dealer }),
  false,
  'Entfernung wird nicht unnötig neu berechnet',
);

const stale = {
  ...distance,
  calculatedAt: new Date(Date.now() - DISTANCE_CACHE_MAX_AGE_MS - 1000).toISOString(),
};
assert.equal(
  shouldRecalculateDistance({ distanceInfo: stale, customerAddress: address, dealerLocation: dealer }),
  true,
  'veralteter Cache wird erneuert',
);

const changedAddress = normalizeAddressResult({ ...address, street: 'Hauptstraße', houseNumber: '1' });
assert.equal(
  shouldRecalculateDistance({ distanceInfo: distance, customerAddress: changedAddress, dealerLocation: dealer }),
  true,
  'Adressänderung invalidiert Cache',
);

assert.equal(hasGoogleMapsApiKey(), false, 'ohne API-Key kein Live-Key');
assert.equal(isLiveAutocompleteProvider(), false, 'Live-Autocomplete ohne Key aus');
assert.equal(isAutocompleteEnabled(), false, 'Autocomplete ohne API-Key deaktiviert');

const manual = normalizeAddressResult({
  street: 'Testweg',
  houseNumber: '9',
  postalCode: '12345',
  city: 'Musterstadt',
});
assert.ok(isAddressComplete(manual), 'manuelle Adresseingabe möglich');
assert.equal(
  formatAddressLine(manual),
  'Testweg 9 · 12345 Musterstadt',
  'manuelle Adresse formatiert',
);

const suggestionsWithoutKey = await searchAddressSuggestions('Buchsweg Aalen');
assert.equal(suggestionsWithoutKey.length, 0, 'ohne API-Key keine Autocomplete-Vorschläge');

assert.ok(
  headerSource.includes('handleCopy') && headerSource.includes('copyToClipboard'),
  'Adresse kann kopiert werden',
);

console.log('customerAddressLocation.test.js: ok');
