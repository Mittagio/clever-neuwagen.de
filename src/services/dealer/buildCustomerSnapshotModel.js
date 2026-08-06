/**
 * Kundenbild – kompaktes Snapshot-Modell aus bestätigter Customer Truth.
 * Nur Lead-Daten (needProfile, sellerInsights, wish, tradeIn, tracks).
 * Working Context / Offer-PDF-Konditionen fließen nicht als Wunsch ein.
 */
import { getNeedProfileFromLead, modelDisplayLabel } from '../consultation/needProfileService.js';
import { getSellerInsightsFromLead } from './sellerInsights.js';
import { buildCustomerUnderstanding } from './customerUnderstanding.js';
import { getTradeIn } from '../customerAkteTradeIn.js';
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
} from '../crm/vehicleTrack.js';

/** Display-Gruppen (feste Reihenfolge). */
export const SNAPSHOT_GROUP = {
  BEDARF: 'bedarf',
  BESTAND: 'bestand',
  BUDGET_VERTRAG: 'budget_vertrag',
  WUNSCH: 'wunsch',
};

/** Tint-/Fakten-Kategorien (Budget ≠ Vertrag für Soft-Tint). */
export const SNAPSHOT_TINT = {
  ALLTAG: 'alltag',
  BUDGET: 'budget',
  VERTRAG: 'vertrag',
  FAHRZEUG: 'fahrzeug',
  INZAHLUNGNAHME: 'inzahlungnahme',
};

export const SNAPSHOT_GROUP_TITLE = {
  [SNAPSHOT_GROUP.BEDARF]: 'Alltag und Bedarf',
  [SNAPSHOT_GROUP.BESTAND]: 'Bestandsfahrzeug',
  [SNAPSHOT_GROUP.BUDGET_VERTRAG]: 'Budget und Vertrag',
  [SNAPSHOT_GROUP.WUNSCH]: 'Fahrzeugwunsch',
};

/** Primärer editKey je Display-Gruppe (Fallback). */
export const SNAPSHOT_GROUP_EDIT_KEY = {
  [SNAPSHOT_GROUP.BEDARF]: 'bedarf',
  [SNAPSHOT_GROUP.BESTAND]: 'tradeIn',
  [SNAPSHOT_GROUP.BUDGET_VERTRAG]: 'desiredRate',
  [SNAPSHOT_GROUP.WUNSCH]: 'vehicleTrack',
};

/** Mini-Editor Keys (feld-spezifisch, kein generisches Offen-Sheet). */
export const SNAPSHOT_MINI_EDITOR = {
  DESIRED_RATE: 'desiredRate',
  CHILDREN: 'children',
  TERM_MONTHS: 'termMonths',
  MILEAGE: 'mileagePerYear',
  COLOR: 'preferredColor',
  PRIORITY_DELIVERY: 'delivery',
  TRADE_IN: 'tradeInYesNo',
  DOG: 'dog',
  PAYMENT_TYPE: 'paymentType',
  DOWN_PAYMENT: 'downPayment',
};

export const SNAPSHOT_RATE_MODES = {
  APPROX: 'approx',
  MAX: 'max',
  TARGET: 'target',
};

export const SNAPSHOT_RATE_MODE_LABELS = {
  [SNAPSHOT_RATE_MODES.APPROX]: 'ungefähr',
  [SNAPSHOT_RATE_MODES.MAX]: 'maximal',
  [SNAPSHOT_RATE_MODES.TARGET]: 'Zielrate',
};

/** Max. Tokens in der eingeklappten Summary-Zeile (Rest als +N). */
export const SNAPSHOT_SUMMARY_MAX_TOKENS = 5;

/** ~2–3 Chip-Zeilen Mobile, Rest hinter „+ N weitere“. */
export const SNAPSHOT_EXPANDED_VISIBLE_CHIPS = 8;

const USAGE_LABELS = {
  erstwagen: 'Erstwagen',
  zweitwagen: 'Zweitwagen',
  zugfahrzeug: 'Zugfahrzeug',
  pendeln: 'Pendeln',
  urlaub: 'Urlaub',
  langstrecke: 'Langstrecke',
  kinderwagen: 'Kinderwagen',
  stadt: 'Stadt',
};

