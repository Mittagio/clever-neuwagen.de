import { buildOfferCountLine } from '../../logic/brandResultsFilter.js';
import './results-offer-count.css';

export default function ResultsOfferCount({ stats }) {
  if (!stats || stats.total === 0) return null;
  const line = buildOfferCountLine(stats);
  return (
    <p className="results-offer-count" role="status">
      {line}
    </p>
  );
}
