import { UNDERSTANDING_MIRROR_COPY } from '../../services/consultation/consultationHappyPath.js';
import './clever-conversation.css';

export default function CleverUnderstandingMoment({ labels = [] }) {
  if (!labels.length) return null;

  return (
    <section className="cc-understanding-mirror cc-turn-enter" aria-labelledby="cc-understanding-mirror-title">
      <p className="cc-understanding-mirror__brand">Clever</p>
      <p id="cc-understanding-mirror-title" className="cc-understanding-mirror__lead">
        {UNDERSTANDING_MIRROR_COPY.lead}
      </p>
      <ul className="cc-understanding-mirror__list">
        {labels.map((label) => (
          <li key={label} className="cc-understanding-mirror__item">
            <span className="cc-understanding-mirror__check" aria-hidden>✓</span>
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
