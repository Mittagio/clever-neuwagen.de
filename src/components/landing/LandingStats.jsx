const STATS = [
  { icon: '👥', value: '1.000+', label: 'Zufriedene Kunden' },
  { icon: '⭐', value: '4,8 / 5', label: 'Durchschnittliche Bewertung' },
  { icon: '🏪', value: '250+', label: 'Geprüfte Händler' },
  { icon: '🚗', value: '20.000+', label: 'Erfolgreiche Vermittlungen' },
];

export default function LandingStats() {
  return (
    <section className="lp-stats" aria-label="Kennzahlen">
      <div className="lp-stats__card">
        {STATS.map((item, i) => (
          <div key={item.label} className="lp-stats__item">
            {i > 0 && <span className="lp-stats__divider" aria-hidden />}
            <span className="lp-stats__icon" aria-hidden>{item.icon}</span>
            <p className="lp-stats__value">{item.value}</p>
            <p className="lp-stats__label">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="lp-stats__mock-note">Demo-Kennzahlen · Mockdaten</p>
    </section>
  );
}
