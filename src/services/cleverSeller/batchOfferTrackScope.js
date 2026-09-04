/**
 * Batch-Angebote: exakter Track-Scope aus dem Gespräch.
 *
 * „Batch verwendet den Gesprächs-Scope, nicht irgendein aktives CRM-Fahrzeug.“
 * Count-Wörter (drei/beide/alle) erzeugen keine Fahrzeugidentität.
 */

import { resolveSellerModelAlias } from './zeroLossIntake.js';
import {
  ensureMultiVehicleInterestTracksOnLead,
  listCustomerVehicleTracks,
} from '../crm/vehicleTrack.js';

const COUNT_WORDS = Object.freeze({
  beiden: 2,
  beide: 2,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
});

/**
 * @param {string} raw
 * @returns {string|null} canonical modelKey (z. B. ev2, ev5)
 */
export function normalizeBatchModelKey(raw = '') {
  const key = String(raw || '')
    .toLowerCase()
    .replace(/^kia\s+/i, '')
    .replace(/\s+/g, '')
    .trim();
  if (!key) return null;
  const alias = resolveSellerModelAlias(key);
  if (alias?.canonical) return String(alias.canonical).toLowerCase();
  if (/^ev\d/.test(key) || /^pv\d/.test(key)) return key;
  return key;
}

/**
 * Modell-Keys aus Freitext (Gespräch / Batch-Cue).
 * @param {string} text
 * @returns {string[]}
 */
export function extractVehicleModelKeysFromText(text = '') {
  const t = String(text || '');
  if (!t.trim()) return [];
  const keys = [];
  const re = /\b(?:kia\s+)?(pv\s*5|ev\s*[2-9]|sportage|ceed|niro|picanto|sorento|stonic|seltos|k4|k5)\b/gi;
  let m = re.exec(t);
  while (m) {
    const raw = String(m[1] || '').replace(/\s+/g, '');
    const key = normalizeBatchModelKey(raw);
    if (key && !keys.includes(key)) keys.push(key);
    m = re.exec(t);
  }
  return keys;
}

/**
 * Scope aus Batch-Cue: Anzahl / alle / explizite Modelle.
 * @param {string} sellerInput
 * @returns {{
 *   kind: 'explicit'|'count'|'beide'|'alle'|'generic',
 *   count: number|null,
 *   modelKeys: string[],
 * }}
 */
export function parseBatchOfferScope(sellerInput = '') {
  const t = String(sellerInput || '').trim();
  const modelKeys = extractVehicleModelKeysFromText(t);
  const explicitFor = /\bangebote?\s+(?:für|fuer)\s+/i.test(t)
    || /\bfür\s+(?:den\s+|die\s+|das\s+)?(?:kia\s+)?(?:ev|pv)/i.test(t);

  if (modelKeys.length >= 1 && (explicitFor || modelKeys.length >= 2)) {
    return {
      kind: 'explicit',
      count: modelKeys.length,
      modelKeys,
    };
  }

  if (/\balle\b/i.test(t) && /\bangebote?\b/i.test(t)) {
    return { kind: 'alle', count: null, modelKeys: [] };
  }

  const beide = /\bbeide(?:n)?\b/i.test(t);
  if (beide) {
    return { kind: 'beide', count: 2, modelKeys: [] };
  }

  const digit = t.match(/\b(?:die\s+)?(\d+)\s+angebote?\b/i)
    || t.match(/\bmach(?:e|en)?\s+(?:mir\s+)?(?:die\s+)?(\d+)\s+angebote?\b/i);
  if (digit?.[1]) {
    const n = Number(digit[1]);
    return {
      kind: 'count',
      count: Number.isFinite(n) && n > 0 ? n : null,
      modelKeys: [],
    };
  }

  for (const [word, n] of Object.entries(COUNT_WORDS)) {
    if (word === 'beide' || word === 'beiden') continue;
    const re = new RegExp(`\\b(?:die\\s+)?${word}\\s+angebote?\\b`, 'i');
    if (re.test(t)) {
      return { kind: 'count', count: n, modelKeys: [] };
    }
  }

  return { kind: 'generic', count: null, modelKeys: [] };
}

function trackModelKey(track) {
  return normalizeBatchModelKey(
    track?.config?.modelKey
    || track?.modelKey
    || track?.modelLabel
    || track?.displayName
    || '',
  );
}

/**
 * Recent Track-IDs aus Memory + Lead Working State.
 */