const EQUIPMENT_LABELS = {
  heat_pump: 'Wärmepumpe',
  camera_360: '360°-Kamera',
  head_up_display: 'HUD',
  matrix_led: 'Matrix-LED',
  v2l: 'V2L',
  tinting: 'Tönung',
  panorama_roof: 'Panoramadach',
  heated_seats: 'Sitzheizung',
  rear_seat_heat: 'Fond-Heizung',
  power_tailgate: 'Heckklappe el.',
  large_navi: 'Großes Navi',
  large_trunk: 'Großer Kofferraum',
};

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  financing: 'Finanzierung',
  threeWayFinancing: 'Finanzierung',
  cash: 'Kauf',
};

/**
 * @param {object} fact
 */
function fact(id, label, {
  editKey = null,
  relevanceKey = null,
  groupId,
  tint = null,
  miniEditor = null,
  summaryPriority = 50,
} = {}) {
  const text = String(label ?? '').trim();
  if (!text) return null;
  const category = tint || SNAPSHOT_TINT.ALLTAG;
  return {
    id,
    label: text,
    editKey,
    relevanceKey: relevanceKey || editKey || id,
    groupId,
    tint: category,
    category,
    miniEditor,
    summaryPriority,
  };
}

function pushFact(list, item) {
  if (!item) return;
  if (list.some((f) => f.id === item.id || f.label === item.label)) return;
  list.push(item);
}

function formatEuroApprox(amount, rateMode = null) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  const base = `${Math.round(num).toLocaleString('de-DE')} €`;
  if (rateMode === SNAPSHOT_RATE_MODES.MAX) return `max. ${base}`;
  if (rateMode === SNAPSHOT_RATE_MODES.TARGET) return `Ziel ${base}`;
  return `ca. ${base}`;
}

function formatKm(km) {
  const num = Number(km);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${num.toLocaleString('de-DE')} km`;
}

function formatMonths(months) {
  const num = Number(months);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${num} Monate`;
}

function formatChildren(children) {
  if (children == null || children === false) return null;
  if (children === true) return 'Kinder';
  const n = Number(children);
  if (Number.isFinite(n) && n > 0) return n === 1 ? '1 Kind' : `${n} Kinder`;
  return 'Kinder';
}

function formatDownPayment(down) {
  const downNum = Number(down);
  if (!Number.isFinite(downNum) || downNum < 0) return null;
  if (downNum === 0) return '0 € AZ';
  return `${downNum.toLocaleString('de-DE')} € AZ`;
}

function resolvePaymentType(lead = {}, profile = {}) {
  const raw = lead?.wish?.paymentType
    ?? lead?.paymentType
    ?? profile?.budget?.paymentType
    ?? null;
  if (!raw || raw === 'unknown') return null;
  return raw;
}

function resolveRateMode(lead = {}, profile = {}) {
  const raw = lead?.wish?.desiredRateMode
    ?? profile?.budget?.rateMode
    ?? null;
  if (raw && SNAPSHOT_RATE_MODE_LABELS[raw]) return raw;
  return SNAPSHOT_RATE_MODES.APPROX;
}

function isMagicOfferSource(source = null) {
  const from = String(source?.createdFrom ?? source ?? '').toLowerCase();
  return from.includes('magic_offer') || from.includes('offer_pdf');
}

/**
 * Kommerzielle Offer-Raten (berechnet / PDF) – kein Kundenwunsch.
 * config.desiredRate nur wenn Magic/PDF oder identisch zur berechneten Monatrate
 * (sonst wäre ein Wunschziel auf dem Config fälschlich als Leak markiert).
 */
