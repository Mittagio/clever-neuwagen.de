import { useState } from 'react';
import './dealer-landing.css';

const BUDGET_OPTIONS = [
  { id: 'budget_250', maxMonthlyRate: 250, label: 'bis 250 €' },
  { id: 'budget_300', maxMonthlyRate: 300, label: 'bis 300 €' },
  { id: 'budget_400', maxMonthlyRate: 400, label: 'bis 400 €' },
  { id: 'budget_500', maxMonthlyRate: 500, label: 'bis 500 €' },
  { id: 'budget_600', maxMonthlyRate: 600, label: 'bis 600 €' },
  { id: 'budget_open', maxMonthlyRate: null, label: 'Noch offen' },
];

/**
 * Budget-Rahmen vor dem Angebot – aus Suche vorausfüllbar.
 */
export default function DealerBudgetCard({
  configSummary,
  initialMaxMonthlyRate = null,
  onContinue,
}) {
  const [selectedId, setSelectedId] = useState(() => {
    if (initialMaxMonthlyRate == null) return 'budget_open';
    const match = BUDGET_OPTIONS.find((o) => o.maxMonthlyRate === initialMaxMonthlyRate);
    return match?.id ?? 'budget_open';
  });

  function handleSubmit(event) {
    event.preventDefault();
    const option = BUDGET_OPTIONS.find((o) => o.id === selectedId);
    onContinue?.({
      maxMonthlyRate: option?.maxMonthlyRate ?? null,
      label: option?.label ?? null,
    });
  }

  return (
    <section className="dl-budget" aria-labelledby="dl-budget-title">
      {configSummary && (
        <p className="dl-budget__vehicle">
          Kia
          {' '}
          {configSummary.modelLabel}
          {configSummary.trimLabel ? ` · ${configSummary.trimLabel}` : ''}
        </p>
      )}
      <h2 id="dl-budget-title" className="dl-budget__title">
        Welche monatliche Rate stellen Sie sich vor?
      </h2>
      <p className="dl-budget__sub">
        Damit kann der Händler passende Leasing- oder Finanzierungsbeispiele vorbereiten.
      </p>

      <form className="dl-budget__form" onSubmit={handleSubmit}>
        <div className="dl-budget__chips" role="group" aria-label="Monatliches Budget">
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`dl-budget__chip${selectedId === option.id ? ' dl-budget__chip--active' : ''}`}
              aria-pressed={selectedId === option.id}
              onClick={() => setSelectedId(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary dl-budget__cta">
          Weiter zum Angebot
        </button>
      </form>
    </section>
  );
}
