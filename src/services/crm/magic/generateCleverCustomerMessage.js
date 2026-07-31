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
import { detectChipIntent } from './buildMagicAkteContext.js';

export const CLEVER_SURFACE_MAGIC_INSTRUCTIONS = `
OBERFLÄCHE: MAGIC KUNDEN-NACHRICHT (Verkäufer → Kunde)

Du formulierst eine sendefähige Kundennachricht auf Deutsch.
Du erfindest KEINE Fahrzeugdaten.

NUR aus dem JSON-Kontext verwenden:
- sellerFacts (Verkäuferangaben, z. B. Farbe, Schiebedach, Verfügbarkeit)
- verifiedPackageFacts.items (nur diese Paketinhalte nennen)
- verifiedEquipmentFacts.items (nur diese Serienausstattung nennen)
- offerFacts (nur diese Konditionen/Preise) – Konditionen maximal EINMAL
- vehicleIdentity (korrekter Modellname)
- akteContext (CLEVER-Zusammenfassung, customerNotes, Neigung/Favorit, Spuren, selectedWorkingChip, chipIntent)
- relevantCustomerNeeds

QUALITÄT:
- Kein Boilerplate „kurze Rückfrage:“ ohne echte Frage oder konkreten CTA.
- Bei chipIntent „nachfassen“: echte Frage zum richtigen Fahrzeug (Working-Chip vor generischem Kontext; Akte-Neigung z. B. XCeed erwähnen wenn sinnvoll).
- Bei chipIntent „kundenlink“: sinnvolle Mail mit Link-/Portfolio-Absicht, kein leeres Template.
- rawSellerInstruction enthält oft Chip-Meta („Schreib eine kurze Nachfassnachricht“) – NIEMALS im Body wiedergeben.
- Modellname korrekt und konsistent; keine doppelten Konditionszeilen.

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

/** Modellname ohne Konditions-Suffix („Kia · 48M …“). */
export function cleanVehicleDisplayName(value = '') {
  return String(value || '')
    .replace(/^kia\s+/i, '')
    .replace(/\s*·\s*.*$/, '')
    .replace(/\s*[-–]\s*\d+\s*(€|euro|mtl|monate|km).*$/i, '')
    .trim();
}

function resolveFocusVehicleLabel(context = {}) {
  const vehicle = context.vehicleIdentity || {};
  const chip = context.akteContext?.selectedWorkingChip;
  const inclination = context.akteContext?.inclination;
  const fromVehicle = cleanVehicleDisplayName(
    vehicle.modelLabel || vehicle.label || vehicle.modelKey || '',
  );
  const fromChip = cleanVehicleDisplayName(chip?.shortLabel || chip?.label || chip?.modelKey || '');
  const fromInclination = cleanVehicleDisplayName(inclination?.modelLabel || inclination?.modelKey || '');

  // Working-Chip hat Vorrang, wenn er ein konkretes Modell trägt
  if (fromChip && /\b(xceed|tivoli|sportage|picanto|niro|sorento|stonic|ceed|ev\s?[2-9]|sorento)\b/i.test(fromChip)) {
    return fromChip;
  }
  if (fromVehicle) return fromVehicle;
  if (fromChip) return fromChip;
  if (fromInclination) return fromInclination;
  return null;
}

function formatOfferConditionsOnce(offer = null) {
  if (!offer) return null;
  if (offer.summary) {
    const summary = String(offer.summary).trim().replace(/\.$/, '');
    return summary || null;
  }
  const cond = [
    offer.monthlyRate != null ? `${offer.monthlyRate} € mtl.` : null,
    offer.termMonths != null ? `${offer.termMonths} Monate` : null,
    offer.mileagePerYear != null ? `${offer.mileagePerYear} km/Jahr` : null,
  ].filter(Boolean).join(', ');
  return cond || null;
}

/**
 * Deterministischer Writer – nur gelieferte Fakten, kein Modellwissen.
 * Seller-Instruction und Seller-Facts müssen im Body sichtbar werden
 * (sonst wirkt jede Antwort gleich).
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
  const focusLabel = resolveFocusVehicleLabel(context);
  const vehicleLabel = [
    color,
    focusLabel || cleanVehicleDisplayName(vehicle.modelLabel || vehicle.modelKey),
    vehicle.trimLabel || vehicle.trimId,
  ].filter(Boolean).join(' ');

  const instruction = String(context.rawSellerInstruction || '').trim();
  const chipIntent = context.chipIntent
    || context.akteContext?.chipIntent
    || detectChipIntent(instruction);
  const kind = detectInstructionKind(instruction, chipIntent);
  const noteLines = extractCustomerFacingNotes(instruction);
  const inclination = context.akteContext?.inclination;
  const inclinationLabel = cleanVehicleDisplayName(
    inclination?.modelLabel || inclination?.modelKey || '',
  );
  const offerLine = formatOfferConditionsOnce(context.offerFacts);

  const lines = [greeting(context.recipient), ''];

  if (kind === 'thanks') {
    lines.push('vielen Dank für Ihre Nachricht – ich habe Ihre Anfrage erhalten und melde mich in Kürze bei Ihnen.');
  } else if (kind === 'kundenlink') {
    const target = focusLabel || 'Ihre Angebote';
    lines.push(
      `anbei erhalten Sie den Kundenlink zu ${target === 'Ihre Angebote' ? 'Ihren aktuellen Angeboten' : `dem ${target}`}.`,
    );
    lines.push('');
    lines.push(
      'Über den Link können Sie die Fahrzeuge und Konditionen in Ruhe ansehen. Schreiben Sie mir gerne, welche Variante für Sie am interessantesten ist.',
    );
    if (inclinationLabel && focusLabel && !new RegExp(inclinationLabel, 'i').test(focusLabel)) {
      lines.push('');
      lines.push(`Falls Sie weiterhin eher zum ${inclinationLabel} tendieren, können wir diesen Fokus im Link priorisieren.`);
    }
  } else if (kind === 'followup') {
    const target = focusLabel || 'Ihrem Fahrzeugwunsch';
    if (focusLabel) {
      lines.push(`ich wollte kurz zum ${focusLabel} nachfassen.`);
    } else {
      lines.push('ich wollte kurz nachfassen, wie es mit Ihrem Fahrzeugwunsch aussieht.');
    }
    if (
      inclinationLabel
      && focusLabel
      && !new RegExp(inclinationLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(focusLabel)
    ) {
      lines.push('');
      lines.push(`In der Akte sehe ich, dass Sie eher zum ${inclinationLabel} neigen – passt der aktuelle Stand für Sie noch?`);
    } else {
      lines.push('');
      lines.push(
        focusLabel
          ? `Passt das Angebot so für Sie, oder soll ich etwas anpassen (z. B. Laufzeit, Rate oder Ausstattung)?`
          : `Haben Sie noch offene Fragen zu ${target}, oder soll ich etwas anpassen?`,
      );
    }
  } else if (kind === 'delivery' && !availability) {
    lines.push(
      focusLabel
        ? `kurz zur Lieferzeit und Verfügbarkeit beim ${focusLabel}:`
        : 'kurz zur Lieferzeit und Verfügbarkeit:',
    );
  } else if (kind === 'question') {
    const openPoint = noteLines[0]
      || (focusLabel
        ? `Wie sieht es für Sie beim ${focusLabel} aus – sollen wir so weitermachen oder etwas anpassen?`
        : 'Gibt es noch offene Punkte, die ich für Sie klären soll?');
    lines.push(openPoint.endsWith('?') ? openPoint : `${openPoint.replace(/\.$/, '')}?`);
  } else if (vehicleLabel || availability || noteLines.length || context.offerFacts) {
    // konkreter Einstieg statt generischem „Anliegen“
  } else if (instruction && noteLines.length === 0) {
    // Chip-Meta ohne Inhalt – kein „kurz zu Ihrem Anliegen“
  } else if (instruction) {
    lines.push('kurz zu Ihrem Anliegen:');
  }

  // Kundenlink/Followup/Question: Fahrzeug-/Konditionsblock nur wenn noch nicht inhaltlich abgedeckt
  const skipGenericVehicleBlock = kind === 'kundenlink' || kind === 'followup' || kind === 'question' || kind === 'thanks';

  if (!skipGenericVehicleBlock) {
    const bits = [];
    if (vehicleLabel) bits.push(vehicleLabel);
    if (packagePresent) bits.push(`mit ${packagePresent}`);
    if (sunroof) bits.push(`und ${sunroof}`);

    if (bits.length) {
      lines.push('');
      if (availability) {
        lines.push(`Zum Fahrzeug (${bits.join(' ')}): ${availability}.`);
      } else if (kind !== 'delivery') {
        lines.push(`Bezugnehmend auf ${bits.join(' ')}:`);
      } else {
        lines.push(`Zum Fahrzeug (${bits.join(' ')}) prüfe ich aktuell Lieferzeit und Verfügbarkeit.`);
      }
    } else if (availability) {
      lines.push('');
      lines.push(`Zur Verfügbarkeit: ${availability}.`);
    }
  } else if (availability && kind !== 'thanks') {
    lines.push('');
    lines.push(`Zur Verfügbarkeit: ${availability}.`);
  }

  // Freitext-Notizen des Verkäufers – Meta-Chips sind bereits gefiltert
  const extraSeller = seller.filter((f) => (
    f.type !== 'color'
    && f.type !== 'availability'
    && f.type !== 'sunroof'
    && f.type !== 'package_present'
    && f.type !== 'model'
    && f.type !== 'trim'
    && f.value
  ));
  if (kind !== 'question' && kind !== 'followup' && kind !== 'kundenlink') {
    if (noteLines.length) {
      lines.push('');
      for (const note of noteLines.slice(0, 4)) {
        if (/\berstell\b|\bmach(?:e|en)?\s+(?:ihm|ihr)\b|\bangebot\s+erstellen\b/i.test(note)) {
          continue;
        }
        lines.push(note);
      }
    } else if (extraSeller.length) {
      lines.push('');
      lines.push(extraSeller.map((f) => String(f.value)).join(' · '));
    }
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

  // Konditionen nur 1× – und nicht wenn Summary schon im Fahrzeugblock steckt
  if (offerLine && kind !== 'thanks') {
    const bodySoFar = lines.join('\n');
    const rate = context.offerFacts?.monthlyRate;
    const alreadyMentioned = (rate != null && bodySoFar.includes(String(rate)))
      || (offerLine.length > 12 && bodySoFar.includes(offerLine.slice(0, Math.min(24, offerLine.length))));
    if (!alreadyMentioned) {
      lines.push('');
      lines.push(
        context.offerFacts?.summary
          ? `Zum aktuellen Angebot: ${offerLine}.`
          : `Die Konditionen aus dem aktuellen Angebot: ${offerLine}.`,
      );
    }
  }

  lines.push('');
  if (kind === 'thanks') {
    lines.push('Bei Rückfragen bin ich gerne für Sie da.');
  } else if (kind === 'kundenlink') {
    lines.push('Bei Fragen zum Link oder zu den Fahrzeugen melde ich mich gerne.');
  } else if (kind === 'followup' || kind === 'question') {
    lines.push('Ich freue mich auf Ihre kurze Rückmeldung.');
  } else {
    lines.push('Gerne schicke ich Ihnen noch Bilder und die genauen Fahrzeugdaten oder stelle Ihnen das Fahrzeug persönlich vor.');
  }
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

function detectInstructionKind(instruction = '', chipIntent = null) {
  if (chipIntent === 'kundenlink') return 'kundenlink';
  if (chipIntent === 'nachfassen') return 'followup';
  if (chipIntent === 'rueckfrage') return 'question';
  if (chipIntent === 'danke') return 'thanks';
  if (chipIntent === 'lieferzeit') return 'delivery';
  const t = String(instruction).toLowerCase();
  if (/kundenlink|portfolio|angebote per mail|link\s+senden/.test(t)) return 'kundenlink';
  if (/danke|eingangsbestätigung|eingangsbestaetigung/.test(t)) return 'thanks';
  if (/nachfass|follow[\s-]?up|nachhaken/.test(t)) return 'followup';
  if (/lieferzeit|verf[uü]gbar/.test(t)) return 'delivery';
  if (/r[uü]ckfrage|nachfrage|ob (sie|du) noch|offene\s+punkte/.test(t)) return 'question';
  return 'general';
}

function isChipMetaOnlyPart(part = '') {
  const t = String(part || '').trim().toLowerCase();
  if (!t) return true;
  if (/^(eine?\s+)?kurze\s+(dankes|nachfass|rückfrage|eingangs|kunden)/i.test(t)) return true;
  if (/^(dankes|nachfass|rückfrage|angebot|eingangs|kundennachricht)\b/i.test(t) && t.length < 70) return true;
  if (/schreib.{0,50}(kundennachricht|nachricht(\s+dazu)?)/i.test(t) && t.length < 90) return true;
  if (/kurz zur lieferzeit/i.test(t)) return true;
  if (/^bereite\b.+\bvor$/i.test(t)) return true;
  if (/^eine?\s+höfliche\s+rückfrage/i.test(t)) return true;
  if (/schick.{0,40}(angebote|kundenlink|portfolio|per mail)/i.test(t) && t.length < 90) return true;
  if (/^angebote per mail/i.test(t)) return true;
  return false;
}

/** Meta-Aufträge („Schreib ihm …“) entfernen, Kundeninhalt behalten. */
export function extractCustomerFacingNotes(instruction = '') {
  const raw = String(instruction || '').trim();
  if (!raw) return [];
  const cleaned = raw
    .replace(/^(schreib(?:e|en)?|sag(?:e|en)?|formulier(?:e|en)?)\s+(ihm|ihr|dem kunden|herrn?\s+\w+|frau\s+\w+)\s*,?\s*/i, '')
    .replace(/^(erstell(?:e|en)?)\s+(ihm|ihr|dem kunden|herrn?\s+\w+|frau\s+\w+)\s+(ein\s+)?angebot\b[^\n.;]*/i, '')
    .replace(/\berstell(?:e|en)?\s+(?:ihm|ihr|dem kunden|herrn?\s+\w+|frau\s+\w+)\s+(?:ein\s+)?angebot\b[^\n.;]*/gi, '')
    .replace(/^bereite\s+.+?\s+vor\s+und\s+/i, '')
    .replace(/\bschreib(?:e|en)?\s+(eine?\s+)?kurze\s+kundennachricht(\s+dazu)?[.!]?\s*/gi, '')
    .replace(/\bschreib(?:e|en)?\s+(eine?\s+)?kurze\s+(dankes[-\/]?|nachfass|rückfrage|eingangs)[^\n.;]*/gi, '')
    .replace(/\bschreib(?:e|en)?\s+(eine?\s+)?höfliche\s+rückfrage[^\n.;]*/gi, '')
    .replace(/\bschick(?:e|en)?\s+(ihm|ihr)?\s*(die\s+)?angebote\s+per\s+mail\s*\/?\s*kundenlink[.!]?\s*/gi, '')
    .replace(/^(eine?\s+kurze\s+)?(dankes[-\/]?|eingangs)?(nachricht|bestätigung|mail)\s*(dazu|an\s+ihn)?[.!]?\s*/i, '')
    .replace(/\bkurz zur lieferzeit und verf[uü]gbarkeit[.!]?\s*/gi, '')
    .trim();
  if (!cleaned || cleaned.length < 4) return [];
  // Chip-Meta ohne Inhalt
  if (isChipMetaOnlyPart(cleaned)) return [];
  return cleaned
    .split(/[\n;.]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .filter((part) => !isChipMetaOnlyPart(part))
    .map((part) => {
      const p = part.charAt(0).toUpperCase() + part.slice(1);
      return /[.!?]$/.test(p) ? p : `${p}.`;
    });
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
    return writeGroundedMessageFallback(context, {
      ...options,
      warnings: [
        ...(options.warnings || []),
        !magicEnabled ? 'magic_flag_disabled' : (!baseCfg.apiKey ? 'openai_key_missing' : 'forced_fallback'),
      ],
    });
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
