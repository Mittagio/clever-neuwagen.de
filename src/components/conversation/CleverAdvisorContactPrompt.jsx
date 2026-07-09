import { buildAdvisorContactPrompt } from '../../services/consultation/consultationOfferHandoff.js';
import './clever-conversation.css';

export default function CleverAdvisorContactPrompt({
  understandingCount = 0,
  variant = 'engaged',
  onContact,
}) {
  const prompt = buildAdvisorContactPrompt(understandingCount, variant);
  if (!prompt) return null;

  return (
    <aside
      className={`cc-advisor-contact${variant === 'opening' ? ' cc-advisor-contact--opening' : ''}`}
      aria-label="Persönliche Beratung"
    >
      {variant === 'opening' && (
        <p className="cc-advisor-contact__opening-or">oder</p>
      )}
      {prompt.hint && (
        <p className="cc-advisor-contact__hint">{prompt.hint}</p>
      )}
      <button
        type="button"
        className="cc-advisor-contact__cta"
        onClick={() => onContact?.()}
      >
        <span className="cc-advisor-contact__icon" aria-hidden>☎</span>
        Mit einem Berater sprechen
      </button>

      {prompt.optionalNote && (
        <p className="cc-advisor-contact__optional-note">{prompt.optionalNote}</p>
      )}
    </aside>
  );
}
