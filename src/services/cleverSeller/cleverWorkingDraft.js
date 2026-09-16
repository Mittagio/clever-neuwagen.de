/**
 * Clever Persistent Working Draft – laufende Verkäuferarbeit über Turns.
 *
 * „Ein Gespräch erzeugt Arbeitsobjekte.
 * Folge-Turns verändern diese Arbeitsobjekte, statt sie neu zu erraten.“
 *
 * Persistenz: lead.crm.cleverWorkingState (keine zweite Offer-DB).
 */

import {
  applyIdentityFollowUpPatch,
  buildComposerOfferHandoff,
  buildCommercialScenarioFromLead,
  enrichPrepareOfferPayloadWithIdentityDraft,
  formatIdentityDraftExtrasLine,
  IDENTITY_SLOT_STATUS,
} from './vehicleIdentityDraft.js';
import {
  parseOfferIdentityFollowUp,
  OFFER_MUTATION_MODE,
} from './offerVehicleIdentity.js';
import { RATE_AUTHORITY } from './captureThenOffer.js';
import { scopeCommercialScenarioToTrack } from '../crm/commercialScenarios.js';

function uid(prefix = 'wd') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePackageWishKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function packageWishKeysMatch(a = '', b = '') {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const winterA = a.includes('winter') || a.includes('wic');
  const winterB = b.includes('winter') || b.includes('wic');
  return winterA && winterB;
}

/**
 * Canonical Package-/Identity-Mutation am bestehenden Offer Draft.
 * Choice und Composer müssen hier landen (keine parallele Package-Wahrheit).
 *
 * @returns {{ lead: object, offerDraft: object|null, offerDraftId: string|null, vehicleIdentityDraft: object|null }}
 */
export function commitIdentityPatchOnOfferDraft(lead, offerDraftId, identityPatch = {}) {
  if (!lead || !offerDraftId || !identityPatch || !Object.keys(identityPatch).length) {
    return {
      lead: lead || null,
      offerDraft: null,
      offerDraftId: offerDraftId || null,
      vehicleIdentityDraft: null,
    };
  }
  const draft = getOfferDraftById(lead, offerDraftId);
  if (!draft?.vehicleIdentityDraft) {
    return {
      lead,
      offerDraft: null,
      offerDraftId,
      vehicleIdentityDraft: null,
    };
  }
  const nextIdentity = applyIdentityFollowUpPatch(draft.vehicleIdentityDraft, identityPatch);
  nextIdentity.id = draft.vehicleIdentityDraft.id;
  let nextLead = upsertOfferDraftOnLead(lead, {
    ...draft,
    offerDraftId,
    vehicleIdentityDraft: nextIdentity,
  });

  const profile = { ...(nextLead.crm?.needProfile || {}) };
  let profileChanged = false;
  if (identityPatch.color) {
    profile.colorPreference = String(identityPatch.color).toLowerCase();
    profileChanged = true;
  }
  if (
    Array.isArray(identityPatch.addPackages)
    || Array.isArray(identityPatch.removePackages)
    || identityPatch.clearPackages === true
  ) {
    let wishes = Array.isArray(profile.equipmentWishes) ? [...profile.equipmentWishes] : [];
    const removeKeys = (identityPatch.removePackages || [])
      .map(normalizePackageWishKey)
      .filter(Boolean);
    if (removeKeys.length) {
      wishes = wishes.filter((w) => {
        const wk = normalizePackageWishKey(w);
        return !removeKeys.some((rk) => packageWishKeysMatch(wk, rk));
      });
    }
    if (identityPatch.clearPackages === true) {
      const keepKeys = new Set(
        (nextIdentity.packages || []).map((p) => normalizePackageWishKey(p.raw || p.canonical)),
      );
      wishes = wishes.filter((w) => {
        const wk = normalizePackageWishKey(w);
        if (!/(paket|package|winter|wic|drivewise|upgrade)/i.test(String(w || ''))) return true;
        return keepKeys.has(wk) || [...keepKeys].some((k) => packageWishKeysMatch(wk, k));
      });
    }
    for (const add of identityPatch.addPackages || []) {
      const label = String(add || '').trim();
      if (!label) continue;
      const ak = normalizePackageWishKey(label);
      if (wishes.some((w) => packageWishKeysMatch(normalizePackageWishKey(w), ak))) continue;
      wishes.push(label);
    }
    profile.equipmentWishes = wishes;
    profileChanged = true;
  }

  if (profileChanged) {
    nextLead = {
      ...nextLead,
      crm: {
        ...(nextLead.crm || {}),
        needProfile: profile,
      },
      wish: {
        ...(nextLead.wish || {}),
        preferredColor: identityPatch.color || nextLead.wish?.preferredColor,
      },
    };
  }

  return {
    lead: nextLead,
    offerDraft: getOfferDraftById(nextLead, offerDraftId),
    offerDraftId,
    vehicleIdentityDraft: nextIdentity,
  };
}

