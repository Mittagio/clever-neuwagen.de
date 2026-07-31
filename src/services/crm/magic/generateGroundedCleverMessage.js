/**
 * generateGroundedCleverMessage – Magic Orchestrator (A–I).
 * OpenAI schreibt; Clever liefert und validiert Fakten.
 */
import { interpretMessageInstruction } from './interpretMessageInstruction.js';
import { resolveTargetVehicle } from './resolveTargetVehicle.js';
import {
  lookupVehicleVariant,
  lookupPackageContents,
  lookupRelevantEquipment,
  lookupCurrentOffer,
  lookupSellerVehicleFact,
} from './magicKnowledgeTools.js';
import {
  buildMinimalMessageContext,
  selectRelevantCustomerNeeds,
} from './buildMinimalMessageContext.js';
import { buildMagicAkteContext } from './buildMagicAkteContext.js';
import { generateCleverCustomerMessage, writeGroundedMessageFallback } from './generateCleverCustomerMessage.js';
import { validateMessageFactPreservation } from './validateMessageFactPreservation.js';

function determineRequiredKnowledge(interpretation, vehicle) {
  const required = new Set(interpretation.requiredKnowledge || []);
  if (vehicle?.modelKey) required.add('vehicle_variant');
  return [...required];
}

function retrieveVerifiedVehicleFacts({
  interpretation,
  vehicle,
  offerContext,
  tools,
}) {
  const missingKnowledge = [];
  const warnings = [];
  let verifiedPackageFacts = null;
  let verifiedEquipmentFacts = null;
  let offerFacts = null;
  let vehicleIdentity = null;

  if (vehicle?.modelKey) {
    const variant = tools.lookupVehicleVariant({
      modelKey: vehicle.modelKey,
      trim: vehicle.trimId,
    });
    if (variant.ok && variant.variant) {
      vehicleIdentity = {
        ...variant.variant,
        color: vehicle.color || variant.variant.color || null,
        label: vehicle.label || variant.variant.modelLabel,
      };
    }
  }

  const packageFact = (interpretation.sellerFacts || []).find((f) => f.type === 'package_present');
  if (packageFact && vehicle?.modelKey) {
    const pkg = tools.lookupPackageContents({
      modelKey: vehicle.modelKey,
      trim: vehicle.trimId,
      packageName: packageFact.value,
    });
    if (pkg.ok && pkg.package?.items?.length) {
      verifiedPackageFacts = pkg.package;
    } else {
      missingKnowledge.push(pkg.missingKnowledgeKey || 'exact_technology_package_contents');
    }
  } else if ((interpretation.requiredKnowledge || []).includes('package_contents')) {
    missingKnowledge.push('exact_technology_package_contents');
  }

  if ((interpretation.requiredKnowledge || []).includes('standard_equipment') && vehicle?.modelKey && vehicle?.trimId) {
    const eq = tools.lookupRelevantEquipment({
      modelKey: vehicle.modelKey,
      trim: vehicle.trimId,
    });
    if (eq.ok && eq.items?.length) {
      verifiedEquipmentFacts = {
        items: eq.items,
        evidenceId: eq.evidenceId,
        source: eq.source,
      };
    } else {
      missingKnowledge.push('standard_equipment');
    }
  }

  const preferVehicleOffer = vehicle?.source === 'seller_input_model'
    && (vehicle.offerId || vehicle.monthlyRate != null || vehicle.summary);
  const effectiveOffer = preferVehicleOffer
    ? {
      offerId: vehicle.offerId || null,
      title: vehicle.label || vehicle.modelKey || null,
      monthlyRate: vehicle.monthlyRate ?? null,
      termMonths: vehicle.termMonths ?? null,
      mileagePerYear: vehicle.mileagePerYear ?? null,
      paymentType: vehicle.paymentType ?? null,
      summary: vehicle.summary || vehicle.shortLabel || null,
    }
    : (offerContext?.offerId || offerContext?.monthlyRate != null || offerContext?.summary
      ? offerContext
      : (vehicle?.offerId || vehicle?.monthlyRate != null || vehicle?.summary
        ? {
          offerId: vehicle.offerId || null,
          title: vehicle.label || vehicle.modelKey || null,
          monthlyRate: vehicle.monthlyRate ?? null,
          termMonths: vehicle.termMonths ?? null,
          mileagePerYear: vehicle.mileagePerYear ?? null,
          paymentType: vehicle.paymentType ?? null,
          summary: vehicle.summary || vehicle.shortLabel || null,
        }
        : null));
  if (effectiveOffer?.offerId || effectiveOffer?.monthlyRate != null || effectiveOffer?.summary) {
    const offer = tools.lookupCurrentOffer({ offerContext: effectiveOffer });
    if (offer.ok) offerFacts = offer.offer;
  }

  // Seller Fact darf keine technische Ausstattung überschreiben ohne Warnung
  const sunroof = (interpretation.sellerFacts || []).find((f) => f.type === 'sunroof');
  if (sunroof && verifiedEquipmentFacts?.items) {
    warnings.push('seller_feature_not_in_verified_standard:sunroof');
  }

  return {
    vehicleIdentity,
    verifiedPackageFacts,
    verifiedEquipmentFacts,
    offerFacts,
    missingKnowledge: [...new Set(missingKnowledge)],
    warnings,
  };
}

