/**
 * Smart-Answer aus Clever Records + Trim-Mapping – Beratungsmodus.
 */
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { resolveElectricSpecs } from '../../data/kia/pricelistBatteryLookup.js';
import { getModelTrims } from '../../data/features/trimFeatureMapping.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { answerVehicleLexiconQuery, buildVehicleLexicon } from '../lexicon/vehicleLexiconService.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { formatAttributeValue, pickHighlightDetail, relatedLexiconEntries } from './dealerSmartAnswerHelpers.js';
import {
  narrateAttribute,
  narrateBattery,
  narrateComparison,
  narrateDimensionsOverview,
  shortModelName,
  withNarrativeDefaults,
} from './smartAnswerNarrative.js';

const FEATURE_LABELS = {
  heated_seats: 'Sitzheizung',
  heat_pump: 'Wärmepumpe',
  rear_camera: 'Rückfahrkamera',
  camera_360: '360°-Kamera',
  towbar: 'Anhängerkupplung',
  panorama_roof: 'Panorama-/Schiebedach',
};

function formatMm(mm) {
  if (mm == null) return null;
  return `${(mm / 1000).toFixed(2).replace('.', ',')} m`;
}

function getCleverRecord(modelKey) {
  return KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey && !r.trimId)
    ?? KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey)
    ?? null;
}

function modelLabel(modelKey) {
  return KIA_MODEL_ATTRIBUTES[modelKey]?.label
    ? `Kia ${KIA_MODEL_ATTRIBUTES[modelKey].label}`
    : `Kia ${modelKey}`;
}

function baseAnswer(query, partial) {
  return withNarrativeDefaults({
    mode: 'info',
    query,
    facts: [],
    highlights: [],
    matchCount: 1,
    canShowOffers: true,
    ...partial,
  });
}

function buildDimensionFacts(record) {
  const d = record.dimensions ?? {};
  const f = record.family ?? {};
  const e = record.electric ?? {};
  const facts = [];
  if (d.lengthMm != null) facts.push({ label: 'Länge', value: formatMm(d.lengthMm) });
  if (d.widthMm != null) facts.push({ label: 'Breite', value: formatMm(d.widthMm) });
  if (d.heightMm != null) facts.push({ label: 'Höhe', value: formatMm(d.heightMm) });
  if (f.seats != null) facts.push({ label: 'Sitze', value: `${f.seats}` });
  if (f.trunkL != null) facts.push({ label: 'Kofferraum', value: `${f.trunkL} Liter` });
  if (e.wltpRangeKm != null) facts.push({ label: 'WLTP-Reichweite', value: `${e.wltpRangeKm} km` });
  if (e.batteryNetKwh != null) facts.push({ label: 'Batterie', value: `${e.batteryNetKwh} kWh netto` });
  else if (e.batteryGrossKwh != null) facts.push({ label: 'Batterie', value: `${e.batteryGrossKwh} kWh brutto` });
  return facts;
}

function adviseFeature(modelKey, featureId) {
  const record = getCleverRecord(modelKey);
  const label = FEATURE_LABELS[featureId] ?? featureId;
  const trims = getModelTrims(modelKey);

  if (featureId === 'heat_pump' && record?.electric?.heatPump === true) {
    const trimWith = trims.find((t) => t.standardFeatures?.includes('heat_pump'));
    return baseAnswer('', {
      title: `${modelLabel(modelKey)}: Wärmepumpe verfügbar`,
      summary: trimWith
        ? `Serienmäßig ab Ausstattung ${trimWith.name}. Spart Reichweite im Winter.`
        : 'Im Kia-Sortiment mit Wärmepumpe ausgestattet.',
      facts: [{ label: 'Wärmepumpe', value: 'Ja (Kia-Stammdaten)' }],
    });
  }

  const standardTrim = trims.find((t) => t.standardFeatures?.includes(featureId));
  if (standardTrim) {
    return baseAnswer('', {
      title: `${modelLabel(modelKey)}: ${label}`,
      summary: `Serienmäßig ab Ausstattung ${standardTrim.name}.`,
      facts: [{ label: label, value: `Standard ab ${standardTrim.name}` }],
    });
  }

  const packageTrim = trims.find((t) => t.availableViaPackage?.includes(featureId));
  if (packageTrim) {
    return baseAnswer('', {
      title: `${modelLabel(modelKey)}: ${label}`,
      summary: `Optional – z. B. als Paket oder ab Ausstattung ${packageTrim.name}.`,
      facts: [{ label: label, value: `Optional (ab ${packageTrim.name})` }],
      tip: 'Welche Ausstattung Sie brauchen, hängt vom konkreten Fahrzeug im Bestand ab.',
    });
  }

  const blocked = trims.length > 0 && trims.every((t) => t.notAvailable?.includes(featureId));
  if (blocked) {
    return baseAnswer('', {
      title: `${modelLabel(modelKey)}: ${label} nicht verfügbar`,
      summary: 'Laut Kia-Ausstattungslogik ist dieses Merkmal für dieses Modell nicht vorgesehen.',
      tip: 'Fragen Sie uns nach Alternativen im Bestand.',
      canShowOffers: true,
    });
  }

  return baseAnswer('', {
    title: `${modelLabel(modelKey)}: ${label}`,
    summary: 'Die Verfügbarkeit hängt von der Ausstattungslinie ab.',
    tip: 'Im Angebot sehen Sie die Ausstattung des konkreten Fahrzeugs.',
  });
}

