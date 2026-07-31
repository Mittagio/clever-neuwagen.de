/**
 * Sync: Grounded Kundennachricht für den Seller-Turn (Slice 4).
 * OpenAI optional später; hier Fallback + Fact-Preservation.
 */
import {
  buildMinimalMessageContext,
  selectRelevantCustomerNeeds,
} from '../crm/magic/buildMinimalMessageContext.js';
import { writeGroundedMessageFallback } from '../crm/magic/generateCleverCustomerMessage.js';
import { validateMessageFactPreservation } from '../crm/magic/validateMessageFactPreservation.js';
import { validateCustomerMessageNotSellerCommand } from './validateSellerCommandMessage.js';
import { resolveGroundedVehicleKnowledge } from './resolveGroundedVehicleKnowledge.js';
import { beginCustomerMessageEdit } from '../crm/composerMode.js';

/**
 * @param {{
 *   sellerInput: string,
 *   lead?: object,
 *   customerName?: string,
 *   workingContext?: object,
 *   offerContext?: object,
 *   allowWithoutPackageDetails?: boolean,
 * }} params
 */
export function prepareGroundedCustomerMessageSync(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  const knowledge = resolveGroundedVehicleKnowledge({
    sellerInput,
    lead: params.lead,
    workingContext: params.workingContext,
    offerContext: params.offerContext,
    allowWithoutPackageDetails: params.allowWithoutPackageDetails,
  });

  if (knowledge.vehicleAmbiguity) {
    return {
      ok: true,
      status: 'needs_vehicle_clarification',
      messageDraft: null,
      knowledge,
      sendable: false,
      uiHint: {
        message: knowledge.vehicleAmbiguity.question
          || 'Für welches Fahrzeug soll ich das erklären?',
        actions: ['clarify_vehicle'],
      },
      handoff: null,
    };
  }

  const missingPackage = knowledge.missingKnowledge.includes('exact_technology_package_contents')
    && !params.allowWithoutPackageDetails;

  const relevantNeeds = selectRelevantCustomerNeeds({
    lead: params.lead,
    docsOnly: knowledge.interpretation?.docsOnly,
    mentionedAhk: knowledge.interpretation?.mentionedAhk,
  });

  const recipient = params.customerName
    || params.lead?.contact?.name
    || params.lead?.name
    || 'Kunde';

  const minimalContext = buildMinimalMessageContext({
    recipient,
    rawSellerInstruction: sellerInput,
    relevantCustomerNeeds: relevantNeeds,
    vehicleIdentity: knowledge.vehicleIdentity,
    sellerFacts: knowledge.sellerFacts,
    verifiedPackageFacts: knowledge.verifiedPackageFacts,
    verifiedEquipmentFacts: knowledge.verifiedEquipmentFacts,
    offerFacts: null,
    tone: 'freundlich',
  });

  let body = writeGroundedMessageFallback(minimalContext, {
    missingKnowledge: knowledge.missingKnowledge,
    warnings: knowledge.warnings,
  })?.body || null;

  // Konflikt: Serien-Schiebedach nicht ungeprüft ausgeben
  if (body && knowledge.conflicts.some((c) => c.factType === 'sunroof_as_standard')) {
    body = body
      .replace(/[^.]*\bserienm[aä](?:ss|ß)ig[^.]*Schiebedach[^.]*\.\s*/gi, '')
      .replace(/[^.]*Schiebedach[^.]*\bserienm[aä](?:ss|ß)ig[^.]*\.\s*/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!/schiebedach/i.test(body) && knowledge.sellerFacts.some((f) => f.type === 'sunroof')) {
      body = body.replace(
        /(Viele Grüße)\s*$/i,
        'Hinweis: Ein Schiebedach wäre bei diesem konkreten Fahrzeug als Sonderausstattung zu prüfen – nicht als Serienmerkmal.\n\n$1',
      );
    }
  }

  const preservation = validateMessageFactPreservation(body || '', {
    sellerFacts: knowledge.sellerFacts,
    verifiedPackageFacts: knowledge.verifiedPackageFacts,
    verifiedEquipmentFacts: knowledge.verifiedEquipmentFacts,
    missingPackageContents: missingPackage,
  });

  if (!preservation.ok) {
    body = writeGroundedMessageFallback(minimalContext, {
      missingKnowledge: knowledge.missingKnowledge,
      warnings: [...knowledge.warnings, ...preservation.errors, ...preservation.warnings],
    })?.body || null;
  }

  const commandCheck = validateCustomerMessageNotSellerCommand(body || '');
  if (!commandCheck.ok) {
    body = writeGroundedMessageFallback(minimalContext, {
      missingKnowledge: knowledge.missingKnowledge,
      warnings: [...knowledge.warnings, 'seller_command_stripped'],
    })?.body || null;
    if (!validateCustomerMessageNotSellerCommand(body || '').ok) {
      return {
        ok: false,
        status: 'invalid_message',
        messageDraft: null,
        knowledge,
        sendable: false,
        warnings: ['seller_command_in_message'],
        uiHint: {
          message: 'Die Nachricht enthält noch Arbeitsanweisungen und ist nicht sendefähig.',
          actions: ['edit_message'],
        },
        handoff: null,
      };
    }
  }

  const vehicleLabel = [
    knowledge.vehicleIdentity?.modelLabel || knowledge.vehicleIdentity?.modelKey,
    knowledge.vehicleIdentity?.trimLabel || knowledge.vehicleIdentity?.trimId,
    knowledge.vehicleIdentity?.color,
  ].filter(Boolean).join(' · ');

  const usedFacts = [
    ...knowledge.facts.filter((f) => f.source !== 'seller_input' || f.factType?.startsWith('seller_')),
  ];

  const handoff = beginCustomerMessageEdit({
    result: { body, draft: { body } },
    recipient,
    contextAttachments: [
      vehicleLabel
        ? {
          id: 'vehicle',
          kind: 'vehicle',
          label: vehicleLabel,
          shortLabel: vehicleLabel,
        }
        : null,
      knowledge.verifiedPackageFacts
        ? {
          id: 'package',
          kind: 'package_facts',
          label: `${knowledge.verifiedPackageFacts.label || 'Technologie-Paket'}-Fakten`,
          shortLabel: 'Technologie-Paket-Fakten',
          package: knowledge.verifiedPackageFacts,
        }
        : null,
    ].filter(Boolean),
  });

  return {
    ok: true,
    status: missingPackage ? 'missing_package_knowledge' : 'prepared',
    messageDraft: body,
    knowledge,
    usedFacts,
    sendable: Boolean(body) && !missingPackage && preservation.ok !== false,
    warnings: [
      ...knowledge.warnings,
      ...(preservation.warnings || []),
    ],
    uiHint: missingPackage
      ? {
        message: 'Die Inhalte des Technologie-Pakets sind für diese Variante noch nicht eindeutig verifiziert.',
        actions: ['write_without_package_details', 'review_data'],
      }
      : null,
    handoff: {
      ...handoff,
      kind: 'knowledge_message',
      composerMode: handoff.composerMode,
      label: vehicleLabel || 'Nachricht',
      shortLabel: vehicleLabel
        ? `${vehicleLabel.replace(/^Kia\s+/i, '')}`
        : 'Nachricht vorbereitet',
      messageDraft: body,
      vehicleIdentity: knowledge.vehicleIdentity,
      sellerFacts: knowledge.sellerFacts,
      verifiedPackageFacts: knowledge.verifiedPackageFacts,
      verifiedEquipmentFacts: knowledge.verifiedEquipmentFacts,
      oneShot: true,
    },
    mutatesCustomer: false,
  };
}
