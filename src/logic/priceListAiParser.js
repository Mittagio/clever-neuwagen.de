import { change } from '../data/priceListImport.js';
import { getTemplateChanges } from '../data/priceListTemplates.js';
import { resolveBrandId, getCurrentPriceSnapshot } from '../data/vehicleCatalogStore.js';

function parseEuroFromText(text) {
  const m = String(text).match(/(\d{1,3}(?:[.\s]\d{3})*)\s*€?/);
  if (!m) return null;
  return Number(m[1].replace(/[.\s]/g, ''));
}

/**
 * Heuristische CSV-Zeilen-Erkennung (Ausstattungslinie;Preis)
 */
export function parseCsvRows(text, meta, modelYear) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results = [];
  const snapshot = getCurrentPriceSnapshot(resolveBrandId(meta.brand), meta.model.toLowerCase().replace(/\s+/g, '-'));

  for (const line of lines.slice(0, 80)) {
    const parts = line.includes(';') ? line.split(';') : line.split(',');
    if (parts.length < 2) continue;
    const label = parts[0].replace(/"/g, '').trim();
    const priceStr = parts[1].replace(/"/g, '').trim();
    if (!label || label.length < 2) continue;
    const price = parseEuroFromText(priceStr);
    if (price == null || price < 10000) continue;

    const oldVal = snapshot[label] ?? '–';
    const newVal = `${price.toLocaleString('de-DE')} €`;
    if (oldVal !== newVal) {
      results.push(change(`csv-${results.length}`, 'price', label, oldVal, newVal, `${meta.brand} ${meta.model}`));
    }
  }
  return results;
}

/**
 * KI-Parser-Pipeline (Demo): Datei + Meta → strukturierte Änderungen
 */
export function parsePriceListWithAi({ format, text, fileName }, meta) {
  const brandId = resolveBrandId(meta.brand);
  const modelSlug = meta.model.toLowerCase().replace(/\s+/g, '-');
  let changes = [];

  if (format === 'csv' && text) {
    changes = parseCsvRows(text, meta, meta.modelYear);
  }

  if (changes.length < 2) {
    changes = getTemplateChanges(brandId, meta.model, meta.modelYear, fileName);
  }

  const snapshot = getCurrentPriceSnapshot(brandId, modelSlug);
  changes = changes.map((ch) => {
    if (ch.type === 'price' && ch.oldValue === '–' && snapshot[ch.field]) {
      return { ...ch, oldValue: snapshot[ch.field] };
    }
    return ch;
  });

  const detected = {
    models: [meta.model],
    trims: changes.filter((c) => c.type === 'price').map((c) => c.field),
    colors: changes.filter((c) => c.type === 'color').length,
    packages: changes.filter((c) => c.type === 'package').length,
    wltp: changes.filter((c) => c.type === 'wltp').length,
    ranges: changes.filter((c) => c.field?.includes('Reichweite')).length,
  };

  return {
    changes,
    detected,
    parserVersion: 'ki-v1-demo',
    format,
  };
}