function compareRecords(modelKeyA, modelKeyB, query = '') {
  const a = getCleverRecord(modelKeyA);
  const b = getCleverRecord(modelKeyB);
  if (!a || !b) return null;

  const story = narrateComparison(a, b, query);
  const nameA = shortModelName(modelKeyA);
  const nameB = shortModelName(modelKeyB);

  const rows = [
    { label: 'Länge', a: formatMm(a.dimensions?.lengthMm), b: formatMm(b.dimensions?.lengthMm) },
    { label: 'Kofferraum', a: a.family?.trunkL != null ? `${a.family.trunkL} l` : '–', b: b.family?.trunkL != null ? `${b.family.trunkL} l` : '–' },
    { label: 'WLTP', a: a.electric?.wltpRangeKm != null ? `${a.electric.wltpRangeKm} km` : '–', b: b.electric?.wltpRangeKm != null ? `${b.electric.wltpRangeKm} km` : '–' },
    { label: 'Sitze', a: a.family?.seats != null ? `${a.family.seats}` : '–', b: b.family?.seats != null ? `${b.family.seats}` : '–' },
    { label: 'Anhängelast', a: a.towing?.brakedKg != null ? `${Math.round(a.towing.brakedKg / 100) / 10} t` : '–', b: b.towing?.brakedKg != null ? `${Math.round(b.towing.brakedKg / 100) / 10} t` : '–' },
  ].filter((r) => r.a !== '–' || r.b !== '–');

  return baseAnswer(query, {
    ...story,
    summary: null,
    highlights: [],
    facts: rows.map((r) => ({
      label: r.label,
      value: `${nameA} ${r.a} · ${nameB} ${r.b}`,
    })),
    matchCount: 2,
  });
}

/**
 * @param {object} advisory
 * @param {object[]} [vehicles]
 */
