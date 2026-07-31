/**
 * Slice 9: Strukturierter Vergleich Altvertrag ↔ neues Angebot.
 * Nur vorhandene Werte – nichts erfinden. Keine Customer-Truth-Mutation.
 */
import { listCustomerContracts } from '../crm/customerContracts.js';
import { resolveCustomersFromInput } from './globalCustomerResolve.js';
import { extractNamedCustomerFromInput } from './resolveAssistantContext.js';
import { VEHICLE_TRACK_STATUS } from '../crm/vehicleTrack.js';

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isContractOfferCompareQuery(text = '') {
  const t = String(text || '').trim();
  if (t.length < 10) return false;
  // Vollimport / Paste → nicht Compare
  if (/\bleasingvertrag\b/i.test(t) && /\bvertragsbeginn\b|\bvertragsende\b|\blaufzeit\b/i.test(t)) {
    return false;
  }
  if (/\b(lies|lese|importier|erfasse).{0,40}\bvertrag\b/i.test(t)) return false;

  const hasCompare = /\bvergleich\w*\b|\bgegenüberstell\w*|\bdiff(?:erenz)?\b/i.test(t);
  const hasContract = /\bvertrag\b|\baltvertrag\b|\bleasingvertrag\b/i.test(t);
  const hasOffer = /\bangebot\b|\boffer\b|\bneu(?:e[snr]?)?\s+(?:rate|kondition)/i.test(t);

  return Boolean(hasCompare && hasContract && hasOffer);
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

function formatKm(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${Number(n).toLocaleString('de-DE')} km`;
}

function formatMonths(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${Number(n)} Monate`;
}

function pickEvidence(contract, field) {
  const list = Array.isArray(contract?.evidence) ? contract.evidence : [];
  return list.find((e) => e.field === field) || null;
}

/**
 * Angebot nur aus Working Context oder Track/Offer-Daten – nie aus wish.* (Customer Truth).
 * @param {object} params
 * @returns {{ source: string, label: string|null, monthlyRate: number|null, termMonths: number|null, annualMileage: number|null, vehicleLabel: string|null }|null}
 */
export function resolveOfferSideForCompare({
  currentOfferContext = null,
  lead = null,
} = {}) {
  const ctx = currentOfferContext;
  if (ctx && (
    ctx.monthlyRate != null
    || ctx.termMonths != null
    || ctx.mileagePerYear != null
    || ctx.title
    || ctx.summary
    || ctx.offerId
  )) {
    return {
      source: 'current_offer',
      label: ctx.title || ctx.summary || ctx.shortLabel || null,
      monthlyRate: ctx.monthlyRate != null ? Number(ctx.monthlyRate) : null,
      termMonths: ctx.termMonths != null ? Number(ctx.termMonths) : null,
      annualMileage: ctx.mileagePerYear != null ? Number(ctx.mileagePerYear) : null,
      vehicleLabel: ctx.title || ctx.summary || null,
      offerId: ctx.offerId || null,
    };
  }

  const configs = Array.isArray(lead?.crm?.vehicleConfigurations)
    ? lead.crm.vehicleConfigurations
    : [];
  const favorite = configs.find((c) => (
    c?.vehicleTrack?.status === VEHICLE_TRACK_STATUS.FAVORITE
    && (c?.leasingData?.calculatedRate != null || c?.desiredRate != null)
  ));
  const preferred = favorite
    || configs.find((c) => {
      const model = String(lead?.vehicle?.model || '').toLowerCase();
      return model && String(c?.model || '').toLowerCase() === model;
    })
    || configs.find((c) => c?.leasingData?.calculatedRate != null);

  if (preferred?.leasingData || preferred?.desiredRate != null) {
    const ld = preferred.leasingData || {};
    const label = [preferred.brand, preferred.model].filter(Boolean).join(' ') || null;
    return {
      source: favorite ? 'favorite_track' : 'vehicle_track',
      label,
      monthlyRate: ld.calculatedRate != null
        ? Number(ld.calculatedRate)
        : (preferred.desiredRate != null ? Number(preferred.desiredRate) : null),
      termMonths: ld.termMonths != null ? Number(ld.termMonths) : null,
      annualMileage: ld.mileagePerYear != null ? Number(ld.mileagePerYear) : null,
      vehicleLabel: label,
      offerId: preferred.id || null,
    };
  }

  return null;
}

function readContractSide(contract) {
  if (!contract) return null;
  const vehicle = contract.vehicle || {};
  const label = vehicle.label
    || [vehicle.make, vehicle.model].filter(Boolean).join(' ')
    || null;
  return {
    source: 'confirmed_contract',
    contractId: contract.id || null,
    label,
    monthlyRate: contract.commercialTerms?.monthlyRate ?? null,
    termMonths: contract.commercialTerms?.termMonths ?? null,
    annualMileage: contract.mileageTerms?.annualMileage ?? null,
    contractEndDate: contract.dates?.contractEndDate || null,
    vehicleLabel: label,
  };
}

/**
 * @returns {{ field: string, label: string, contractValue: *, offerValue: *, contractDisplay: string|null, offerDisplay: string|null, delta: number|null, status: string }}
 */
function compareRow({
  field,
  label,
  contractValue,
  offerValue,
  formatFn,
}) {
  const hasC = contractValue != null && contractValue !== '';
  const hasO = offerValue != null && offerValue !== '';
  if (!hasC && !hasO) {
    return {
      field,
      label,
      contractValue: null,
      offerValue: null,
      contractDisplay: null,
      offerDisplay: null,
      delta: null,
      status: 'both_missing',
    };
  }
  if (!hasC) {
    return {
      field,
      label,
      contractValue: null,
      offerValue,
      contractDisplay: null,
      offerDisplay: formatFn(offerValue),
      delta: null,
      status: 'missing_contract',
    };
  }
  if (!hasO) {
    return {
      field,
      label,
      contractValue,
      offerValue: null,
      contractDisplay: formatFn(contractValue),
      offerDisplay: null,
      delta: null,
      status: 'missing_offer',
    };
  }
  const numC = Number(contractValue);
  const numO = Number(offerValue);
  const bothNumeric = Number.isFinite(numC) && Number.isFinite(numO)
    && typeof contractValue !== 'string'
    && typeof offerValue !== 'string';
  const same = bothNumeric
    ? numC === numO
    : String(contractValue).trim().toLowerCase() === String(offerValue).trim().toLowerCase();
  return {
    field,
    label,
    contractValue,
    offerValue,
    contractDisplay: formatFn(contractValue),
    offerDisplay: formatFn(offerValue),
    delta: bothNumeric ? numO - numC : null,
    status: same ? 'same' : 'changed',
  };
}

function buildCompareBody({ customerName, contractSide, offerSide, rows }) {
  const lines = [
    '✨ VERTRAG ↔ ANGEBOT',
    '',
    customerName ? `KUNDE ${customerName}` : null,
    contractSide?.vehicleLabel ? `ALTVERTRAG ${contractSide.vehicleLabel}` : 'ALTVERTRAG',
    contractSide?.contractEndDate
      ? `Ende ${formatDeDate(contractSide.contractEndDate)}`
      : null,
    offerSide?.vehicleLabel || offerSide?.label
      ? `ANGEBOT ${offerSide.vehicleLabel || offerSide.label}`
      : 'ANGEBOT',
    offerSide?.source ? `(Quelle: ${offerSide.source})` : null,
    '',
    'VERGLEICH',
  ].filter((x) => x != null);

  for (const row of rows) {
    if (row.status === 'both_missing') continue;
    if (row.status === 'same') {
      lines.push(`✓ ${row.label}: ${row.contractDisplay} (gleich)`);
    } else if (row.status === 'changed') {
      const deltaBit = row.delta != null && row.field === 'monthlyRate'
        ? ` (${row.delta > 0 ? '+' : ''}${formatEuro(row.delta)})`
        : '';
      lines.push(`Δ ${row.label}: ${row.contractDisplay} → ${row.offerDisplay}${deltaBit}`);
    } else if (row.status === 'missing_offer') {
      lines.push(`· ${row.label}: Vertrag ${row.contractDisplay} · Angebot fehlt`);
    } else if (row.status === 'missing_contract') {
      lines.push(`· ${row.label}: Vertrag fehlt · Angebot ${row.offerDisplay}`);
    }
  }

  lines.push('', 'Keine Kundennachricht – nur strukturierter Vergleich.');
  return lines.join('\n');
}

function extractCompareCustomerName(sellerInput = '') {
  const t = String(sellerInput || '').trim();
  const patterns = [
    /\bvertrag\s+(?:von|für)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
    /\b(?:von|für)\s+(?:herrn?\s+|frau\s+)?([A-Za-zÄÖÜäöüß-]{2,40})\b.{0,40}\b(?:vertrag|angebot)\b/i,
    /\b(?:herrn?\s+|frau\s+)([A-Za-zÄÖÜäöüß-]{2,40})\b/i,
  ];
  const stop = /^(ein|eine|ihm|ihr|dem|den|das|der|er|sie|vertrag|leasing|angebot|neuen|neues|neuer)$/i;
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && !stop.test(m[1])) return m[1];
  }
  return null;
}

