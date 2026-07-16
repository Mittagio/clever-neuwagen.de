import { CLEVER_WORLD } from '../../services/consultation/consultationWorlds.js';
import { looksTechnicalFactLabel } from '../../services/clever/openai/conversationFactDisplay.js';
import './clever-conversation.css';

function FactChips({ facts = [] }) {
  const visible = facts
    .map((fact) => {
      const chip = fact.chip || [fact.icon, fact.label || fact.value].filter(Boolean).join(' ');
      if (!chip || looksTechnicalFactLabel(chip) || looksTechnicalFactLabel(fact.label)) return null;
      return { key: `${fact.key ?? chip}-${chip}`, chip };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (!visible.length) return null;

  return (
    <ul className="cc-fact-chips" aria-label="Fahrzeugdaten">
      {visible.map((fact) => (
        <li key={fact.key} className="cc-fact-chip">{fact.chip}</li>
      ))}
    </ul>
  );
}

function VehicleAttachments({ cards = [], onPrimaryAction }) {
  const visible = cards.slice(0, 2);
  if (!visible.length) return null;

  return (
    <div className="cc-attach-rail" aria-label="Fahrzeuganhänge">
      {visible.map((card) => (
        <article key={card.modelKey ?? card.name} className="cc-attach-card">
          {card.image ? (
            <img
              className="cc-attach-card__img"
              src={card.image}
              alt=""
              loading="lazy"
            />
          ) : (
            <div className="cc-attach-card__img cc-attach-card__img--placeholder" aria-hidden />
          )}
          <div className="cc-attach-card__body">
            <p className="cc-attach-card__title">{card.name}</p>
            {card.subtitle && <p className="cc-attach-card__sub">{card.subtitle}</p>}
            {card.factLine && <p className="cc-attach-card__facts">{card.factLine}</p>}
            {!card.factLine && card.bullets?.[0] && (
              <p className="cc-attach-card__facts">{card.bullets[0]}</p>
            )}
            <button
              type="button"
              className="cc-attach-card__cta"
              onClick={() => onPrimaryAction?.(card.modelKey)}
            >
              {card.ctaLabel ?? 'Ansehen'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function CleverConversationTurn({
  turn,
  onOptionSelect,
  onVehicleAction,
  isActiveQuestion = false,
}) {
  if (!turn) return null;

  if (turn.type === 'customer') {
    return (
      <article className="cc-bubble cc-bubble--customer cc-turn-enter" aria-label="Ihre Nachricht">
        <p className="cc-bubble__meta">Sie</p>
        <p className="cc-bubble__text">{turn.text}</p>
      </article>
    );
  }

  if (turn.type === 'clever') {
    const isVehicle = turn.world === CLEVER_WORLD.VEHICLE_CONSULTATION;
    const hasOptions = turn.options?.length > 0;
    const isKnowledge = turn.answerKind === 'knowledge' || turn.knowledgeOnly;
    const facts = turn.facts ?? [];
    const modelCards = turn.modelCards ?? [];
    const isFollowUp = Boolean(turn.questionId || turn.aiGenerated);

    return (
      <article
        className={[
          'cc-bubble',
          'cc-bubble--clever',
          'cc-turn-enter',
          isVehicle ? 'cc-bubble--vehicle' : '',
          isActiveQuestion ? 'cc-bubble--active-question' : '',
          isKnowledge ? 'cc-bubble--knowledge' : '',
          isFollowUp ? 'cc-bubble--follow-up' : '',
        ].filter(Boolean).join(' ')}
        aria-labelledby={`cc-clever-${turn.id}`}
      >
        <p className="cc-bubble__meta" id={`cc-clever-${turn.id}`}>Clever</p>
        {turn.text && <p className="cc-bubble__text">{turn.text}</p>}
        <FactChips facts={facts} />
        <VehicleAttachments cards={modelCards} onPrimaryAction={onVehicleAction} />
        {hasOptions && (
          <div className="cc-bubble__options">
            <div className="cc-clever-turn__options" role="group" aria-label="Antwortvorschläge">
              {turn.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="cc-option-chip cc-option-chip--suggestion"
                  onClick={() => onOptionSelect?.(turn.questionId, option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
    );
  }

  if (turn.type === 'clever_reflection') {
    return (
      <article className="cc-bubble cc-bubble--clever cc-turn-enter">
        <p className="cc-bubble__meta">Clever</p>
        <p className="cc-bubble__text">{turn.text}</p>
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