export function buildAdvisoryAnswer(advisory, vehicles = []) {
  const { query, topic } = advisory;

  if (topic === 'comparison') {
    return compareRecords(advisory.modelKeyA, advisory.modelKeyB, query);
  }

  if (topic === 'attribute') {
    const record = getCleverRecord(advisory.modelKey);
    const lexicon = buildVehicleLexicon();
    const entries = relatedLexiconEntries(lexicon, advisory.modelKey);
    const story = record
      ? narrateAttribute(record, advisory.attribute, query)
      : { title: 'Keine Angabe', lead: null, narrative: [], facts: [] };

    const modelCards = entries
      .map((entry) => {
        const detail = formatAttributeValue(entry, advisory.attribute);
        if (!detail) return null;
        return {
          modelKey: entry.modelKey,
          name: shortModelName(entry.modelKey),
          bullets: [detail],
        };
      })
      .filter(Boolean);

    return baseAnswer(query, {
      ...story,
      summary: null,
      highlights: [],
      modelCards: modelCards.length > 1 ? modelCards : story.modelCards?.length ? story.modelCards : modelCards,
      matchCount: Math.max(modelCards.length, 1),
    });
  }

  const record = getCleverRecord(advisory.modelKey);
  const label = modelLabel(advisory.modelKey);

  if (!record) {
    return baseAnswer(query, {
      title: `Keine Stammdaten zu ${label}`,
      tip: 'Fragen Sie uns direkt – wir prüfen den Bestand.',
      matchCount: 0,
    });
  }

  switch (topic) {
    case 'dimensions':
    case 'overview': {
      const story = narrateDimensionsOverview(record, query);
      return baseAnswer(query, {
        ...story,
        summary: null,
        highlights: [],
        matchCount: 1,
      });
    }
    case 'garage': {
      const heightMm = record.dimensions?.heightMm;
      const garageMm = advisory.garageHeightMm ?? 2000;
      const fits = heightMm != null ? heightMm <= garageMm : null;
      return baseAnswer(query, {
        title: fits == null ? `${label} – Garagenhöhe prüfen`
          : fits ? `${label} passt in ${formatMm(garageMm)} hohe Garage`
            : `${label} ist zu hoch für ${formatMm(garageMm)}`,
        summary: heightMm != null
          ? `Fahrzeughöhe: ${formatMm(heightMm)}${fits ? '' : ` – benötigt mindestens ${formatMm(heightMm)} Einfahrtshöhe`}.`
          : null,
        facts: buildDimensionFacts(record).filter((f) => ['Höhe', 'Länge', 'Breite'].includes(f.label)),
      });
    }
    case 'trunk':
      return baseAnswer(query, {
        title: `${label}: Kofferraum ${record.family?.trunkL ?? '–'} Liter`,
        summary: record.family?.frunkL
          ? `Zusätzlich Frunk: ${record.family.frunkL} Liter.`
          : 'Ausreichend für Einkauf und Kinderwagen – je nach Modell und Sitzeinstellung.',
        facts: buildDimensionFacts(record).filter((f) => ['Kofferraum', 'Länge'].includes(f.label)),
      });
    case 'battery': {
      const electric = resolveElectricSpecs(record);
      const story = narrateBattery(record, electric);
      return baseAnswer(query, {
        ...story,
        summary: null,
        highlights: [],
        matchCount: 1,
      });
    }
    case 'range_real':
      return baseAnswer(query, {
        title: `${label}: ca. ${record.electric?.realRangeSummerKm ?? '–'} km im Alltag (Sommer)`,
        summary: record.electric?.wltpRangeKm
          ? `WLTP: ${record.electric.wltpRangeKm} km – im Alltag etwas weniger je nach Fahrstil und Temperatur.`
          : null,
        facts: [
          record.electric?.wltpRangeKm != null && { label: 'WLTP', value: `${record.electric.wltpRangeKm} km` },
          record.electric?.realRangeSummerKm != null && { label: 'Sommer (ca.)', value: `${record.electric.realRangeSummerKm} km` },
          record.electric?.realRangeWinterKm != null && { label: 'Winter (ca.)', value: `${record.electric.realRangeWinterKm} km` },
        ].filter(Boolean),
      });
    case 'range_winter':
      return baseAnswer(query, {
        title: `${label}: ca. ${record.electric?.realRangeWinterKm ?? '–'} km im Winter`,
        summary: 'Kälte reduziert die Reichweite – Wärmepumpe und Vorklimatisierung helfen.',
        facts: [
          record.electric?.wltpRangeKm != null && { label: 'WLTP', value: `${record.electric.wltpRangeKm} km` },
          record.electric?.realRangeWinterKm != null && { label: 'Winter (ca.)', value: `${record.electric.realRangeWinterKm} km` },
          record.electric?.heatPump === true && { label: 'Wärmepumpe', value: 'Ja' },
        ].filter(Boolean),
        tip: record.electric?.heatPump ? null : 'Wärmepumpe ab höherer Ausstattung empfohlen.',
      });
    case 'range_enough':
      return baseAnswer(query, {
        title: `${label}: WLTP ${record.electric?.wltpRangeKm ?? '–'} km`,
        summary: 'Ob die Batterie reicht, hängt von Ihrer Strecke und Lademöglichkeit ab.',
        facts: buildDimensionFacts(record).filter((f) => f.label.includes('WLTP') || f.label.includes('Batterie')),
        tip: 'Als Faustregel: 300 km WLTP für Pendler, 400+ km für Vielfahrer.',
      });
    case 'charging':
      return baseAnswer(query, {
        title: `${label}: Laden`,
        facts: [
          record.electric?.acKw != null && { label: 'AC', value: `${record.electric.acKw} kW` },
          record.electric?.dcKw != null && { label: 'DC', value: `${record.electric.dcKw} kW` },
          record.electric?.has800V && { label: '800-V-System', value: 'Ja' },
        ].filter(Boolean),
        summary: record.electric?.dcKw == null
          ? 'DC-Schnellladeleistung je nach Ausstattung – Details im Datenblatt.'
          : null,
      });
    case 'feature':
      return adviseFeature(advisory.modelKey, advisory.featureId);
    case 'tow':
    case 'towbar': {
      const towStory = narrateAttribute(record, 'tow', query);
      return baseAnswer(query, {
        ...towStory,
        summary: null,
        highlights: [],
        narrative: [
          ...(towStory.narrative ?? []),
          ...(topic === 'towbar' ? ['Die Anhängerkupplung ist je nach Ausstattung verfügbar – im Bestand prüfen wir das für Sie.'] : []),
        ],
        facts: [
          record.towing?.brakedKg != null && { label: 'Gebremst', value: `${Math.round(record.towing.brakedKg / 100) / 10} t` },
          record.towing?.unbrakedKg != null && { label: 'Ungebremst', value: `${record.towing.unbrakedKg} kg` },
        ].filter(Boolean),
      });
    }
    case 'isofix':
      return baseAnswer(query, {
        title: record.family?.isofixRearCount != null
          ? `${label}: ${record.family.isofixRearCount}× Isofix hinten`
          : `${label}: Isofix – Angabe folgt`,
        facts: [
          record.family?.seats != null && { label: 'Sitze', value: `${record.family.seats}` },
          record.family?.isofixRearCount != null && { label: 'Isofix hinten', value: `${record.family.isofixRearCount}` },
        ].filter(Boolean),
      });
    case 'family':
    case 'stroller_dog': {
      const scores = record.cleverScores ?? {};
      return baseAnswer(query, {
        title: `${label} – Familie & Alltag`,
        summary: topic === 'stroller_dog'
          ? `Kofferraum ${record.family?.trunkL ?? '–'} l · Hunde-Freundlichkeit: ${scores.dogFriendly ?? '–'}/10`
          : `Familien-Eignung: ${scores.familyVehicle ?? '–'}/10 · ${record.family?.seats ?? 5} Sitze`,
        facts: buildDimensionFacts(record).filter((f) => ['Kofferraum', 'Sitze', 'Länge'].includes(f.label) || f.label === 'WLTP-Reichweite'),
      });
    }
    case 'price_leasing':
      return baseAnswer(query, {
        title: record.basis?.leasingRate
          ? `${label}: ab ${record.basis.leasingRate} €/Monat (Richtwert)`
          : `${label}: Leasingpreis im Bestand`,
        summary: 'Konkrete Rate hängt von Laufzeit, Anzahlung und Laufleistung ab.',
        facts: [
          record.basis?.listPriceGross != null && { label: 'Listenpreis ab', value: `${record.basis.listPriceGross.toLocaleString('de-DE')} €` },
          record.basis?.leasingRate != null && { label: 'Leasing ab', value: `${record.basis.leasingRate} €/Monat` },
        ].filter(Boolean),
        tip: 'Im Angebot sehen Sie die aktuelle Händler-Rate.',
      });
    case 'price_mileage':
      return baseAnswer(query, {
        title: `${label}: Laufleistung beeinflusst die Rate`,
        summary: '10.000 vs. 20.000 km/Jahr machen oft 30–60 € Unterschied pro Monat.',
        tip: 'Konkrete Raten für 15.000 und 20.000 km sehen Sie in den Angeboten.',
      });
    case 'buy_vs_lease':
      return baseAnswer(query, {
        title: 'Kauf oder Leasing?',
        summary: advisory.modelKey
          ? `${label}: Leasing ab ${record.basis?.leasingRate ?? '–'} € – Kauf ab ${record.basis?.listPriceGross?.toLocaleString('de-DE') ?? '–'} €.`
          : 'Leasing: planbare Rate, kein Restwert-Risiko. Kauf: Eigentum nach Abzahlung.',
        tip: 'Wir rechnen Ihnen beide Varianten gern durch.',
      });
    case 'subsidy':
      return baseAnswer(query, {
        title: 'Förderung & E-Prämie',
        summary: 'Förderungen ändern sich – aktuell oft THG-Quote und Hersteller-Boni.',
        tip: 'Wir prüfen die aktuellen Kia-Aktionen und Förderungen für Sie.',
      });
    case 'availability':
      return baseAnswer(query, {
        title: record.basis?.inStock
          ? `${label}: aktuell im Bestand`
          : `${label}: Verfügbarkeit im Bestand prüfen`,
        summary: record.basis?.deliveryWeeks
          ? `Lieferzeit ca. ${record.basis.deliveryWeeks} Wochen.`
          : 'Sofort verfügbare Fahrzeuge sehen Sie in den Angeboten.',
        tip: 'Klicken Sie auf „Angebote ansehen“ für den Live-Bestand.',
      });
    case 'colors':
    case 'options':
      return baseAnswer(query, {
        title: `${label}: Farben & Ausstattung`,
        summary: 'Verfügbare Farben und Optionen hängen vom konkreten Fahrzeug im Bestand ab.',
        tip: 'In den Angeboten sehen Sie Farbe, Ausstattung und Lieferstatus.',
      });
    default: {
      const profile = buildSearchProfile({ intent: parseSearchIntent(query), query });
      const lexicon = answerVehicleLexiconQuery(query, vehicles);
      if (advisory.rangeRanking === 'max' || profile.rangeRanking === 'max') {
        const matches = lexicon.matches ?? [];
        return baseAnswer(query, {
          title: lexicon.headline,
          highlights: matches.slice(0, 3).map((m) => ({
            modelKey: m.modelKey,
            label: m.label,
            detail: pickHighlightDetail(m, profile),
          })),
          matchCount: matches.length,
        });
      }
      return baseAnswer(query, {
        title: `${label} – Überblick`,
        facts: buildDimensionFacts(record),
      });
    }
  }
}
