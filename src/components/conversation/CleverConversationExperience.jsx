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
  getVehicleInputPlaceholder,
  isInOfferWorld,
  isInVehicleWorld,
  isInputEnabled,
  isAdvisorCollectMode,
  removeNeedLabel,
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
import { shouldShowWishHandoffCta } from '../../services/consultation/consultationOfferHandoff.js';
import { buildCustomerUnderstanding } from '../../services/dealer/customerUnderstanding.js';
import { recommendVehicles } from '../../services/clever/recommendVehicles.js';
import CleverMemoryBar from './CleverMemoryBar.jsx';
import CleverVehicleReasoningPanel from './CleverVehicleReasoningPanel.jsx';
import CleverWishAndVehicleNotepad from './CleverWishAndVehicleNotepad.jsx';
import CleverNotingFlash from './CleverNotingFlash.jsx';
import CleverConversationTurn from './CleverConversationTurn.jsx';
import CleverRecommendationMoment from './CleverRecommendationMoment.jsx';
import CleverVehicleDirections from './CleverVehicleDirections.jsx';
import CleverVehicleMiniRecommendation from './CleverVehicleMiniRecommendation.jsx';
import CleverPersonalHandoff from './CleverPersonalHandoff.jsx';
import CleverHandoffComplete from './CleverHandoffComplete.jsx';
import CleverAdvisorContactPrompt from './CleverAdvisorContactPrompt.jsx';
import CleverAdvisorCollectPanel from './CleverAdvisorCollectPanel.jsx';
import CleverUnderstandingMoment from './CleverUnderstandingMoment.jsx';
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import {
  isCleverAiConversationClientEnabled,
  requestCleverConversationTurn,
} from '../../services/clever/openai/cleverConversationClient.js';

const SKIPPED_TURN_TYPES = new Set([
  TURN_TYPE.LEARNED,
  TURN_TYPE.UNDERSTANDING_MIRROR,
  VEHICLE_TURN_TYPE.VEHICLE_LEARNED,
]);

