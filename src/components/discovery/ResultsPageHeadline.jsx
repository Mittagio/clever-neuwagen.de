import './discovery-results.css';

export default function ResultsPageHeadline({ title, subtitle, hideSubtitle = false }) {
  if (!title) return null;
  return (
    <header className={`results-headline${hideSubtitle ? ' results-headline--chips-only' : ''}`}>
      <h1 className="results-headline__title">{title}</h1>
      {subtitle && !hideSubtitle && <p className="results-headline__sub">{subtitle}</p>}
    </header>
  );
}
