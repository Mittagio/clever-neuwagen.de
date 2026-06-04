import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { partitionCleverQuoteItems } from '../../services/cleverQuote/cleverQuoteService.js';
import './vehicle-detail-stream.css';

export default function VehicleDetailWhySection({
  cleverQuote,
  reasons = [],
  fulfillment,
  onCleverQuoteWhy,
}) {
  if (!cleverQuote && !reasons.length) return null;

  const packageNeeded = cleverQuote
    ? partitionCleverQuoteItems(cleverQuote).packageNeeded
    : [];

  return (
    <section className="vd-stream-block vd-stream-why" aria-labelledby="vd-stream-why-title">
      <h2 id="vd-stream-why-title" className="vd-stream-block__title">Warum passt es?</h2>
      {cleverQuote && (
        <div className="vd-stream-why__cq">
          <CleverQuoteBadge
            cleverQuote={cleverQuote}
            size="md"
            showTier={false}
            onWhyClick={onCleverQuoteWhy}
          />
          {fulfillment?.scoreLabel && (
            <p className="vd-stream-why__score">{fulfillment.scoreLabel} erfüllt</p>
          )}
        </div>
      )}
      {packageNeeded.length > 0 && (
        <p className="vd-stream-why__package-hint">
          Noch per Paket: {packageNeeded.map((i) => i.label).join(', ')}
        </p>
      )}
      {reasons.length > 0 && (
        <ul className="vd-stream-why__list">
          {reasons.map((reason) => (
            <li key={reason}>
              <span aria-hidden>✓</span>
              {reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
