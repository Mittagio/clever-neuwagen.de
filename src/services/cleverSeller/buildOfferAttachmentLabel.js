/**
 * Working-Context-Label für Angebots-PDFs:
 * „EV2-Angebot · 36 Monate · 15.000 km“ statt nur Dateiname.
 */
import { normalizeVehicleDisplayLabel, parseVehicleLabelParts } from './normalizeVehicleDisplayLabel.js';

/**
 * @param {{
 *   fileName?: string|null,
 *   text?: string|null,
 *   facts?: Array<{ field?: string, value?: unknown, label?: string }>,
 * }} params
 * @returns {{ label: string, detailLabel: string }}
 */
export function buildOfferAttachmentLabel(params = {}) {
  const fileName = String(params.fileName || '').trim() || 'Angebot.pdf';
  const text = String(params.text || '');
  const facts = Array.isArray(params.facts) ? params.facts : [];

  const vehicleFact = facts.find((f) => f.field === 'vehicleInterest' || f.field === 'vehicleInterestMulti');
  const termFact = facts.find((f) => f.field === 'termMonths');
  const kmFact = facts.find((f) => f.field === 'annualMileage');

  const MODEL_RE = /\b(EV\s?[2-9]|Picanto|Sportage|XCeed|Ceed|Niro|Sorento)\b/i;
  const normalizeModel = (raw) => {
    if (!raw) return null;
    let m = String(raw).replace(/\s+/g, '').replace(/^ev/i, 'EV');
    m = m.replace(/^EV(\d)/, 'EV$1');
    if (/^ev\d$/i.test(m)) m = m.toUpperCase();
    return MODEL_RE.test(m) || /^EV\d$/i.test(m) ? m.replace(/^ev/i, 'EV') : null;
  };

  let model = null;
  if (vehicleFact?.label) {
    model = normalizeModel(parseVehicleLabelParts(vehicleFact.label).model)
      || normalizeModel(String(vehicleFact.label).replace(/^Kia\s+/i, '').split(/\s+/)[0]);
  }
  // Text vor Dateiname: „Freibleibende Kalkulation.pdf“ enthält kein Modell
  if (!model) {
    const fromText = text.match(MODEL_RE);
    if (fromText) model = normalizeModel(fromText[1]);
  }
  if (!model) {
    const fromName = parseVehicleLabelParts(fileName.replace(/[_.-]+/g, ' '));
    model = normalizeModel(fromName.model);
  }

  let months = termFact?.value != null ? Number(termFact.value) : null;
  if (!Number.isFinite(months)) {
    const m = text.match(/\b(\d{2})\s*monate?\b/i) || fileName.match(/\b(\d{2})\b/);
    months = m ? Number(m[1]) : null;
  }

  let km = kmFact?.value != null ? Number(kmFact.value) : null;
  if (!Number.isFinite(km)) {
    const kmMatch = text.match(/(\d{1,3}(?:[.\s]\d{3})*)\s*km/i)
      || fileName.match(/(\d{1,3}(?:[.\s]\d{3})*)\s*km/i);
    if (kmMatch) {
      km = Number(String(kmMatch[1]).replace(/[.\s]/g, ''));
    }
  }

  const parts = [];
  if (model) parts.push(`${model}-Angebot`);
  else parts.push('Angebot');
  if (Number.isFinite(months)) parts.push(`${months} Monate`);
  if (Number.isFinite(km)) {
    parts.push(`${km.toLocaleString('de-DE')} km`);
  }

  const vehicleNice = normalizeVehicleDisplayLabel(vehicleFact?.label || fileName.replace(/[_.-]+/g, ' '));

  return {
    label: parts.join(' · '),
    detailLabel: fileName,
    vehicleLabel: vehicleNice,
  };
}
