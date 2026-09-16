/**
 * Offer Vehicle Identity – Choice oben und Composer unten → derselbe Draft-State.
 * Farbe / Paket / Equipment: Dual Input → Single State (keine zweite Wahrheit).
 *
 * Canonical Package State = vehicleIdentityDraft.packages am offerDraftId.
 * extractedFacts.equipmentWish = Projektion / Intake-Quelle, nach Mutation synchronisiert.
 */
import { SELLER_FACT_CLASS, SELLER_FACT_SOURCE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { applyIdentityFollowUpPatch, PACKAGE_RESOLUTION } from './vehicleIdentityDraft.js';
import {
  commitIdentityPatchOnOfferDraft,
  getOfferDraftById,
} from './cleverWorkingDraft.js';
import {
  listOfferIdentityColorChoices,
  listOfferIdentityPackageChoices,
  listOfferIdentityPowertrainChoices,
  validateOfferPackageAgainstCatalog,
} from './offerVehicleIdentity.js';

function normalizeChoiceKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function stripPruefenSuffix(label = '') {
  return String(label || '').replace(/\s*prüfen\s*$/i, '').trim();
}

function resolveModelKeyFromTurn(turn = {}) {
  const offer = (turn.preparedActions || []).find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER);
  return offer?.payload?.vehicleIdentityDraft?.modelKey
    || offer?.payload?.modelKey
    || turn.extractedFacts?.find((f) => f.field === 'vehicleInterest')?.value?.modelKey
    || turn.lead?.wish?.modelKey
    || turn.lead?.crm?.needProfile?.selectedModelKey
    || null;
}

function isPackageDismissChoice(choice = {}) {
  const id = String(choice.id || '');
  const label = String(choice.label || choice.insertText || '').trim();
  return choice.dismiss === true
    || id === 'dismiss_package'
    || /^nicht\s+übernehmen$/i.test(label);
}

function packageFactNeedle(fact = {}) {
  return stripPruefenSuffix(
    fact.value?.label
    || fact.rawExpression
    || fact.label
    || '',
  );
}

function matchesPackageFact(fact = {}, targetLabel = '') {
  if (fact?.field !== 'equipmentWish') return false;
  const target = normalizeChoiceKey(stripPruefenSuffix(targetLabel));
  if (!target) return Boolean(fact.needsConfirmation);
  const needles = [
    packageFactNeedle(fact),
    fact.label,
    fact.value?.label,
    fact.rawExpression,
    fact.span,
  ].map((v) => normalizeChoiceKey(stripPruefenSuffix(v))).filter(Boolean);
  return needles.some((n) => n === target || n.includes(target) || target.includes(n));
}

/**
 * Katalog-Choices für unsicheren Package-/Equipment-Fact (Chip „… prüfen“).
 * Kandidat zuerst, dann Modellkatalog, zuletzt „nicht übernehmen“.
 */