/**
 * Leerer Working State am Lead.
 */
export function createEmptyCleverWorkingState(customerId = null) {
  return {
    currentCustomerId: customerId || null,
    currentOfferDraftId: null,
    currentMessageDraftId: null,
    currentVehicleTrackId: null,
    /** Gesprächs-Scope für Batch („die drei“) – keine CRM-Primary-Injektion */
    recentVehicleTrackIds: [],
    recentVehicleModelKeys: [],
    offerDrafts: {},
    vehicleIdentityDrafts: {},
    commercialScenarios: {},
    messageDrafts: {},
    recentWorkingContext: {
      lastIntent: null,
      lastChangedFields: [],
      activeMessageDraftId: null,
      pendingAction: null,
    },
    updatedAt: nowIso(),
  };
}

/**
 * @param {object} lead
 * @returns {object}
 */
export function getCleverWorkingState(lead = null) {
  const existing = lead?.crm?.cleverWorkingState;
  if (existing && typeof existing === 'object') {
    return {
      ...createEmptyCleverWorkingState(lead?.id),
      ...existing,
      offerDrafts: { ...(existing.offerDrafts || {}) },
      vehicleIdentityDrafts: { ...(existing.vehicleIdentityDrafts || {}) },
      commercialScenarios: { ...(existing.commercialScenarios || {}) },
      messageDrafts: { ...(existing.messageDrafts || {}) },
      recentVehicleTrackIds: Array.isArray(existing.recentVehicleTrackIds)
        ? [...existing.recentVehicleTrackIds]
        : [],
      recentVehicleModelKeys: Array.isArray(existing.recentVehicleModelKeys)
        ? [...existing.recentVehicleModelKeys]
        : [],
      recentWorkingContext: {
        ...createEmptyCleverWorkingState().recentWorkingContext,
        ...(existing.recentWorkingContext || {}),
      },
    };
  }
  return createEmptyCleverWorkingState(lead?.id || null);
}

function normalizeDraftModelKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^kia\s+/i, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Offer Draft by modelKey – bevorzugt Track-gebundene Batch-Drafts.
 * Explizites „EV2 …“ darf nicht den aktiven EV3-Draft umschreiben.
 */
export function findOfferDraftByModelKey(lead, modelKey) {
  const key = normalizeDraftModelKey(modelKey);
  if (!key || !lead?.id) return null;
  const state = getCleverWorkingState(lead);
  const matches = Object.values(state.offerDrafts || {})
    .filter((d) => normalizeDraftModelKey(d?.focusModelKey) === key);
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const trackScore = Number(Boolean(b?.vehicleTrackId)) - Number(Boolean(a?.vehicleTrackId));
    if (trackScore) return trackScore;
    return String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || ''));
  });
  return getOfferDraftById(lead, matches[0].offerDraftId);
}

/**
 * Aktiven Offer Draft aus Lead und/oder Session-Memory.
 */
export function resolveActiveOfferDraft({ lead = null, workingMemory = null } = {}) {
  const state = getCleverWorkingState(lead);
  const fromMemory = workingMemory?.currentOfferDraft || null;
  const id = fromMemory?.offerDraftId
    || workingMemory?.previousOfferPreparation?.offerDraftId
    || state.currentOfferDraftId
    || null;
  if (!id) return fromMemory || null;
  const fromLead = state.offerDrafts?.[id] || null;
  if (fromLead && fromMemory) {
    return {
      ...fromLead,
      ...fromMemory,
      offerDraftId: id,
      vehicleIdentityDraft: fromMemory.vehicleIdentityDraft
        || state.vehicleIdentityDrafts?.[fromMemory.vehicleIdentityDraftId || fromLead.vehicleIdentityDraftId]
        || fromLead.vehicleIdentityDraft
        || null,
    };
  }
  if (fromMemory) return fromMemory;
  if (fromLead) {
    return {
      ...fromLead,
      vehicleIdentityDraft: state.vehicleIdentityDrafts?.[fromLead.vehicleIdentityDraftId]
        || fromLead.vehicleIdentityDraft
        || null,
    };
  }
  return null;
}

