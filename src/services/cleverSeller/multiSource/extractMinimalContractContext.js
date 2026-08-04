/**
 * Minimierter Vertragskontext für OpenAI – kein Full-PDF, sensible Felder redigiert.
 * Originaldokument bleibt über attachmentId verknüpft.
 */
import { minimizeSensitiveOcrText } from '../minimizeSensitiveOcrText.js';
import {
  extractCustomerContractFromText,
  classifyContractDocument,
} from '../extractCustomerContractFromText.js';
import { enrichContractDraftByKind } from './contractKindRegistry.js';
import { resolveContractTemporalStatus } from './resolveContractTemporalStatus.js';

const ADDRESS_RE = /\b(?:Straße|Str\.|Anschrift|PLZ|Wohnort|Ort)\s*[:.]?\s*[^\n]{3,80}/gi;
const EMPLOYER_RE = /\b(?:Arbeitgeber|Beschäftigt bei|Firma)\s*[:.]?\s*[^\n]{2,80}/gi;
const BIRTH_RE = /\b(?:Geburtsdatum|geboren am|Geb\.?\s*Datum)\s*[:.]?\s*\d{1,2}[./]\d{1,2}[./]\d{2,4}/gi;
const SIGNATURE_RE = /\b(?:Unterschrift|gezeichnet|Signature)\b[^\n]{0,60}/gi;
const AGB_RE = /\b(?:Allgemeine Geschäftsbedingungen|AGB|Versicherungsbedingungen)\b[\s\S]{0,400}/gi;
const MAX_MINIMIZED_CHARS = 2800;

const SENSITIVE_FIELD_BLOCKLIST = new Set([
  'iban', 'accountNumber', 'idNumber', 'ausweisnummer', 'income', 'employer',
  'street', 'address', 'signature', 'gehalt', 'arbeitgeber', 'birthDate', 'dob',
]);

/**
 * @param {{
 *   document?: object,
 *   requestedPurpose?: string,
 *   now?: Date|number,
 * }} params
 */
export function extractMinimalContractContext(params = {}) {
  const document = params.document || {};
  const purpose = params.requestedPurpose || 'customer_contract_tradein_intake';
  const now = params.now || Date.now();
  const attachmentId = document.id || document.attachmentId || document.fileName || null;
  const fileName = sanitizeFileName(document.fileName || document.name);
  const raw = String(document.extractedText || document.text || '').trim();

  if (!raw) {
    return {
      ok: false,
      purpose,
      attachmentId,
      fileName,
      attachmentContextMode: fileName ? 'metadata_only' : 'none',
      minimizedText: '',
      structured: null,
      redacted: [],
      originalLinked: Boolean(attachmentId),
    };
  }

  const baseMin = minimizeSensitiveOcrText(raw);
  const { text: scrubbed, redacted: extraRedacted } = redactExtraSensitive(baseMin.text);
  const redacted = [...new Set([...(baseMin.redacted || []), ...extraRedacted])];

  const classification = classifyContractDocument(scrubbed);
  const extracted = extractCustomerContractFromText(scrubbed, {
    sourceType: document.sourceType || document.kind || 'contract_pdf',
    sourceId: attachmentId,
  });
  const enriched = extracted?.ok
    ? enrichContractDraftByKind({
      ...extracted,
      documentClassification: classification,
      fields: extracted.fields || {},
      evidence: extracted.evidence || [],
    }, scrubbed)
    : null;

  const fields = sanitizeFields(enriched?.fields || extracted?.fields || {});
  const temporal = resolveContractTemporalStatus(fields.contractEndDate, now);

  const structured = {
    customerName: fields.customerNameHint || null,
    contractKind: enriched?.contractKindId
      || classification
      || null,
    contractKindLabel: enriched?.contractKindLabel
      || fields.contractTypeLabel
      || null,
    vehicleMake: fields.vehicleMake || null,
    vehicleModel: fields.vehicleModel || null,
    contractStartDate: fields.contractStartDate || null,
    contractEndDate: fields.contractEndDate || null,
    termMonths: fields.termMonths ?? null,
    monthlyRate: fields.monthlyRate ?? null,
    finalPayment: fields.finalPayment ?? null,
    totalMileage: fields.totalMileage ?? fields.annualMileage ?? null,
    annualMileage: fields.annualMileage ?? null,
    excessMileageRate: fields.excessMileageRate ?? null,
    underMileageRate: fields.underMileageRate ?? null,
    status: temporal.status,
    statusLabel: temporal.label,
    childrenCountHint: extractChildrenHint(scrubbed),
  };

  const relevantLines = pickRelevantLines(scrubbed);
  const minimizedText = relevantLines.slice(0, MAX_MINIMIZED_CHARS);

  return {
    ok: true,
    purpose,
    attachmentId,
    fileName,
    kind: document.kind || document.sourceType || 'contract_pdf',
    attachmentContextMode: hasUsefulStructure(structured)
      ? 'structured_extract'
      : 'minimized_text',
    minimizedText,
    structured,
    redacted,
    originalLinked: Boolean(attachmentId),
    charCount: minimizedText.length,
  };
}

