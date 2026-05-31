const TRUST_ITEMS = [
  {
    icon: '🤖',
    tone: 'violet',
    title: 'KI Kaufberatung',
    text: 'Finden Sie das perfekte Auto anhand Ihres Lebensstils.',
  },
  {
    icon: '📊',
    tone: 'blue',
    title: 'Aktuelle Leasingraten',
    text: 'Transparente Raten von verlässlichen Partnern.',
  },
  {
    icon: '⏱',
    tone: 'green',
    title: 'Lieferzeiten',
    text: 'Aktuelle Verfügbarkeiten auf einen Blick.',
  },
  {
    icon: '🏪',
    tone: 'amber',
    title: 'Händlerangebote',
    text: 'Top Angebote von geprüften Händlern in Ihrer Nähe.',
  },
];

export default function LandingTrust() {
  return (
    <section className="lp-trust-bar" aria-labelledby="lp-trust-title">
      <h2 id="lp-trust-title" className="visually-hidden">Vertrauen & Leistungen</h2>
      <div className="lp-trust-bar__card">
        {TRUST_ITEMS.map((item, i) => (
          <article key={item.title} className="lp-trust-bar__item">
            {i > 0 && <span className="lp-trust-bar__divider" aria-hidden />}
            <span className={`lp-trust-bar__icon lp-trust-bar__icon--${item.tone}`} aria-hidden>
              {item.icon}
            </span>
            <h3 className="lp-trust-bar__title">{item.title}</h3>
            <p className="lp-trust-bar__text">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
