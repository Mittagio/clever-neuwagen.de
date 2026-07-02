/**
 * Kia PDF-Quellen → modelKey (alle bekannten Preislisten).
 * Synchron mit scripts/import-kia-pricelist-pdfs.mjs FILE_META halten.
 */

export const KIA_PRICELIST_BASE_URL =
  'https://www.kia.com/content/dam/kwcms/kme/de/de/assets/contents/utility/Preisliste/';

/**
 * @param {string} stem
 */
export function buildKiaPdfDownloadUrl(stem) {
  return `${KIA_PRICELIST_BASE_URL}${stem}.pdf`;
}

/** @typedef {{ modelKey: string, model: string, variant: string, file: string, stem: string, pdfFile: string, downloadUrl: string }} KiaPdfSourceEntry */

/**
 * @param {Omit<KiaPdfSourceEntry, 'pdfFile' | 'downloadUrl'>} entry
 * @returns {KiaPdfSourceEntry}
 */
function withDownload(entry) {
  return {
    ...entry,
    pdfFile: `${entry.stem}.pdf`,
    downloadUrl: buildKiaPdfDownloadUrl(entry.stem),
  };
}

/** @type {KiaPdfSourceEntry[]} */
export const KIA_PDF_SOURCE_CATALOG = [
  withDownload({ stem: 'Kia-Germany-Picanto_Preisliste', file: 'Kia-Germany-Picanto_Preisliste.txt', modelKey: 'picanto', model: 'Picanto', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-Stonic-Preisliste', file: 'Kia-Germany-Stonic-Preisliste.txt', modelKey: 'stonic', model: 'Stonic', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-XCeed_Pricelist', file: 'Kia-Germany-XCeed_Pricelist.txt', modelKey: 'xceed', model: 'XCeed', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-K4-Preisliste', file: 'Kia-Germany-K4-Preisliste.txt', modelKey: 'k4', model: 'K4', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-K4-Sportswagon-Preisliste', file: 'Kia-Germany-K4-Sportswagon-Preisliste.txt', modelKey: 'k4-sportswagon', model: 'K4 Sportswagon', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-Seltos-Preisliste', file: 'Kia-Germany-Seltos-Preisliste.txt', modelKey: 'seltos', model: 'Seltos', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-Sportage-Preisliste', file: 'Kia-Germany-Sportage-Preisliste.txt', modelKey: 'sportage', model: 'Sportage', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-Sportage-PHEV-Preisliste', file: 'Kia-Germany-Sportage-PHEV-Preisliste.txt', modelKey: 'sportage-phev', model: 'Sportage Plug-in Hybrid', variant: 'phev' }),
  withDownload({ stem: 'Kia-Germany-Sorento-pricelist', file: 'Kia-Germany-Sorento-pricelist.txt', modelKey: 'sorento', model: 'Sorento', variant: 'verbrenner' }),
  withDownload({ stem: 'Kia-Germany-Sorento-Hybrid-pricelist', file: 'Kia-Germany-Sorento-Hybrid-pricelist.txt', modelKey: 'sorento-hybrid', model: 'Sorento Hybrid', variant: 'hybrid' }),
  withDownload({ stem: 'Kia-Germany-Sorento-PHEV-Preisliste', file: 'Kia-Germany-Sorento-PHEV-Preisliste.txt', modelKey: 'sorento-phev', model: 'Sorento Plug-in Hybrid', variant: 'phev' }),
  withDownload({ stem: 'Kia-Germany-EV2-Preisliste', file: 'Kia-Germany-EV2-Preisliste.txt', modelKey: 'ev2', model: 'EV2', variant: 'elektro' }),
  withDownload({ stem: 'Kia-Germany-EV3-Preisliste', file: 'Kia-Germany-EV3-Preisliste.txt', modelKey: 'ev3', model: 'EV3', variant: 'elektro' }),
  withDownload({ stem: 'Kia-Germany-EV4-Preisliste', file: 'Kia-Germany-EV4-Preisliste.txt', modelKey: 'ev4', model: 'EV4', variant: 'elektro' }),
  withDownload({ stem: 'Kia-Germany-EV4-Fastback-Preisliste', file: 'Kia-Germany-EV4-Fastback-Preisliste.txt', modelKey: 'ev4-fastback', model: 'EV4 Fastback', variant: 'elektro' }),
  withDownload({ stem: 'Kia-Germany-EV5-Preisliste', file: 'Kia-Germany-EV5-Preisliste.txt', modelKey: 'ev5', model: 'EV5', variant: 'elektro' }),
  withDownload({ stem: 'Kia-Germany-EV5-GT-Preisliste', file: 'Kia-Germany-EV5-GT-Preisliste.txt', modelKey: 'ev5-gt', model: 'EV5 GT', variant: 'elektro-gt' }),
  withDownload({ stem: 'Kia-Germany-EV6_Pricelist', file: 'Kia-Germany-EV6_Pricelist.txt', modelKey: 'ev6', model: 'EV6', variant: 'elektro' }),
  withDownload({ stem: 'Kia-Germany-EV6-GT-Pricelist', file: 'Kia-Germany-EV6-GT-Pricelist.txt', modelKey: 'ev6-gt', model: 'EV6 GT', variant: 'elektro-gt' }),
  withDownload({ stem: 'Kia-Germany-EV9-Preisliste', file: 'Kia-Germany-EV9-Preisliste.txt', modelKey: 'ev9', model: 'EV9', variant: 'elektro' }),
  withDownload({ stem: 'Kia-Germany-EV9-GT-Preisliste', file: 'Kia-Germany-EV9-GT-Preisliste.txt', modelKey: 'ev9-gt', model: 'EV9 GT', variant: 'elektro-gt' }),
  withDownload({ stem: 'Kia-Germany-PV5-Passenger-Preisliste', file: 'Kia-Germany-PV5-Passenger-Preisliste.txt', modelKey: 'pv5-passenger', model: 'PV5 Passenger', variant: 'nutzfahrzeug' }),
  withDownload({ stem: 'Kia-Germany-PV5-Cargo-Preisliste', file: 'Kia-Germany-PV5-Cargo-Preisliste.txt', modelKey: 'pv5-cargo', model: 'PV5 Cargo', variant: 'nutzfahrzeug' }),
];

/** Modell-Keys ohne geprüftes Profil – PDF oft online verfügbar. */
export const KIA_MODELS_PENDING_PDF = [
  {
    modelKey: 'ceed',
    model: 'Ceed',
    note: 'Preisliste online – Profil noch nicht importiert',
    stem: 'Kia-Germany-Ceed-Preisliste',
    downloadUrl: buildKiaPdfDownloadUrl('Kia-Germany-Ceed-Preisliste'),
  },
  {
    modelKey: 'niro',
    model: 'Niro',
    note: 'Preisliste online – Profil noch nicht importiert',
    stem: 'Kia-Germany-Niro-HEV-Preisliste',
    downloadUrl: buildKiaPdfDownloadUrl('Kia-Germany-Niro-HEV-Preisliste'),
  },
  {
    modelKey: 'niro-hybrid',
    model: 'Niro Hybrid',
    note: 'Gleiche HEV-Preisliste wie Niro',
    stem: 'Kia-Germany-Niro-HEV-Preisliste',
    downloadUrl: buildKiaPdfDownloadUrl('Kia-Germany-Niro-HEV-Preisliste'),
  },
  {
    modelKey: 'pv5-crew',
    model: 'PV5 Crew',
    note: 'PV5 Passenger als Referenz nutzbar',
    downloadUrl: null,
  },
  {
    modelKey: 'pv5-chassis-cab',
    model: 'PV5 Chassis Cab',
    note: 'PV5 Cargo als Referenz nutzbar',
    downloadUrl: null,
  },
];

/** @type {Record<string, string>} */
export const KIA_MODEL_KEY_ALIASES = {
  'pv5-cargo-l2h1': 'pv5-cargo',
};

/**
 * @param {string} modelKey
 */
export function resolveKiaModelKey(modelKey) {
  return KIA_MODEL_KEY_ALIASES[modelKey] ?? modelKey;
}

/**
 * @param {string} stem
 */
export function getKiaCatalogEntryByStem(stem) {
  return KIA_PDF_SOURCE_CATALOG.find((entry) => entry.stem === stem) ?? null;
}
