import './dealer-landing.css';

export default function DealerCleverMoment({ dealerName, stats }) {
  const items = [
    {
      icon: '🏆',
      value: stats.matchingCount,
      label: 'passende Fahrzeuge für Ihre Region',
      clever: false,
    },
    {
      icon: '🚗',
      value: stats.immediateCount,
      label: 'sofort verfügbar',
      clever: true,
    },
    {
      icon: '⚡',
      value: `${stats.avgPriceAdvantagePercent} %`,
      label: 'durchschnittlicher Preisvorteil',
      clever: true,
    },
    {
      icon: '📍',
      value: `${stats.distanceKm} km`,
      label: 'entfernt',
      clever: false,
    },
  ];

  return (
    <section className="dl-clever card" aria-label="Clever-Überblick">
      <h2 className="dl-clever__welcome">
        Willkommen bei {dealerName}
      </h2>
      <ul className="dl-clever__stats">
        {items.map((item) => (
          <li key={item.label} className="dl-clever__stat">
            <span className="dl-clever__icon" aria-hidden>{item.icon}</span>
            <span className={`dl-clever__value${item.clever ? ' dl-clever__value--clever' : ''}`}>
              {item.value}
            </span>
            <span className="dl-clever__label">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
