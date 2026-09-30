/**
 * Offer-Stage Presenter: Hero verdichten, Details/Aktivitäten progressiv.
 * Keine neue Offer-Logik – nur Darstellung vorhandener Briefing-/Snapshot-Daten.
 */

const SKIP_PACKAGE_RE = /^(ev-std|std|serie)$/i;
const COLOR_PRUEFEN_RE = /farbe\s*prüfen/i;
const OFFER_PACKAGE_HINT_RE = /paket|connect|drive\s*wise|\bwic\b|[-_]/i;
const REQUIREMENT_RE = /ahk|anh[äa]nger|w[äa]rmepumpe|sitze|kofferraum|\belektro\b|allrad|sofort\s*verf[üu]gbar|neuwagen\s*offen|kein\s*neuwagen/i;
const FAMILY_RE = /\bkinder|\bkind\b|\bhund|\bkatze|mitfahrer|familie|hunde/i;
const FRAME_RE = /sofort|schnellstmöglich|dringend|wunschrate|budget|max\.?\s*[\d.]+\s*€|ca\.\s*[\d.]+\s*€|benötigt|liefer|verfügbar/i;
const PERSONAL_RE = /kaffee|tee|espresso|cappuccino|verheiratet|ledig|hobby|urlaub|italien|smalltalk/i;
const OFFER_TERM_RE = /^\d+\s*m(onate)?$|laufzeit|\d[\d.\s]*km|anzahlung|sonderzahlung|leasing|finanzierung|^kauf$|\/\s*monat/i;

