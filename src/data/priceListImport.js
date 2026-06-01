/** @typedef {'price' | 'color' | 'package' | 'wltp' | 'equipment' | 'engine'} ImportChangeType */
/** @typedef {'pending' | 'analyzing' | 'review' | 'approved' | 'rejected'} ImportStatus */

/**
 * @typedef {Object} PriceListChange
 * @property {string} id
 * @property {ImportChangeType} type
 * @property {string} field
 * @property {string} oldValue
 * @property {string} newValue
 * @property {string} [group]
 */

/**
 * @typedef {Object} PriceListImport
 * @property {string} id
 * @property {string} brand
 * @property {string} model
 * @property {string} modelYear
 * @property {string} version
 * @property {string} uploadedAt
 * @property {ImportStatus} status
 * @property {PriceListChange[]} changes
 * @property {{ name: string, size: number, type: string }} sourceFile
 * @property {boolean} approved
 * @property {string|null} approvedAt
 * @property {{ priceChanges: number, newColors: number, newPackages: number, wltpUpdated: boolean }|null} analysisSummary
 */

export const IMPORT_BRANDS = [
  { id: 'kia', label: 'Kia' },
  { id: 'hyundai', label: 'Hyundai' },
  { id: 'toyota', label: 'Toyota' },
  { id: 'vw', label: 'VW' },
  { id: 'bmw', label: 'BMW' },
  { id: 'mercedes', label: 'Mercedes' },
];

export const IMPORT_STATUS_LABELS = {
  pending: 'Wartend',
  analyzing: 'Analyse läuft…',
  review: 'Freigabe ausstehend',
  approved: 'Übernommen',
  rejected: 'Abgelehnt',
};

export const CHANGE_TYPE_LABELS = {
  price: 'Preis',
  color: 'Farbe',
  package: 'Paket',
  wltp: 'WLTP',
  equipment: 'Ausstattung',
  engine: 'Motor',
};

export const STORAGE_KEY = 'clever-neuwagen-price-list-imports';

export function buildVersionString(modelYear, date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${modelYear}.${month}`;
}

export function formatImportDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatImportDateTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function change(id, type, field, oldValue, newValue, group) {
  return { id, type, field, oldValue, newValue, group };
}

/** Demo-Historie – bereits freigegebene Importe */
export const DEMO_IMPORT_HISTORY = [
  {
    id: 'imp-demo-1',
    brand: 'Kia',
    model: 'Sportage',
    modelYear: '2026',
    version: '2026.05',
    uploadedAt: '2026-05-29T10:30:00.000Z',
    status: 'approved',
    approved: true,
    approvedAt: '2026-05-29T11:15:00.000Z',
    sourceFile: { name: 'Kia_Sportage_Preisliste_2026-05.pdf', size: 2840000, type: 'application/pdf' },
    analysisSummary: { priceChanges: 8, newColors: 2, newPackages: 1, wltpUpdated: true },
    changes: [],
  },
  {
    id: 'imp-demo-2',
    brand: 'Kia',
    model: 'EV4',
    modelYear: '2026',
    version: '2026.07',
    uploadedAt: '2026-07-15T14:00:00.000Z',
    status: 'approved',
    approved: true,
    approvedAt: '2026-07-15T15:20:00.000Z',
    sourceFile: { name: 'Kia_EV4_Preisliste_2026-07.pdf', size: 1920000, type: 'application/pdf' },
    analysisSummary: { priceChanges: 4, newColors: 1, newPackages: 1, wltpUpdated: true },
    changes: [],
  },
];

/** Mock-Änderungen für Analyse-Demo (Sportage 2027) */
export function getMockChangesForModel(model, modelYear) {
  const label = `${model} ${modelYear}`;
  return [
    change('c1', 'price', 'Vision', '36.490 €', '36.990 €', label),
    change('c2', 'price', 'Pulse', '39.490 €', '39.990 €', label),
    change('c3', 'price', 'GT-Line', '44.990 €', '45.490 €', label),
    change('c4', 'color', 'Farbe', 'Wolfgrau', 'Steel Grey', label),
    change('c5', 'package', 'Paket', 'P4 Panorama', 'P4 Panorama Plus', label),
    change('c6', 'package', 'Paket', 'Winterpaket', 'Winterpaket Pro', label),
    change('c7', 'wltp', 'WLTP 1.6 T-GDI', '6,4 l/100 km', '6,2 l/100 km', label),
    change('c8', 'wltp', 'CO₂ 1.6 T-GDI', '145 g/km', '141 g/km', label),
  ];
}

export function countApprovedChanges(imp) {
  if (imp.analysisSummary) {
    const s = imp.analysisSummary;
    return s.priceChanges + s.newColors + s.newPackages + (s.wltpUpdated ? 1 : 0);
  }
  return imp.changes?.length ?? 0;
}

export function createImportRecord(meta, file, analysisResult) {
  const now = new Date().toISOString();
  return {
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    brand: meta.brand,
    model: meta.model,
    modelYear: meta.modelYear,
    version: buildVersionString(meta.modelYear),
    uploadedAt: now,
    status: 'review',
    changes: analysisResult.changes,
    sourceFile: {
      name: file.name,
      size: file.size,
      type: file.type,
    },
    approved: false,
    approvedAt: null,
    analysisSummary: analysisResult.summary,
    fileFormat: analysisResult.fileFormat ?? null,
    parserVersion: analysisResult.parserVersion ?? null,
  };
}
