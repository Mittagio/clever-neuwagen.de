/**
 * Home-/Composer-Intake: Seller sieht Ergebnis-Karte, kein Live-Protokoll.
 *
 * Universal Clever grammar freeze:
 * verstehen → gezielt ergänzen → handeln → bestätigen → weiterreden
 * Soft Need (Telefon) = important; Business Step (Angebot) = secondary while needs open.
 * After phone subtask: short confirm + Composer back to Clever + refreshed card.
 */
import {
  buildInboundLeadReviewModel,
  buildIntakeNextActions,
} from './inboundLeadIntake.js';
import { buildPhoneAddedMicroConfirm } from './composerSurfaceState.js';

const QUIET_INTAKE_REVIEW_TYPES = new Set([
  'customer_intake_review',
  'inbound_lead_review',
  'customer_contract_tradein_intake_review',
  'multi_source_apply_result',
]);

const QUIET_INTAKE_KINDS = new Set([
  'customer_intake',
  'multi_source_intake',
  'multi_source_apply_result',
]);

/** Phrasen, die nie in seller-facing Progress/Meta landen dürfen. */
export const INTAKE_PROTOCOL_PHRASE_RE = /Seller-Dump|zusammengeführt|sucht in (Ihren )?Kunden|Clever wertet aus|Clever hat erkannt|Clever hat eine Anfrage|Clever hat einen Beratungsfall|Erkannt als neue Anfrage|Clever liest die Kundenanfrage/i;

/**
 * @param {object|null|undefined} model
 */
export function isQuietIntakeReview(model) {
  if (!model || typeof model !== 'object') return false;
  if (model.quietIntake === true) return true;
  if (QUIET_INTAKE_REVIEW_TYPES.has(model.reviewType)) return true;
  if (QUIET_INTAKE_KINDS.has(model.kind)) return true;
  if (model.legacyReviewType === 'inbound_lead_review') return true;
  return false;
}

/**
 * @param {object|null|undefined} turn
 */
export function isQuietIntakeTurn(turn) {
  if (!turn || typeof turn !== 'object') return false;
  if (turn.inboundLead?.detected) return true;
  if (turn.multiSourceIntake?.detected) return true;
  if (isQuietIntakeReview(turn.reviewModel)) return true;
  return false;
}

function chipFromNextAction(action) {
  if (!action) return null;
  return {
    id: action.id,
    label: action.label,
    intentChipId: action.intentChipId,
    draft: action.draft,
    composerTitle: action.composerTitle,
    placeholder: action.placeholder,
    important: Boolean(action.important),
    secondary: Boolean(action.secondary),
    weight: action.weight || (action.important ? 'important' : (action.secondary ? 'secondary' : 'normal')),
    choiceChips: Array.isArray(action.choiceChips) ? action.choiceChips : undefined,
  };
}

/**
 * Suggest-Chips unter der quiet Intake-Karte – dynamisch aus Fallstand.
 * Hierarchy: important Soft Need ≠ secondary Business Step (keine gleiche Toolbar-Gewichtung).
 * Task-Titel steuern den Composer (nicht generisches „Merken · Für den Kunden“).
 * @param {object|null|undefined} turn
 * @returns {{
 *   id: string,
 *   label: string,
 *   intentChipId?: string,
 *   draft?: string,
 *   composerTitle?: string,
 *   placeholder?: string,
 *   important?: boolean,
 *   secondary?: boolean,
 *   weight?: string,
 *   choiceChips?: object[],
 * }[]}
 */
export function resolveQuietIntakeSuggestChips(turn = null) {
  if (!isQuietIntakeTurn(turn) && !turn?.inboundLead?.detected) return [];
  return buildIntakeNextActions(turn?.inboundLead || null, turn)
    .map(chipFromNextAction)
    .filter(Boolean);
}

function collectCompletedFacts(completedTurn = null) {
  if (!completedTurn || typeof completedTurn !== 'object') return [];
  return [
    ...(Array.isArray(completedTurn.rememberDecision?.safeFacts)
      ? completedTurn.rememberDecision.safeFacts
      : []),
    ...(Array.isArray(completedTurn.extractedFacts) ? completedTurn.extractedFacts : []),
    ...(Array.isArray(completedTurn.facts) ? completedTurn.facts : []),
  ];
}

function extractPhoneFromCompletedTurn(completedTurn = null) {
  const facts = collectCompletedFacts(completedTurn);
  const phoneFact = facts.find((f) => f?.field === 'phone' || f?.field === 'mobile');
  if (phoneFact) {
    return {
      phone: String(phoneFact.label || phoneFact.value || '').trim(),
      fact: phoneFact,
    };
  }
  const raw = String(
    completedTurn?.sellerInput
    || completedTurn?.interpretedInput?.raw
    || completedTurn?.interpretedInput?.normalized
    || '',
  ).trim();
  const match = raw.match(/(?:\+?\d[\d\s\-–/()]{6,}\d)/);
  if (!match) return { phone: '', fact: null };
  return { phone: match[0].replace(/\s+/g, ' ').trim(), fact: null };
}

