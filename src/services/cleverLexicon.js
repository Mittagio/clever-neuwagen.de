import { listCleverRecords } from '../data/clever/cleverDataRegistry.js';
import { CLEVER_FEATURE_STATUS as S } from '../data/clever/cleverVehicleRecord.js';

export const LEXICON_EXAMPLE_CHIPS = [
  { id: 'ev2-battery', label: 'EV2 Batterie', query: 'EV2 Batterie' },
  { id: 'ev3-range', label: 'EV3 Reichweite', query: 'EV3 Reichweite' },
  { id: 'sportage-trunk', label: 'Sportage Kofferraum', query: 'Sportage Kofferraum' },
  { id: 'stonic-length', label: 'Stonic Länge', query: 'Stonic Länge' },
  { id: 'ev5-charge', label: 'EV5 Ladeleistung', query: 'EV5 Ladeleistung' },
  { id: 'xceed-tow', label: 'XCeed Anhängelast', query: 'XCeed Anhängelast' },
];

const MODEL_PATTERNS = [
  { key: 'ev2', patterns: [/\bev\s*2\b/i, /\bev2\b/i] },
  { key: 'ev3', patterns: [/\bev\s*3\b/i, /\bev3\b/i] },
  { key: 'ev4', patterns: [/\bev\s*4\b/i, /\bev4\b/i] },
  { key: 'ev5', patterns: [/\bev\s*5\b/i, /\bev5\b/i] },
  { key: 'ev6', patterns: [/\bev\s*6\b/i, /\bev6\b/i] },
  { key: 'ev9', patterns: [/\bev\s*9\b/i, /\bev9\b/i] },
  { key: 'sportage', patterns: [/sportage/i] },
  { key: 'stonic', patterns: [/stonic/i] },
  { key: 'xceed', patterns: [/x\s*ceed/i, /\bxceed\b/i, /\bxceed\b/i] },
  { key: 'ceed', patterns: [/\bceed\b/i] },
  { key: 'niro', patterns: [/niro/i] },
  { key: 'picanto', patterns: [/picanto/i] },
  { key: 'sorento', patterns: [/sorento/i] },
];

const COMFORT_LABELS = {
  standard: 'Serie',
  package: 'Im Paket',
  accessory: 'Zubehör',
  missing: 'Nicht verfügbar',
  unknown: 'Bitte im Katalog prüfen',
};

/** Demo-Werte wenn Stammdaten noch keine DC-Ladeleistung haben */
const DEMO_DC_KW = {
  ev2: 100,
  ev3: 128,
  ev4: 150,
  ev5: 350,
  ev6: 350,
  ev9: 350,
};

function detectModelKey(query) {
  const text = query.trim();
  for (const { key, patterns } of MODEL_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return key;
  }
  return null;
}

function detectTopic(query) {
  const text = query.toLowerCase();
  if (/batterie|battery|kwh/.test(text)) return 'battery';
  if (/reichweite|range|wltp/.test(text)) return 'range';
  if (/kofferraum|trunk|gepäck|kofferraumvolumen/.test(text)) return 'trunk';
  if (/länge|laenge|length|lang\b/.test(text)) return 'length';
  if (/breite|width/.test(text)) return 'width';
  if (/höhe|hoehe|height/.test(text)) return 'height';
  if (/anhängelast|anhaenger|anhänger|towing|zuglast/.test(text)) return 'towing';
  if (/ladeleistung|schnelllad|dc-lad|laden\b/.test(text)) return 'charging';
  if (/sitzheizung|heated|sitz.?heiz/.test(text)) return 'heatedSeats';
  if (/ausstattung|serienausstattung|equipment/.test(text)) return 'equipment';
  if (/motor|antrieb|ps\b|kw\b/.test(text)) return 'powertrain';
  return null;
}

function findRecord(modelKey) {
  const records = listCleverRecords();
  return records.find((r) => r.modelKey === modelKey && !r.trimId)
    ?? records.find((r) => r.modelKey === modelKey)
    ?? null;
}

function formatMm(mm) {
  if (mm == null) return null;
  return `${(mm / 1000).toFixed(2).replace('.', ',')} m (${mm.toLocaleString('de-DE')} mm)`;
}

function formatLiters(l) {
  if (l == null) return null;
  return `${l.toLocaleString('de-DE')} Liter`;
}

function formatBattery(record) {
  const e = record.electric;
  if (!e) return null;
  if (e.batteryNetKwh) return `${e.batteryNetKwh} kWh netto${e.batteryGrossKwh ? ` (${e.batteryGrossKwh} kWh brutto)` : ''}`;
  if (e.batteryGrossKwh) return `${e.batteryGrossKwh} kWh`;
  if (e.batteryOptionsKwh?.length) {
    return e.batteryOptionsKwh.map((k) => `${k} kWh`).join(' / ');
  }
  return null;
}

function buildExtras(record) {
  const lines = [];
  const d = record.dimensions;
  const f = record.family;
  const e = record.electric;
  const t = record.towing;

  if (d?.lengthMm) lines.push({ label: 'Länge', value: formatMm(d.lengthMm) });
  if (d?.widthMm) lines.push({ label: 'Breite', value: formatMm(d.widthMm) });
  if (d?.heightMm) lines.push({ label: 'Höhe', value: formatMm(d.heightMm) });
  if (f?.trunkL) lines.push({ label: 'Kofferraum', value: formatLiters(f.trunkL) });
  if (e?.wltpRangeKm) lines.push({ label: 'Reichweite (WLTP)', value: `${e.wltpRangeKm} km` });
  const bat = formatBattery(record);
  if (bat) lines.push({ label: 'Batterie', value: bat });
  if (t?.brakedKg) lines.push({ label: 'Anhängelast gebremst', value: `${t.brakedKg.toLocaleString('de-DE')} kg` });
  if (record.comfort?.heatedSeats) {
    lines.push({
      label: 'Sitzheizung vorn',
      value: COMFORT_LABELS[record.comfort.heatedSeats] ?? COMFORT_LABELS.unknown,
    });
  }
  return lines;
}