export function resolveUncertainPackageFactChoices(fact = {}, modelKey = null) {
  const candidateLabel = stripPruefenSuffix(
    fact.value?.label
    || fact.rawExpression
    || fact.label
    || '',
  );
  if (!candidateLabel && !modelKey) return [];

  const validation = (modelKey && candidateLabel)
    ? validateOfferPackageAgainstCatalog({
      modelKey,
      packageLabel: candidateLabel,
      trim: fact.value?.trim || null,
    })
    : null;

  const catalog = (Array.isArray(validation?.candidates) && validation.candidates.length)
    ? validation.candidates
    : listOfferIdentityPackageChoices(modelKey);

  const choices = [];
  const seen = new Set();

  const pushChoice = (entry) => {
    const label = String(entry?.label || entry?.insertText || '').trim();
    if (!label) return;
    const key = normalizeChoiceKey(entry?.id || label);
    if (!key || seen.has(key) || seen.has(normalizeChoiceKey(label))) return;
    seen.add(key);
    seen.add(normalizeChoiceKey(label));
    choices.push({
      id: entry.id || key,
      label,
      insertText: entry.insertText || label,
      dismiss: entry.dismiss === true,
      source: entry.source || (entry.dismiss ? 'dismiss' : 'catalog'),
    });
  };

  if (candidateLabel) {
    pushChoice({
      id: validation?.ok ? validation.packageId : `candidate:${normalizeChoiceKey(candidateLabel)}`,
      label: validation?.ok ? validation.packageLabel : candidateLabel,
      insertText: validation?.ok ? validation.packageLabel : candidateLabel,
      source: validation?.ok ? 'catalog' : 'candidate',
    });
  }

  for (const pkg of (catalog || []).slice(0, 8)) {
    pushChoice({ ...pkg, source: 'catalog' });
  }

  pushChoice({
    id: 'dismiss_package',
    label: 'nicht übernehmen',
    insertText: 'nicht übernehmen',
    dismiss: true,
    source: 'dismiss',
  });

  return choices;
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
  if (id === 'offer_packages' || slot.field === 'equipmentWish') {
    if (slot.field === 'equipmentWish' || slot.uncertainFact) {
      return resolveUncertainPackageFactChoices(slot.uncertainFact || {
        label: slot.label,
        value: { label: slot.label },
      }, modelKey);
    }
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
    if (isPackageDismissChoice(choice)) {
      return { removePackages: [] };
    }
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

function collectRemovePackageLabels(facts = [], targetLabel = '') {
  const labels = [];
  for (const fact of facts) {
    if (!matchesPackageFact(fact, targetLabel)) continue;
    const needle = packageFactNeedle(fact);
    if (needle) labels.push(needle);
    if (fact.label) labels.push(String(fact.label).trim());
    if (fact.value?.label) labels.push(String(fact.value.label).trim());
    if (fact.rawExpression) labels.push(String(fact.rawExpression).trim());
  }
  if (!labels.length && targetLabel) {
    labels.push(stripPruefenSuffix(targetLabel));
    labels.push(String(targetLabel).trim());
  }
  return [...new Set(labels.filter(Boolean))];
}

/**
 * Projektion: equipmentWish-Facts an canonical packages angleichen (kein Parallel-State).
 * Erhält seller_confirmed vs catalog_validated getrennt.
 */
export function projectEquipmentWishFactsFromIdentity(facts = [], identityDraft = null, opts = {}) {
  const packages = Array.isArray(identityDraft?.packages) ? identityDraft.packages : [];
  const targetLabel = stripPruefenSuffix(opts.replacesLabel || '');
  const modelKey = opts.modelKey || identityDraft?.modelKey || null;

  let next = (Array.isArray(facts) ? facts : []).filter((f) => {
    if (f.field !== 'equipmentWish') return true;
    const isPackageLike = /prüfen|paket|package|winter|wic|drive\s*wise|upgrade/i.test(
      `${f.label || ''} ${f.value?.label || ''} ${f.rawExpression || ''}`,
    );
    if (!isPackageLike && !matchesPackageFact(f, targetLabel)) return true;
    if (targetLabel && matchesPackageFact(f, targetLabel)) return false;
    if (isPackageLike) return false;
    return true;
  });

  for (const pkg of packages) {
    const raw = String(pkg?.raw || pkg?.canonical || '').trim();
    if (!raw) continue;
    const clean = stripPruefenSuffix(raw);
    const storedResolution = pkg.resolution || null;
    const validated = modelKey && clean
      ? validateOfferPackageAgainstCatalog({
        modelKey,
        packageLabel: clean,
        trim: identityDraft?.trim?.canonical || identityDraft?.trim?.raw || null,
      })
      : null;

    // Neu berechnen nur wenn Katalog jetzt trifft; sonst gespeicherte Seller-Semantik behalten
    let resolution = storedResolution;
    let catalogValidated = pkg.catalogValidated === true;
    if (validated?.ok) {
      resolution = PACKAGE_RESOLUTION.CATALOG_VALIDATED;
      catalogValidated = true;
    } else if (
      storedResolution === PACKAGE_RESOLUTION.SELLER_CONFIRMED
      || (pkg.status === 'captured' && pkg.catalogValidated === false)
    ) {
      resolution = PACKAGE_RESOLUTION.SELLER_CONFIRMED;
      catalogValidated = false;
    } else if (
      storedResolution === PACKAGE_RESOLUTION.UNRESOLVED
      || /prüfen/i.test(raw)
      || pkg.status === 'needs_refinement'
    ) {
      resolution = PACKAGE_RESOLUTION.UNRESOLVED;
      catalogValidated = false;
    } else if (!resolution) {
      resolution = PACKAGE_RESOLUTION.UNRESOLVED;
      catalogValidated = false;
    }

    const needsConfirmation = resolution === PACKAGE_RESOLUTION.UNRESOLVED;
    const displayLabel = catalogValidated && validated?.ok
      ? validated.packageLabel
      : clean;

    next.push({
      field: 'equipmentWish',
      label: needsConfirmation ? `${clean} prüfen` : displayLabel,
      value: {
        id: catalogValidated ? (validated?.packageId || pkg.packageId || null) : null,
        label: displayLabel,
        resolution,
        catalogValidated,
        ...(modelKey ? { modelKey, targetScope: 'offer_vehicle' } : {}),
        validationStatus: catalogValidated
          ? 'ok'
          : (resolution === PACKAGE_RESOLUTION.SELLER_CONFIRMED
            ? 'seller_confirmed'
            : 'needs_review'),
        ...(needsConfirmation
          ? { validationReason: validated?.reason || 'unknown_or_ambiguous_package' }
          : {}),
      },
      confidence: needsConfirmation ? 0.72 : 1,
      needsConfirmation,
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
    });
  }
  return next;
}

/**
 * Wendet Katalog-Choice auf Seller-Turn + Lead-Draft an (gleiche offerDraftId).
 * Package: Domain-Mutation = commitIdentityPatchOnOfferDraft (wie Composer).
 * @returns {{ turn: object, lead: object|null, offerDraftId: string|null }}
 */
export function applyOfferIdentityChoiceToSellerTurn(turn = {}, choice = {}, opts = {}) {
  const field = opts.field || choice.field || 'colorPreference';
  const label = String(choice.label || choice.insertText || '').trim();
  const isDismiss = (field === 'equipmentWish' || field === 'package')
    && isPackageDismissChoice(choice);
  if (!turn || (!label && !isDismiss)) {
    return { turn, lead: opts.lead || null, offerDraftId: null };
  }

  const targetLabel = stripPruefenSuffix(
    opts.replacesLabel
    || opts.targetLabel
    || choice.replacesLabel
    || '',
  );
  const modelKey = opts.modelKey || resolveModelKeyFromTurn(turn);
  let identityPatch = patchFieldFromChoice(field, choice);
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

  if (field === 'equipmentWish' || field === 'package') {
    const matching = facts.filter((f) => matchesPackageFact(f, targetLabel));
    const removeLabels = collectRemovePackageLabels(
      matching.length ? matching : facts.filter((f) => f.field === 'equipmentWish' && f.needsConfirmation),
      targetLabel,
    );
    if (isDismiss) {
      identityPatch = { removePackages: removeLabels };
    } else {
      const validated = modelKey
        ? validateOfferPackageAgainstCatalog({
          modelKey,
          packageLabel: label,
        })
        : null;
      const resolvedLabel = validated?.ok ? validated.packageLabel : stripPruefenSuffix(label);
      identityPatch = {
        removePackages: removeLabels,
        addPackages: resolvedLabel
          ? [{
            raw: resolvedLabel,
            catalogValidated: Boolean(validated?.ok),
            resolution: validated?.ok
              ? PACKAGE_RESOLUTION.CATALOG_VALIDATED
              : PACKAGE_RESOLUTION.SELLER_CONFIRMED,
            packageId: validated?.ok ? validated.packageId : null,
            canonical: validated?.ok ? validated.packageLabel : null,
            sellerConfirmed: !validated?.ok,
          }]
          : [],
      };
    }
  }

  const missingInformation = (turn.missingInformation || []).filter((m) => (
    m.id !== dropMissingId
    && m.field !== field
  ));

  let offerDraftId = opts.offerDraftId
    || turn.preparedActions?.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
      ?.payload?.offerDraftId
    || turn.lead?.crm?.cleverWorkingState?.currentOfferDraftId
    || opts.lead?.crm?.cleverWorkingState?.currentOfferDraftId
    || null;

  let lead = opts.lead || null;
  let nextIdentityFromCommit = null;

  if (lead && offerDraftId && (
    field === 'equipmentWish' || field === 'package'
    || field === 'colorPreference' || field === 'color'
    || field === 'motorPreference' || field === 'trimPreference'
  )) {
    const committed = commitIdentityPatchOnOfferDraft(lead, offerDraftId, identityPatch);
    if (committed.lead) lead = committed.lead;
    nextIdentityFromCommit = committed.vehicleIdentityDraft;
  }

  const preparedActions = (turn.preparedActions || []).map((action) => {
    if (action.type !== SELLER_TURN_INTENTS.PREPARE_OFFER) return action;
    const payload = { ...(action.payload || {}) };
    if (nextIdentityFromCommit) {
      payload.vehicleIdentityDraft = nextIdentityFromCommit;
    } else if (payload.vehicleIdentityDraft) {
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

  // Package: Facts als Projektion aus canonical identity.packages
  if (field === 'equipmentWish' || field === 'package') {
    const identity = nextIdentityFromCommit
      || preparedActions.find((a) => a.type === SELLER_TURN_INTENTS.PREPARE_OFFER)
        ?.payload?.vehicleIdentityDraft
      || (lead && offerDraftId ? getOfferDraftById(lead, offerDraftId)?.vehicleIdentityDraft : null);
    facts = projectEquipmentWishFactsFromIdentity(facts, identity, {
      replacesLabel: targetLabel || label,
      modelKey,
    });
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

export { resolveModelKeyFromTurn, stripPruefenSuffix, isPackageDismissChoice };