function splitDots(line = '') {
  return String(line || '')
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function packageKey(label = '') {
  return String(label)
    .toLowerCase()
    .replace(/\s*prüfen\s*$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+paket$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function humanizePackageLabel(raw = '') {
  const s = String(raw || '').trim();
  if (!s || SKIP_PACKAGE_RE.test(s)) return null;
  const cleaned = s.replace(/\s*prüfen\s*$/i, '').trim();
  if (!cleaned || SKIP_PACKAGE_RE.test(cleaned)) return null;
  if (/[-_]/.test(cleaned) && !/\s/.test(cleaned)) {
    return cleaned
      .split(/[-_]/)
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join('-');
  }
  return cleaned;
}

function isOfferPackageToken(label = '') {
  const s = String(label || '').trim();
  if (!s || SKIP_PACKAGE_RE.test(s)) return true;
  if (REQUIREMENT_RE.test(s) || FAMILY_RE.test(s) || PERSONAL_RE.test(s) || FRAME_RE.test(s)) {
    return false;
  }
  return OFFER_PACKAGE_HINT_RE.test(s);
}

export function presentPackageLabels(importantLine = '', extraLabels = []) {
  const seen = new Set();
  const out = [];
  for (const item of [...splitDots(importantLine), ...(extraLabels || [])]) {
    const display = humanizePackageLabel(item);
    if (!display) continue;
    const key = packageKey(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}

export function extractColorLabel(customerWants = '', snapshotColor = null) {
  const fromSnap = String(snapshotColor || '').trim();
  if (fromSnap) return fromSnap;
  const bits = splitDots(customerWants);
  if (bits.length < 3) return null;
  const last = bits[bits.length - 1];
  if (/^ev\d|earth|air|gt-?line|spirit|vision|leasing|monat|km/i.test(last)) return null;
  return last || null;
}

export function extractDownPaymentLabel(leasingWish = '', snapshotDown = null) {
  const fromSnap = String(snapshotDown || '').trim();
  if (fromSnap) return fromSnap;
  const m = String(leasingWish || '').match(
    /([\d.\s]+)\s*€\s*(?:Anzahlung|Sonderzahlung)/i,
  );
  if (!m) return null;
  return `${m[1].replace(/\s+/g, '').trim()} €`;
}

export function presentMileageLabel(mileageLabel = '') {
  const raw = String(mileageLabel || '').trim();
  if (!raw) return null;
  if (/jahr/i.test(raw)) return raw;
  return `${raw.replace(/\s*\/?\s*$/, '')}/Jahr`;
}

export function presentLocalOpenPoints(toClarify = '', { colorShown = false } = {}) {
  return splitDots(toClarify)
    .filter((part) => !(colorShown && COLOR_PRUEFEN_RE.test(part)))
    .map((label) => ({
      label,
      compact: /prüfen/i.test(label)
        ? `${String(label).replace(/\s*prüfen\s*$/i, '').trim()} · prüfen`
        : label,
    }));
}

export function presentActivityTrigger(activities = []) {
  const first = Array.isArray(activities) ? activities[0] : null;
  if (!first) return null;
  const when = first.whenLabel || first.time || null;
  return when ? `Letzte Aktivität · ${when}` : 'Letzte Aktivität';
}

const KUNDENBILD_VISIBLE_MAX = 4;
const EXISTING_VEHICLE_PREFIX_RE = /^(altes\s+auto|aktuelles\s+(?:auto|fahrzeug)|bestand(?:sfahrzeug)?)\s*:?\s*/i;
const EXISTING_VEHICLE_GW_RE = /\s*\((?:gw|gebraucht)\)\s*$/i;
const GENERIC_TRADE_IN_RE = /^inzahlungnahme$/i;
const DOG_LABEL_RE = /^\d+\s*hunde?$|^hund$|^(?:pet|hund)\s*=\s*(?:dog|hund|true|ja|yes)$|^dog\s*=\s*(?:true|ja|yes|dog)$/i;
const CHILDREN_COUNT_RE = /(?:^(\d+)\s*kinder?$|^1\s*kind$|^kinder\s*:?\s*(\d+)$)/i;
const TOWBAR_RE = /\bahk\b|anh[äa]ngerkupplung/i;
const HEAT_PUMP_RE = /w[äa]rmepumpe|\bwp\b/i;
const ELECTRIC_NEED_RE = /^(elektro(?:fahrzeug|auto)?|e-?auto|bev)$/i;
const MARRIED_RE = /verheiratet|ehepartner/i;
const MODEL_TOKEN_RE = /\bev\s*-?\s*\d\b|\bpicanto\b|\bsportage\b|\bceed\b|\bniro\b|\bsoul\b|\bsorento\b|\bstonic\b|\bev3\b|\bev2\b|\bev4\b|\bev5\b|\bev6\b|\bev9\b/gi;

function compactContextLabel(label = '') {
  return String(label || '')
    .replace(/\s*·\s*(wichtig|muss|wunsch)\s*$/i, '')
    .replace(/\s+(wichtig|muss)\s*$/i, '')
    .trim();
}

function contextKey(label = '') {
  return compactContextLabel(label)
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractModelTokens(text = '') {
  const found = String(text || '').toLowerCase().match(MODEL_TOKEN_RE) || [];
  return new Set(found.map((t) => t.replace(/\s+/g, '').replace(/-/g, '')));
}

function sharesOfferModel(label, hero) {
  const a = extractModelTokens(label);
  const b = extractModelTokens(hero?.title || '');
  if (!a.size || !b.size) return false;
  for (const token of a) {
    if (b.has(token)) return true;
  }
  return false;
}

function isElectricOffer(hero = null) {
  const text = `${hero?.title || ''} ${hero?.powertrainLabel || ''}`;
  return /\bev\s*-?\s*\d\b|\belektro\b|e-soul|niro\s*ev|\bbev\b|\bkwh\b/i.test(text);
}

function trustedExistingVehicleLabel(existingVehicle, hero) {
  if (!existingVehicle || typeof existingVehicle !== 'object') return null;
  const label = String(
    existingVehicle.label
    || [existingVehicle.make, existingVehicle.model].filter(Boolean).join(' '),
  )
    .replace(EXISTING_VEHICLE_GW_RE, '')
    .replace(EXISTING_VEHICLE_PREFIX_RE, '')
    .trim();
  if (!label) return null;
  if (sharesOfferModel(label, hero)) return null;
  return label;
}

function refersToExistingVehicle(label = '', existingLabel = '') {
  if (!existingLabel) return false;
  const a = contextKey(
    compactContextLabel(label)
      .replace(EXISTING_VEHICLE_PREFIX_RE, '')
      .replace(EXISTING_VEHICLE_GW_RE, ''),
  );
  const b = contextKey(existingLabel);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function isExistingVehicleShaped(label = '', editKey = '', existingLabel = '') {
  const compact = compactContextLabel(label);
  const edit = String(editKey || '').toLowerCase();
  if (GENERIC_TRADE_IN_RE.test(compact)) return false;
  if (EXISTING_VEHICLE_PREFIX_RE.test(compact)) return true;
  if (edit === 'existingvehicle' && compact) return true;
  return refersToExistingVehicle(compact, existingLabel);
}

function isInterestOrOfferVehicleLabel(label = '', editKey = '', existingLabel = '') {
  if (isExistingVehicleShaped(label, editKey, existingLabel)) return false;
  return extractModelTokens(label).size > 0;
}

function isOfferDuplicateLabel(label = '', hero = null) {
  const compact = compactContextLabel(label);
  const key = contextKey(compact);
  if (!key) return true;
  if (OFFER_TERM_RE.test(key)) return true;
  const hay = [
    hero?.title,
    hero?.colorLabel,
    hero?.termLabel,
    hero?.mileageLabel,
    hero?.downPaymentLabel,
    hero?.rate?.value,
    hero?.rate?.label,
    ...(hero?.packages || []),
  ]
    .filter(Boolean)
    .map((s) => contextKey(s));
  if (hay.some((h) => h && (key === h || key.includes(h) || h.includes(key)))) return true;
  if (sharesOfferModel(compact, hero) && !TOWBAR_RE.test(compact) && !HEAT_PUMP_RE.test(compact)) {
    return true;
  }
  return false;
}

function extractChildrenCount(label = '') {
  const s = compactContextLabel(label);
  const leading = s.match(/^(\d+)\s*kinder?/i);
  if (leading) return Number(leading[1]);
  if (/^1\s*kind$/i.test(s)) return 1;
  const colon = s.match(/^kinder\s*:?\s*(\d+)$/i);
  if (colon) return Number(colon[1]);
  return null;
}

function isDogFact(compact = '', edit = '') {
  return edit === 'dog'
    || edit === 'pet'
    || DOG_LABEL_RE.test(compact)
    || /\bhund\b/i.test(compact);
}

function semanticContextKey(label = '', editKey = '', existingLabel = '') {
  const compact = compactContextLabel(label);
  const edit = String(editKey || '').toLowerCase();
  if (isDogFact(compact, edit) && !CHILDREN_COUNT_RE.test(compact)) return 'dog';
  if (extractChildrenCount(compact) != null || edit === 'children') return 'children';
  if (MARRIED_RE.test(compact)) return 'married';
  if (TOWBAR_RE.test(compact)) return 'towbar';
  if (HEAT_PUMP_RE.test(compact)) return 'heat_pump';
  if (ELECTRIC_NEED_RE.test(compact)) return 'electric';
  if (isExistingVehicleShaped(compact, edit, existingLabel)) return 'existing_vehicle';
  return contextKey(compact);
}

function extractLeadingCount(label = '') {
  const children = extractChildrenCount(label);
  if (children != null) return children;
  const m = String(label || '').trim().match(/^(\d+)\s+/);
  return m ? Number(m[1]) : null;
}

function specificityScore(item) {
  let score = 0;
  if (extractLeadingCount(item.compact) != null) score += 3;
  if (item.compact.length > 8) score += 1;
  return score;
}

function canonicalizeItem(item) {
  const count = extractLeadingCount(item.compact);
  if (item.semanticKey === 'dog') {
    const compact = count ? `${count} Hund` : 'Hund';
    return { ...item, compact, label: count ? `${count} Hund` : item.label };
  }
  if (item.semanticKey === 'children') {
    if (count === 1) return { ...item, compact: '1 Kind', label: '1 Kind' };
    if (count > 1) return { ...item, compact: `${count} Kinder`, label: `${count} Kinder` };
    return item;
  }
  if (item.semanticKey === 'towbar') {
    return { ...item, compact: 'AHK' };
  }
  if (item.semanticKey === 'heat_pump') {
    return { ...item, compact: 'Wärmepumpe' };
  }
  if (item.semanticKey === 'existing_vehicle') {
    const name = compactContextLabel(item.compact)
      .replace(EXISTING_VEHICLE_PREFIX_RE, '')
      .replace(EXISTING_VEHICLE_GW_RE, '')
      .trim();
    return {
      ...item,
      compact: name ? `Aktuelles Auto: ${name}` : item.compact,
      label: name ? `Aktuelles Auto: ${name}` : item.label,
    };
  }
  return item;
}

function classifyOfferContextItem(raw = {}, existingLabel = '') {
  const label = String(raw.label || '').trim();
  const compact = compactContextLabel(label);
  const key = contextKey(compact);
  const edit = String(raw.editKey || '').toLowerCase();
  const groupId = String(raw.groupId || '').toLowerCase();
  if (!compact) return null;
  if (PERSONAL_RE.test(compact) || PERSONAL_RE.test(key)) {
    return { lane: 'personal', rank: 80 };
  }
  if (isExistingVehicleShaped(compact, edit, existingLabel)) {
    return { lane: 'frame', rank: 22 };
  }
  if (edit === 'equipment' || groupId === 'ausstattungtechnik' || REQUIREMENT_RE.test(compact)) {
    const required = /muss|required/i.test(label) || raw.priority === 'required';
    const electric = ELECTRIC_NEED_RE.test(compact);
    return { lane: 'requirement', rank: electric ? 18 : (required ? 10 : 12) };
  }
  if (edit === 'children' || extractChildrenCount(compact) != null) {
    return { lane: 'family', rank: 19 };
  }
  if (edit === 'dog' || edit === 'pet' || edit === 'family' || FAMILY_RE.test(compact)) {
    return { lane: 'family', rank: 20 };
  }
  if (
    edit === 'desiredrate'
    || edit === 'delivery'
    || FRAME_RE.test(compact)
  ) {
    return { lane: 'frame', rank: 30 };
  }
  if (groupId === 'sonstiges') return { lane: 'personal', rank: 82 };
  if (groupId === 'fahrzeugpraeferenz') {
    if (ELECTRIC_NEED_RE.test(compact)) return { lane: 'requirement', rank: 18 };
    return { lane: 'personal', rank: 84 };
  }
  if (groupId === 'persoenliches') return { lane: 'family', rank: 24 };
  return { lane: 'personal', rank: 85 };
}

function collectContextItem(raw, hero, existingLabel) {
  const label = String(raw?.label || '').trim();
  const editKey = raw?.editKey;
  if (!label || isOfferDuplicateLabel(label, hero)) return null;
  if (isInterestOrOfferVehicleLabel(label, editKey, existingLabel)) return null;
  if (isExistingVehicleShaped(label, editKey, existingLabel)) {
    if (!existingLabel) return null;
    if (sharesOfferModel(label, hero)) return null;
  }
  const classified = classifyOfferContextItem({ ...raw, label }, existingLabel);
  if (!classified) return null;
  const compact = compactContextLabel(label);
  const semanticKey = semanticContextKey(compact, editKey, existingLabel);
  if (!semanticKey) return null;
  return canonicalizeItem({
    label,
    compact,
    lane: classified.lane,
    rank: classified.rank,
    semanticKey,
    editKey,
    redundantToOffer: semanticKey === 'electric' && isElectricOffer(hero),
  });
}

function mergeSemanticItems(items) {
  const byKey = new Map();
  for (const item of items) {
    const prev = byKey.get(item.semanticKey);
    if (!prev || specificityScore(item) > specificityScore(prev)) {
      byKey.set(item.semanticKey, item);
    }
  }
  return [...byKey.values()].map(canonicalizeItem);
}

/**
 * Kompaktes Kundenbild für den Offer-Screen.
 * Quellen: Snapshot-Chips (NeedProfile + conversationNotes), Briefing-Bedarf,
 * echtes crm.existingVehicle. Nicht: vehicleInterest, Offer-Draft, Track, Portfolio.
 */
export function presentOfferCustomerContext({
  customerSnapshot = null,
  workBriefing = null,
  hero = null,
  existingVehicle = null,
} = {}) {
  const existingLabel = trustedExistingVehicleLabel(existingVehicle, hero);
  const collected = [];
  const chips = customerSnapshot?.soft?.chips
    || customerSnapshot?.chips
    || [];
  for (const chip of chips) {
    const item = collectContextItem(chip, hero, existingLabel);
    if (item) collected.push(item);
  }
  const sections = workBriefing?.sections || {};
  for (const label of splitDots(sections.customerPicture)) {
    const item = collectContextItem(
      { label, groupId: 'persoenliches' },
      hero,
      existingLabel,
    );
    if (item) collected.push(item);
  }
  for (const label of splitDots(sections.important)) {
    if (isOfferPackageToken(label)) continue;
    if (hero?.packages?.some((p) => contextKey(p) === contextKey(label))) continue;
    const item = collectContextItem(
      { label, editKey: 'equipment', groupId: 'ausstattungTechnik' },
      hero,
      existingLabel,
    );
    if (item) collected.push(item);
  }
  for (const label of splitDots(sections.planned)) {
    const item = collectContextItem({ label, editKey: 'delivery' }, hero, existingLabel);
    if (item) collected.push(item);
  }
  if (sections.sought && /sofort|offen/i.test(sections.sought) && !ELECTRIC_NEED_RE.test(sections.sought)) {
    const item = collectContextItem(
      { label: sections.sought, editKey: 'equipment' },
      hero,
      existingLabel,
    );
    if (item) collected.push(item);
  }
  if (existingLabel) {
    const item = collectContextItem(
      { label: `Aktuelles Auto: ${existingLabel}`, editKey: 'existingVehicle' },
      hero,
      existingLabel,
    );
    if (item) collected.push(item);
  }

  const items = mergeSemanticItems(collected)
    .sort((a, b) => a.rank - b.rank || a.compact.localeCompare(b.compact, 'de'));
  const durable = items.filter((item) => item.lane !== 'personal' && !item.redundantToOffer);
  const visible = durable.slice(0, KUNDENBILD_VISIBLE_MAX);
  const overflow = Math.max(0, items.length - visible.length);
  const line = visible.map((item) => item.compact).join(' · ');
  const trigger = overflow > 0
    ? `${line || 'Kundenbild'} · +${overflow}`
    : (line || 'Kundenbild');

  return {
    hasData: items.length > 0,
    line,
    overflow,
    trigger,
    visible: visible.map((item) => item.compact),
    groups: {
      bedarf: items
        .filter((item) => item.lane === 'requirement' || item.lane === 'family')
        .map((item) => item.label),
      rahmen: items.filter((item) => item.lane === 'frame').map((item) => item.label),
      persoenlich: items.filter((item) => item.lane === 'personal').map((item) => item.label),
    },
  };
}

/**
 * @param {{
 *   snapshot?: object|null,
 *   workBriefing?: object|null,
 *   activities?: object[],
 * }} params
 */
export function presentCleverStageHero({
  snapshot = null,
  workBriefing = null,
  activities = [],
  customerSnapshot = null,
  existingVehicle = null,
} = {}) {
  const sections = workBriefing?.sections || {};
  const colorLabel = extractColorLabel(sections.customerWants, snapshot?.colorLabel);
  const downPaymentLabel = extractDownPaymentLabel(
    sections.leasingWish,
    snapshot?.downPaymentLabel,
  );
  const packages = presentPackageLabels(
    splitDots(sections.important).filter(isOfferPackageToken).join(' · '),
    snapshot?.packageLabels || [],
  );
  const openPoints = presentLocalOpenPoints(sections.toClarify, {
    colorShown: Boolean(colorLabel),
  });
  const list = Array.isArray(activities) ? activities.slice(0, 5) : [];
  const heroCore = {
    title: snapshot?.title || null,
    colorLabel,
    termLabel: snapshot?.termLabel || null,
    mileageLabel: presentMileageLabel(snapshot?.mileageLabel || ''),
    downPaymentLabel,
    powertrainLabel: snapshot?.powertrainLabel || null,
    rate: snapshot
      ? {
        value: snapshot.rateValue || null,
        unit: snapshot.rateUnit || null,
        label: snapshot.rateLabel || null,
      }
      : null,
    packages,
  };

  return {
    offerMode: Boolean(snapshot),
    ...heroCore,
    listPriceLabel: snapshot?.listPriceLabel || null,
    openPoints,
    activityTrigger: presentActivityTrigger(list),
    activities: list,
    customerContext: presentOfferCustomerContext({
      customerSnapshot,
      workBriefing,
      hero: heroCore,
      existingVehicle,
    }),
  };
}
