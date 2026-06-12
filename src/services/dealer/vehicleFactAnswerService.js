/**
 * Kompakte Clever-Antworten aus der Fahrzeug-Stammdatenbank.
 * Keine erfundenen Werte – fehlende Felder werden ehrlich benannt.
 */
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { resolveElectricSpecs } from '../../data/kia/pricelistBatteryLookup.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { buildAdvisoryAnswer } from './dealerAdvisoryAnswerService.js';
import { formatDriveTypeLabel } from '../../data/kia/kiaPerformanceSpecs.js';
import { shortModelName, withNarrativeDefaults } from './smartAnswerNarrative.js';

function getCleverRecord(modelKey) {
  const records = KIA_CLEVER_RECORDS.filter((r) => r.modelKey === modelKey);
  return records.find((r) => !r.trimId)
    ?? records.find((r) => r.electric?.batteryGrossKwh || r.electric?.wltpRangeKm)
    ?? records[0]
    ?? null;
}

function modelLabel(modelKey) {
  const label = KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? String(modelKey).toUpperCase();
  return `Kia ${label}`;
}

function formatMm(mm) {
  if (mm == null) return null;
  return `${(mm / 1000).toFixed(2).replace('.', ',')} m`;
}

function formatTon(kg) {
  if (kg == null) return null;
  return `${(Math.round(kg / 100) / 10).toString().replace('.', ',')} t`;
}

function formatKwh(kwh) {
  if (kwh == null) return null;
  return (Math.round(kwh * 10) / 10).toString().replace('.', ',');
}

function comfortStatusLine(name, featureLabel, status) {
  if (status === 'standard') return `✅ ${featureLabel} ist beim ${name} serienmäßig enthalten.`;
  if (status === 'package') return `📦 ${featureLabel} ist beim ${name} optional als Paket erhältlich.`;
  if (status === 'accessory') return `🛒 ${featureLabel} ist beim ${name} als Zubehör erhältlich.`;
  if (status === 'missing') return `ℹ️ ${featureLabel} ist beim ${name} nicht erhältlich.`;
  return null;
}

function withViewCta(partial, modelKey) {
  const name = shortModelName(modelKey);
  return {
    ...partial,
    showViewModelCta: true,
    viewModelCta: `${name} genauer ansehen`,
    primaryModelKey: modelKey,
    primaryModelLabel: KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? name,
  };
}

/**
 * @param {string} label
 * @param {object} record
 * @param {import('../search/vehicleQueryIntent.js').VehicleFactField} field
 * @param {string} modelKey
 */
