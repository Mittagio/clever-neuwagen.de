/**
 * Kundenbild – kompaktes Snapshot-Modell aus bestätigter Customer Truth.
 * Nur Lead-Daten (needProfile, sellerInsights, wish, tradeIn, tracks).
 * Working Context / Review-Pending fließen nicht ein.
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

export const SNAPSHOT_GROUP = {
  BEDARF: 'bedarf',
  BUDGET: 'budget',
  BESTAND: 'bestand',
  WUNSCH: 'wunsch',
};

export const SNAPSHOT_GROUP_TITLE = {
  [SNAPSHOT_GROUP.BEDARF]: 'Bedarf',
  [SNAPSHOT_GROUP.BUDGET]: 'Budget und Vertrag',
  [SNAPSHOT_GROUP.BESTAND]: 'Bestandsfahrzeug',
  [SNAPSHOT_GROUP.WUNSCH]: 'Fahrzeugwunsch',
};

/** Max. Tokens in der eingeklappten Summary-Zeile (Rest als +N). */
export const SNAPSHOT_SUMMARY_MAX_TOKENS = 4;

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
 * @param {string} groupId
 */
function fact(id, label, {
  editKey = null,
  relevanceKey = null,
  groupId,
  summaryPriority = 50,
} = {}) {
  const text = String(label ?? '').trim();
  if (!text) return null;
  return {
    id,
    label: text,
    editKey,
    relevanceKey: relevanceKey || editKey || id,
    groupId,
    summaryPriority,
  };
}

function pushFact(list, item) {
  if (!item) return;
  if (list.some((f) => f.id === item.id || f.label === item.label)) return;
  list.push(item);
}

function formatEuroApprox(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `ca. ${Math.round(num).toLocaleString('de-DE')} €`;
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

function resolvePaymentType(lead = {}, profile = {}) {
  const raw = lead?.wish?.paymentType
    ?? lead?.paymentType
    ?? profile?.budget?.paymentType
    ?? null;
  if (!raw || raw === 'unknown') return null;
  return raw;
}

function resolveRate(lead = {}, profile = {}) {
  const wishRate = Number(lead?.desiredRate ?? lead?.wish?.desiredRate);
  if (Number.isFinite(wishRate) && wishRate > 0) return wishRate;
  const budgetRate = Number(profile?.budget?.maxMonthlyRate);
  if (Number.isFinite(budgetRate) && budgetRate > 0) return budgetRate;
  return null;
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
      summaryPriority: 15,
    }));
  }

  const childrenLabel = formatChildren(profile.children);
  if (childrenLabel) {
    pushFact(facts, fact('children', childrenLabel, {
      editKey: 'children',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 10,
    }));
  }

  if (profile.dog) {
    pushFact(facts, fact('dog', 'Hund', {
      editKey: 'dog',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 12,
    }));
  }

  if (profile.priorities?.includes('space') || profile.bodyType === 'suv') {
    pushFact(facts, fact('space', profile.bodyType === 'suv' ? 'SUV / Platz' : 'Platz', {
      editKey: 'space',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 35,
    }));
  } else if ((profile.persons ?? 0) >= 7) {
    pushFact(facts, fact('space', '7 Sitze', {
      editKey: 'space',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 35,
    }));
  }

  for (const tag of profile.usage ?? []) {
    const label = USAGE_LABELS[tag];
    if (!label) continue;
    pushFact(facts, fact(`usage:${tag}`, label, {
      editKey: 'usage',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 40,
    }));
  }
  if (profile.longDistance === 'often' || profile.longDistance === 'sometimes') {
    pushFact(facts, fact('usage:langstrecke', 'Langstrecke', {
      editKey: 'usage',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 40,
    }));
  }

  if (profile.towbar || profile.towing === 'yes' || (profile.towCapacityKg ?? 0) >= 750) {
    pushFact(facts, fact('towbar', 'Anhängerkupplung', {
      editKey: 'equipment',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 42,
    }));
  }

  for (const wishId of profile.equipmentWishes ?? []) {
    const label = EQUIPMENT_LABELS[wishId] || String(wishId).replace(/_/g, ' ');
    pushFact(facts, fact(`equip:${wishId}`, label, {
      editKey: 'equipment',
      groupId: SNAPSHOT_GROUP.BEDARF,
      summaryPriority: 55,
    }));
  }

  // Bestätigte Seller-Labels, die Bedarf betreffen (ohne Budget/Fahrzeug-Duplikate)
  for (const label of sellerLabels) {
    if (/leasing|finanz|kauf|budget|rate|km|monat|anzahlung/i.test(label)) continue;
    if (/favorit|ablehn|farbe|liefer/i.test(label)) continue;
    if (/inzahlung|gebraucht|\(gw\)|rückläufer|bestands/i.test(label)) continue;
    if (facts.some((f) => f.label.toLowerCase() === label.toLowerCase())) continue;
    if (/kind|hund|familie|platz|sitz|anhänger|urlaub|pendel|langstrecke|koffer|wärmepumpe|hud|kamera/i.test(label)) {
      pushFact(facts, fact(`seller:${label}`, label, {
        editKey: 'bedarf',
        groupId: SNAPSHOT_GROUP.BEDARF,
        summaryPriority: 45,
      }));
    }
  }

  return facts;
}

