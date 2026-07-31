/**
 * Slice 7: Suche / Antwort aus bestätigten Customer Contracts (Contract Memory).
 * Nur strukturierte Contract Facts – keine erfundenen Werte.
 */
import { listCustomerContracts } from '../crm/customerContracts.js';
import { resolveCustomersFromInput } from './globalCustomerResolve.js';
import { extractNamedCustomerFromInput } from './resolveAssistantContext.js';

export const CONTRACT_QUERY_FIELDS = {
  END_DATE: 'contractEndDate',
  START_DATE: 'contractStartDate',
  MONTHLY_RATE: 'monthlyRate',
  ANNUAL_MILEAGE: 'annualMileage',
  PROVIDER: 'bankOrLeasingCompany',
  EXCESS_MILEAGE: 'excessMileageRate',
  UNDER_MILEAGE: 'underMileageRate',
  TERM_MONTHS: 'termMonths',
  VEHICLE: 'vehicle',
  SUMMARY: 'summary',
};

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isCustomerContractQuery(text = '') {
  const t = String(text || '').trim();
  if (t.length < 8) return false;
  // Vollimport / Paste → nicht Search
  if (/\bleasingvertrag\b/i.test(t) && /\bvertragsbeginn\b|\bvertragsende\b|\blaufzeit\b/i.test(t)) {
    return false;
  }
  if (/\b(lies|lese|importier|erfasse).{0,40}\bvertrag\b/i.test(t)) return false;
  // Vertrag ↔ Angebot Vergleich → Slice 9, nicht Search
  if (/\bvergleich\w*\b/i.test(t) && /\bvertrag\b|\baltvertrag\b/i.test(t) && /\bangebot\b/i.test(t)) {
    return false;
  }

  const asksContract = /\bvertrag\b|\bleasing\b|\baltvertrag\b|\bkondition/i.test(t)
    || /\bläuft?\b.{0,40}\baus\b|\blauft\b.{0,40}\baus\b|\bausläuft\b|\bendet\b/i.test(t)
    || /\bwann\b.{0,40}\baus\b/i.test(t)
    || /\bwas\s+zahlt\b|\bwieviel\s+zahlt\b|\bwie\s+viel\s+zahlt\b/i.test(t)
    || /\bmehrkilometer|\bminderkilometer/i.test(t)
    || /\bleasinggesellschaft\b|\bleasinggeber\b/i.test(t)
    || /\bkilometer.{0,40}vertrag\b|\bvertrag.{0,40}kilometer\b|\bkilometer\b.{0,40}\b(hat|im)\b/i.test(t);

  return Boolean(asksContract);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function detectContractQueryField(text = '') {
  const t = String(text || '').toLowerCase();
  if (/\bmehrkilometer/i.test(t)) return CONTRACT_QUERY_FIELDS.EXCESS_MILEAGE;
  if (/\bminderkilometer/i.test(t)) return CONTRACT_QUERY_FIELDS.UNDER_MILEAGE;
  if (/\bleasinggesellschaft\b|\bleasinggeber\b|\bwelche\s+bank\b/.test(t)) {
    return CONTRACT_QUERY_FIELDS.PROVIDER;
  }
  if (/\bkilometer\b|\bkm\b/.test(t) && !/\bmehr|\bminder/.test(t)) {
    return CONTRACT_QUERY_FIELDS.ANNUAL_MILEAGE;
  }
  if (/\bwas\s+zahlt\b|\bzahlt\b.{0,20}\b(momentan|aktuell|jetzt)\b|\bmonatliche?\s+rate\b|\brate\b/.test(t)) {
    return CONTRACT_QUERY_FIELDS.MONTHLY_RATE;
  }
  if (/\bläuft?\b.{0,40}\baus\b|\blauft\b.{0,40}\baus\b|\bvertragsende\b|\bendet\b|\bwann.{0,40}\baus\b/.test(t)) {
    return CONTRACT_QUERY_FIELDS.END_DATE;
  }
  if (/\bvertragsbeginn\b|\bbeginn\b/.test(t) && /\bvertrag\b|\bleasing\b/.test(t)) {
    return CONTRACT_QUERY_FIELDS.START_DATE;
  }
  if (/\blaufzeit\b/.test(t)) return CONTRACT_QUERY_FIELDS.TERM_MONTHS;
  if (/\bfahrzeug\b|\bwelches\s+auto\b/.test(t)) return CONTRACT_QUERY_FIELDS.VEHICLE;
  return CONTRACT_QUERY_FIELDS.SUMMARY;
}

function formatDeDate(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatEuro(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${Number(n).toLocaleString('de-DE')} €`;
}

function formatCt(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return null;
  return `${Math.round(Number(rate) * 100)} ct`;
}

function pickEvidence(contract, field) {
  const list = Array.isArray(contract?.evidence) ? contract.evidence : [];
  const hit = list.find((e) => e.field === field)
    || list.find((e) => (
      (field === 'monthlyRate' && e.field === 'monthlyRate')
      || (field === 'contractEndDate' && e.field === 'contractEndDate')
      || (field === 'annualMileage' && e.field === 'annualMileage')
      || (field === 'bankOrLeasingCompany' && e.field === 'bankOrLeasingCompany')
      || (field === 'excessMileageRate' && e.field === 'excessMileageRate')
    ));
  return hit || null;
}

function readFieldValue(contract, field) {
  switch (field) {
    case CONTRACT_QUERY_FIELDS.END_DATE:
      return contract?.dates?.contractEndDate || null;
    case CONTRACT_QUERY_FIELDS.START_DATE:
      return contract?.dates?.contractStartDate || null;
    case CONTRACT_QUERY_FIELDS.MONTHLY_RATE:
      return contract?.commercialTerms?.monthlyRate ?? null;
    case CONTRACT_QUERY_FIELDS.ANNUAL_MILEAGE:
      return contract?.mileageTerms?.annualMileage ?? null;
    case CONTRACT_QUERY_FIELDS.PROVIDER:
      return contract?.provider?.bankOrLeasingCompany || null;
    case CONTRACT_QUERY_FIELDS.EXCESS_MILEAGE:
      return contract?.mileageTerms?.excessMileageRate ?? null;
    case CONTRACT_QUERY_FIELDS.UNDER_MILEAGE:
      return contract?.mileageTerms?.underMileageRate ?? null;
    case CONTRACT_QUERY_FIELDS.TERM_MONTHS:
      return contract?.commercialTerms?.termMonths ?? null;
    case CONTRACT_QUERY_FIELDS.VEHICLE:
      return contract?.vehicle?.label
        || [contract?.vehicle?.make, contract?.vehicle?.model].filter(Boolean).join(' ')
        || null;
    default:
      return null;
  }
}

function formatFieldAnswer(field, value) {
  if (value == null || value === '') return null;
  switch (field) {
    case CONTRACT_QUERY_FIELDS.END_DATE:
    case CONTRACT_QUERY_FIELDS.START_DATE:
      return formatDeDate(value);
    case CONTRACT_QUERY_FIELDS.MONTHLY_RATE:
      return `${formatEuro(value)} monatlich`;
    case CONTRACT_QUERY_FIELDS.ANNUAL_MILEAGE:
      return `${Number(value).toLocaleString('de-DE')} km/Jahr`;
    case CONTRACT_QUERY_FIELDS.EXCESS_MILEAGE:
    case CONTRACT_QUERY_FIELDS.UNDER_MILEAGE:
      return formatCt(value);
    case CONTRACT_QUERY_FIELDS.TERM_MONTHS:
      return `${value} Monate`;
    default:
      return String(value);
  }
}

function buildSummaryBody(customerName, contract) {
  const lines = [
    customerName ? `VERTRAG ${String(customerName).toUpperCase()}` : 'VERTRAG',
    contract.dates?.contractEndDate
      ? `Vertragsende:\n${formatDeDate(contract.dates.contractEndDate)}`
      : null,
    contract.commercialTerms?.monthlyRate != null
      ? `Aktuelle Rate:\n${formatEuro(contract.commercialTerms.monthlyRate)} monatlich`
      : null,
    contract.mileageTerms?.annualMileage != null
      ? `Kilometer:\n${Number(contract.mileageTerms.annualMileage).toLocaleString('de-DE')} km/Jahr`
      : null,
    contract.vehicle?.label || (contract.vehicle?.make && contract.vehicle?.model)
      ? `Fahrzeug:\n${contract.vehicle.label || `${contract.vehicle.make} ${contract.vehicle.model}`}`
      : null,
    contract.provider?.bankOrLeasingCompany
      ? `Leasinggesellschaft:\n${contract.provider.bankOrLeasingCompany}`
      : null,
  ].filter(Boolean);
  return lines.join('\n\n');
}

function collectContractsFromLeads(leads = []) {
  const out = [];
  for (const lead of leads) {
    if (!lead?.id) continue;
    for (const c of listCustomerContracts(lead)) {
      if (c.status && c.status !== 'confirmed' && c.status !== 'draft') continue;
      out.push({
        lead,
        contract: c,
        customerName: lead.contact?.name || lead.name || null,
      });
    }
  }
  return out;
}

function extractContractQueryCustomerName(sellerInput = '') {
  const t = String(sellerInput || '').trim();
  const named = extractNamedCustomerFromInput(t);
  if (named) return named;
  const patterns = [
    /\b(?:wann\s+)?(?:läuft|lauft|endet)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\s+aus\b/i,
    /\bwas\s+zahlt\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\bkilometer\s+hat\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\bvertrag\s+(?:von|für)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\b(?:herrn?\s+|frau\s+)([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
  ];
  const stop = /^(ein|eine|ihm|ihr|dem|den|das|der|er|sie|vertrag|leasing|aus)$/i;
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && !stop.test(m[1])) return m[1];
  }
  return null;
}

/**
 * @param {{
 *   sellerInput?: string,
 *   lead?: object,
 *   leadsSnapshot?: object[],
 *   customerName?: string,
 * }} params
 */
export function searchCustomerContracts(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  const queryField = detectContractQueryField(sellerInput);
  const named = extractContractQueryCustomerName(sellerInput);

  let workingLead = params.lead?.id ? params.lead : null;
  let customerSearchResults = [];
  let resolveStatus = workingLead ? 'current_customer' : null;

  if (!workingLead && Array.isArray(params.leadsSnapshot) && params.leadsSnapshot.length) {
    const searchInput = named ? `Öffne ${named}` : sellerInput;
    const resolved = resolveCustomersFromInput(searchInput, params.leadsSnapshot, {});
    customerSearchResults = resolved?.results || [];
    if (resolved?.lead?.id) {
      workingLead = resolved.lead;
      resolveStatus = 'global_search';
    } else if ((resolved?.results || []).length > 1) {
      return {
        ok: false,
        status: 'ambiguous_customer',
        queryField,
        message: 'Mehrere Kunden gefunden – bitte einen auswählen.',
        customerSearchResults: resolved.results,
        contracts: [],
        contractMemoryResult: null,
        mutatesCustomer: false,
      };
    }
  }

  const leadsToScan = workingLead?.id
    ? [workingLead]
    : (Array.isArray(params.leadsSnapshot) ? params.leadsSnapshot : []);

  const hits = collectContractsFromLeads(leadsToScan);
  if (!hits.length) {
    // Fallback: wish.leasingEndDate only for end-date questions (projection, marked as such)
    const fallbackEnd = workingLead?.wish?.leasingEndDate
      || workingLead?.leasingEndDate
      || workingLead?.crm?.leasingEndDate
      || null;
    if (queryField === CONTRACT_QUERY_FIELDS.END_DATE && fallbackEnd && workingLead?.id) {
      const display = formatDeDate(fallbackEnd) || String(fallbackEnd);
      return {
        ok: true,
        status: 'projection_only',
        queryField,
        message: null,
        customerSearchResults,
        contracts: [],
        contractMemoryResult: {
          customerId: workingLead.id,
          customerName: workingLead.contact?.name || workingLead.name || named || params.customerName,
          queryField,
          answerLabel: 'Vertragsende (aus Kundenakte)',
          answerValue: display,
          body: `VERTRAGSENDE\n${display}\n\nQuelle: wish.leasingEndDate (noch kein strukturierter Contract Record)`,
          contractId: null,
          contract: null,
          sourceLabel: 'wish.leasingEndDate',
          evidence: [{
            field: 'contractEndDate',
            value: fallbackEnd,
            sourceType: 'wish_projection',
            evidenceText: null,
            confidence: 0.7,
          }],
        },
        mutatesCustomer: false,
      };
    }

    return {
      ok: false,
      status: workingLead?.id ? 'no_contract' : 'missing_customer',
      queryField,
      message: workingLead?.id
        ? 'Kein bestätigter Altvertrag für diesen Kunden hinterlegt.'
        : 'Für welchen Kunden soll ich den Vertrag nachschlagen?',
      customerSearchResults,
      contracts: [],
      contractMemoryResult: null,
      mutatesCustomer: false,
    };
  }

  const primary = hits[0];
  const contract = primary.contract;
  const customerName = primary.customerName
    || params.customerName
    || named
    || null;

  let answerValue = null;
  let answerLabel = null;
  let body = null;
  let evidence = null;

  if (queryField === CONTRACT_QUERY_FIELDS.SUMMARY) {
    body = buildSummaryBody(customerName, contract);
    answerLabel = 'Vertragsübersicht';
    answerValue = contract.dates?.contractEndDate
      ? formatDeDate(contract.dates.contractEndDate)
      : (contract.vehicle?.label || null);
  } else {
    const raw = readFieldValue(contract, queryField);
    answerValue = formatFieldAnswer(queryField, raw);
    const labels = {
      [CONTRACT_QUERY_FIELDS.END_DATE]: 'Vertragsende',
      [CONTRACT_QUERY_FIELDS.START_DATE]: 'Vertragsbeginn',
      [CONTRACT_QUERY_FIELDS.MONTHLY_RATE]: 'Aktuelle Rate',
      [CONTRACT_QUERY_FIELDS.ANNUAL_MILEAGE]: 'Kilometer',
      [CONTRACT_QUERY_FIELDS.PROVIDER]: 'Leasinggesellschaft',
      [CONTRACT_QUERY_FIELDS.EXCESS_MILEAGE]: 'Mehrkilometer',
      [CONTRACT_QUERY_FIELDS.UNDER_MILEAGE]: 'Minderkilometer',
      [CONTRACT_QUERY_FIELDS.TERM_MONTHS]: 'Laufzeit',
      [CONTRACT_QUERY_FIELDS.VEHICLE]: 'Fahrzeug',
    };
    answerLabel = labels[queryField] || 'Vertragsangabe';
    evidence = pickEvidence(contract, queryField);
    if (raw == null) {
      return {
        ok: false,
        status: 'field_missing',
        queryField,
        message: `${answerLabel} ist im erfassten Vertrag nicht hinterlegt.`,
        customerSearchResults,
        contracts: hits.map((h) => h.contract),
        contractMemoryResult: {
          customerId: primary.lead.id,
          customerName,
          queryField,
          answerLabel,
          answerValue: null,
          body: buildSummaryBody(customerName, contract),
          contractId: contract.id,
          contract,
          sourceLabel: 'customer_contract',
          evidence: contract.evidence || [],
        },
        mutatesCustomer: false,
      };
    }
    body = [
      customerName ? `VERTRAG ${String(customerName).toUpperCase()}` : 'VERTRAG',
      `${answerLabel}:\n${answerValue}`,
      contract.vehicle?.label ? `Fahrzeug:\n${contract.vehicle.label}` : null,
      evidence?.evidenceText ? `Quelle:\n„${evidence.evidenceText}“` : 'Quelle:\nbestätigter Contract Record',
    ].filter(Boolean).join('\n\n');
  }

  return {
    ok: true,
    status: 'found',
    queryField,
    message: null,
    customerSearchResults,
    contracts: hits.map((h) => h.contract),
    resolveStatus,
    contractMemoryResult: {
      customerId: primary.lead.id,
      customerName,
      queryField,
      answerLabel,
      answerValue,
      body,
      contractId: contract.id,
      contract,
      sourceLabel: 'customer_contract',
      evidence: evidence ? [evidence] : (contract.evidence || []).slice(0, 6),
    },
    mutatesCustomer: false,
  };
}