/**
 * Nach Subtask (z. B. Telefon ergänzen): Intake-Karte behalten, Facts mergen.
 * Feedback-Freeze: kein grüner Composer-Erfolg – State-Change + optional Micro-Confirm.
 * @returns {{
 *   lastTurn: object|null,
 *   reviewModel: object|null,
 *   feedback: null,
 *   microConfirm: object|null,
 *   highlightChipLabels: string[],
 * }}
 */
export function applyQuietIntakeSubtaskResult({
  preservedTurn = null,
  completedTurn = null,
  taskId = null,
} = {}) {
  if (!preservedTurn?.inboundLead?.detected) {
    return {
      lastTurn: preservedTurn || null,
      reviewModel: preservedTurn?.reviewModel || null,
      feedback: null,
      microConfirm: null,
      highlightChipLabels: [],
    };
  }

  const inbound = {
    ...preservedTurn.inboundLead,
    contact: { ...(preservedTurn.inboundLead.contact || {}) },
  };
  let facts = Array.isArray(preservedTurn.extractedFacts)
    ? [...preservedTurn.extractedFacts]
    : (Array.isArray(preservedTurn.sellerFacts) ? [...preservedTurn.sellerFacts] : []);

  let microConfirm = null;
  const highlightChipLabels = [];
  const completedFacts = collectCompletedFacts(completedTurn);
  const wantsPhone = taskId === 'qi_phone'
    || (!taskId && completedFacts.some((f) => f?.field === 'phone' || f?.field === 'mobile'));

  if (wantsPhone) {
    const { phone, fact } = extractPhoneFromCompletedTurn(completedTurn);
    if (phone) {
      inbound.contact.phone = phone;
      const previous = facts.find((f) => f?.field === 'phone' || f?.field === 'mobile') || null;
      const nextFact = {
        ...(fact || {
          field: 'phone',
          value: phone,
          label: phone,
          confidence: 0.9,
        }),
        previousValue: previous
          ? {
            value: previous.value,
            label: previous.label,
            source: previous.source,
          }
          : null,
        correctionSource: 'seller',
        correctedAt: new Date().toISOString(),
        source: fact?.source || 'manual_edit',
      };
      if (!previous) {
        facts.push(nextFact);
      } else {
        facts = facts.map((f) => (
          (f?.field === 'phone' || f?.field === 'mobile')
            ? { ...f, ...nextFact, field: f.field }
            : f
        ));
      }
      microConfirm = buildPhoneAddedMicroConfirm();
      highlightChipLabels.push(phone);
    }
  }

  if (taskId === 'qi_model') {
    const vehicleFact = completedFacts.find((f) => (
      f?.field === 'vehicleInterest' || f?.field === 'vehicleInterestMulti'
    ));
    if (vehicleFact) {
      const previous = facts.find((f) => (
        f?.field === 'vehicleInterest' || f?.field === 'vehicleInterestMulti'
      )) || null;
      const nextVehicle = {
        ...vehicleFact,
        field: 'vehicleInterest',
        previousValue: previous
          ? {
            value: previous.value,
            label: previous.label,
            source: previous.source,
          }
          : null,
        correctionSource: 'seller',
        correctedAt: new Date().toISOString(),
        source: vehicleFact.source || 'manual_edit',
      };
      facts = [
        ...facts.filter((f) => (
          f?.field !== 'vehicleInterest' && f?.field !== 'vehicleInterestMulti'
        )),
        nextVehicle,
      ];
      inbound.currentVehicleCandidate = {
        label: nextVehicle.label,
        value: nextVehicle.value,
        correctedAt: nextVehicle.correctedAt,
      };
      if (previous) {
        inbound.previousVehicleCandidate = {
          label: previous.label,
          value: previous.value,
        };
      }
      const modelLabel = String(vehicleFact.label || '').trim();
      if (modelLabel) highlightChipLabels.push(modelLabel);
    }
  }

  const lastTurn = {
    ...preservedTurn,
    inboundLead: inbound,
    extractedFacts: facts,
    sellerFacts: facts,
  };
  const reviewModel = {
    ...buildInboundLeadReviewModel(inbound, lastTurn),
    microConfirm,
    highlightChipLabels,
  };
  // Composer bleibt sauber – Erfolg nur über Karten-State / Micro-Confirm
  return {
    lastTurn,
    reviewModel,
    feedback: null,
    microConfirm,
    highlightChipLabels,
  };
}