/**
 * @param {object[]} attachments
 * @param {{ requestedPurpose?: string, now?: Date|number }} [options]
 */
export function extractMinimalContractContexts(attachments = [], options = {}) {
  return (attachments || [])
    .slice(0, 4)
    .map((document) => extractMinimalContractContext({
      document,
      requestedPurpose: options.requestedPurpose || 'customer_contract_tradein_intake',
      now: options.now,
    }));
}

function redactExtraSensitive(text = '') {
  const redacted = [];
  let next = String(text || '');
  const apply = (re, label) => {
    if (!re.test(next)) return;
    re.lastIndex = 0;
    next = next.replace(re, () => {
      redacted.push(label);
      return `[${label} entfernt]`;
    });
    re.lastIndex = 0;
  };
  apply(ADDRESS_RE, 'Adresse');
  apply(EMPLOYER_RE, 'Arbeitgeber');
  apply(BIRTH_RE, 'Geburt');
  apply(SIGNATURE_RE, 'Unterschrift');
  apply(AGB_RE, 'AGB');
  return { text: next, redacted };
}

function sanitizeFields(fields = {}) {
  const out = { ...fields };
  for (const key of SENSITIVE_FIELD_BLOCKLIST) delete out[key];
  return out;
}

function sanitizeFileName(name) {
  const s = String(name || '').trim().slice(0, 80);
  return s.replace(/^.*[/\\]/, '') || null;
}

function extractChildrenHint(text = '') {
  const m = String(text).match(/\bKinder\s*[:.]?\s*(\d{1,2})\b/i)
    || String(text).match(/\b(\d{1,2})\s*Kind(?:er)?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function pickRelevantLines(text = '') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const keep = [];
  const relevant = /kunde|vertrag|fahrzeug|beginn|ende|laufzeit|rate|schluss|km|kilometer|finanz|leasing|wege|mehrkilometer|minderkilometer|kinder|modell|marke/i;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/\[(?:IBAN|Ausweis|Gehalt|Adresse|Arbeitgeber|Geburt|Unterschrift|AGB|Bonität) entfernt\]/i.test(t) && !relevant.test(t)) {
      continue;
    }
    if (relevant.test(t) || /\d/.test(t)) keep.push(t);
  }
  const joined = (keep.length ? keep : lines.map((l) => l.trim()).filter(Boolean)).join('\n');
  return joined.slice(0, MAX_MINIMIZED_CHARS);
}

function hasUsefulStructure(structured = {}) {
  return Boolean(
    structured.vehicleModel
    || structured.monthlyRate != null
    || structured.contractEndDate
    || structured.contractKindLabel,
  );
}
