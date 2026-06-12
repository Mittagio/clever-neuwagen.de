/**
 * Schicht 2: Harte Ausschlussregeln – Wahrheit schlägt KI.
 */

import {
  enrichVehicleWithModelAttributes,
  getKiaModelAttributes,
  vehicleFuelTruth,
} from '../../data/kia/kiaModelAttributes.js';
import { getModelLineKey } from '../sales/advisorRanking.js';
import {
  resolveVehicleLengthMm,
  resolveVehicleHeightMm,
  resolveVehicleTrunkL,
  resolveTowBrakedKg,
  resolveIsofixRearCount,
} from '../cleverData/vehicleDimensions.js';

const BODY_CLASS_RANK = {
  kleinwagen: 1,
  compact: 2,
  compact_suv: 3,
  family_suv: 4,
  large_suv: 5,
  limousine: 3,
  kombi: 3,
  commercial: 4,
};

/**
 * @typedef {import('./searchProfile.js').SearchProfile} SearchProfile
 */

export function evaluateHardRules(vehicle, profile) {
  const v = enrichVehicleWithModelAttributes(vehicle);
  const facts = v.modelFacts ?? getKiaModelAttributes(v);
  const reasons = [];

  if (profile.fuelAlternatives?.length >= 2) {
    const pt = v.powertrain ?? vehicleFuelTruth(v);
    const ok = profile.fuelAlternatives.some((fuel) => {
      if (fuel === 'electric' || fuel === 'elektro') return vehicleFuelTruth(v) === 'electric';
      if (fuel === 'hybrid') return ['hybrid', 'plugin-hybrid'].includes(pt);
      if (fuel === 'plugin_hybrid' || fuel === 'plugin-hybrid') return pt === 'plugin-hybrid';
      if (fuel === 'diesel') return pt === 'diesel';
      if (fuel === 'verbrenner' || fuel === 'benzin') return pt === 'verbrenner';
      if (fuel === 'combustion') return vehicleFuelTruth(v) !== 'electric';
      return false;
    });
    if (!ok) {
      reasons.push({
        code: 'fuel_mismatch',
        message: `${facts.label} passt nicht zu den gewünschten Antriebsarten`,
        hard: true,
      });
    }
  } else if (profile.fuel === 'electric') {
    if (vehicleFuelTruth(v) !== 'electric') {
      reasons.push({
        code: 'fuel_mismatch',
        message: `${facts.label} ist nicht rein elektrisch`,
        hard: true,
      });
    }
  } else if (profile.fuel === 'combustion') {
    if (vehicleFuelTruth(v) === 'electric') {
      reasons.push({
        code: 'fuel_mismatch',
        message: `${facts.label} ist ein Elektrofahrzeug – kein Benziner/Diesel`,
        hard: true,
      });
    }
  } else if (profile.fuel === 'hybrid') {
    const pt = v.powertrain;
    if (!['hybrid', 'plugin-hybrid'].includes(pt)) {
      reasons.push({
        code: 'fuel_mismatch',
        message: `${facts.label} ist kein Hybrid`,
        hard: true,
      });
    }
  }

  if (profile.seatsMin != null && profile.seatsMin >= 7) {
    if (!facts.isSevenSeater && (facts.seats ?? v.seats ?? 5) < profile.seatsMin) {
      reasons.push({
        code: 'seats_insufficient',
        message: `${facts.label} ist kein 7-Sitzer (${facts.seats} Sitze)`,
        hard: true,
      });
    }
  }

  if (profile.maxLengthMm != null) {
    const len = resolveVehicleLengthMm(v);
    if (len != null && len > profile.maxLengthMm) {
      const maxM = profile.maxLengthMm / 1000;
      const lenM = (len / 1000).toFixed(2).replace('.', ',');
      reasons.push({
        code: 'length_exceeded',
        message: `${facts.label} ist ${lenM} m lang – gewünscht max. ${String(maxM).replace('.', ',')} m`,
        hard: true,
      });
    }
  }

  if (profile.maxHeightMm != null) {
    const height = resolveVehicleHeightMm(v);
    if (height != null && height > profile.maxHeightMm) {
      const maxM = profile.maxHeightMm / 1000;
      const hM = (height / 1000).toFixed(2).replace('.', ',');
      reasons.push({
        code: 'height_exceeded',
        message: `${facts.label} ist ${hM} m hoch – Garage max. ${String(maxM).replace('.', ',')} m`,
        hard: true,
      });
    }
  }

  if (profile.trunkLMin != null) {
    const trunk = resolveVehicleTrunkL(v);
    if (trunk != null && trunk < profile.trunkLMin) {
      reasons.push({
        code: 'trunk_too_small',
        message: `${facts.label}: Kofferraum ${trunk} l – gewünscht min. ${profile.trunkLMin} l`,
        hard: true,
      });
    }
  }

  if (profile.isofixRearMin != null) {
    const isofixCount = resolveIsofixRearCount(v);
    if (isofixCount != null && isofixCount < profile.isofixRearMin) {
      reasons.push({
        code: 'isofix_insufficient',
        message: `${facts.label}: ${isofixCount} Isofix hinten – gewünscht ${profile.isofixRearMin}`,
        hard: true,
      });
    }
  }

  if (profile.towCapacityKg != null) {
    const braked = resolveTowBrakedKg(v);
    if (braked != null && braked < profile.towCapacityKg) {
      const wantT = Math.round(profile.towCapacityKg / 100) / 10;
      const haveT = Math.round(braked / 100) / 10;
      reasons.push({
        code: 'tow_insufficient',
        message: `${facts.label}: Anhängelast ${haveT} t – gewünscht min. ${wantT} t`,
        hard: true,
      });
    }
  }

  if (profile.maxPrice != null) {
    const price = v.cashPrice ?? v.price ?? null;
    if (price != null && price > profile.maxPrice) {
      reasons.push({
        code: 'budget_exceeded',
        message: `${facts.label} liegt über ${profile.maxPrice.toLocaleString('de-DE')} € (${price.toLocaleString('de-DE')} €)`,
        hard: true,
      });
    }
  }

  if (profile.maxMonthlyRate != null) {
    const rate = v.displayRate ?? v.monthlyRate ?? null;
    if (rate != null && rate > profile.maxMonthlyRate) {
      reasons.push({
        code: 'budget_exceeded',
        message: `${facts.label} liegt über ${profile.maxMonthlyRate} €/Monat (${rate} €/Monat)`,
        hard: true,
      });
    }
  }

  if (profile.bodyType === 'kleinwagen' || profile.bodyClass === 'kleinwagen') {
    const rank = BODY_CLASS_RANK[facts.bodyClass] ?? 3;
    if (rank >= BODY_CLASS_RANK.family_suv) {
      reasons.push({
        code: 'body_mismatch',
        message: `${facts.label} ist kein Kleinwagen`,
        hard: true,
      });
    }
  }

  if (profile.transmission === 'manual') {
    const hay = `${v.title ?? ''} ${(v.equipment ?? []).join(' ')}`.toLowerCase();
    if (/automatik|dsg|cvt/i.test(hay) && !/schalt|manuell|handgeschaltet/i.test(hay)) {
      reasons.push({
        code: 'transmission_mismatch',
        message: `${facts.label} ist nicht mit Schaltgetriebe verfügbar`,
        hard: true,
      });
    }
  }

  if (profile.modelExplicit && profile.model) {
    const modelNorm = profile.model.toLowerCase();
    const vehicleModel = String(v.model ?? '').toLowerCase();
    const modelKey = String(v.modelKey ?? '').toLowerCase();
    if (!vehicleModel.includes(modelNorm) && !modelKey.includes(modelNorm.replace(/\s+/g, ''))) {
      reasons.push({
        code: 'model_mismatch',
        message: `Nicht ${profile.model}`,
        hard: true,
      });
    }
    if (profile.trim && !String(v.title ?? '').toLowerCase().includes(profile.trim.toLowerCase())) {
      reasons.push({
        code: 'trim_mismatch',
        message: `Ausstattung ${profile.trim} nicht gefunden`,
        hard: true,
      });
    }
  }

  const hardFails = reasons.filter((r) => r.hard);
  return {
    pass: hardFails.length === 0,
    reasons,
    hardFails,
    vehicle: v,
    facts,
  };
}

