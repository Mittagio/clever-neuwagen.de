/**
 * Clever Agent Tool Registry – echte, angeschlossene Tools.
 */
import { CLEVER_AGENT_TOOL_KIND } from './cleverAgentTypes.js';
import {
  getCustomerContextToolDef,
  executeGetCustomerContext,
} from './tools/getCustomerContext.js';
import {
  listOffersToolDef,
  getOfferToolDef,
  executeListOffers,
  executeGetOffer,
} from './tools/listOffers.js';
import {
  prepareOfferToolDef,
  createOfferToolDef,
  executePrepareOffer,
  executeCreateOffer,
} from './tools/createOffer.js';
import {
  createMessageToolDef,
  executeCreateMessage,
} from './tools/createMessage.js';
import {
  createCustomerLinkToolDef,
  executeCreateCustomerLink,
} from './tools/createCustomerLink.js';
import {
  rememberCustomerInformationToolDef,
  executeRememberCustomerInformation,
} from './tools/rememberCustomerInformation.js';
import { SELLER_COVERAGE_AGENT_TOOLS } from './tools/sellerCoverageTools.js';
import { summarizeCustomerContext } from '../cleverSeller/summarizeCustomerContext.js';
import { searchGlobalCustomerHistory } from '../cleverSeller/globalHistorySearch.js';
import { runComposerAkteSearch } from '../crm/composerAkteSearch.js';

function executeSummarizeCustomer(runtime = {}) {
  const result = summarizeCustomerContext({
    lead: runtime.lead,
    sellerInput: runtime.sellerMessage || 'Zusammenfassen',
  });
  return {
    ok: result.ok !== false,
    ...result,
    message: result.customerSummary?.text
      || result.message
      || 'Zusammenfassung erstellt.',
  };
}

function executeSearchCustomerHistory(runtime = {}, args = {}) {
  const query = String(args.query || runtime.sellerMessage || '').trim();
  if (Array.isArray(runtime.leadsSnapshot) && runtime.leadsSnapshot.length) {
    return {
      ok: true,
      ...searchGlobalCustomerHistory({
        lead: runtime.lead,
        sellerInput: query,
        leadsSnapshot: runtime.leadsSnapshot,
        mode: 'auto',
      }),
    };
  }
  return {
    ok: true,
    ...runComposerAkteSearch(runtime.lead || {}, query, {}),
  };
}

function kindFromCoverage(kind) {
  if (kind === 'write') return CLEVER_AGENT_TOOL_KIND.WRITE;
  if (kind === 'external') return CLEVER_AGENT_TOOL_KIND.EXTERNAL;
  return CLEVER_AGENT_TOOL_KIND.READ;
}

const coverageEntries = Object.fromEntries(
  Object.entries(SELLER_COVERAGE_AGENT_TOOLS).map(([name, tool]) => ([
    name,
    {
      def: tool.def,
      kind: kindFromCoverage(tool.kind),
      execute: tool.execute,
    },
  ])),
);

export const CLEVER_AGENT_TOOLS = {
  get_customer_context: {
    def: getCustomerContextToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.READ,
    execute: executeGetCustomerContext,
  },
  summarize_customer: {
    def: {
      name: 'summarize_customer',
      kind: 'read',
      description: 'Kurze verkaufsrelevante Zusammenfassung des aktuellen Kunden (Telefon-Briefing).',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
    },
    kind: CLEVER_AGENT_TOOL_KIND.READ,
    execute: executeSummarizeCustomer,
  },
  remember_customer_information: {
    def: rememberCustomerInformationToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.WRITE,
    execute: executeRememberCustomerInformation,
  },
  search_customer_history: {
    def: {
      name: 'search_customer_history',
      kind: 'read',
      description: 'Durchsucht Kundenverlauf (Nachrichten, Angebote, Notizen).',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
    kind: CLEVER_AGENT_TOOL_KIND.READ,
    execute: executeSearchCustomerHistory,
  },
  list_offers: {
    def: listOffersToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.READ,
    execute: executeListOffers,
  },
  get_offer: {
    def: getOfferToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.READ,
    execute: executeGetOffer,
  },
  prepare_offer: {
    def: prepareOfferToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.WRITE,
    execute: executePrepareOffer,
  },
  create_offer: {
    def: createOfferToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.WRITE,
    execute: executeCreateOffer,
  },
  create_message: {
    def: createMessageToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.WRITE,
    execute: executeCreateMessage,
  },
  create_customer_link: {
    def: createCustomerLinkToolDef,
    kind: CLEVER_AGENT_TOOL_KIND.WRITE,
    execute: executeCreateCustomerLink,
  },
  // Sprint 2 – Legacy Seller-Capabilitys als Agent-Tools
  ...coverageEntries,
};

export function listCleverAgentToolNames() {
  return Object.keys(CLEVER_AGENT_TOOLS);
}

export function getCleverAgentTool(name) {
  return CLEVER_AGENT_TOOLS[name] || null;
}

export function buildCleverAgentOpenAiTools() {
  return Object.values(CLEVER_AGENT_TOOLS).map(({ def }) => ({
    type: 'function',
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    strict: false,
  }));
}
