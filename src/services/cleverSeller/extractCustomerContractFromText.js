/**
 * Deterministische Extraktion eines Altvertrags aus Verkäufer-Paste.
 * Keine erfundenen Werte, jedes Feld mit Evidence.
 */
import { SELLER_FACT_SOURCE } from './sellerFactTypes.js';

const MAKES = [
  'Ford', 'Kia', 'VW', 'Volkswagen', 'BMW', 'Mercedes', 'Mercedes-Benz',
  'Audi', 'Opel', 'Toyota', 'Hyundai', 'Skoda', 'Škoda', 'Seat', 'SEAT',
  'Renault', 'Peugeot', 'Citroen', 'Citroën', 'Nissan', 'Mazda', 'Volvo',
  'Mini', 'Fiat', 'Jeep', 'Suzuki', 'Dacia', 'Cupra', 'Porsche',
];

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isCustomerContractIntakeText(text = '') {
  const t = String(text || '');
  if (t.trim().length < 40) return false;
  if (/\b(lies|lese|importier|erfasse|leg).{0,40}\bvertrag\b/i.test(t)) return true;
  const signals = [
    /\b(leasingvertrag|finanzierungsvertrag|mietkaufvertrag|kaufvertrag)\b/i,
    /\bvertragsbeginn\b/i,
    /\bvertragsende\b/i,
    /\blaufzeit\b.{0,20}\d{1,3}\s*monate?\b/i,
    /\d[\d.\s]*\s*(?:km|kilometer).{0,20}(?:jähr|jahrlich|jährlich|p\.?\s*a)/i,
    /\b(mehrkilometer|minderkilometer)\b/i,
    /\bsonderzahlung\b/i,
    /\b(leasingrate|monatliche\s+rate|rate\s+\d)/i,
  ];
  const hits = signals.filter((re) => re.test(t)).length;
  return hits >= 3;
}

/**
 * @param {string} text
 * @returns {'leasing_contract'|'financing_contract'|'purchase_contract'|'unknown_contract'}
 */
export function classifyContractDocument(text = '') {
  const t = String(text || '').toLowerCase();
  if (/\bleasingvertrag\b|\bleasing\b/.test(t)) return 'leasing_contract';
  if (/\bfinanzierungsvertrag\b|\bfinanzierung\b/.test(t)) return 'financing_contract';
  if (/\bkaufvertrag\b|\bbarkauf\b/.test(t)) return 'purchase_contract';
  return 'unknown_contract';
}

function documentTypeToContractType(docType) {
  if (docType === 'leasing_contract') return 'leasing';
  if (docType === 'financing_contract') return 'financing';
  if (docType === 'purchase_contract') return 'purchase';
  return null;
}

function parseDeNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  // 15.000 → 15000 ; 329,00 → 329 ; 8 → 8
  if (/\.\d{3}(?:\D|$)/.test(s) && !/,\d+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (/,/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDeDate(raw) {
  const m = String(raw || '').match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return iso;
}

function pushField(fields, evidence, {
  field,
  value,
  evidenceText,
  confidence = 0.9,
  sourceType = 'pasted_contract_text',
  sourceId = null,
}) {
  if (value == null || value === '') return;
  fields[field] = value;
  evidence.push({
    field,
    value,
    sourceType,
    sourceId,
    evidenceText: String(evidenceText || '').trim() || null,
    confidence,
  });
}

function extractCustomerNameHint(text) {
  const m = String(text).match(
    /\bkunde\s+((?:herr|frau|firma)\s+)?([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]+)/i,
  );
  if (!m) return null;
  const title = m[1] ? m[1].trim() : '';
  const last = m[2].trim();
  const label = title ? `${title.replace(/\s+/g, ' ')}${title.endsWith(' ') ? '' : ' '}${last}`.replace(/\s+/g, ' ').trim() : last;
  // Normalize "Herr Brandes"
  const normalized = /^(herr|frau)\b/i.test(label)
    ? label.replace(/^(herr|frau)\s+/i, (x) => (
      /^frau/i.test(x) ? 'Frau ' : 'Herr '
    ))
    : label;
  return {
    value: normalized,
    evidenceText: m[0],
  };
}

function extractVehicle(text) {
  const t = String(text);
  for (const make of MAKES) {
    const re = new RegExp(`\\b${make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([A-Za-z0-9ÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß\\-]*)`, 'i');
    const m = t.match(re);
    if (m) {
      return {
        make: make === 'Volkswagen' ? 'VW' : (make === 'Mercedes-Benz' ? 'Mercedes' : make),
        model: m[1],
        evidenceText: m[0],
      };
    }
  }
  return null;
}

/**
 * @param {string} sellerInput
 * @param {{ sourceType?: string, sourceId?: string|null }} [options]
 */
export function extractCustomerContractFromText(sellerInput = '', options = {}) {
  const text = String(sellerInput || '').trim();
  const sourceType = options.sourceType || 'pasted_contract_text';
  const sourceId = options.sourceId || null;
  const documentClassification = classifyContractDocument(text);
  const fields = {};
  const evidence = [];

  if (!text) {
    return {
      ok: false,
      documentClassification,
      fields: {},
      evidence: [],
      contractDraft: null,
      missingInformation: [{ id: 'contract_text', label: 'Kein Vertragstext erkannt' }],
    };
  }

  const contractType = documentTypeToContractType(documentClassification);
  if (contractType) {
    pushField(fields, evidence, {
      field: 'contractType',
      value: contractType,
      evidenceText: documentClassification === 'leasing_contract' ? 'Leasingvertrag' : documentClassification,
      confidence: 0.95,
      sourceType,
      sourceId,
    });
  }

  const nameHint = extractCustomerNameHint(text);
  if (nameHint) {
    pushField(fields, evidence, {
      field: 'customerNameHint',
      value: nameHint.value,
      evidenceText: nameHint.evidenceText,
      confidence: 0.92,
      sourceType,
      sourceId,
    });
  }

  const vehicle = extractVehicle(text);
  if (vehicle) {
    pushField(fields, evidence, {
      field: 'vehicleMake',
      value: vehicle.make,
      evidenceText: vehicle.evidenceText,
      confidence: 0.93,
      sourceType,
      sourceId,
    });
    pushField(fields, evidence, {
      field: 'vehicleModel',
      value: vehicle.model,
      evidenceText: vehicle.evidenceText,
      confidence: 0.93,
      sourceType,
      sourceId,
    });
  }

  const startM = text.match(/\bvertragsbeginn\s*[:=]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/i)
    || text.match(/\bbeginn\s*[:=]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/i);
  if (startM) {
    const iso = parseDeDate(startM[1]);
    if (iso) {
      pushField(fields, evidence, {
        field: 'contractStartDate',
        value: iso,
        evidenceText: startM[0],
        confidence: 0.95,
        sourceType,
        sourceId,
      });
    }
  }

  const endM = text.match(/\bvertragsende\s*[:=]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/i)
    || text.match(/\bende\s*[:=]?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/i);
  if (endM) {
    const iso = parseDeDate(endM[1]);
    if (iso) {
      pushField(fields, evidence, {
        field: 'contractEndDate',
        value: iso,
        evidenceText: endM[0],
        confidence: 0.95,
        sourceType,
        sourceId,
      });
    }
  }

  const termM = text.match(/\blaufzeit\s*[:=]?\s*(\d{1,3})\s*monate?\b/i);
  if (termM) {
    pushField(fields, evidence, {
      field: 'termMonths',
      value: Number(termM[1]),
      evidenceText: termM[0],
      confidence: 0.95,
      sourceType,
      sourceId,
    });
  }

  const kmM = text.match(
    /\b(\d{1,3}(?:[.\s]\d{3})*|\d{4,6})\s*(?:km|kilometer)\s*(?:jährlich|jahrlich|p\.?\s*a\.?|pro\s*jahr|\/\s*jahr)?\b/i,
  ) || text.match(/\b(?:jährlich|jahrlich)\s*(\d{1,3}(?:[.\s]\d{3})*|\d{4,6})\s*(?:km|kilometer)\b/i);
  if (kmM) {
    const n = parseDeNumber(kmM[1]);
    if (n != null) {
      pushField(fields, evidence, {
        field: 'annualMileage',
        value: n,
        evidenceText: kmM[0],
        confidence: 0.93,
        sourceType,
        sourceId,
      });
    }
  }

  const rateM = text.match(
    /\b(?:leasingrate|monatliche\s+(?:leasing)?rate|rate)\s*[:=]?\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|euro)?\b/i,
  );
  if (rateM) {
    const n = parseDeNumber(rateM[1]);
    if (n != null) {
      pushField(fields, evidence, {
        field: 'monthlyRate',
        value: n,
        evidenceText: rateM[0],
        confidence: 0.94,
        sourceType,
        sourceId,
      });
    }
  }

  const downM = text.match(
    /\b(?:sonderzahlung|anzahlung|down\s*payment)\s*[:=]?\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:€|euro)?\b/i,
  );
  if (downM) {
    const n = parseDeNumber(downM[1]);
    if (n != null) {
      pushField(fields, evidence, {
        field: 'downPayment',
        value: n,
        evidenceText: downM[0],
        confidence: 0.93,
        sourceType,
        sourceId,
      });
    }
  }

  const excessM = text.match(
    /\bmehrkilometer\s*[:=]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:ct|cent|€|euro)?\b/i,
  );
  if (excessM) {
    let n = parseDeNumber(excessM[1]);
    if (n != null) {
      if (/cent|ct/i.test(excessM[0]) || n >= 1) n = n / 100;
      pushField(fields, evidence, {
        field: 'excessMileageRate',
        value: n,
        evidenceText: excessM[0],
        confidence: 0.9,
        sourceType,
        sourceId,
      });
    }
  }

  const underM = text.match(
    /\bminderkilometer\s*[:=]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:ct|cent|€|euro)?\b/i,
  );
  if (underM) {
    let n = parseDeNumber(underM[1]);
    if (n != null) {
      if (/cent|ct/i.test(underM[0]) || n >= 1) n = n / 100;
      pushField(fields, evidence, {
        field: 'underMileageRate',
        value: n,
        evidenceText: underM[0],
        confidence: 0.9,
        sourceType,
        sourceId,
      });
    }
  }

  const numM = text.match(/\bvertrags(?:nummer|nr\.?)\s*[:=]?\s*([A-Z0-9\-/]{4,})\b/i);
  if (numM) {
    pushField(fields, evidence, {
      field: 'contractNumber',
      value: numM[1],
      evidenceText: numM[0],
      confidence: 0.9,
      sourceType,
      sourceId,
    });
  }

  const bankM = text.match(
    /\b(?:leasinggeber|leasinggesellschaft|bank|gesellschaft)\s*[:=]?\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9 &\-]{2,40})/i,
  );
  if (bankM) {
    pushField(fields, evidence, {
      field: 'bankOrLeasingCompany',
      value: String(bankM[1]).trim(),
      evidenceText: bankM[0],
      confidence: 0.88,
      sourceType,
      sourceId,
    });
  }

  const missingInformation = [];
  if (!fields.contractType) {
    missingInformation.push({ id: 'contractType', label: 'Vertragsart nicht eindeutig' });
  }
  if (!fields.contractNumber) {
    missingInformation.push({ id: 'contractNumber', label: 'Vertragsnummer nicht gefunden' });
  }
  if (!fields.bankOrLeasingCompany) {
    missingInformation.push({ id: 'bankOrLeasingCompany', label: 'Leasinggesellschaft nicht eindeutig' });
  }
  if (!fields.contractEndDate) {
    missingInformation.push({ id: 'contractEndDate', label: 'Vertragsende fehlt' });
  }

  const contractDraft = buildContractDraftFromFields(fields, {
    documentClassification,
    evidence,
    sourceType,
    sourceId,
    sourceText: text,
  });

  return {
    ok: Boolean(fields.contractType || fields.contractEndDate || fields.monthlyRate),
    documentClassification,
    fields,
    evidence,
    contractDraft,
    missingInformation,
    sourceType: SELLER_FACT_SOURCE.SELLER_INPUT,
  };
}