export function passesHardRules(vehicle, profile) {
  return evaluateHardRules(vehicle, profile).pass;
}

export function partitionByHardRules(vehicles = [], profile) {
  const eligible = [];
  const excluded = [];

  for (const vehicle of vehicles) {
    const result = evaluateHardRules(vehicle, profile);
    if (result.pass) {
      eligible.push(result.vehicle);
    } else {
      excluded.push({
        vehicle: result.vehicle,
        reasons: result.hardFails,
        modelLine: getModelLineKey(result.vehicle),
        label: result.facts?.label ?? result.vehicle.model,
      });
    }
  }

  return { eligible, excluded };
}

export function buildExclusionHint(profile, excluded = []) {
  if (!excluded.length) return null;

  if (profile.seatsMin >= 7) {
    const evCompact = excluded.filter((e) =>
      ['ev2', 'ev3', 'ev4'].includes(e.modelLine)
      && e.reasons.some((r) => r.code === 'seats_insufficient'),
    );
    if (evCompact.length) {
      return 'EV2, EV3 und EV4 sind keine 7-Sitzer und wurden deshalb nicht empfohlen.';
    }
  }

  if (profile.fuel === 'electric') {
    const nonEv = excluded.filter((e) =>
      e.reasons.some((r) => r.code === 'fuel_mismatch'),
    );
    if (nonEv.length >= 3) {
      return 'Nur elektrische Kia-Modelle werden für Ihre Elektro-Suche berücksichtigt.';
    }
  }

  return null;
}

export function buildNoExactMatchMessage(profile, excluded = []) {
  if (profile.fuel === 'electric' && profile.seatsMin >= 7) {
    const overBudget = excluded.some((e) =>
      e.reasons.some((r) => r.code === 'budget_exceeded') && e.modelLine === 'ev9',
    );
    if (overBudget) {
      return 'Kein Elektro-7-Sitzer in Ihrer Preisklasse. Der Kia EV9 startet darüber – Alternativen: Sorento Plug-in Hybrid oder Elektro-5-Sitzer.';
    }
    const hasEv9 = excluded.some((e) => e.modelLine === 'ev9');
    if (!hasEv9) {
      return 'Kein exakter Kia-Treffer für Elektro mit 7 Sitzen. Alternative: Sorento Plug-in Hybrid oder EV9 prüfen.';
    }
  }
  if (profile.seatsMin >= 7) {
    return 'Kein exakter 7-Sitzer-Treffer. Wir empfehlen Sorento oder EV9.';
  }
  return null;
}
