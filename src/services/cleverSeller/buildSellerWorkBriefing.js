/**
 * Verkäufer-Arbeitsgrundlage aus bereits strukturierten Facts/Draft/OpenQuestions.
 * Keine zweite KI-Wahrheit – nur Formatierung vorhandener Slots.
 */
import { buildCaptureNextStepHint } from './captureThenOffer.js';
import { presentIntakeNextStepLabel } from './presentSellerIntakeFeedback.js';

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

const MONTH_LABELS = {
  '01': 'Januar', '02': 'Februar', '03': 'März', '04': 'April',
  '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Dezember',
};

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

function formatCustomerPicture(facts = [], lead = null) {
  const parts = [];
  const children = pickFact(facts, 'childrenCount');
  const childrenVal = children?.value ?? lead?.crm?.needProfile?.household?.childrenCount
    ?? lead?.crm?.needProfile?.children ?? null;
  if (childrenVal != null) parts.push(`${Number(childrenVal)} Kinder`);

  const pet = pickFact(facts, 'pet') || pickFact(facts, 'hasPet');
  const dog = lead?.crm?.needProfile?.dog === true
    || pet?.value?.type === 'dog'
    || /hund/i.test(String(pet?.label || ''));
  if (dog) parts.push('Hund');
  else if (pet?.value?.type === 'cat' || /katze/i.test(String(pet?.label || ''))) {
    parts.push('Katze');
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatSoughtLine(facts = [], draft = null) {
  if (pickFact(facts, 'vehicleInterest')?.value?.modelKey
    || draft?.vehicleIdentityDraft?.modelKey) {
    return null;
  }
  const fuel = pickFact(facts, 'fuelPreference');
  const fuelVal = fuel?.value || null;
  if (fuelVal === 'electric' || fuelVal === 'elektro' || fuelVal === 'bev'
    || /elektro/i.test(String(fuel?.label || ''))) {
    return 'Elektroauto';
  }
  if (fuel?.label) return String(fuel.label);
  return null;
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
  // Bare „Leasing“ weglassen – Abschnitts-Titel „Leasingwunsch“ reicht;
  // Privatleasing / Finanzierung / Kauf weiter anzeigen
  if (pay === 'leasing' && /privatleasing/i.test(String(payment?.label || ''))) {
    if (!parts.includes('Privat')) parts.push('Privatleasing');
  } else if (pay === 'financing') {
    parts.push('Finanzierung');
  } else if (pay === 'cash') {
    parts.push('Kauf');
  }

  const months = term?.value ?? wish.termMonths ?? null;
  if (months != null && Number(months) > 0) {
    parts.push(`${Number(months)} Monate`);
  }

  // 0 km ist Missing – nie als Fachwert anzeigen
  const mileage = km?.value ?? wish.mileagePerYear ?? null;
  if (mileage != null && Number(mileage) > 0) {
    parts.push(`${Number(mileage).toLocaleString('de-DE')} km/Jahr`);
  }

  const az = down?.value ?? wish.downPayment ?? null;
  // downPayment 0 ist gültig („ohne AZ“)
  if (az != null && az !== '' && Number.isFinite(Number(az))) {
    parts.push(`${Number(az).toLocaleString('de-DE')} € Sonderzahlung`);
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatImportantLine(facts = []) {
  const parts = [];
  const seen = new Set();
  const push = (label) => {
    const key = String(label || '').toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    parts.push(label);
  };

  for (const f of pickFacts(facts, 'equipmentWish')) {
    if (['winter_tires', 'winter_wheel_set'].includes(f.value?.id)) continue;
    const label = String(f.value?.label || f.label || '')
      .replace(/\s*[·|]\s*(muss|wichtig|nice)\s*$/i, '')
      .trim();
    if (label) push(label);
  }
  const ahk = pickFact(facts, 'towHitchRequired');
  if (ahk && !ahk.value?.remove) {
    push(/ahk/i.test(String(ahk.label || '')) ? 'Anhängerkupplung' : (ahk.label || 'Anhängerkupplung'));
  }
  return parts.length ? parts.join(' · ') : null;
}

function formatCurrentVehicleLine(facts = [], lead = null) {
  const existing = pickFact(facts, 'existingVehicle');
  const crm = lead?.crm?.existingVehicle || null;
  const make = existing?.value?.make || crm?.make || null;
  const model = existing?.value?.model || crm?.model || null;
  const color = existing?.value?.color || crm?.color || null;
  const label = [make, model].filter(Boolean).join(' ')
    || (existing?.label ? String(existing.label).replace(/\s*·\s*.*$/, '').trim() : null)
    || crm?.label
    || null;
  if (!label) return null;
  const colorLabel = color ? String(color).toLowerCase() : null;
  return [label, colorLabel].filter(Boolean).join(' · ');
}

function formatPlannedLine(facts = [], lead = null) {
  const deadline = pickFact(facts, 'deliveryDeadline');
  const endDate = deadline?.value?.endDate
    || lead?.wish?.desiredDeliveryDate
    || null;
  if (!endDate) return null;
  const m = String(endDate).match(/^(20\d{2})-(\d{2})(?:-\d{2})?$/);
  if (m) {
    const monthLabel = MONTH_LABELS[m[2]] || m[2];
    return `${monthLabel} ${m[1]}`;
  }
  return String(deadline?.label || endDate).replace(/^Geplant\s+/i, '');
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

function resolveNextStepLabel(params = {}) {
  const facts = Array.isArray(params.facts) ? params.facts : [];
  const draft = params.draft || null;
  const nextHint = params.nextStepHint || null;
  const hasModel = Boolean(
    pickFact(facts, 'vehicleInterest')?.value?.modelKey
    || draft?.vehicleIdentityDraft?.modelKey
    || draft?.modelKey
  );
  const fuel = pickFact(facts, 'fuelPreference');
  const isElectric = fuel?.value === 'electric'
    || fuel?.value === 'elektro'
    || fuel?.value === 'bev'
    || /elektro/i.test(String(fuel?.label || ''));

  const presented = presentIntakeNextStepLabel(nextHint);
  if (presented) return presented;

  if (!hasModel && (isElectric || pickFact(facts, 'childrenCount') || pickFact(facts, 'existingVehicle'))) {
    return 'Passende Fahrzeuge finden';
  }
  if (nextHint?.cta === 'Angebot' || /angebot/i.test(String(nextHint?.label || ''))) {
    return 'Angebot vorbereiten';
  }
  return nextHint?.label || 'Angebot vorbereiten';
}

/**
 * @param {{
 *   facts?: object[],
 *   draft?: object|null,
 *   lead?: object|null,
 *   nextStepHint?: object|null,
 * }} params
 * @returns {{
 *   sections: object,
 *   lines: string[],
 *   text: string,
 *   source: 'structured_facts',
 * }}
 */
export function buildSellerWorkBriefing(params = {}) {
  const facts = Array.isArray(params.facts) ? params.facts : [];
  const draft = params.draft || null;
  const lead = params.lead || null;
  const hasModel = Boolean(
    pickFact(facts, 'vehicleInterest')?.value?.modelKey
    || draft?.vehicleIdentityDraft?.modelKey
    || draft?.modelKey
  );
  const nextHint = params.nextStepHint || buildCaptureNextStepHint({
    hasActiveTrack: Boolean(lead?.crm?.focusedVehicleTrackId),
    trackCount: Array.isArray(lead?.crm?.vehicleConfigurations)
      ? lead.crm.vehicleConfigurations.length
      : 0,
    hasVehicleModel: hasModel,
    fuelPreference: pickFact(facts, 'fuelPreference')?.value || null,
    needsConsultation: !hasModel,
  });

  const customerPicture = formatCustomerPicture(facts, lead);
  const sought = formatSoughtLine(facts, draft);
  const customerWants = formatVehicleLine(facts, draft);
  const leasingWish = formatLeasingLine(facts, lead);
  const important = formatImportantLine(facts);
  const extras = formatExtrasLine(facts);
  const currentVehicle = formatCurrentVehicleLine(facts, lead);
  const planned = formatPlannedLine(facts, lead);
  const toClarify = formatClarifyLine(facts, draft);
  const nextStep = resolveNextStepLabel({ facts, draft, nextStepHint: nextHint });

  const lines = [];
  if (customerPicture) {
    lines.push('Kundenbild:');
    lines.push(customerPicture);
  }
  if (sought) {
    if (lines.length) lines.push('');
    lines.push('Gesucht:');
    lines.push(sought);
  }
  if (customerWants) {
    if (lines.length) lines.push('');
    lines.push('Kunde möchte:');
    lines.push(customerWants);
  }
  if (leasingWish) {
    if (lines.length) lines.push('');
    lines.push('Leasingwunsch:');
    lines.push(leasingWish);
  }
  if (important && !customerWants) {
    // Need-Consultation: Ausstattung als „Wichtig“, nicht im Fahrzeug-Chip
    if (lines.length) lines.push('');
    lines.push('Wichtig:');
    lines.push(important);
  }
  if (extras) {
    if (lines.length) lines.push('');
    lines.push('Zusätzlich:');
    lines.push(extras);
  }
  if (currentVehicle) {
    if (lines.length) lines.push('');
    lines.push('Aktuelles Fahrzeug:');
    lines.push(currentVehicle);
  }
  if (planned) {
    if (lines.length) lines.push('');
    lines.push('Geplant:');
    lines.push(planned);
  }
  if (toClarify) {
    if (lines.length) lines.push('');
    lines.push('Noch zu klären:');
    lines.push(toClarify);
  }
  lines.push('');
  lines.push('Nächster Schritt:');
  lines.push(nextStep);

  return {
    sections: {
      customerPicture,
      sought,
      customerWants,
      leasingWish,
      important,
      extras,
      currentVehicle,
      planned,
      toClarify,
      nextStep,
    },
    lines,
    text: lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim(),
    source: 'structured_facts',
  };
}
