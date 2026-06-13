import {
  buildDealerWhyReasonLines,
  buildDealerWishCheckLines,
} from '../../services/dealer/dealerAdvisorPresentation.js';
import './dealer-landing.css';

export default function DealerAdvisorWhyPanel({
  checks = [],
  vehicleShortName = null,
  detailed = false,
}) {
  const lines = detailed
    ? buildDealerWhyReasonLines(checks)
    : buildDealerWishCheckLines(checks);
  if (!lines.length) return null;

  const title = vehicleShortName
    ? `Warum empfiehlt Clever den ${vehicleShortName}?`
    : 'Warum passt dieses Fahrzeug?';

  return (
    <section className="dl-advisor-why" aria-labelledby="dl-advisor-why-title">
      <h3 id="dl-advisor-why-title" className="dl-advisor-why__title">
        {title}
      </h3>
      <ul className="dl-advisor-why__list">
        {lines.map((line) => (
          <li key={line} className="dl-advisor-why__item">
            <span className="dl-advisor-why__icon" aria-hidden>✅</span>
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