/**
 * @param {object} params
 */
export function compareContractWithOffer({
  sellerInput = '',
  lead = null,
  leadsSnapshot = [],
  customerName = '',
  currentOfferContext = null,
} = {}) {
  const named = extractCompareCustomerName(sellerInput)
    || extractNamedCustomerFromInput(sellerInput)
    || String(customerName || '').trim()
    || null;

  let workingLead = lead;
  let customerSearchResults = [];

  if (!workingLead?.id && Array.isArray(leadsSnapshot) && leadsSnapshot.length) {
    const searchInput = named ? `Öffne ${named}` : sellerInput;
    const resolved = resolveCustomersFromInput(searchInput, leadsSnapshot, {});
    if (resolved?.lead) {
      workingLead = resolved.lead;
    }
    if (resolved?.results?.length) {
      customerSearchResults = resolved.results;
    }
    if (resolved?.status === 'ambiguous') {
      return {
        ok: false,
        status: 'ambiguous_customer',
        message: 'Mehrere Kunden – bitte zuerst auswählen.',
        customerSearchResults,
        contractOfferCompareResult: null,
      };
    }
  }

  if (!workingLead?.id) {
    return {
      ok: false,
      status: 'no_customer',
      message: 'Kein Kunde für den Vertragsvergleich.',
      customerSearchResults,
      contractOfferCompareResult: null,
    };
  }

  const contracts = listCustomerContracts(workingLead).filter((c) => c.status === 'confirmed');
  if (!contracts.length) {
    return {
      ok: false,
      status: 'no_contract',
      message: 'Kein bestätigter Altvertrag zum Vergleich.',
      customerSearchResults,
      contractOfferCompareResult: null,
    };
  }

  const contract = contracts[0];
  const contractSide = readContractSide(contract);
  const offerSide = resolveOfferSideForCompare({ currentOfferContext, lead: workingLead });

  if (!offerSide) {
    return {
      ok: false,
      status: 'no_offer',
      message: 'Kein Angebot zum Vergleich (Working Context oder Fahrzeugspur mit Rate).',
      customerSearchResults,
      contractOfferCompareResult: {
        customerId: workingLead.id,
        customerName: workingLead.contact?.name || workingLead.name || named || null,
        contractId: contract.id,
        contractSide,
        offerSide: null,
        rows: [],
        body: 'Kein Angebot zum Vergleich vorhanden.',
        evidence: [],
        mutatesCustomerTruth: false,
      },
    };
  }

  const rows = [
    compareRow({
      field: 'vehicle',
      label: 'Fahrzeug',
      contractValue: contractSide.vehicleLabel,
      offerValue: offerSide.vehicleLabel || offerSide.label,
      formatFn: (v) => (v != null ? String(v) : null),
    }),
    compareRow({
      field: 'monthlyRate',
      label: 'Rate',
      contractValue: contractSide.monthlyRate,
      offerValue: offerSide.monthlyRate,
      formatFn: formatEuro,
    }),
    compareRow({
      field: 'termMonths',
      label: 'Laufzeit',
      contractValue: contractSide.termMonths,
      offerValue: offerSide.termMonths,
      formatFn: formatMonths,
    }),
    compareRow({
      field: 'annualMileage',
      label: 'Kilometer',
      contractValue: contractSide.annualMileage,
      offerValue: offerSide.annualMileage,
      formatFn: formatKm,
    }),
  ];

  const evidence = [
    pickEvidence(contract, 'monthlyRate'),
    pickEvidence(contract, 'termMonths'),
    pickEvidence(contract, 'annualMileage'),
    pickEvidence(contract, 'contractEndDate'),
  ].filter(Boolean);

  const displayName = workingLead.contact?.name || workingLead.name || named || null;
  const body = buildCompareBody({
    customerName: displayName,
    contractSide,
    offerSide,
    rows,
  });

  return {
    ok: true,
    status: 'compared',
    message: null,
    customerSearchResults,
    contractOfferCompareResult: {
      customerId: workingLead.id,
      customerName: displayName,
      contractId: contract.id,
      contractSide,
      offerSide,
      rows,
      body,
      evidence,
      mutatesCustomerTruth: false,
    },
  };
}
