import { buildAdvisorContactPrompt } from '../../services/consultation/consultationOfferHandoff.js';
import './clever-conversation.css';

export default function CleverAdvisorContactPrompt({
  understandingCount = 0,
  onContact,
}) {
  const prompt = buildAdvisorContactPrompt(understandingCount);
  if (!prompt) return null;

  return (
    <aside className="cc-advisor-contact" aria-label="Persönliche Beratung">
      <p className="cc-advisor-contact__hint">{prompt.hint}</p>
      <button
        type="button"
        className="cc-advisor-contact__cta"
        onClick={onContact}
      >
        <span className="cc-advisor-contact__icon" aria-hidden>☎</span>
        Mit einem Berater sprechen
      </button>
    </aside>
  );
}