function resolveAnswer(record, topic) {
  const modelTitle = `Kia ${record.model}`;
  const source = record.basis?.priceListSource
    ? `Quelle: ${record.basis.priceListSource}`
    : 'Quelle: Clever-Stammdaten · Stand Demo';

  switch (topic) {
    case 'battery': {
      const value = formatBattery(record);
      return value
        ? { modelTitle, fieldLabel: 'Batterie', answer: value, source, extras: buildExtras(record) }
        : { modelTitle, fieldLabel: 'Batterie', answer: 'Keine Batteriedaten hinterlegt.', source, extras: buildExtras(record) };
    }
    case 'range': {
      const km = record.electric?.wltpRangeKm;
      return {
        modelTitle,
        fieldLabel: 'Reichweite',
        answer: km ? `${km} km (WLTP)` : 'Reichweite noch nicht hinterlegt.',
        source,
        extras: buildExtras(record),
      };
    }
    case 'trunk': {
      const l = record.family?.trunkL;
      return {
        modelTitle,
        fieldLabel: 'Kofferraum',
        answer: l ? formatLiters(l) : 'Kofferraumvolumen noch nicht hinterlegt.',
        source,
        extras: buildExtras(record),
      };
    }
    case 'length':
      return {
        modelTitle,
        fieldLabel: 'Fahrzeuglänge',
        answer: formatMm(record.dimensions?.lengthMm) ?? 'Länge noch nicht hinterlegt.',
        source,
        extras: buildExtras(record),
      };
    case 'width':
      return {
        modelTitle,
        fieldLabel: 'Breite',
        answer: formatMm(record.dimensions?.widthMm) ?? 'Breite noch nicht hinterlegt.',
        source,
        extras: buildExtras(record),
      };
    case 'height':
      return {
        modelTitle,
        fieldLabel: 'Höhe',
        answer: formatMm(record.dimensions?.heightMm) ?? 'Höhe noch nicht hinterlegt.',
        source,
        extras: buildExtras(record),
      };
    case 'towing': {
      const kg = record.towing?.brakedKg;
      return {
        modelTitle,
        fieldLabel: 'Anhängelast (gebremst)',
        answer: kg ? `${kg.toLocaleString('de-DE')} kg` : 'Anhängelast noch nicht hinterlegt.',
        source,
        extras: buildExtras(record),
      };
    }
    case 'charging': {
      const dc = record.electric?.dcKw ?? DEMO_DC_KW[record.modelKey];
      return {
        modelTitle,
        fieldLabel: 'Ladeleistung (DC)',
        answer: dc ? `bis ${dc} kW (Schnellladung)` : 'Ladeleistung noch nicht hinterlegt.',
        source: dc && !record.electric?.dcKw ? 'Quelle: Clever-Demo · Stammdaten folgen' : source,
        extras: buildExtras(record),
      };
    }
    case 'heatedSeats':
      return {
        modelTitle,
        fieldLabel: 'Sitzheizung vorn',
        answer: COMFORT_LABELS[record.comfort?.heatedSeats] ?? COMFORT_LABELS.unknown,
        source,
        extras: buildExtras(record),
      };
    case 'powertrain':
      return {
        modelTitle,
        fieldLabel: 'Antrieb',
        answer: record.basis?.powertrain
          ? String(record.basis.powertrain).replace('elektro', 'Elektro').replace('plugin-hybrid', 'Plug-in-Hybrid')
          : 'Antrieb nicht hinterlegt.',
        source,
        extras: buildExtras(record),
      };
    case 'equipment': {
      const feats = Object.entries(record.comfort ?? {})
        .filter(([, v]) => v === S.STANDARD)
        .map(([k]) => k)
        .slice(0, 6);
      return {
        modelTitle,
        fieldLabel: 'Ausstattung',
        answer: feats.length
          ? `Serie u. a.: ${feats.join(', ')}`
          : 'Ausstattungsdetails bitte im Katalog prüfen.',
        source,
        extras: buildExtras(record),
      };
    }
    default:
      return {
        modelTitle,
        fieldLabel: 'Übersicht',
        answer: 'Technische Eckdaten – Details unten.',
        source,
        extras: buildExtras(record),
      };
  }
}

/**
 * Clever-Lexikon-Suche – nutzt Clever-Stammdaten, Demo-Fallback wo nötig.
 * @param {string} query
 * @returns {{ ok: boolean, question: string, error?: string, result?: object }}
 */
export function searchCleverLexicon(query) {
  const question = query.trim();
  if (!question) {
    return { ok: false, question, error: 'Bitte eine Frage eingeben.' };
  }

  const modelKey = detectModelKey(question);
  const topic = detectTopic(question);

  if (!modelKey) {
    return {
      ok: false,
      question,
      error: 'Modell nicht erkannt. Bitte z. B. „EV3 Batterie“ oder „Sportage Kofferraum“ eingeben.',
    };
  }

  const record = findRecord(modelKey);
  if (!record) {
    return {
      ok: false,
      question,
      error: `Keine Stammdaten für Kia ${modelKey.toUpperCase()} gefunden.`,
    };
  }

  const resolved = resolveAnswer(record, topic ?? 'overview');

  return {
    ok: true,
    question,
    result: {
      ...resolved,
      modelKey,
      topic: topic ?? 'overview',
    },
  };
}
