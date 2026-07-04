import './clever-conversation.css';

export default function CleverLearnedBlock({ labels = [], compact = false }) {
  if (!labels.length) return null;

  return (
    <section
      className={`cc-learned cc-turn-enter${compact ? ' cc-learned--compact' : ''}`}
      aria-label="Das habe ich über Sie gelernt"
    >
      <p className="cc-learned__divider">
        <span className="cc-learned__rule" aria-hidden />
        Das habe ich über Sie gelernt
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
