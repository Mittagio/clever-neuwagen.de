/**
 * Händler-Markenwelt für Frag Clever – Fremdmarken nur kurz, eigene Marken ausführlich.
 */
import { QUERY_TYPES } from './customerQueryTypes.js';
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';

/** @typedef {{ brandKey: string, label: string, patterns: RegExp[], modelPatterns?: RegExp[] }} BrandPattern */

/** @type {BrandPattern[]} */
export const BRAND_MENTION_PATTERNS = [
  {
    brandKey: 'kia',
    label: 'Kia',
    patterns: [/\bkia\b/i, /\bev[2-9]\b/i, /\bsorento\b/i, /\bsportage\b/i, /\bniro\b/i, /\bceed\b/i, /\bstonic\b/i, /\bpicanto\b/i, /\bseltos\b/i, /\bxceed\b/i, /\bpv5\b/i],
  },
  {
    brandKey: 'suzuki',
    label: 'Suzuki',
    patterns: [/\bsuzuki\b/i, /\bswift\b/i, /\bvitara\b/i, /\bs\-cross\b/i, /\bignis\b/i, /\bjimny\b/i],
  },
  {
    brandKey: 'kgm',
    label: 'KGM',
    patterns: [/\bkgm\b/i, /\btorres\b/i, /\bactyon\b/i, /\bmu[sx]\b/i, /\brenault\s*samsung\b/i],
  },
  {
    brandKey: 'byd',
    label: 'BYD',
    patterns: [/\bbyd\b/i, /\bseal\s*6?\b/i, /\bseal\b/i, /\battor\b/i, /\btang\b/i, /\bdolphin\b/i],
  },
  {
    brandKey: 'mercedes',
    label: 'Mercedes',
    patterns: [/\bmercedes(?:-benz)?\b/i, /\beqb\b/i, /\beqc\b/i, /\beqs\b/i, /\bgle\b/i, /\bgla\b/i, /\beq[ase]\b/i],
    modelPatterns: [/\beqb\b/i, /\bgle\b/i, /\beqc\b/i],
  },
  {
    brandKey: 'bmw',
    label: 'BMW',
    patterns: [/\bbmw\b/i, /\bix\d?\b/i, /\bi[x34578]\b/i],
    modelPatterns: [/\bix\b/i, /\bi[47]\b/i],
  },
  {
    brandKey: 'vw',
    label: 'VW',
    patterns: [/\bvolkswagen\b/i, /\bvw\b/i, /\bid\.?\s*buzz\b/i, /\bid\.?\s*[34]\b/i, /\btiguan\b/i, /\bpassat\b/i],
    modelPatterns: [/\bid\.?\s*buzz\b/i],
  },
  {
    brandKey: 'zeekr',
    label: 'Zeekr',
    patterns: [/\bzeekr\b/i, /\b001\b/i, /\bx\b/i],
  },
  {
    brandKey: 'tesla',
    label: 'Tesla',
    patterns: [/\btesla\b/i, /\bmodel\s*[3sxy]\b/i],
    modelPatterns: [/\bmodel\s*y\b/i],
  },
  {
    brandKey: 'audi',
    label: 'Audi',
    patterns: [/\baudi\b/i, /\bq4\s*e-?tron\b/i, /\be-?tron\b/i],
  },
  {
    brandKey: 'hyundai',
    label: 'Hyundai',
    patterns: [/\bhyundai\b/i, /\bioniq\b/i, /\btucson\b/i],
  },
  {
    brandKey: 'toyota',
    label: 'Toyota',
    patterns: [/\btoyota\b/i, /\bprius\b/i, /\brav4\b/i],
  },
  {
    brandKey: 'skoda',
    label: 'Skoda',
    patterns: [/\bskoda\b/i, /\benyaq\b/i],
  },
];

/** @type {Record<string, { dealerId: string, allowedBrands: string[], primaryBrand: string }>} */
export const DEALER_BRAND_SCOPES = {
  'autohaus-trinkle': {
    dealerId: 'autohaus-trinkle',
    allowedBrands: ['kia', 'suzuki', 'kgm'],
    primaryBrand: 'kia',
  },
  'byd-haendler-demo': {
    dealerId: 'byd-haendler-demo',
    allowedBrands: ['byd'],
    primaryBrand: 'byd',
  },
};

const DEFAULT_DEALER_SCOPE = DEALER_BRAND_SCOPES['autohaus-trinkle'];

/** Alternative Modell-Keys pro Händler-Markenwelt (Kia-first bei Trinkle) */
const DEALER_ALTERNATIVE_MODELS = {
  'autohaus-trinkle': {
    kia: ['ev5', 'ev9', 'ev4', 'ev6', 'sportage', 'sorento'],
    suzuki: ['swift', 'vitara'],
    kgm: ['torres'],
  },
  'byd-haendler-demo': {
    byd: ['seal', 'atto-3', 'tang'],
  },
};

