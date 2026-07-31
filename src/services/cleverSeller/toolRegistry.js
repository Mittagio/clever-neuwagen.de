/**
 * Clever Seller Tool Registry – vorhandene Services als Werkzeuge.
 * Keine Business-Logik in React; planSellerActions orchestriert über runTool().
 */
import { runComposerAkteSearch } from '../crm/composerAkteSearch.js';
import { prepareSellerWorkspacePackage } from '../crm/sharedWorkspaceService.js';
import { runSellerOfferAssist } from '../dealer/sellerOfferAssistFlow.js';
import { runSellerAppointmentAssist } from '../dealer/sellerAppointmentAssistFlow.js';
import { runSellerInlineAssist } from '../dealer/sellerInlineComposerAssist.js';
import { shouldEnrichSellerInputFromOfferPdf } from './mapMagicOfferIntentToSellerFacts.js';
import {
  lookupPackageContents,
  lookupRelevantEquipment,
  lookupVehicleVariant,
} from '../crm/magic/magicKnowledgeTools.js';
import { writeGroundedMessageFallback } from '../crm/magic/generateCleverCustomerMessage.js';
import { buildMinimalMessageContext } from '../crm/magic/buildMinimalMessageContext.js';
import { interpretMessageInstruction } from '../crm/magic/interpretMessageInstruction.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
} from '../crm/vehicleTrack.js';
import { buildGoldenMoment } from '../journey/goldenMoment.js';
import { getTodayOverview } from './getTodayOverview.js';
import { lookupVehicleTechnicalFact } from './lookupVehicleTechnicalFact.js';
import { resolveCustomersFromInput, buildCustomerCardSummary } from './globalCustomerResolve.js';
import { searchGlobalCustomerHistory } from './globalHistorySearch.js';
import { summarizeCustomerContext } from './summarizeCustomerContext.js';
import { prepareCustomerContractImport } from './prepareCustomerContractImport.js';
import { searchCustomerContracts } from './searchCustomerContracts.js';

/**
 * @typedef {object} CleverSellerToolDef
 * @property {string} id
 * @property {string} label
 * @property {string[]} requiredInputs
 * @property {string[]} [optionalInputs]
 * @property {boolean} needsSellerConfirmation
 * @property {string[]} [sourceRequirements]
 * @property {(ctx: object) => object|null|Promise<object|null>} execute
 */

