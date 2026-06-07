import { buildTechnicalHighlights } from '../../services/cleverData/cleverDataEngine.js';

export default function DiscoveryTechnicalSpecs({ vehicle, className = '' }) {
  const items = buildTechnicalHighlights(vehicle);
  if (!items.length) return null;

  return (
    <ul className={`disc-tech-specs ${className}`.trim()} aria-label="Technische Daten">
      {items.map((item) => (
        <li key={item.id} className="disc-tech-specs__item">
          <span className="disc-tech-specs__icon" aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
