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
  return hay.some((h) => h && (key === h || key.includes(h) || h.includes(key)));
}

function classifyOfferContextItem(raw = {}) {
  const label = String(raw.label || '').trim();
  const compact = compactContextLabel(label);
  const key = contextKey(compact);
  const edit = String(raw.editKey || '').toLowerCase();
  const groupId = String(raw.groupId || '').toLowerCase();
  if (!compact) return null;
  if (PERSONAL_RE.test(compact) || PERSONAL_RE.test(key)) {
    return { lane: 'personal', rank: 80 };
  }
  if (edit === 'equipment' || groupId === 'ausstattungtechnik' || REQUIREMENT_RE.test(compact)) {
    const required = /muss|required/i.test(label) || raw.priority === 'required';
    return { lane: 'requirement', rank: required ? 10 : 12 };
  }
  if (edit === 'children' || edit === 'dog' || edit === 'family' || FAMILY_RE.test(compact)) {
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
  if (groupId === 'fahrzeugpraeferenz') return { lane: 'requirement', rank: 16 };
  if (groupId === 'persoenliches') return { lane: 'family', rank: 24 };
  return { lane: 'personal', rank: 85 };
}

function pushContextItem(out, seen, raw, hero) {
  const label = String(raw?.label || '').trim();
  if (!label || isOfferDuplicateLabel(label, hero)) return;
  const classified = classifyOfferContextItem({ ...raw, label });
  if (!classified) return;
  const compact = compactContextLabel(label);
  const key = contextKey(compact);
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push({
    label,
    compact,
    lane: classified.lane,
    rank: classified.rank,
    key,
  });
}

/**
 * Kompaktes Kundenbild für den Offer-Screen.
 * Wiederverwendet Snapshot/Briefing – keine zweite Wahrheit.
 */
export function presentOfferCustomerContext({
  customerSnapshot = null,
  workBriefing = null,
  hero = null,
} = {}) {
  const seen = new Set();
  const items = [];
  const chips = customerSnapshot?.soft?.chips
    || customerSnapshot?.chips
    || [];
  for (const chip of chips) {
    pushContextItem(items, seen, chip, hero);
  }
  const sections = workBriefing?.sections || {};
  for (const label of splitDots(sections.customerPicture)) {
    pushContextItem(items, seen, { label, editKey: 'family', groupId: 'persoenliches' }, hero);
  }
  for (const label of splitDots(sections.important)) {
    if (isOfferPackageToken(label)) continue;
    if (hero?.packages?.some((p) => contextKey(p) === contextKey(label))) continue;
    pushContextItem(items, seen, { label, editKey: 'equipment', groupId: 'ausstattungTechnik' }, hero);
  }
  for (const label of splitDots(sections.planned)) {
    pushContextItem(items, seen, { label, editKey: 'delivery' }, hero);
  }
  if (sections.sought && /elektro|sofort|offen/i.test(sections.sought)) {
    pushContextItem(items, seen, { label: sections.sought, editKey: 'equipment' }, hero);
  }

  items.sort((a, b) => a.rank - b.rank || a.compact.localeCompare(b.compact, 'de'));
  const durable = items.filter((item) => item.lane !== 'personal');
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
    powertrainLabel: snapshot?.powertrainLabel || null,
    openPoints,
    activityTrigger: presentActivityTrigger(list),
    activities: list,
    customerContext: presentOfferCustomerContext({
      customerSnapshot,
      workBriefing,
      hero: heroCore,
    }),
  };
}