/** @type {Record<string, CleverSellerToolDef>} */
export const CLEVER_SELLER_TOOLS = {
  search_customer_history: {
    id: 'search_customer_history',
    label: 'Verlauf durchsuchen',
    requiredInputs: [],
    optionalInputs: ['lead', 'sellerInput', 'customerName', 'leadsSnapshot'],
    needsSellerConfirmation: false,
    sourceRequirements: ['customer_message', 'system'],
    execute: ({ lead, sellerInput, leadsSnapshot = [] }) => {
      if (Array.isArray(leadsSnapshot) && leadsSnapshot.length) {
        return searchGlobalCustomerHistory({
          lead: lead?.id ? lead : null,
          sellerInput,
          leadsSnapshot,
          mode: 'auto',
        });
      }
      return runComposerAkteSearch(lead || {}, sellerInput, {});
    },
  },
  prepare_offer: {
    id: 'prepare_offer',
    label: 'Angebot vorbereiten',
    requiredInputs: ['lead', 'sellerInput'],
    optionalInputs: ['currentOfferContext', 'facts', 'attachments'],
    needsSellerConfirmation: true,
    sourceRequirements: ['verified_vehicle_data', 'seller_input', 'offer_pdf'],
    execute: ({ lead, sellerInput, attachments }) => runSellerOfferAssist(lead, sellerInput, {
      attachments,
      fromPdf: shouldEnrichSellerInputFromOfferPdf(attachments, sellerInput),
    }),
  },
  modify_offer: {
    id: 'modify_offer',
    label: 'Angebot anpassen',
    requiredInputs: ['lead', 'sellerInput', 'currentOfferContext'],
    optionalInputs: ['facts', 'attachments'],
    needsSellerConfirmation: true,
    sourceRequirements: ['offer_pdf', 'seller_input'],
    execute: ({ lead, sellerInput, attachments }) => runSellerOfferAssist(lead, sellerInput, {
      attachments,
      fromPdf: shouldEnrichSellerInputFromOfferPdf(attachments, sellerInput),
    }),
  },
  propose_appointment: {
    id: 'propose_appointment',
    label: 'Termin vorbereiten',
    requiredInputs: ['lead', 'sellerInput'],
    optionalInputs: ['resolvedCustomer'],
    needsSellerConfirmation: true,
    sourceRequirements: ['seller_input', 'system'],
    execute: ({ lead, sellerInput }) => runSellerAppointmentAssist(lead, sellerInput, {}),
  },
  import_customer_contract: {
    id: 'import_customer_contract',
    label: 'Altvertrag einlesen',
    requiredInputs: ['sellerInput'],
    optionalInputs: ['lead', 'customerName'],
    needsSellerConfirmation: true,
    sourceRequirements: ['seller_input', 'document'],
    execute: ({ lead, sellerInput, customerName }) => prepareCustomerContractImport({
      lead,
      sellerInput,
      customerName,
    }),
  },
  search_customer_contracts: {
    id: 'search_customer_contracts',
    label: 'Vertrag nachschlagen',
    requiredInputs: ['sellerInput'],
    optionalInputs: ['lead', 'leadsSnapshot', 'customerName'],
    needsSellerConfirmation: false,
    sourceRequirements: ['system', 'seller_input'],
    execute: ({ lead, sellerInput, leadsSnapshot, customerName }) => searchCustomerContracts({
      lead,
      sellerInput,
      leadsSnapshot,
      customerName,
    }),
  },
  draft_customer_message: {
    id: 'draft_customer_message',
    label: 'Nachricht vorbereiten',
    requiredInputs: ['lead', 'sellerInput'],
    optionalInputs: ['currentOfferContext', 'customerName', 'workingContext'],
    needsSellerConfirmation: true,
    sourceRequirements: ['seller_input', 'verified_vehicle_data'],
    execute: ({ lead, sellerInput, currentOfferContext }) => (
      runSellerInlineAssist(lead, sellerInput, { currentOfferContext })
    ),
  },
  request_documents: {
    id: 'request_documents',
    label: 'Unterlagen anfordern',
    requiredInputs: ['lead', 'sellerInput'],
    optionalInputs: [],
    needsSellerConfirmation: true,
    sourceRequirements: ['system'],
    execute: ({ lead, sellerInput }) => prepareSellerWorkspacePackage(lead, sellerInput),
  },
  lookup_vehicle_variant: {
    id: 'lookup_vehicle_variant',
    label: 'Fahrzeugvariante',
    requiredInputs: ['modelKey'],
    optionalInputs: ['trim'],
    needsSellerConfirmation: false,
    sourceRequirements: ['verified_vehicle_data'],
    execute: ({ modelKey, trim }) => lookupVehicleVariant({ modelKey, trim }),
  },
  lookup_package_contents: {
    id: 'lookup_package_contents',
    label: 'Paketinhalt',
    requiredInputs: ['modelKey', 'packageName'],
    optionalInputs: ['trim'],
    needsSellerConfirmation: false,
    sourceRequirements: ['verified_vehicle_data', 'official_document'],
    execute: ({ modelKey, trim, packageName }) => (
      lookupPackageContents({ modelKey, trim, packageName })
    ),
  },
  lookup_vehicle_equipment: {
    id: 'lookup_vehicle_equipment',
    label: 'Ausstattung',
    requiredInputs: ['modelKey'],
    optionalInputs: ['trim'],
    needsSellerConfirmation: false,
    sourceRequirements: ['verified_vehicle_data'],
    execute: ({ modelKey, trim }) => lookupRelevantEquipment({ modelKey, trim }),
  },
  lookup_vehicle_technical_fact: {
    id: 'lookup_vehicle_technical_fact',
    label: 'Technischer Fahrzeugfakt',
    requiredInputs: [],
    optionalInputs: ['modelKey', 'factKey', 'sellerInput'],
    needsSellerConfirmation: false,
    sourceRequirements: ['verified_vehicle_data'],
    execute: ({ modelKey, factKey, sellerInput }) => lookupVehicleTechnicalFact({
      modelKey,
      factKey,
      sellerInput,
    }),
  },
  get_today_overview: {
    id: 'get_today_overview',
    label: 'Was liegt heute an?',
    requiredInputs: [],
    optionalInputs: ['leadsSnapshot', 'now'],
    needsSellerConfirmation: false,
    sourceRequirements: ['system'],
    execute: ({ leadsSnapshot = [], now }) => getTodayOverview(leadsSnapshot, { now }),
  },
  find_customer: {
    id: 'find_customer',
    label: 'Kunde finden',
    requiredInputs: [],
    optionalInputs: ['sellerInput', 'leadsSnapshot'],
    needsSellerConfirmation: false,
    sourceRequirements: ['system'],
    execute: ({ sellerInput, leadsSnapshot = [] }) => {
      const resolution = resolveCustomersFromInput(sellerInput, leadsSnapshot, { limit: 6 });
      return {
        ...resolution,
        cards: (resolution.results || []).map((r) => ({
          ...r,
          card: r.lead ? buildCustomerCardSummary(r.lead) : null,
        })),
      };
    },
  },
  open_customer: {
    id: 'open_customer',
    label: 'Kunde öffnen',
    requiredInputs: [],
    optionalInputs: ['sellerInput', 'leadsSnapshot'],
    needsSellerConfirmation: false,
    sourceRequirements: ['system'],
    execute: ({ sellerInput, leadsSnapshot = [] }) => {
      const resolution = resolveCustomersFromInput(sellerInput, leadsSnapshot, { limit: 6 });
      return {
        ...resolution,
        action: 'open_customer',
        cards: (resolution.results || []).map((r) => ({
          ...r,
          card: r.lead ? buildCustomerCardSummary(r.lead) : null,
        })),
      };
    },
  },
  summarize_customer_context: {
    id: 'summarize_customer_context',
    label: 'Kundenkontext',
    requiredInputs: [],
    optionalInputs: ['lead', 'sellerInput', 'leadsSnapshot'],
    needsSellerConfirmation: false,
    sourceRequirements: ['customer_message', 'system'],
    execute: ({ lead, sellerInput, leadsSnapshot = [] }) => summarizeCustomerContext({
      lead,
      sellerInput,
      leadsSnapshot,
    }),
  },
  search_customer_messages: {
    id: 'search_customer_messages',
    label: 'Nachrichten suchen',
    requiredInputs: [],
    optionalInputs: ['lead', 'sellerInput', 'leadsSnapshot'],
    needsSellerConfirmation: false,
    sourceRequirements: ['customer_message', 'system'],
    execute: ({ lead, sellerInput, leadsSnapshot = [] }) => searchGlobalCustomerHistory({
      lead,
      sellerInput,
      leadsSnapshot,
      mode: 'messages',
    }),
  },
  search_customer_offers: {
    id: 'search_customer_offers',
    label: 'Angebote suchen',
    requiredInputs: [],
    optionalInputs: ['lead', 'sellerInput', 'leadsSnapshot'],
    needsSellerConfirmation: false,
    sourceRequirements: ['system'],
    execute: ({ lead, sellerInput, leadsSnapshot = [] }) => searchGlobalCustomerHistory({
      lead,
      sellerInput,
      leadsSnapshot,
      mode: 'offers',
    }),
  },
  search_customer_activities: {
    id: 'search_customer_activities',
    label: 'Aktivitäten suchen',
    requiredInputs: [],
    optionalInputs: ['lead', 'sellerInput', 'leadsSnapshot'],
    needsSellerConfirmation: false,
    sourceRequirements: ['system'],
    execute: ({ lead, sellerInput, leadsSnapshot = [] }) => searchGlobalCustomerHistory({
      lead,
      sellerInput,
      leadsSnapshot,
      mode: 'activities',
    }),
  },
  build_customer_understanding: {
    id: 'build_customer_understanding',
    label: 'Kundenverständnis',
    requiredInputs: ['lead'],
    optionalInputs: [],
    needsSellerConfirmation: false,
    sourceRequirements: ['customer_message', 'seller_input', 'system'],
    execute: ({ lead }) => {
      try {
        return buildCustomerUnderstanding(lead);
      } catch {
        return null;
      }
    },
  },
  list_vehicle_tracks: {
    id: 'list_vehicle_tracks',
    label: 'Fahrzeugspuren',
    requiredInputs: ['lead'],
    optionalInputs: [],
    needsSellerConfirmation: false,
    sourceRequirements: ['system'],
    execute: ({ lead }) => sortTracksForOverview(listCustomerVehicleTracks(lead) || []),
  },
  build_golden_moment: {
    id: 'build_golden_moment',
    label: 'Nächster Verkaufsschritt',
    requiredInputs: ['lead'],
    optionalInputs: [],
    needsSellerConfirmation: false,
    sourceRequirements: ['system'],
    execute: ({ lead }) => {
      try {
        return buildGoldenMoment(lead);
      } catch {
        return null;
      }
    },
  },
  write_grounded_message: {
    id: 'write_grounded_message',
    label: 'Grounded Nachricht',
    requiredInputs: ['minimalContext'],
    optionalInputs: ['options'],
    needsSellerConfirmation: true,
    sourceRequirements: ['seller_input', 'verified_vehicle_data'],
    execute: ({ minimalContext, options = {} }) => (
      writeGroundedMessageFallback(minimalContext, options)
    ),
  },
  interpret_message_instruction: {
    id: 'interpret_message_instruction',
    label: 'Seller-Instruction lesen',
    requiredInputs: ['sellerInput'],
    optionalInputs: [],
    needsSellerConfirmation: false,
    sourceRequirements: ['seller_input'],
    execute: ({ sellerInput }) => interpretMessageInstruction(sellerInput),
  },
  build_minimal_message_context: {
    id: 'build_minimal_message_context',
    label: 'Minimaler Message-Kontext',
    requiredInputs: [],
    optionalInputs: ['recipient', 'rawSellerInstruction', 'vehicleIdentity', 'sellerFacts', 'tone'],
    needsSellerConfirmation: false,
    sourceRequirements: [],
    execute: (ctx) => buildMinimalMessageContext(ctx),
  },
};

