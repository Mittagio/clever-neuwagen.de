/**
 * Ehrliche Fortschritts-/Statuszeilen für Multi-Source Review.
 * Kompakt (max. 1–2 Zeilen) – keine Checklisten-Wand im Composer.
 */

/**
 * @param {object} intake
 * @param {{
 *   attachmentCount?: number,
 *   hasContractExtract?: boolean,
 * }} [options]
 * @returns {string[]}
 */
export function buildMultiSourceProgressLines(intake = {}, options = {}) {
  const attachmentCount = Number.isFinite(Number(options.attachmentCount))
    ? Number(options.attachmentCount)
    : (Array.isArray(intake?.sources?.attachmentIds) ? intake.sources.attachmentIds.length : 0);
  const hasDocument = attachmentCount > 0
    || Boolean(options.hasContractExtract);

  const c = intake?.resolvedCustomerCandidate;
  const wish = intake?.currentVehicleInterest;
  const wishLabel = formatWishLabel(wish);
  const trade = intake?.tradeInCandidate;
  const hist = intake?.historicalContract;
  const missing = intake?.missingInformation || [];

  const bits = [
    c?.fullName ? `Kunde ${c.fullName}` : null,
    wishLabel ? `Wunsch ${shortWish(wishLabel)}` : null,
    trade?.label ? `GW ${shortWish(trade.label)}` : null,
    hist ? (hist.statusLabel || 'Altvertrag') : null,
  ].filter(Boolean);

  const head = hasDocument
    ? 'Dump und Dokument zusammengeführt'
    : 'Seller-Dump ausgewertet';
  const summary = bits.length
    ? `✓ ${head} · ${bits.slice(0, 3).join(' · ')}`
    : `✓ ${head}`;

  return [
    summary,
    missing.length ? `○ ${missing.length} Punkte noch offen` : null,
  ].filter(Boolean);
}

function shortWish(label = '') {
  return String(label)
    .replace(/^Kia\s+/i, '')
    .replace(/\s*·\s*/g, ' ')
    .trim()
    .slice(0, 42);
}

/**
 * @param {object|null|undefined} wish
 */
export function formatWishLabel(wish) {
  if (!wish) return null;
  const base = String(wish.label || [
    wish.make,
    wish.model,
    wish.trim,
    wish.color,
  ].filter(Boolean).join(' · ')).trim();
  const equipment = Array.isArray(wish.requestedEquipment) ? wish.requestedEquipment : [];
  const missingEq = equipment.filter((e) => e && !base.includes(String(e)));
  return [base, ...missingEq].filter(Boolean).join(' · ') || null;
}

/**
 * Ob die Review einen Dokument-/Attachment-Kontext hat.
 * @param {object} intake
 * @param {object} [turn]
 */
export function hasMultiSourceDocumentContext(intake = {}, turn = {}) {
  const diagCount = Number(turn?.interpreterDiagnostics?.attachmentCount);
  if (Number.isFinite(diagCount) && diagCount > 0) return true;
  if (Array.isArray(intake?.sources?.attachmentIds) && intake.sources.attachmentIds.length > 0) {
    return true;
  }
  if (Array.isArray(turn?.attachments) && turn.attachments.length > 0) return true;
  return false;
}
