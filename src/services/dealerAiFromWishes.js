/**
 * Verkaufsberater-Chips → Freitext für Dealer-AI-Parser
 */
import { ALL_SALES_ADVISOR_CHIPS } from '../data/salesAdvisorChips.js';

function chipLabel(chipId) {
  if (chipId.startsWith('price_')) {
    const amount = Number(chipId.replace('price_', ''));
    if (amount) return `bis ${amount.toLocaleString('de-DE')} €`;
  }
  return ALL_SALES_ADVISOR_CHIPS.find((c) => c.id === chipId)?.label ?? chipId;
}

/**
 * @param {{ chipIds?: string[], mileagePerYear?: number|null, transcript?: string }} input
 */
export function buildDealerAiTextFromWishes({ chipIds = [], mileagePerYear = null, transcript = '' }) {
  const parts = [];
  const trimmed = transcript?.trim();

  if (trimmed) parts.push(trimmed);

  const labels = chipIds.map(chipLabel).filter(Boolean);
  if (labels.length) {
    parts.push(`Kundenwunsch: ${labels.join(', ')}`);
  }

  for (const chipId of chipIds) {
    if (chipId.startsWith('price_')) {
      const amount = Number(chipId.replace('price_', ''));
      if (amount) parts.push(`Kauf bis ${amount.toLocaleString('de-DE')} €`);
      continue;
    }
    const chip = ALL_SALES_ADVISOR_CHIPS.find((c) => c.id === chipId);
    if (!chip) continue;
    if (chip.paymentPhrase) {
      parts.push(chip.paymentPhrase);
    }
    if (chip.termMonths) {
      parts.push(`${chip.termMonths} Monate Laufzeit`);
    }
    if (chip.deliveryPhrase) {
      parts.push(chip.deliveryPhrase);
    }
    if (chip.mileagePerYear) {
      parts.push(`${chip.mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
    }
    if (chip.budgetMax) {
      parts.push(`Budget bis ${chip.budgetMax} €/Monat`);
    }
    if (chip.purchaseMax) {
      parts.push(`Kauf bis ${chip.purchaseMax.toLocaleString('de-DE')} €`);
    }
    if (chip.availability === 'sofort') {
      parts.push('sofort verfügbar');
    }
  }

  if (mileagePerYear && !parts.some((p) => p.includes('km'))) {
    parts.push(`${mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
  }

  return parts.join('. ').trim() || 'Kia Neuwagen – Kundenwunsch offen';
}
