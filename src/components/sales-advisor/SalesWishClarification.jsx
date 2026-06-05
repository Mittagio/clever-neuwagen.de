import {
  ADVISOR_CLARIFICATION_OPTIONS,
  getClarificationAntriebLabel,
} from '../../services/sales/advisorRanking.js';
import './smartSales.css';

export default function SalesWishClarification({
  chipIds = [],
  onSelectUseCase,
  onBack,
}) {
  const antriebLabel = getClarificationAntriebLabel(chipIds);

  return (
    <section className="ss-clarify" aria-labelledby="ss-clarify-title">
      <p className="ss-clarify__kicker">KI-Berater</p>
      <h1 id="ss-clarify-title">
        <span aria-hidden>⚡</span> {antriebLabel} erkannt.
      </h1>
      <p className="ss-clarify__lead">Wofür benötigen Sie das Fahrzeug?</p>
      <div className="ss-clarify__options" role="group" aria-label="Einsatzzweck wählen">
        {ADVISOR_CLARIFICATION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="ss-clarify__option"
            onClick={() => onSelectUseCase(opt.id)}
          >
            <span className="ss-clarify__option-emoji" aria-hidden>{opt.emoji}</span>
            <span className="ss-clarify__option-label">{opt.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="ss-btn ss-btn--ghost ss-clarify__back" onClick={onBack}>
        ← Wünsche ändern
      </button>
    </section>
  );
}
