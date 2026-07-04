import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONVERSATION_PHASE,
  TURN_TYPE,
  VEHICLE_CONVERSATION_PHASE,
  VEHICLE_TURN_TYPE,
  advanceFromThinking,
  advanceFromVehicleThinking,
  createHappyPathSession,
  getOpeningCopy,
  getVehicleInputPlaceholder,
  HAPPY_PATH_EXAMPLE_MESSAGE,
  isInVehicleWorld,
  isInputEnabled,
  selectRecommendedModel,
  submitConversationInput,
  submitDealerHandoff,
  submitOpeningMessage,
  submitQuestionAnswer,
  submitVehicleAnswer,
} from '../../services/consultation/consultationHappyPath.js';
import { CLEVER_WORLD } from '../../services/consultation/consultationWorlds.js';
import CleverNotepadBar from './CleverNotepadBar.jsx';
import CleverWishAndVehicleNotepad from './CleverWishAndVehicleNotepad.jsx';
import CleverLearnedBlock from './CleverLearnedBlock.jsx';
import CleverVehicleLearnedBlock from './CleverVehicleLearnedBlock.jsx';
import CleverConversationTurn from './CleverConversationTurn.jsx';
import CleverRecommendationMoment from './CleverRecommendationMoment.jsx';
import CleverVehicleMiniRecommendation from './CleverVehicleMiniRecommendation.jsx';
import CleverDealerPrepCard from './CleverDealerPrepCard.jsx';
import './clever-conversation.css';

const TURN_REVEAL_DELAY = {
  [TURN_TYPE.CUSTOMER]: 280,
  [TURN_TYPE.LEARNED]: 480,
  [TURN_TYPE.CLEVER]: 720,
  [TURN_TYPE.THINKING]: 320,
  [TURN_TYPE.RECOMMENDATION]: 400,
  [TURN_TYPE.HANDOFF]: 420,
  [VEHICLE_TURN_TYPE.VEHICLE_LEARNED]: 480,
  [VEHICLE_TURN_TYPE.CLEVER_REFLECTION]: 560,
  [VEHICLE_TURN_TYPE.VEHICLE_MINI_RECOMMENDATION]: 400,
  [VEHICLE_TURN_TYPE.DEALER_PREP_CARD]: 420,
};

function delayForTurn(turn, prevTurn) {
  if (turn.type === TURN_TYPE.CLEVER && prevTurn?.type === TURN_TYPE.LEARNED) {
    return 900;
  }
  if (turn.type === TURN_TYPE.CLEVER && prevTurn?.type === VEHICLE_TURN_TYPE.CLEVER_REFLECTION) {
    return 640;
  }
  if (turn.type === VEHICLE_TURN_TYPE.CLEVER_REFLECTION && prevTurn?.type === VEHICLE_TURN_TYPE.VEHICLE_LEARNED) {
    return 520;
  }
  return TURN_REVEAL_DELAY[turn.type] ?? 360;
}