/**
 * @param {string} toolId
 * @returns {CleverSellerToolDef|null}
 */
export function getSellerTool(toolId) {
  return CLEVER_SELLER_TOOLS[toolId] || null;
}

/**
 * @returns {CleverSellerToolDef[]}
 */
export function listSellerTools() {
  return Object.values(CLEVER_SELLER_TOOLS);
}

/**
 * Tool ausführen – fehlende requiredInputs → null + warning.
 * @param {string} toolId
 * @param {object} ctx
 * @returns {{ ok: boolean, toolId: string, result: object|null, error?: string, needsSellerConfirmation: boolean }}
 */
export function runTool(toolId, ctx = {}) {
  const tool = getSellerTool(toolId);
  if (!tool) {
    return {
      ok: false,
      toolId,
      result: null,
      error: `unknown_tool:${toolId}`,
      needsSellerConfirmation: true,
    };
  }
  for (const key of tool.requiredInputs) {
    if (ctx[key] == null || ctx[key] === '') {
      return {
        ok: false,
        toolId,
        result: null,
        error: `missing_input:${key}`,
        needsSellerConfirmation: tool.needsSellerConfirmation,
      };
    }
  }
  try {
    const result = tool.execute(ctx);
    return {
      ok: result != null && result !== false,
      toolId,
      result: result ?? null,
      needsSellerConfirmation: tool.needsSellerConfirmation,
    };
  } catch (err) {
    return {
      ok: false,
      toolId,
      result: null,
      error: err?.message || String(err),
      needsSellerConfirmation: tool.needsSellerConfirmation,
    };
  }
}
