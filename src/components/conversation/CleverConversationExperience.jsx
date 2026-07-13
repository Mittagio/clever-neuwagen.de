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
import { buildWishProfilePresentation } from '../../services/consultation/consultationOfferHandoff.js';
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
import CleverAdvisorCollectPanel from './CleverAdvisorCollectPanel.jsx';
import CleverUnderstandingMoment from './CleverUnderstandingMoment.jsx';
import { shouldShowWishHandoffCta } from '../../services/consultation/consultationOfferHandoff.js';
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

const LIVING_PLACEHOLDER_TEXTS = [
  'Ich suche ein Elektroauto für zwei Kinder …',
  'Mein Leasing läuft im November aus …',
  'EV2 oder EV3?',
  'Ich brauche Platz für Hund und Kinderwagen …',
  'Ich fahre oft mit Anhänger …',
  'Mein Budget liegt bei etwa 350 € monatlich …',
  'Sportage oder EV5?',
  'Ich möchte später übernehmen können …',
];

function iconForLabel(label = '') {
  const t = String(label ?? '').toLowerCase();
  if (/^elektro$|plug-in|hybrid|benzin|diesel/.test(t)) return '⚡';
  if (/^ev\d|sportage|ceed|niro|picanto|sorento|carnival/.test(t)) return '🚗';
  if (/leasing|finanz|kauf/.test(t) || /budget/.test(t) || /€\/monat/.test(t)) return '💶';
  if (/monate|km/.test(t)) return '📅';
  if (/anhäng|anhaeng|ahk|kupplung|anhängelast/.test(t)) return '🔗';
  if (/blau|rot|weiß|weiss|schwarz|grün|gruen|grau|silber|wolfsgrau/.test(t)) return '🎨';
  if (/familie|kinder/.test(t)) return '👨‍👩‍👧';
  if (/hund/.test(t)) return '🐶';
  if (/wärmepumpe|waermepumpe/.test(t)) return '🌡';
  if (/\bv2l\b/.test(t)) return '🔌';
  if (/sitzheizung/.test(t)) return '🔥';
  if (/kofferraum/.test(t)) return '📦';
  if (/rückfahr|rueckfahr|kamera|360/.test(t)) return '📷';
  if (/schnellladen/.test(t)) return '⚡';
  if (/wallbox|zuhause|daheim/.test(t)) return '🏠';
  if (/winter/.test(t)) return '❄';
  if (/isofix/.test(t)) return '👶';
  if (/kinderwagen/.test(t)) return '🛒';
  if (/dachbox/.test(t)) return '🏕';
  if (/pferde/.test(t)) return '🐴';
  return '·';
}

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
  const [advisorBoostExpanded, setAdvisorBoostExpanded] = useState(false);
  const [livingPlaceholderIndex, setLivingPlaceholderIndex] = useState(0);
  const [livingPlaceholderFading, setLivingPlaceholderFading] = useState(false);
  const [labelsAnimating, setLabelsAnimating] = useState(false);
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
    if (!showOpening) return undefined;
    if (voiceListening) return undefined;
    if (inputValue.trim()) return undefined;
    if (inputFocused) return undefined;

    const intervalMs = 3600;
    const fadeMs = 260;

    const handle = window.setInterval(() => {
      setLivingPlaceholderFading(true);
      window.setTimeout(() => {
        setLivingPlaceholderIndex((prev) => (prev + 1) % LIVING_PLACEHOLDER_TEXTS.length);
        setLivingPlaceholderFading(false);
      }, fadeMs);
    }, intervalMs);

    return () => window.clearInterval(handle);
  }, [showOpening, voiceListening, inputValue, inputFocused]);

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

  const handleExampleSelect = useCallback((text) => {
    handleSend(text);
  }, [handleSend]);

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

  const renderComposer = (variant = 'bar') => {
    const isTool = variant === 'tool';
    const formClass = [
      isTool ? 'cc-tool__composer' : 'cc-input-bar',
      !isTool && inputFocused ? 'cc-input-bar--focused' : '',
      !isTool && inVehicleWorld && inputEnabled ? 'cc-input-bar--vehicle-active' : '',
      !isTool && voiceListening ? ' cc-input-bar--listening' : '',
    ].filter(Boolean).join(' ');

    return (
      <form className={formClass} onSubmit={handleFormSubmit}>
        {!isTool && (
          <label className="cc-input-bar__label" htmlFor="cc-conversation-input">
            {inVehicleWorld ? 'Einfach weitererzählen' : 'Einfach erzählen oder fragen'}
          </label>
        )}
        {voiceListening && (
          <p className={isTool ? 'cc-tool__voice-status' : 'cc-input-bar__voice-status'} aria-live="polite">
            Clever hört zu …
          </p>
        )}
        {voiceError && !voiceListening && (
          <p className={isTool ? 'cc-tool__voice-error' : 'cc-input-bar__voice-error'} role="alert">
            {voiceError}
          </p>
        )}
        <div className={isTool ? 'cc-tool__input-row' : 'cc-input-bar__row'}>
          <div className={isTool ? 'cc-tool__field-wrap' : ''}>
            <input
              ref={inputRef}
              id="cc-conversation-input"
              type="text"
              className={isTool ? 'cc-tool__field' : 'cc-input-bar__field'}
              placeholder={voiceListening ? 'Clever hört zu …' : (showOpening ? opening.placeholder : inputPlaceholder)}
              value={inputValue}
              disabled={!inputEnabled}
              onChange={(event) => setInputValue(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              autoComplete="off"
              autoFocus={isTool}
            />
            {isTool && showOpening && !voiceListening && !inputValue.trim() && (
              <span
                className={[
                  'cc-tool__living-placeholder',
                  livingPlaceholderFading ? 'is-fading' : '',
                ].filter(Boolean).join(' ')}
                aria-hidden
              >
                {LIVING_PLACEHOLDER_TEXTS[livingPlaceholderIndex] ?? opening.placeholder}
              </span>
            )}
          </div>
          <button
            type="button"
            className={`${isTool ? 'cc-tool__mic' : 'cc-input-bar__mic'}${voiceListening ? ' is-active' : ''}`}
            onClick={handleVoiceStart}
            disabled={!inputEnabled || !voiceSupported || voiceListening}
            aria-label={opening.voiceLabel}
            title={voiceSupported ? opening.voiceLabel : 'Spracheingabe nicht verfügbar'}
          >
            <span aria-hidden>🎤</span>
          </button>
          <button
            type="submit"
            className={isTool ? 'cc-tool__send' : 'cc-input-bar__send'}
            disabled={!inputEnabled || !inputValue.trim()}
            aria-label="Senden"
          >
            <span aria-hidden>➜</span>
          </button>
        </div>
        {isTool && voiceSupported && !voiceListening && (
          <p className="cc-tool__voice-hint">{opening.voiceLabel}</p>
        )}
      </form>
    );
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

  const [wishHandoffLatched, setWishHandoffLatched] = useState(false);

  useEffect(() => {
    if (shouldShowWishHandoffCta(session)) {
      setWishHandoffLatched(true);
    }
  }, [session]);

  const showWishHandoff = wishHandoffLatched || shouldShowWishHandoffCta(session);
  const showAdvisorContact = !inOfferWorld && !inCollectMode && showWishHandoff;

  const experienceClass = [
    'cc-experience',
    embedded ? 'cc-experience--embedded' : '',
    inVehicleWorld ? 'cc-experience--vehicle' : '',
    inOfferWorld ? 'cc-experience--offer' : '',
    showOpening ? 'cc-experience--tool-opening' : '',
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
          <CleverNotepadBar labels={session.notepadLabels} needProfile={session.needProfile} />
        )
      )}

      <div className="cc-experience__scroll" ref={scrollRef}>
        {showOpening && (
          <section className="cc-tool" aria-label="Clever">
            <h1 className="cc-tool__headline">{opening.headline}</h1>

            {renderComposer('tool')}

            {(session.notepadLabels?.length ?? 0) > 0 && (
              <div
                className={[
                  'cc-understood',
                  labelsAnimating ? 'is-animating' : '',
                ].filter(Boolean).join(' ')}
                aria-label="Das wurde verstanden"
              >
                {session.notepadLabels.map((label) => (
                  <span key={label} className="cc-understood__chip">
                    <span className="cc-understood__chip-icon" aria-hidden>{iconForLabel(label)}</span>
                    <span className="cc-understood__chip-text">{label}</span>
                    <button
                      type="button"
                      className="cc-understood__chip-x"
                      onClick={() => handleRemoveUnderstoodLabel(label)}
                      aria-label={`${label} entfernen`}
                      title={`${label} entfernen`}
                    >
                      <span aria-hidden>✕</span>
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="cc-smartchips" aria-label="Gedankenanstöße">
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
          </section>
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
        </div>
      </div>

      {showAdvisorContact && (
        <CleverAdvisorContactPrompt
          session={session}
          dealerName={dealerName}
          onContact={handleDealerHandoff}
          onExpandedChange={setAdvisorBoostExpanded}
        />
      )}

      {!inOfferWorld && !inCollectMode && !showOpening && renderComposer('bar')}
    </div>
  );
}
