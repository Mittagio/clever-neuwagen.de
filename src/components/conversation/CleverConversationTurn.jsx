import { CLEVER_WORLD } from '../../services/consultation/consultationWorlds.js';
import './clever-conversation.css';

export default function CleverConversationTurn({
  turn,
  onOptionSelect,
  isActiveQuestion = false,
}) {
  if (!turn) return null;

  if (turn.type === 'customer') {
    return (
      <article className="cc-customer-reply cc-turn-enter" aria-label="Ihre Antwort">
        <p className="cc-customer-reply__label">Sie</p>
        <p className="cc-customer-reply__text">{turn.text}</p>
      </article>
    );
  }

  if (turn.type === 'clever') {
    const isVehicle = turn.world === CLEVER_WORLD.VEHICLE_CONSULTATION;
    const hasOptions = turn.options?.length > 0;
    const isKnowledge = turn.answerKind === 'knowledge' || turn.knowledgeOnly;
    const facts = turn.facts ?? [];
    const modelCards = turn.modelCards ?? [];

    return (
      <article
        className={`cc-clever-turn cc-turn-enter${isVehicle ? ' cc-clever-turn--vehicle' : ''}${isActiveQuestion ? ' cc-clever-turn--active-question' : ''}${isKnowledge ? ' cc-clever-turn--knowledge' : ''}`}
        aria-labelledby={`cc-clever-${turn.id}`}
      >
        <p className="cc-clever-turn__brand" id={`cc-clever-${turn.id}`}>Clever</p>
        <p className="cc-clever-turn__text">{turn.text}</p>
        {facts.length > 0 && (
          <ul className="cc-knowledge-facts" aria-label="Fahrzeugdaten">
            {facts.map((fact) => (
              <li key={`${fact.label}-${fact.value}`}>
                <span className="cc-knowledge-facts__label">{fact.label}</span>
                <span className="cc-knowledge-facts__value">{fact.value}</span>
              </li>
            ))}
          </ul>
        )}
        {modelCards.length > 0 && (
          <div className="cc-knowledge-cards" aria-label="Fahrzeugrichtungen">
            {modelCards.slice(0, 3).map((card) => (
              <div key={card.modelKey ?? card.name} className="cc-knowledge-card">
                <p className="cc-knowledge-card__title">{card.name}</p>
                {card.bullets?.length > 0 && (
                  <ul className="cc-knowledge-card__bullets">
                    {card.bullets.slice(0, 4).map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {hasOptions && (
          <div className="cc-clever-turn__options-wrap">
            {turn.optionsHint && (
              <p className="cc-clever-turn__options-hint">
                {turn.optionsHint}
              </p>
            )}
            <div
              className="cc-clever-turn__options"
              role="group"
              aria-label="Vorschläge"
            >
              {turn.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`cc-option-chip${isVehicle ? ' cc-option-chip--hint' : ' cc-option-chip--suggestion'}`}
                  onClick={() => onOptionSelect?.(turn.questionId, option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="cc-clever-turn__input-nudge">
              Oder unten einfach in eigenen Worten weitererzählen.
            </p>
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
