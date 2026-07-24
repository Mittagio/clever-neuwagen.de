import { CLEVER_WORLD } from '../../services/consultation/consultationWorlds.js';
import { looksTechnicalFactLabel } from '../../services/clever/openai/conversationFactDisplay.js';
import CleverVehicleModelRail from './CleverVehicleModelRail.jsx';
import './clever-conversation.css';

function FactChips({ facts = [] }) {
  const seen = new Set();
  const visible = [];
  for (const [index, fact] of (facts ?? []).entries()) {
    const chip = fact.chip || [fact.icon, fact.label || fact.value].filter(Boolean).join(' ');
    if (!chip || looksTechnicalFactLabel(chip) || looksTechnicalFactLabel(fact.label)) continue;
    const dedupeKey = String(chip).trim().toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    visible.push({
      key: `${fact.key ?? 'fact'}-${index}-${dedupeKey}`,
      chip,
    });
    if (visible.length >= 4) break;
  }

  if (!visible.length) return null;

  return (
    <ul className="cc-fact-chips" aria-label="Fahrzeugdaten">
      {visible.map((fact) => (
        <li key={fact.key} className="cc-fact-chip">{fact.chip}</li>
      ))}
    </ul>
  );
}

function NextTopicChips({
  topics = [],
  active = true,
  disabled = false,
  onNextTopic,
}) {
  const visible = (topics ?? []).filter((topic) => topic?.id && topic?.label && topic?.customerMessage);
  if (!visible.length) return null;

  return (
    <div
      className={[
        'cc-next-topics',
        active ? 'cc-next-topics--active' : 'cc-next-topics--faded',
      ].join(' ')}
      aria-label="Nächste Themen"
    >
      <p className="cc-next-topics__prompt">Was möchten Sie noch wissen?</p>
      <div className="cc-next-topics__chips" role="group">
        {visible.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className="cc-next-topic-chip"
            disabled={disabled || !active}
            onClick={() => onNextTopic?.(topic)}
          >
            {topic.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CleverConversationTurn({
  turn,
  onOptionSelect,
  onVehicleReact,
  onOpenPriceList,
  onNextTopic,
  needProfile = {},
  notepadLabels = [],
  isActiveQuestion = false,
  nextTopicsActive = false,
  nextTopicsDisabled = false,
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
    const nextTopics = turn.nextTopics ?? [];
    const isFollowUp = Boolean(turn.questionId || turn.aiGenerated);
    const showLooseFacts = modelCards.length === 0;

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
        {showLooseFacts && <FactChips facts={facts} />}
        <CleverVehicleModelRail
          cards={modelCards}
          reactions={turn.vehicleCardReactions ?? {}}
          needProfile={needProfile}
          notepadLabels={notepadLabels}
          onReact={onVehicleReact}
          onOpenPriceList={onOpenPriceList}
          ariaLabel="Passende Modelle"
        />
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
        <NextTopicChips
          topics={nextTopics}
          active={nextTopicsActive}
          disabled={nextTopicsDisabled}
          onNextTopic={onNextTopic}
        />
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
