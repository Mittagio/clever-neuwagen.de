import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

const MODEL_CATALOG = {
  ev2: { modelKey: 'ev2', modelLabel: 'Kia EV2', tagline: 'Kompakt für Stadt und Alltag', rateFrom: 239 },
  ev3: { modelKey: 'ev3', modelLabel: 'Kia EV3', tagline: 'Familienliebling', rateFrom: 299 },
  ev4: { modelKey: 'ev4', modelLabel: 'Kia EV4', tagline: 'Moderne Elektro-Limousine', rateFrom: 269 },
  ev5: { modelKey: 'ev5', modelLabel: 'Kia EV5', tagline: 'Mehr Platz', rateFrom: 419 },
  ev6: { modelKey: 'ev6', modelLabel: 'Kia EV6', tagline: 'Langstreckenprofi', rateFrom: 399 },
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

function scoreCandidate(modelKey, understanding = {}, answers = {}) {
  const meta = MODEL_CATALOG[modelKey] ?? { modelKey };
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey] ?? {};
  const labels = understanding?.verstaendnis?.labels ?? [];
  const blob = labels.join(' ').toLowerCase();
  const cap = normalizeBudgetCap(understanding);

  let score = 0;
  const reasons = [];

  if (cap != null && meta.rateFrom != null) {
    if (meta.rateFrom <= cap) {
      score += 18;
      reasons.push('Preis-Leistung');
    } else {
      score -= 22;
      reasons.push('über Budget');
    }
  }

  if (includesAny(blob, [/familie/, /kinder/, /kinderwagen/, /isofix/, /hund/])) {
    if (attrs.bodyClass === 'family_suv' || attrs.bodyClass === 'large_suv') {
      score += 22;
      reasons.push('Familienauto');
    } else if (attrs.bodyClass === 'compact_suv') {
      score += 14;
      reasons.push('familientauglich');
    } else {
      score -= 12;
      reasons.push('weniger Platz');
    }
  }

  if (includesAny(blob, [/schnellladen/, /ladeleistung/, /10-80/, /langstrecke/, /reichweite/])) {
    if (modelKey === 'ev6' || modelKey === 'ev9') {
      score += 26;
      reasons.push('Schnellladen');
    } else if (modelKey === 'ev3' || modelKey === 'ev5') {
      score += 10;
      reasons.push('Reichweite');
    } else {
      score -= 6;
    }
  }

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

  if (modelKey === 'ev2' && includesAny(blob, [/familie/, /kinderwagen/, /hund/])) {
    score -= 18;
  }

  if (labels.some((l) => toLower(l) === modelKey)) {
    score += 28;
    reasons.push('explizit genannt');
  }

  if (answers.longDistance === 'often') {
    if (modelKey === 'ev6') {
      score += 32;
      reasons.push('Reisen');
    } else if (modelKey === 'ev5') {
      score -= 10;
    } else if (modelKey === 'ev3') {
      score += 6;
    }
  }

  if (answers.longDistance === 'rarely') {
    if (modelKey === 'ev3' || modelKey === 'ev2') {
      score += 16;
    }
    if (modelKey === 'ev6') {
      score -= 12;
    }
  }

  if (answers.evModelPriority === 'price') {
    if (modelKey === 'ev3' || modelKey === 'ev2') score += 22;
    if (modelKey === 'ev6' || modelKey === 'ev9') score -= 8;
    reasons.push('Preis-Leistung');
  }

  if (answers.evModelPriority === 'range') {
    if (modelKey === 'ev6' || modelKey === 'ev9') score += 24;
    reasons.push('Reichweite');
  }

  if (answers.evModelPriority === 'equipment') {
    if (modelKey === 'ev5' || modelKey === 'ev6' || modelKey === 'ev9') score += 18;
    reasons.push('Ausstattung');
  }

  if (answers.chargingAtHome === 'yes' && (modelKey === 'ev3' || modelKey === 'ev6')) {
    score += 4;
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 3) };
}

function toMatchPercent(score, topScore) {
  const spread = Math.max(topScore, 1);
  const ratio = Math.max(0, score / spread);
  return Math.round(72 + ratio * 23);
}

function rankItems(customerUnderstanding, answers = {}, limit = 3) {
  const candidates = baseCandidates(customerUnderstanding)
    .filter((key) => MODEL_CATALOG[key]);

  const ranked = candidates
    .map((modelKey) => {
      const meta = MODEL_CATALOG[modelKey];
      const s = scoreCandidate(modelKey, customerUnderstanding, answers);
      return {
        modelKey,
        title: meta.modelLabel ?? `Kia ${String(modelKey).toUpperCase()}`,
        subtitle: meta.tagline ?? '',
        rateLine: formatRate(meta.rateFrom),
        reasons: s.reasons,
        score: s.score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const topScore = ranked[0]?.score ?? 0;

  return ranked.slice(0, limit).map(({ score, ...rest }) => ({
    ...rest,
    matchPercent: toMatchPercent(score, topScore),
  }));
}

/**
 * recommendVehicles(customerUnderstanding, context?)
 * - Reader-only: erzeugt eine live Rangliste + kurze Gründe.
 */
export function recommendVehicles(customerUnderstanding = {}, context = {}) {
  if (!customerUnderstanding?.meta?.hasData) return { intro: null, items: [] };

  const labels = customerUnderstanding?.verstaendnis?.labels ?? [];
  if (!labels.length) return { intro: null, items: [] };

  const answers = context.answers ?? {};

  return {
    intro: 'Auf Basis Ihrer Angaben würde ich spontan diese Fahrzeuge anschauen:',
    items: rankItems(customerUnderstanding, answers, 3),
  };
}

/**
 * Verkäufer-Reaktion nach Rückfrage – sichtbarer Zusammenhang Frage → Fahrzeugwelt.
 */
export function buildVehicleReactionMessage(questionId, answerId) {
  if (questionId === 'longDistance' && answerId === 'often') {
    return 'Dann wird der EV6 deutlich interessanter. Die 800V-Technik spart auf langen Reisen viel Zeit.';
  }
  if (questionId === 'longDistance' && answerId === 'rarely') {
    return 'Für den Alltag bleibt der EV3 eine starke Option – kompakt und effizient.';
  }
  if (questionId === 'longDistance' && answerId === 'sometimes') {
    return 'Gut – dann halte ich EV3 und EV6 gleichermaßen im Blick.';
  }
  if (questionId === 'evModelPriority' && answerId === 'range') {
    return 'Bei Fokus auf Reichweite rückt der EV6 näher an die Spitze.';
  }
  if (questionId === 'evModelPriority' && answerId === 'price') {
    return 'Preisbewusst wäre der EV3 aktuell mein erster Blick.';
  }
  if (questionId === 'evModelPriority' && answerId === 'equipment') {
    return 'Mit mehr Ausstattung im Blick gewinnt der EV5 an Relevanz.';
  }
  return null;
}