export function collectOfferCommercialRates(lead = {}, workingContextItems = []) {
  const rates = new Set();
  const push = (value) => {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) rates.add(Math.round(num));
  };

  for (const config of lead?.crm?.vehicleConfigurations ?? []) {
    push(config.monthlyRate);
    push(config.leasingData?.calculatedRate);
    push(config.leasingData?.monthlyRate);
    push(config.vehicleOffer?.monthlyRate);
    push(config.vehicleOffer?.payment?.monthlyRate);
    push(config.boardOffer?.payment?.monthlyRate);
    push(config.payment?.monthlyRate);
    push(config.payment?.calculatedRate);
    const commercial = Number(config.monthlyRate ?? config.leasingData?.calculatedRate);
    const desiredOnConfig = Number(config.desiredRate);
    if (
      Number.isFinite(desiredOnConfig)
      && desiredOnConfig > 0
      && (
        isMagicOfferSource(config.source)
        || isMagicOfferSource(config.vehicleOffer?.source)
        || (Number.isFinite(commercial) && Math.round(commercial) === Math.round(desiredOnConfig))
      )
    ) {
      push(desiredOnConfig);
    }
  }

  for (const offer of lead?.crm?.offers ?? []) {
    push(offer.monthlyRate);
    push(offer.payment?.monthlyRate);
    push(offer.payment?.calculatedRate);
    const commercial = Number(offer.monthlyRate ?? offer.payment?.monthlyRate);
    const desiredOnOffer = Number(offer.desiredRate);
    if (
      Number.isFinite(desiredOnOffer)
      && desiredOnOffer > 0
      && (
        isMagicOfferSource(offer.source)
        || (Number.isFinite(commercial) && Math.round(commercial) === Math.round(desiredOnOffer))
      )
    ) {
      push(desiredOnOffer);
    }
  }

  for (const item of workingContextItems ?? []) {
    push(item?.monthlyRate);
    push(item?.card?.monthlyRate);
    push(item?.card?.payment?.monthlyRate);
    push(item?.card?.payment?.calculatedRate);
    // Working-Context desiredRate ist bei Offer-Karten die Angebotsrate
    if (item?.kind === 'offer' || item?.card?.monthlyRate != null || item?.monthlyRate != null) {
      push(item?.desiredRate);
      push(item?.card?.desiredRate);
    }
  }

  return rates;
}

/**
 * Nur bestätigter Kundenwunsch – Offer-PDF-Raten (z. B. 132 €) nicht als Wunschrate,
 * auch wenn sie in wish.desiredRate / Budget / Top-Level gespiegelt wurden.
 */
export function resolveConfirmedWishRate(lead = {}, profile = {}, options = {}) {
  const offerRates = collectOfferCommercialRates(lead, options.workingContextItems);

  const pickConfirmed = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (offerRates.has(Math.round(num))) return null;
    return num;
  };

  return pickConfirmed(lead?.wish?.desiredRate)
    ?? pickConfirmed(profile?.budget?.maxMonthlyRate)
    ?? pickConfirmed(lead?.desiredRate);
}