/**
 * Follow-up-Ziel: bei explizitem Modell → Draft dieses Modells (Retarget),
 * sonst aktueller Draft. Modellnennung ist Adresse, kein stilles Umbenennen.
 */
export function resolveOfferDraftForFollowUp({
  lead = null,
  workingMemory = null,
  sellerInput = '',
  facts = [],
} = {}) {
  const followUp = parseWorkingDraftFollowUp(sellerInput, facts);
  if (followUp?.modelKey) {
    const byModel = findOfferDraftByModelKey(lead, followUp.modelKey);
    if (byModel?.offerDraftId) {
      return { draft: byModel, followUp, retargeted: true };
    }
  }
  return {
    draft: resolveActiveOfferDraft({ lead, workingMemory }),
    followUp,
    retargeted: false,
  };
}

/**
 * Offer Draft by ID – für Handoff. Null = kontrollierter Fehler, kein Fallback.
 */
export function getOfferDraftById(lead, offerDraftId) {
  if (!offerDraftId) return null;
  const state = getCleverWorkingState(lead);
  const draft = state.offerDrafts?.[offerDraftId] || null;
  if (!draft) return null;
  return {
    ...draft,
    vehicleIdentityDraft: state.vehicleIdentityDrafts?.[draft.vehicleIdentityDraftId]
      || draft.vehicleIdentityDraft
      || null,
    commercialScenario: state.commercialScenarios?.[draft.commercialScenarioId]
      || draft.commercialScenario
      || null,
  };
}

/**
 * Follow-up am bestehenden Draft? (Trim/Farbe/Paket raus – kein neues Fahrzeug)
 */
export function parseWorkingDraftFollowUp(sellerInput = '', facts = []) {
  const text = String(sellerInput || '').trim();
  if (!text) return null;

  // Paket entfernen („Winterpaket raus“, „WIC raus“, „Winter Connect raus“)
  const removePkg = text.match(
    /\b([\wÄÖÜäöüß-]*(?:paket|package|winter(?:\s*-?\s*(?:connect\s*)?paket)?|drive\s*wise|upgrade|business|heat\s*pump|wärmepumpe)|wic|winter\s*connect)\s*(?:wieder\s+)?(?:raus|weg|entfernen|ohne)\b/i,
  ) || text.match(
    /\b(?:raus|weg|entfernen|ohne)\s+(?:das\s+|den\s+|die\s+)?([\wÄÖÜäöüß-]*(?:paket|winter|drive\s*wise|upgrade|business)|wic|winter\s*connect)\b/i,
  ) || text.match(
    /\b(?:nimm|entferne|streich(?:e)?)(?:\s+das|\s+den|\s+die)?\s+([\wÄÖÜäöüß-]*(?:winter(?:\s*-?\s*(?:connect\s*)?paket)?|paket|drive\s*wise|upgrade|business)|wic|winter\s*connect)(?:\s+\w+){0,2}\s*(?:wieder\s+)?(?:raus|weg|entfernen)\b/i,
  ) || text.match(/\b(?:wic|winter\s*connect(?:\s*-?\s*paket)?|winter(?:\s*-?\s*)?paket)\s*(?:wieder\s+)?(?:raus|weg|entfernen)\b/i);
  if (
    removePkg
    || /\b(?:wic|winter\s*connect(?:\s*-?\s*paket)?|winter(?:\s*-?\s*)?paket)\s*(?:wieder\s+)?(?:raus|weg)\b/i.test(text)
    || /\b(?:nimm|entferne).{0,40}\b(?:wic|winter\s*connect|winter(?:\s*-?\s*)?paket)\b.{0,20}\b(?:raus|weg|entfernen)\b/i.test(text)
  ) {
    const rawLabel = removePkg?.[1] && !/^(raus|weg|ohne|entfernen|wieder|das|den|die|nimm)$/i.test(removePkg[1])
      ? removePkg[1]
      : 'Winterpaket';
    const label = /\bwic\b|winter\s*connect/i.test(rawLabel) || /\bwic\b|winter\s*connect/i.test(text)
      ? 'Winter Connect Paket'
      : (/winter/i.test(rawLabel) ? 'Winterpaket' : rawLabel);
    return {
      kind: 'remove_package',
      removePackages: [label, 'Winterpaket', 'Winter-Connect-Paket', 'Winter Connect Paket', 'WIC'].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      ),
      raw: text,
    };
  }

  const parsed = parseOfferIdentityFollowUp(text);
  if (parsed) {
    return {
      ...parsed,
      trim: parsed.trim || facts.find((f) => f.field === 'trimPreference')?.value?.trim || null,
      color: parsed.color
        || facts.find((f) => f.field === 'colorPreference')?.value?.color
        || (typeof facts.find((f) => f.field === 'colorPreference')?.value === 'string'
          ? facts.find((f) => f.field === 'colorPreference').value
          : null)
        || null,
    };
  }

  // Facts-only Follow-up ohne Modellwechsel (schwarz / Earth aus Interpret)
  const hasModelInterest = facts.some((f) => (
    f.field === 'vehicleInterest'
    && f.value?.modelKey
    && !f.value?.fromFollowUp
  ));
  const trimFact = facts.find((f) => f.field === 'trimPreference');
  const colorFact = facts.find((f) => f.field === 'colorPreference');
  if (!hasModelInterest && (trimFact || colorFact) && text.length <= 80) {
    return {
      kind: 'identity_facts',
      trim: trimFact?.value?.trim
        || (Array.isArray(trimFact?.value) ? trimFact.value[0] : null)
        || trimFact?.label
        || null,
      color: colorFact?.value?.color
        || (typeof colorFact?.value === 'string' ? colorFact.value : null)
        || colorFact?.label
        || null,
      raw: text,
    };
  }

  return null;
}

