/**
 * Schicht 2: Harte Ausschlussregeln – Wahrheit schlägt KI.
 */

import {
  enrichVehicleWithModelAttributes,
  getKiaModelAttributes,
  vehicleFuelTruth,
} from '../../data/kia/kiaModelAttributes.js';
import { getModelLineKey } from '../sales/advisorRanking.js';

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

  if (profile.fuel === 'electric') {
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
