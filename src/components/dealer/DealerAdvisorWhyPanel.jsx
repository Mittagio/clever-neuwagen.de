import { buildDealerWishCheckLines } from '../../services/dealer/dealerAdvisorPresentation.js';
import './dealer-landing.css';

export default function DealerAdvisorWhyPanel({ checks = [] }) {
  const lines = buildDealerWishCheckLines(checks);
  if (!lines.length) return null;

  return (
    <section className="dl-advisor-why" aria-labelledby="dl-advisor-why-title">
      <h3 id="dl-advisor-why-title" className="dl-advisor-why__title">
        Warum passt dieses Fahrzeug?
      </h3>
      <ul className="dl-advisor-why__list">
        {lines.map((line) => (
          <li key={line} className="dl-advisor-why__item">
            <span className="dl-advisor-why__icon" aria-hidden>✓</span>
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
