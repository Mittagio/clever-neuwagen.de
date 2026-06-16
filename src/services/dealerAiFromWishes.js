/**
 * Verkaufsberater-Chips → Freitext für Dealer-AI-Parser
 */
import { ALL_SALES_ADVISOR_CHIPS } from '../data/salesAdvisorChips.js';

function chipLabel(chipId) {
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
    if (chip.availability === 'sofort') {
      parts.push('sofort verfügbar');
    }
  }

  if (mileagePerYear && !parts.some((p) => p.includes('km'))) {
    parts.push(`${mileagePerYear.toLocaleString('de-DE')} km/Jahr`);
  }

  return parts.join('. ').trim() || 'Kia Neuwagen – Kundenwunsch offen';
}
