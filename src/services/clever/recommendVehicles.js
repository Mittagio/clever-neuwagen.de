import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

const MODEL_CATALOG = {
  ev2: { modelKey: 'ev2', modelLabel: 'Kia EV2', tagline: 'Kompakt für Stadt und Alltag', rateFrom: 239 },
  ev3: { modelKey: 'ev3', modelLabel: 'Kia EV3', tagline: 'Der Reichweiten-Champion', rateFrom: 299 },
  ev4: { modelKey: 'ev4', modelLabel: 'Kia EV4', tagline: 'Moderne Elektro-Limousine', rateFrom: 269 },
  ev5: { modelKey: 'ev5', modelLabel: 'Kia EV5', tagline: 'Großes Familien-SUV', rateFrom: 419 },
  ev6: { modelKey: 'ev6', modelLabel: 'Kia EV6', tagline: '800-Volt Langstrecken-EV', rateFrom: 399 },
  ev9: { modelKey: 'ev9', modelLabel: 'Kia EV9', tagline: 'Premium Familien-SUV (7-Sitzer)', rateFrom: 699 },
  sportage: { modelKey: 'sportage', modelLabel: 'Kia Sportage', tagline: 'Familien-SUV mit viel Platz', rateFrom: 199 },
  ceed: { modelKey: 'ceed', modelLabel: 'Kia Ceed', tagline: 'Kompakter Allrounder', rateFrom: 179 },
};

function toLower(label) {
  return String(label ?? '').toLowerCase();
}

function includesAny(blob, tests = []) {
  return tests.some((t) => t.test(blob));
}

function formatRate(rateFrom) {
  if (!rateFrom) return null;
  const n = Number(rateFrom);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `ab ${n.toLocaleString('de-DE')} €/Monat`;
}

function normalizeBudgetCap(understanding = {}) {
  const labels = understanding?.verstaendnis?.labels ?? [];
  const labelBlob = labels.join(' ').toLowerCase();
  const m = labelBlob.match(/budget\s+bis\s+(\d{2,4})\s*€\/monat/i)
    || labelBlob.match(/budget\s+(\d{2,4})\s*€\/monat/i)
    || labelBlob.match(/bis\s+(\d{2,4})\s*€\/monat/i);
  if (!m) return null;
  const cap = Number(m[1]);
  return Number.isFinite(cap) ? cap : null;
}

function baseCandidates(understanding = {}) {
  const labels = understanding?.verstaendnis?.labels ?? [];
  const blob = labels.join(' ').toLowerCase();

  if (includesAny(blob, [/elektro/, /\bev\d\b/, /reichweite/, /schnellladen/, /wallbox/, /laden zuhause/])) {
    return ['ev2', 'ev3', 'ev4', 'ev5', 'ev6', 'ev9'];
  }
  if (includesAny(blob, [/hybrid/, /plug-in/])) {
    return ['sportage', 'niro'];
  }
  return ['sportage', 'ceed', 'ev3', 'ev5', 'ev6'];
}

function scoreCandidate(modelKey, understanding = {}) {
  const meta = MODEL_CATALOG[modelKey] ?? { modelKey };
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey] ?? {};
  const labels = understanding?.verstaendnis?.labels ?? [];
  const blob = labels.join(' ').toLowerCase();
  const cap = normalizeBudgetCap(understanding);

  let score = 0;
  const reasons = [];

  // Budget
  if (cap != null && meta.rateFrom != null) {
    if (meta.rateFrom <= cap) {
      score += 18;
      reasons.push('preislich passend');
    } else {
      score -= 22;
      reasons.push('über Budget');
    }
  }

  // Familie / Platz
  if (includesAny(blob, [/familie/, /kinder/, /kinderwagen/, /isofix/, /hund/])) {
    if (attrs.bodyClass === 'family_suv' || attrs.bodyClass === 'large_suv') {
      score += 22;
      reasons.push('viel Platz');
    } else if (attrs.bodyClass === 'compact_suv') {
      score += 14;
      reasons.push('familientauglich');
    } else {
      score -= 12;
      reasons.push('weniger Platz');
    }
  }

  // Schnellladen
  if (includesAny(blob, [/schnellladen/, /ladeleistung/, /10-80/, /langstrecke/])) {
    if (modelKey === 'ev6' || modelKey === 'ev9') {
      score += 26;
      reasons.push('schnellladen');
    } else if (modelKey === 'ev3' || modelKey === 'ev5') {
      score += 10;
      reasons.push('gute Reichweite');
    } else {
      score -= 6;
    }
  }

  // Anhänger
  if (includesAny(blob, [/anhäng/, /anhaeng/, /kupplung/, /zugfahrzeug/, /wohnwagen/])) {
    const tow = Number(attrs.towCapacityKg ?? 0);
    if (tow >= 1600) {
      score += 18;
      reasons.push('Anhänger möglich');
    } else if (tow > 0) {
      score += 8;
      reasons.push('leichter Anhänger');
    } else {
      score -= 10;
    }
  }

  // EV2 bewusst „kleiner“
  if (modelKey === 'ev2' && includesAny(blob, [/familie/, /kinderwagen/, /hund/])) {
    score -= 18;
  }

  // Modell explizit genannt
  if (labels.some((l) => toLower(l) === modelKey)) {
    score += 28;
    reasons.push('explizit genannt');
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 3) };
}

/**
 * recommendVehicles(customerUnderstanding)
 * - Reader-only: erzeugt eine live Rangliste + kurze Gründe.
 * - Keine Schreibpfade, keine Persistenz.
 */
export function recommendVehicles(customerUnderstanding = {}) {
  if (!customerUnderstanding?.meta?.hasData) return { intro: null, items: [] };

  const labels = customerUnderstanding?.verstaendnis?.labels ?? [];
  if (!labels.length) return { intro: null, items: [] };

  const candidates = baseCandidates(customerUnderstanding)
    .filter((key) => MODEL_CATALOG[key]);

  const ranked = candidates
    .map((modelKey) => {
      const meta = MODEL_CATALOG[modelKey];
      const s = scoreCandidate(modelKey, customerUnderstanding);
      return {
        modelKey,
        title: meta.modelLabel ?? `Kia ${String(modelKey).toUpperCase()}`,
        subtitle: meta.tagline ?? '',
        rateLine: formatRate(meta.rateFrom),
        reasons: s.reasons,
        score: s.score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    intro: 'Aufgrund Ihrer Angaben würde ich aktuell diese Fahrzeuge anschauen:',
    items: ranked.map(({ score, ...rest }) => rest),
  };
}

