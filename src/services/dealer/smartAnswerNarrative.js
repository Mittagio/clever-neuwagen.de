/**
 * Verkäufer-Sprache für Smart-Answer – Daten interpretieren, nicht nur anzeigen.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { resolveElectricSpecs } from '../../data/kia/pricelistBatteryLookup.js';

export const SMART_ANSWER_KICKER = 'Clever Antwort';

export function shortModelName(modelKey) {
  return KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? String(modelKey).toUpperCase();
}

function formatMm(mm) {
  if (mm == null) return null;
  return `${(mm / 1000).toFixed(2).replace('.', ',')} m`;
}

function formatTon(kg) {
  if (kg == null) return null;
  const t = Math.round(kg / 100) / 10;
  return `${t.toString().replace('.', ',')} t`;
}

function formatKwh(kwh) {
  if (kwh == null) return null;
  const rounded = Math.round(kwh * 10) / 10;
  return rounded.toString().replace('.', ',');
}

function powertrainPhrase(record) {
  const pt = record?.basis?.powertrain ?? KIA_MODEL_ATTRIBUTES[record?.modelKey]?.fuel;
  if (pt === 'elektro' || pt === 'electric') return 'vollelektrisch';
  if (pt === 'plugin-hybrid') return 'Plug-in-Hybrid';
  if (pt === 'hybrid') return 'Hybrid verfügbar';
  if (pt === 'verbrenner' || pt === 'combustion') return 'Benzin/Diesel';
  return null;
}

export function detectComparisonFocus(query = '') {
  const q = String(query).toLowerCase();
  if (/anh[aä]ng|wohnwagen|pferde|h[aä]nger|haenger|zuglast/.test(q)) return 'tow';
  if (/kofferraum|platz|kind|kinderwagen|hund/.test(q)) return 'trunk';
  if (/reichweite|elektro|strecke|weit/.test(q)) return 'range';
  if (/familie|sitz/.test(q)) return 'family';
  return 'general';
}

function buildModelCard(record, focus, { highlightTrunk = false } = {}) {
  const name = shortModelName(record.modelKey);
  const bullets = [];
  const pt = powertrainPhrase(record);

  if (record.towing?.brakedKg && (focus === 'tow' || focus === 'general' || focus === 'family')) {
    bullets.push(`${formatTon(record.towing.brakedKg)} Anhängelast`);
  }
  if (pt && (focus === 'tow' || focus === 'range' || focus === 'general')) {
    bullets.push(pt);
  }
  if (record.family?.trunkL != null && (focus === 'trunk' || focus === 'family' || focus === 'general')) {
    const trunkPhrase = highlightTrunk ? 'größerer Kofferraum' : `${record.family.trunkL} l Kofferraum`;
    bullets.push(trunkPhrase);
  }
  if (record.dimensions?.lengthMm && focus !== 'range') {
    bullets.push(`${formatMm(record.dimensions.lengthMm)} lang`);
  }
  if (record.electric?.wltpRangeKm && (focus === 'range' || focus === 'general')) {
    bullets.push(`${record.electric.wltpRangeKm} km Reichweite`);
  }
  if (record.family?.seats && focus === 'family') {
    bullets.push(`${record.family.seats} Sitze`);
  }

  const unique = [...new Set(bullets)].slice(0, 4);
  return { modelKey: record.modelKey, name, bullets: unique };
}

/**
 * @param {object} a Clever record
 * @param {object} b Clever record
 * @param {string} query
 */
