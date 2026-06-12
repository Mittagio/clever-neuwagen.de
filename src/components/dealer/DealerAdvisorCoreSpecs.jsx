import { buildAdvisorCoreHighlights } from '../../services/cleverData/cleverDataEngine.js';
import './dealer-landing.css';

export default function DealerAdvisorCoreSpecs({ vehicle }) {
  const items = buildAdvisorCoreHighlights(vehicle);
  if (!items.length) return null;

  return (
    <ul className="dl-advisor-specs" aria-label="Kernwerte">
      {items.map((item) => (
        <li key={item.id} className="dl-advisor-specs__item">
          <span className="dl-advisor-specs__icon" aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
