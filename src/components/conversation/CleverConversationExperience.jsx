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
  createHappyPathSession,
  getOpeningCopy,
  getVehicleInputPlaceholder,
  isInOfferWorld,
  isInVehicleWorld,
  isInputEnabled,
  isAdvisorCollectMode,
  removeNeedLabel,
  applyQuickHandoffEnrichment,
  submitDealerHandoff,
  submitPersonalHandoff,
  submitQuestionAnswer,
  submitVehicleAnswer,
  submitVehicleDirectionReaction,
} from '../../services/consultation/consultationHappyPath.js';
import {
  humanizeFallbackReason,
  keepPublicIntakeMessenger,
  submitSafeIntakeFallback,
} from '../../services/consultation/safeIntakeFallback.js';
import { CLEVER_WORLD } from '../../services/consultation/consultationWorlds.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
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
import CleverAdvisorCollectPanel from './CleverAdvisorCollectPanel.jsx';
import CleverUnderstandingMoment from './CleverUnderstandingMoment.jsx';
import CleverInlineOfferCard from './CleverInlineOfferCard.jsx';
import CleverComposerExits from './CleverComposerExits.jsx';
import {
  buildWishHandoffExitLabel,
  buildWishHandoffSecondaryLabel,
} from '../../services/consultation/customerIntakeExits.js';
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import {
  isCleverAiConversationClientEnabled,
  requestCleverConversationTurn,
} from '../../services/clever/openai/cleverConversationClient.js';

function sessionUsesAiMode(session) {
  if (session?.conversationMode === 'ai') return true;
  return (session?.turns ?? []).some((turn) => turn.aiTurn || turn.mode === 'ai');
}

function shouldShowInlineOfferCard(session) {
  if (session?.offerRequested) return true;
  if (session?.sellerReady) return true;
  if (session?.phase === CONVERSATION_PHASE.HANDOFF) return true;
  return (session?.turns ?? []).some((turn) => turn.offerHandoff);
}

function composerPlaceholderForSession(session) {
  const labels = session?.notepadLabels ?? [];
  const model = labels.find((label) => /^EV\d/i.test(String(label)) || /interessant/i.test(String(label)))
    || session?.needProfile?.selectedModelKey
    || session?.needProfile?.modelHint;
  if (model) {
    const raw = String(model).replace(/\s+interessant$/i, '');
    const name = String(raw).toUpperCase().startsWith('EV')
      ? String(raw).toUpperCase().replace(/[^A-Z0-9-]/g, '')
      : String(raw);
    return `Weitere Frage oder Wunsch zum ${name} …`;
  }
  return DEFAULT_COMPOSER_PLACEHOLDER;
}

const SKIPPED_TURN_TYPES = new Set([
  TURN_TYPE.LEARNED,
  TURN_TYPE.UNDERSTANDING_MIRROR,
  VEHICLE_TURN_TYPE.VEHICLE_LEARNED,
]);

const LIVING_INPUT_PLACEHOLDERS = [
  'Weiterfragen oder Wunsch ergänzen …',
];

const HERO_EXAMPLE_PLACEHOLDERS = [
  'z. B. SUV mit 7 Sitzen',
  'z. B. Hybrid mit 1.500 kg Anhängelast',
  'z. B. EV3 Leasing für Familie',
  'z. B. Kleinwagen Elektro',
  'z. B. Auto unter 350 € / Monat',
];

const DEFAULT_COMPOSER_PLACEHOLDER = 'Weiterfragen oder Wunsch ergänzen …';