export function narrateComparison(a, b, query = '') {
  const nameA = shortModelName(a.modelKey);
  const nameB = shortModelName(b.modelKey);
  const focus = detectComparisonFocus(query);
  const narrative = [];

  const towA = a.towing?.brakedKg;
  const towB = b.towing?.brakedKg;
  const trunkA = a.family?.trunkL;
  const trunkB = b.family?.trunkL;
  const tA = towA ? Math.round(towA / 100) / 10 : null;
  const tB = towB ? Math.round(towB / 100) / 10 : null;

  let lead = '';

  if (focus === 'tow') {
    lead = 'Für Anhängerbetrieb sind beide geeignet.';
    if (tA != null && tB != null && tA === tB) {
      narrative.push(`Beide Fahrzeuge dürfen bis zu ${formatTon(towA)} ziehen.`);
      narrative.push('Für Wohnwagen oder Pferdeanhänger sind beide in der Regel geeignet.');
      const ptA = powertrainPhrase(a);
      const ptB = powertrainPhrase(b);
      if (ptA === 'vollelektrisch' && ptB !== 'vollelektrisch') {
        narrative.push(`Der ${nameA} fährt elektrisch – der ${nameB} bietet ${ptB ?? 'Verbrenner-Hybrid'}.`);
      } else if (ptB === 'vollelektrisch' && ptA !== 'vollelektrisch') {
        narrative.push(`Der ${nameB} fährt elektrisch – der ${nameA} bietet ${ptA ?? 'Verbrenner-Hybrid'}.`);
      }
    } else if (tA != null && tB != null) {
      lead = 'Beide ziehen Anhänger – mit unterschiedlicher Zuladung.';
      narrative.push(`Der ${nameA} schafft ${formatTon(towA)}, der ${nameB} ${formatTon(towB)} Anhängelast.`);
    }
  } else if (focus === 'trunk' && trunkA != null && trunkB != null) {
    const bigger = trunkA >= trunkB ? nameA : nameB;
    const biggerL = Math.max(trunkA, trunkB);
    lead = `Beim Stauraum hat der ${bigger} die Nase vorn.`;
    narrative.push(`Der ${bigger} bietet bis zu ${biggerL} Liter Kofferraum.`);
    narrative.push('Für Kinderwagen und Alltagsgepäck reicht das bei beiden Modellen in der Regel.');
  } else if (focus === 'range') {
    lead = 'Beide Modelle im direkten Reichweiten-Vergleich.';
    if (a.electric?.wltpRangeKm && b.electric?.wltpRangeKm) {
      const longer = a.electric.wltpRangeKm >= b.electric.wltpRangeKm ? nameA : nameB;
      narrative.push(`Der ${longer} hat die längere WLTP-Reichweite.`);
    }
  } else if (focus === 'family') {
    lead = 'Beide eignen sich für den Familienalltag – mit unterschiedlichen Stärken.';
    narrative.push(`Der ${nameA} bietet ${a.family?.seats ?? '–'} Sitze, der ${nameB} ${b.family?.seats ?? '–'}.`);
  } else {
    lead = 'Hier die wichtigsten Unterschiede auf einen Blick.';
    narrative.push('Welches Modell besser passt, hängt von Ihrem Alltag ab.');
  }

  const highlightTrunkB = trunkB != null && trunkA != null && trunkB > trunkA;
  const highlightTrunkA = trunkA != null && trunkB != null && trunkA > trunkB;

  return {
    kicker: SMART_ANSWER_KICKER,
    title: `${nameA} oder ${nameB}?`,
    lead,
    narrative,
    modelCards: [
      buildModelCard(a, focus, { highlightTrunk: highlightTrunkA }),
      buildModelCard(b, focus, { highlightTrunk: highlightTrunkB }),
    ],
  };
}

/**
 * @param {object} record
 * @param {string} attribute
 * @param {string} [query]
 */