/**
 * @param {object} params
 * @param {string} params.rawSellerInput
 * @param {object} [params.customerContext]
 * @param {object} [params.workingContext]
 * @param {object} [params.offerContext]
 * @param {object[]} [params.sellerFacts]
 * @param {object} [params.lead]
 * @param {object[]} [params.openVehicles]
 * @param {string} [params.tone]
 * @param {string} [params.recipient]
 * @param {boolean} [params.allowWithoutPackageDetails]
 * @param {object} [deps]
 */
export async function generateGroundedCleverMessage(params = {}, deps = {}) {
  const rawSellerInput = String(params.rawSellerInput ?? '').trim();
  const tools = {
    lookupVehicleVariant: deps.lookupVehicleVariant || lookupVehicleVariant,
    lookupPackageContents: deps.lookupPackageContents || lookupPackageContents,
    lookupRelevantEquipment: deps.lookupRelevantEquipment || lookupRelevantEquipment,
    lookupCurrentOffer: deps.lookupCurrentOffer || lookupCurrentOffer,
    lookupSellerVehicleFact: deps.lookupSellerVehicleFact || lookupSellerVehicleFact,
  };

  // A
  const interpretation = interpretMessageInstruction(rawSellerInput, {
    workingContext: params.workingContext,
    offerContext: params.offerContext,
  });
  if (Array.isArray(params.sellerFacts) && params.sellerFacts.length) {
    interpretation.sellerFacts = [
      ...interpretation.sellerFacts,
      ...params.sellerFacts,
    ];
  }

  // B
  const resolved = resolveTargetVehicle({
    workingContext: params.workingContext,
    offerContext: params.offerContext,
    sellerFacts: interpretation.sellerFacts,
    lead: params.lead,
    openVehicles: params.openVehicles,
    rawSellerInput,
  });

  if (!resolved.ok && resolved.ambiguity) {
    const draft = await generateCleverCustomerMessage(
      buildMinimalMessageContext({
        recipient: params.recipient || params.customerContext?.name || 'Kunde',
        rawSellerInstruction: rawSellerInput,
        tone: params.tone || 'freundlich',
      }),
      { clarifyQuestion: resolved.ambiguity.question, ambiguities: [resolved.ambiguity.question] },
      deps,
    );
    return {
      ok: true,
      mode: draft.mode,
      body: draft.body,
      usedFacts: draft.usedFacts || [],
      missingKnowledge: [],
      ambiguities: [resolved.ambiguity.question],
      warnings: draft.warnings || [],
      confidence: draft.confidence ?? 0.4,
      interpretation,
      vehicle: null,
      writer: draft.writer,
      seed: rawSellerInput,
    };
  }

  const vehicle = resolved.vehicle;

  // C + D + E
  const requiredKnowledge = determineRequiredKnowledge(interpretation, vehicle);
  interpretation.requiredKnowledge = requiredKnowledge;

  const retrieved = retrieveVerifiedVehicleFacts({
    interpretation,
    vehicle,
    offerContext: params.offerContext,
    tools,
  });

  let missingKnowledge = retrieved.missingKnowledge;
  if (params.allowWithoutPackageDetails) {
    missingKnowledge = missingKnowledge.filter((k) => k !== 'exact_technology_package_contents');
  }

  const sellerFactsResolved = tools.lookupSellerVehicleFact({
    sellerFacts: interpretation.sellerFacts,
  }).facts;

  // F
  const relevantNeeds = selectRelevantCustomerNeeds({
    lead: params.lead,
    docsOnly: interpretation.docsOnly,
    mentionedAhk: interpretation.mentionedAhk,
  });

  const akteContext = params.akteContext || buildMagicAkteContext({
    lead: params.lead,
    rawSellerInput,
    workingContext: params.workingContext,
    offerContext: params.offerContext,
    openVehicles: params.openVehicles,
  });

  const minimalContext = buildMinimalMessageContext({
    recipient: params.recipient
      || params.customerContext?.name
      || params.lead?.contact?.name
      || 'Kunde',
    rawSellerInstruction: rawSellerInput,
    relevantCustomerNeeds: relevantNeeds,
    vehicleIdentity: retrieved.vehicleIdentity || vehicle,
    sellerFacts: interpretation.sellerFacts,
    verifiedPackageFacts: retrieved.verifiedPackageFacts,
    verifiedEquipmentFacts: retrieved.verifiedEquipmentFacts,
    offerFacts: retrieved.offerFacts,
    tone: params.tone || 'freundlich',
    akteContext,
    chipIntent: params.chipIntent || akteContext.chipIntent,
  });

  // G
  let draft = await generateCleverCustomerMessage(
    minimalContext,
    {
      missingKnowledge,
      warnings: retrieved.warnings,
      ambiguities: [],
    },
    deps,
  );

  // H
  const preservation = validateMessageFactPreservation(draft.body, {
    sellerFacts: interpretation.sellerFacts,
    verifiedPackageFacts: retrieved.verifiedPackageFacts,
    verifiedEquipmentFacts: retrieved.verifiedEquipmentFacts,
    offerFacts: retrieved.offerFacts,
    missingPackageContents: missingKnowledge.includes('exact_technology_package_contents')
      && !params.allowWithoutPackageDetails,
  });

  if (!preservation.ok) {
    // Erneute Generation nur mit Fallback (kein Halluzinations-Body)
    draft = writeGroundedMessageFallback(minimalContext, {
      missingKnowledge,
      warnings: [...(draft.warnings || []), ...preservation.errors, ...preservation.warnings],
    });
  } else if (preservation.warnings.length) {
    draft.warnings = [...(draft.warnings || []), ...preservation.warnings];
  }

  // I
  return {
    ok: true,
    mode: draft.mode,
    body: draft.body,
    usedFacts: draft.usedFacts || sellerFactsResolved,
    missingKnowledge,
    ambiguities: draft.ambiguities || [],
    warnings: draft.warnings || [],
    confidence: draft.confidence ?? 0.7,
    interpretation,
    vehicle: retrieved.vehicleIdentity || vehicle,
    verifiedPackageFacts: retrieved.verifiedPackageFacts,
    verifiedEquipmentFacts: retrieved.verifiedEquipmentFacts,
    offerFacts: retrieved.offerFacts,
    writer: draft.writer,
    seed: rawSellerInput,
    uiHint: missingKnowledge.includes('exact_technology_package_contents') && !params.allowWithoutPackageDetails
      ? {
        message: 'Die Inhalte des Technologie-Pakets sind für diese Variante noch nicht eindeutig verifiziert.',
        actions: ['write_without_package_details', 'review_data'],
      }
      : null,
  };
}
