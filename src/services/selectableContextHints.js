/**
 * Clever Antworten – optionale persönliche Details (nur bei Verkäufer-Auswahl)
 */

const FORBIDDEN_HINT_PATTERNS = [
  /einkommen/i,
  /bonit/i,
  /arbeitgeber/i,
  /gehaltsnachweis/i,
  /gehalt\b/i,
  /verdient/i,
];

const HINT_SNIPPETS = {
  ahk: 'Wenn Anhängerkupplung oder Stützlast für Sie wichtig sind, prüfe ich das final gerne sauber mit.',
  familie: 'Gerade für den Familienalltag lohnt sich der Blick auf Platz, Isofix und Kofferraum.',
  partner: 'Sie können die Varianten in Ruhe gemeinsam vergleichen.',
  dringlichkeit: 'Ich halte auch kurzfristig verfügbare Optionen im Blick, falls es zeitlich drängt.',
  tee_kaffee: 'Gerne können wir die Varianten auch in Ruhe bei einer Tasse Tee oder Kaffee besprechen.',
  budget: 'Ich habe die monatliche Belastung im Blick behalten.',
  kurz_whatsapp: null,
};

function collectKnowledgeText(context = {}) {
  const parts = [];
  for (const fact of context.kundenwissen?.facts ?? []) {
    if (fact?.text) parts.push(fact.text);
  }
  if (!parts.length) {
    for (const chip of context.legacy?.kundenhelferChips ?? []) {
      if (chip) parts.push(chip);
    }
  }
  for (const signal of context.advisor?.extractedSignals ?? []) {
    if (signal) parts.push(signal);
  }
  return parts.join(' · ').toLowerCase();
}

function matchesAny(text = '', patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function detectHintAvailability(context = {}) {
  const knowledge = collectKnowledgeText(context);

  return {
    ahk: /ahk|anhänger|stützlast|wohnwagen|anhängerkupplung/i.test(knowledge),
    familie: /kinder|familie|isofix|hund|kindersitz|partner/i.test(knowledge),
    partner: /partner|gemeinsam|ehefrau|ehemann|entscheidet mit/i.test(knowledge),
    dringlichkeit: /sofort|kurzfristig|schnell|ersatz|dringend|eilig/i.test(knowledge),
    tee_kaffee: true,
    budget: /budget|rate|preis.*wichtig|monatlich/i.test(knowledge)
      && !matchesAny(knowledge, FORBIDDEN_HINT_PATTERNS),
    kurz_whatsapp: true,
  };
}

/**
 * @returns {Array<{ id: string, label: string, available: boolean, snippet: string|null }>}
 */
export function buildSelectableContextHints(context = {}) {
  const availability = detectHintAvailability(context);

  return [
    { id: 'ahk', label: 'AHK erwähnen', available: availability.ahk, snippet: HINT_SNIPPETS.ahk },
    { id: 'familie', label: 'Familie erwähnen', available: availability.familie, snippet: HINT_SNIPPETS.familie },
    { id: 'partner', label: 'Partnerentscheidung erwähnen', available: availability.partner, snippet: HINT_SNIPPETS.partner },
    { id: 'dringlichkeit', label: 'Dringlichkeit erwähnen', available: availability.dringlichkeit, snippet: HINT_SNIPPETS.dringlichkeit },
    { id: 'tee_kaffee', label: 'Tee/Kaffee-Abschluss', available: availability.tee_kaffee, snippet: HINT_SNIPPETS.tee_kaffee },
    { id: 'budget', label: 'Budget vorsichtig erwähnen', available: availability.budget, snippet: HINT_SNIPPETS.budget },
    { id: 'kurz_whatsapp', label: 'Kurz & WhatsApp-tauglich', available: availability.kurz_whatsapp, snippet: HINT_SNIPPETS.kurz_whatsapp },
  ].filter((hint) => hint.available);
}

export function applySelectedContextHints(text = '', selectedHintIds = [], hints = []) {
  const selected = hints.filter((hint) => selectedHintIds.includes(hint.id));
  const snippets = selected
    .map((hint) => hint.snippet)
    .filter(Boolean);

  let result = text;
  if (selectedHintIds.includes('kurz_whatsapp')) {
    result = shortenWhatsApp(result);
  }

  if (!snippets.length) return result;

  const lines = result.split('\n');
  const closingIndex = lines.findIndex((line, index) => index > 0 && /^Viele Grüße|^Grüße/i.test(line));
  const insertAt = closingIndex > 0 ? closingIndex : lines.length;
  lines.splice(insertAt, 0, '', ...snippets);
  return lines.join('\n').trim();
}

function shortenWhatsApp(text = '') {
  const paragraphs = text.split('\n\n').filter(Boolean);
  if (paragraphs.length <= 3) return text;
  const greeting = paragraphs[0];
  const body = paragraphs.slice(1, -1).join(' ');
  const closing = paragraphs[paragraphs.length - 1];
  const shortBody = body.length > 220 ? `${body.slice(0, 217).trim()}…` : body;
  return [greeting, shortBody, closing].join('\n\n');
}

export function buildRefineHintOptions(context = {}) {
  const hints = buildSelectableContextHints(context);
  const refine = [
    { id: 'mehr_beratung', label: 'Mehr Beratung' },
    { id: 'preis_hervorheben', label: 'Preis hervorheben' },
  ];
  if (hints.some((hint) => hint.id === 'ahk')) {
    refine.push({ id: 'ahk_erwaehnen', label: 'AHK erwähnen' });
  }
  if (hints.some((hint) => hint.id === 'familie')) {
    refine.push({ id: 'familie_erwaehnen', label: 'Familie erwähnen' });
  }
  return refine;
}
