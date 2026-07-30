/**
 * G) OpenAI Message Writer – schreibt nur Sprache aus Minimal Context.
 * Fallback: deterministisch nur aus verifizierten + Seller-Fakten (keine Halluzination).
 */
import { CLEVER_SURFACES, getCleverIntelligenceConfig } from '../../clever/intelligence/cleverIntelligenceConfig.js';
import { CLEVER_BASE_INSTRUCTIONS, CLEVER_INTELLIGENCE_PROMPT_VERSION } from '../../clever/intelligence/cleverBaseInstructions.js';
import { runCleverIntelligenceCore } from '../../clever/intelligence/runCleverIntelligenceCore.js';
import {
  MAGIC_MESSAGE_RESULT_JSON_SCHEMA,
  validateMagicMessageResult,
  assertGroundedMagicMessageResult,
} from './magicMessageResultSchema.js';

export const CLEVER_SURFACE_MAGIC_INSTRUCTIONS = `
OBERFLÄCHE: MAGIC KUNDEN-NACHRICHT (Verkäufer → Kunde)

Du formulierst eine sendefähige Kundennachricht auf Deutsch.
Du erfindest KEINE Fahrzeugdaten.

NUR aus dem JSON-Kontext verwenden:
- sellerFacts (Verkäuferangaben, z. B. Farbe, Schiebedach, Verfügbarkeit)
- verifiedPackageFacts.items (nur diese Paketinhalte nennen)
- verifiedEquipmentFacts.items (nur diese Serienausstattung nennen)
- offerFacts (nur diese Konditionen/Preise)
- vehicleIdentity

Wenn verifiedPackageFacts fehlt oder items leer: KEINE Paketinhalte aufzählen.
Wenn keine availability in sellerFacts: NICHT „verfügbar“ / „sofort“ behaupten.
Antworte ausschließlich als MagicMessageResult JSON (mode, body, usedFacts, …).
`.trim();

function greeting(recipient = '') {
  const name = String(recipient || '').trim();
  if (!name || name === 'Kunde' || name === 'dem Kunden') return 'Guten Tag,';
  if (/^(herr|frau)\b/i.test(name)) return `Hallo ${name},`;
  return `Hallo ${name},`;
}

function collectUsedFacts(context = {}) {
  const used = [];
  for (const f of context.sellerFacts || []) {
    used.push({
      type: f.type,
      value: String(f.value),
      source: 'seller_input',
      evidenceId: `seller:${f.type}`,
    });
  }
  if (context.verifiedPackageFacts?.items?.length) {
    used.push({
      type: 'package_contents',
      value: context.verifiedPackageFacts.items.join(', '),
      source: context.verifiedPackageFacts.source || 'verified_registry',
      evidenceId: context.verifiedPackageFacts.evidenceId || 'package',
    });
  }
  if (context.verifiedEquipmentFacts?.items?.length) {
    used.push({
      type: 'standard_equipment',
      value: context.verifiedEquipmentFacts.items.join(', '),
      source: context.verifiedEquipmentFacts.source || 'verified_registry',
      evidenceId: context.verifiedEquipmentFacts.evidenceId || 'equipment',
    });
  }
  if (context.offerFacts?.monthlyRate != null) {
    used.push({
      type: 'offer_rate',
      value: String(context.offerFacts.monthlyRate),
      source: 'offer',
      evidenceId: context.offerFacts.offerId
        ? `offer:${context.offerFacts.offerId}`
        : 'offer:rate',
    });
  }
  if (context.vehicleIdentity?.modelKey) {
    used.push({
      type: 'vehicle',
      value: [context.vehicleIdentity.modelLabel, context.vehicleIdentity.trimLabel]
        .filter(Boolean)
        .join(' ')
        || context.vehicleIdentity.modelKey,
      source: 'vehicle_identity',
      evidenceId: `variant:${context.vehicleIdentity.modelKey}:${context.vehicleIdentity.trimId || ''}`,
    });
  }
  return used;
}

/**
 * Deterministischer Writer – nur gelieferte Fakten, kein Modellwissen.
 */