export default function CleverConversationExperience({ dealerName = 'Autohaus' }) {
  const [session, setSession] = useState(() => createHappyPathSession(dealerName));
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const scrollRef = useRef(null);
  const opening = useMemo(() => getOpeningCopy(dealerName), [dealerName]);
  const inVehicleWorld = isInVehicleWorld(session);

  useEffect(() => {
    setSession(createHappyPathSession(dealerName));
    setRevealedCount(0);
  }, [dealerName]);

  useEffect(() => {
    if (revealedCount >= session.turns.length) return undefined;

    const nextTurn = session.turns[revealedCount];
    const prevTurn = revealedCount > 0 ? session.turns[revealedCount - 1] : null;
    const delay = delayForTurn(nextTurn, prevTurn);

    const timer = window.setTimeout(() => {
      setRevealedCount((count) => count + 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [revealedCount, session.turns]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [revealedCount, session.phase]);

  useEffect(() => {
    if (session.phase !== CONVERSATION_PHASE.THINKING) return undefined;
    const timer = window.setTimeout(() => {
      setSession((prev) => advanceFromThinking(prev));
    }, 580);
    return () => window.clearTimeout(timer);
  }, [session.phase]);

  useEffect(() => {
    if (session.phase !== VEHICLE_CONVERSATION_PHASE.VEHICLE_THINKING) return undefined;
    const timer = window.setTimeout(() => {
      setSession((prev) => advanceFromVehicleThinking(prev));
    }, 580);
    return () => window.clearTimeout(timer);
  }, [session.phase]);

  const handleSend = useCallback((text) => {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return;
    setSession((prev) => submitConversationInput(prev, trimmed));
    setInputValue('');
  }, []);

  const handleFormSubmit = (event) => {
    event.preventDefault();
    handleSend(inputValue);
  };

  const handleExample = () => {
    if (session.phase !== CONVERSATION_PHASE.OPENING) return;
    setSession((prev) => submitOpeningMessage(prev, HAPPY_PATH_EXAMPLE_MESSAGE));
  };

  const handleOptionSelect = (questionId, answerId) => {
    setSession((prev) => {
      if (prev.pendingQuestion?.world === CLEVER_WORLD.VEHICLE_CONSULTATION) {
        return submitVehicleAnswer(prev, { answerId });
      }
      return submitQuestionAnswer(prev, { answerId });
    });
  };

  const handleSelectPrimary = (modelKey) => {
    setSession((prev) => selectRecommendedModel(prev, modelKey));
  };

  const handleDealerHandoff = () => {
    setSession((prev) => submitDealerHandoff(prev));
  };

  const showOpening = session.phase === CONVERSATION_PHASE.OPENING && session.turns.length === 0;
  const inputEnabled = isInputEnabled(session);
  const visibleTurns = session.turns.slice(0, revealedCount);
  const inputPlaceholder = inVehicleWorld && inputEnabled
    ? getVehicleInputPlaceholder()
    : opening.placeholder;

  return (
    <div className={`cc-experience${inVehicleWorld ? ' cc-experience--vehicle' : ''}`}>
      <header className="cc-experience__dealer">
        <span className="cc-experience__dealer-name">{dealerName}</span>
      </header>

      {inVehicleWorld ? (
        <CleverWishAndVehicleNotepad
          wishLabels={session.notepadLabels}
          vehicleLabels={session.vehicleNotepadLabels}
          chapterTitle={session.vehicleChapterTitle}
        />
      ) : (
        <CleverNotepadBar labels={session.notepadLabels} />
      )}

      <div className="cc-experience__scroll" ref={scrollRef}>
        {showOpening && (
          <section className="cc-opening" aria-label="Clever Beratung beginnen">
            <h1 className="cc-opening__greeting">{opening.greeting}</h1>
            <p className="cc-opening__intro">{opening.intro}</p>
            <p className="cc-opening__invitation">{opening.invitation}</p>

            <div className="cc-opening__examples">
              <p className="cc-opening__examples-label">{opening.examplesLabel}</p>
              <button
                type="button"
                className="cc-example-chip"
                onClick={handleExample}
              >
                „{opening.exampleLabel}“
              </button>
            </div>
          </section>
        )}

        <div className="cc-transcript">
          {visibleTurns.map((turn) => {
            if (turn.type === TURN_TYPE.LEARNED) {
              return <CleverLearnedBlock key={turn.id} labels={turn.labels} />;
            }
            if (turn.type === VEHICLE_TURN_TYPE.VEHICLE_LEARNED) {
              return <CleverVehicleLearnedBlock key={turn.id} labels={turn.labels} />;
            }
            if (turn.type === TURN_TYPE.RECOMMENDATION) {
              return (
                <CleverRecommendationMoment
                  key={turn.id}
                  recommendation={turn.recommendation}
                  notepadLabels={session.notepadLabels}
                  onSelectPrimary={handleSelectPrimary}
                  onDiscussAlternatives={() => {}}
                />
              );
            }
            if (turn.type === VEHICLE_TURN_TYPE.VEHICLE_MINI_RECOMMENDATION) {
              return (
                <CleverVehicleMiniRecommendation
                  key={turn.id}
                  recommendation={turn.recommendation}
                  onHandoffToDealer={handleDealerHandoff}
                  onAddMore={() => {}}
                />
              );
            }
            if (turn.type === VEHICLE_TURN_TYPE.DEALER_PREP_CARD) {
              return <CleverDealerPrepCard key={turn.id} summary={turn.summary} />;
            }
            if (turn.type === TURN_TYPE.HANDOFF) {
              return (
                <article key={turn.id} className="cc-handoff cc-turn-enter">
                  <p className="cc-handoff__text">{turn.text}</p>
                </article>
              );
            }
            return (
              <CleverConversationTurn
                key={turn.id}
                turn={turn}
                onOptionSelect={handleOptionSelect}
              />
            );
          })}
        </div>
      </div>

      <form
        className={`cc-input-bar${inputFocused ? ' cc-input-bar--focused' : ''}${inVehicleWorld && inputEnabled ? ' cc-input-bar--vehicle-active' : ''}`}
        onSubmit={handleFormSubmit}
      >
        <label className="cc-input-bar__label" htmlFor="cc-conversation-input">
          {inVehicleWorld ? 'Oder einfach ergänzen' : 'Erzählen Sie Clever, wonach Sie suchen'}
        </label>
        <div className="cc-input-bar__row">
          <input
            id="cc-conversation-input"
            type="text"
            className="cc-input-bar__field"
            placeholder={inputPlaceholder}
            value={inputValue}
            disabled={!inputEnabled}
            onChange={(event) => setInputValue(event.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoComplete="off"
          />
          <button
            type="submit"
            className="cc-input-bar__send"
            disabled={!inputEnabled || !inputValue.trim()}
            aria-label="Senden"
          >
            <span aria-hidden>➜</span>
          </button>
        </div>
      </form>
    </div>
  );
}