function resolveExistingVehicleLabel(lead = {}) {
  const tradeIn = getTradeIn(lead);
  if (tradeIn.vehicle?.trim()) {
    const base = tradeIn.vehicle.trim();
    return /(?:\(|\b)(?:gw|gebraucht)/i.test(base) ? base : `${base} (GW)`;
  }
  const existing = lead?.crm?.existingVehicle;
  if (existing?.label?.trim()) {
    const base = existing.label.trim();
    return /(?:\(|\b)(?:gw|gebraucht)/i.test(base) ? base : `${base} (GW)`;
  }
  const makeModel = [existing?.make, existing?.model].filter(Boolean).join(' ').trim();
  if (makeModel) return `${makeModel} (GW)`;
  return null;
}

function collectConfirmedSellerLabels(lead = {}) {
  const insights = getSellerInsightsFromLead(lead);
  const labels = [];
  for (const insight of insights) {
    const fromInsight = insight.understoodLabels?.length
      ? insight.understoodLabels
      : [insight.text].filter(Boolean);
    for (const label of fromInsight) {
      const text = String(label ?? '').trim();
      if (text) labels.push(text);
    }
  }
  return labels;
}

function buildBedarfFacts(profile = {}, sellerLabels = []) {
  const facts = [];
  const hasFamily = profile.priorities?.includes('family')
    || Boolean(profile.children)
    || (profile.persons ?? 0) >= 5;
  if (hasFamily) {
    pushFact(facts, fact('family', 'Familie', {
      editKey: 'family',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 15,
    }));
  }

  const childrenLabel = formatChildren(profile.children);
  if (childrenLabel) {
    pushFact(facts, fact('children', childrenLabel, {
      editKey: 'children',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.CHILDREN,
      summaryPriority: 10,
    }));
  }

  if (profile.dog) {
    pushFact(facts, fact('dog', 'Hund', {
      editKey: 'dog',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.DOG,
      summaryPriority: 12,
    }));
  }

  if (profile.chargingAtHome === 'yes') {
    pushFact(facts, fact('chargingAtHome', 'Laden zuhause', {
      editKey: 'bedarf',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 36,
    }));
  }

  if (profile.priorities?.includes('space') || profile.bodyType === 'suv') {
    pushFact(facts, fact('space', profile.bodyType === 'suv' ? 'SUV / Platz' : 'Platz', {
      editKey: 'space',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 35,
    }));
  } else if ((profile.persons ?? 0) >= 7) {
    pushFact(facts, fact('space', '7 Sitze', {
      editKey: 'space',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 35,
    }));
  }

  for (const tag of profile.usage ?? []) {
    const label = USAGE_LABELS[tag];
    if (!label) continue;
    pushFact(facts, fact(`usage:${tag}`, label, {
      editKey: 'usage',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 40,
    }));
  }
  if (profile.longDistance === 'often' || profile.longDistance === 'sometimes') {
    pushFact(facts, fact('usage:langstrecke', 'Langstrecke', {
      editKey: 'usage',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 40,
    }));
  }

  if (profile.towbar || profile.towing === 'yes' || (profile.towCapacityKg ?? 0) >= 750) {
    pushFact(facts, fact('towbar', 'Anhängerkupplung', {
      editKey: 'equipment',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 42,
    }));
  }

  for (const wishId of profile.equipmentWishes ?? []) {
    const label = EQUIPMENT_LABELS[wishId];
    if (!label) continue;
    pushFact(facts, fact(`equip:${wishId}`, label, {
      editKey: 'equipment',
      groupId: SNAPSHOT_GROUP.BEDARF,
      tint: SNAPSHOT_TINT.ALLTAG,
      summaryPriority: 55,
    }));
  }

  for (const label of sellerLabels) {
    if (/leasing|finanz|kauf|budget|rate|km|monat|anzahlung/i.test(label)) continue;
    if (/favorit|ablehn|farbe|liefer/i.test(label)) continue;
    if (/inzahlung|gebraucht|\(gw\)|rückläufer|bestands/i.test(label)) continue;
    if (facts.some((f) => f.label.toLowerCase() === label.toLowerCase())) continue;
    if (/kind|hund|familie|platz|sitz|anhänger|urlaub|pendel|langstrecke|koffer|wärmepumpe|hud|kamera|haus/i.test(label)) {
      pushFact(facts, fact(`seller:${label}`, label, {
        editKey: 'bedarf',
        groupId: SNAPSHOT_GROUP.BEDARF,
        tint: SNAPSHOT_TINT.ALLTAG,
        summaryPriority: 45,
      }));
    }
  }

  return facts;
}

function buildBudgetFacts(lead = {}, profile = {}, options = {}) {
  const facts = [];
  const rate = resolveConfirmedWishRate(lead, profile, options);
  const rateMode = resolveRateMode(lead, profile);
  const rateLabel = formatEuroApprox(rate, rateMode);
  if (rateLabel) {
    pushFact(facts, fact('rate', rateLabel, {
      editKey: 'desiredRate',
      relevanceKey: 'desiredRate',
      groupId: SNAPSHOT_GROUP.BUDGET_VERTRAG,
      tint: SNAPSHOT_TINT.BUDGET,
      miniEditor: SNAPSHOT_MINI_EDITOR.DESIRED_RATE,
      summaryPriority: 20,
    }));
  }

  const down = lead?.wish?.downPayment ?? profile?.budget?.downPayment;
  if (down != null && String(down).trim() !== '') {
    const short = formatDownPayment(down);
    if (short) {
      pushFact(facts, fact('downPayment', short, {
        editKey: 'downPayment',
        groupId: SNAPSHOT_GROUP.BUDGET_VERTRAG,
        tint: SNAPSHOT_TINT.BUDGET,
        miniEditor: SNAPSHOT_MINI_EDITOR.DOWN_PAYMENT,
        summaryPriority: 34,
      }));
    }
  }

  return facts;
}

function buildVertragFacts(lead = {}, profile = {}) {
  const facts = [];
  const payment = resolvePaymentType(lead, profile);
  if (payment && PAYMENT_LABELS[payment]) {
    pushFact(facts, fact('paymentType', PAYMENT_LABELS[payment], {
      editKey: 'paymentType',
      groupId: SNAPSHOT_GROUP.BUDGET_VERTRAG,
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PAYMENT_TYPE,
      summaryPriority: 25,
    }));
  }

  const term = Number(lead?.wish?.termMonths ?? profile?.leaseDurationMonths);
  const termLabel = formatMonths(term);
  if (termLabel) {
    pushFact(facts, fact('termMonths', termLabel, {
      editKey: 'termMonths',
      groupId: SNAPSHOT_GROUP.BUDGET_VERTRAG,
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.TERM_MONTHS,
      summaryPriority: 30,
    }));
  }

  const km = Number(lead?.wish?.mileagePerYear ?? profile?.annualKm);
  const kmLabel = formatKm(km);
  if (kmLabel) {
    pushFact(facts, fact('mileagePerYear', kmLabel, {
      editKey: 'mileagePerYear',
      groupId: SNAPSHOT_GROUP.BUDGET_VERTRAG,
      tint: SNAPSHOT_TINT.VERTRAG,
      miniEditor: SNAPSHOT_MINI_EDITOR.MILEAGE,
      summaryPriority: 32,
    }));
  }

  const end = lead?.wish?.leasingEndDate
    ?? lead?.leasingEndDate
    ?? lead?.crm?.leasingEndDate
    ?? null;
  if (end && String(end).trim()) {
    const endText = String(end).trim();
    pushFact(facts, fact('leasingEndDate', `Ende ${endText}`, {
      editKey: 'leasingEndDate',
      groupId: SNAPSHOT_GROUP.BUDGET_VERTRAG,
      tint: SNAPSHOT_TINT.VERTRAG,
      summaryPriority: 38,
    }));
  }

  return facts;
}

function buildBestandFacts(lead = {}, profile = {}) {
  const facts = [];
  const existingLabel = resolveExistingVehicleLabel(lead);
  if (existingLabel) {
    pushFact(facts, fact('existingVehicle', existingLabel, {
      editKey: 'tradeIn',
      relevanceKey: 'existingVehicle',
      groupId: SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 18,
    }));
  }

  const tradeIn = getTradeIn(lead);
  const hasTradeIn = Boolean(
    tradeIn.vehicle?.trim()
    || tradeIn.datValue != null
    || lead?.crm?.existingVehicle?.tradeInCandidate,
  );
  if (hasTradeIn) {
    pushFact(facts, fact('tradeIn', 'Inzahlungnahme', {
      editKey: 'tradeIn',
      groupId: SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 48,
    }));
  }

  if (profile.residualTakeover || profile.takeoverPlanned || /rückläufer|anschluss/i.test(profile.timelineLabel ?? '')) {
    pushFact(facts, fact('returner', profile.timelineLabel?.trim() || 'Rückläufer', {
      editKey: 'tradeIn',
      groupId: SNAPSHOT_GROUP.BESTAND,
      tint: SNAPSHOT_TINT.INZAHLUNGNAHME,
      miniEditor: SNAPSHOT_MINI_EDITOR.TRADE_IN,
      summaryPriority: 46,
    }));
  }

  return facts;
}

function resolveTrimLabel(lead = {}, profile = {}) {
  const fromWish = String(lead?.wish?.equipment ?? '').trim();
  if (fromWish) return fromWish;
  const fromVehicle = String(lead?.vehicle?.trim ?? '').trim();
  if (fromVehicle) return fromVehicle;
  for (const wishId of profile.equipmentWishes ?? []) {
    if (EQUIPMENT_LABELS[wishId]) continue;
    const text = String(wishId ?? '').trim();
    if (text && /line|spirit|platinum|edition|ausstattung/i.test(text)) return text;
  }
  return null;
}

function buildWunschFacts(lead = {}, profile = {}) {
  const facts = [];
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));

  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
  if (favorite) {
    pushFact(facts, fact(`track-fav:${favorite.id}`, favorite.displayName || favorite.modelLabel, {
      editKey: 'vehicleTrack',
      relevanceKey: 'favoriteVehicle',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 22,
    }));
  } else {
    const modelKey = profile.selectedModelKey || profile.modelHint;
    if (modelKey) {
      pushFact(facts, fact('modelHint', modelDisplayLabel(modelKey), {
        editKey: 'vehicleTrack',
        relevanceKey: 'preferredModel',
        groupId: SNAPSHOT_GROUP.WUNSCH,
        tint: SNAPSHOT_TINT.FAHRZEUG,
        summaryPriority: 22,
      }));
    }
  }

  const trimLabel = resolveTrimLabel(lead, profile);
  if (trimLabel) {
    pushFact(facts, fact('trim', trimLabel, {
      editKey: 'equipment',
      relevanceKey: 'trim',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 28,
    }));
  }

  const openTracks = tracks.filter((t) => (
    t.status === VEHICLE_TRACK_STATUS.ACTIVE
    || t.status === VEHICLE_TRACK_STATUS.OPEN
    || t.status === VEHICLE_TRACK_STATUS.DEFERRED
  ));
  if (openTracks.length && !favorite) {
    const labels = openTracks
      .slice(0, 3)
      .map((t) => t.displayName || t.modelLabel)
      .filter(Boolean);
    if (labels.length) {
      pushFact(facts, fact('tracks', labels.join(' · '), {
        editKey: 'vehicleTrack',
        groupId: SNAPSHOT_GROUP.WUNSCH,
        tint: SNAPSHOT_TINT.FAHRZEUG,
        summaryPriority: 50,
      }));
    }
  }

  const colors = [...new Set(
    tracks.map((t) => t.config?.vehicleTrack?.preferredColor).filter(Boolean),
  )];
  for (const color of colors.slice(0, 2)) {
    pushFact(facts, fact(`color:${color}`, String(color), {
      editKey: 'vehicleTrack',
      relevanceKey: 'preferredColor',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.COLOR,
      summaryPriority: 52,
    }));
  }

  const delivery = lead?.wish?.desiredDeliveryDate || lead?.deliveryTime || '';
  if (String(delivery).trim()) {
    pushFact(facts, fact('delivery', `Lieferzeit ${String(delivery).trim()}`, {
      editKey: 'delivery',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY,
      summaryPriority: 44,
    }));
  } else if (tracks.some((t) => (
    t.config?.vehicleTrack?.deliveryTimeImportance === 'high'
    || t.config?.vehicleTrack?.deliveryTimeImportance === true
  ))) {
    pushFact(facts, fact('delivery', 'Lieferzeit wichtig', {
      editKey: 'delivery',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      miniEditor: SNAPSHOT_MINI_EDITOR.PRIORITY_DELIVERY,
      summaryPriority: 44,
    }));
  }

  const rejections = tracks.filter((t) => (
    t.status === VEHICLE_TRACK_STATUS.LOST && (t.rejectionReasonLabel || t.rejectionReason)
  ));
  for (const track of rejections.slice(0, 3)) {
    const reason = track.rejectionReasonLabel || 'abgelehnt';
    pushFact(facts, fact(`reject:${track.id}`, `${track.modelLabel}: ${reason}`, {
      editKey: 'vehicleTrack',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      tint: SNAPSHOT_TINT.FAHRZEUG,
      summaryPriority: 60,
    }));
  }

  return facts;
}

