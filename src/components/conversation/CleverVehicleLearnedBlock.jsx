import './clever-conversation.css';

export default function CleverVehicleLearnedBlock({ labels = [] }) {
  if (!labels.length) return null;

  return (
    <section className="cc-learned cc-learned--vehicle cc-turn-enter" aria-label="Zum EV3 notiert">
      <p className="cc-learned__divider">
        <span className="cc-learned__rule" aria-hidden />
        Zum EV3 notiert
        <span className="cc-learned__rule" aria-hidden />
      </p>
      <ul className="cc-learned__list">
        {labels.map((label) => (
          <li key={label} className="cc-learned__item">
            <span className="cc-learned__check" aria-hidden>✓</span>
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