export function resolveRecentVehicleTrackIds({
  lead = null,
  workingMemory = null,
} = {}) {
  const fromMem = Array.isArray(workingMemory?.recentVehicleTrackIds)
    ? workingMemory.recentVehicleTrackIds
    : [];
  const fromLead = Array.isArray(lead?.crm?.cleverWorkingState?.recentVehicleTrackIds)
    ? lead.crm.cleverWorkingState.recentVehicleTrackIds
    : [];
  const out = [];
  for (const id of [...fromMem, ...fromLead]) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Recent Model-Keys aus Memory / Gespräch / NeedProfile (nur Multi-Set).
 * Count-Wörter erzeugen keine Keys. Keine stillen CRM-Primary-Fahrzeuge.
 */
export function resolveRecentVehicleModelKeys({
  lead = null,
  workingMemory = null,
  conversationHistory = null,
  sellerInput = '',
} = {}) {
  const out = [];
  const push = (key) => {
    const k = normalizeBatchModelKey(key);
    if (k && !out.includes(k)) out.push(k);
  };

  for (const k of (workingMemory?.recentVehicleModelKeys || [])) push(k);
  for (const k of (lead?.crm?.cleverWorkingState?.recentVehicleModelKeys || [])) push(k);

  // Letzter Seller-Turn mit ≥2 gemeinsamen Fahrzeug-Mentions = Gesprächs-Scope
  const turns = Array.isArray(conversationHistory)
    ? conversationHistory
    : (workingMemory?.conversationTurns || []);
  let jointFromHistory = [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    const text = turn?.text || turn?.content || '';
    const role = turn?.role;
    if (role && role !== 'user' && role !== 'seller') continue;
    const keys = extractVehicleModelKeysFromText(text);
    if (keys.length >= 2) {
      jointFromHistory = keys;
      break;
    }
  }
  for (const k of jointFromHistory) push(k);

  // NeedProfile.modelCandidates nur wenn ≥2 (Multi-Interest-Set), nicht Single-History
  const candidates = lead?.crm?.needProfile?.modelCandidates || [];
  if (Array.isArray(candidates) && candidates.length >= 2) {
    for (const k of candidates) push(k);
  }

  for (const k of extractVehicleModelKeysFromText(sellerInput)) push(k);

  return out;
}

/**
 * Letzter gemeinsamer Multi-Mention-Scope (ohne NeedProfile-Merge).
 */
export function resolveJointMentionModelKeys({
  workingMemory = null,
  conversationHistory = null,
  sellerInput = '',
} = {}) {
  const fromInput = extractVehicleModelKeysFromText(sellerInput);
  if (fromInput.length >= 2) return fromInput;

  const turns = Array.isArray(conversationHistory)
    ? conversationHistory
    : (workingMemory?.conversationTurns || []);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    const text = turn?.text || turn?.content || '';
    const role = turn?.role;
    if (role && role !== 'user' && role !== 'seller') continue;
    const keys = extractVehicleModelKeysFromText(text);
    if (keys.length >= 2) return keys;
  }
  return [];
}

function matchTracksByModelKeys(tracks, modelKeys) {
  const byKey = new Map();
  for (const track of tracks) {
    const key = trackModelKey(track);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, track);
  }
  const matched = [];
  for (const key of modelKeys) {
    const k = normalizeBatchModelKey(key);
    const track = byKey.get(k);
    if (track) matched.push(track);
  }
  return matched;
}

/**
 * Stellt Tracks für Model-Keys sicher (ohne fremde CRM-Fahrzeuge).
 */
export function ensureTracksForBatchModelKeys(lead, modelKeys = []) {
  const keys = (modelKeys || []).map(normalizeBatchModelKey).filter(Boolean);
  if (!keys.length) {
    return { lead, trackIds: [], tracks: [] };
  }
  const interests = keys.map((modelKey) => ({
    modelKey,
    model: /^ev\d$/i.test(modelKey) ? modelKey.toUpperCase() : modelKey,
    make: 'Kia',
    label: `Kia ${/^ev\d$/i.test(modelKey) ? modelKey.toUpperCase() : modelKey}`,
  }));
  const ensured = ensureMultiVehicleInterestTracksOnLead(lead, interests, {
    sharedRequirements: [],
  });
  const tracks = listCustomerVehicleTracks(ensured.lead);
  const ordered = ensured.trackIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter(Boolean);
  return {
    lead: ensured.lead,
    trackIds: ensured.trackIds,
    tracks: ordered,
  };
}

/**
 * Zentraler Batch-Track-Resolver (Agent + Deterministik).
 *
 * @returns {{
 *   ok: boolean,
 *   tracks: object[],
 *   trackIds: string[],
 *   modelKeys: string[],
 *   lead: object|null,
 *   reason: string|null,
 *   scope: object,
 * }}
 */