function buildBudgetFacts(lead = {}, profile = {}) {
  const facts = [];
  const rate = resolveRate(lead, profile);
  const rateLabel = formatEuroApprox(rate);
  if (rateLabel) {
    pushFact(facts, fact('rate', rateLabel, {
      editKey: 'desiredRate',
      relevanceKey: 'desiredRate',
      groupId: SNAPSHOT_GROUP.BUDGET,
      summaryPriority: 20,
    }));
  }

  const payment = resolvePaymentType(lead, profile);
  if (payment && PAYMENT_LABELS[payment]) {
    pushFact(facts, fact('paymentType', PAYMENT_LABELS[payment], {
      editKey: 'paymentType',
      groupId: SNAPSHOT_GROUP.BUDGET,
      summaryPriority: 25,
    }));
  }

  const term = Number(lead?.wish?.termMonths ?? profile?.leaseDurationMonths);
  const termLabel = formatMonths(term);
  if (termLabel) {
    pushFact(facts, fact('termMonths', termLabel, {
      editKey: 'termMonths',
      groupId: SNAPSHOT_GROUP.BUDGET,
      summaryPriority: 30,
    }));
  }

  const km = Number(lead?.wish?.mileagePerYear ?? profile?.annualKm);
  const kmLabel = formatKm(km);
  if (kmLabel) {
    pushFact(facts, fact('mileagePerYear', kmLabel, {
      editKey: 'mileagePerYear',
      groupId: SNAPSHOT_GROUP.BUDGET,
      summaryPriority: 32,
    }));
  }

  const down = lead?.wish?.downPayment ?? profile?.budget?.downPayment;
  if (down != null && String(down).trim() !== '') {
    const downNum = Number(down);
    if (Number.isFinite(downNum)) {
      pushFact(facts, fact('downPayment', `AZ ${downNum.toLocaleString('de-DE')} €`, {
        editKey: 'downPayment',
        groupId: SNAPSHOT_GROUP.BUDGET,
        summaryPriority: 34,
      }));
    }
  }

  const end = lead?.wish?.leasingEndDate
    ?? lead?.leasingEndDate
    ?? lead?.crm?.leasingEndDate
    ?? null;
  if (end && String(end).trim()) {
    pushFact(facts, fact('leasingEndDate', `Ende ${String(end).trim()}`, {
      editKey: 'leasingEndDate',
      groupId: SNAPSHOT_GROUP.BUDGET,
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
      summaryPriority: 48,
    }));
  }

  if (profile.residualTakeover || profile.takeoverPlanned || /rückläufer|anschluss/i.test(profile.timelineLabel ?? '')) {
    pushFact(facts, fact('returner', profile.timelineLabel?.trim() || 'Rückläufer', {
      editKey: 'tradeIn',
      groupId: SNAPSHOT_GROUP.BESTAND,
      summaryPriority: 46,
    }));
  }

  return facts;
}

