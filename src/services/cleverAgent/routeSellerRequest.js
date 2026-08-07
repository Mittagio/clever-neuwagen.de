/**
 * Schneller Deterministic-Pfad vs. Agent.
 * Kein Keyword-Gehirn für komplexe Dumps – nur hohe Sicherheit.
 */

const SIMPLE_FACT_RE = /^(?:was\s+(?:ist|hat|liegt)|anhängelast|wltp|reichweite|heute\s+an|öffne\s+\w+)/i;
const COMPLEX_HINT_RE = /etstell|erstell|angebot|schreib|schick|merk|gleiche|wp\b|wärmepumpe|und\s+schreib|for\s+|with\s+/i;

/**
 * @returns {'deterministic_fast_path'|'clever_agent'}
 */
export function routeSellerRequest(sellerMessage = '', options = {}) {
  const text = String(sellerMessage || '').trim();
  if (!text) return 'clever_agent';

  if (options.forceAgent) return 'clever_agent';
  if (options.workingMemory?.pendingAction) return 'clever_agent';
  if (options.workingMemory?.previousOfferPreparation && /gleich|lieber|doch|km|weiß|weiss|wp/i.test(text)) {
    return 'clever_agent';
  }

  // Einfache bekannte Fact-Fragen / Dashboard
  if (text.length < 48 && SIMPLE_FACT_RE.test(text) && !COMPLEX_HINT_RE.test(text)) {
    return 'deterministic_fast_path';
  }

  // Alles Natürliche / Messy / Multi → Agent
  if (COMPLEX_HINT_RE.test(text) || text.length > 40 || /[,;]/.test(text) || /\b(und|dann|auch)\b/i.test(text)) {
    return 'clever_agent';
  }

  // Default: Agent wenn aktiviert (Caller entscheidet Flag)
  return 'clever_agent';
}