export function narrateAttribute(record, attribute, query = '') {
  const name = shortModelName(record.modelKey);
  const narrative = [];
  const facts = [];

  switch (attribute) {
    case 'length': {
      const len = formatMm(record.dimensions?.lengthMm);
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Wie lang ist der ${name}?`,
        lead: len ? `Der Kia ${name} ist ${len} lang.` : `Die Länge des ${name} prüfen wir gern im Detail.`,
        narrative: len
          ? ['Damit liegt er im kompakten Segment – gut für Stadt und Parkhaus.']
          : [],
        facts: len ? [{ label: 'Länge', value: len }] : [],
      };
    }
    case 'height': {
      const h = formatMm(record.dimensions?.heightMm);
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Wie hoch ist der ${name}?`,
        lead: h ? `Der Kia ${name} ist ${h} hoch.` : null,
        narrative: [],
        facts: h ? [{ label: 'Höhe', value: h }] : [],
      };
    }
    case 'range': {
      const wltp = record.electric?.wltpRangeKm;
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Wie weit kommt der ${name}?`,
        lead: wltp ? `Der Kia ${name} schafft bis zu ${wltp} km WLTP.` : `Reichweite des ${name} – Details im Angebot.`,
        narrative: wltp
          ? [
            record.electric?.realRangeSummerKm
              ? `Im Alltag rechnen Sie mit etwa ${record.electric.realRangeSummerKm} km.`
              : 'Die reale Reichweite hängt von Tempo, Wetter und Ladestil ab.',
          ]
          : [],
        facts: [
          wltp && { label: 'WLTP', value: `${wltp} km` },
          record.electric?.realRangeWinterKm && { label: 'Winter (ca.)', value: `${record.electric.realRangeWinterKm} km` },
        ].filter(Boolean),
      };
    }
    case 'trunk': {
      const l = record.family?.trunkL;
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Wie groß ist der Kofferraum?`,
        lead: l ? `Der Kia ${name} bietet ${l} Liter Kofferraum.` : null,
        narrative: l ? ['Damit passen Einkauf, Kinderwagen und Alltagsgepäck gut hinein.'] : [],
        facts: l ? [{ label: 'Kofferraum', value: `${l} Liter` }] : [],
      };
    }
    case 'tow': {
      const t = formatTon(record.towing?.brakedKg);
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Wie viel darf der ${name} ziehen?`,
        lead: t ? `Der Kia ${name} darf bis zu ${t} Anhängelast ziehen.` : null,
        narrative: t ? ['Für Wohnwagen und Pferdeanhänger reicht das oft aus – Details hängen vom konkreten Hänger ab.'] : [],
        facts: t ? [{ label: 'Anhängelast', value: t }] : [],
      };
    }
    case 'seats':
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Wie viele Sitze hat der ${name}?`,
        lead: record.family?.seats ? `Der Kia ${name} hat ${record.family.seats} Sitze.` : null,
        narrative: [],
        facts: record.family?.seats ? [{ label: 'Sitze', value: `${record.family.seats}` }] : [],
      };
    case 'price':
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Was kostet der ${name}?`,
        lead: record.basis?.listPriceGross
          ? `Der Kia ${name} startet ab ${record.basis.listPriceGross.toLocaleString('de-DE')} €.`
          : null,
        narrative: record.basis?.leasingRate
          ? [`Im Leasing ab ${record.basis.leasingRate} € pro Monat – je nach Laufzeit und Laufleistung.`]
          : [],
        facts: [
          record.basis?.listPriceGross && { label: 'Ab Preis', value: `${record.basis.listPriceGross.toLocaleString('de-DE')} €` },
          record.basis?.leasingRate && { label: 'Leasing ab', value: `${record.basis.leasingRate} €/Monat` },
        ].filter(Boolean),
      };
    case 'battery':
      return narrateBattery(record, resolveElectricSpecs(record));
    default:
      return {
        kicker: SMART_ANSWER_KICKER,
        title: `Kia ${name}`,
        lead: null,
        narrative: [],
        facts: [],
      };
  }
}

/**
 * @param {object} record
 * @param {object} electric – ggf. via resolveElectricSpecs angereichert
 */
export function narrateBattery(record, electric = {}) {
  const name = shortModelName(record.modelKey);
  const kwh = electric.batteryNetKwh ?? electric.batteryGrossKwh;
  const options = electric.batteryOptionsKwh?.filter((v) => v != null) ?? [];
  const wltp = electric.wltpRangeKm ?? record.electric?.wltpRangeKm;
  const narrative = [];
  const facts = [];

  let lead;

  if (options.length > 1) {
    const opts = options.map(formatKwh).join(' oder ');
    lead = `Der Kia ${name} ist mit ${opts} kWh Batterie erhältlich.`;
    narrative.push('Die genaue Kapazität hängt von der gewählten Ausstattungslinie ab.');
    facts.push({ label: 'Batterie', value: `${options.map(formatKwh).join(' / ')} kWh` });
  } else if (kwh != null) {
    lead = `Der Kia ${name} hat eine ${formatKwh(kwh)}-kWh-Batterie.`;
    narrative.push('Kompakte Kapazität für Stadt und Pendeln – mit schnellem Laden im Alltag.');
    facts.push({ label: 'Batterie', value: `${formatKwh(kwh)} kWh` });
  } else {
    lead = `Die Batterie des Kia ${name} – Details je nach Ausstattung.`;
    narrative.push('Im Angebot sehen Sie die Kapazität des konkreten Fahrzeugs.');
  }

  if (wltp) {
    narrative.push(`Die WLTP-Reichweite liegt bei bis zu ${wltp} km.`);
    facts.push({ label: 'WLTP', value: `${wltp} km` });
  }

  return {
    kicker: SMART_ANSWER_KICKER,
    title: `Wie groß ist die Batterie beim ${name}?`,
    lead,
    narrative,
    facts,
  };
}

export function narrateDimensionsOverview(record, query = '') {
  const name = shortModelName(record.modelKey);
  const len = formatMm(record.dimensions?.lengthMm);
  const asksLength = /\bwie\s+lang\b/i.test(query);
  const facts = [];
  if (record.dimensions?.lengthMm) facts.push({ label: 'Länge', value: formatMm(record.dimensions.lengthMm) });
  if (record.dimensions?.widthMm) facts.push({ label: 'Breite', value: formatMm(record.dimensions.widthMm) });
  if (record.dimensions?.heightMm) facts.push({ label: 'Höhe', value: formatMm(record.dimensions.heightMm) });
  if (record.family?.trunkL) facts.push({ label: 'Kofferraum', value: `${record.family.trunkL} Liter` });
  if (record.electric?.wltpRangeKm) facts.push({ label: 'WLTP', value: `${record.electric.wltpRangeKm} km` });

  return {
    kicker: SMART_ANSWER_KICKER,
    title: asksLength ? `Wie lang ist der ${name}?` : `Wie groß ist der ${name}?`,
    lead: len
      ? (asksLength
        ? `Der Kia ${name} ist ${len} lang.`
        : `Der Kia ${name} ist ${len} lang – hier die wichtigsten Maße für Ihren Alltag.`)
      : `Der Kia ${name} im Überblick.`,
    narrative: [],
    facts,
    modelCards: [{
      modelKey: record.modelKey,
      name,
      bullets: facts.map((f) => `${f.value} ${f.label.toLowerCase()}`).slice(0, 4),
    }],
  };
}

/**
 * Standardfelder für jede Antwort ergänzen.
 * @param {object} answer
 */
export function withNarrativeDefaults(answer) {
  return {
    kicker: SMART_ANSWER_KICKER,
    lead: null,
    narrative: [],
    modelCards: [],
    ...answer,
    kicker: answer.kicker ?? SMART_ANSWER_KICKER,
  };
}
