/**
 * Kompakte Clever-Antworten aus der Fahrzeug-Stammdatenbank.
 * Keine erfundenen Werte – fehlende Felder werden ehrlich benannt.
 */
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { resolveElectricSpecs } from '../../data/kia/pricelistBatteryLookup.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { buildAdvisoryAnswer } from './dealerAdvisoryAnswerService.js';
import { shortModelName, withNarrativeDefaults } from './smartAnswerNarrative.js';

function getCleverRecord(modelKey) {
  return KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey && !r.trimId)
    ?? KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey)
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

function missingPhrase(label, fieldLabel) {
  return `${label}: ${fieldLabel} ist in den Stammdaten noch nicht hinterlegt.`;
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
      const kwh = electric.batteryNetKwh ?? electric.batteryGrossKwh;
      const options = electric.batteryOptionsKwh?.length > 1 ? electric.batteryOptionsKwh : null;
      const wltp = electric.wltpRangeKm;
      const facts = [];

      let lead;
      if (options) {
        const opts = options.map(formatKwh).join(' oder ');
        lead = `${label}: Batteriegröße ${opts} kWh.`;
        facts.push({ label: 'Batterie', value: `${options.map(formatKwh).join(' / ')} kWh` });
      } else if (kwh != null) {
        lead = `${label}: Batteriegröße ${formatKwh(kwh)} kWh.`;
        facts.push({ label: 'Batterie', value: `${formatKwh(kwh)} kWh` });
      } else {
        lead = missingPhrase(label, 'Batteriegröße');
      }
      if (wltp != null) {
        lead += ` WLTP-Reichweite: ${wltp} km.`;
        facts.push({ label: 'WLTP', value: `${wltp} km` });
      }

      return {
        title: `Wie groß ist die Batterie beim ${name}?`,
        lead,
        narrative: [],
        facts,
      };
    }
    case 'length': {
      const mm = record.dimensions?.lengthMm;
      const facts = mm != null ? [{ label: 'Länge', value: formatMm(mm) }] : [];
      return {
        title: `Wie lang ist der ${name}?`,
        lead: mm != null ? `${label}: ${formatMm(mm)} lang.` : missingPhrase(label, 'Länge'),
        narrative: [],
        facts,
      };
    }
    case 'height': {
      const mm = record.dimensions?.heightMm;
      const facts = mm != null ? [{ label: 'Höhe', value: formatMm(mm) }] : [];
      return {
        title: `Wie hoch ist der ${name}?`,
        lead: mm != null ? `${label}: ${formatMm(mm)} hoch.` : missingPhrase(label, 'Höhe'),
        narrative: [],
        facts,
      };
    }
    case 'width': {
      const mm = record.dimensions?.widthMm;
      const facts = mm != null ? [{ label: 'Breite', value: formatMm(mm) }] : [];
      return {
        title: `Wie breit ist der ${name}?`,
        lead: mm != null ? `${label}: ${formatMm(mm)} breit.` : missingPhrase(label, 'Breite'),
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
        title: `Wie viel darf der ${name} ziehen?`,
        lead: kg != null
          ? `${label}: bis zu ${formatTon(kg)} Anhängelast.`
          : missingPhrase(label, 'Anhängelast'),
        narrative: [],
        facts,
      };
    }
    case 'wltpRange': {
      const wltp = electric.wltpRangeKm;
      const facts = wltp != null ? [{ label: 'WLTP', value: `${wltp} km` }] : [];
      return {
        title: `Wie weit kommt der ${name}?`,
        lead: wltp != null
          ? `${label}: bis zu ${wltp} km WLTP-Reichweite.`
          : missingPhrase(label, 'WLTP-Reichweite'),
        narrative: electric.realRangeSummerKm
          ? [`Im Alltag rechnen Sie mit etwa ${electric.realRangeSummerKm} km.`]
          : [],
        facts,
      };
    }
    case 'trunkVolume': {
      const l = record.family?.trunkL;
      const facts = l != null ? [{ label: 'Kofferraum', value: `${l} Liter` }] : [];
      return {
        title: `Wie groß ist der Kofferraum beim ${name}?`,
        lead: l != null
          ? `${label}: ${l} Liter Kofferraum.`
          : missingPhrase(label, 'Kofferraumvolumen'),
        narrative: [],
        facts,
      };
    }
    case 'seats': {
      const seats = record.family?.seats;
      const facts = seats != null ? [{ label: 'Sitze', value: `${seats}` }] : [];
      return {
        title: `Wie viele Sitze hat der ${name}?`,
        lead: seats != null
          ? `${label}: ${seats} Sitze.`
          : missingPhrase(label, 'Sitzplatzanzahl'),
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
        title: `Was kostet der ${name}?`,
        lead: price != null
          ? `${label}: ab ${price.toLocaleString('de-DE')} €.`
          : missingPhrase(label, 'Listenpreis'),
        narrative: record.basis?.leasingRate
          ? [`Im Leasing ab ${record.basis.leasingRate} € pro Monat – je nach Laufzeit und Laufleistung.`]
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
        title: `Wie groß ist der ${name}?`,
        lead: parts.length
          ? `${label}: ${parts.join(', ')}.`
          : `${label} – Maße folgen in Kürze in den Stammdaten.`,
        narrative: [],
        facts,
      };
    }
    default:
      return null;
  }
}

/**
 * @param {{ modelKey: string, field: import('../search/vehicleQueryIntent.js').VehicleFactField }} fact
 * @param {string} query
 */
export function buildVehicleFactAnswer(fact, query) {
  const record = getCleverRecord(fact.modelKey);
  const label = modelLabel(fact.modelKey);

  if (!record) {
    return withNarrativeDefaults({
      intent: 'vehicle_fact_question',
      mode: 'info',
      query,
      title: `Keine Stammdaten zu ${label}`,
      lead: `${label}: Daten sind in den Stammdaten noch nicht hinterlegt.`,
      facts: [],
      matchCount: 0,
      canShowOffers: true,
    });
  }

  const partial = buildFieldAnswer(label, record, fact.field, fact.modelKey);
  if (!partial) return null;

  return withNarrativeDefaults({
    intent: 'vehicle_fact_question',
    mode: 'info',
    query,
    ...partial,
    highlights: [],
    matchCount: 1,
    canShowOffers: true,
  });
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
