import { useState } from 'react';
import { PURCHASE_TYPE_OPTIONS } from '../../services/dealer/purchaseTypeOptions.js';
import './dealer-landing.css';

function ConfigRecap({ summary }) {
  if (!summary) return null;

  return (
    <div className="dl-purchase__recap" aria-label="Ihre Konfiguration">
      <p className="dl-purchase__recap-label">Ihr Fahrzeug</p>
      <p className="dl-purchase__recap-title">
        Kia
        {' '}
        {summary.modelLabel}
      </p>
      {summary.trimLabel && (
        <p className="dl-purchase__recap-trim">
          Ausstattung
          {' '}
          {summary.trimLabel}
        </p>
      )}
      <p className="dl-purchase__recap-meta">
        {summary.colorLabel}
        {' · '}
        {summary.powertrainLabel}
        {summary.packageLabels?.length > 0 && (
          <>
            {' · '}
            {summary.packageLabels.join(' · ')}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Kaufart – erst nach Sonderkonditionen, vor Preisen.
 */
export default function DealerPurchaseTypeCard({
  configSummary,
  value = null,
  onContinue,
}) {
  const [selected, setSelected] = useState(value);

  function handleSubmit(event) {
    event.preventDefault();
    if (!selected) return;
    onContinue?.(selected);
  }

  return (
    <section className="dl-purchase" aria-labelledby="dl-purchase-title">
      <ConfigRecap summary={configSummary} />
      <h2 id="dl-purchase-title" className="dl-purchase__title">
        Leasing, Finanzierung oder Kauf?
      </h2>

      <form className="dl-purchase__form" onSubmit={handleSubmit}>
        <fieldset className="dl-purchase__options">
          <legend className="sr-only">Kaufart</legend>
          {PURCHASE_TYPE_OPTIONS.map((option) => {
            const active = selected === option.id;
            return (
              <label
                key={option.id}
                className={`dl-purchase__option${active ? ' dl-purchase__option--active' : ''}`}
              >
                <input
                  type="radio"
                  name="purchase-type"
                  value={option.id}
                  checked={active}
                  onChange={() => setSelected(option.id)}
                />
                <span className="dl-purchase__option-body">
                  <span className="dl-purchase__option-label">{option.label}</span>
                  {option.hint && (
                    <span className="dl-purchase__option-hint">{option.hint}</span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>

        <button
          type="submit"
          className="btn btn-primary dl-purchase__cta"
          disabled={!selected}
        >
          Weiter
        </button>
      </form>
    </section>
  );
}
