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
    return (
      <article className="cc-clever-turn cc-turn-enter" aria-labelledby={`cc-clever-${turn.id}`}>
        <p className="cc-clever-turn__brand" id={`cc-clever-${turn.id}`}>Clever</p>
        <p className="cc-clever-turn__text">{turn.text}</p>
        {turn.options?.length > 0 && (
          <div className="cc-clever-turn__options" role="group" aria-label="Antwortmöglichkeiten">
            {turn.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="cc-option-chip"
                onClick={() => onOptionSelect?.(turn.questionId, option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
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
