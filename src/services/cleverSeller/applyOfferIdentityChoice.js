/**
 * Offer Vehicle Identity – Choice oben und Composer unten → derselbe Draft-State.
 * Kein zweites Color-Modell.
 */
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { applyIdentityFollowUpPatch } from './vehicleIdentityDraft.js';
import { getOfferDraftById, upsertOfferDraftOnLead } from './cleverWorkingDraft.js';
import {
  listOfferIdentityColorChoices,
  listOfferIdentityPackageChoices,
  listOfferIdentityPowertrainChoices,
} from './offerVehicleIdentity.js';

function resolveModelKeyFromTurn(turn = {}) {
  const offer = (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  return offer?.payload?.vehicleIdentityDraft?.modelKey
    || offer?.payload?.modelKey
    || turn.extractedFacts?.find((f) => f.field === 'vehicleInterest')?.value?.modelKey
    || null;
}

/**
 * Katalog-Choices für lokales Identity-Clarify (Farbe / Variante / Paket).
 * @param {object} slot – missingInformation-Eintrag
 * @param {string|null} modelKey
 */
export function resolveOfferIdentityClarifyChoices(slot = {}, modelKey = null) {
  const id = String(slot.id || '');
  if (id === 'offer_color' || slot.field === 'colorPreference') {
    const catalog = listOfferIdentityColorChoices(modelKey);
    if (catalog.length) {
      return catalog.map((c) => ({
        id: c.id,
        label: c.label,
        swatch: c.swatch || null,
        insertText: c.label,
      }));
    }
  }
  if (id === 'offer_motor' || slot.field === 'motorPreference') {
    const catalog = listOfferIdentityPowertrainChoices(modelKey);
    if (catalog.length) {
      return catalog.map((c) => ({
        id: c.id,
        label: c.label,
        insertText: c.label,
      }));
    }
  }
  if (id === 'offer_packages') {
    const catalog = listOfferIdentityPackageChoices(modelKey);
    if (catalog.length) {
      return catalog.map((c) => ({
        id: c.id,
        label: c.label,
        insertText: c.label,
      }));
    }
  }
  return (Array.isArray(slot.choices) ? slot.choices : [])
    .map((c) => ({
      id: c.id || c.label,
      label: c.label || c.insertText || String(c.id || ''),
      swatch: c.swatch || null,
      insertText: c.insertText || c.label || null,
    }))
    .filter((c) => c.label);
}

function patchFieldFromChoice(field, choice = {}) {
  const label = String(choice.label || choice.insertText || '').trim();
  const id = choice.id || null;
  if (field === 'colorPreference' || field === 'color') {
    return { color: label, colorId: id };
  }
  if (field === 'motorPreference' || field === 'powertrain') {
    return { powertrain: label };
  }
  if (field === 'equipmentWish' || field === 'package') {
    return { addPackages: label ? [label] : [] };
  }
  if (field === 'trimPreference' || field === 'trim') {
    return { trim: label };
  }
  return { color: label };
}

function missingIdForField(field) {
  if (field === 'colorPreference' || field === 'color') return 'offer_color';
  if (field === 'motorPreference' || field === 'powertrain') return 'offer_motor';
  if (field === 'equipmentWish' || field === 'package') return 'offer_packages';
  return null;
}

/**
 * Wendet Katalog-Choice auf Seller-Turn + optional Lead-Draft an (gleiche offerDraftId).
 * @returns {{ turn: object, lead: object|null, offerDraftId: string|null }}
 */
export function applyOfferIdentityChoiceToSellerTurn(turn = {}, choice = {}, opts = {}) {
  const field = opts.field || choice.field || 'colorPreference';
  const label = String(choice.label || choice.insertText || '').trim();
  if (!turn || !label) {
    return { turn, lead: opts.lead || null, offerDraftId: null };
  }

  const identityPatch = patchFieldFromChoice(field, choice);
  const dropMissingId = missingIdForField(field);

  let facts = Array.isArray(turn.extractedFacts) ? [...turn.extractedFacts] : [];
  if (field === 'colorPreference' || field === 'color') {
    facts = facts.filter((f) => f.field !== 'colorPreference');
    facts.push({
      field: 'colorPreference',
      label,
      value: { color: label, colorId: choice.id || null },
      confidence: 1,
      needsConfirmation: false,
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
    });
  }

  const missingInformation = (turn.missingInformation || []).filter((m) => (
    m.id !== dropMissingId
    && m.field !== field
  ));

  let offerDraftId = opts.offerDraftId
    || turn.preparedActions?.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
      ?.payload?.offerDraftId
    || null;

  const preparedActions = (turn.preparedActions || []).map((action) => {
    if (action.type !== SELLER_TURN_INTENTS.PREPARE_OFFER) return action;
    const payload = { ...(action.payload || {}) };
    if (payload.vehicleIdentityDraft) {
      payload.vehicleIdentityDraft = applyIdentityFollowUpPatch(
        payload.vehicleIdentityDraft,
        identityPatch,
      );
    }
    if (identityPatch.color != null) {
      payload.color = identityPatch.color;
      payload.colorId = identityPatch.colorId || choice.id || null;
    }
    if (!offerDraftId && payload.offerDraftId) offerDraftId = payload.offerDraftId;
    return { ...action, payload };
  });

  let lead = opts.lead || null;
  if (lead && offerDraftId) {
    const draft = getOfferDraftById(lead, offerDraftId);
    if (draft?.vehicleIdentityDraft) {
      const nextIdentity = applyIdentityFollowUpPatch(draft.vehicleIdentityDraft, identityPatch);
      lead = upsertOfferDraftOnLead(lead, {
        ...draft,
        offerDraftId,
        vehicleIdentityDraft: nextIdentity,
      });
      const profile = { ...(lead.crm?.needProfile || {}) };
      if (identityPatch.color) {
        profile.colorPreference = String(identityPatch.color).toLowerCase();
      }
      lead = {
        ...lead,
        crm: {
          ...(lead.crm || {}),
          needProfile: profile,
        },
        wish: {
          ...(lead.wish || {}),
          preferredColor: identityPatch.color || lead.wish?.preferredColor,
        },
      };
    }
  }

  return {
    turn: {
      ...turn,
      extractedFacts: facts,
      missingInformation,
      preparedActions,
    },
    lead,
    offerDraftId,
  };
}

export { resolveModelKeyFromTurn };
