/**
 * Verifiziertes Fahrzeugwissen für den Clever Composer (Slice 4).
 * Deterministische Lookups – kein OpenAI-Modellwissen als Quelle.
 */
import {
  lookupVehicleVariant,
  lookupPackageContents,
  lookupRelevantEquipment,
  lookupSellerVehicleFact,
} from '../crm/magic/magicKnowledgeTools.js';
import { interpretMessageInstruction } from '../crm/magic/interpretMessageInstruction.js';
import { resolveTargetVehicle } from '../crm/magic/resolveTargetVehicle.js';

/**
 * @param {{
 *   sellerInput?: string,
 *   vehicleIdentity?: object|null,
 *   sellerFacts?: object[],
 *   requiredKnowledge?: string[],
 *   workingContext?: object,
 *   offerContext?: object,
 *   lead?: object,
 *   allowWithoutPackageDetails?: boolean,
 * }} params
 */
export function resolveGroundedVehicleKnowledge(params = {}) {
  const sellerInput = String(params.sellerInput || '');
  const interpretation = interpretMessageInstruction(sellerInput, {
    workingContext: params.workingContext,
    offerContext: params.offerContext,
  });

  const sellerFacts = [
    ...(interpretation.sellerFacts || []),
    ...(Array.isArray(params.sellerFacts) ? params.sellerFacts : []),
  ];
  const requiredKnowledge = [
    ...new Set([
      ...(interpretation.requiredKnowledge || []),
      ...(Array.isArray(params.requiredKnowledge) ? params.requiredKnowledge : []),
    ]),
  ];

  let vehicle = params.vehicleIdentity || null;
  let vehicleAmbiguity = null;

  if (!vehicle?.modelKey) {
    const resolved = resolveTargetVehicle({
      workingContext: params.workingContext,
      offerContext: params.offerContext,
      sellerFacts,
      lead: params.lead,
      openVehicles: params.openVehicles || [],
      rawSellerInput: sellerInput,
    });
    if (!resolved.ok && resolved.ambiguity) {
      vehicleAmbiguity = resolved.ambiguity;
    } else {
      vehicle = resolved.vehicle || null;
    }
  }

  // Trim aus Seller Facts nachziehen (resolveTargetVehicle liefert oft nur Modell)
  if (vehicle?.modelKey && !vehicle.trimId && !vehicle.trim) {
    const trimFact = sellerFacts.find((f) => f.type === 'trim');
    if (trimFact?.value) {
      vehicle = {
        ...vehicle,
        trimId: String(trimFact.value).toLowerCase().replace(/\s+/g, '-').replace(/gt.?line/, 'gt-line'),
      };
    }
  }
  if (vehicle?.modelKey && !vehicle.color) {
    const colorFact = sellerFacts.find((f) => f.type === 'color');
    if (colorFact?.value) {
      vehicle = { ...vehicle, color: colorFact.value };
    }
  }

  // Paket erklären ohne explizites Modell im Seller-Input → keine stille Lead-Ableitung
  const modelInSellerInput = sellerFacts.some((f) => f.type === 'model')
    || /\b(picanto|sportage|xceed|ev\s?[2-9]|ceed|niro|sorento|stonic|tivoli)\b/i.test(sellerInput);
  const packageFact = sellerFacts.find((f) => f.type === 'package_present');
  const needsPackage = Boolean(packageFact)
    || requiredKnowledge.includes('package_contents')
    || requiredKnowledge.includes('technology_package_contents');
  if (
    needsPackage
    && !modelInSellerInput
    && !params.workingContext?.modelKey
    && !params.offerContext?.modelKey
    && (!vehicle?.source || vehicle.source === 'lead_wish')
  ) {
    vehicleAmbiguity = {
      type: 'vehicle_unknown',
      question: 'Für welches Fahrzeug / welche Variante soll ich das Technologie-Paket erklären?',
      candidates: [],
    };
    vehicle = null;
  }

  const facts = [];
  const missingKnowledge = [];
  const conflicts = [];
  const warnings = [];
  let verifiedPackageFacts = null;
  let verifiedEquipmentFacts = null;
  let vehicleIdentity = vehicle;

  if (vehicle?.modelKey) {
    const variant = lookupVehicleVariant({
      modelKey: vehicle.modelKey,
      trim: vehicle.trimId || vehicle.trim,
    });
    if (variant.ok && variant.variant) {
      vehicleIdentity = {
        ...variant.variant,
        color: vehicle.color
          || sellerFacts.find((f) => f.type === 'color')?.value
          || null,
        label: vehicle.label || variant.variant.modelLabel,
        source: vehicle.source || 'verified_variant',
      };
      facts.push({
        factType: 'vehicle_variant',
        value: vehicleIdentity,
        source: 'verified_vehicle_data',
        evidenceId: variant.variant.evidenceId,
        confidence: 0.95,
      });
    }
  } else if (requiredKnowledge.includes('vehicle_variant') || sellerFacts.some((f) => f.type === 'model')) {
    missingKnowledge.push('vehicle_variant');
  }

  if (needsPackage && vehicleIdentity?.modelKey) {
    const pkg = lookupPackageContents({
      modelKey: vehicleIdentity.modelKey,
      trim: vehicleIdentity.trimId,
      packageName: packageFact?.value || 'Technologie-Paket',
    });
    if (pkg.ok && pkg.package?.items?.length) {
      verifiedPackageFacts = pkg.package;
      facts.push({
        factType: 'technology_package_contents',
        value: {
          label: pkg.package.label,
          items: pkg.package.items.slice(0, 8),
        },
        source: pkg.package.source || 'dealer_trim_packages',
        evidenceId: pkg.package.evidenceId,
        confidence: 0.92,
      });
    } else if (!params.allowWithoutPackageDetails) {
      missingKnowledge.push(pkg.missingKnowledgeKey || 'exact_technology_package_contents');
    }
  } else if (needsPackage && !vehicleIdentity?.modelKey) {
    missingKnowledge.push('exact_technology_package_contents');
  }

  const needsEquipment = requiredKnowledge.includes('standard_equipment')
    || requiredKnowledge.includes('relevant_gt_line_standard_equipment')
    || requiredKnowledge.includes('relevant_standard_equipment');

  if (needsEquipment && vehicleIdentity?.modelKey) {
    const eq = lookupRelevantEquipment({
      modelKey: vehicleIdentity.modelKey,
      trim: vehicleIdentity.trimId,
    });
    if (eq.ok && eq.items?.length) {
      verifiedEquipmentFacts = {
        items: eq.items,
        evidenceId: eq.evidenceId,
        source: eq.source,
      };
      facts.push({
        factType: 'relevant_standard_equipment',
        value: { items: eq.items.slice(0, 8) },
        source: eq.source || 'verified_equipment',
        evidenceId: eq.evidenceId,
        confidence: 0.9,
      });
    } else {
      missingKnowledge.push('standard_equipment');
    }
  }

  const sunroof = sellerFacts.find((f) => f.type === 'sunroof');
  const claimsAsStandard = /\b(serienm[aä](?:ss|ß)ig|serienausstattung|standardm[aä](?:ss|ß)ig|hat serienm)\b/i.test(sellerInput);
  if (sunroof && (claimsAsStandard || verifiedEquipmentFacts?.items)) {
    const blob = (verifiedEquipmentFacts?.items || []).join(' ').toLowerCase();
    const inStandard = /schiebedach|panorama|glasdach/.test(blob);
    if (claimsAsStandard && !inStandard) {
      warnings.push('conflicting_standard_equipment:sunroof');
      conflicts.push({
        factType: 'sunroof_as_standard',
        sellerValue: sunroof.value,
        verifiedValue: null,
        message: 'Schiebedach ist in den verifizierten Daten nicht als Serienausstattung hinterlegt. Bitte nicht als Serie ausgeben.',
      });
    } else if (sunroof && !inStandard) {
      warnings.push('seller_feature_not_in_verified_standard:sunroof');
      conflicts.push({
        factType: 'sunroof',
        sellerValue: sunroof.value,
        verifiedValue: null,
        message: 'Schiebedach ist als Verkäuferangabe zum konkreten Fahrzeug notiert, nicht als verifizierte Serienausstattung.',
      });
    }
  }

  // Seller Facts als eigene Evidenz (nicht als Serienausstattung)
  for (const sf of sellerFacts) {
    facts.push({
      factType: `seller_${sf.type}`,
      value: sf.value,
      source: 'seller_input',
      evidenceId: `seller:${sf.type}:${sf.value}`,
      confidence: 0.85,
    });
  }

  const sellerResolved = lookupSellerVehicleFact({ sellerFacts }).facts;

  return {
    ok: !vehicleAmbiguity && (Boolean(vehicleIdentity?.modelKey) || !needsPackage),
    interpretation: {
      ...interpretation,
      sellerFacts,
      requiredKnowledge,
    },
    vehicleIdentity,
    sellerFacts,
    sellerFactsResolved: sellerResolved,
    facts,
    verifiedPackageFacts,
    verifiedEquipmentFacts,
    missingKnowledge: [...new Set(missingKnowledge)],
    conflicts,
    warnings,
    vehicleAmbiguity,
    packageHighlights: (verifiedPackageFacts?.items || []).slice(0, 5),
    equipmentHighlights: (verifiedEquipmentFacts?.items || []).slice(0, 5),
  };
}