/**
 * Flat chip list in category order (for overflow +N).
 * @param {object[]} groups
 */
export function flattenSnapshotChips(groups = []) {
  return groups.flatMap((g) => (g.facts || []).map((f) => ({
    ...f,
    groupId: g.id,
    groupTitle: g.title,
    category: f.category || f.tint || SNAPSHOT_TINT.ALLTAG,
    tint: f.tint || f.category || SNAPSHOT_TINT.ALLTAG,
  })));
}

/**
 * Visible vs overflow chips for expanded mobile view.
 * @param {object[]} chips
 * @param {number} [maxVisible]
 * @param {boolean} [expanded]
 */
export function splitExpandedChips(chips = [], maxVisible = SNAPSHOT_EXPANDED_VISIBLE_CHIPS, expanded = false) {
  if (expanded || chips.length <= maxVisible) {
    return { visible: chips, overflow: 0, hidden: [] };
  }
  return {
    visible: chips.slice(0, maxVisible),
    overflow: chips.length - maxVisible,
    hidden: chips.slice(maxVisible),
  };
}

/**
 * Summary-Tokens: Kategorie-Reihenfolge, innerhalb Priorität. Rest als +N.
 * @param {object[]} groupsOrFacts
 * @param {number} [maxTokens]
 */
export function buildSnapshotSummary(groupsOrFacts = [], maxTokens = SNAPSHOT_SUMMARY_MAX_TOKENS) {
  let ranked;
  if (groupsOrFacts[0]?.facts) {
    ranked = groupsOrFacts.flatMap((g) => (
      [...(g.facts || [])].sort((a, b) => (
        (a.summaryPriority ?? 50) - (b.summaryPriority ?? 50)
      ))
    ));
  } else {
    ranked = [...groupsOrFacts].sort((a, b) => (
      (a.summaryPriority ?? 50) - (b.summaryPriority ?? 50)
    ));
  }
  const tokens = ranked.slice(0, Math.max(0, maxTokens));
  const overflow = Math.max(0, ranked.length - tokens.length);
  return {
    tokens,
    overflow,
    line: [
      ...tokens.map((t) => t.label),
      overflow > 0 ? `+${overflow}` : null,
    ].filter(Boolean).join(' · '),
  };
}

