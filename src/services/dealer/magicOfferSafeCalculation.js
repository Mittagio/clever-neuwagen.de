/**
 * Clever Magic Offer – Safe Calculation Layer.
 * Nur deterministische Mathematik. Keine Bank-/Leasingraten erfinden.
 */

export const COMMERCIAL_SOURCE = {
  VERIFIED_PRICE_LIST: 'verified_price_list',
  SELLER_INPUT: 'seller_input',
  UPLOADED_OFFER_PDF: 'uploaded_offer_pdf',
  DETERMINISTIC_CALC: 'deterministic_calc',
};

function toCents(euros) {
  return Math.round(Number(euros) * 100);
}

function fromCents(cents) {
  return Math.round(Number(cents)) / 100;
}

/**
 * Prozent-Rabatt auf Basisbetrag (auf Cent gerundet).
 * @param {number} baseEuros
 * @param {number} percent
 */
export function computePercentDiscount(baseEuros, percent) {
  const base = Number(baseEuros);
  const pct = Number(percent);
  if (!Number.isFinite(base) || !Number.isFinite(pct) || pct < 0) {
    return { discountAmount: null, afterDiscount: null };
  }
  const discountCents = Math.round(toCents(base) * (pct / 100));
  const afterCents = toCents(base) - discountCents;
  return {
    discountAmount: fromCents(discountCents),
    afterDiscount: fromCents(afterCents),
  };
}

/**
 * Barkauf: Positionen + %/€-Rabatt + Überführung.
 * @param {{
 *   lineItems?: Array<{ id?: string, label: string, amount: number, kind?: string }>,
 *   listPrice?: number|null,
 *   discountPercent?: number|null,
 *   discountAmount?: number|null,
 *   transferCost?: number|null,
 * }} input
 */
export function computeSafeCashOffer(input = {}) {
  const lineItems = Array.isArray(input.lineItems) ? input.lineItems.filter((row) => row && Number.isFinite(Number(row.amount))) : [];
  const listFromLines = lineItems.reduce((sum, row) => sum + Number(row.amount), 0);
  const listPrice = Number.isFinite(Number(input.listPrice))
    ? Number(input.listPrice)
    : listFromLines;

  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return {
      ok: false,
      reason: 'missing_list_price',
      lineItems,
      listPrice: null,
      discountPercent: null,
      discountAmount: null,
      vehiclePrice: null,
      transferCost: null,
      endPrice: null,
    };
  }

  let discountPercent = input.discountPercent == null || input.discountPercent === ''
    ? null
    : Number(input.discountPercent);
  if (!Number.isFinite(discountPercent)) discountPercent = null;

  let discountAmount = input.discountAmount == null || input.discountAmount === ''
    ? null
    : Number(input.discountAmount);
  if (!Number.isFinite(discountAmount)) discountAmount = null;

  if (discountPercent != null && discountAmount == null) {
    const computed = computePercentDiscount(listPrice, discountPercent);
    discountAmount = computed.discountAmount;
  } else if (discountAmount != null && discountPercent == null && listPrice > 0) {
    discountPercent = Math.round((discountAmount / listPrice) * 10000) / 100;
  }

  const vehiclePrice = Math.max(0, fromCents(toCents(listPrice) - toCents(discountAmount ?? 0)));
  const transferCost = Number.isFinite(Number(input.transferCost))
    ? Number(input.transferCost)
    : 0;
  const endPrice = fromCents(toCents(vehiclePrice) + toCents(transferCost));

  return {
    ok: true,
    reason: null,
    lineItems,
    listPrice,
    discountPercent,
    discountAmount: discountAmount ?? 0,
    vehiclePrice,
    transferCost,
    endPrice,
    sources: {
      listPrice: COMMERCIAL_SOURCE.VERIFIED_PRICE_LIST,
      discountPercent: discountPercent != null ? COMMERCIAL_SOURCE.SELLER_INPUT : null,
      discountAmount: discountPercent != null
        ? COMMERCIAL_SOURCE.DETERMINISTIC_CALC
        : (discountAmount != null ? COMMERCIAL_SOURCE.SELLER_INPUT : null),
      transferCost: COMMERCIAL_SOURCE.SELLER_INPUT,
      endPrice: COMMERCIAL_SOURCE.DETERMINISTIC_CALC,
    },
  };
}

/**
 * Positionstabelle für Magic-Review / Angebotsvorschau.
 */
export function buildOfferPositionLines({
  lineItems = [],
  listPrice = null,
  discountPercent = null,
  discountAmount = null,
  vehiclePrice = null,
  transferCost = null,
  endPrice = null,
  includeEmptyTransfer = false,
} = {}) {
  const rows = [];
  for (const item of lineItems) {
    rows.push({
      id: item.id ?? item.label,
      label: item.label,
      amount: Number(item.amount),
      kind: item.kind ?? 'position',
    });
  }
  if (listPrice != null) {
    rows.push({
      id: 'list-price',
      label: 'Listenpreis',
      amount: Number(listPrice),
      kind: 'subtotal',
    });
  }
  if (discountAmount != null && Number(discountAmount) > 0) {
    const pctLabel = discountPercent != null ? `Rabatt ${discountPercent} %` : 'Rabatt';
    rows.push({
      id: 'discount',
      label: pctLabel,
      amount: -Math.abs(Number(discountAmount)),
      kind: 'discount',
    });
  }
  if (vehiclePrice != null && (discountAmount != null || lineItems.length)) {
    rows.push({
      id: 'vehicle-price',
      label: 'Fahrzeugpreis',
      amount: Number(vehiclePrice),
      kind: 'subtotal',
    });
  }
  if (transferCost != null && (includeEmptyTransfer || Number(transferCost) > 0)) {
    rows.push({
      id: 'transfer',
      label: 'Überführung',
      amount: Number(transferCost),
      kind: 'position',
    });
  }
  if (endPrice != null) {
    rows.push({
      id: 'end-price',
      label: 'Endpreis',
      amount: Number(endPrice),
      kind: 'total',
    });
  }
  return rows;
}
