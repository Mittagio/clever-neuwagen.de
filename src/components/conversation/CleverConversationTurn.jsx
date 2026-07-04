import { CLEVER_WORLD } from '../../services/consultation/consultationWorlds.js';
import './clever-conversation.css';

export default function CleverConversationTurn({ turn, onOptionSelect }) {
  if (!turn) return null;

  if (turn.type === 'customer') {
    return (
      <p className="cc-customer-line cc-turn-enter" aria-label="Ihre Antwort">
        {turn.text}
      </p>
    );
  }

  if (turn.type === 'clever') {
    const isVehicle = turn.world === CLEVER_WORLD.VEHICLE_CONSULTATION;

    return (
      <article
        className={`cc-clever-turn cc-turn-enter${isVehicle ? ' cc-clever-turn--vehicle' : ''}`}
        aria-labelledby={`cc-clever-${turn.id}`}
      >
        <p className="cc-clever-turn__brand" id={`cc-clever-${turn.id}`}>Clever</p>
        <p className="cc-clever-turn__text">{turn.text}</p>
        {turn.options?.length > 0 && (
          <div className="cc-clever-turn__options-wrap">
            {isVehicle && (
              <p className="cc-clever-turn__options-hint">
                {turn.optionsHint ?? 'Zum Beispiel:'}
              </p>
            )}
            <div
              className="cc-clever-turn__options"
              role="group"
              aria-label={isVehicle ? 'Antwort-Hilfen' : 'Antwortmöglichkeiten'}
            >
              {turn.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`cc-option-chip${isVehicle ? ' cc-option-chip--hint' : ''}`}
                  onClick={() => onOptionSelect?.(turn.questionId, option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {isVehicle && (
              <p className="cc-clever-turn__input-nudge">Oder unten einfach in eigenen Worten ergänzen.</p>
            )}
          </div>
        )}
      </article>
    );
  }

  if (turn.type === 'clever_reflection') {
    return (
      <article className="cc-clever-turn cc-clever-turn--reflection cc-turn-enter">
        <p className="cc-clever-turn__brand">Clever</p>
        <p className="cc-clever-turn__text">{turn.text}</p>
      </article>
    );
  }

  if (turn.type === 'thinking') {
    return (
      <p className="cc-thinking cc-turn-enter" aria-live="polite">
        {turn.text}
      </p>
    );
  }

  return null;
}