function buildContractDraftFromFields(fields, meta = {}) {
  const vehicle = (fields.vehicleMake || fields.vehicleModel)
    ? {
      make: fields.vehicleMake || null,
      model: fields.vehicleModel || null,
      variant: fields.vehicleVariant || null,
      label: [fields.vehicleMake, fields.vehicleModel, fields.vehicleVariant]
        .filter(Boolean)
        .join(' '),
    }
    : null;

  return {
    status: 'draft',
    contractType: fields.contractType || null,
    contractNumber: fields.contractNumber || null,
    bankOrLeasingCompany: fields.bankOrLeasingCompany || null,
    customerNameHint: fields.customerNameHint || null,
    vehicle,
    contractStartDate: fields.contractStartDate || null,
    contractEndDate: fields.contractEndDate || null,
    termMonths: fields.termMonths ?? null,
    annualMileage: fields.annualMileage ?? null,
    monthlyRate: fields.monthlyRate ?? null,
    downPayment: fields.downPayment ?? null,
    excessMileageRate: fields.excessMileageRate ?? null,
    underMileageRate: fields.underMileageRate ?? null,
    documentClassification: meta.documentClassification || null,
    sourceDocument: {
      sourceType: meta.sourceType || 'pasted_contract_text',
      sourceId: meta.sourceId || null,
      preview: String(meta.sourceText || '').slice(0, 280),
    },
    evidence: meta.evidence || [],
    extractionConfidence: (meta.evidence || []).length
      ? Number((
        (meta.evidence.reduce((s, e) => s + (e.confidence || 0), 0)
          / meta.evidence.length)
      ).toFixed(2))
      : 0,
    mutatesCustomerTruth: false,
  };
}

/**
 * Extrahiert Kundennamen-Hinweis aus Vertragstext (für Resolve).
 * @param {string} text
 */
export function extractContractCustomerNameHint(text = '') {
  return extractCustomerNameHint(text)?.value || null;
}
