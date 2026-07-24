import { useMemo } from 'react';
import { buildSellerInlineContext } from '../../services/dealer/sellerInlineComposerAssist.js';
import './CustomerAkte.css';

/**
 * Einmaliger Smart-Kontext (Notizzettel-Chips) – horizontal scrollbar.
 */
export default function CustomerAkteSmartChips({
  lead,
  extraChips = [],
  onChipClick,
  maxChips = 8,
}) {
  const chips = useMemo(() => {
    const fromContext = buildSellerInlineContext(lead, '').customerChips ?? [];
    const merged = [...fromContext];
    for (const chip of extraChips) {
      const label = typeof chip === 'string' ? chip : chip?.label;
      if (!label) continue;
      if (merged.some((c) => c.label === label)) continue;
      merged.push(typeof chip === 'string' ? { label } : chip);
    }
    return merged.slice(0, maxChips);
  }, [lead, extraChips, maxChips]);

  if (!chips.length) return null;

  return (
    <div className="cust-akte-smart-chips" aria-label="Kundenkontext">
      <ul className="cust-akte-smart-chips__list">
        {chips.map((chip) => (
          <li key={chip.label}>
            <button
              type="button"
              className="cust-akte-smart-chips__chip"
              onClick={() => onChipClick?.(chip)}
            >
              {chip.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
