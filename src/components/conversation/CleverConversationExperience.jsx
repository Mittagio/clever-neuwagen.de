import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLeads } from '../../context/LeadsContext.jsx';
import { notifyCustomerInquirySubmitted } from '../../services/mail/mailInquiryNotify.js';
import {
  CONVERSATION_PHASE,
  TURN_TYPE,
  VEHICLE_CONVERSATION_PHASE,
  VEHICLE_TURN_TYPE,
  OFFER_CONVERSATION_PHASE,
  OFFER_TURN_TYPE,
  advanceFromThinking,
  advanceFromVehicleThinking,
  createHappyPathSession,
  getOpeningCopy,
  getConversationInputPlaceholder,
  getVehicleInputPlaceholder,
  isInOfferWorld,
  isInVehicleWorld,
  isInputEnabled,
  selectRecommendedModel,
  applyQuickHandoffEnrichment,
  submitConversationInput,
  submitDealerHandoff,
  submitOpeningMessage,
  submitPersonalHandoff,
  submitQuestionAnswer,
  submitVehicleAnswer,
  submitVehicleDirectionReaction,
} from '../../services/consultation/consultationHappyPath.js';
import { CLEVER_WORLD } from '../../services/consultation/consultationWorlds.js';
import CleverNotepadBar from './CleverNotepadBar.jsx';
import CleverWishAndVehicleNotepad from './CleverWishAndVehicleNotepad.jsx';
import CleverNotingFlash from './CleverNotingFlash.jsx';
import CleverConversationTurn from './CleverConversationTurn.jsx';
import CleverRecommendationMoment from './CleverRecommendationMoment.jsx';
import CleverVehicleDirections from './CleverVehicleDirections.jsx';
import CleverVehicleMiniRecommendation from './CleverVehicleMiniRecommendation.jsx';
import CleverPersonalHandoff from './CleverPersonalHandoff.jsx';
import CleverHandoffComplete from './CleverHandoffComplete.jsx';
import CleverAdvisorContactPrompt from './CleverAdvisorContactPrompt.jsx';
import CleverUnderstandingMoment from './CleverUnderstandingMoment.jsx';
import { countSessionUnderstandingLabels } from '../../services/consultation/consultationOfferHandoff.js';
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import './clever-conversation.css';

const SKIPPED_TURN_TYPES = new Set([
  TURN_TYPE.LEARNED,
  VEHICLE_TURN_TYPE.VEHICLE_LEARNED,
]);

const TURN_REVEAL_DELAY = {
  [TURN_TYPE.CUSTOMER]: 240,
  [TURN_TYPE.CLEVER]: 520,
  [TURN_TYPE.THINKING]: 320,
  [TURN_TYPE.UNDERSTANDING_MIRROR]: 440,
  [TURN_TYPE.RECOMMENDATION]: 400,
  [TURN_TYPE.HANDOFF]: 420,
  [VEHICLE_TURN_TYPE.CLEVER_REFLECTION]: 480,
  [VEHICLE_TURN_TYPE.VEHICLE_MINI_RECOMMENDATION]: 400,
  [OFFER_TURN_TYPE.PERSONAL_HANDOFF]: 480,
  [OFFER_TURN_TYPE.HANDOFF_COMPLETE]: 420,
};

function delayForTurn(turn, prevTurn) {
  if (turn.type === TURN_TYPE.CLEVER && prevTurn?.type === TURN_TYPE.CUSTOMER) {
    return 360;
  }
  if (turn.type === TURN_TYPE.CLEVER && prevTurn?.type === VEHICLE_TURN_TYPE.CLEVER_REFLECTION) {
    return 480;
  }
  if (turn.type === VEHICLE_TURN_TYPE.CLEVER_REFLECTION && prevTurn?.type === TURN_TYPE.CUSTOMER) {
    return 400;
  }
  return TURN_REVEAL_DELAY[turn.type] ?? 320;
}

function buildLabelKey(wishLabels = [], vehicleLabels = []) {
  return [...wishLabels, '||', ...vehicleLabels].join('|');
}

