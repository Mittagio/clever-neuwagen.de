/**
 * Schneller Deterministic-Pfad vs. Agent.
 * Kein Keyword-Gehirn für komplexe Dumps – nur hohe Sicherheit.
 */

import { isBatchOfferCue } from '../cleverSeller/commercialOfferNl.js';
import { extractVehicleModelKeysFromText } from '../cleverSeller/batchOfferTrackScope.js';
import {
  findOfferDraftByModelKey,
  parseWorkingDraftFollowUp,
  resolveActiveOfferDraft,
} from '../cleverSeller/cleverWorkingDraft.js';
import { isModelOnlyOfferCue } from '../cleverSeller/offerVehicleIdentity.js';

const SIMPLE_FACT_RE = /^(?:was\s+(?:ist|hat|liegt)|anhängelast|wltp|reichweite|heute\s+an|öffne\s+\w+)/i;
const COMPLEX_HINT_RE = /etstell|erstell|angebot|schreib|schick|merk|gleiche|wp\b|wärmepumpe|und\s+schreib|for\s+|with\s+/i;
const OFFER_FOLLOW_UP_RE = /gleich|lieber|doch|km|weiß|weiss|wp|rot|blau|schwarz|grau/i;
const APPOINTMENT_FOLLOW_UP_RE = /lieber|doch|montag|dienstag|mittwoch|donnerstag|freitag|uhr|\d{1,2}\s*:\s*\d{2}/i;
const MESSAGE_FOLLOW_UP_RE = /kürzer|länger|formeller|lockerer|umformulier|nochmal|senden|abschicken|schick\s*(?:ihm|ihr|es)?/i;
const MULTI_VEHICLE_INTEREST_RE = /\binteress(?:e|iert|ieren)\b/i;

/**
 * @returns {'deterministic_fast_path'|'clever_agent'}
 */
export function routeSellerRequest(sellerMessage = '', options = {}) {
  const text = String(sellerMessage || '').trim();
  if (!text) return 'clever_agent';

  if (options.forceAgent) return 'clever_agent';

  // Batch-Angebote: zentraler deterministic Track-Resolver (keine Agent-Single-Offer-Abweichung)
  if (isBatchOfferCue(text)) {
    return 'deterministic_fast_path';
  }

  // Concept Draft: „EV2 Angebot“ – keine Agent-Defaults, Working-Draft-Core
  if (isModelOnlyOfferCue(text)) {
    return 'deterministic_fast_path';
  }

  // Multi-Modell-Interesse: Tracks + recentVehicleTrackIds deterministisch anlegen
  const multiModels = extractVehicleModelKeysFromText(text);
  if (multiModels.length >= 2 && MULTI_VEHICLE_INTEREST_RE.test(text)) {
    return 'deterministic_fast_path';
  }

  const memory = options.workingMemory || null;
  const activeDraft = resolveActiveOfferDraft({
    lead: options.lead || null,
    workingMemory: memory,
  });

  // Identity-Follow-up am offenen Concept Draft (Manual Refinement)
  const followUp = parseWorkingDraftFollowUp(text, []);
  if (followUp && activeDraft?.offerDraftId) {
    return 'deterministic_fast_path';
  }

  // Cross-Draft Follow-up: „EV2 Air weiß“ → Draft dieses Modells (nicht Agent auf aktuellem EV3)
  if (followUp?.modelKey && findOfferDraftByModelKey(options.lead || null, followUp.modelKey)) {
    return 'deterministic_fast_path';
  }

  if (memory?.pendingAction && !followUp) return 'clever_agent';
  if (memory?.previousOfferPreparation && OFFER_FOLLOW_UP_RE.test(text) && !followUp) {
    return 'clever_agent';
  }
  if (memory?.lastAppointmentProposal && APPOINTMENT_FOLLOW_UP_RE.test(text)) {
    return 'clever_agent';
  }
  if (memory?.lastMessageDraft?.body && MESSAGE_FOLLOW_UP_RE.test(text)) {
    return 'clever_agent';
  }

  // Einfache bekannte Fact-Fragen / Dashboard
  if (text.length < 48 && SIMPLE_FACT_RE.test(text) && !COMPLEX_HINT_RE.test(text)) {
    return 'deterministic_fast_path';
  }

  // Alles Natürliche / Messy / Multi → Agent
  if (COMPLEX_HINT_RE.test(text) || text.length > 40 || /[,;]/.test(text) || /\b(und|dann|auch)\b/i.test(text)) {
    return 'clever_agent';
  }

  // Default: Agent wenn aktiviert (Caller entscheidet Flag)
  return 'clever_agent';
}
