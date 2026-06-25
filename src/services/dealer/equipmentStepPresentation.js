/**
 * Neutrale Darstellung im Ausstattungsschritt (ohne feste Kaufart).
 */

/** @typedef {'cash'|'finance'|'leasing'} PurchaseType */

/**
 * @param {PurchaseType|null|undefined} knownPurchaseType
 * @param {boolean} hasWishes
 */
export function getEquipmentStepCta(knownPurchaseType, hasWishes = false) {
  if (!knownPurchaseType) {
    return {
      actionLabel: hasWishes ? 'Auswählen' : 'Empfehlung übernehmen',
      actionHint: 'Zahlungsart wählen Sie später.',
    };
  }

  if (knownPurchaseType === 'leasing') {
    return {
      actionLabel: hasWishes
        ? 'Auswählen'
        : 'Empfehlung übernehmen',
      actionHint: null,
    };
  }

  if (knownPurchaseType === 'finance') {
    return {
      actionLabel: hasWishes
        ? 'Auswählen'
        : 'Empfehlung übernehmen',
      actionHint: null,
    };
  }

  return {
    actionLabel: hasWishes
      ? 'Auswählen'
      : 'Angebot anfragen',
    actionHint: null,
  };
}

/**
 * CTAs für Kunden-Journey (unverbindliche Einschätzung, kein Verkauf).
 * @param {boolean} hasWishes
 */
export function getCustomerAdvisorStepCta(hasWishes = false) {
  return {
    actionLabel: hasWishes ? 'Clever Einschätzung anzeigen' : null,
    actionHint: hasWishes ? null : 'Bitte mindestens einen Wunsch wählen.',
    reserveLabel: 'Für Verkäufer vormerken',
  };
}

/**
 * @param {number} index
 * @param {number} total
 */
export function getNeutralPriceTierLabel(index, total) {
  if (total <= 1) return 'Preis im nächsten Schritt';
  if (index === 0) return 'günstigste Variante';
  if (index === total - 1) return 'Premium & Design';
  if (index === 1 && total >= 3) return 'beste Preis-Leistung';
  return 'mittleres Preisniveau';
}

/**
 * @param {object} params
 * @param {string} params.trimName
 * @param {number|null|undefined} params.cashDelta
 * @param {number|null|undefined} params.rateDelta
 * @param {(n: number) => string} params.formatCurrency
 */
export function formatTrimSurchargeLabel({
  trimName,
  cashDelta,
  rateDelta,
  formatCurrency,
}) {
  const parts = [];
  if (cashDelta != null && cashDelta > 0) {
    parts.push(formatCurrency(cashDelta));
  }
  if (rateDelta != null && rateDelta > 0) {
    parts.push(`(+${formatCurrency(rateDelta)} Rate)`);
  }
  if (!parts.length) return null;
  return `+ ${trimName} + ${parts.join(' ')}`;
}

/**
 * @param {object} params
 * @param {PurchaseType|null|undefined} params.knownPurchaseType
 * @param {number|null|undefined} params.rate
 * @param {number|null|undefined} params.rateDelta
 * @param {number|null|undefined} params.cashPrice
 * @param {number|null|undefined} params.cashDelta
 * @param {string} params.trimName
 * @param {number} params.index
 * @param {number} params.total
 * @param {(n: number) => string} params.formatCurrency
 */
export function resolveTrimPriceDisplay({
  knownPurchaseType,
  rate,
  rateDelta,
  cashPrice,
  cashDelta,
  trimName,
  index,
  total,
  formatCurrency,
}) {
  if (!knownPurchaseType) {
    return {
      primary: getNeutralPriceTierLabel(index, total),
      secondary: null,
      neutral: true,
    };
  }

  if (index > 0 && (cashDelta > 0 || rateDelta > 0)) {
    const surcharge = formatTrimSurchargeLabel({
      trimName,
      cashDelta,
      rateDelta,
      formatCurrency,
    });
    if (surcharge) {
      return {
        primary: surcharge,
        secondary: rate != null && knownPurchaseType !== 'cash'
          ? `${formatCurrency(rate)}/Monat`
          : (cashPrice != null && knownPurchaseType === 'cash' ? formatCurrency(cashPrice) : null),
        neutral: false,
      };
    }
  }

  if (knownPurchaseType === 'cash') {
    return {
      primary: cashPrice != null ? formatCurrency(cashPrice) : 'Preis im Angebot',
      secondary: cashDelta != null && cashDelta > 0 ? `+${formatCurrency(cashDelta)}` : null,
      neutral: false,
    };
  }

  const primary = rate != null ? `${formatCurrency(rate)}/Monat` : null;
  const secondary = rateDelta != null && rateDelta > 0 && index === 0
    ? `+${formatCurrency(rateDelta)}/Monat`
    : null;

  return {
    primary: primary ?? getNeutralPriceTierLabel(index, total),
    secondary,
    neutral: primary == null,
  };
}