/**
 * Patch aus Follow-up für applyIdentityFollowUpPatch.
 */
export function followUpToIdentityPatch(followUp) {
  if (!followUp) return null;
  const patch = {};
  if (followUp.modelKey || followUp.model) {
    patch.modelKey = followUp.modelKey || null;
    patch.model = followUp.model || followUp.modelKey || null;
  }
  if (followUp.trim != null) patch.trim = followUp.trim;
  if (followUp.color != null) patch.color = String(followUp.color).replace(/^farbe\s*/i, '').trim();
  if (followUp.powertrain != null) patch.powertrain = followUp.powertrain;
  if (Array.isArray(followUp.packages) && followUp.packages.length) {
    patch.addPackages = [...followUp.packages];
  }
  if (followUp.removePackages) patch.removePackages = followUp.removePackages;
  if (followUp.kind === 'remove_package' && followUp.removePackages) {
    patch.removePackages = followUp.removePackages;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * Soll bestehender Draft mutiert werden (statt neuer Draft)?
 */
export function shouldMutateExistingOfferDraft({
  sellerInput = '',
  facts = [],
  lead = null,
  workingMemory = null,
  createNewAlternative = false,
} = {}) {
  if (createNewAlternative) return false;
  const { draft: active, followUp, retargeted } = resolveOfferDraftForFollowUp({
    lead,
    workingMemory,
    sellerInput,
    facts,
  });
  if (!active?.offerDraftId || !active?.vehicleIdentityDraft) return false;
  if (!followUp) return false;
  // Explizites anderes Modell ohne „doch“ und ohne bestehenden Draft dieses Modells
  // → oft neue Spur; „Doch EV2 Earth“ / Retarget auf EV2-Draft = update
  if (followUp.kind === 'vehicle_identity' && followUp.modelKey && !retargeted) {
    const currentKey = normalizeDraftModelKey(
      active.vehicleIdentityDraft.modelKey || active.focusModelKey,
    );
    if (normalizeDraftModelKey(followUp.modelKey) !== currentKey && !/\bdoch\b/i.test(sellerInput)) {
      return false;
    }
  }
  return true;
}

/**
 * Mutiert Ziel-Offer-Draft (aktiv oder per Modell-Retarget); behält IDs.
 */
export function mutateActiveOfferDraft({
  lead = null,
  workingMemory = null,
  sellerInput = '',
  facts = [],
} = {}) {
  const { draft: active, followUp, retargeted } = resolveOfferDraftForFollowUp({
    lead,
    workingMemory,
    sellerInput,
    facts,
  });
  if (!active?.offerDraftId || !active?.vehicleIdentityDraft) return null;
  const patch = followUpToIdentityPatch(followUp);
  if (!patch) return null;
  // Modellnennung war Adresse zum Draft – Track/Identität nicht umbenennen
  if (retargeted) {
    delete patch.modelKey;
    delete patch.model;
  }
  if (!Object.keys(patch).length) return null;

  // Shared Domain-Mutation (gleiche wie Choice → applyOfferIdentityChoice)
  const committed = commitIdentityPatchOnOfferDraft(lead, active.offerDraftId, patch);
  const nextIdentity = committed.vehicleIdentityDraft
    || applyIdentityFollowUpPatch(active.vehicleIdentityDraft, patch);
  if (nextIdentity && active.vehicleIdentityDraft?.id) {
    nextIdentity.id = active.vehicleIdentityDraft.id;
  }

  const changedFields = Object.keys(patch).filter((k) => k !== 'modelKey');
  const baseOffer = committed.offerDraft || active;
  const nextOffer = {
    ...baseOffer,
    offerDraftId: active.offerDraftId,
    vehicleIdentityDraftId: nextIdentity.id,
    vehicleIdentityDraft: nextIdentity,
    vehicleTrackId: active.vehicleTrackId || baseOffer.vehicleTrackId || null,
    focusModelKey: active.focusModelKey || nextIdentity.modelKey || null,
    commercialScenarioId: active.commercialScenarioId || baseOffer.commercialScenarioId || null,
    commercialScenario: active.commercialScenario || baseOffer.commercialScenario || null,
    rate: null,
    rateAuthority: RATE_AUTHORITY.STALE,
    invalidateVehicleRate: true,
    status: 'draft',
    mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
    createNewAlternative: false,
    updatedAt: nowIso(),
    lastChangedFields: changedFields,
    sellerInput: sellerInput || active.sellerInput,
  };

  return {
    offerDraft: nextOffer,
    vehicleIdentityDraft: nextIdentity,
    lead: committed.lead || lead,
    changedFields,
    followUp,
    retargeted,
    identityPatch: patch,
  };
}

/**
 * Baut PREPARE_OFFER-Payload für Mutation (gleiche IDs).
 */
export function buildMutatedPrepareOfferPayload(mutation, { lead = null, sellerInput = '' } = {}) {
  if (!mutation?.offerDraft) return null;
  const od = mutation.offerDraft;
  const identity = od.vehicleIdentityDraft;
  const handoff = buildComposerOfferHandoff(od, {
    sellerInput,
    paymentType: od.commercialScenario?.paymentType || lead?.paymentType || 'leasing',
  });
  const keepAuthoritativeRate = Boolean(
    mutation.fromPdf
    && od.rate != null
    && od.rateAuthority === RATE_AUTHORITY.AUTHORITATIVE,
  );
  return {
    ...handoff,
    updateOnly: true,
    offerDraftId: od.offerDraftId,
    vehicleIdentityDraftId: identity.id,
    vehicleIdentityDraft: identity,
    offerDraft: od,
    commercialScenario: od.commercialScenario || null,
    commercialScenarioId: od.commercialScenarioId || null,
    vehicleTrackId: od.vehicleTrackId || null,
    vehicleLabel: identity.vehicleLabel || handoff.vehicleLabel,
    identityExtrasLine: formatIdentityDraftExtrasLine(identity),
    createNewAlternative: false,
    mutationMode: OFFER_MUTATION_MODE.UPDATE_EXISTING,
    invalidateVehicleRate: !keepAuthoritativeRate,
    monthlyRate: keepAuthoritativeRate ? od.rate : null,
    rateAuthority: keepAuthoritativeRate
      ? RATE_AUTHORITY.AUTHORITATIVE
      : RATE_AUTHORITY.NON_AUTHORITATIVE,
    missingRate: !keepAuthoritativeRate,
    canCreateOffer: false,
    attachWorkingContext: true,
    needsSellerConfirmation: true,
    mutatesCustomer: false,
    source: mutation.fromPdf ? 'offer_pdf' : 'working_draft_follow_up',
    lastChangedFields: mutation.changedFields || [],
    vehicle: handoff.vehicle,
    calculation: keepAuthoritativeRate
      ? { monthlyRate: od.rate }
      : handoff.calculation,
  };
}

/**
 * Handoff-Cue: „Angebot vervollständigen“ → Offer-Tool für aktuellen Draft.
 */
export function isOfferHandoffCue(text = '') {
  const t = String(text || '').trim();
  if (!t || t.length > 64) return false;
  return /^(?:angebot\s+vervollst(?:ändigen|andigen)?|angebotstool(?:\s+öffnen)?|zum\s+angebots(?:tool|rechner)|offer\s+(?:complete|vervollst))\s*\.?$/i
    .test(t)
    || /\bangebot\s+vervollst(?:ändigen|andigen)\b/i.test(t);
}

/**
 * Session-Memory → Lead.crm.cleverWorkingState (Reload / Multi-Tab Basis).
 */
export function syncWorkingDraftsFromMemoryToLead(lead, memory) {
  if (!lead?.id || !memory) return lead;
  let next = lead;
  const od = memory.currentOfferDraft;
  if (od?.offerDraftId) {
    next = upsertOfferDraftOnLead(next, {
      ...od,
      vehicleIdentityDraft: od.vehicleIdentityDraft || null,
      commercialScenario: od.commercialScenario || null,
    });
  }
  const md = memory.lastMessageDraft;
  if (md?.messageDraftId && md?.body) {
    next = upsertMessageDraftOnLead(next, {
      messageDraftId: md.messageDraftId,
      body: md.body,
      intendSend: Boolean(md.intendSend),
      customerId: lead.id,
      status: md.intendSend ? 'pending_send' : 'draft',
    });
  }
  const memIds = Array.isArray(memory.recentVehicleTrackIds) ? memory.recentVehicleTrackIds : [];
  const memKeys = Array.isArray(memory.recentVehicleModelKeys) ? memory.recentVehicleModelKeys : [];
  const prev = next.crm?.cleverWorkingState || {};
  const prevIds = Array.isArray(prev.recentVehicleTrackIds) ? prev.recentVehicleTrackIds : [];
  const prevKeys = Array.isArray(prev.recentVehicleModelKeys) ? prev.recentVehicleModelKeys : [];
  // Nie kürzeren Memory-Scope über längeren Lead-Scope schreiben (Race nach Apply)
  const nextIds = memIds.length >= 2
    ? memIds
    : (prevIds.length >= 2 ? prevIds : (memIds.length ? memIds : prevIds));
  const nextKeys = memKeys.length >= 2
    ? memKeys
    : (prevKeys.length >= 2 ? prevKeys : (memKeys.length ? memKeys : prevKeys));
  if (
    nextIds.length >= 2
    || nextKeys.length >= 2
  ) {
    const sameIds = nextIds.length === prevIds.length && nextIds.every((id, i) => id === prevIds[i]);
    const sameKeys = nextKeys.join() === prevKeys.join();
    if (!sameIds || !sameKeys) {
      next = {
        ...next,
        crm: {
          ...(next.crm || {}),
          cleverWorkingState: {
            ...prev,
            recentVehicleTrackIds: nextIds,
            recentVehicleModelKeys: nextKeys,
            updatedAt: nowIso(),
          },
        },
      };
    }
  }
  return next;
}

/**
 * Persistiert Offer-/Identity-Drafts auf dem Lead.
 */
export function upsertOfferDraftOnLead(lead, offerDraft, extras = {}) {
  if (!lead?.id || !offerDraft?.offerDraftId) return lead;
  const state = getCleverWorkingState(lead);
  const identity = offerDraft.vehicleIdentityDraft || extras.vehicleIdentityDraft || null;
  const commercialRaw = offerDraft.commercialScenario
    || extras.commercialScenario
    || (offerDraft.commercialScenarioId
      ? state.commercialScenarios?.[offerDraft.commercialScenarioId]
      : null)
    || null;
  const commercial = offerDraft.vehicleTrackId
    ? (scopeCommercialScenarioToTrack(commercialRaw, offerDraft.vehicleTrackId) || commercialRaw)
    : commercialRaw;

  if (identity?.id) {
    state.vehicleIdentityDrafts[identity.id] = {
      ...identity,
      updatedAt: nowIso(),
    };
    state.currentVehicleTrackId = offerDraft.vehicleTrackId || state.currentVehicleTrackId;
  }
  if (commercial?.id) {
    state.commercialScenarios[commercial.id] = { ...commercial };
  }

  const stored = {
    offerDraftId: offerDraft.offerDraftId,
    customerId: offerDraft.customerId || lead.id,
    vehicleTrackId: offerDraft.vehicleTrackId || null,
    vehicleIdentityDraftId: identity?.id || offerDraft.vehicleIdentityDraftId || null,
    commercialScenarioId: commercial?.id || offerDraft.commercialScenarioId || null,
    status: offerDraft.status || 'draft',
    rate: offerDraft.rate ?? null,
    rateAuthority: offerDraft.rateAuthority || RATE_AUTHORITY.NON_AUTHORITATIVE,
    invalidateVehicleRate: offerDraft.invalidateVehicleRate !== false,
    createNewAlternative: Boolean(offerDraft.createNewAlternative),
    mutationMode: offerDraft.mutationMode || null,
    vehicleLabel: identity?.vehicleLabel || offerDraft.vehicleLabel || null,
    focusModelKey: identity?.modelKey || offerDraft.focusModelKey || null,
    updatedAt: nowIso(),
    createdAt: offerDraft.createdAt || state.offerDrafts[offerDraft.offerDraftId]?.createdAt || nowIso(),
    ...(offerDraft.pdfSource ? { pdfSource: offerDraft.pdfSource } : {}),
  };
  state.offerDrafts[offerDraft.offerDraftId] = stored;
  state.currentOfferDraftId = offerDraft.offerDraftId;
  state.currentCustomerId = lead.id;
  state.recentWorkingContext = {
    ...state.recentWorkingContext,
    lastIntent: 'prepare_offer',
    lastChangedFields: extras.changedFields || offerDraft.lastChangedFields || [],
    pendingAction: extras.pendingAction || state.recentWorkingContext.pendingAction,
  };
  state.updatedAt = nowIso();

  return {
    ...lead,
    crm: {
      ...(lead.crm || {}),
      cleverWorkingState: state,
    },
  };
}

/**
 * Message Draft Continuity.
 */
export function isMessageRewriteCue(text = '') {
  return /^(?:kürzer|kuerzer|länger|laenger|formeller|lockerer|umformulier(?:en)?|nochmal(?:\s+kürzer)?|freundlicher|sachlicher)\.?$/i
    .test(String(text || '').trim())
    || /\b(?:mach(?:e|en)?\s+(?:es\s+)?(?:kürzer|kuerzer|länger|laenger)|bitte\s+kürzer)\b/i.test(text);
}

export function isMessageSendCue(text = '') {
  return /^(?:senden|abschicken|schick(?:en)?(?:\s+es)?|absenden|ja\s*,?\s*senden)\.?$/i
    .test(String(text || '').trim())
    || /\b(?:jetzt\s+)?(?:abschicken|senden)\b/i.test(String(text || '').trim())
      && String(text || '').trim().length < 40;
}

export function rewriteMessageBody(body = '', cue = '') {
  const text = String(body || '').trim();
  if (!text) return text;
  const t = String(cue || '').toLowerCase();
  if (/kürzer|kuerzer/.test(t)) {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    // Begrüßung + Kernsatz + Gruß
    const greeting = lines.find((l) => /^(hallo|guten|liebe[r]?|sehr\s+geehrte)/i.test(l));
    const closing = [...lines].reverse().find((l) => /grüß|gruss|freundliche|viele\s+grüße|mfG|mit\s+freundlichen/i.test(l));
    const middle = lines.filter((l) => l !== greeting && l !== closing);
    const core = middle
      .join(' ')
      .replace(/\s+/g, ' ')
      .slice(0, 160)
      .replace(/[,:;]\s*$/, '')
      .trim();
    return [greeting, core ? `${core}.` : null, closing].filter(Boolean).join('\n\n');
  }
  if (/länger|laenger/.test(t)) {
    return `${text}\n\nFalls Sie Fragen haben, melden Sie sich gerne.`;
  }
  if (/formeller|sachlicher/.test(t)) {
    return text
      .replace(/\bHallo\b/g, 'Guten Tag')
      .replace(/\bLiebe[r]?\b/g, 'Sehr geehrte/r')
      .replace(/\bViele Grüße\b/gi, 'Mit freundlichen Grüßen');
  }
  if (/lockerer|freundlicher/.test(t)) {
    return text
      .replace(/\bGuten Tag\b/g, 'Hallo')
      .replace(/\bMit freundlichen Grüßen\b/gi, 'Viele Grüße');
  }
  return text;
}

export function upsertMessageDraftOnLead(lead, messageDraft) {
  if (!lead?.id || !messageDraft?.messageDraftId) return lead;
  const state = getCleverWorkingState(lead);
  state.messageDrafts[messageDraft.messageDraftId] = {
    ...messageDraft,
    updatedAt: nowIso(),
  };
  state.currentMessageDraftId = messageDraft.messageDraftId;
  state.recentWorkingContext = {
    ...state.recentWorkingContext,
    activeMessageDraftId: messageDraft.messageDraftId,
    lastIntent: messageDraft.intendSend ? 'intend_send' : 'draft_message',
  };
  state.updatedAt = nowIso();
  return {
    ...lead,
    crm: {
      ...(lead.crm || {}),
      cleverWorkingState: state,
    },
  };
}

export function resolveActiveMessageDraft({ lead = null, workingMemory = null } = {}) {
  const fromMemory = workingMemory?.lastMessageDraft || null;
  const state = getCleverWorkingState(lead);
  const id = fromMemory?.messageDraftId
    || workingMemory?.currentMessageDraftId
    || state.currentMessageDraftId
    || null;
  if (id && state.messageDrafts?.[id]) {
    return {
      ...state.messageDrafts[id],
      ...(fromMemory || {}),
      messageDraftId: id,
    };
  }
  if (fromMemory?.body) {
    return {
      messageDraftId: fromMemory.messageDraftId || null,
      body: fromMemory.body,
      ...fromMemory,
    };
  }
  return null;
}

/**
 * Sync Working Draft aus PREPARE_OFFER-Payload in Memory-Shape.
 */
export function offerPayloadToMemoryDraft(payload) {
  if (!payload?.offerDraftId) return null;
  return {
    offerDraftId: payload.offerDraftId,
    customerId: payload.customerId || null,
    vehicleTrackId: payload.vehicleTrackId || null,
    vehicleIdentityDraftId: payload.vehicleIdentityDraftId
      || payload.vehicleIdentityDraft?.id
      || null,
    commercialScenarioId: payload.commercialScenarioId
      || payload.commercialScenario?.id
      || null,
    status: payload.status || 'draft',
    updatedAt: nowIso(),
    vehicleIdentityDraft: payload.vehicleIdentityDraft || null,
    commercialScenario: payload.commercialScenario || null,
    rate: payload.monthlyRate ?? payload.rate ?? null,
    invalidateVehicleRate: payload.invalidateVehicleRate !== false,
    createNewAlternative: Boolean(payload.createNewAlternative),
    vehicleLabel: payload.vehicleLabel || null,
    focusModelKey: payload.focusModelKey || payload.vehicle?.modelKey || null,
    vehicle: payload.vehicle || null,
    lastChangedFields: payload.lastChangedFields || [],
  };
}

/**
 * Handoff nur by offerDraftId – kein Fahrzeug-Fallback.
 * @returns {{ ok: true, magic: object } | { ok: false, error: string }}
 */
export function buildHandoffFromOfferDraftId(lead, offerDraftId, extras = {}) {
  const draft = getOfferDraftById(lead, offerDraftId);
  if (!draft) {
    return {
      ok: false,
      error: 'offer_draft_not_found',
      message: 'Angebotsentwurf nicht gefunden – bitte erneut im Composer vorbereiten.',
    };
  }
  const identity = draft.vehicleIdentityDraft;
  if (!identity?.modelKey && !identity?.model?.canonical) {
    return {
      ok: false,
      error: 'offer_draft_incomplete',
      message: 'Angebotsentwurf ohne Fahrzeugmodell – bitte Modell ergänzen.',
    };
  }
  const full = {
    ...draft,
    vehicleIdentityDraft: identity,
    rate: draft.invalidateVehicleRate ? null : draft.rate,
    invalidateVehicleRate: true,
  };
  const magic = buildComposerOfferHandoff(full, {
    sellerInput: extras.sellerInput || '',
    paymentType: draft.commercialScenario?.paymentType || lead?.wish?.paymentType || lead?.paymentType || null,
    customerType: draft.commercialScenario?.customerType || lead?.wish?.customerType || null,
  });
  return { ok: true, magic, offerDraft: full };
}

/**
 * Stellt sicher, dass neuer Payload als Working Draft speicherbar ist.
 */
export function ensureOfferDraftBundleFromPayload(payload, { lead = null, sellerInput = '' } = {}) {
  if (!payload) return null;
  if (payload.offerDraft?.offerDraftId && payload.vehicleIdentityDraft) {
    return {
      offerDraft: payload.offerDraft,
      vehicleIdentityDraft: payload.vehicleIdentityDraft,
    };
  }
  const enriched = payload.offerDraftId
    ? payload
    : enrichPrepareOfferPayloadWithIdentityDraft(payload, {
      facts: [],
      sellerInput,
      lead,
    });
  return {
    offerDraft: enriched.offerDraft || {
      offerDraftId: enriched.offerDraftId,
      customerId: enriched.customerId || lead?.id,
      vehicleIdentityDraftId: enriched.vehicleIdentityDraftId,
      vehicleIdentityDraft: enriched.vehicleIdentityDraft,
      commercialScenario: enriched.commercialScenario
        || buildCommercialScenarioFromLead(lead || {}),
      rate: null,
      status: 'draft',
    },
    vehicleIdentityDraft: enriched.vehicleIdentityDraft,
  };
}

export { IDENTITY_SLOT_STATUS };
