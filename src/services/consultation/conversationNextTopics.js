/**
 * Clever Conversation Navigation – Next-Topic-Chips (reine UI-Navigation).
 * Keine needProfile-Schreibvorgänge.
 */

const MAX_NEXT_TOPICS = 4;

/**
 * @param {unknown} topics
 * @param {{ max?: number }} [options]
 * @returns {{ id: string, label: string, customerMessage: string }[]}
 */
export function sanitizeNextTopics(topics = [], options = {}) {
  const max = options.max ?? MAX_NEXT_TOPICS;
  if (!Array.isArray(topics)) return [];

  const out = [];
  const seen = new Set();

  for (const raw of topics) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id ?? '').trim().slice(0, 48);
    const label = String(raw.label ?? '').trim().slice(0, 40);
    const customerMessage = String(raw.customerMessage ?? '').trim().slice(0, 220);
    if (!id || !label || !customerMessage) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ id, label, customerMessage });
    if (out.length >= max) break;
  }

  return out;
}

function modelLabelFromKey(modelKey = '') {
  const key = String(modelKey ?? '').toLowerCase();
  if (!key) return null;
  if (key.startsWith('ev')) return key.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function pickPrimaryModelKey(needProfile = {}, notepadLabels = [], knowledge = null) {
  if (knowledge?.primaryModelKey) return String(knowledge.primaryModelKey).toLowerCase();
  if (needProfile?.selectedModelKey) return String(needProfile.selectedModelKey).toLowerCase();
  if (needProfile?.modelHint) return String(needProfile.modelHint).toLowerCase();
  const fromLabel = (notepadLabels ?? []).find((label) => /^EV\d/i.test(String(label)));
  if (fromLabel) return String(fromLabel).toLowerCase().replace(/\s+/g, '');
  return null;
}

function alreadyCovered(blob, patterns) {
  return patterns.some((re) => re.test(blob));
}

/**
 * Deterministische Next Topics für AI-Fallback / Safe Intake.
 * @param {{ needProfile?: object, notepadLabels?: string[], text?: string, knowledge?: object|null, answeredTopicIds?: string[] }} ctx
 */
export function buildDeterministicNextTopics(ctx = {}) {
  const needProfile = ctx.needProfile ?? {};
  const notepadLabels = ctx.notepadLabels ?? [];
  const text = String(ctx.text ?? '');
  const knowledge = ctx.knowledge ?? null;
  const answered = new Set((ctx.answeredTopicIds ?? []).map(String));

  const modelKey = pickPrimaryModelKey(needProfile, notepadLabels, knowledge);
  const modelLabel = modelLabelFromKey(modelKey) || 'dem Fahrzeug';
  const blob = `${text} ${notepadLabels.join(' ')}`.toLowerCase();
  const topics = [];

  const push = (id, label, customerMessage) => {
    if (answered.has(id)) return;
    if (topics.some((t) => t.id === id)) return;
    topics.push({ id, label, customerMessage });
  };

  if (modelKey) {
    if (!alreadyCovered(blob, [/reichweite|wltp|km\b/])) {
      push('range', 'Reichweite', `Wie weit kommt der ${modelLabel}?`);
    }
    if (!alreadyCovered(blob, [/anhängelast|anhaengelast|anhänger|tow/])) {
      push('towing', 'Anhängelast', `Wie hoch ist die Anhängelast beim ${modelLabel}?`);
    }
    if (!alreadyCovered(blob, [/koffer|laderaum|platz|sitze/]) || /7\s*sitze|suv/i.test(blob)) {
      push('space', 'Platz & Kofferraum', `Wie viel Platz und Kofferraum bietet der ${modelLabel}?`);
    }
    if (!alreadyCovered(blob, [/ausstattung|hud|wärmepumpe|waermepumpe/])) {
      push('equipment', 'Ausstattung', `Welche Ausstattung ist beim ${modelLabel} typisch wichtig?`);
    }
    if (modelKey === 'ev2' && !alreadyCovered(blob, [/batterie|kwh/])) {
      push('battery', 'Batterie', `Welche Batterie hat der ${modelLabel}?`);
    }
  } else if (/\belektro\b|\bsuv\b|\bkleinwagen\b/i.test(blob)) {
    push('models', 'Passende Modelle', 'Welche Kia-Modelle passen zu meinen Angaben?');
    push('range', 'Reichweite', 'Welche Reichweite wäre für mich sinnvoll?');
    push('equipment', 'Ausstattung', 'Welche Ausstattung sollte ich im Blick behalten?');
  }

  if (/sportage|hybrid/i.test(blob) && !alreadyCovered(blob, [/phev|hev|plug-?in/])) {
    push('hybrid', 'HEV oder PHEV', 'Geht es eher um Hybrid (HEV) oder Plug-in-Hybrid (PHEV)?');
  }

  if (/\bleasing\b/i.test(blob) || needProfile?.budget?.paymentType === 'leasing') {
    if (!needProfile.annualKm && !alreadyCovered(blob, [/10\.?000|15\.?000|km\/jahr|jahreskilometer/])) {
      push('mileage', 'Kilometer', 'Wie viele Kilometer fahren Sie ungefähr im Jahr?');
    }
    if (!needProfile.leaseDurationMonths && !alreadyCovered(blob, [/48\s*monat|36\s*monat|laufzeit/])) {
      push('term', 'Laufzeit', 'Welche Laufzeit schwebt Ihnen fürs Leasing vor?');
    }
  }

  return sanitizeNextTopics(topics);
}

export { MAX_NEXT_TOPICS };