function buildFieldAnswer(label, record, field, modelKey) {
  const name = shortModelName(modelKey);
  const electric = resolveElectricSpecs(record);

  switch (field) {
    case 'batteryKwh': {
      const kwh = electric.batteryGrossKwh ?? electric.batteryNetKwh;
      const options = electric.batteryOptionsKwh?.length > 1 ? electric.batteryOptionsKwh : null;
      const wltp = electric.wltpRangeKm;
      const facts = [];
      const narrative = [];

      if (options) {
        facts.push({ label: 'Batterie', value: `${options.map(formatKwh).join(' / ')} kWh` });
        narrative.push(`🔋 Der ${name} bietet Batteriegrößen von ${options.map(formatKwh).join(' oder ')} kWh.`);
      } else if (kwh != null) {
        facts.push({ label: 'Batterie', value: `${formatKwh(kwh)} kWh` });
        narrative.push(`🔋 Der ${name} besitzt eine Batterie mit ${formatKwh(kwh)} kWh.`);
      }
      if (wltp != null) {
        facts.push({ label: 'WLTP', value: `${wltp} km` });
        narrative.push(`⚡ Reichweite bis ${wltp} km WLTP.`);
      }
      if (electric.dcCharge10_80Min) {
        narrative.push(`🚗 DC-Schnellladen von 10–80 % in ca. ${electric.dcCharge10_80Min} Minuten.`);
      }

      return {
        hasData: narrative.length > 0,
        title: `Wie groß ist die Batterie beim ${name}?`,
        lead: narrative[0] ?? null,
        narrative: narrative.slice(1),
        facts,
      };
    }
    case 'length': {
      const mm = record.dimensions?.lengthMm;
      const facts = mm != null ? [{ label: 'Länge', value: formatMm(mm) }] : [];
      return {
        hasData: mm != null,
        title: `Wie lang ist der ${name}?`,
        lead: mm != null ? `📏 Der ${name} ist ${formatMm(mm)} lang.` : null,
        narrative: [],
        facts,
      };
    }
    case 'height': {
      const mm = record.dimensions?.heightMm;
      const facts = mm != null ? [{ label: 'Höhe', value: formatMm(mm) }] : [];
      return {
        hasData: mm != null,
        title: `Wie hoch ist der ${name}?`,
        lead: mm != null ? `📏 Der ${name} ist ${formatMm(mm)} hoch.` : null,
        narrative: [],
        facts,
      };
    }
    case 'width': {
      const mm = record.dimensions?.widthMm;
      const facts = mm != null ? [{ label: 'Breite', value: formatMm(mm) }] : [];
      return {
        hasData: mm != null,
        title: `Wie breit ist der ${name}?`,
        lead: mm != null ? `📏 Der ${name} ist ${formatMm(mm)} breit.` : null,
        narrative: [],
        facts,
      };
    }
    case 'towingCapacity': {
      const kg = record.towing?.brakedKg;
      const facts = kg != null
        ? [{ label: 'Anhängelast (gebremst)', value: formatTon(kg) }]
        : [];
      return {
        hasData: kg != null,
        title: `Wie viel darf der ${name} ziehen?`,
        lead: kg != null ? `🚚 Der ${name} zieht bis ${formatTon(kg)} (gebremst).` : null,
        narrative: [],
        facts,
      };
    }
    case 'wltpRange': {
      const wltp = electric.wltpRangeKm;
      const facts = wltp != null ? [{ label: 'WLTP', value: `${wltp} km` }] : [];
      const narrative = electric.realRangeSummerKm
        ? [`☀️ Im Sommer sind oft etwa ${electric.realRangeSummerKm} km realistisch.`]
        : [];
      return {
        hasData: wltp != null,
        title: `Wie weit kommt der ${name}?`,
        lead: wltp != null ? `⚡ Der ${name} schafft bis zu ${wltp} km WLTP.` : null,
        narrative,
        facts,
      };
    }
    case 'trunkVolume': {
      const l = record.family?.trunkL;
      const facts = l != null ? [{ label: 'Kofferraum', value: `${l} Liter` }] : [];
      return {
        hasData: l != null,
        title: `Wie groß ist der Kofferraum beim ${name}?`,
        lead: l != null ? `📦 Der Kofferraum fasst ${l} Liter.` : null,
        narrative: [],
        facts,
      };
    }
    case 'seats': {
      const seats = record.family?.seats;
      const facts = seats != null ? [{ label: 'Sitze', value: `${seats}` }] : [];
      return {
        hasData: seats != null,
        title: `Wie viele Sitze hat der ${name}?`,
        lead: seats != null ? `👨‍👩‍👧‍👦 Der ${name} bietet ${seats} Sitze.` : null,
        narrative: [],
        facts,
      };
    }
    case 'price': {
      const price = record.basis?.listPriceGross;
      const facts = [
        price != null && { label: 'Ab Preis', value: `${price.toLocaleString('de-DE')} €` },
        record.basis?.leasingRate != null && { label: 'Leasing ab', value: `${record.basis.leasingRate} €/Monat` },
      ].filter(Boolean);
      return {
        hasData: price != null,
        title: `Was kostet der ${name}?`,
        lead: price != null ? `💶 Der ${name} startet ab ${price.toLocaleString('de-DE')} €.` : null,
        narrative: record.basis?.leasingRate
          ? [`📋 Leasing ab ${record.basis.leasingRate} €/Monat – je nach Laufzeit und Laufleistung.`]
          : [],
        facts,
      };
    }
    case 'dimensionsOverview': {
      const parts = [];
      const facts = [];
      if (record.dimensions?.lengthMm != null) {
        parts.push(`${formatMm(record.dimensions.lengthMm)} lang`);
        facts.push({ label: 'Länge', value: formatMm(record.dimensions.lengthMm) });
      }
      if (record.dimensions?.widthMm != null) {
        facts.push({ label: 'Breite', value: formatMm(record.dimensions.widthMm) });
      }
      if (record.dimensions?.heightMm != null) {
        facts.push({ label: 'Höhe', value: formatMm(record.dimensions.heightMm) });
      }
      if (record.family?.trunkL != null) {
        facts.push({ label: 'Kofferraum', value: `${record.family.trunkL} Liter` });
      }
      return {
        hasData: parts.length > 0,
        title: `Wie groß ist der ${name}?`,
        lead: parts.length ? `📏 Der ${name} ist ${parts.join(', ')}.` : null,
        narrative: [],
        facts,
      };
    }
    case 'charging': {
      const narrative = [];
      if (electric.dcCharge10_80Min) {
        narrative.push(`🚗 DC-Schnellladen von 10–80 % in ca. ${electric.dcCharge10_80Min} Minuten.`);
      }
      if (electric.dcKw) narrative.push(`⚡ DC-Ladeleistung bis ${electric.dcKw} kW.`);
      if (electric.acKw) narrative.push(`🔌 AC-Laden bis ${electric.acKw} kW.`);
      if (electric.has800V) narrative.push('⚡ 800-Volt-Technik für schnelles Laden.');
      const facts = [
        electric.dcKw && { label: 'DC', value: `${electric.dcKw} kW` },
        electric.acKw && { label: 'AC', value: `${electric.acKw} kW` },
      ].filter(Boolean);
      return {
        hasData: narrative.length > 0,
        title: `Wie schnell lädt der ${name}?`,
        lead: narrative[0] ?? null,
        narrative: narrative.slice(1),
        facts,
      };
    }
    case 'roofLoad': {
      const kg = record.towing?.roofLoadKg;
      return {
        hasData: kg != null,
        title: `Wie hoch ist die Dachlast beim ${name}?`,
        lead: kg != null ? `🏔️ Dachlast bis ${kg} kg.` : null,
        narrative: [],
        facts: kg != null ? [{ label: 'Dachlast', value: `${kg} kg` }] : [],
      };
    }
    case 'isofix': {
      const count = record.family?.isofixRearCount;
      const has = record.family?.isofixRear;
      const line = count != null
        ? `👶 ${count} Isofix-Punkte hinten.`
        : has
          ? `👶 Isofix für Kindersitze hinten vorhanden.`
          : null;
      return {
        hasData: Boolean(line),
        title: `Hat der ${name} Isofix?`,
        lead: line,
        narrative: [],
        facts: count != null ? [{ label: 'Isofix hinten', value: `${count}` }] : [],
      };
    }
    case 'heatPump': {
      return {
        hasData: Boolean(electric.heatPump),
        title: `Hat der ${name} eine Wärmepumpe?`,
        lead: electric.heatPump
          ? `🌡️ Wärmepumpe ist beim ${name} verfügbar – spart Reichweite im Winter.`
          : null,
        narrative: [],
        facts: electric.heatPump ? [{ label: 'Wärmepumpe', value: 'Ja' }] : [],
      };
    }
    case 'v2l': {
      return {
        hasData: Boolean(electric.v2l),
        title: `Unterstützt der ${name} V2L?`,
        lead: electric.v2l ? `🔌 V2L (Vehicle-to-Load) ist beim ${name} verfügbar.` : null,
        narrative: [],
        facts: electric.v2l ? [{ label: 'V2L', value: 'Ja' }] : [],
      };
    }
    case 'voltage800v': {
      return {
        hasData: Boolean(electric.has800V),
        title: `Hat der ${name} 800-Volt-Technik?`,
        lead: electric.has800V ? `⚡ Ja – 800-Volt-Architektur für schnelles DC-Laden.` : null,
        narrative: [],
        facts: electric.has800V ? [{ label: '800 V', value: 'Ja' }] : [],
      };
    }
    case 'camera360': {
      const line = comfortStatusLine(name, '360°-Kamera', record.comfort?.camera360);
      return {
        hasData: Boolean(line),
        title: `Hat der ${name} eine 360°-Kamera?`,
        lead: line,
        narrative: [],
        facts: [],
      };
    }
    case 'hud': {
      const line = comfortStatusLine(name, 'Head-Up Display', record.comfort?.hud);
      return {
        hasData: Boolean(line),
        title: `Hat der ${name} ein Head-Up Display?`,
        lead: line,
        narrative: [],
        facts: [],
      };
    }
    case 'matrixLed': {
      const line = comfortStatusLine(name, 'Matrix-LED-Scheinwerfer', record.comfort?.matrixLed);
      return {
        hasData: Boolean(line),
        title: `Hat der ${name} Matrix LED?`,
        lead: line,
        narrative: [],
        facts: [],
      };
    }
    case 'panoramaRoof': {
      const line = comfortStatusLine(name, 'Panoramadach', record.comfort?.panoramaRoof);
      return {
        hasData: Boolean(line),
        title: `Hat der ${name} ein Panoramadach?`,
        lead: line,
        narrative: [],
        facts: [],
      };
    }
    case 'leather': {
      const line = comfortStatusLine(name, 'Lederausstattung', record.comfort?.leather);
      return {
        hasData: Boolean(line),
        title: `Hat der ${name} Leder?`,
        lead: line,
        narrative: [],
        facts: [],
      };
    }
    case 'deliveryTime': {
      const weeks = record.basis?.deliveryWeeks;
      return {
        hasData: Boolean(weeks),
        title: `Wie lange dauert die Lieferung vom ${name}?`,
        lead: weeks ? `🚚 Lieferzeit aktuell ca. ${weeks}.` : null,
        narrative: [],
        facts: weeks ? [{ label: 'Lieferzeit', value: weeks }] : [],
      };
    }
    case 'leasingRate': {
      const rate = record.basis?.leasingRate;
      return {
        hasData: rate != null,
        title: `Was kostet der ${name} im Leasing?`,
        lead: rate != null ? `📋 Leasing ab ${rate} €/Monat – unverbindliches Beispiel.` : null,
        narrative: [],
        facts: rate != null ? [{ label: 'Leasing ab', value: `${rate} €/Monat` }] : [],
      };
    }
    case 'finance': {
      const rate = record.basis?.financeRate;
      return {
        hasData: rate != null,
        title: `Finanzierung für den ${name}`,
        lead: rate != null ? `💳 Finanzierung ab ${rate} €/Monat – Bonität vorausgesetzt.` : null,
        narrative: [],
        facts: rate != null ? [{ label: 'Finanzierung ab', value: `${rate} €/Monat` }] : [],
      };
    }
    case 'warranty': {
      const years = record.basis?.warrantyYears;
      const km = record.basis?.warrantyKm;
      const batteryYears = record.basis?.batteryWarrantyYears;
      const narrative = [];
      if (years != null) {
        narrative.push(`🛡️ ${years} Jahre Herstellergarantie${km ? ` bis ${km.toLocaleString('de-DE')} km` : ''}.`);
      }
      if (batteryYears) {
        narrative.push(`🔋 Hochvoltbatterie: ${batteryYears} Jahre Garantie.`);
      }
      const facts = [
        years != null && { label: 'Garantie', value: `${years} Jahre` },
        km != null && { label: 'bis', value: `${km.toLocaleString('de-DE')} km` },
        batteryYears && { label: 'Batterie-Garantie', value: `${batteryYears} Jahre` },
      ].filter(Boolean);
      return {
        hasData: narrative.length > 0,
        title: `Welche Garantie hat der ${name}?`,
        lead: narrative[0] ?? null,
        narrative: narrative.slice(1),
        facts,
      };
    }
    case 'consumption': {
      const perf = record.performance;
      const kwh = perf?.consumptionKwhPer100;
      const liters = perf?.consumptionLPer100;
      const facts = [];
      const narrative = [];
      if (kwh != null) {
        facts.push({ label: 'Strom WLTP', value: `${formatKwh(kwh)} kWh/100 km` });
        narrative.push(`⚡ Stromverbrauch kombiniert: ${formatKwh(kwh)} kWh/100 km (WLTP).`);
      }
      if (liters != null) {
        facts.push({ label: 'Kraftstoff WLTP', value: `${formatKwh(liters)} l/100 km` });
        narrative.push(`⛽ Kraftstoffverbrauch kombiniert: ${formatKwh(liters)} l/100 km (WLTP).`);
      }
      return {
        hasData: narrative.length > 0,
        title: `Wie hoch ist der Verbrauch beim ${name}?`,
        lead: narrative[0] ?? null,
        narrative: narrative.slice(1),
        facts,
      };
    }
    case 'powerHp': {
      const ps = record.performance?.powerPs;
      const kw = record.performance?.powerKw;
      const facts = [
        ps != null && { label: 'Leistung', value: `${ps} PS` },
        kw != null && { label: 'Leistung', value: `${kw} kW` },
      ].filter(Boolean);
      const lead = ps != null
        ? `💪 Der ${name} leistet bis zu ${ps} PS${kw != null ? ` (${kw} kW)` : ''}.`
        : null;
      return {
        hasData: ps != null,
        title: `Wie viel PS hat der ${name}?`,
        lead,
        narrative: [],
        facts,
      };
    }
    case 'acceleration': {
      const sec = record.performance?.acceleration0_100Sec;
      const facts = sec != null ? [{ label: '0–100 km/h', value: `${formatKwh(sec)} s` }] : [];
      return {
        hasData: sec != null,
        title: `Wie schnell beschleunigt der ${name}?`,
        lead: sec != null ? `🏁 0–100 km/h in ${formatKwh(sec)} Sekunden.` : null,
        narrative: [],
        facts,
      };
    }
    case 'driveType': {
      const drive = formatDriveTypeLabel(record.performance?.driveType);
      return {
        hasData: Boolean(drive),
        title: `Welchen Antrieb hat der ${name}?`,
        lead: drive ? `🛞 ${drive}.` : null,
        narrative: [],
        facts: drive ? [{ label: 'Antrieb', value: drive }] : [],
      };
    }
    default:
      return null;
  }
}

