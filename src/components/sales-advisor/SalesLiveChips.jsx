import { getLiveChipLabels } from '../../data/salesAdvisorChips.js';
import './smartSales.css';

export default function SalesLiveChips({ chipIds = [], onRemove, transcript = '' }) {
  const chips = getLiveChipLabels(chipIds);

  if (!chips.length && !transcript) return null;

  return (
    <div className="ss-live-chips" aria-label="Erkannte Wünsche">
      <p className="ss-live-chips__label">Live-Wünsche</p>
      <div className="ss-live-chips__row">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="ss-live-chip"
            onClick={() => onRemove?.(chip.id)}
            title="Entfernen"
          >
            {chip.label}
            <span className="ss-live-chip__x" aria-hidden>×</span>
          </button>
        ))}
      </div>
      {transcript && (
        <p className="ss-live-chips__transcript">„{transcript}“</p>
      )}
    </div>
  );
}
