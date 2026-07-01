/**
 * Antwort-Templates mit Händler-Markenwelt – Fremdmarken nur kurz einordnen.
 */
import {
  analyzeQueryBrands,
  buildDealerBrandBridge,
  FOREIGN_BRAND_DISCLAIMER,
  getDealerAlternativeModelKeys,
  getDealerBrandLabels,
} from './dealerBrandScope.js';

/**
 * @param {object} params
 */
export function buildBrandScopedKnowledgeFacts({
  query = '',
  classification = {},
  brandScope = {},
  analysis = null,
} = {}) {
  const brandAnalysis = analysis ?? analyzeQueryBrands(query, brandScope);
  const alts = getDealerAlternativeModelKeys(brandScope);
  const bridge = buildDealerBrandBridge(brandScope, alts);
  const q = query.toLowerCase();

  if (!brandAnalysis.hasForeignBrand) {
    return null;
  }

  const foreignNames = brandAnalysis.foreignMentions.map((m) => m.displayName);
  const primaryForeign = brandAnalysis.foreignMentions[0];

  if (brandScope.primaryBrand === 'byd'
    && brandAnalysis.allowedMentions.some((m) => m.brandKey === 'byd')
    && brandAnalysis.hasForeignBrand) {
    const foreignName = foreignNames.join(' vs. ');
    return {
      kind: 'general_knowledge',
      subkind: 'byd_dealer_foreign_compare',
      headline: 'BYD im Vergleich',
      shortAnswer: /zeekr/i.test(q)
        ? 'Zeekr ist ein reines Elektroauto mit Fokus auf E-Reichweite und Ladeleistung. Der BYD Seal 6 DM-i ist als Plug-in-Hybrid interessant, wenn Sie hohe Gesamtreichweite und Tank-Flexibilität möchten.'
        : `${foreignName}: kurze allgemeine Einordnung – für verbindliche BYD-Daten und Angebote ist Ihr Autohaus die richtige Quelle.`,
      kiaBridge: 'Wir können den BYD Seal 6 und passende BYD-Alternativen direkt für Sie prüfen.',
      dealerHint: 'Konkrete BYD-Ausstattung, Rate und Verfügbarkeit klärt Ihr Autohaus.',
      competitorMentions: brandAnalysis.competitorModels,
      kiaAlternatives: alts.slice(0, 3),
      primaryModelKey: alts[0] ?? 'seal',
      brandScopeMode: 'byd_dealer',
      disallowForeignDetail: true,
    };
  }

  if (/eqb/i.test(q) || (primaryForeign?.brandKey === 'mercedes' && /größe|groß|kompakt|kosten|preis/i.test(q))) {
    return {
      kind: 'general_knowledge',
      subkind: 'foreign_mercedes_eqb',
      headline: 'Mercedes EQB – kurze Einordnung',
      shortAnswer: 'Der Mercedes EQB ist ein kompakter Elektro-SUV. Zu konkreten Kosten, Ausstattung und Angeboten kann dieses Autohaus keine verbindliche Mercedes-Auskunft geben.',
      kiaBridge: bridge,
      dealerHint: FOREIGN_BRAND_DISCLAIMER,
      competitorMentions: ['Mercedes EQB'],
      kiaAlternatives: ['ev5', 'ev9'].filter((k) => alts.includes(k)),
      primaryModelKey: alts.includes('ev5') ? 'ev5' : alts[0],
      brandScopeMode: 'foreign_only',
      disallowForeignDetail: true,
    };
  }

  if (brandAnalysis.isForeignOnly && /zeekr/i.test(q) && /lad|schnell|dc|kw/i.test(q)) {
    return {
      kind: 'general_knowledge',
      subkind: 'foreign_zeekr_charging_brief',
      headline: 'Zeekr Ladegeschwindigkeit – kurze Einordnung',
      shortAnswer: 'Nach allgemeinem Datenstand hängt die Ladegeschwindigkeit vom Zeekr-Modell, Akku und der DC-Ladeleistung ab. Zu verbindlichen Zeekr-Angeboten kann Ihr Autohaus keine Auskunft geben.',
      kiaBridge: bridge,
      dealerHint: FOREIGN_BRAND_DISCLAIMER,
      competitorMentions: ['Zeekr'],
      kiaAlternatives: ['ev6', 'ev9', 'ev5', 'ev4'].filter((k) => alts.includes(k)),
      brandScopeMode: 'foreign_only',
      disallowForeignDetail: true,
    };
  }

  if (brandAnalysis.competitorBrands.includes('zeekr') && brandAnalysis.competitorBrands.includes('byd')) {
    return {
      kind: 'general_knowledge',
      subkind: 'zeekr_vs_byd_scoped',
      headline: 'Zeekr vs. BYD – kurze Einordnung',
      shortAnswer: 'Zeekr ist eher ein reines Elektroauto mit Fokus auf E-Reichweite. Der BYD Seal 6 DM-i ist eher Plug-in-Hybrid mit hoher Gesamtreichweite und Tank-Flexibilität.',
      kiaBridge: `Wenn Sie in unserer Markenwelt vergleichen möchten, schauen wir auf passende ${getDealerBrandLabels(brandScope).join('/')}-Alternativen.`,
      dealerHint: FOREIGN_BRAND_DISCLAIMER,
      competitorMentions: ['Zeekr', 'BYD'],
      kiaAlternatives: alts.slice(0, 4),
      brandScopeMode: 'foreign_comparison',
      disallowForeignDetail: true,
    };
  }

  if (brandAnalysis.isMixedWithAllowed && /gle|mercedes/i.test(q) && /ev9|kia/i.test(q)) {
    return {
      kind: 'general_knowledge',
      subkind: 'gle_vs_ev9_scoped',
      headline: 'Mercedes GLE vs. Kia EV9',
      shortAnswer: 'Der GLE punktet bei klassischer Langstrecke, Tanken und Anhänger-Flexibilität. Der Kia EV9 fährt elektrisch mit großem Raum – dafür braucht er Ladeplanung. Zum GLE können wir keine verbindliche Mercedes-Auskunft geben.',
      kiaBridge: 'Für den Kia EV9 prüft Ihr Autohaus konkrete Ausstattung, Rate und Verfügbarkeit.',
      dealerHint: 'Finale EV9-Daten und Angebote kommen vom Autohaus.',
      competitorMentions: ['Mercedes GLE'],
      kiaAlternatives: ['ev9'],
      primaryModelKey: 'ev9',
      brandScopeMode: 'mixed',
      disallowForeignDetail: true,
    };
  }

  if (brandAnalysis.isForeignOnly) {
    const name = foreignNames.join(' vs. ') || primaryForeign?.displayName || 'Fremdmarke';
    return {
      kind: 'general_knowledge',
      subkind: 'foreign_brand_brief',
      headline: `${name} – kurze Einordnung`,
      shortAnswer: `Zu ${name} können wir allgemein einordnen, worauf Sie achten sollten – verbindliche Angebote, Kosten und Ausstattung dieser Marke führt Ihr Autohaus nicht.`,
      kiaBridge: bridge,
      dealerHint: FOREIGN_BRAND_DISCLAIMER,
      competitorMentions: brandAnalysis.competitorModels,
      kiaAlternatives: alts.slice(0, 4),
      brandScopeMode: 'foreign_only',
      disallowForeignDetail: true,
    };
  }

  return null;
}