const POPULAR_ENTRY_CHIPS = [
  { id: 'ev3_family', icon: '👨‍👩‍👧', label: 'EV3 Leasing für Familie', text: 'EV3 Leasing für Familie' },
  { id: 'suv7', icon: '🚙', label: 'SUV mit 7 Sitzen', text: 'SUV mit 7 Sitzen' },
  { id: 'hybrid_tow', icon: '🪝', label: 'Hybrid mit 1.500 kg Anhängelast', text: 'Hybrid mit 1.500 kg Anhängelast' },
  { id: 'klein_e', icon: '⚡', label: 'Kleinwagen Elektro', text: 'Kleinwagen Elektro' },
  { id: 'budget350', icon: '💶', label: 'Auto unter 350 € / Monat', text: 'Auto unter 350 € / Monat' },
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
  onChatActiveChange = null,
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
  const [heroPlaceholderIndex, setHeroPlaceholderIndex] = useState(0);
  const [heroPlaceholderFading, setHeroPlaceholderFading] = useState(false);
  const [labelsAnimating, setLabelsAnimating] = useState(false);
  const [excludedModelKeys, setExcludedModelKeys] = useState([]);
  const [excludeReaction, setExcludeReaction] = useState('');
  const [offerModelKeys, setOfferModelKeys] = useState([]);
  const [aiTurnPending, setAiTurnPending] = useState(false);
  const [lastAddedLabel, setLastAddedLabel] = useState('');
  const [highlightLabels, setHighlightLabels] = useState([]);
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
  const chatActive = !showOpening;

  useEffect(() => {
    if (typeof onChatActiveChange !== 'function') return undefined;
    onChatActiveChange(chatActive);
    return undefined;
  }, [chatActive, onChatActiveChange]);

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
    if (!showOpening) return undefined;
    if (voiceListening) return undefined;
    if (inputValue.trim()) return undefined;
    if (inputFocused) return undefined;
    if (HERO_EXAMPLE_PLACEHOLDERS.length <= 1) return undefined;

    const intervalMs = 3400;
    const fadeMs = 240;

    const handle = window.setInterval(() => {
      setHeroPlaceholderFading(true);
      window.setTimeout(() => {
        setHeroPlaceholderIndex((prev) => (prev + 1) % HERO_EXAMPLE_PLACEHOLDERS.length);
        setHeroPlaceholderFading(false);
      }, fadeMs);
    }, intervalMs);

    return () => window.clearInterval(handle);
  }, [showOpening, voiceListening, inputValue, inputFocused]);

  useEffect(() => {
    if (inOfferWorld || inVehicleWorld || inCollectMode) return undefined;
    if (showOpening) return undefined;
    if (voiceListening) return undefined;
    if (inputValue.trim()) return undefined;
    if (inputFocused) return undefined;
    if (LIVING_INPUT_PLACEHOLDERS.length <= 1) return undefined;

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
  }, [inOfferWorld, inVehicleWorld, inCollectMode, showOpening, voiceListening, inputValue, inputFocused]);

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
    setHighlightLabels(added);
    setNotingFlash(added);
    const toastTimer = window.setTimeout(() => setNotingFlash(null), 1500);
    const glowTimer = window.setTimeout(() => setHighlightLabels([]), 1600);
    return () => {
      window.clearTimeout(toastTimer);
      window.clearTimeout(glowTimer);
    };
  }, [session.notepadLabels, session.vehicleNotepadLabels]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [revealedCount, session.phase]);

  useEffect(() => {
    if (session.phase !== CONVERSATION_PHASE.THINKING) return undefined;
    // Öffentlicher Intake: keine Empfehlungs-Abschlussseite aus dem Happy Path
    setSession((prev) => keepPublicIntakeMessenger({
      ...prev,
      phase: CONVERSATION_PHASE.CONVERSATION,
      turns: (prev.turns ?? []).filter((t) => t.type !== TURN_TYPE.THINKING),
    }));
    return undefined;
  }, [session.phase]);

  useEffect(() => {
    if (session.phase !== VEHICLE_CONVERSATION_PHASE.VEHICLE_THINKING) return undefined;
    // Öffentlicher Intake: Welt-2-Denkpause → zurück in den Messenger
    setSession((prev) => keepPublicIntakeMessenger(prev));
    return undefined;
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
          // AI ok → nur CleverTurnResult; Server-Fallback → Safe Intake (nie Legacy Planner)
          // Nie in Welt-2-Fahrzeugberatung rutschen
          setSession(keepPublicIntakeMessenger(result.session));
          setInputValue('');
          return;
        }

        setSession((prev) => submitSafeIntakeFallback(prev, trimmed, {
          reason: result.error ?? 'request_failed',
        }));
        setInputValue('');
        return;
      } catch {
        setSession((prev) => submitSafeIntakeFallback(prev, trimmed, {
          reason: 'api_error',
        }));
        setInputValue('');
        return;
      } finally {
        setAiTurnPending(false);
      }
    }

    setSession((prev) => submitSafeIntakeFallback(prev, trimmed, {
      reason: 'feature_disabled',
    }));
    setInputValue('');
  }, [aiTurnPending, dealerId, dealerName, session]);

  const handleFormSubmit = (event) => {
    event.preventDefault();
    handleSend(inputValue);
  };

  const smartChipState = useMemo(() => {
    if (showOpening) {
      return {
        label: 'Beliebte Einstiege',
        chips: POPULAR_ENTRY_CHIPS,
      };
    }

    const raw = String(inputValue ?? '').trim().toLowerCase();
    const wishBlob = [
      ...(session.notepadLabels ?? []),
      ...(session.needProfile?.understoodLabels ?? []),
    ].join(' ').toLowerCase();
    const context = `${raw} ${wishBlob}`.trim();

    const defaults = {
      label: 'Vielleicht noch wichtig',
      chips: POPULAR_ENTRY_CHIPS.slice(0, 4),
    };

    const pick = (group) => ({
      label: 'Vielleicht noch wichtig',
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
          { id: 'klein_e', icon: '⚡', label: 'Kleinwagen Elektro', text: 'Kleinwagen Elektro' },
          { id: 'range400', icon: '🔋', label: 'über 400 km Reichweite', text: 'Ich brauche über 400 km Reichweite.' },
          { id: 'ev3_family', icon: '👨‍👩‍👧', label: 'EV3 Leasing für Familie', text: 'EV3 Leasing für Familie' },
        ],
      },
      {
        id: 'family',
        match: /familie|kinder|7\s*sitz|siebensitzer/,
        chips: [
          { id: 'suv7', icon: '🚙', label: 'SUV mit 7 Sitzen', text: 'SUV mit 7 Sitzen' },
          { id: 'ev3_family', icon: '👨‍👩‍👧', label: 'EV3 Leasing für Familie', text: 'EV3 Leasing für Familie' },
          { id: 'trunk', icon: '📦', label: 'großer Kofferraum', text: 'Großer Kofferraum ist mir wichtig.' },
        ],
      },
      {
        id: 'leasing',
        match: /leasing|rate|monat|km|anzahlung/,
        chips: [
          { id: 'budget350', icon: '💶', label: 'unter 350 € / Monat', text: 'Auto unter 350 € / Monat' },
          { id: '48m', icon: '📅', label: '48 Monate', text: '48 Monate wären ideal.' },
          { id: '15k', icon: '🛣', label: '15.000 km', text: 'Ich fahre ca. 15.000 km pro Jahr.' },
        ],
      },
      {
        id: 'trailer',
        match: /anh(ä|ae)ng|wohnwagen|pferd/,
        chips: [
          { id: 'hybrid_tow', icon: '🪝', label: 'Hybrid mit 1.500 kg', text: 'Hybrid mit 1.500 kg Anhängelast' },
          { id: 'towbar', icon: '🔗', label: 'Anhängerkupplung', text: 'Ich brauche eine Anhängerkupplung.' },
          { id: '1500', icon: '🚚', label: 'ca. 1.500 kg', text: 'Zuglast ca. 1.500 kg wäre wichtig.' },
        ],
      },
    ];

    const hit = groups.find((g) => g.match.test(context));
    return hit ? pick(hit) : defaults;
  }, [inputValue, session.notepadLabels, session.needProfile?.understoodLabels, showOpening]);

  const handleSmartChipClick = useCallback((chipText) => {
    const next = String(chipText ?? '').trim();
    if (!next) return;
    // Opening: nur vorbefüllen – Kunde sendet selbst
    if (showOpening) {
      setInputValue(next);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    void handleSend(next);
  }, [handleSend, showOpening]);

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

  const heroPlaceholder = voiceListening
    ? 'Clever hört zu …'
    : (HERO_EXAMPLE_PLACEHOLDERS[heroPlaceholderIndex] || opening.placeholder);

  const livingPlaceholder = composerPlaceholderForSession(session)
    || LIVING_INPUT_PLACEHOLDERS[livingPlaceholderIndex]
    || DEFAULT_COMPOSER_PLACEHOLDER;

  const aiConversationActive = sessionUsesAiMode(session)
    || isCleverAiConversationClientEnabled();

  const renderHeroInput = () => (
    <form className="cc-hero-input" onSubmit={handleFormSubmit}>
      <div className="cc-hero-input__field-wrap">
        <span className="cc-hero-input__spark" aria-hidden>✨</span>
        <input
          ref={inputRef}
          id="cc-hero-conversation-input"
          type="text"
          className="cc-hero-input__field"
          placeholder={heroPlaceholder}
          value={inputValue}
          disabled={!inputEnabled}
          onChange={(event) => setInputValue(event.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          autoComplete="off"
          aria-label="Ihren Wunsch eingeben"
        />
        {!voiceListening && !inputValue.trim() && (
          <span
            className={[
              'cc-hero-input__rotating',
              heroPlaceholderFading ? 'is-fading' : '',
            ].filter(Boolean).join(' ')}
            aria-hidden
          >
            {heroPlaceholder}
          </span>
        )}
      </div>
      <button
        type="button"
        className={`cc-hero-input__mic${voiceListening ? ' is-active' : ''}`}
        onClick={handleVoiceStart}
        disabled={!inputEnabled || !voiceSupported || voiceListening}
        aria-label={opening.voiceLabel}
        title={voiceSupported ? opening.voiceLabel : 'Spracheingabe nicht verfügbar'}
      >
        <span aria-hidden>🎤</span>
      </button>
      <button
        type="submit"
        className="cc-hero-input__send"
        disabled={!inputEnabled || !inputValue.trim()}
        aria-label="Senden"
      >
        <span aria-hidden>➜</span>
      </button>
    </form>
  );

  const renderComposer = () => {
    if (showOpening) {
      return (
        <div className="cc-composer-stack cc-composer-stack--opening">
          {showComposerExits && (
            <CleverComposerExits
              primaryLabel={wishHandoffExitLabel}
              secondaryLabel={wishHandoffSecondaryLabel}
              onPrimary={handleWishHandoffExit}
              onSecondary={handleWishHandoffSecondary}
              disabled={false}
            />
          )}
        </div>
      );
    }

    const formClass = [
      'cc-input-bar',
      inputFocused ? 'cc-input-bar--focused' : '',
      inVehicleWorld && inputEnabled ? 'cc-input-bar--vehicle-active' : '',
      voiceListening ? 'cc-input-bar--listening' : '',
    ].filter(Boolean).join(' ');

    const placeholderText = voiceListening
      ? 'Clever hört zu …'
      : (inVehicleWorld && inputEnabled
        ? getVehicleInputPlaceholder(session)
        : livingPlaceholder);

    return (
      <div className="cc-composer-stack">
        {showComposerExits && (
          <CleverComposerExits
            primaryLabel={wishHandoffExitLabel}
            secondaryLabel={wishHandoffSecondaryLabel}
            onPrimary={handleWishHandoffExit}
            onSecondary={handleWishHandoffSecondary}
            disabled={!inputEnabled}
          />
        )}
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
      </div>
    );
  };

  const handleOptionSelect = (questionId, answerId) => {
    if (String(questionId ?? '').startsWith('ai_') || String(questionId ?? '').startsWith('safe_')) {
      const option = session.pendingQuestion?.options?.find((o) => o.id === answerId);
      handleSend(option?.label ?? String(answerId));
      return;
    }
    // Öffentlicher Intake: keine Legacy-Planner-Chips mehr – Freitext/Label über Safe Fallback
    if (session.conversationMode === 'fallback' || session.conversationMode === 'ai') {
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

  const handleSelectPrimary = useCallback((modelKey) => {
    const key = String(modelKey ?? '').toLowerCase().trim();
    if (!key || aiTurnPending) return;
    // Öffentlicher Intake: „EV2 ansehen“ startet KEINE Welt-2-Fahrzeugberatung
    const label = String(KIA_MODEL_ATTRIBUTES[key]?.label ?? key).replace(/^Kia\s+/i, '');
    handleSend(`Ich möchte den ${label} genauer ansehen.`);
  }, [aiTurnPending, handleSend]);

  const handleNextTopic = useCallback((topic) => {
    const message = String(topic?.customerMessage ?? '').trim();
    const topicId = String(topic?.id ?? '').trim();
    if (!message || aiTurnPending) return;
    if (topicId) {
      setSession((prev) => {
        const answered = prev.answeredNextTopicIds ?? [];
        if (answered.includes(topicId)) return prev;
        return {
          ...prev,
          answeredNextTopicIds: [...answered, topicId],
        };
      });
    }
    void handleSend(message);
  }, [aiTurnPending, handleSend]);

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
  const activeNextTopicsTurnId = (() => {
    for (let i = visibleTurns.length - 1; i >= 0; i -= 1) {
      const turn = visibleTurns[i];
      if (turn?.type === TURN_TYPE.CLEVER && (turn.nextTopics?.length ?? 0) > 0) {
        return turn.id;
      }
    }
    return null;
  })();

  const hasReasoningContent = visibleReasoningItems.length > 0 || fadedReasoningItems.length > 0;
  // Intake: kein Seller-Reasoning-Panel / Ranking in der öffentlichen Kunden-UI
  const showInlineReasoning = false;
  void hasReasoningContent;

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
    if (shouldShowInlineOfferCard(session)) {
      setWishHandoffLatched(true);
    }
  }, [session]);

  const showInlineOffer = !inOfferWorld
    && !inCollectMode
    && (wishHandoffLatched || shouldShowInlineOfferCard(session));

  // Wunschübergabe ab Turn 1 – keine parallelen „Verkäufer kontaktieren“-CTAs
  const showComposerExits = !inOfferWorld && !inCollectMode;
  const wishHandoffExitLabel = buildWishHandoffExitLabel({
    ...session,
    offerModelKeys,
  });
  const wishHandoffSecondaryLabel = buildWishHandoffSecondaryLabel({
    ...session,
    offerModelKeys,
  });

  const isDevEngineBadge = Boolean(import.meta.env.DEV);
  const engineBadge = useMemo(() => {
    if (!isDevEngineBadge) return null;
    if (session.conversationMode === 'ai' || sessionUsesAiMode(session)) {
      const model = session.aiModel || 'openai';
      return { kind: 'ai', label: `AI · ${model}` };
    }
    if (session.conversationMode === 'fallback' || (session.turns ?? []).some((t) => t.fallbackTurn)) {
      const reason = session.fallbackReason
        || humanizeFallbackReason('unavailable');
      return { kind: 'fallback', label: `FALLBACK · ${reason}` };
    }
    return null;
  }, [isDevEngineBadge, session]);

  const handleWishHandoffExit = useCallback(() => {
    setWishHandoffLatched(true);
    handleDealerHandoff({
      selectedOfferModels: offerModelKeys,
    });
  }, [handleDealerHandoff, offerModelKeys]);

  const handleWishHandoffSecondary = useCallback(() => {
    setWishHandoffLatched(true);
    handleDealerHandoff({
      selectedOfferModels: offerModelKeys,
      enrichLeasing: true,
    });
  }, [handleDealerHandoff, offerModelKeys]);

  useEffect(() => {
    if (!showInlineOffer || offerModelKeys.length) return undefined;
    if (aiConversationActive) return undefined;
    const defaults = visibleReasoningItems.slice(0, 2).map((item) => item.modelKey);
    if (defaults.length) setOfferModelKeys(defaults);
    return undefined;
  }, [showInlineOffer, visibleReasoningItems, offerModelKeys.length, aiConversationActive]);

  const experienceClass = [
    'cc-experience',
    'cc-experience--messenger',
    embedded ? 'cc-experience--embedded' : '',
    inVehicleWorld ? 'cc-experience--vehicle' : '',
    inOfferWorld ? 'cc-experience--offer' : '',
    !inOfferWorld && !inVehicleWorld ? 'cc-experience--living' : '',
    showOpening ? 'cc-experience--living-opening' : '',
    showInlineOffer ? 'cc-experience--inline-offer' : '',
    advisorBoostExpanded ? 'cc-experience--advisor-quick' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={experienceClass}>
      {!embedded && (
        <header className="cc-experience__dealer">
          <span className="cc-experience__dealer-name">{dealerName}</span>
          {engineBadge && (
            <span
              className={`cc-experience__engine-badge cc-experience__engine-badge--${engineBadge.kind}`}
              title="Nur Development – Conversation Engine"
            >
              {engineBadge.label}
            </span>
          )}
        </header>
      )}
      {embedded && engineBadge && (
        <div className="cc-experience__engine-badge-row" aria-hidden="true">
          <span
            className={`cc-experience__engine-badge cc-experience__engine-badge--${engineBadge.kind}`}
          >
            {engineBadge.label}
          </span>
        </div>
      )}

      {!inOfferWorld && !showOpening && (
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
            highlightLabels={highlightLabels}
          />
        )
      )}

      <div className="cc-experience__scroll" ref={scrollRef}>
        {notingFlash && !showOpening && (
          <div className="cc-note-toast-slot">
            <CleverNotingFlash labels={notingFlash} />
          </div>
        )}

        {showOpening && (
          <div className="cc-hero">
            <div className="cc-hero__copy">
              <h1 className="cc-hero__headline">{opening.headline}</h1>
              {opening.subline && (
                <p className="cc-hero__subline">{opening.subline}</p>
              )}
            </div>
            {renderHeroInput()}
            {voiceError && !voiceListening && (
              <p className="cc-hero__voice-error" role="alert">{voiceError}</p>
            )}
            <div className="cc-hero__entries" aria-label="Beliebte Einstiege">
              <p className="cc-hero__entries-label">{smartChipState.label}</p>
              <div className="cc-hero__entries-row" role="list">
                {smartChipState.chips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="cc-hero__entry"
                    role="listitem"
                    onClick={() => handleSmartChipClick(chip.text)}
                  >
                    <span className="cc-hero__entry-icon" aria-hidden>{chip.icon}</span>
                    <span className="cc-hero__entry-text">{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!showOpening && (
        <div className="cc-transcript">
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
                onVehicleAction={handleSelectPrimary}
                onNextTopic={handleNextTopic}
                isActiveQuestion={turn.type === TURN_TYPE.CLEVER && turn.questionId === activeQuestionId}
                nextTopicsActive={turn.id === activeNextTopicsTurnId}
                nextTopicsDisabled={aiTurnPending || !inputEnabled}
              />
            );
          })}

          {showInlineOffer && !inOfferWorld && (
            <CleverInlineOfferCard
              vehicleCount={offerModelKeys.length
                || (session.cleverVehicleDirections ?? []).filter((d) => d.status === 'candidate' || d.status === 'interesting').length}
              onContinue={() => handleDealerHandoff({
                selectedOfferModels: offerModelKeys,
              })}
            />
          )}

          {showInlineReasoning && (
            <CleverVehicleReasoningPanel
              inline
              showMatchPercent={false}
              items={visibleReasoningItems}
              fadedItems={fadedReasoningItems}
              intro={reasoningHeadline}
              onExclude={handleExcludeModel}
              excludedKeys={excludedModelKeys}
              excludeReaction={excludeReaction}
              offerPrep={null}
            />
          )}
        </div>
        )}
      </div>

      {!inOfferWorld && !inCollectMode && renderComposer()}
    </div>
  );
}
