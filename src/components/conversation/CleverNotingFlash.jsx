import './clever-conversation.css';

/**
 * Kurzer „Ich notiere mir“-Moment – ersetzt die große Learned-Karte.
 */
export default function CleverNotingFlash({ labels = [] }) {
  if (!labels.length) return null;

  return (
    <div className="cc-noting-flash cc-noting-flash--enter" role="status" aria-live="polite">
      <p className="cc-noting-flash__lead">Ich notiere mir:</p>
      <ul className="cc-noting-flash__list">
        {labels.map((label) => (
          <li key={label} className="cc-noting-flash__item">
            <span aria-hidden>✓</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
