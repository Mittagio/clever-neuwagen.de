/**
 * A) Seller-Instruction → Intent, Seller Facts, Required Knowledge.
 */

const COLOR_RE = /\b(schwarz\w*|wei(?:ss|ß)\w*|grau\w*|silber\w*|blau\w*|rot\w*|gr[uü]n\w*|beige\w*)\b/i;
const TRIM_RE = /\b(gt[-\s]?line|core|vision|spirit|earth|air|black[-\s]?edition)\b/i;
const MODEL_RE = /\b(picanto|sportage|ev\s?[2-9]|ceed|niro|sorento|stonic|rio)\b/i;
const PACKAGE_RE = /\b(technologie[-\s]?paket|technik[-\s]?paket|drivewise(?:[-\s]?paket)?|komfort[-\s]?paket|premium[-\s]?paket)\b/i;
const SUNROOF_RE = /\b(schiebedach|panorama(?:dach)?|glasdach)\b/i;
const AVAIL_RE = /\b(da haben|haben wir|sofort verfügbar|verfügbar|auf lager|steht hier|beim händler)\b/i;
const EXPLAIN_PACKAGE_RE = /\b(erklär|erkläre|erklären|was (ist |im )?.*(paket)|inhalt|umfasst|enthalten)\b/i;
const EXPLAIN_EQUIP_RE = /\b(ausstattung|serienausstattung|welche ausstattung)\b/i;
const DOCS_ONLY_RE = /\b(unterlagen|selbstauskunft|dokumente|formulare)\b/i;

/**
 * @param {string} rawSellerInput
 * @param {{ workingContext?: object, offerContext?: object }} [ctx]
 */
export function interpretMessageInstruction(rawSellerInput = '', ctx = {}) {
  const raw = String(rawSellerInput ?? '').trim();
  const sellerFacts = [];
  const requiredKnowledge = [];
  const ambiguities = [];

  const color = raw.match(COLOR_RE)?.[1];
  if (color) {
    const base = color.toLowerCase().startsWith('schwarz')
      ? 'Schwarz'
      : color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
    sellerFacts.push({
      type: 'color',
      value: base,
      source: 'seller_input',
    });
  }

  const trimMatch = raw.match(TRIM_RE)?.[1];
  if (trimMatch) {
    const trim = trimMatch.toLowerCase().replace(/\s+/g, '-').replace(/gt.?line/, 'gt-line');
    sellerFacts.push({ type: 'trim', value: trim, source: 'seller_input' });
  }

  const modelMatch = raw.match(MODEL_RE)?.[1];
  if (modelMatch) {
    const model = modelMatch.toLowerCase().replace(/\s+/g, '');
    sellerFacts.push({ type: 'model', value: model, source: 'seller_input' });
  }

  const pkgMatch = raw.match(PACKAGE_RE)?.[1];
  if (pkgMatch) {
    sellerFacts.push({
      type: 'package_present',
      value: pkgMatch,
      source: 'seller_input',
    });
    if (EXPLAIN_PACKAGE_RE.test(raw) || /was im|inhalt|umfasst|enthalten/i.test(raw)) {
      requiredKnowledge.push('package_contents');
    }
  }

  if (SUNROOF_RE.test(raw)) {
    sellerFacts.push({ type: 'sunroof', value: 'Schiebedach', source: 'seller_input' });
  }

  if (AVAIL_RE.test(raw)) {
    sellerFacts.push({
      type: 'availability',
      value: /sofort/i.test(raw) ? 'sofort verfügbar' : 'beim Händler verfügbar',
      source: 'seller_input',
    });
  }

  if (EXPLAIN_EQUIP_RE.test(raw)) {
    requiredKnowledge.push('standard_equipment');
  }

  if (pkgMatch || trimMatch || color) {
    requiredKnowledge.push('vehicle_variant');
  }

  const docsOnly = DOCS_ONLY_RE.test(raw)
    && !pkgMatch
    && !SUNROOF_RE.test(raw)
    && !EXPLAIN_EQUIP_RE.test(raw);

  return {
    intent: 'draft_customer_message',
    raw,
    sellerFacts,
    requiredKnowledge: [...new Set(requiredKnowledge)],
    ambiguities,
    docsOnly,
    mentionedAhk: /\b(ahk|anhängerkupplung|anhaengerkupplung)\b/i.test(raw),
    hasWorkingAttachment: Boolean(ctx.workingContext?.offerId || ctx.offerContext?.offerId
      || ctx.workingContext?.modelKey || ctx.workingContext?.vehicleLabel),
  };
}
