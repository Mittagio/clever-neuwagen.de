import { buildOfferCountLine } from '../../logic/brandResultsFilter.js';
import { buildCleverQuoteCountLine } from '../../services/cleverQuote/cleverQuoteService.js';
import './results-offer-count.css';

export default function ResultsOfferCount({ stats, cleverQuoteMode = false }) {
  if (!stats || stats.total === 0) return null;
  const line = cleverQuoteMode
    ? buildCleverQuoteCountLine(stats.visible, stats.total)
    : buildOfferCountLine(stats);
  return (
    <p className={`results-offer-count${cleverQuoteMode ? ' results-offer-count--clever-quote' : ''}`} role="status">
      {line}
    </p>
  );
}
