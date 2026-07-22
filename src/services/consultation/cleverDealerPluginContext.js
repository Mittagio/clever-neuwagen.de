/**
 * Clever Dealer Plugin – Page Context (Laufzeit, keine Kundenwahrheit).
 * Context ≠ Notizzettel. Keine Bestandsfelder.
 */

import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

export const PLUGIN_PAGE_TYPES = Object.freeze({
  DEALER_HOME: 'dealer_home',
  MODEL: 'model',
  CAMPAIGN: 'campaign',
  GENERIC: 'generic',
});

const HOME_PLACEHOLDERS = [
  'SUV mit 7 Sitzen',
  'Elektro mit Anhängerkupplung',
  'EV3 Leasing für Familie',
  'Hybrid mit 1.500 kg Anhängelast',
];

const MODEL_PLACEHOLDERS = [
  'Wie viel darf der ziehen?',
  'Hat er 7 Sitze?',
  'Was kostet er im Leasing?',
  'Wie groß ist der Kofferraum?',
];

/**
 * @param {string} [modelKey]
 * @returns {string|null}
 */
export function resolvePluginModelDisplayName(modelKey) {
  if (!modelKey) return null;
  const raw = String(modelKey).trim().toLowerCase().replace(/^kia-/, '');
  const attrs = KIA_MODEL_ATTRIBUTES[raw];
  if (attrs?.label) {
    return attrs.label.startsWith('Kia') ? attrs.label : `Kia ${attrs.label}`;
  }
  if (/^ev\d/.test(raw)) {
    return `Kia ${raw.toUpperCase()}`;
  }
  const pretty = raw.charAt(0).toUpperCase() + raw.slice(1);
  return `Kia ${pretty}`;
}

/**
 * @param {object} [raw]
 * @returns {object}
 */
export function normalizePluginPageContext(raw = {}) {
  const pageType = Object.values(PLUGIN_PAGE_TYPES).includes(raw.pageType)
    ? raw.pageType
    : PLUGIN_PAGE_TYPES.GENERIC;

  let modelKey = raw.modelKey ? String(raw.modelKey).trim().toLowerCase().replace(/^kia-/, '') : null;
  if (modelKey && !KIA_MODEL_ATTRIBUTES[modelKey] && !/^ev\d/.test(modelKey)) {
    // unbekanntes Modell behalten als Hint, ohne Inventar
  }

  return {
    dealerId: raw.dealerId ? String(raw.dealerId) : null,
    brandKey: raw.brandKey ? String(raw.brandKey) : 'kia',
    pageType,
    modelKey: modelKey || null,
    variantKey: raw.variantKey ? String(raw.variantKey) : null,
    campaign: raw.campaign ? String(raw.campaign) : null,
    utmSource: raw.utmSource ? String(raw.utmSource) : null,
    purchaseTypeHint: raw.purchaseTypeHint ? String(raw.purchaseTypeHint) : null,
    returnUrl: raw.returnUrl ? String(raw.returnUrl) : null,
  };
}

/**
 * Hero-/Opening-Copy aus Page Context – erzeugt KEINE Notizzettel-Chips.
 * @param {object} pageContext
 * @param {string} [dealerName]
 */