export default function CleverConversationExperience({
  dealerName = 'Autohaus',
  dealerConditions = {},
  embedded = false,
}) {
  const { addLead } = useLeads();
  const [session, setSession] = useState(() => createHappyPathSession(dealerName));
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [notingFlash, setNotingFlash] = useState(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const scrollRef = useRef(null);
  const labelKeyRef = useRef('');
  const voiceCommittedRef = useRef('');
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const voiceSupported = isSpeechRecognitionSupported();
  const opening = useMemo(() => getOpeningCopy(dealerName), [dealerName]);
  const inVehicleWorld = isInVehicleWorld(session);
  const inOfferWorld = isInOfferWorld(session);

  useEffect(() => {
    setSession(createHappyPathSession(dealerName));
    setRevealedCount(0);
  }, [dealerName]);

  useEffect(() => {
    const playableCount = session.turns.filter((t) => !SKIPPED_TURN_TYPES.has(t.type)).length;
    if (revealedCount >= playableCount) return undefined;

    const playableTurns = session.turns.filter((t) => !SKIPPED_TURN_TYPES.has(t.type));
    const nextTurn = playableTurns[revealedCount];
    if (!nextTurn) return undefined;

    const prevTurn = revealedCount > 0 ? playableTurns[revealedCount - 1] : null;
    const delay = delayForTurn(nextTurn, prevTurn);

    const timer = window.setTimeout(() => {
      setRevealedCount((count) => count + 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [revealedCount, session.turns]);

  useEffect(() => {
    const labelKey = buildLabelKey(session.notepadLabels, session.vehicleNotepadLabels);
    const prevLabels = labelKeyRef.current ? labelKeyRef.current.split('|').filter(Boolean) : [];
    const currentLabels = labelKey.split('|').filter(Boolean);
    const added = currentLabels.filter((label) => !prevLabels.includes(label));

    labelKeyRef.current = labelKey;

    if (!added.length) return undefined;

    setNotingFlash(added);
    const timer = window.setTimeout(() => setNotingFlash(null), 1800);
    return () => window.clearTimeout(timer);
  }, [session.notepadLabels, session.vehicleNotepadLabels]);

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

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
  }, []);

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

  const handleDirectionReaction = useCallback((modelKey, reactionId) => {
    setSession((prev) => submitVehicleDirectionReaction(prev, modelKey, reactionId));
  }, []);

  const handleDealerHandoff = useCallback(() => {
    setSession((prev) => submitDealerHandoff(prev, dealerConditions));
  }, [dealerConditions]);

  const handlePersonalHandoffSubmit = useCallback((handoffForm) => {
    setSession((prev) => {
      const { enrichment, ...form } = handoffForm;
      const enriched = enrichment
        ? applyQuickHandoffEnrichment(prev, enrichment)
        : prev;
      const result = submitPersonalHandoff(enriched, form, dealerConditions);
      addLead(result.lead);
      void notifyCustomerInquirySubmitted(result.lead, {
        dealerName: dealerConditions?.dealerName ?? dealerName,
        dealerPhone: dealerConditions?.contact?.phone ?? dealerConditions?.phone,
        dealerEmail: dealerConditions?.contact?.email ?? dealerConditions?.email,
        contactName: dealerConditions?.contact?.name,
      });
      return result.session;
    });
  }, [dealerConditions, dealerName, addLead]);

  const showOpening = session.phase === CONVERSATION_PHASE.OPENING && session.turns.length === 0;
  const inputEnabled = isInputEnabled(session) && !inOfferWorld;
  const playableTurns = session.turns.filter((t) => !SKIPPED_TURN_TYPES.has(t.type));
  const visibleTurns = playableTurns.slice(0, revealedCount);
  const activeQuestionId = session.pendingQuestion?.id ?? null;
  const inputPlaceholder = inVehicleWorld && inputEnabled
    ? getVehicleInputPlaceholder(session)
    : (showOpening ? opening.placeholder : getConversationInputPlaceholder(session));

  const handleVoiceStart = useCallback(() => {
    if (!voiceSupported || !inputEnabled || voiceListening) return;
    setVoiceError('');
    const prefix = String(inputValue ?? '').trim();
    voiceCommittedRef.current = prefix ? `${prefix} ` : '';
    setVoiceListening(true);
    recognitionRef.current = startSpeechRecognition({
      continuous: true,
      onResult: ({ finalText, interimText }) => {
        if (finalText) {
          const next = `${voiceCommittedRef.current}${finalText}`.trim();
          voiceCommittedRef.current = next ? `${next} ` : '';
        }
        const display = `${voiceCommittedRef.current}${interimText ?? ''}`.trim();
        setInputValue(display);
      },
      onError: (message) => {
        setVoiceError(message);
        setVoiceListening(false);
      },
      onEnd: () => {
        setVoiceListening(false);
        const finalText = voiceCommittedRef.current.trim();
        if (finalText) {
          setInputValue(finalText);
        }
        inputRef.current?.focus();
      },
    });
    inputRef.current?.focus();
  }, [inputEnabled, inputValue, voiceListening, voiceSupported]);

  const understandingCount = countSessionUnderstandingLabels(session);
  const advisorVariant = session.phase === CONVERSATION_PHASE.HANDOFF
    ? 'handoff'
    : (showOpening ? 'opening' : 'engaged');
  const showAdvisorContact = !inOfferWorld;

  const experienceClass = [
    'cc-experience',
    embedded ? 'cc-experience--embedded' : '',
    inVehicleWorld ? 'cc-experience--vehicle' : '',
    inOfferWorld ? 'cc-experience--offer' : '',
    showAdvisorContact ? 'cc-experience--advisor-contact' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={experienceClass}>
      {!embedded && (
        <header className="cc-experience__dealer">
          <span className="cc-experience__dealer-name">{dealerName}</span>
        </header>
      )}

      {!inOfferWorld && (
        inVehicleWorld ? (
          <CleverWishAndVehicleNotepad
            wishLabels={session.notepadLabels}
            vehicleLabels={session.vehicleNotepadLabels}
            chapterTitle={session.vehicleChapterTitle}
          />
        ) : (
          <CleverNotepadBar labels={session.notepadLabels} />
        )
      )}

      <div className="cc-experience__scroll" ref={scrollRef}>
        {showOpening && (
          <section className="cc-opening" aria-label="Clever Empfang">
            <h1 className="cc-opening__greeting">{opening.greeting}</h1>
            <p className="cc-opening__invitation">{opening.invitation}</p>
            <p className="cc-opening__intro">{opening.intro}</p>
          </section>
        )}

        <div className="cc-transcript">
          {notingFlash && <CleverNotingFlash labels={notingFlash} />}
          {visibleTurns.map((turn) => {
            if (turn.type === TURN_TYPE.UNDERSTANDING_MIRROR) {
              return (
                <CleverUnderstandingMoment
                  key={turn.id}
                  labels={turn.labels ?? []}
                />
              );
            }
            if (turn.type === TURN_TYPE.VEHICLE_DIRECTIONS) {
              return (
                <CleverVehicleDirections
                  key={turn.id}
                  directionsView={turn.directionsView}
                  onReact={handleDirectionReaction}
                />
              );
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
            if (turn.type === OFFER_TURN_TYPE.PERSONAL_HANDOFF) {
              return (
                <CleverPersonalHandoff
                  key={turn.id}
                  handoffView={turn.handoffView}
                  session={session}
                  onSubmit={handlePersonalHandoffSubmit}
                />
              );
            }
            if (turn.type === OFFER_TURN_TYPE.HANDOFF_COMPLETE) {
              return <CleverHandoffComplete key={turn.id} completeView={turn.completeView} />;
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
                isActiveQuestion={turn.type === TURN_TYPE.CLEVER && turn.questionId === activeQuestionId}
              />
            );
          })}
        </div>
      </div>

      {showAdvisorContact && (
        <CleverAdvisorContactPrompt
          understandingCount={understandingCount}
          variant={advisorVariant}
          onContact={handleDealerHandoff}
        />
      )}

      {!inOfferWorld && (
        <form
          className={[
            'cc-input-bar',
            inputFocused ? 'cc-input-bar--focused' : '',
            inVehicleWorld && inputEnabled ? 'cc-input-bar--vehicle-active' : '',
            voiceListening ? ' cc-input-bar--listening' : '',
          ].filter(Boolean).join('')}
          onSubmit={handleFormSubmit}
        >
          <label className="cc-input-bar__label" htmlFor="cc-conversation-input">
            {inVehicleWorld ? 'Einfach weitererzählen' : 'Einfach erzählen oder fragen'}
          </label>
          {voiceListening && (
            <p className="cc-input-bar__voice-status" aria-live="polite">
              Clever hört zu …
            </p>
          )}
          {voiceError && !voiceListening && (
            <p className="cc-input-bar__voice-error" role="alert">
              {voiceError}
            </p>
          )}
          <div className="cc-input-bar__row">
            <input
              ref={inputRef}
              id="cc-conversation-input"
              type="text"
              className="cc-input-bar__field"
              placeholder={voiceListening ? 'Clever hört zu …' : inputPlaceholder}
              value={inputValue}
              disabled={!inputEnabled}
              onChange={(event) => setInputValue(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              autoComplete="off"
            />
            <button
              type="button"
              className={`cc-input-bar__mic${voiceListening ? ' cc-input-bar__mic--active' : ''}`}
              onClick={handleVoiceStart}
              disabled={!inputEnabled || !voiceSupported || voiceListening}
              aria-label="Erzählen"
              title={voiceSupported ? 'Erzählen' : 'Spracheingabe nicht verfügbar'}
            >
              <span aria-hidden>🎤</span>
            </button>
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
      )}
    </div>
  );
}
