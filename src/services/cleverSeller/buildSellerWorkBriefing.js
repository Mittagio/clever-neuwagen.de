/**
 * Verkäufer-Arbeitsgrundlage aus bereits strukturierten Facts/Draft/OpenQuestions.
 * Lead-first: nach Reload aus NeedProfile/wish/tracks reproduzierbar.
 * Keine zweite KI-Wahrheit – nur Formatierung vorhandener Slots.
 */
import { buildCaptureNextStepHint } from './captureThenOffer.js';
import { presentIntakeNextStepLabel } from './presentSellerIntakeFeedback.js';
import {
  determineNextBestSellerAction,
  resolveConcreteVehicleModel,
} from './determineNextBestSellerAction.js';
import { listCustomerVehicleTracks } from '../crm/vehicleTrack.js';
import { resolveActiveOfferDraft } from './cleverWorkingDraft.js';

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

const EQUIPMENT_ID_LABEL = {
  heat_pump: 'Wärmepumpe',
  towbar: 'Anhängerkupplung',
  ahk: 'Anhängerkupplung',
  seat_heating: 'Sitzheizung',
  steering_wheel_heating: 'Lenkradheizung',
  winter_tires: 'Winterreifen',
  winter_wheel_set: 'Winterradsatz',
};

function resolveDraft(lead, draft) {
  if (draft?.vehicleIdentityDraft || draft?.modelKey) return draft;
  return resolveActiveOfferDraft({ lead, workingMemory: lead?.crm?.cleverWorkingState })
    || lead?.crm?.cleverWorkingState?.currentOfferDraft
    || draft
    || null;
}

function formatVehicleLine(facts = [], draft = null, lead = null) {
  const interest = pickFact(facts, 'vehicleInterest');
  const modelFromLead = resolveConcreteVehicleModel(lead, lead?.crm?.cleverWorkingState);
  const modelKey = interest?.value?.modelKey
    || draft?.vehicleIdentityDraft?.modelKey
    || modelFromLead?.modelKey
    || null;
  const model = interest?.value?.model
    || draft?.vehicleIdentityDraft?.model?.canonical
    || draft?.vehicleIdentityDraft?.model?.raw
    || (modelKey ? String(modelKey).toUpperCase() : null);

  const motorFact = pickFact(facts, 'motorPreference') || pickFact(facts, 'batteryPreference');
  const motorFromFact = motorFact?.value?.label
    || motorFact?.value?.hint
    || motorFact?.label
    || null;
  const motorFromProfile = lead?.crm?.needProfile?.motorPreference || null;
  const powertrainFromDraft = draft?.vehicleIdentityDraft?.powertrain?.canonical
    || draft?.vehicleIdentityDraft?.powertrain?.raw
    || null;
  const tracks = listCustomerVehicleTracks(lead) || [];
  const trackForModel = modelKey
    ? tracks.find((t) => String(t.modelKey || '').toLowerCase() === String(modelKey).toLowerCase())
    : null;
  const track = trackForModel || tracks[0] || null;
  const motorFromTrack = (track?.customerRequirements || []).find((r) => (
    /long\s*range|standard\s*range|extended\s*range/i.test(String(r || ''))
  )) || null;

  const trim = interest?.value?.trim
    || draft?.vehicleIdentityDraft?.trim?.canonical
    || draft?.vehicleIdentityDraft?.trim?.raw
    || modelFromLead?.trim
    || track?.trim
    || track?.trimLabel
    || powertrainFromDraft
    || motorFromFact
    || motorFromProfile
    || motorFromTrack
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
  const trimPart = trim && modelLabel && !new RegExp(String(trim).replace(/\s+/g, '\\s*'), 'i').test(modelLabel)
    ? String(trim).trim()
    : (trim && !modelLabel ? String(trim).trim() : null);

  const equip = pickFacts(facts, 'equipmentWish')
    .filter((f) => !['winter_tires', 'winter_wheel_set'].includes(f.value?.id))
    .map((f) => String(f.value?.label || f.label || '').trim())
    .filter(Boolean)
    // Powertrain gehört in Trim-Slot, nicht als Ausstattungs-Chip
    .filter((label) => !/long\s*range|standard\s*range/i.test(label));

  const uniqEquip = [];
  for (const label of equip) {
    if (uniqEquip.some((x) => x.toLowerCase() === label.toLowerCase())) continue;
    if (/^winterpaket$/i.test(label) && uniqEquip.some((x) => /winter-?paket/i.test(x))) continue;
    uniqEquip.push(label);
  }

  return [modelLabel, trimPart, color, ...uniqEquip].filter(Boolean).join(' · ') || null;
}

