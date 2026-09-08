/**
 * Verkäufer-Arbeitsgrundlage aus bereits strukturierten Facts/Draft/OpenQuestions.
 * Keine zweite KI-Wahrheit – nur Formatierung vorhandener Slots.
 */
import { buildCaptureNextStepHint } from './captureThenOffer.js';

function pickFact(facts, field) {
  return (facts || []).find((f) => f?.field === field && !f?.value?.remove) || null;
}

function pickFacts(facts, field) {
  return (facts || []).filter((f) => f?.field === field && !f?.value?.remove);
}

function titleCaseWords(raw = '') {
  return String(raw || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^ev\d$/i.test(w)) return w.toUpperCase();
      if (/^p\d+$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function formatVehicleLine(facts = [], draft = null) {
  const interest = pickFact(facts, 'vehicleInterest');
  const modelKey = interest?.value?.modelKey || draft?.vehicleIdentityDraft?.modelKey || null;
  const model = interest?.value?.model
    || draft?.vehicleIdentityDraft?.model?.canonical
    || draft?.vehicleIdentityDraft?.model?.raw
    || (modelKey ? String(modelKey).toUpperCase() : null);
  const trim = interest?.value?.trim
    || draft?.vehicleIdentityDraft?.trim?.canonical
    || draft?.vehicleIdentityDraft?.trim?.raw
    || null;
  const colorFact = pickFact(facts, 'colorPreference');
  const colorRaw = colorFact?.value?.color
    || colorFact?.label
    || draft?.vehicleIdentityDraft?.color?.raw
    || null;
  const color = colorRaw
    ? titleCaseWords(String(colorRaw).replace(/^farbe\s+/i, ''))
    : null;

  const modelLabel = model
    ? String(model).replace(/^Kia\s+/i, '').replace(/\s+/g, ' ').trim()
    : null;
  // „EV4 Air“ nicht doppelt, wenn model schon Trim trägt
  const trimPart = trim && modelLabel && !new RegExp(trim.replace(/\s+/g, '\\s*'), 'i').test(modelLabel)
    ? trim
    : (trim && !modelLabel ? trim : null);

  const equip = pickFacts(facts, 'equipmentWish')
    .filter((f) => !['winter_tires', 'winter_wheel_set'].includes(f.value?.id))
    .map((f) => String(f.value?.label || f.label || '').trim())
    .filter(Boolean);

  // Sitzheizung-Label aus Fact bevorzugen (vorn)
  const uniqEquip = [];
  for (const label of equip) {
    if (uniqEquip.some((x) => x.toLowerCase() === label.toLowerCase())) continue;
    // Winterpaket-Duplikat vermeiden, wenn Winter-Paket P1 schon da
    if (/^winterpaket$/i.test(label) && uniqEquip.some((x) => /winter-?paket/i.test(x))) continue;
    uniqEquip.push(label);
  }

  return [modelLabel, trimPart, color, ...uniqEquip].filter(Boolean).join(' · ') || null;
}

function formatLeasingLine(facts = [], lead = null) {
  const wish = lead?.wish || {};
  const payment = pickFact(facts, 'paymentType');
  const customerType = pickFact(facts, 'customerType');
  const term = pickFact(facts, 'termMonths') || pickFact(facts, 'durationMonths');
  const km = pickFact(facts, 'annualMileage') || pickFact(facts, 'mileagePerYear');
  const down = pickFact(facts, 'downPayment');

  const parts = [];
  const ct = customerType?.value || wish.customerType || null;
  if (ct === 'private' || ct === 'privat' || /privat/i.test(String(customerType?.label || ''))) {
    parts.push('Privat');
  } else if (ct === 'business' || /gewerbe|business/i.test(String(customerType?.label || ''))) {
    parts.push('Gewerbe');
  }

  const pay = payment?.value || wish.paymentType || null;
  if (pay === 'leasing' && !parts.includes('Privat') && !parts.includes('Gewerbe')) {
    parts.push(/privatleasing/i.test(String(payment?.label || '')) ? 'Privatleasing' : 'Leasing');
  } else if (pay === 'financing') {
    parts.push('Finanzierung');
  } else if (pay === 'cash') {
    parts.push('Kauf');
  }

  const months = term?.value ?? wish.termMonths ?? null;
  if (months != null) parts.push(`${Number(months)} Monate`);

  const mileage = km?.value ?? wish.mileagePerYear ?? null;
  if (mileage != null) {
    parts.push(`${Number(mileage).toLocaleString('de-DE')} km/Jahr`);
  }

  const az = down?.value ?? wish.downPayment ?? null;
  if (az != null && az !== '') {
    parts.push(`${Number(az).toLocaleString('de-DE')} € Sonderzahlung`);
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatExtrasLine(facts = []) {
  const equip = pickFacts(facts, 'equipmentWish');
  const parts = [];
  const tires = equip.find((f) => f.value?.id === 'winter_tires' || /winterreifen/i.test(f.label || ''));
  const wheels = equip.find((f) => (
    f.value?.id === 'winter_wheel_set'
    || /winterradsatz|winterr[aä]der/i.test(f.label || '')
  ));
  if (tires) parts.push('Winterreifen bevorzugt');
  if (wheels) parts.push('alternativ Winterradsatz');
  return parts.length ? parts.join(' · ') : null;
}

function formatClarifyLine(facts = [], draft = null) {
  const parts = [];
  const seen = new Set();
  const push = (label) => {
    const key = String(label || '').toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    parts.push(label);
  };

  for (const q of pickFacts(facts, 'openCustomerQuestion')) {
    const topic = q.value?.topic;
    if (topic === 'transfer_costs') push('Überführungskosten');
    else if (topic === 'one_time_costs') push('weitere Einmalkosten');
    else if (topic === 'subsidy') push('Förderung');
    else if (topic === 'quote_on_basis') {
      // Wunsch nach Ausweis – kein Klärpunkt, wenn Konditionen schon strukturiert sind
      continue;
    } else if (q.label) {
      push(String(q.label).replace(/\s*erfragen\s*$/i, '').trim());
    }
  }

  const colorSlot = draft?.vehicleIdentityDraft?.color;
  if (
    colorSlot?.status === 'needs_refinement'
    || colorSlot?.status === 'open'
    || pickFact(facts, 'colorPreference')?.needsConfirmation
  ) {
    // Farbe ist genannt, aber Katalog-ungeprüft → lokaler Hinweis
    if (colorSlot?.raw || pickFact(facts, 'colorPreference')) {
      push('Farbe prüfen');
    }
  }

  for (const f of facts || []) {
    if (!f?.needsConfirmation) continue;
    if (f.field === 'openCustomerQuestion') continue;
    if (f.field === 'equipmentWish' && f.label) {
      push(`${String(f.label).replace(/\s*·.*$/, '').trim()} prüfen`);
    }
  }

  return parts.length ? parts.join(' · ') : null;
}

/**
 * @param {{
 *   facts?: object[],
 *   draft?: object|null,
 *   lead?: object|null,
 *   nextStepHint?: object|null,
 * }} params
 * @returns {{
 *   sections: {
 *     customerWants: string|null,
 *     leasingWish: string|null,
 *     extras: string|null,
 *     toClarify: string|null,
 *     nextStep: string,
 *   },
 *   lines: string[],
 *   text: string,
 *   source: 'structured_facts',
 * }}
 */
export function buildSellerWorkBriefing(params = {}) {
  const facts = Array.isArray(params.facts) ? params.facts : [];
  const draft = params.draft || null;
  const lead = params.lead || null;
  const nextHint = params.nextStepHint || buildCaptureNextStepHint({
    hasActiveTrack: Boolean(lead?.crm?.focusedVehicleTrackId),
    trackCount: Array.isArray(lead?.crm?.vehicleConfigurations)
      ? lead.crm.vehicleConfigurations.length
      : 0,
  });

  const customerWants = formatVehicleLine(facts, draft);
  const leasingWish = formatLeasingLine(facts, lead);
  const extras = formatExtrasLine(facts);
  const toClarify = formatClarifyLine(facts, draft);
  const nextStep = nextHint?.cta === 'Angebot' || /angebot/i.test(String(nextHint?.label || ''))
    ? 'Angebot vorbereiten'
    : (nextHint?.label || 'Angebot vorbereiten');

  const lines = [];
  if (customerWants) {
    lines.push(`Kunde möchte:`);
    lines.push(customerWants);
  }
  if (leasingWish) {
    lines.push('');
    lines.push('Leasingwunsch:');
    lines.push(leasingWish);
  }
  if (extras) {
    lines.push('');
    lines.push('Zusätzlich:');
    lines.push(extras);
  }
  if (toClarify) {
    lines.push('');
    lines.push('Noch zu klären:');
    lines.push(toClarify);
  }
  lines.push('');
  lines.push('Nächster Schritt:');
  lines.push(nextStep);

  return {
    sections: {
      customerWants,
      leasingWish,
      extras,
      toClarify,
      nextStep,
    },
    lines,
    text: lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim(),
    source: 'structured_facts',
  };
}
