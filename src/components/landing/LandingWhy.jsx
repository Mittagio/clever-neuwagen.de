const WHY_ITEMS = [
  'KI-Beratung',
  'Vergleich',
  'Angebote',
  'Händlernetzwerk',
  'Aktuelle Konditionen',
  'Lieferzeiten',
];

export default function LandingWhy() {
  return (
    <section className="lp-section lp-why" aria-labelledby="lp-why-title">
      <h2 id="lp-why-title" className="lp-section__title lp-section__title--center">
        Nicht einfach Fahrzeuge suchen.
      </h2>
      <p className="lp-why__sub">Das passende Fahrzeug finden.</p>
      <ul className="lp-why__grid">
        {WHY_ITEMS.map((item) => (
          <li key={item} className="lp-why-card">
            <span className="lp-why-card__check" aria-hidden>✓</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