/**
 * @param {object} params
 */
export function buildVehicleDataGapAnswer({
  modelKey,
  query,
  catalog = null,
  field = null,
}) {
  const name = shortModelName(modelKey);
  const category = catalog?.category;

  return withNarrativeDefaults(withViewCta({
    intent: 'vehicle_fact_question',
    mode: 'info',
    dataGap: true,
    query,
    title: category ? `${category} – Kia ${name}` : `Ihre Frage zum Kia ${name}`,
    lead: 'Vielen Dank für Ihre Frage.',
    narrative: [
      'Leider haben wir hierzu aktuell noch keine hinterlegten Fahrzeugdaten.',
      'Wir recherchieren diese Information gerne für Sie.',
    ],
    openQuestion: {
      query,
      modelKey,
      intentId: catalog?.intentId ?? null,
      category: catalog?.category ?? null,
      field,
    },
    showNotifyCta: true,
    notifyCta: 'Benachrichtigen, sobald die Antwort verfügbar ist',
    facts: [],
    highlights: [],
    matchCount: 0,
    canShowOffers: true,
  }, modelKey));
}

/**
 * @param {{ modelKey: string, field: import('../search/vehicleQueryIntent.js').VehicleFactField }} fact
 * @param {string} query
 */
export function buildVehicleFactAnswer(fact, query, catalog = null) {
  const record = getCleverRecord(fact.modelKey);

  if (!record) {
    return buildVehicleDataGapAnswer({
      modelKey: fact.modelKey,
      query,
      catalog,
      field: fact.field,
    });
  }

  const partial = buildFieldAnswer(modelLabel(fact.modelKey), record, fact.field, fact.modelKey);
  if (!partial) return null;

  if (!partial.hasData) {
    return buildVehicleDataGapAnswer({
      modelKey: fact.modelKey,
      query,
      catalog,
      field: fact.field,
    });
  }

  const { hasData, ...answerBody } = partial;

  return withNarrativeDefaults(withViewCta({
    intent: 'vehicle_fact_question',
    mode: 'info',
    query,
    ...answerBody,
    highlights: [],
    matchCount: 1,
    canShowOffers: true,
  }, fact.modelKey));
}

/**
 * @param {{ modelKeyA: string, modelKeyB: string }} compare
 * @param {string} query
 * @param {object[]} [vehicles]
 */
export function buildVehicleCompareAnswer(compare, query, vehicles = []) {
  const answer = buildAdvisoryAnswer({
    kind: 'advisory',
    topic: 'comparison',
    query,
    modelKeyA: compare.modelKeyA,
    modelKeyB: compare.modelKeyB,
  }, vehicles);

  return { ...answer, intent: 'vehicle_compare_question' };
}
