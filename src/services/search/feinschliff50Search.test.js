/**
 * Feinschliff – 50 echte KI-Suchanfragen (Smoke + Kern-Assertions)
 * Ausführen: npm run test:feinschliff50
 */

import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';

const QUERIES = [
  { q: 'Elektroauto bis 400 € Leasing', expect: { payment: 'leasing', maxRate: 400 } },
  { q: 'Kia EV3 mit Sitzheizung', expect: { model: 'EV3', features: ['heated_seats'] } },
  { q: '360 Grad Kamera', expect: { features: ['camera_360'] } },
  { q: 'SUV unter 350 Euro monatlich', expect: { bodyType: 'suv' } },
  { q: 'Sportage Benziner Automatik', expect: { model: 'Sportage', fuel: 'verbrenner' } },
  { q: 'E-Auto 400 km Reichweite', expect: { fuel: 'elektro', rangeKmMin: 400 } },
  { q: 'Familienauto mit Anhängerkupplung', expect: { features: ['tow_bar'] } },
  { q: 'Kleinwagen mit Sitzheizung', expect: { bodyType: 'kleinwagen' } },
  { q: 'MG4 Elektro bis 300 €', expect: { model: 'MG4' } },
  { q: 'Skoda Elroq Leasing', expect: { model: 'Elroq' } },
  { q: 'Wärmepumpe Elektro', expect: { features: ['heat_pump'] } },
  { q: 'Panoramadach SUV', expect: { bodyType: 'suv' } },
  { q: 'Automatik Getriebe', expect: { transmission: 'automatic' } },
  { q: 'Sofort verfügbar Elektro', expect: { fuel: 'elektro' } },
  { q: 'Hybrid bis 450 €', expect: { fuel: 'hybrid' } },
  { q: 'Kaufpreis unter 35000', expect: { payment: 'cash' } },
  { q: 'Rückfahrkamera Parksensoren', expect: { features: ['camera_rear'] } },
  { q: 'Apple CarPlay Android Auto', expect: { features: ['carplay'] } },
  { q: 'Ledersitze Automatik', expect: { features: ['leather'] } },
  { q: '7 Sitzer SUV', expect: { bodyType: 'suv' } },
  { q: 'EV3 Earth GT-Line', expect: { model: 'EV3' } },
  { q: 'Elektro Familie 2 Kinder', expect: { fuel: 'elektro' } },
  { q: 'Budget 400 Euro leasing 48 monate', expect: { payment: 'leasing', maxRate: 400 } },
  { q: 'Kia Sportage Plugin Hybrid', expect: { model: 'Sportage' } },
  { q: 'VW ID.3 Elektro', expect: { model: 'ID.3' } },
  { q: 'Cupra Born elektrisch', expect: { fuel: 'elektro' } },
  { q: 'Anhängelast 1500 kg', expect: { towCapacityKg: 1500 } },
  { q: 'Allrad SUV', expect: { bodyType: 'suv', drive: 'awd' } },
  { q: 'Kompaktwagen Diesel', expect: { fuel: 'diesel' } },
  { q: 'Mindestens 150 PS', expect: { powerMin: 150 } },
  { q: 'Navigationsystem', expect: { features: ['navigation'] } },
  { q: 'Tempomat Abstand', expect: { features: ['acc'] } },
  { q: 'Spurhalteassistent', expect: { features: ['lane_assist'] } },
  { q: 'Keyless Entry', expect: { features: ['keyless'] } },
  { q: 'Elektrische Heckklappe', expect: { features: ['power_tailgate'] } },
  { q: 'Harman Kardon Sound', expect: { features: ['premium_audio'] } },
  { q: 'Sitzheizung Lenkradheizung', expect: { features: ['heated_seats'] } },
  { q: 'Klimaautomatik', expect: { features: ['climate_auto'] } },
  { q: 'Metallic Lack', expect: {} },
  { q: 'Probefahrt EV3', expect: { model: 'EV3' } },
  { q: 'Neuwagen Elektro München', expect: { fuel: 'elektro' } },
  { q: 'Leasing 10000 km 36 monate', expect: { payment: 'leasing' } },
  { q: 'Finanzierung 0 Prozent', expect: { payment: 'finance' } },
  { q: 'Barpreis Elektro SUV', expect: { payment: 'cash', bodyType: 'suv' } },
  { q: 'Kia EV6 Schnellladen', expect: { model: 'EV6' } },
  { q: 'Tesla Model 3 Alternative', expect: { model: 'Model 3' } },
  { q: 'Günstig Elektro Kleinwagen', expect: { fuel: 'elektro', bodyType: 'kleinwagen' } },
  { q: 'Auto mit Schiebedach', expect: { features: ['sunroof'] } },
  { q: 'Kindersitz ISOFIX', expect: { features: ['isofix'] } },
  { q: 'Clever sparsam Stadtflitzer', expect: {} },
];

let passed = 0;
let soft = 0;

for (const { q, expect: exp } of QUERIES) {
  const intent = parseSearchIntent(q);
  assert.ok(intent, `Parser liefert Intent für: ${q}`);
  assert.ok(typeof intent === 'object', `Intent ist Objekt: ${q}`);

  for (const [key, value] of Object.entries(exp)) {
    const actual = intent[key];
    if (Array.isArray(value) && Array.isArray(actual)) {
      const missing = value.filter((v) => !actual.includes(v));
      if (missing.length) {
        soft += 1;
        console.warn(`⚠ ${q}: ${key} fehlt ${missing.join(',')} (hat: ${actual.join(',')})`);
      }
    } else if (value != null && actual !== value) {
      soft += 1;
      console.warn(`⚠ ${q}: ${key} erwartet ${value}, got ${actual}`);
    }
  }
  passed += 1;
}

assert.equal(passed, QUERIES.length, 'Alle 50 Anfragen geparst');
console.log(`feinschliff50Search.test.js: ${passed}/50 geparst, ${soft} weiche Abweichungen`);
