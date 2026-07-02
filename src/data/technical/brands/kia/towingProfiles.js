/**
 * Kia – geprüfte Anhängelast/Stützlast aus DE-Preislisten (PDF-Extrakt).
 * scripts/pdf-extract/Kia-Germany-*-Preisliste.txt
 */
import { defineModelProfile, tow, towNotPermitted } from '../../verifiedTechnicalDataSchema.js';

const SRC = (name, file) => ({
  sourceDocument: `Kia ${name} Preisliste Deutschland`,
  sourceFile: `scripts/pdf-extract/${file}`,
  sourceDate: '2026-01',
});

/** @type {import('../../verifiedTechnicalDataSchema.js').VerifiedTechnicalModelProfile[]} */
export const KIA_TOWING_PROFILES = [
  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'picanto',
    modelLabel: 'Kia Picanto',
    ...SRC('Picanto', 'Kia-Germany-Picanto_Preisliste.txt'),
    variants: [{ trimLabel: 'Alle Varianten', towing: towNotPermitted() }],
    notes: 'Preisliste: keine Anhängelast zulässig',
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'stonic',
    modelLabel: 'Kia Stonic',
    ...SRC('Stonic', 'Kia-Germany-Stonic-Preisliste.txt'),
    variants: [{ trimLabel: 'Alle Varianten', towing: tow(900, 450, 75, 70) }],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'seltos',
    modelLabel: 'Kia Seltos',
    ...SRC('Seltos', 'Kia-Germany-Seltos-Preisliste.txt'),
    variants: [{ trimLabel: 'Alle Varianten', towing: tow(1300, 750, 100, 100) }],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'xceed',
    modelLabel: 'Kia XCeed',
    ...SRC('XCeed', 'Kia-Germany-XCeed_Pricelist.txt'),
    variants: [
      { trimLabel: '1.0 T-GDI', towing: tow(1010, 500, 75, 80) },
      { trimLabel: '1.5 T-GDI', towing: tow(1010, 300, 75, 80) },
      { trimLabel: 'Plug-in-Hybrid', towing: tow(1410, 600, 75, 80) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'k4',
    modelLabel: 'Kia K4',
    ...SRC('K4', 'Kia-Germany-K4-Preisliste.txt'),
    variants: [
      { trimLabel: '1.6 T-GDI', towing: tow(1010, 500, 75) },
      { trimLabel: '1.0 T-GDI', towing: tow(710, 300, 75) },
      { trimLabel: 'Plug-in-Hybrid', towing: tow(1410, 600, 75) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'sportage',
    modelLabel: 'Kia Sportage',
    ...SRC('Sportage', 'Kia-Germany-Sportage-Preisliste.txt'),
    variants: [
      { trimLabel: '1.6 T-GDI 2WD', driveType: 'FWD', towing: tow(1650, 750, 100, 100) },
      { trimLabel: '1.6 T-GDI 4WD', driveType: 'AWD', towing: tow(1510, 750, 100, 100) },
      { trimLabel: '1.6 T-GDI MHEV 4WD', driveType: 'AWD', towing: tow(1950, 750, 100, 100) },
      { trimLabel: '1.6 CRDi 4WD', driveType: 'AWD', towing: tow(1650, 750, 100, 100) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'sportage-phev',
    modelLabel: 'Kia Sportage Plug-in-Hybrid',
    ...SRC('Sportage PHEV', 'Kia-Germany-Sportage-PHEV-Preisliste.txt'),
    variants: [{ trimLabel: 'Plug-in-Hybrid', towing: tow(1210, 750, 100) }],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'k4-sportswagon',
    modelLabel: 'Kia K4 Sportswagon',
    ...SRC('K4 Sportswagon', 'Kia-Germany-K4-Sportswagon-Preisliste.txt'),
    verifiedBy: 'manual_pdf_ocr_review',
    notes: 'OCR-Preisliste; Gebremst 1.020 / 1.410 kg manuell verifiziert',
    variants: [
      { trimLabel: '1.6 T-GDI', towing: tow(1020, 500, 75) },
      { trimLabel: 'Plug-in-Hybrid', towing: tow(1410, 600, 75) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'sportage-hybrid',
    modelLabel: 'Kia Sportage Hybrid (MHEV)',
    sourceDocument: 'Kia Sportage Preisliste Deutschland',
    sourceFile: 'scripts/pdf-extract/Kia-Germany-Sportage-Preisliste.txt',
    sourceDate: '2026-01',
    variants: [
      { trimLabel: '1.6 T-GDI MHEV 4WD', driveType: 'AWD', towing: tow(1950, 750, 100, 100) },
    ],
    notes: 'Variante aus Sportage-Preisliste (MHEV-Spalte)',
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'sorento',
    modelLabel: 'Kia Sorento',
    ...SRC('Sorento', 'Kia-Germany-Sorento-pricelist.txt'),
    verifiedBy: 'manual_pdf_ocr_review',
    notes: 'OCR-Preisliste; Diesel-Varianten manuell verifiziert',
    variants: [
      { trimLabel: '2.5 CRDi AWD', driveType: 'AWD', towing: tow(2500, 750, 100, 100) },
      { trimLabel: '3.3 CRDi AWD', driveType: 'AWD', towing: tow(2800, 750, 100, 100) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'sorento-hybrid',
    modelLabel: 'Kia Sorento Hybrid',
    ...SRC('Sorento Hybrid', 'Kia-Germany-Sorento-Hybrid-pricelist.txt'),
    verifiedBy: 'manual_pdf_ocr_review',
    notes: 'OCR-Preisliste; Hybrid-Variante manuell verifiziert',
    variants: [
      { trimLabel: '2.5 GDI Hybrid AWD', driveType: 'AWD', towing: tow(2000, 750, 100, 100) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'sorento-phev',
    modelLabel: 'Kia Sorento Plug-in Hybrid',
    ...SRC('Sorento PHEV', 'Kia-Germany-Sorento-PHEV-Preisliste.txt'),
    verifiedBy: 'manual_pdf_ocr_review',
    notes: 'OCR-Preisliste; PHEV-Variante manuell verifiziert',
    variants: [
      { trimLabel: '2.5 GDI Plug-in Hybrid AWD', driveType: 'AWD', towing: tow(2500, 750, 100, 100) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev2',
    modelLabel: 'Kia EV2',
    ...SRC('EV2', 'Kia-Germany-EV2-Preisliste.txt'),
    variants: [
      { trimLabel: '42,2 kWh', batteryKwh: 42.2, towing: tow(750, 750, 100, 70) },
      { trimLabel: '61,0 kWh', batteryKwh: 61.0, towing: tow(750, 750, 100, 70) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev3',
    modelLabel: 'Kia EV3',
    ...SRC('EV3', 'Kia-Germany-EV3-Preisliste.txt'),
    variants: [
      { trimLabel: '58,3 kWh FWD', batteryKwh: 58.3, driveType: 'FWD', towing: tow(500, 500, 100, 80) },
      { trimLabel: '81,4 kWh FWD', batteryKwh: 81.4, driveType: 'FWD', powerPs: 204, towing: tow(1000, 750, 100, 80) },
      { trimLabel: '81,4 kWh AWD', batteryKwh: 81.4, driveType: 'AWD', towing: tow(1500, 750, 100, 80) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev4',
    modelLabel: 'Kia EV4',
    ...SRC('EV4', 'Kia-Germany-EV4-Preisliste.txt'),
    variants: [
      { trimLabel: 'Standardbatterie', towing: tow(500, 500, 100, 80) },
      { trimLabel: 'Long Range', powerPs: 204, driveType: 'FWD', towing: tow(1000, 750, 100, 80) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev4-fastback',
    modelLabel: 'Kia EV4 Fastback',
    ...SRC('EV4 Fastback', 'Kia-Germany-EV4-Fastback-Preisliste.txt'),
    variants: [
      { trimLabel: 'Standardbatterie', towing: tow(500, 500, 100, 80) },
      { trimLabel: 'Long Range', powerPs: 204, driveType: 'FWD', towing: tow(1000, 750, 100, 80) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev5',
    modelLabel: 'Kia EV5',
    ...SRC('EV5', 'Kia-Germany-EV5-Preisliste.txt'),
    variants: [
      { trimLabel: 'FWD (Air / Earth / GT-Line)', powerPs: 218, powerKw: 160, driveType: 'FWD', towing: tow(1200, 750, 100, 100) },
      { trimLabel: 'AWD (GT-Line)', powerPs: 265, powerKw: 195, driveType: 'AWD', towing: tow(1800, 750, 100, 100) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev5-gt',
    modelLabel: 'Kia EV5 GT',
    ...SRC('EV5 GT', 'Kia-Germany-EV5-GT-Preisliste.txt'),
    variants: [
      { trimLabel: 'GT', powerPs: 306, powerKw: 225, driveType: 'AWD', towing: tow(1800, 750, 100, 100) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev6',
    modelLabel: 'Kia EV6',
    ...SRC('EV6', 'Kia-Germany-EV6_Pricelist.txt'),
    variants: [
      { trimLabel: 'RWD', powerPs: 229, driveType: 'RWD', towing: tow(750, 750, 100, 80) },
      { trimLabel: 'AWD', driveType: 'AWD', towing: tow(1800, 750, 100, 80) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev6-gt',
    modelLabel: 'Kia EV6 GT',
    ...SRC('EV6 GT', 'Kia-Germany-EV6-GT-Pricelist.txt'),
    variants: [
      { trimLabel: 'GT', powerPs: 585, driveType: 'AWD', towing: tow(1800, 750, 100, 80) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev9',
    modelLabel: 'Kia EV9',
    ...SRC('EV9', 'Kia-Germany-EV9-Preisliste.txt'),
    variants: [
      { trimLabel: 'RWD', powerPs: 204, driveType: 'RWD', towing: tow(900, 450, 45, 70) },
      { trimLabel: 'AWD', driveType: 'AWD', towing: tow(2500, 750, 125, 70) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'ev9-gt',
    modelLabel: 'Kia EV9 GT',
    ...SRC('EV9 GT', 'Kia-Germany-EV9-GT-Preisliste.txt'),
    variants: [
      { trimLabel: 'GT', powerPs: 385, driveType: 'AWD', towing: tow(2500, 750, 125, 70) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'pv5-passenger',
    modelLabel: 'Kia PV5 Passenger',
    ...SRC('PV5 Passenger', 'Kia-Germany-PV5-Passenger-Preisliste.txt'),
    variants: [
      { trimLabel: 'Standard', towing: tow(750, 750, 75, 100) },
      { trimLabel: 'Long Range', towing: tow(1500, 750, 150, 100) },
    ],
  }),

  defineModelProfile({
    brandKey: 'kia',
    brand: 'Kia',
    modelKey: 'pv5-cargo',
    modelLabel: 'Kia PV5 Cargo',
    ...SRC('PV5 Cargo', 'Kia-Germany-PV5-Cargo-Preisliste.txt'),
    variants: [
      { trimLabel: 'Cargo', towing: tow(750, 750, 75, 100) },
    ],
  }),
];