const LIVING_INPUT_PLACEHOLDERS = [
  'Was ist Ihnen noch wichtig?',
  'Erzählen Sie einfach weiter …',
  'Was sollten wir noch wissen?',
  'Ich suche einen Hybrid mit Anhängelast …',
  'Elektro für Familie mit 400 km Reichweite …',
  'Panorama wäre schön …',
];

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
  dealerId = import.meta.env.VITE_PILOT_DEALER_ID ?? null,
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
  const [advisorBoostExpanded, setAdvisorBoostExpanded] = useState(false);
  const [livingPlaceholderIndex, setLivingPlaceholderIndex] = useState(0);
  const [livingPlaceholderFading, setLivingPlaceholderFading] = useState(false);
  const [labelsAnimating, setLabelsAnimating] = useState(false);
  const [excludedModelKeys, setExcludedModelKeys] = useState([]);
  const [excludeReaction, setExcludeReaction] = useState('');
  const [offerModelKeys, setOfferModelKeys] = useState([]);
  const [aiTurnPending, setAiTurnPending] = useState(false);
  const [lastAddedLabel, setLastAddedLabel] = useState('');
  const scrollRef = useRef(null);
  const labelKeyRef = useRef('');
  const prevLabelCountRef = useRef(0);
  const voiceCommittedRef = useRef('');
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const voiceSupported = isSpeechRecognitionSupported();
  const opening = useMemo(() => getOpeningCopy(dealerName), [dealerName]);
  const inVehicleWorld = isInVehicleWorld(session);
  const inOfferWorld = isInOfferWorld(session);
  const showOpening = session.phase === CONVERSATION_PHASE.OPENING && session.turns.length === 0;
  const inCollectMode = isAdvisorCollectMode(session);
  const inputEnabled = isInputEnabled(session) && !inOfferWorld;

  useEffect(() => {
    setSession(createHappyPathSession(dealerName));
    setRevealedCount(0);
    prevLabelCountRef.current = 0;
    setExcludedModelKeys([]);
    setExcludeReaction('');
    setOfferModelKeys([]);
    setLastAddedLabel('');
  }, [dealerName]);

  useEffect(() => {
    const count = session.notepadLabels?.length ?? 0;
    if (count > prevLabelCountRef.current) {
      setLabelsAnimating(true);
      window.setTimeout(() => setLabelsAnimating(false), 520);
    }
    prevLabelCountRef.current = count;
  }, [session.notepadLabels]);

  useEffect(() => {
    if (inOfferWorld || inVehicleWorld || inCollectMode) return undefined;
    if (voiceListening) return undefined;
    if (inputValue.trim()) return undefined;
    if (inputFocused) return undefined;

    const intervalMs = 3600;
    const fadeMs = 260;

    const handle = window.setInterval(() => {
      setLivingPlaceholderFading(true);
      window.setTimeout(() => {
        setLivingPlaceholderIndex((prev) => (prev + 1) % LIVING_INPUT_PLACEHOLDERS.length);
        setLivingPlaceholderFading(false);
      }, fadeMs);
    }, intervalMs);

    return () => window.clearInterval(handle);
  }, [inOfferWorld, inVehicleWorld, inCollectMode, voiceListening, inputValue, inputFocused]);

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

    setLastAddedLabel(added[0] ?? '');
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

  const handleSend = useCallback(async (text) => {
    const trimmed = String(text ?? '').trim();
    if (!trimmed || aiTurnPending) return;

    if (isCleverAiConversationClientEnabled()) {
      setAiTurnPending(true);
      try {
        const conversationHistory = (session.turns ?? [])
          .filter((turn) => turn.type === TURN_TYPE.CUSTOMER || turn.type === TURN_TYPE.CLEVER)
          .slice(-8)
          .map((turn) => ({
            role: turn.type === TURN_TYPE.CUSTOMER ? 'user' : 'assistant',
            text: turn.text ?? '',
          }));

        const result = await requestCleverConversationTurn({
          customerMessage: trimmed,
          conversationHistory,
          dealerId,
          brandContext: {
            dealerName,
            brand: 'Kia',
          },
          session,
        });

        if (result.ok && result.session) {
          setSession(result.session);
          setInputValue('');
          return;
        }
      } catch {
        // Fallback auf deterministischen Flow
      } finally {
        setAiTurnPending(false);
      }
    }

    setSession((prev) => submitConversationInput(prev, trimmed));
    setInputValue('');
  }, [aiTurnPending, dealerId, dealerName, session]);

  const handleFormSubmit = (event) => {
    event.preventDefault();
    handleSend(inputValue);
  };

  const smartChipState = useMemo(() => {
    const raw = String(inputValue ?? '').trim().toLowerCase();
    const wishBlob = [
      ...(session.notepadLabels ?? []),
      ...(session.needProfile?.understoodLabels ?? []),
    ].join(' ').toLowerCase();
    const context = `${raw} ${wishBlob}`.trim();

    const defaults = {
      label: '✨ Vielleicht noch wichtig:',
      chips: [
        { id: 'seatheat', icon: '🔥', label: 'Sitzheizung', text: 'Sitzheizung wäre mir wichtig.' },
        { id: 'heatpump', icon: '🌡', label: 'Wärmepumpe', text: 'Wärmepumpe wäre mir wichtig.' },
        { id: 'v2l', icon: '🔌', label: 'V2L', text: 'V2L wäre interessant.' },
        { id: 'big_trunk', icon: '📦', label: 'großer Kofferraum', text: 'Großer Kofferraum ist mir wichtig.' },
        { id: 'rear_cam', icon: '📷', label: 'Rückfahrkamera', text: 'Eine Rückfahrkamera wäre mir wichtig.' },
      ],
    };

    const pick = (group) => ({
      label: '✨ Vielleicht noch wichtig:',
      chips: group.chips.map((chip) => ({
        id: chip.id,
        icon: chip.icon,
        label: chip.label,
        text: chip.text,
      })),
    });

    const groups = [
      {
        id: 'electric',
        match: /elektro|ev\b|strom|wallbox|reichweite|laden/,
        chips: [
          { id: 'heatpump', icon: '🌡', label: 'Wärmepumpe', text: 'Wärmepumpe wäre mir wichtig.' },
          { id: 'v2l', icon: '🔌', label: 'V2L', text: 'V2L wäre interessant.' },
          { id: 'fastcharge', icon: '⚡', label: 'Schnellladen', text: 'Gutes Schnellladen ist mir wichtig.' },
          { id: 'wallbox', icon: '🏠', label: 'Wallbox', text: 'Ich kann zuhause an Wallbox laden.' },
          { id: 'winter', icon: '❄', label: 'Reichweite Winter', text: 'Winterreichweite ist mir wichtig.' },
        ],
      },
      {
        id: 'family',
        match: /familie|kinder|hund|kinderwagen|isofix/,
        chips: [
          { id: 'isofix', icon: '👶', label: 'Isofix', text: 'Isofix ist mir wichtig.' },
          { id: 'stroller', icon: '🛒', label: 'Kinderwagen', text: 'Platz für Kinderwagen wäre wichtig.' },
          { id: 'dog', icon: '🐶', label: 'Hund', text: 'Platz für einen Hund wäre wichtig.' },
          { id: 'big_trunk', icon: '📦', label: 'großer Kofferraum', text: 'Großer Kofferraum ist mir wichtig.' },
          { id: 'roofbox', icon: '🏕', label: 'Dachbox', text: 'Dachbox / Dachträger wäre relevant.' },
        ],
      },
      {
        id: 'leasing',
        match: /leasing|rate|monat|km|anzahlung|restwert|inzahlung/,
        chips: [
          { id: 'no_down', icon: '💶', label: 'ohne Anzahlung', text: 'Am liebsten ohne Anzahlung.' },
          { id: '48m', icon: '📅', label: '48 Monate', text: '48 Monate wären ideal.' },
          { id: '15k', icon: '🛣', label: '15.000 km', text: 'Ich fahre ca. 15.000 km pro Jahr.' },
          { id: 'buyout', icon: '🔄', label: 'Restwertübernahme', text: 'Spätere Übernahme wäre interessant.' },
          { id: 'tradein', icon: '🚗', label: 'Inzahlungnahme', text: 'Inzahlungnahme wäre gut.' },
        ],
      },
      {
        id: 'ev3',
        match: /\bev3\b/,
        chips: [
          { id: 'heatpump', icon: '🌡', label: 'Wärmepumpe', text: 'Wärmepumpe wäre mir wichtig.' },
          { id: 'seatheat', icon: '🔥', label: 'Sitzheizung', text: 'Sitzheizung wäre mir wichtig.' },
          { id: 'rear_cam', icon: '📷', label: 'Rückfahrkamera', text: 'Eine Rückfahrkamera wäre mir wichtig.' },
          { id: 'v2l', icon: '🔌', label: 'V2L', text: 'V2L wäre interessant.' },
          { id: 'lease_15k', icon: '📅', label: '15.000 km Leasing', text: '15.000 km Leasing wäre ideal.' },
        ],
      },
      {
        id: 'sportage',
        match: /\bsportage\b/,
        chips: [
          { id: 'towbar', icon: '🔗', label: 'Anhängerkupplung', text: 'Ich brauche eine Anhängerkupplung.' },
          { id: 'horse', icon: '🐴', label: 'Pferdeanhänger', text: 'Pferdeanhänger ist ein Thema.' },
          { id: 'seatheat', icon: '🔥', label: 'Sitzheizung', text: 'Sitzheizung wäre mir wichtig.' },
          { id: 'cam360', icon: '📷', label: '360° Kamera', text: '360° Kamera wäre mir wichtig.' },
          { id: 'big_trunk', icon: '📦', label: 'großer Kofferraum', text: 'Großer Kofferraum ist mir wichtig.' },
        ],
      },
      {
        id: 'trailer',
        match: /anh(ä|ae)ng|wohnwagen|pferd/,
        chips: [
          { id: 'towbar', icon: '🔗', label: 'Anhängerkupplung', text: 'Ich brauche eine Anhängerkupplung.' },
          { id: '1500', icon: '🚚', label: '1.500 kg', text: 'Zuglast ca. 1.500 kg wäre wichtig.' },
          { id: 'caravan', icon: '🏕', label: 'Wohnwagen', text: 'Ich ziehe gelegentlich einen Wohnwagen.' },
          { id: 'horse', icon: '🐴', label: 'Pferdeanhänger', text: 'Pferdeanhänger ist ein Thema.' },
        ],
      },
    ];

    const hit = groups.find((g) => g.match.test(context));
    return hit ? pick(hit) : defaults;
  }, [inputValue, session.notepadLabels, session.needProfile?.understoodLabels]);

  const handleSmartChipClick = useCallback((chipText) => {
    const next = String(chipText ?? '').trim();
    if (!next) return;
    setSession((prev) => submitConversationInput(prev, next));
    setInputValue('');
    inputRef.current?.focus?.();
  }, []);

  const handleRemoveUnderstoodLabel = useCallback((label) => {
    setSession((prev) => removeNeedLabel(prev, label));
  }, []);

  const customerUnderstanding = useMemo(() => {
    // Reader-only: wir bauen das bestehende CustomerUnderstanding aus dem aktuellen NeedProfile.
    const leadLike = { crm: { needProfile: session.needProfile } };
    return buildCustomerUnderstanding(leadLike);
  }, [session.needProfile]);

  const vehicleReasoning = useMemo(
    () => recommendVehicles(customerUnderstanding, {
      answers: session.consultationProfile?.answers ?? {},
      needProfile: session.needProfile,
      userExcluded: excludedModelKeys,
    }),
    [customerUnderstanding, session.consultationProfile?.answers, session.needProfile, excludedModelKeys],
  );
  const visibleReasoningItems = useMemo(
    () => (vehicleReasoning.items ?? []).filter((item) => !excludedModelKeys.includes(item.modelKey)),
    [vehicleReasoning.items, excludedModelKeys],
  );
  const fadedReasoningItems = useMemo(
    () => vehicleReasoning.fadedItems ?? [],
    [vehicleReasoning.fadedItems],
  );

  const handleExcludeModel = useCallback((modelKey) => {
    setExcludedModelKeys((prev) => {
      const next = [...new Set([...prev, modelKey])];
      const remaining = (vehicleReasoning.items ?? []).filter((item) => !next.includes(item.modelKey));
      if (remaining.length) {
        const names = remaining.map((item) => item.title.replace(/^Kia /, '')).join(' und ');
        setExcludeReaction(`Alles klar. Dann konzentrieren wir uns auf ${names}.`);
      }
      return next;
    });
  }, [vehicleReasoning.items]);

  const handleOfferModelToggle = useCallback((modelKey) => {
    setOfferModelKeys((prev) => (
      prev.includes(modelKey)
        ? prev.filter((key) => key !== modelKey)
        : [...prev, modelKey]
    ));
  }, []);

  const reasoningHeadline = useMemo(() => {
    if (vehicleReasoning.intro) return vehicleReasoning.intro;
    const label = String(lastAddedLabel ?? '').trim();
    if (/schnellladen/i.test(label)) return 'Durch Schnellladen wird der EV6 jetzt besonders interessant:';
    if (/familie|kinder|hund/i.test(label)) return 'Für Familie würde ich aktuell diese Fahrzeuge anschauen:';
    if (/budget/i.test(label) || /€\/monat/i.test(label) || /leasing/i.test(label)) {
      return 'Preislich passend wären aktuell diese Fahrzeuge:';
    }
    return vehicleReasoning.intro || 'Diese Fahrzeuge würden aktuell zu Ihren Angaben passen.';
  }, [lastAddedLabel, vehicleReasoning.intro]);

  const livingPlaceholder = LIVING_INPUT_PLACEHOLDERS[livingPlaceholderIndex]
    ?? LIVING_INPUT_PLACEHOLDERS[0];

  const renderComposer = () => {
    const formClass = [
      'cc-input-bar',
      inputFocused ? 'cc-input-bar--focused' : '',
      inVehicleWorld && inputEnabled ? 'cc-input-bar--vehicle-active' : '',
      voiceListening ? 'cc-input-bar--listening' : '',
      showOpening && !(session.notepadLabels?.length ?? 0) ? 'cc-input-bar--chips-visible' : '',
    ].filter(Boolean).join(' ');

    const placeholderText = voiceListening
      ? 'Clever hört zu …'
      : (inVehicleWorld && inputEnabled
        ? getVehicleInputPlaceholder(session)
        : livingPlaceholder);

    return (
      <form className={formClass} onSubmit={handleFormSubmit}>
        <label className="cc-input-bar__label" htmlFor="cc-conversation-input">
          {inVehicleWorld ? 'Einfach weitererzählen' : 'Erzählen Sie einfach weiter'}
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
          <div className="cc-input-bar__field-wrap">
            <input
              ref={inputRef}
              id="cc-conversation-input"
              type="text"
              className="cc-input-bar__field"
              placeholder={placeholderText}
              value={inputValue}
              disabled={!inputEnabled}
              onChange={(event) => setInputValue(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              autoComplete="off"
            />
            {!inVehicleWorld && !voiceListening && !inputValue.trim() && (
              <span
                className={[
                  'cc-input-bar__living-placeholder',
                  livingPlaceholderFading ? 'is-fading' : '',
                ].filter(Boolean).join(' ')}
                aria-hidden
              >
                {livingPlaceholder}
              </span>
            )}
          </div>
          <button
            type="button"
            className={`cc-input-bar__mic${voiceListening ? ' is-active' : ''}`}
            onClick={handleVoiceStart}
            disabled={!inputEnabled || !voiceSupported || voiceListening}
            aria-label={opening.voiceLabel}
            title={voiceSupported ? opening.voiceLabel : 'Spracheingabe nicht verfügbar'}
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
    );
  };

  const handleOptionSelect = (questionId, answerId) => {
    if (String(questionId ?? '').startsWith('ai_')) {
      const option = session.pendingQuestion?.options?.find((o) => o.id === answerId);
      handleSend(option?.label ?? String(answerId));
      return;
    }
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

  const handleDealerHandoff = useCallback((enrichment) => {
    setSession((prev) => {
      const enriched = enrichment
        ? applyQuickHandoffEnrichment(prev, enrichment)
        : prev;
      return submitDealerHandoff(enriched, dealerConditions);
    });
  }, [dealerConditions]);

  const handlePersonalHandoffSubmit = useCallback((handoffForm) => {
    setSession((prev) => {
      const result = submitPersonalHandoff(prev, handoffForm, dealerConditions);
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

  const playableTurns = session.turns.filter((t) => !SKIPPED_TURN_TYPES.has(t.type));
  const visibleTurns = playableTurns.slice(0, revealedCount);
  const activeQuestionId = session.pendingQuestion?.id ?? null;

  const hasReasoningContent = visibleReasoningItems.length > 0 || fadedReasoningItems.length > 0;
  const showInlineReasoning = !inOfferWorld
    && !inVehicleWorld
    && hasReasoningContent
    && ((session.notepadLabels?.length ?? 0) > 0 || visibleTurns.length > 0);

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

  const [wishHandoffLatched, setWishHandoffLatched] = useState(false);

  useEffect(() => {
    if (shouldShowWishHandoffCta(session)) {
      setWishHandoffLatched(true);
    }
  }, [session]);

  const showWishHandoff = wishHandoffLatched || shouldShowWishHandoffCta(session);
  const showAdvisorContact = !inOfferWorld && !inCollectMode && showWishHandoff;

  useEffect(() => {
    if (!showAdvisorContact || offerModelKeys.length) return undefined;
    const defaults = visibleReasoningItems.slice(0, 2).map((item) => item.modelKey);
    if (defaults.length) setOfferModelKeys(defaults);
    return undefined;
  }, [showAdvisorContact, visibleReasoningItems, offerModelKeys.length]);

  const experienceClass = [
    'cc-experience',
    embedded ? 'cc-experience--embedded' : '',
    inVehicleWorld ? 'cc-experience--vehicle' : '',
    inOfferWorld ? 'cc-experience--offer' : '',
    !inOfferWorld && !inVehicleWorld ? 'cc-experience--living' : '',
    showOpening ? 'cc-experience--living-opening' : '',
    showAdvisorContact ? 'cc-experience--advisor-contact' : '',
    advisorBoostExpanded ? 'cc-experience--advisor-quick' : '',
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
          <CleverMemoryBar
            labels={session.notepadLabels}
            onRemove={handleRemoveUnderstoodLabel}
            animating={labelsAnimating}
          />
        )
      )}

      <div className="cc-experience__scroll" ref={scrollRef}>
        {showOpening && (
          <div className="cc-living__opening">
            <h1 className="cc-living__headline">{opening.headline}</h1>
          </div>
        )}

        {showOpening && !(session.notepadLabels?.length ?? 0) && (
          <div className="cc-smartchips cc-smartchips--living" aria-label="Gedankenanstöße">
            <p className="cc-smartchips__label">{smartChipState.label}</p>
            <div className="cc-smartchips__row" role="list">
              {smartChipState.chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className="cc-smartchips__chip"
                  role="listitem"
                  onClick={() => handleSmartChipClick(chip.text)}
                >
                  <span className="cc-smartchips__chip-icon" aria-hidden>{chip.icon}</span>
                  <span className="cc-smartchips__chip-text">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="cc-transcript">
          {notingFlash && <CleverNotingFlash labels={notingFlash} />}
          {visibleTurns.map((turn) => {
            if (turn.type === TURN_TYPE.ADVISOR_COLLECT) {
              return (
                <CleverAdvisorCollectPanel
                  key={turn.id}
                  session={session}
                  onSubmit={handleDealerHandoff}
                />
              );
            }
            if (turn.type === TURN_TYPE.UNDERSTANDING_MIRROR) {
              return (
                <CleverUnderstandingMoment
                  key={turn.id}
                  labels={turn.labels ?? []}
                  needProfile={session.needProfile}
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

          {showInlineReasoning && (
            <CleverVehicleReasoningPanel
              inline
              showMatchPercent={false}
              items={visibleReasoningItems}
              fadedItems={fadedReasoningItems}
              intro={reasoningHeadline}
              onExclude={showAdvisorContact ? null : handleExcludeModel}
              excludedKeys={excludedModelKeys}
              excludeReaction={excludeReaction}
              offerPrep={showAdvisorContact ? {
                selectedKeys: offerModelKeys,
                onToggle: handleOfferModelToggle,
              } : null}
            />
          )}
        </div>
      </div>

      {showAdvisorContact && (
        <CleverAdvisorContactPrompt
          session={session}
          dealerName={dealerName}
          onContact={handleDealerHandoff}
          onExpandedChange={setAdvisorBoostExpanded}
          offerModelKeys={offerModelKeys}
          offerModels={visibleReasoningItems}
        />
      )}

      {!inOfferWorld && !inCollectMode && renderComposer()}
    </div>
  );
}
