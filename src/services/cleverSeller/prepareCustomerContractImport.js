/**
 * Bereitet Contract-Import-Draft + Review-Payload vor (ohne Persistenz).
 */
import {
  extractCustomerContractFromText,
  isCustomerContractIntakeText,
} from './extractCustomerContractFromText.js';

function formatDeDate(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatEuro(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${Number(n).toLocaleString('de-DE')} €`;
}

function formatCt(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return null;
  const ct = Math.round(Number(rate) * 100);
  return `${ct} ct`;
}

/**
 * @param {{
 *   sellerInput?: string,
 *   lead?: object,
 *   customerName?: string,
 * }} params
 */
export function prepareCustomerContractImport(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  if (!isCustomerContractIntakeText(sellerInput)) {
    return {
      ok: false,
      status: 'not_contract_intake',
      contractDraft: null,
      extractedContractFacts: [],
      evidence: [],
      missingInformation: [],
      warnings: [],
      mutatesCustomer: false,
    };
  }

  const extracted = extractCustomerContractFromText(sellerInput);
  const draft = extracted.contractDraft;
  const customerName = params.customerName
    || params.lead?.contact?.name
    || params.lead?.name
    || draft?.customerNameHint
    || null;

  if (draft) {
    draft.customerId = params.lead?.id || null;
    draft.customerName = customerName;
  }

  const extractedContractFacts = (extracted.evidence || []).map((e) => ({
    field: e.field,
    value: e.value,
    label: `${e.field}: ${e.value}`,
    evidenceText: e.evidenceText,
    confidence: e.confidence,
    sourceType: e.sourceType,
    factClass: 'contract_fact',
    mutatesCustomerTruth: false,
  }));

  const warnings = [];
  if (!params.lead?.id && !draft?.customerNameHint) {
    warnings.push('customer_not_resolved');
  }

  return {
    ok: extracted.ok,
    status: extracted.ok ? 'prepared' : 'incomplete',
    documentClassification: extracted.documentClassification,
    contractDraft: draft,
    extractedContractFacts,
    evidence: extracted.evidence || [],
    missingInformation: extracted.missingInformation || [],
    warnings,
    mutatesCustomer: false,
    reviewBody: buildContractImportReviewBody({
      customerName,
      draft,
      missingInformation: extracted.missingInformation || [],
    }),
  };
}

export function buildContractImportReviewBody({
  customerName = null,
  draft = null,
  missingInformation = [],
} = {}) {
  if (!draft) return '';
  const lines = [];
  if (customerName) lines.push(`KUNDE\n${customerName}`);
  if (draft.contractType) {
    lines.push(`VERTRAG\n${draft.contractType === 'leasing' ? 'Leasing' : draft.contractType}`);
  }
  if (draft.vehicle?.label) lines.push(`FAHRZEUG\n${draft.vehicle.label}`);
  if (draft.contractStartDate || draft.contractEndDate || draft.termMonths) {
    const range = [
      formatDeDate(draft.contractStartDate),
      formatDeDate(draft.contractEndDate),
    ].filter(Boolean).join(' bis ');
    const term = draft.termMonths != null ? `${draft.termMonths} Monate` : null;
    lines.push(`LAUFZEIT\n${[range, term].filter(Boolean).join('\n')}`);
  }
  const cond = [
    draft.monthlyRate != null ? `${formatEuro(draft.monthlyRate)} monatlich` : null,
    draft.annualMileage != null
      ? `${Number(draft.annualMileage).toLocaleString('de-DE')} km/Jahr`
      : null,
    draft.downPayment != null ? `${formatEuro(draft.downPayment)} Sonderzahlung` : null,
  ].filter(Boolean);
  if (cond.length) lines.push(`KONDITIONEN\n${cond.join('\n')}`);

  if (draft.excessMileageRate != null || draft.underMileageRate != null) {
    lines.push(
      `MEHR-/MINDERKILOMETER\n${[
        formatCt(draft.excessMileageRate),
        formatCt(draft.underMileageRate),
      ].filter(Boolean).join(' / ')}`,
    );
  }

  if (missingInformation.length) {
    lines.push(`NOCH OFFEN\n${missingInformation.map((m) => m.label).join('\n')}`);
  }

  return lines.join('\n\n');
}

export { isCustomerContractIntakeText };
