/**
 * Verkäufer-Arbeitsgrundlage aus bereits strukturierten Facts/Draft/OpenQuestions.
 * Lead-first: nach Reload aus NeedProfile/wish/tracks reproduzierbar.
 * Keine zweite KI-Wahrheit – nur Formatierung vorhandener Slots.
 */
import { buildCaptureNextStepHint } from './captureThenOffer.js';
import { presentIntakeNextStepLabel } from './presentSellerIntakeFeedback.js';
import {
  determineNextBestSellerAction,
  hasCustomerOfferCommitment,
  resolvePostCommitOpenWork,
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
  dc_fast_charging: 'gute DC-Ladeleistung',
};

function resolveDraft(lead, draft) {
  if (draft?.vehicleIdentityDraft || draft?.modelKey) return draft;
  return resolveActiveOfferDraft({ lead, workingMemory: lead?.crm?.cleverWorkingState })
    || lead?.crm?.cleverWorkingState?.currentOfferDraft
    || draft
    || null;
}

function formatVehicleLine(facts = [], draft = null, lead = null) {
  const multi = pickFact(facts, 'vehicleInterestMulti');
  if (
    Array.isArray(multi?.value)
    && multi.value.length >= 2
    && !multi.consultationCandidates
  ) {
    const bits = multi.value.map((item) => {
      if (!item || typeof item !== 'object') {
        return String(item || '').replace(/^kia\s+/i, '').toUpperCase();
      }
      const key = String(item.modelKey || item.model || '').replace(/^kia\s+/i, '');
      const model = /^ev\d$/i.test(key) || /^pv\d$/i.test(key)
        ? key.toUpperCase()
        : titleCaseWords(key);
      const trim = item.trim ? String(item.trim) : null;
      const qty = item.quantity != null && Number(item.quantity) > 0
        ? `${Number(item.quantity)}×`
        : null;
      return [qty, model, trim].filter(Boolean).join(' ');
    }).filter(Boolean);
    if (bits.length >= 2) {
      const batt = pickFact(facts, 'batteryPreference');
      const battLabel = batt?.value?.id === 'large' || /groß/i.test(String(batt?.label || ''))
        ? 'große Batterie'
        : null;
      return [...bits, battLabel].filter(Boolean).join(' · ');
    }
  }

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
  const batteryVariantsFact = pickFact(facts, 'batteryVariantWishes');
  const batteryVariantsFromProfile = Array.isArray(lead?.crm?.needProfile?.batteryVariantWishes)
    ? lead.crm.needProfile.batteryVariantWishes
    : null;
  const batteryVariantLabels = (
    Array.isArray(batteryVariantsFact?.value) ? batteryVariantsFact.value : batteryVariantsFromProfile
  )
    ?.map((v) => (typeof v === 'object' ? (v.label || null) : String(v || '')))
    .filter(Boolean)
    || [];
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

  const fuelFact = pickFact(facts, 'fuelPreference');
  const fuelLabel = fuelFact?.value === 'diesel' || /diesel/i.test(String(fuelFact?.label || ''))
    ? 'Diesel'
    : (fuelFact?.value === 'petrol' || /benzin/i.test(String(fuelFact?.label || ''))
      ? 'Benzin'
      : null);
  const gearFact = pickFact(facts, 'transmissionPreference');
  const gearLabel = gearFact?.value === 'manual' || /manuell|schalter/i.test(String(gearFact?.label || ''))
    ? 'Manuell'
    : (gearFact?.value === 'automatic' || /automatik/i.test(String(gearFact?.label || ''))
      ? 'Automatik'
      : null);

  const modelLabel = model
    ? String(model).replace(/^Kia\s+/i, '').replace(/\s+/g, ' ').trim()
    : null;
  // Beratungsfall / Need ohne Fokusmodell: keine Fake-„Kunde möchte“-Zeile nur aus Ausstattung
  if (!modelLabel && !modelKey) return null;
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

  return [modelLabel, trimPart, fuelLabel, gearLabel, color, ...batteryVariantLabels, ...uniqEquip].filter(Boolean).join(' · ') || null;
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
  const purchase = pickFact(facts, 'purchasePrice');
  const financeWish = pickFact(facts, 'financeWish');

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

  const termVariants = pickFact(facts, 'termMonthsVariants')
    || (Array.isArray(lead?.crm?.needProfile?.termMonthsVariants)
      ? { value: lead.crm.needProfile.termMonthsVariants }
      : null);
  if (Array.isArray(termVariants?.value) && termVariants.value.length >= 2) {
    // Ersetzt Einzel-Laufzeit in der Zeile
    const idx = parts.findIndex((p) => /\d+\s*Monate/i.test(String(p)));
    const label = termVariants.value.map((n) => `${Number(n)} Monate`).join(' sowie ');
    if (idx >= 0) parts[idx] = label;
    else parts.push(label);
  }

  const mileageVariants = pickFact(facts, 'annualMileageVariants')
    || (Array.isArray(lead?.crm?.needProfile?.annualMileageVariants)
      ? { value: lead.crm.needProfile.annualMileageVariants }
      : null);
  if (Array.isArray(mileageVariants?.value) && mileageVariants.value.length >= 2) {
    parts.push(
      mileageVariants.value
        .map((n) => `${Number(n).toLocaleString('de-DE')} km/Jahr`)
        .join(' sowie '),
    );
  } else {
    const mileage = km?.value ?? wish.mileagePerYear ?? wish.annualMileage ?? null;
    if (mileage != null && Number(mileage) > 0) {
      parts.push(`${Number(mileage).toLocaleString('de-DE')} km/Jahr`);
    }
  }

  const az = down?.value ?? wish.downPayment ?? null;
  if (purchase?.value != null && Number.isFinite(Number(purchase.value))) {
    parts.push(purchase.label || `bis ${Number(purchase.value).toLocaleString('de-DE')} €`);
  } else if (az != null && az !== '' && Number.isFinite(Number(az))) {
    parts.push(
      Number(az) === 0
        ? '0 € Anzahlung'
        : `${Number(az).toLocaleString('de-DE')} € Sonderzahlung`,
    );
  }

  const budget = pickFact(facts, 'monthlyBudget');
  const budgetVal = budget?.value ?? lead?.crm?.needProfile?.budget?.maxMonthlyRate ?? null;
  if (budgetVal != null && Number.isFinite(Number(budgetVal))) {
    parts.push(`max. ${Number(budgetVal).toLocaleString('de-DE')} €/Monat`);
  }

  if (financeWish?.label) {
    parts.push(String(financeWish.label));
  } else if (lead?.crm?.needProfile?.financeWish) {
    parts.push('möglichst niedriger effektiver Jahreszins');
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

  const rangeFact = pickFact(facts, 'rangeNeed');
  if (rangeFact?.value?.km != null) {
    push(rangeFact.label || `ca. ${rangeFact.value.km} km Reichweite`);
  } else if (lead?.crm?.needProfile?.rangeKmMin != null) {
    push(`ca. ${lead.crm.needProfile.rangeKmMin} km Reichweite`);
  }

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

  const leaseScenarios = pickFact(facts, 'leaseCalcScenarioWishes')
    || (Array.isArray(lead?.crm?.needProfile?.leaseCalcScenarioWishes)
      ? { value: lead.crm.needProfile.leaseCalcScenarioWishes }
      : null);
  if (Array.isArray(leaseScenarios?.value)) {
    for (const s of leaseScenarios.value) {
      const label = typeof s === 'object' ? s.label : String(s || '');
      if (label) push(label);
    }
  }

  const totalMileageWishes = pickFact(facts, 'leaseTotalMileageWishes')
    || (Array.isArray(lead?.crm?.needProfile?.leaseTotalMileageWishes)
      ? { value: lead.crm.needProfile.leaseTotalMileageWishes }
      : null);
  if (Array.isArray(totalMileageWishes?.value)) {
    for (const s of totalMileageWishes.value) {
      const label = typeof s === 'object' ? s.label : String(s || '');
      if (label) push(label);
    }
  }

  const battPref = pickFact(facts, 'batteryPreference');
  if (battPref?.value?.id === 'large' || /groß/i.test(String(battPref?.label || ''))) {
    push('große Batterie');
  }

  const onBehalf = pickFact(facts, 'onBehalfOf') || lead?.crm?.needProfile?.onBehalfOf;
  if (onBehalf) {
    const name = typeof onBehalf === 'object'
      ? (onBehalf.value?.name || onBehalf.name || onBehalf.label)
      : onBehalf;
    const place = typeof onBehalf === 'object'
      ? (onBehalf.value?.place || onBehalf.place || null)
      : null;
    if (name) {
      push(place
        ? `Im Auftrag von ${String(name).replace(/^Im Auftrag von\s+/i, '')} (${place})`
        : (String(name).startsWith('Im Auftrag') ? String(name) : `Im Auftrag von ${name}`));
    }
  }

  const abruf = pickFact(facts, 'abrufschein') || lead?.crm?.needProfile?.abrufschein;
  if (abruf) push('Abrufschein');

  const condition = pickFact(facts, 'vehicleConditionPreference')
    || lead?.crm?.needProfile?.vehicleConditionPreference;
  if (condition?.value?.usedOk || condition?.usedOk) {
    push('Muss kein Neuwagen sein');
  } else if (condition?.label) {
    push(String(condition.label));
  }

  const subsidy = pickFact(facts, 'subsidyEligibility')
    || lead?.crm?.needProfile?.subsidyEligibility;
  if (subsidy?.value?.eligible === false || subsidy?.eligible === false) {
    push('Nicht für Bundesförderung berechtigt');
  } else if (subsidy?.label && /nicht/i.test(String(subsidy.label))) {
    push(String(subsidy.label));
  }

  const pastInquiry = pickFact(facts, 'pastVehicleInquiry')
    || lead?.crm?.needProfile?.pastVehicleInquiry;
  if (pastInquiry?.label || pastInquiry?.value?.modelKey) {
    push(pastInquiry.label || `Früherer Kontakt: ${String(pastInquiry.value?.modelKey || '').toUpperCase()}`);
  }

  const availability = pickFact(facts, 'availabilityPreference');
  if (availability?.label) push(availability.label);

  // Lead-first: NeedProfile-Ausstattung
  const profile = lead?.crm?.needProfile || {};
  for (const wishId of profile.equipmentWishes || []) {
    const id = String(wishId);
    if (/^(winter_tires|winter_wheel_set)$/i.test(id)) continue;
    push(EQUIPMENT_ID_LABEL[id] || (/wärm|heat/i.test(id) ? 'Wärmepumpe' : (
      /dc_fast/i.test(id) ? 'gute DC-Ladeleistung' : id
    )));
  }
  if (profile.towbar === true) push('Anhängerkupplung');
  if ((profile.priorities || []).includes('towing')) push('Anhängerkupplung');
  for (const label of profile.understoodLabels || []) {
    if (/kurzfristig|reichweite|dc-?lade/i.test(String(label))) push(String(label));
  }

  return parts.length ? parts.join(' · ') : null;
}

function formatCandidatesLine(facts = [], lead = null) {
  const multi = pickFact(facts, 'vehicleInterestMulti');
  if (multi?.consultationCandidates || multi?.label) {
    if (multi.consultationCandidates || lead?.crm?.needProfile?.consultationPending) {
      return String(multi.label || '') || null;
    }
  }
  const keys = lead?.crm?.needProfile?.modelCandidates || [];
  if (!keys.length || lead?.crm?.needProfile?.selectedModelKey) return null;
  const labels = {
    niro: 'Niro EV',
    kona: 'Kona Elektro',
    'renault-4-5': 'Renault 4/5',
  };
  return keys.map((k) => labels[String(k).toLowerCase()] || String(k)).join(' · ');
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
    else if (topic === 'subsidy') push(q.label || 'Förderung 2026');
    else if (topic === 'hsn_tsn') push(q.label || 'HSN/TSN je Konfiguration mitteilen');
    else if (topic === 'excess_mileage') push(q.label || '20.000 km / Mehrkilometer-Kosten');
    else if (topic === 'finance_with_return') push(q.label || 'Finanzierung mit Rückgaberecht');
    else if (topic === 'delivery_times') push(q.label || 'Lieferzeiten mitteilen');
    else if (topic === 'fleet_terms') push(q.label || 'Flottenkonditionen');
    else if (topic === 'quote_on_basis') {
      continue;
    } else if (q.label) {
      push(String(q.label).replace(/\s*erfragen\s*$/i, '').trim());
    }
  }

  const attachmentFact = pickFact(facts, 'attachmentContext');
  const attachmentFromProfile = lead?.crm?.needProfile?.attachmentContext;
  if (attachmentFact?.label) {
    push('Konfigurationen aus Anhang prüfen');
  } else if (attachmentFromProfile?.kind === 'configuration_expected' || attachmentFromProfile?.label) {
    push('Konfigurationen aus Anhang prüfen');
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
      const base = String(f.label).replace(/\s*·.*$/, '').trim();
      // Label kann schon „… prüfen“ tragen (Alias/Katalog) – nicht verdoppeln
      push(/\bprüfen\s*$/i.test(base) ? base : `${base} prüfen`);
    }
  }

  // Lead: offene Labels aus NeedProfile (Förderung / HSN / Anhang)
  for (const label of lead?.crm?.needProfile?.understoodLabels || []) {
    if (/förder|farbe\s*prüfen|überführung|hsn|tsn|konfiguration.*anhang|anhang.*prüfen/i.test(String(label))) {
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
  const modelCandidates = formatCandidatesLine(facts, lead);
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
      modelCandidates,
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

  const committed = hasCustomerOfferCommitment(lead);
  const postCommitWork = committed ? resolvePostCommitOpenWork(lead) : null;
  let dealStatus = null;
  let openWorkLine = null;
  if (committed) {
    dealStatus = 'Kunde hat zugesagt';
    const openBits = [];
    if (postCommitWork?.documentsIncomplete) openBits.push('Unterlagen');
    if (postCommitWork?.selfDisclosureIncomplete) openBits.push('Selbstauskunft');
    if (!openBits.length && nextBestAction?.handler === 'application_prepare') {
      openBits.push('Antrag / Abschluss');
    }
    openWorkLine = openBits.length ? openBits.join(' / ') : null;
  }

  const lines = [];
  if (dealStatus) {
    lines.push('Stand:');
    lines.push(dealStatus);
    if (openWorkLine) {
      lines.push('');
      lines.push('Noch offen:');
      lines.push(openWorkLine);
    }
  }
  if (customerPicture) {
    if (lines.length) lines.push('');
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
    const pay = pickFact(facts, 'paymentType')?.value || lead?.wish?.paymentType;
    lines.push(
      pay === 'financing' ? 'Finanzierung:'
        : pay === 'cash' ? 'Kauf:'
          : 'Leasing:',
    );
    lines.push(leasingWish);
  }
  if (important) {
    if (lines.length) lines.push('');
    lines.push('Wichtig:');
    lines.push(important);
  }
  if (modelCandidates) {
    if (lines.length) lines.push('');
    lines.push('Interessante Modelle:');
    lines.push(modelCandidates);
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
      dealStatus,
      openWork: openWorkLine,
      customerPicture,
      sought,
      customerWants,
      leasingWish,
      important,
      modelCandidates,
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

/**
 * Kompakte Eingangs-Vorschau für Beratungsfälle (bestehende Clever-Eingang-Fläche).
 * Keine neue Inbox-Architektur.
 */
export function buildConsultationCasePreview(lead = {}, facts = []) {
  const profile = lead?.crm?.needProfile || {};
  const candidates = profile.modelCandidates || [];
  const consultation = profile.consultationPending === true
    || (candidates.length > 0 && !profile.selectedModelKey);
  if (!consultation) return null;

  const name = lead?.contact?.name || lead?.name || null;
  const fuel = profile.fuel === 'electric' ? 'Elektro' : null;
  const payment = lead?.wish?.paymentType === 'financing'
    ? 'Finanzierung'
    : (lead?.wish?.paymentType === 'leasing' ? 'Leasing' : null);
  const contextLine = [fuel, payment].filter(Boolean).join(' · ') || null;

  const seekBits = [];
  if (profile.rangeKmMin) seekBits.push(`${profile.rangeKmMin} km+`);
  for (const id of profile.equipmentWishes || []) {
    if (id === 'heat_pump') seekBits.push('Wärmepumpe');
    if (id === 'dc_fast_charging') seekBits.push('DC-Laden');
  }
  for (const label of profile.understoodLabels || []) {
    if (/kurzfristig/i.test(String(label))) seekBits.push('kurzfristig verfügbar');
  }

  const labelMap = {
    niro: 'Niro EV',
    kona: 'Kona Elektro',
    'renault-4-5': 'Renault 4/5',
  };
  const interestBits = candidates.map((k) => labelMap[String(k).toLowerCase()] || String(k));
  if (/\bvergleichbar/i.test(String(profile.understoodLabels?.join(' ') || ''))) {
    interestBits.push('vergleichbar');
  } else if (interestBits.length) {
    interestBits.push('vergleichbar');
  }

  const openBits = [];
  for (const label of profile.understoodLabels || []) {
    if (/förder/i.test(String(label))) openBits.push('Förderung 2026');
  }

  return {
    name,
    contextLine,
    seeksLine: seekBits.length ? seekBits.join(' · ') : null,
    interestLine: interestBits.length ? interestBits.join(' · ') : null,
    openLine: openBits.length ? [...new Set(openBits)].join(' · ') : null,
    primaryAction: 'Kundenakte öffnen',
    secondaryAction: 'Passende Fahrzeuge finden',
    offerAction: null,
  };
}