function formatCustomerPicture(facts = [], lead = null) {
  const parts = [];
  const profile = lead?.crm?.needProfile || {};
  const children = pickFact(facts, 'childrenCount');
  const childrenVal = children?.value
    ?? profile?.household?.childrenCount
    ?? profile?.children
    ?? null;
  if (childrenVal != null && Number(childrenVal) > 0) {
    parts.push(`${Number(childrenVal)} Kinder`);
  }

  const pet = pickFact(facts, 'pet') || pickFact(facts, 'hasPet');
  const dog = profile?.dog === true
    || pet?.value?.type === 'dog'
    || /hund/i.test(String(pet?.label || ''));
  if (dog) parts.push('Hund');
  else if (pet?.value?.type === 'cat' || /katze/i.test(String(pet?.label || ''))) {
    parts.push('Katze');
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatSoughtLine(facts = [], draft = null, lead = null) {
  if (
    pickFact(facts, 'vehicleInterest')?.value?.modelKey
    || draft?.vehicleIdentityDraft?.modelKey
    || resolveConcreteVehicleModel(lead, lead?.crm?.cleverWorkingState)?.modelKey
  ) {
    return null;
  }
  const fuel = pickFact(facts, 'fuelPreference');
  const fuelVal = fuel?.value || lead?.crm?.needProfile?.fuel || null;
  if (fuelVal === 'electric' || fuelVal === 'elektro' || fuelVal === 'bev'
    || /elektro/i.test(String(fuel?.label || ''))) {
    return 'Elektrofahrzeug';
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

  const mileage = km?.value ?? wish.mileagePerYear ?? wish.annualMileage ?? null;
  if (mileage != null && Number(mileage) > 0) {
    parts.push(`${Number(mileage).toLocaleString('de-DE')} km/Jahr`);
  }

  const az = down?.value ?? wish.downPayment ?? null;
  if (az != null && az !== '' && Number.isFinite(Number(az))) {
    parts.push(`${Number(az).toLocaleString('de-DE')} € Sonderzahlung`);
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatImportantLine(facts = [], lead = null) {
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

  // Lead-first: NeedProfile-Ausstattung
  const profile = lead?.crm?.needProfile || {};
  for (const wishId of profile.equipmentWishes || []) {
    const id = String(wishId);
    if (/^(winter_tires|winter_wheel_set)$/i.test(id)) continue;
    push(EQUIPMENT_ID_LABEL[id] || (/wärm|heat/i.test(id) ? 'Wärmepumpe' : id));
  }
  if (profile.towbar === true) push('Anhängerkupplung');
  if ((profile.priorities || []).includes('towing')) push('Anhängerkupplung');

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

function formatClarifyLine(facts = [], draft = null, lead = null) {
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

  // Lead: offene Labels aus NeedProfile (Förderung etc.)
  for (const label of lead?.crm?.needProfile?.understoodLabels || []) {
    if (/förder|farbe\s*prüfen|überführung/i.test(String(label))) {
      push(String(label).replace(/\s*erfragen\s*$/i, '').trim());
    }
  }

  return parts.length ? parts.join(' · ') : null;
}

function resolveNextStepLabel(params = {}) {
  const nextBest = params.nextBestAction || null;
  if (nextBest?.label) return nextBest.label;

  const facts = Array.isArray(params.facts) ? params.facts : [];
  const draft = params.draft || null;
  const lead = params.lead || null;
  const nextHint = params.nextStepHint || null;
  const hasModel = Boolean(
    pickFact(facts, 'vehicleInterest')?.value?.modelKey
    || draft?.vehicleIdentityDraft?.modelKey
    || resolveConcreteVehicleModel(lead, lead?.crm?.cleverWorkingState)?.modelKey
  );
  const fuel = pickFact(facts, 'fuelPreference');
  const isElectric = fuel?.value === 'electric'
    || fuel?.value === 'elektro'
    || fuel?.value === 'bev'
    || lead?.crm?.needProfile?.fuel === 'electric'
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
 *   workingState?: object|null,
 *   portalState?: object|null,
 *   nextBestAction?: object|null,
 * }} params
 * @returns {{
 *   sections: object,
 *   lines: string[],
 *   text: string,
 *   source: 'structured_facts',
 *   nextBestAction: object|null,
 * }}
 */
export function buildSellerWorkBriefing(params = {}) {
  const facts = Array.isArray(params.facts) ? params.facts : [];
  const lead = params.lead || null;
  const draft = resolveDraft(lead, params.draft || null);
  const workingState = params.workingState || lead?.crm?.cleverWorkingState || null;
  const modelInfo = resolveConcreteVehicleModel(lead, workingState);
  const hasModel = Boolean(
    pickFact(facts, 'vehicleInterest')?.value?.modelKey
    || draft?.vehicleIdentityDraft?.modelKey
    || draft?.modelKey
    || modelInfo?.modelKey
  );
  const nextHint = params.nextStepHint || buildCaptureNextStepHint({
    hasActiveTrack: Boolean(lead?.crm?.focusedVehicleTrackId),
    trackCount: listCustomerVehicleTracks(lead).length
      || (Array.isArray(lead?.crm?.vehicleConfigurations)
        ? lead.crm.vehicleConfigurations.length
        : 0),
    hasVehicleModel: hasModel,
    fuelPreference: pickFact(facts, 'fuelPreference')?.value
      || lead?.crm?.needProfile?.fuel
      || null,
    needsConsultation: !hasModel,
  });

  const customerPicture = formatCustomerPicture(facts, lead);
  const sought = formatSoughtLine(facts, draft, lead);
  const customerWants = formatVehicleLine(facts, draft, lead);
  const leasingWish = formatLeasingLine(facts, lead);
  const important = formatImportantLine(facts, lead);
  const extras = formatExtrasLine(facts);
  const currentVehicle = formatCurrentVehicleLine(facts, lead);
  const planned = formatPlannedLine(facts, lead);
  const toClarify = formatClarifyLine(facts, draft, lead);

  // Partial sections for NBA (toClarify blockiert nicht)
  const partialBriefing = {
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
    },
  };

  const nextBestAction = params.nextBestAction
    || determineNextBestSellerAction({
      lead,
      workBriefing: partialBriefing,
      workingState,
      portalState: params.portalState || null,
      draft,
      facts,
    });

  const nextStep = resolveNextStepLabel({
    facts,
    draft,
    lead,
    nextStepHint: nextHint,
    nextBestAction,
  });

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
    lines.push('Leasing:');
    lines.push(leasingWish);
  }
  if (important && !customerWants) {
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
    lines.push('Aktuell:');
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
    nextBestAction,
  };
}