export function writeGroundedMessageFallback(context = {}, options = {}) {
  const missingKnowledge = options.missingKnowledge || [];
  const ambiguities = options.ambiguities || [];

  if (options.clarifyQuestion) {
    return {
      mode: 'clarify_vehicle',
      body: options.clarifyQuestion,
      usedFacts: [],
      missingKnowledge,
      ambiguities,
      warnings: [],
      confidence: 0.4,
      writer: 'grounded_fallback',
    };
  }

  const vehicle = context.vehicleIdentity || {};
  const seller = context.sellerFacts || [];
  const color = seller.find((f) => f.type === 'color')?.value;
  const availability = seller.find((f) => f.type === 'availability')?.value;
  const sunroof = seller.find((f) => f.type === 'sunroof')?.value;
  const packagePresent = seller.find((f) => f.type === 'package_present')?.value;
  const vehicleLabel = [
    color,
    vehicle.modelLabel || vehicle.modelKey,
    vehicle.trimLabel || vehicle.trimId,
  ].filter(Boolean).join(' ');

  const lines = [greeting(context.recipient), ''];

  const bits = [];
  if (vehicleLabel) bits.push(vehicleLabel);
  if (packagePresent) bits.push(`mit ${packagePresent}`);
  if (sunroof) bits.push(`und ${sunroof}`);

  if (bits.length) {
    if (availability) {
      lines.push(`wir haben ${bits.join(' ')} – ${availability}.`);
    } else {
      lines.push(`zu dem genannten Fahrzeug (${bits.join(' ')}):`);
    }
  } else if (context.rawSellerInstruction) {
    lines.push('kurz zu Ihrem Anliegen:');
  }

  const pkg = context.verifiedPackageFacts;
  if (pkg?.items?.length) {
    lines.push('');
    lines.push(`Das ${pkg.label || 'Paket'} umfasst unter anderem ${pkg.items.join(', ')}.`);
  } else if (missingKnowledge.includes('exact_technology_package_contents')) {
    lines.push('');
    lines.push('Die genauen Inhalte des Technologie-Pakets sind für diese Variante noch nicht eindeutig verifiziert – Details sende ich Ihnen gerne nach.');
  }

  const eq = context.verifiedEquipmentFacts;
  if (eq?.items?.length) {
    lines.push('');
    lines.push(`Zur Serienausstattung der Linie gehören unter anderem ${eq.items.slice(0, 6).join(', ')}.`);
  }

  const offer = context.offerFacts;
  if (offer?.monthlyRate != null) {
    lines.push('');
    const cond = [
      offer.monthlyRate != null ? `${offer.monthlyRate} € mtl.` : null,
      offer.termMonths != null ? `${offer.termMonths} Monate` : null,
      offer.mileagePerYear != null ? `${offer.mileagePerYear} km/Jahr` : null,
    ].filter(Boolean).join(', ');
    lines.push(`Die Konditionen aus dem aktuellen Angebot: ${cond}.`);
  }

  lines.push('');
  lines.push('Gerne schicke ich Ihnen noch Bilder und die genauen Fahrzeugdaten oder stelle Ihnen das Fahrzeug persönlich vor.');
  lines.push('');
  lines.push('Viele Grüße');

  const mode = missingKnowledge.length ? 'missing_knowledge' : 'write_from_notes';
  return {
    mode,
    body: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    usedFacts: collectUsedFacts(context),
    missingKnowledge,
    ambiguities,
    warnings: options.warnings || [],
    confidence: missingKnowledge.length ? 0.55 : 0.75,
    writer: 'grounded_fallback',
  };
}

function buildAllowedEvidence(context = {}) {
  const ids = [];
  const values = [];
  for (const f of context.sellerFacts || []) {
    ids.push(`seller:${f.type}`);
    values.push(String(f.value));
  }
  if (context.verifiedPackageFacts?.evidenceId) ids.push(context.verifiedPackageFacts.evidenceId);
  if (context.verifiedPackageFacts?.items) values.push(...context.verifiedPackageFacts.items);
  if (context.verifiedEquipmentFacts?.evidenceId) ids.push(context.verifiedEquipmentFacts.evidenceId);
  if (context.verifiedEquipmentFacts?.items) values.push(...context.verifiedEquipmentFacts.items);
  if (context.offerFacts?.offerId) {
    ids.push(`offer:${context.offerFacts.offerId}`);
    if (context.offerFacts.monthlyRate != null) values.push(String(context.offerFacts.monthlyRate));
  }
  if (context.vehicleIdentity?.modelKey) {
    ids.push(`variant:${context.vehicleIdentity.modelKey}:${context.vehicleIdentity.trimId || ''}`);
    values.push(context.vehicleIdentity.modelKey, context.vehicleIdentity.trimId || '');
  }
  return { allowedEvidenceIds: ids, allowedValues: values };
}

/**
 * @param {object} context – Minimal Message Context
 * @param {object} [options]
 * @param {object} [deps]
 */
export async function generateCleverCustomerMessage(context = {}, options = {}, deps = {}) {
  if (options.clarifyQuestion) {
    return writeGroundedMessageFallback(context, options);
  }

  const env = deps.env ?? process.env;
  const surface = 'magic_message';
  // reuse seller config flag OR dedicated magic flag
  const magicEnabled = env.CLEVER_MAGIC_MESSAGE_ENABLED === 'true'
    || env.CLEVER_SELLER_COPILOT_ENABLED === 'true';
  const baseCfg = getCleverIntelligenceConfig(CLEVER_SURFACES.SELLER, env);
  const enabled = magicEnabled && Boolean(baseCfg.apiKey);

  if (deps.mockWriterResult) {
    const validation = validateMagicMessageResult(deps.mockWriterResult);
    if (!validation.ok) {
      return writeGroundedMessageFallback(context, {
        ...options,
        warnings: [...(options.warnings || []), 'mock_schema_invalid'],
      });
    }
    return { ...validation.result, writer: 'mock' };
  }

  if (!enabled || deps.forceFallback) {
    return writeGroundedMessageFallback(context, options);
  }

  const instructions = [
    CLEVER_BASE_INSTRUCTIONS,
    CLEVER_SURFACE_MAGIC_INSTRUCTIONS,
    `Prompt-Version: ${CLEVER_INTELLIGENCE_PROMPT_VERSION}`,
  ].join('\n\n');

  const core = await (deps.runCore ?? runCleverIntelligenceCore)({
    surface,
    instructions,
    input: [
      {
        role: 'user',
        content: JSON.stringify({
          surface: 'magic_message',
          context,
          missingKnowledge: options.missingKnowledge || [],
        }),
      },
    ],
    jsonSchema: MAGIC_MESSAGE_RESULT_JSON_SCHEMA,
    validate: validateMagicMessageResult,
    assertGrounded: (result) => assertGroundedMagicMessageResult(result, buildAllowedEvidence(context)),
    userMessage: context.rawSellerInstruction,
    config: { ...baseCfg, enabled: true, surface },
  }, deps);

  if (!core.ok || !core.result) {
    return writeGroundedMessageFallback(context, {
      ...options,
      warnings: [...(options.warnings || []), core.reason || 'openai_fallback'],
    });
  }

  return {
    ...core.result,
    writer: 'openai',
    metrics: core.metrics ?? null,
  };
}