/** @deprecated – wireframe card lines; kept for compatibility */
export function buildGroupSummaryLines(facts = []) {
  const labels = facts.map((f) => String(f.label || '').trim()).filter(Boolean);
  return labels.length ? [labels.join(' · ')] : [];
}

/**
 * @param {object} lead
 * @param {{
 *   relevantKeys?: string[],
 *   workingContextItems?: object[],
 *   maxSummaryTokens?: number,
 *   highlightLabels?: string[],
 * }} [options]
 */
export function buildCustomerSnapshotModel(lead = {}, options = {}) {
  // Working Context nur zur Offer-Leak-Erkennung – nie als Truth-Quelle für Chips
  const workingContextItems = options.workingContextItems ?? [];

  const profile = getNeedProfileFromLead(lead) ?? {};
  const sellerLabels = collectConfirmedSellerLabels(lead);
  const understanding = buildCustomerUnderstanding(lead);
  const rateOptions = { workingContextItems };

  const bedarfFacts = buildBedarfFacts(profile, sellerLabels);
  const bestandFacts = buildBestandFacts(lead, profile);
  const budgetFacts = buildBudgetFacts(lead, profile, rateOptions);
  const vertragFacts = buildVertragFacts(lead, profile);
  const wunschFacts = buildWunschFacts(lead, profile);

  const groupsSpec = [
    { id: SNAPSHOT_GROUP.BEDARF, facts: bedarfFacts },
    { id: SNAPSHOT_GROUP.BESTAND, facts: bestandFacts },
    { id: SNAPSHOT_GROUP.BUDGET_VERTRAG, facts: [...budgetFacts, ...vertragFacts] },
    { id: SNAPSHOT_GROUP.WUNSCH, facts: wunschFacts },
  ];

  const relevantSet = new Set(
    (options.relevantKeys ?? [])
      .map((k) => String(k ?? '').trim())
      .filter(Boolean),
  );
  const highlightSet = new Set(
    (options.highlightLabels ?? [])
      .map((l) => String(l ?? '').trim().toLowerCase())
      .filter(Boolean),
  );

  const groups = groupsSpec
    .filter((g) => g.facts.length > 0)
    .map((g) => {
      const facts = g.facts.map((f) => {
        const relevant = relevantSet.size > 0 && (
          relevantSet.has(f.relevanceKey)
          || relevantSet.has(f.editKey)
          || relevantSet.has(f.id)
        );
        const highlighted = highlightSet.size > 0 && (
          highlightSet.has(String(f.label).toLowerCase())
          || highlightSet.has(String(f.id).toLowerCase())
          || [...highlightSet].some((h) => String(f.label).toLowerCase().includes(h))
        );
        return {
          ...f,
          relevant: relevant || highlighted,
          highlighted,
        };
      });
      return {
        id: g.id,
        title: SNAPSHOT_GROUP_TITLE[g.id],
        editKey: SNAPSHOT_GROUP_EDIT_KEY[g.id] || facts[0]?.editKey || null,
        relevant: facts.some((f) => f.relevant),
        facts,
      };
    });

  const allFacts = groups.flatMap((g) => g.facts);
  const summary = buildSnapshotSummary(
    groups,
    options.maxSummaryTokens ?? SNAPSHOT_SUMMARY_MAX_TOKENS,
  );
  const chips = flattenSnapshotChips(groups);

  return {
    meta: {
      hasData: allFacts.length > 0,
      factCount: allFacts.length,
      source: understanding?.meta?.source ?? (allFacts.length ? 'lead' : 'none'),
      updatedAt: understanding?.meta?.updatedAt ?? profile.updatedAt ?? lead?.updatedAt ?? null,
    },
    summary,
    groups,
    chips,
  };
}