export function buildPluginOpeningCopy(pageContext = {}, dealerName = 'Autohaus') {
  const ctx = normalizePluginPageContext(pageContext);
  const modelName = resolvePluginModelDisplayName(ctx.modelKey);
  void dealerName;

  if (ctx.pageType === PLUGIN_PAGE_TYPES.MODEL && modelName) {
    const short = modelName.replace(/^Kia\s+/i, '');
    return {
      headline: `Sie schauen sich gerade den ${modelName} an.`,
      subline: 'Was möchten Sie dazu wissen oder was ist Ihnen beim Fahrzeug wichtig?',
      placeholder: `z. B. Anhängelast, Reichweite, 7 Sitze, Leasing …`,
      placeholders: MODEL_PLACEHOLDERS.map((p) => p.replace(/\bEV9\b/g, short).replace(/\bder\b/g, 'er')),
      voiceLabel: 'Spracheingabe',
      contextKind: 'model',
      modelName,
    };
  }

  if (ctx.pageType === PLUGIN_PAGE_TYPES.CAMPAIGN) {
    const campaign = (ctx.campaign || ctx.purchaseTypeHint || '').toLowerCase();
    if (campaign.includes('leasing') || ctx.purchaseTypeHint === 'leasing') {
      return {
        headline: 'Sie interessieren sich für unsere Leasingangebote.',
        subline: 'Was suchen Sie ungefähr?',
        placeholder: 'z. B. Elektro-SUV im Leasing für die Familie',
        placeholders: [
          'Elektro-SUV im Leasing',
          'Familie, 7 Sitze, Leasing',
          'Hybrid Leasing mit Anhängerkupplung',
          'EV3 Leasing bis 400 €',
        ],
        voiceLabel: 'Spracheingabe',
        contextKind: 'campaign',
        campaignHint: 'leasing',
      };
    }
    return {
      headline: 'Willkommen zu unserem Angebot.',
      subline: 'Beschreiben Sie einfach, wonach Sie suchen.',
      placeholder: 'z. B. SUV mit viel Platz',
      placeholders: HOME_PLACEHOLDERS,
      voiceLabel: 'Spracheingabe',
      contextKind: 'campaign',
    };
  }

  if (ctx.pageType === PLUGIN_PAGE_TYPES.DEALER_HOME || ctx.pageType === PLUGIN_PAGE_TYPES.GENERIC) {
    return {
      headline: 'Wonach suchen Sie?',
      subline:
        'Beschreiben Sie einfach Ihren Wunsch – Clever hört mit und merkt sich, was Ihnen wichtig ist.',
      placeholder: 'z. B. Elektro-SUV mit Anhängerkupplung',
      placeholders: HOME_PLACEHOLDERS,
      voiceLabel: 'Spracheingabe',
      contextKind: 'home',
    };
  }

  return {
    headline: 'Wonach suchen Sie?',
    subline:
      'Beschreiben Sie einfach Ihren Wunsch – Clever hört mit und merkt sich, was Ihnen wichtig ist.',
    placeholder: 'z. B. Elektro-SUV mit Anhängerkupplung',
    placeholders: HOME_PLACEHOLDERS,
    voiceLabel: 'Spracheingabe',
    contextKind: 'generic',
  };
}

/**
 * Kurzer Hinweis, wenn Resume auf anderer Modellseite landet – kein Auto-Wunsch.
 * @param {object} previousContext
 * @param {object} currentContext
 * @param {string[]} [notepadLabels]
 */
export function buildCrossModelResumeHint(previousContext = {}, currentContext = {}, notepadLabels = []) {
  const prev = normalizePluginPageContext(previousContext);
  const curr = normalizePluginPageContext(currentContext);
  if (!prev.modelKey || !curr.modelKey || prev.modelKey === curr.modelKey) return null;

  const prevName = resolvePluginModelDisplayName(prev.modelKey);
  const currName = resolvePluginModelDisplayName(curr.modelKey);
  const wishPreview = (notepadLabels ?? []).slice(0, 3).join(', ');

  return {
    text: wishPreview
      ? `Sie hatten zuletzt Wünsche notiert (${wishPreview}). Jetzt schauen Sie sich den ${currName} an.`
      : `Sie hatten zuletzt über den ${prevName} gesprochen. Jetzt schauen Sie sich den ${currName} an.`,
    question: `Möchten Sie bei Ihren bisherigen Wünschen bleiben oder den ${currName?.replace(/^Kia\s+/i, '')} zusätzlich anschauen?`,
    previousModelKey: prev.modelKey,
    currentModelKey: curr.modelKey,
  };
}