export function resolveBatchOfferTracks({
  lead = null,
  sellerInput = '',
  workingMemory = null,
  conversationHistory = null,
  ensureMissingTracks = true,
} = {}) {
  const scope = parseBatchOfferScope(sellerInput);
  let nextLead = lead;
  const allTracks = listCustomerVehicleTracks(nextLead);
  const recentIds = resolveRecentVehicleTrackIds({ lead: nextLead, workingMemory });
  const recentById = recentIds
    .map((id) => allTracks.find((t) => t.id === id))
    .filter(Boolean);

  /** @type {string[]} */
  let targetModelKeys = [];
  /** @type {object[]} */
  let selected = [];

  if (scope.kind === 'explicit' && scope.modelKeys.length) {
    targetModelKeys = scope.modelKeys;
    selected = matchTracksByModelKeys(allTracks, targetModelKeys);
  } else if (recentById.length >= 2) {
    selected = [...recentById];
    targetModelKeys = selected.map(trackModelKey).filter(Boolean);
    if (scope.kind === 'beide' || scope.count === 2) {
      selected = selected.slice(-2);
      targetModelKeys = selected.map(trackModelKey).filter(Boolean);
    } else if (scope.count != null && selected.length > scope.count) {
      selected = selected.slice(0, scope.count);
      targetModelKeys = selected.map(trackModelKey).filter(Boolean);
    } else if (scope.count != null && selected.length < scope.count) {
      const joint = resolveJointMentionModelKeys({
        workingMemory,
        conversationHistory,
        sellerInput,
      });
      const fromKeys = joint.length >= scope.count
        ? joint
        : resolveRecentVehicleModelKeys({
          lead: nextLead,
          workingMemory,
          conversationHistory,
          sellerInput,
        });
      targetModelKeys = fromKeys.slice(0, scope.count);
      selected = matchTracksByModelKeys(allTracks, targetModelKeys);
    }
  } else {
    const joint = resolveJointMentionModelKeys({
      workingMemory,
      conversationHistory,
      sellerInput,
    });
    targetModelKeys = joint.length >= 2
      ? joint
      : resolveRecentVehicleModelKeys({
        lead: nextLead,
        workingMemory,
        conversationHistory,
        sellerInput,
      });

    if (scope.kind === 'beide' || scope.count === 2) {
      targetModelKeys = targetModelKeys.slice(0, 2);
    } else if (scope.count != null && targetModelKeys.length > scope.count) {
      // „die drei“ → exakt die ersten N des gemeinsamen Mentions (Reihenfolge Gespräch)
      targetModelKeys = targetModelKeys.slice(0, scope.count);
    } else if (scope.kind === 'alle') {
      // alle = Gesprächs-Scope / recent keys – niemals stille CRM-History (EV4)
      if (targetModelKeys.length < 2) {
        const candidates = lead?.crm?.needProfile?.modelCandidates || [];
        if (Array.isArray(candidates) && candidates.length >= 2) {
          targetModelKeys = candidates.map(normalizeBatchModelKey).filter(Boolean);
        }
      }
    }

    selected = matchTracksByModelKeys(allTracks, targetModelKeys);
  }

  // Tracks für Scope nachziehen – niemals Primary/EV4-History injizieren
  if (ensureMissingTracks && targetModelKeys.length >= 2) {
    const missing = targetModelKeys.filter((k) => !selected.some((t) => trackModelKey(t) === k));
    if (missing.length || selected.length < targetModelKeys.length) {
      const ensured = ensureTracksForBatchModelKeys(nextLead, targetModelKeys);
      nextLead = ensured.lead;
      selected = ensured.tracks;
    }
  }

  // Count-Wörter: harte Kappung auf Scope – Reihenfolge der Ziel-Keys beibehalten
  if (scope.count != null && selected.length > scope.count) {
    selected = matchTracksByModelKeys(selected, targetModelKeys.slice(0, scope.count));
    if (selected.length > scope.count) {
      selected = selected.slice(0, scope.count);
    }
  }

  if (selected.length < 2) {
    return {
      ok: false,
      tracks: [],
      trackIds: [],
      modelKeys: targetModelKeys,
      lead: nextLead,
      reason: 'insufficient_batch_tracks',
      scope,
    };
  }

  // Safety: keine Tracks außerhalb des Model-Scopes (z. B. EV4 History)
  if (targetModelKeys.length >= 2) {
    const allowed = new Set(targetModelKeys);
    selected = selected.filter((t) => allowed.has(trackModelKey(t)));
    // Reihenfolge = targetModelKeys
    selected = matchTracksByModelKeys(selected, targetModelKeys);
  }

  if (selected.length < 2) {
    return {
      ok: false,
      tracks: [],
      trackIds: [],
      modelKeys: targetModelKeys,
      lead: nextLead,
      reason: 'batch_scope_empty_after_filter',
      scope,
    };
  }

  return {
    ok: true,
    tracks: selected,
    trackIds: selected.map((t) => t.id),
    modelKeys: selected.map(trackModelKey).filter(Boolean),
    lead: nextLead,
    reason: null,
    scope,
  };
}

/**
 * Persistiert recentVehicleTrackIds (+ Model-Keys) auf Lead Working State.
 */
export function setRecentVehicleTracksOnLead(lead, trackIds = [], modelKeys = []) {
  if (!lead?.id) return lead;
  const ids = (trackIds || []).filter(Boolean);
  const keys = (modelKeys || []).map(normalizeBatchModelKey).filter(Boolean);
  const prev = lead.crm?.cleverWorkingState && typeof lead.crm.cleverWorkingState === 'object'
    ? lead.crm.cleverWorkingState
    : {};
  return {
    ...lead,
    crm: {
      ...(lead.crm || {}),
      cleverWorkingState: {
        ...prev,
        recentVehicleTrackIds: ids,
        recentVehicleModelKeys: keys.length
          ? keys
          : (prev.recentVehicleModelKeys || []),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}