function buildWunschFacts(lead = {}, profile = {}) {
  const facts = [];
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));

  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
  if (favorite) {
    pushFact(facts, fact(`track-fav:${favorite.id}`, `Favorit ${favorite.displayName || favorite.modelLabel}`, {
      editKey: 'vehicleTrack',
      relevanceKey: 'favoriteVehicle',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      summaryPriority: 22,
    }));
  } else {
    const modelKey = profile.selectedModelKey || profile.modelHint;
    if (modelKey) {
      pushFact(facts, fact('modelHint', modelDisplayLabel(modelKey), {
        editKey: 'vehicleTrack',
        relevanceKey: 'preferredModel',
        groupId: SNAPSHOT_GROUP.WUNSCH,
        summaryPriority: 22,
      }));
    }
  }

  const openTracks = tracks.filter((t) => (
    t.status === VEHICLE_TRACK_STATUS.ACTIVE
    || t.status === VEHICLE_TRACK_STATUS.OPEN
    || t.status === VEHICLE_TRACK_STATUS.DEFERRED
  ));
  if (openTracks.length) {
    const labels = openTracks
      .slice(0, 3)
      .map((t) => t.displayName || t.modelLabel)
      .filter(Boolean);
    if (labels.length) {
      pushFact(facts, fact('tracks', labels.join(' · '), {
        editKey: 'vehicleTrack',
        groupId: SNAPSHOT_GROUP.WUNSCH,
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
      summaryPriority: 52,
    }));
  }

  const delivery = lead?.wish?.desiredDeliveryDate || lead?.deliveryTime || '';
  if (String(delivery).trim()) {
    pushFact(facts, fact('delivery', `Lieferzeit ${String(delivery).trim()}`, {
      editKey: 'delivery',
      groupId: SNAPSHOT_GROUP.WUNSCH,
      summaryPriority: 44,
    }));
  } else if (tracks.some((t) => (
    t.config?.vehicleTrack?.deliveryTimeImportance === 'high'
    || t.config?.vehicleTrack?.deliveryTimeImportance === true
  ))) {
    pushFact(facts, fact('delivery', 'Lieferzeit wichtig', {
      editKey: 'delivery',
      groupId: SNAPSHOT_GROUP.WUNSCH,
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
      summaryPriority: 60,
    }));
  }

  return facts;
}

/**
 * Summary-Tokens: priorisierte Fakten, Rest als Overflow.
 * @param {object[]} allFacts
 * @param {number} [maxTokens]
 */
export function buildSnapshotSummary(allFacts = [], maxTokens = SNAPSHOT_SUMMARY_MAX_TOKENS) {
  const ranked = [...allFacts].sort((a, b) => (
    (a.summaryPriority ?? 50) - (b.summaryPriority ?? 50)
  ));
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

/**
 * @param {object} lead
 * @param {{
 *   relevantKeys?: string[],
 *   workingContextItems?: object[],
 *   maxSummaryTokens?: number,
 * }} [options]
 * workingContextItems werden bewusst ignoriert (keine zweite Truth).
 */
export function buildCustomerSnapshotModel(lead = {}, options = {}) {
  // Explizit: Working Context darf nicht einfließen
  void options.workingContextItems;

  const profile = getNeedProfileFromLead(lead) ?? {};
  const sellerLabels = collectConfirmedSellerLabels(lead);
  const understanding = buildCustomerUnderstanding(lead);

  const groupsSpec = [
    { id: SNAPSHOT_GROUP.BEDARF, facts: buildBedarfFacts(profile, sellerLabels) },
    { id: SNAPSHOT_GROUP.BUDGET, facts: buildBudgetFacts(lead, profile) },
    { id: SNAPSHOT_GROUP.BESTAND, facts: buildBestandFacts(lead, profile) },
    { id: SNAPSHOT_GROUP.WUNSCH, facts: buildWunschFacts(lead, profile) },
  ];

  const relevantSet = new Set(
    (options.relevantKeys ?? [])
      .map((k) => String(k ?? '').trim())
      .filter(Boolean),
  );

  const groups = groupsSpec
    .filter((g) => g.facts.length > 0)
    .map((g) => ({
      id: g.id,
      title: SNAPSHOT_GROUP_TITLE[g.id],
      facts: g.facts.map((f) => ({
        ...f,
        relevant: relevantSet.size > 0 && (
          relevantSet.has(f.relevanceKey)
          || relevantSet.has(f.editKey)
          || relevantSet.has(f.id)
        ),
      })),
    }));

  const allFacts = groups.flatMap((g) => g.facts);
  const summary = buildSnapshotSummary(
    allFacts,
    options.maxSummaryTokens ?? SNAPSHOT_SUMMARY_MAX_TOKENS,
  );

  return {
    meta: {
      hasData: allFacts.length > 0,
      factCount: allFacts.length,
      source: understanding?.meta?.source ?? (allFacts.length ? 'lead' : 'none'),
      updatedAt: understanding?.meta?.updatedAt ?? profile.updatedAt ?? lead?.updatedAt ?? null,
    },
    summary,
    groups,
  };
}