/**
 * @param {string|null|undefined} dealerId
 */
export function getDealerBrandScope(dealerId) {
  const key = String(dealerId ?? '').trim();
  return DEALER_BRAND_SCOPES[key] ?? DEFAULT_DEALER_SCOPE;
}

/**
 * @param {string} query
 */
export function extractBrandMentions(query = '') {
  const text = String(query);
  const found = [];

  for (const entry of BRAND_MENTION_PATTERNS) {
    if (!entry.patterns.some((re) => re.test(text))) continue;

    let modelLabel = null;
    for (const mp of entry.modelPatterns ?? entry.patterns) {
      const m = text.match(mp);
      if (m) {
        modelLabel = m[0];
        break;
      }
    }

    found.push({
      brandKey: entry.brandKey,
      brandLabel: entry.label,
      modelLabel,
      displayName: modelLabel ? `${entry.label} ${modelLabel}` : entry.label,
    });
  }

  const seen = new Set();
  return found.filter((item) => {
    const key = `${item.brandKey}:${item.modelLabel ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {string} brandKey
 * @param {{ allowedBrands: string[] }} brandScope
 */
export function isBrandInScope(brandKey, brandScope) {
  return brandScope.allowedBrands.includes(brandKey);
}

/**
 * @param {string} query
 * @param {{ allowedBrands: string[], dealerId: string, primaryBrand: string }} brandScope
 */
export function analyzeQueryBrands(query = '', brandScope = DEFAULT_DEALER_SCOPE) {
  const mentions = extractBrandMentions(query);
  const allowedMentions = mentions.filter((m) => isBrandInScope(m.brandKey, brandScope));
  const foreignMentions = mentions.filter((m) => !isBrandInScope(m.brandKey, brandScope));

  const kiaModelKey = detectModelKeyInQuery(query);

  return {
    allowedMentions,
    foreignMentions,
    allowedBrands: [...new Set(allowedMentions.map((m) => m.brandKey))],
    competitorBrands: [...new Set(foreignMentions.map((m) => m.brandKey))],
    competitorModels: foreignMentions.map((m) => m.displayName),
    hasAllowedBrand: allowedMentions.length > 0 || Boolean(kiaModelKey && isBrandInScope('kia', brandScope)),
    hasForeignBrand: foreignMentions.length > 0,
    isForeignOnly: foreignMentions.length > 0 && allowedMentions.length === 0 && !kiaModelKey,
    isMixedWithAllowed: foreignMentions.length > 0 && (allowedMentions.length > 0 || Boolean(kiaModelKey)),
    kiaModelKey: kiaModelKey && isBrandInScope('kia', brandScope) ? kiaModelKey : null,
  };
}

/**
 * @param {string} query
 * @param {object} brandScope
 * @param {object} classification
 */
export function enrichClassificationWithBrandScope(query, brandScope, classification = {}) {
  const analysis = analyzeQueryBrands(query, brandScope);
  if (!analysis.hasForeignBrand) {
    return { classification, analysis, brandScopeApplied: false };
  }

  const next = { ...classification };

  if (analysis.isForeignOnly) {
    const isComparison = analysis.competitorBrands.length >= 2
      || /\b(oder|vs\.?|versus|vergleich)\b/i.test(query);
    next.queryType = isComparison
      ? QUERY_TYPES.COMPETITOR_COMPARISON
      : QUERY_TYPES.COMPETITOR_QUESTION;
    next.topic = isComparison ? 'foreign_comparison' : 'foreign_brand_question';
    next.shouldShowModels = false;
    next.shouldAskForContact = false;
    next.needsDealerCheck = false;
  } else if (analysis.isMixedWithAllowed) {
    next.queryType = QUERY_TYPES.COMPETITOR_COMPARISON;
    next.topic = 'foreign_vs_dealer_brand';
    if (analysis.kiaModelKey) {
      next.modelKey = analysis.kiaModelKey;
    }
  }

  next.competitorBrands = analysis.competitorBrands;
  next.competitorModels = analysis.competitorModels;
  next.brandScopeMode = analysis.isMixedWithAllowed ? 'mixed' : 'foreign_only';

  return { classification: next, analysis, brandScopeApplied: true };
}

/**
 * @param {{ allowedBrands: string[], dealerId: string, primaryBrand: string }} brandScope
 * @param {object} [analysis]
 */
export function getDealerBrandLabels(brandScope) {
  return brandScope.allowedBrands.map((key) => {
    const pattern = BRAND_MENTION_PATTERNS.find((p) => p.brandKey === key);
    return pattern?.label ?? key.toUpperCase();
  });
}

/**
 * @param {{ dealerId: string, primaryBrand: string }} brandScope
 */
export function getDealerAlternativeModelKeys(brandScope) {
  const map = DEALER_ALTERNATIVE_MODELS[brandScope.dealerId] ?? DEALER_ALTERNATIVE_MODELS['autohaus-trinkle'];
  const keys = [];
  for (const brand of brandScope.allowedBrands) {
    keys.push(...(map[brand] ?? []));
  }
  return [...new Set(keys)];
}

/**
 * Freundliche Brücke zur Händler-Markenwelt.
 * @param {{ allowedBrands: string[], dealerId: string, primaryBrand: string }} brandScope
 * @param {string[]} [modelKeys]
 */
export function buildDealerBrandBridge(brandScope, modelKeys = null) {
  const labels = getDealerBrandLabels(brandScope).join(', ');
  const alts = modelKeys ?? getDealerAlternativeModelKeys(brandScope).slice(0, 3);
  const primary = brandScope.primaryBrand;
  const primaryLabel = BRAND_MENTION_PATTERNS.find((p) => p.brandKey === primary)?.label ?? primary;

  if (primary === 'kia' && alts.length) {
    const names = alts.map((k) => k.toUpperCase()).join(' oder ');
    return `Wenn Sie ein ähnliches Fahrzeug in unserer Markenwelt suchen, prüfen wir gerne passende Alternativen – bei ${primaryLabel} z. B. ${names}.`;
  }

  if (primary === 'byd') {
    return 'In unserer Markenwelt können wir Ihnen passende BYD-Modelle und Angebote direkt prüfen.';
  }

  return `Wenn Sie möchten, vergleichen wir Ihren Wunsch mit passenden Modellen unseres Autohauses (${labels}).`;
}

export const FOREIGN_BRAND_DISCLAIMER = 'Zu konkreten Angeboten dieser Marke kann Ihr Autohaus keine verbindliche Auskunft geben. Wir können aber passende Alternativen aus unserer Markenwelt prüfen.';

/**
 * @param {string} text
 * @param {{ allowedBrands: string[] }} brandScope
 */
export function textMentionsForeignBrand(text = '', brandScope) {
  const mentions = extractBrandMentions(text);
  return mentions.some((m) => !isBrandInScope(m.brandKey, brandScope));
}

/**
 * Follow-ups filtern – keine Fremdmarken-Detailpfade.
 * @param {object[]} suggestions
 * @param {{ allowedBrands: string[] }} brandScope
 */
export function filterFollowUpsForBrandScope(suggestions = [], brandScope) {
  const blockedOfferPatterns = [
    /\bangebot\b.*\b(mercedes|bmw|zeekr|tesla|audi|vw|volkswagen|hyundai|toyota|skoda)\b/i,
    /\b(mercedes|bmw|zeekr|tesla|audi|vw)\b.*\bangebot\b/i,
    /\bmehr\s+infos?\s+(zum|zur|bei)\s+(mercedes|bmw|zeekr|tesla|audi|vw|byd)\b/i,
    /\b(mercedes|bmw|zeekr|tesla)\b.*\b(kosten|leasing|rate|varianten)\b/i,
    /\bzeekr\b.*\btechnisch/i,
  ];

  return suggestions.filter((item) => {
    const combined = `${item.label ?? ''} ${item.query ?? ''}`;
    if (textMentionsForeignBrand(combined, brandScope)) {
      const mentions = extractBrandMentions(combined);
      const onlyForeign = mentions.every((m) => !isBrandInScope(m.brandKey, brandScope));
      if (onlyForeign) return false;
    }
    if (blockedOfferPatterns.some((re) => re.test(combined))) return false;
    return true;
  }).slice(0, 4);
}

/**
 * @param {string} query
 * @param {object} analysis
 * @param {object} brandScope
 */
export function buildCompetitorInterest(query, analysis, brandScope) {
  if (!analysis?.hasForeignBrand) return null;
  const primary = analysis.foreignMentions[0];
  return {
    brand: primary?.brandLabel ?? analysis.competitorBrands[0] ?? null,
    model: primary?.modelLabel ?? analysis.competitorModels[0] ?? null,
    rawText: query,
    dealerAllowedBrands: brandScope.allowedBrands,
  };
}

/**
 * CRM-Signale bei Fremdmarkeninteresse.
 * @param {object} analysis
 * @param {string} query
 */
export function buildBrandScopeCrmSignals(analysis, query = '') {
  if (!analysis?.hasForeignBrand) return [];
  const signals = ['Fremdmarkenvergleich', 'Alternative aus Händler-Marken prüfen'];
  for (const m of analysis.foreignMentions) {
    signals.push(`${m.displayName} Interesse`);
  }
  if (/\bgröße|groß|kompakt|platz/i.test(query)) signals.push('Größe wichtig');
  if (/\bkosten|preis|leasing|rate/i.test(query)) signals.push('Kosten wichtig');
  return [...new Set(signals)];
}
