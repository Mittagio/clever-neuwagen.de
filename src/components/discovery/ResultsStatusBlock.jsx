import './discovery-results.css';

export default function ResultsStatusBlock({ status }) {
  if (!status?.title) return null;

  return (
    <div className={`results-status results-status--${status.tone ?? 'neutral'}`} role="status">
      <p className="results-status__title">{status.title}</p>
      {status.subtitle && <p className="results-status__sub">{status.subtitle}</p>}
      {status.hint && <p className="results-status__hint">{status.hint}</p>}
    </div>
  );
}
