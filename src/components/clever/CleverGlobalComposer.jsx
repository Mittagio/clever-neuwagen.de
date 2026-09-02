/**
 * CleverGlobalComposer – Dashboard-Surface des Clever-Composers.
 * Orchestrierung nur über runCleverSellerTurn – keine zweite Pipeline.
 * Kundenakte: gleicher Orchestrator in CustomerAkteSharedWorkspace (fester Lead);
 * dieser Global Composer wird dort nicht gerendert.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import SellerUniversalReviewCard from '../dealer-ai/SellerUniversalReviewCard.jsx';
import DealerAiInlineMic from '../dealer-ai/DealerAiInlineMic.jsx';
import { useCleverComposerOptional } from '../../context/CleverComposerContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  runCleverSellerTurn,
  runCleverSellerTurnAsync,
  runCleverSellerTurnWithCalendar,
} from '../../services/cleverSeller/runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from '../../services/cleverSeller/buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from '../../services/cleverSeller/applyAcceptedSellerTurn.js';
import { extractMagicOfferPdf } from '../../services/dealer/magicOfferPdfExtract.js';
import { runComposerPdfAttachTurnWithOcr } from '../../services/cleverSeller/runComposerPdfAttachTurn.js';
import { runComposerScreenshotAttachTurnWithInterpret } from '../../services/cleverSeller/runComposerScreenshotAttachTurn.js';
import { isCleverScreenshotInterpretClientEnabled } from '../../services/cleverSeller/isCleverScreenshotInterpretEnabled.js';
import { executeDualOfferAppointmentAccept } from '../../services/cleverSeller/executeDualOfferAppointmentAccept.js';
import {
  isCleverContractOcrEnabled,
  resolveCleverOcrLang,
  resolveCleverOcrProvider,
} from '../../services/cleverSeller/resolveCleverOcrProvider.js';
import { tryCreateTesseractOcrEngine } from '../../services/cleverSeller/createCleverContractOcrProvider.js';
import { resolveCleverCalendarProvider } from '../../services/cleverSeller/resolveCleverCalendarProvider.js';
import { maybeCreateCalendarDraftEvent } from '../../services/cleverSeller/checkCalendarAvailability.js';
import { refreshSellerTurnCalendarCheck } from '../../services/cleverSeller/refreshSellerTurnCalendarCheck.js';
import { enrichSellerTurnWithMagicPropose } from '../../services/cleverSeller/enrichSellerTurnWithMagicPropose.js';
import { SELLER_TURN_INTENTS } from '../../services/cleverSeller/sellerFactTypes.js';
import {
  isCleverAgentClientEnabled,
  requestCleverAgent,
  shouldFallbackToSellerTurn,
} from '../../services/cleverAgent/cleverAgentClient.js';
import { applyCleverAgentMutations } from '../../services/cleverAgent/applyCleverAgentMutations.js';
import {
  createEmptyAgentWorkingMemory,
  getConversationHistoryForAgent,
  buildSellerTurnMemoryParams,
  updateAgentWorkingMemory,
  updateMemoryFromSellerTurn,
} from '../../services/cleverAgent/cleverAgentWorkingMemory.js';
import {
  resolveAgentResponsePolicy,
  resolveSellerResponsePolicy,
} from '../../services/cleverAgent/cleverAssistantResponse.js';
import { buildAgentReviewTurn } from '../../services/cleverAgent/buildAgentReviewTurn.js';
import { routeSellerRequest } from '../../services/cleverAgent/routeSellerRequest.js';
import {
  buildAssistantFeedCardOptions,
  createRememberUndoToken,
  normalizeCustomerSearchResults,
  postAssistantConversationFeedCard,
  resolveContextSwitchFromAgent,
} from '../../services/cleverAgent/cleverAssistantFeed.js';
import {
  CLEVER_LONG_JOB,
  createProgressHintScheduler,
} from '../../services/cleverAgent/cleverProgressHint.js';
import { CleverChatMessage } from '../chat/WorkspaceChatCards.jsx';
import { isPrepareSuccessionOfferCue } from '../../services/cleverSeller/prepareSuccessionOfferFromLead.js';
import { shouldUseSemanticInterpreter } from '../../services/cleverSeller/multiSource/evaluateComplexSellerTurn.js';
import { applyConfirmedMultiSourceIntakePlan } from '../../services/cleverSeller/multiSource/applyConfirmedMultiSourceIntakePlan.js';
import { buildMultiSourceApplyResultReview } from '../../services/cleverSeller/multiSource/buildMultiSourceApplyResultReview.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import { buildVehicleOpportunityCards } from '../../services/customerAkte.js';
import {
  isCleverSellerOpenAiInterpretClientEnabled,
  requestCleverScreenshotInterpret,
  requestCleverSellerTurn,
  shouldRequestServerSellerTurn,
} from '../../services/clever/intelligence/cleverSharedIntelligenceClient.js';
import {
  COMPOSER_HERO_PLACEHOLDERS,
  resolveComposerDockMode,
  resolveComposerPlaceholder,
  resolveComposerSurfaceState,
  resolveDockedContentSpacerPx,
} from '../../services/cleverSeller/composerSurfaceState.js';
import { buildHomePrepareOfferComposerTask } from '../../logic/backendHomeEmpfiehltActions.js';
import {
  COMPOSER_INTENT_CHIP_IDS,
  COMPOSER_INTENT_CHIPS,
  COMPOSER_INTENT_MORE_CHIPS,
  resetIntentConstraintToDefault,
  resolveAttachmentIntentActions,
  resolveIntentChipById,
  resolveIntentChipTooltip,
  resolveIntentComposerLabels,
  resolveIntentModeHint,
  resolveIntentPlaceholder,
  resolveIntentSecondaryActions,
  resolveVisiblePrimaryIntentChips,
} from '../../services/cleverSeller/composerIntentChips.js';
import { findOfferWorkingContext, toCurrentOfferContext } from '../../services/crm/composerWorkingContext.js';
import {
  applyQuietIntakeSubtaskResult,
  isQuietIntakeReview,
  isQuietIntakeTurn,
  resolveQuietIntakeSuggestChips,
} from '../../services/cleverSeller/quietIntakeReview.js';
import {
  patchSellerReviewFact,
  undoSellerReviewFactPatch,
} from '../../services/cleverSeller/patchSellerReviewFact.js';
import {
  IconCalendar,
  IconFile,
  IconTag,
} from '../dealer-ai/AkteIcons.jsx';
import './CleverGlobalComposer.css';

const FALLBACK_INTERPRET_WARNING = [
  'Clever konnte den gesamten Fall nicht vollständig',
  'mit dem Sprachmodell interpretieren.',
  'Bitte prüfen Sie die erkannten Angaben.',
].join(' ');

/**
 * Feedback-Freeze: kein grüner Erfolgs-/Narrations-Hint unter dem Composer
 * für Intake + Understanding. Fehler/Warnungen bleiben erlaubt.
 */
function quietReviewFeedback(model, turn, fallback = '') {
  if (isQuietIntakeReview(model) || isQuietIntakeTurn(turn)) return '';
  if (model?.understandingFactReview || model?.hideGlobalAccept) return '';
  const text = String(fallback || '').trim();
  if (!text) return '';
  // Titel-Echo („Clever hat verstanden“) nie als Composer-Statuszeile
  if (/Clever hat verstanden|Clever hat vorbereitet|Clever hat einsortiert/i.test(text)) {
    return '';
  }
  return text;
}

function isComposerErrorFeedback(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  return /fehlgeschlagen|nicht möglich|konnte noch nicht|bitte zuerst|Fehler|prüfen Sie|nicht verfügbar|nicht geprüft|block|Warnung/i.test(t)
    || t === FALLBACK_INTERPRET_WARNING;
}

/** Home-Hero Quick Actions (Showroom/Modellwelt → Werkzeuge) */
const HOME_QUICK_CHIPS = [
  { id: 'today', label: 'Was liegt heute an?', Icon: IconCalendar },
  { id: 'intake', label: 'Neue Anfrage', Icon: IconFile },
  { id: 'prepare_offer', label: 'Angebot vorbereiten', Icon: IconTag },
];

const DOCK_SCROLL_THRESHOLD = 96;

function buildAkteNavPath({ leadId, messageId = null, offerId = null }) {
  if (!leadId) return null;
  const base = buildKundenaktePath(leadId);
  const params = new URLSearchParams();
  if (messageId) params.set('messageId', messageId);
  if (offerId) params.set('offerId', offerId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** PDF/Vertrag aus letztem Turn oder Working Context für Multi-Source. */
function collectComposerAttachments({ lastTurn = null, workingContextItems = [] } = {}) {
  const out = [];
  const push = (att) => {
    if (!att) return;
    const text = String(att.extractedText || att.text || '').trim();
    const kind = att.kind || att.sourceType || null;
    if (!text && kind !== 'contract_pdf') return;
    out.push({
      id: att.id || att.fileName || `att_${out.length}`,
      kind: kind || 'contract_pdf',
      sourceType: att.sourceType || kind || 'contract_pdf',
      fileName: att.fileName || att.name || 'dokument.pdf',
      extractedText: text.slice(0, 24000),
      mimeType: att.mimeType || 'application/pdf',
    });
  };

  const contractAction = (lastTurn?.preparedActions || []).find((a) => (
    a.type === SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
  ));
  if (contractAction?.payload) {
    push({
      id: contractAction.payload.attachmentId || 'last-contract',
      kind: 'contract_pdf',
      sourceType: contractAction.payload.sourceType || 'contract_pdf',
      fileName: contractAction.payload.fileName || 'vertrag.pdf',
      extractedText: contractAction.payload.extractedText
        || contractAction.payload.rawText
        || contractAction.payload.attachment?.extractedText
        || '',
    });
  }

  for (const item of workingContextItems || []) {
    if (item?.extractedText || item?.kind === 'contract_pdf' || item?.type === 'contract_pdf') {
      push(item);
    }
  }

  return out;
}

export default function CleverGlobalComposer() {
  const ctx = useCleverComposerOptional();
  const { updateLead, addLead } = useLeads();
  const navigate = useNavigate();
  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const shellRef = useRef(null);
  const surfaceExpandedRef = useRef(false);
  const dockModeRef = useRef('hero');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackKind, setFeedbackKind] = useState('');
  const [reviewModel, setReviewModel] = useState(null);
  const [lastTurn, setLastTurn] = useState(null);
  const [progressHint, setProgressHint] = useState(null);
  const [focused, setFocused] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [selectedIntentChipId, setSelectedIntentChipId] = useState(
    COMPOSER_INTENT_CHIPS[0].id,
  );
  const [intentPurpose, setIntentPurpose] = useState(null);
  /** Suggest-Chip-Aufgabe unter quiet Intake (task-spezifischer Composer-Titel) */
  const [quietIntakeTask, setQuietIntakeTask] = useState(null);
  const [rememberUndo, setRememberUndo] = useState(null);
  /** Live-Edit Undo (Chip-Korrektur) – lokal, kein Composer-Erfolg */
  const [liveEditUndo, setLiveEditUndo] = useState(null);
  const [attachmentActions, setAttachmentActions] = useState(null);
  const [agentWorkingMemory, setAgentWorkingMemory] = useState(() => createEmptyAgentWorkingMemory());
  /** Work-Context-Karte bleibt stehen, während Composer-Subtasks laufen */
  const quietIntakeContextRef = useRef(null);
  const progressHintSchedulerRef = useRef(null);
  if (!progressHintSchedulerRef.current) {
    progressHintSchedulerRef.current = createProgressHintScheduler({
      setHint: setProgressHint,
    });
  }

  const visible = Boolean(ctx?.shouldShowGlobalComposer);
  const heroSlotEl = ctx?.composerHeroSlotEl || null;

  const contextPills = useMemo(() => {
    if (!ctx) return [];
    return (ctx.attachedWorkingObjects || []).map((obj) => ({
      id: obj.id || obj.offerId || obj.label,
      label: obj.label || 'Arbeitsobjekt',
    }));
  }, [ctx]);

  const customerMessageEdit = Boolean(
    lastTurn?.handoffWorkingContext?.composerMode === 'customer_message_edit'
    || ctx?.attachedWorkingObjects?.some((item) => item?.composerMode === 'customer_message_edit'),
  );
  const hasPendingAction = Boolean(
    lastTurn?.pendingAction
    || agentWorkingMemory?.pendingAction
    || ctx?.pendingAction,
  );

  const surfaceState = resolveComposerSurfaceState({
    focused,
    draft,
    hasAttachment: contextPills.length > 0,
    dictating,
    reviewOpen: Boolean(reviewModel),
    pendingAction: hasPendingAction,
    customerMessageEdit,
  });
  const isIdle = surfaceState === 'idle';
  const surfaceExpanded = surfaceState === 'expanded';
  surfaceExpandedRef.current = surfaceExpanded;

  const dockMode = resolveComposerDockMode({
    scrolledPastHero,
    surfaceExpanded,
    currentlyDocked: scrolledPastHero || dockModeRef.current === 'docked',
  });
  dockModeRef.current = dockMode;
  const useHeroPortal = dockMode === 'hero' && heroSlotEl;
  const selectedIntentChip = resolveIntentChipById(selectedIntentChipId);
  const intentConstraint = selectedIntentChip?.intentConstraint ?? null;
  const customerDisplayName = ctx?.currentCustomer?.contact?.name
    || ctx?.currentCustomer?.name
    || '';
  const intentPurposeOptions = useMemo(() => ({
    messagePurpose: intentPurpose?.messagePurpose || null,
    memoryCategory: intentPurpose?.memoryCategory || null,
    offerAction: intentPurpose?.offerAction || null,
    purposeLabel: intentPurpose?.label || null,
  }), [intentPurpose]);
  const intentPlaceholder = resolveIntentPlaceholder(
    intentConstraint,
    customerDisplayName,
    intentPurposeOptions,
  );
  const intentLabels = resolveIntentComposerLabels(
    intentConstraint,
    customerDisplayName,
    intentPurposeOptions,
  );
  const intentModeHint = useMemo(
    () => (intentConstraint
      ? resolveIntentModeHint(intentConstraint, {
        customerName: customerDisplayName,
        purposeLabel: intentPurpose?.label || '',
      })
      : ''),
    [intentConstraint, customerDisplayName, intentPurpose],
  );
  const intentChipTooltips = useMemo(() => {
    const map = {};
    COMPOSER_INTENT_CHIPS.forEach((chip) => {
      map[chip.id] = resolveIntentChipTooltip(chip.id);
    });
    map.mehr = resolveIntentChipTooltip('mehr');
    return map;
  }, []);
  const visibleIntentChips = useMemo(
    () => resolveVisiblePrimaryIntentChips(selectedIntentChipId),
    [selectedIntentChipId],
  );
  const workingObjects = ctx?.attachedWorkingObjects || [];
  const currentLead = ctx?.currentCustomer || null;
  const hasOpenOffer = Boolean(
    findOfferWorkingContext(workingObjects)
    || workingObjects.some((item) => item?.offerId),
  );
  const missingDocuments = Boolean(
    currentLead?.crm?.missingDocuments?.length
    || currentLead?.missingDocuments?.length
    || /unterlagen|dokumente|fehlt/i.test(String(currentLead?.crm?.nextStep || '')),
  );
  const hasOpenAppointment = Boolean(
    lastTurn?.pendingAction?.type === 'propose_appointment'
    || currentLead?.crm?.nextAppointment,
  );
  const secondaryIntentActions = useMemo(
    () => resolveIntentSecondaryActions(intentConstraint, {
      customerName: customerDisplayName,
      missingDocuments,
      hasOpenOffer,
      hasOpenAppointment,
    }),
    [intentConstraint, customerDisplayName, missingDocuments, hasOpenOffer, hasOpenAppointment],
  );
  const quietIntakeOpen = Boolean(
    isQuietIntakeReview(reviewModel) || isQuietIntakeTurn(lastTurn),
  );
  const quietIntakeSuggestChips = useMemo(() => {
    // Subtask aktiv: nur Choice-Chips (z. B. Modell), keine konkurrierende Toolbar
    if (quietIntakeTask?.choiceChips?.length) {
      return quietIntakeTask.choiceChips;
    }
    if (quietIntakeTask) return [];
    if (!quietIntakeOpen) return [];
    return resolveQuietIntakeSuggestChips(lastTurn);
  }, [quietIntakeOpen, quietIntakeTask, lastTurn]);

  const composerPlaceholder = quietIntakeTask?.placeholder
    || intentPlaceholder
    || resolveComposerPlaceholder({
      draft,
      hintIndex: placeholderIndex,
      dockMode,
      placeholders: COMPOSER_HERO_PLACEHOLDERS,
      quietIntake: quietIntakeOpen && !quietIntakeTask,
    });
  const composerLabel = quietIntakeTask?.title || intentLabels.label;

  useEffect(() => {
    if (quietIntakeOpen && reviewModel && lastTurn) {
      quietIntakeContextRef.current = { reviewModel, lastTurn };
      return;
    }
    if (!reviewModel && !lastTurn) {
      quietIntakeContextRef.current = null;
      setQuietIntakeTask(null);
    }
  }, [quietIntakeOpen, reviewModel, lastTurn]);

  function resetIntentChipsToDefault() {
    setSelectedIntentChipId(resetIntentConstraintToDefault().id);
    setIntentPurpose(null);
  }

  /** Composer-Feedback: Fehler sichtbar, Erfolgs-Grün für Intake/Understanding unterdrückt */
  function pushComposerFeedback(text, { kind = null, ms = 3200 } = {}) {
    const value = String(text || '').trim();
    if (!value) {
      setFeedback('');
      setFeedbackKind('');
      return;
    }
    const resolvedKind = kind
      || (isComposerErrorFeedback(value) ? 'error' : 'neutral');
    // Freeze: keine Success-Zeilen unter dem Composer
    if (resolvedKind === 'success') {
      setFeedback('');
      setFeedbackKind('');
      return;
    }
    setFeedback(value);
    setFeedbackKind(resolvedKind);
    setTimeout(() => {
      setFeedback('');
      setFeedbackKind('');
    }, ms);
  }

  /** Nach Subtask: Composer zurück zu Clever, Intake-Karte behalten */
  function restoreQuietIntakeWorkContext(completedTurn = null) {
    const task = quietIntakeTask;
    setQuietIntakeTask(null);
    resetIntentChipsToDefault();
    const preserved = quietIntakeContextRef.current;
    if (!preserved?.reviewModel && !preserved?.lastTurn) return;

    const merged = applyQuietIntakeSubtaskResult({
      preservedTurn: preserved.lastTurn,
      completedTurn,
      taskId: task?.id || null,
    });
    const nextReview = merged.reviewModel || preserved.reviewModel;
    const nextTurn = merged.lastTurn || preserved.lastTurn;
    // Erfolg = State-Change (Chip/Glow/Micro-Confirm) – kein Composer-Feedback
    setFeedback('');
    setFeedbackKind('');
    if (nextReview) setReviewModel(nextReview);
    if (nextTurn) setLastTurn(nextTurn);
    quietIntakeContextRef.current = {
      reviewModel: nextReview,
      lastTurn: nextTurn,
    };
  }

  function handleSecondaryIntentAction(action) {
    if (!action || sending) return;
    setFocused(true);
    setIntentPurpose({
      id: action.id,
      label: action.label,
      messagePurpose: action.messagePurpose || null,
      memoryCategory: action.memoryCategory || null,
      offerAction: action.offerAction || null,
    });
    const seed = String(action?.draftSeed || '');
    if (seed.trim()) {
      setDraft((prev) => {
        const cur = String(prev ?? '').trim();
        if (!cur || /:\s*$/.test(seed)) return seed;
        if (cur === seed.trim()) return seed;
        return `${cur}\n${seed}`;
      });
    }
  }

  const setComposerDocked = ctx?.setComposerDocked;
  useEffect(() => {
    if (typeof setComposerDocked !== 'function') return;
    setComposerDocked(dockMode === 'docked');
  }, [dockMode, setComposerDocked]);

  useEffect(() => {
    if (!visible || typeof window === 'undefined') {
      return undefined;
    }
    const onScroll = () => {
      const past = window.scrollY > DOCK_SCROLL_THRESHOLD;
      setScrolledPastHero((prev) => {
        if (past) return true;
        // Während Tippen/Attachment/Review nicht zurück zum Hero springen
        if (surfaceExpandedRef.current) return prev;
        return false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [visible]);

  // Idle + bereits oben: Hero wiederherstellen (ohne auf neues Scroll-Event zu warten)
  useEffect(() => {
    if (!visible || typeof window === 'undefined' || surfaceExpanded) return;
    if (window.scrollY <= DOCK_SCROLL_THRESHOLD) {
      setScrolledPastHero(false);
    }
  }, [surfaceExpanded, visible]);

  useEffect(() => {
    if (!isIdle || dockMode !== 'hero' || String(draft || '').trim()) return undefined;
    const timer = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % COMPOSER_HERO_PLACEHOLDERS.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [isIdle, draft, dockMode]);

  // Fokus nach Hero↔Dock halten (kein Remount der Instanz; Draft bleibt in State)
  useLayoutEffect(() => {
    if (!focused || !visible) return;
    const input = shellRef.current?.querySelector?.('.sw-composer__input');
    if (input && document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
  }, [dockMode, focused, visible]);

  // Content-Spacer: gemessene Dock-Höhe + Safe-Area + 16px
  useEffect(() => {
    if (!visible || dockMode !== 'docked' || typeof document === 'undefined') {
      document.documentElement?.style?.removeProperty?.('--docked-composer-height');
      document.documentElement?.style?.removeProperty?.('--docked-composer-spacer');
      return undefined;
    }
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      const fallback = resolveDockedContentSpacerPx({ dockedComposerHeight: 72 });
      document.documentElement.style.setProperty('--docked-composer-height', '72px');
      document.documentElement.style.setProperty('--docked-composer-spacer', `${fallback}px`);
      return undefined;
    }
    const update = () => {
      // Gemessene Höhe enthält bereits Composer-Safe-Area-Padding
      const height = Math.ceil(el.getBoundingClientRect().height || 72);
      const spacer = resolveDockedContentSpacerPx({
        dockedComposerHeight: height,
        safeAreaInsetBottom: 0,
        extraGap: 16,
      });
      document.documentElement.style.setProperty('--docked-composer-height', `${height}px`);
      document.documentElement.style.setProperty('--docked-composer-spacer', `${spacer}px`);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--docked-composer-height');
      document.documentElement.style.removeProperty('--docked-composer-spacer');
    };
  }, [visible, dockMode, surfaceState, reviewModel]);

  /** Dashboard-Karten / Home-Chips → Composer-Turn oder Task */
  const applyDashboardComposerRequestRef = useRef(async () => {});

  useEffect(() => {
    const req = ctx?.composerRequest;
    if (!req?.id || !visible) return;
    ctx.consumeComposerRequest?.(req.id);
    void applyDashboardComposerRequestRef.current?.(req);
  }, [ctx?.composerRequest?.id, visible, ctx?.consumeComposerRequest]);

  if (!visible) return null;

  function startComposerTaskFromChip(chip = {}) {
    if (chip.composerTitle || chip.placeholder) {
      setQuietIntakeTask({
        id: chip.id || null,
        title: chip.composerTitle || '',
        placeholder: chip.placeholder || '',
        choiceChips: Array.isArray(chip.choiceChips) ? chip.choiceChips : null,
      });
    }
    if (chip.intentChipId) {
      const intentId = chip.intentChipId === 'angebot'
        ? COMPOSER_INTENT_CHIP_IDS.OFFER
        : chip.intentChipId === 'merken'
          ? COMPOSER_INTENT_CHIP_IDS.REMEMBER
          : chip.intentChipId;
      if (resolveIntentChipById(intentId)) {
        setSelectedIntentChipId(intentId);
        setIntentPurpose(null);
      }
    }
    setFocused(true);
    if (typeof chip.draft === 'string') setDraft(chip.draft);
    else setDraft('');
  }

  async function applyDashboardComposerRequest(req = {}) {
    if (!req) return;
    if (req.type === 'prepare_offer_task' || req.type === 'start_task') {
      startComposerTaskFromChip(req.task || buildHomePrepareOfferComposerTask());
      return;
    }

    const sellerInput = req.type === 'today_overview'
      ? String(req.sellerInput || 'Was liegt heute an?').trim()
      : String(req.sellerInput || '').trim();
    if (!sellerInput || sending) return;

    setFocused(true);
    setSending(true);
    setFeedback('');
    setDraft('');
    try {
      const snapshot = ctx?.leadsSnapshot || [];
      const lead = req.leadId
        ? (snapshot.find((l) => l.id === req.leadId) || {})
        : (ctx?.currentCustomer || {});
      const turn = runCleverSellerTurn({
        lead,
        sellerInput,
        leadsSnapshot: snapshot,
        customerName: lead?.contact?.name || lead?.name || '',
        scopeHint: 'dashboard',
        workingContextItems: ctx?.attachedWorkingObjects || [],
        appContext: {
          routeContext: ctx?.routeContext,
          attachedWorkingObjects: ctx?.attachedWorkingObjects,
          dashboardContext: ctx?.dashboardContext,
        },
      });
      setLastTurn(turn);
      if (req.leadId && lead?.id && typeof ctx?.setCurrentCustomer === 'function') {
        ctx.setCurrentCustomer(lead);
      }
      const model = turn.reviewModel
        || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
      setReviewModel(model);
      const hint = quietReviewFeedback(
        model,
        turn,
        model?.summaryLine || model?.title || (req.type === 'today_overview' ? 'Heute wichtig' : ''),
      );
      if (hint) {
        setFeedback(hint);
        setTimeout(() => setFeedback(''), 3600);
      }
    } finally {
      setSending(false);
    }
  }
  applyDashboardComposerRequestRef.current = applyDashboardComposerRequest;

  function handleSuggestion(chip) {
    if (!chip) return;
    // Choice-Chip während Subtask (z. B. Modell): nur Draft setzen, kein neuer Task
    if (
      quietIntakeTask
      && !chip.composerTitle
      && !chip.intentChipId
      && (chip.id?.startsWith?.('qi_model_') || typeof chip.draft === 'string')
    ) {
      setFocused(true);
      if (typeof chip.draft === 'string') setDraft(chip.draft);
      return;
    }
    if (chip.composerTitle || chip.placeholder || chip.intentChipId) {
      startComposerTaskFromChip(chip);
      return;
    }
    if (chip.id === 'showroom') {
      navigate('/verkaufsassistent?view=showroom');
      return;
    }
    if (chip.id === 'model') {
      navigate('/verkaufsassistent?view=model');
      return;
    }
    if (chip.id === 'prepare_offer') {
      startComposerTaskFromChip(buildHomePrepareOfferComposerTask());
      return;
    }
    if (chip.id === 'intake') {
      setFocused(true);
      // Bereits erkannte Anfrage: Fokus auf Karte, kein Clever-Narrations-Hint
      if (
        isQuietIntakeReview(reviewModel)
        || reviewModel?.reviewType === 'customer_intake_review'
        || reviewModel?.reviewType === 'inbound_lead_review'
        || lastTurn?.inboundLead?.detected
        || lastTurn?.multiSourceIntake?.detected
      ) {
        setFeedback('');
        return;
      }
      setDraft('');
      setFeedback('Anfrage hier einfügen und absenden');
      setTimeout(() => setFeedback(''), 4200);
      return;
    }
    if (chip.id === 'today') {
      void applyDashboardComposerRequest({
        type: 'today_overview',
        sellerInput: 'Was liegt heute an?',
      });
      return;
    }
    if (chip.id === 'tow') setDraft('XCeed Anhängelast?');
    else if (chip.id === 'open') setDraft('Öffne Herrn Brandes.');
    else if (chip.id === 'summary') setDraft('Was wollte Herr Brandes noch einmal?');
    else if (chip.id === 'offer') {
      setDraft('Erstelle Herrn Garritano ein Angebot für den Picanto GT-Line für 17.000 €.');
    }
    else if (chip.label) setDraft(chip.label);
  }

  function handleSoftAttach(file, kind) {
    if (!file) return;
    const name = file.name || (kind === 'photo' ? 'foto.jpg' : 'dokument');
    const prefix = kind === 'photo' ? 'Foto angehängt' : 'Dokument angehängt';
    setFocused(true);
    setDraft((prev) => {
      const note = `${prefix}: ${name}`;
      return prev ? `${prev}\n${note}` : note;
    });
    setFeedback(`${prefix} – Beschreibung ergänzen und absenden`);
    setTimeout(() => setFeedback(''), 3200);
  }

  const plusActions = [
    {
      id: 'intake',
      icon: '📋',
      label: 'Anfrage einfügen',
      onClick: () => handleSuggestion({ id: 'intake' }),
    },
    {
      id: 'pdf_dump',
      icon: '📄',
      label: 'PDF',
      onClick: null,
    },
    {
      id: 'photo',
      icon: '🖼',
      label: 'Foto',
      onClick: () => photoInputRef.current?.click(),
    },
    {
      id: 'document',
      icon: '📎',
      label: 'Dokument',
      onClick: () => documentInputRef.current?.click(),
    },
  ];

  function handleOpenLead(leadId, extras = {}) {
    if (!leadId) return;
    const items = [];
    if (extras.workingContext) {
      items.push(extras.workingContext);
    } else if (extras.hit) {
      items.push({
        id: extras.hit.sourceId || extras.hit.messageId || extras.hit.offerId,
        label: extras.hit.title || 'Historien-Treffer',
        kind: extras.hit.sourceType || 'history_hit',
        messageId: extras.hit.messageId || null,
        offerId: extras.hit.offerId || null,
        oneShot: true,
      });
    }
    if (items.length && typeof ctx?.setAttachedWorkingObjects === 'function') {
      ctx.setAttachedWorkingObjects(items);
    }
    const path = buildAkteNavPath({
      leadId,
      messageId: extras.messageId || extras.hit?.messageId || null,
      offerId: extras.offerId || extras.hit?.offerId || null,
    });
    navigate(path);
  }

  function resolvePrimaryNavTarget(turn, model) {
    const sections = model?.actionSections || [];
    const contractImport = sections.find((s) => (
      s.kind === 'contract_import_review' || s.kind === 'contract_import'
    ));
    if (contractImport || turn?.contractDraft) {
      const leadId = turn?.resolvedCustomer?.id
        || contractImport?.primaryActions?.find((a) => a.leadId)?.leadId
        || turn?.contractDraft?.customerId
        || null;
      if (leadId) {
        return {
          leadId,
          workingContext: turn.handoffWorkingContext || null,
        };
      }
    }
    const contractMemory = sections.find((s) => (
      s.kind === 'contract_memory_result'
      || s.kind === 'contract_offer_compare_result'
      || s.kind === 'contract_compare_and_message_review'
    ));
    if (contractMemory) {
      const leadId = turn?.resolvedCustomer?.id
        || contractMemory?.contractMemoryResult?.customerId
        || contractMemory?.contractOfferCompareResult?.customerId
        || contractMemory?.primaryActions?.find((a) => a.leadId)?.leadId
        || null;
      if (leadId) return { leadId };
    }
    const apptMsg = sections.find((s) => s.kind === 'appointment_and_message_review');
    if (apptMsg || turn?.preparedAppointment || turn?.pendingAction?.preparedAppointment) {
      const leadId = turn?.resolvedCustomer?.id
        || turn?.handoffWorkingContext?.customerId
        || turn?.preparedAppointment?.customerId
        || apptMsg?.primaryActions?.find((a) => a.leadId)?.leadId;
      if (leadId) {
        return {
          leadId,
          workingContext: turn.handoffWorkingContext || null,
        };
      }
    }
    const knowledgeMsg = sections.find((s) => s.kind === 'knowledge_and_message_review');
    if (knowledgeMsg || (turn?.handoffWorkingContext?.composerMode === 'customer_message_edit')) {
      const leadId = turn?.resolvedCustomer?.id
        || turn?.handoffWorkingContext?.customerId
        || knowledgeMsg?.primaryActions?.find((a) => a.leadId)?.leadId;
      if (leadId) {
        return {
          leadId,
          workingContext: turn.handoffWorkingContext || null,
        };
      }
    }
    const offerMsg = sections.find((s) => (
      s.kind === 'offer_and_message_review'
      || s.kind === 'offer_and_appointment_review'
      || s.kind === 'offer_prepare'
      || s.kind === 'offer_incomplete'
    ));
    if (offerMsg || turn?.handoffWorkingContext) {
      const leadId = turn?.resolvedCustomer?.id
        || turn?.handoffWorkingContext?.customerId
        || offerMsg?.primaryActions?.find((a) => a.leadId)?.leadId
        || offerMsg?.primaryActions?.[0]?.leadId
        || null;
      if (leadId) {
        return {
          leadId,
          workingContext: turn.handoffWorkingContext || null,
        };
      }
    }
    const summary = sections.find((s) => s.kind === 'customer_summary');
    if (summary?.summary?.customerId) {
      return { leadId: summary.summary.customerId };
    }
    const search = sections.find((s) => s.kind === 'customer_search_results');
    if (search?.results?.[0]?.leadId) {
      return { leadId: search.results[0].leadId };
    }
    const history = sections.find((s) => (
      s.kind === 'history_search_results' || s.kind === 'offer_history_result'
    ));
    if (history?.hit?.customerId) {
      return {
        leadId: history.hit.customerId,
        messageId: history.hit.messageId || null,
        offerId: history.hit.offerId || null,
        hit: history.hit,
      };
    }
    const today = turn?.todayOverview?.items?.[0];
    if (today?.leadId) return { leadId: today.leadId };
    return null;
  }

  function handleAcceptMultiSourceIntake(action = {}) {
    if (!lastTurn?.multiSourceIntake?.detected) {
      setFeedback('Kein Multi-Source-Plan zur Übernahme.');
      setTimeout(() => setFeedback(''), 3200);
      return;
    }
    const snapshot = ctx?.leadsSnapshot || [];
    const selectedId = action.leadId
      || lastTurn?.resolvedCustomer?.id
      || null;
    const existing = selectedId
      ? (snapshot.find((l) => l.id === selectedId) || ctx?.currentCustomer || null)
      : (ctx?.currentCustomer?.id ? ctx.currentCustomer : null);

    const applied = applyConfirmedMultiSourceIntakePlan(existing || {}, lastTurn, {
      allowCreateCustomer: true,
      leadsSnapshot: snapshot,
      selectedLeadId: selectedId,
      postFeedCard: false,
    });

    if (applied.needsSellerChoice) {
      setReviewModel(buildMultiSourceApplyResultReview(applied, lastTurn.multiSourceIntake));
      setFeedback(applied.needsSellerChoice.reason || 'Bitte Kundenakte wählen.');
      setTimeout(() => setFeedback(''), 4200);
      return;
    }

    if (!applied.ok || !applied.lead?.id) {
      setReviewModel(buildMultiSourceApplyResultReview(applied, lastTurn.multiSourceIntake));
      setFeedback(applied.errors?.[0] || 'Übernahme fehlgeschlagen.');
      setTimeout(() => setFeedback(''), 4200);
      return;
    }

    if (applied.created && typeof addLead === 'function') {
      addLead(applied.lead);
    } else if (typeof updateLead === 'function') {
      updateLead(applied.lead.id, applied.lead);
    }

    const resultReview = buildMultiSourceApplyResultReview(applied, lastTurn.multiSourceIntake);
    setReviewModel(resultReview);
    setFeedback(applied.partialFailure
      ? 'Vorgang teilweise angelegt – bitte prüfen.'
      : applied.status === 'idempotent_replay'
        ? 'Bereits übernommen – keine Dublette.'
        : 'Vorgang angelegt.');
    setTimeout(() => setFeedback(''), 3600);
  }

  function applyRememberWithUndo(turn, options = {}) {
    const leadId = turn?.resolvedCustomer?.id || ctx?.currentCustomer?.id;
    if (!leadId || typeof updateLead !== 'function') return false;
    const snapshot = ctx?.leadsSnapshot || [];
    const lead = snapshot.find((l) => l.id === leadId) || ctx?.currentCustomer;
    if (!lead?.id) return false;
    const previousLead = JSON.parse(JSON.stringify(lead));
    const factsToApply = options.facts
      || turn?.rememberDecision?.safeFacts
      || turn?.extractedFacts
      || [];
    const applied = applyAcceptedSellerTurn(lead, {
      ...turn,
      extractedFacts: factsToApply,
    }, { postFeedCard: false });
    if (!applied.ok || !applied.lead) return false;
    updateLead(leadId, applied.lead);
    const undoToken = createRememberUndoToken();
    setRememberUndo({ previousLead, leadId, undoToken });
    return { ok: true, undoToken, lead: applied.lead, leadId };
  }

  function handleRememberUndo() {
    if (liveEditUndo?.undoSnapshot && lastTurn) {
      const restored = undoSellerReviewFactPatch({
        turn: lastTurn,
        undoSnapshot: liveEditUndo.undoSnapshot,
      });
      if (restored.ok) {
        setLastTurn(restored.lastTurn);
        setReviewModel(restored.reviewModel);
        setLiveEditUndo(null);
        setFeedback('');
        setFeedbackKind('');
        return;
      }
    }
    if (!rememberUndo?.leadId || !rememberUndo?.previousLead) return;
    if (typeof updateLead === 'function') {
      updateLead(rememberUndo.leadId, rememberUndo.previousLead);
    }
    setRememberUndo(null);
    // Micro-Undo: kurze neutrale Zeile, kein Erfolg-Grün
    pushComposerFeedback('Merken rückgängig gemacht', { kind: 'neutral', ms: 2200 });
    resetIntentChipsToDefault();
  }

  /** Live-Edit am Chip – gleicher Result-State wie NL-Korrektur */
  function handleLiveEditChip({ field, value, label } = {}) {
    if (!lastTurn || !field) return { ok: false, error: 'Kein Kontext' };
    const snapshot = ctx?.leadsSnapshot || [];
    const patched = patchSellerReviewFact({
      turn: lastTurn,
      field,
      value,
      label,
      leads: snapshot,
      correctionSource: 'seller',
    });
    if (!patched.ok) return patched;
    setLastTurn(patched.lastTurn);
    setReviewModel(patched.reviewModel);
    setLiveEditUndo({
      undoSnapshot: patched.undoSnapshot,
      at: Date.now(),
    });
    setFeedback('');
    setFeedbackKind('');
    // Micro-Confirm auto-fade (1.5s) – Erfolg = Chip + Glow, kein Composer-Grün
    window.setTimeout(() => {
      setReviewModel((prev) => (
        prev?.microConfirm
          ? { ...prev, microConfirm: null }
          : prev
      ));
    }, 1500);
    return { ok: true };
  }

  /** Unsicheren Chip bestätigen – Unsicherheit lokal auflösen, kein Composer-Erfolg */
  function handleConfirmUncertainChip(chip) {
    if (!chip || !lastTurn) return;
    const field = chip.field || null;
    const label = String(chip.label || '').trim();
    const nextFacts = (lastTurn.extractedFacts || []).map((f) => {
      const match = (field && f.field === field)
        || (!field && String(f.label || '').trim() === label);
      return match ? { ...f, needsConfirmation: false } : f;
    });
    const nextTurn = {
      ...lastTurn,
      extractedFacts: nextFacts,
      warnings: (lastTurn.warnings || []).filter(
        (w) => !/Mindestens ein Wert braucht kurze Bestätigung/i.test(String(w || '')),
      ),
    };
    const stillUncertain = nextFacts.some((f) => f.needsConfirmation);
    if (!stillUncertain) {
      applyRememberWithUndo(nextTurn, { facts: nextFacts });
      const model = buildUniversalReviewModel(nextTurn);
      setLastTurn(nextTurn);
      setReviewModel(model
        ? {
          ...model,
          highlightChipLabels: label ? [label] : [],
          hideGlobalAccept: false,
        }
        : null);
      setFeedback('');
      setFeedbackKind('');
      return;
    }
    const model = buildUniversalReviewModel(nextTurn);
    setLastTurn(nextTurn);
    setReviewModel(model
      ? { ...model, highlightChipLabels: label ? [label] : [] }
      : reviewModel);
    setFeedback('');
    setFeedbackKind('');
  }

  function handleReviewAction(action) {
    if (!action || !lastTurn) return;
    if (action.action === 'discard') {
      setReviewModel(null);
      setLastTurn(null);
      setQuietIntakeTask(null);
      quietIntakeContextRef.current = null;
      resetIntentChipsToDefault();
      return;
    }
    if (action.action === 'revise_fact') {
      const label = String(action.label || '').trim();
      setFocused(true);
      setDraft(label ? `${label} – ` : '');
      pushComposerFeedback('Wert korrigieren und absenden', { kind: 'neutral', ms: 2800 });
      return;
    }
    if (action.action === 'revise_intake') {
      const raw = lastTurn?.sellerInput
        || lastTurn?.interpretedInput?.raw
        || lastTurn?.interpretedInput?.normalized
        || '';
      setReviewModel(null);
      setLastTurn(null);
      setQuietIntakeTask(null);
      quietIntakeContextRef.current = null;
      if (raw) setDraft(String(raw));
      setFeedback('Korrigieren – Text anpassen und erneut senden');
      setTimeout(() => setFeedback(''), 3200);
      return;
    }
    if (action.action === 'open_customer_search') {
      const contact = lastTurn?.inboundLead?.contact || lastTurn?.customerReply?.contact || {};
      const hint = contact.fullName || contact.email || contact.phone || '';
      setReviewModel(null);
      setLastTurn(null);
      setQuietIntakeTask(null);
      quietIntakeContextRef.current = null;
      if (hint) setDraft(`Öffne ${hint}`);
      setFeedback('Erneut suchen – Absenden oder Kundensuche nutzen');
      setTimeout(() => setFeedback(''), 3200);
      return;
    }
    if (action.action === 'open_customer' && action.leadId) {
      handleOpenLead(action.leadId);
      setReviewModel(null);
      setLastTurn(null);
      return;
    }
    if (action.action === 'accept_contract_import' || action.action === 'open_contract') {
      const target = resolvePrimaryNavTarget(lastTurn, reviewModel);
      const leadId = target?.leadId || action.leadId || lastTurn?.resolvedCustomer?.id;
      if (!leadId) {
        setFeedback('Kein Kunde für den Vertrag – bitte zuerst auswählen.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }
      if (action.action === 'accept_contract_import') {
        const snapshot = ctx?.leadsSnapshot || [];
        const lead = snapshot.find((l) => l.id === leadId) || ctx?.currentCustomer;
        if (lead?.id && typeof updateLead === 'function') {
          const applied = applyAcceptedSellerTurn(lead, lastTurn, { postFeedCard: false });
          if (applied.ok && applied.lead) {
            updateLead(leadId, applied.lead);
          }
        }
      }
      handleOpenLead(leadId, target || {});
      setReviewModel(null);
      setLastTurn(null);
      return;
    }
    if (action.action === 'accept_customer_reply') {
      const reply = lastTurn?.customerReply;
      const snapshot = ctx?.leadsSnapshot || [];
      const matchedId = action.leadId
        || reply?.matchedLeadId
        || lastTurn?.resolvedCustomer?.id
        || ctx?.currentCustomer?.id;
      const existing = matchedId
        ? (snapshot.find((l) => l.id === matchedId) || ctx?.currentCustomer || null)
        : null;

      if (!existing?.id) {
        setFeedback('Bitte zuerst einen Kunden wählen.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      const applied = applyAcceptedSellerTurn(existing, lastTurn, { postFeedCard: true });
      if (applied.ok && applied.lead && typeof updateLead === 'function') {
        updateLead(existing.id, applied.lead);
      }
      handleOpenLead(existing.id);
      setFeedback('Kundenantwort übernommen – Angaben gespeichert.');
      setTimeout(() => setFeedback(''), 3200);
      setReviewModel(null);
      setLastTurn(null);
      return;
    }
    if (action.action === 'accept_inbound_lead') {
      const inbound = lastTurn?.inboundLead;
      const snapshot = ctx?.leadsSnapshot || [];
      const matchedId = action.leadId
        || inbound?.matchedLeadId
        || lastTurn?.resolvedCustomer?.id;
      const existing = matchedId
        ? (snapshot.find((l) => l.id === matchedId) || null)
        : null;

      if (inbound?.proposeCreateCustomer && !existing?.id) {
        const applied = applyAcceptedSellerTurn({}, lastTurn, {
          postFeedCard: false,
          allowCreateCustomer: true,
        });
        if (!applied.ok || !applied.lead?.id) {
          setFeedback('Kunde konnte noch nicht angelegt werden.');
          setTimeout(() => setFeedback(''), 3200);
          return;
        }
        if (typeof addLead === 'function') addLead(applied.lead);
        handleOpenLead(applied.lead.id);
        setFeedback('Kundenakte angelegt – weitermachen.');
        setTimeout(() => setFeedback(''), 3200);
        setReviewModel(null);
        setLastTurn(null);
        return;
      }

      if (!existing?.id) {
        setFeedback('Bitte zuerst einen Kunden wählen.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      const applied = applyAcceptedSellerTurn(existing, lastTurn, { postFeedCard: false });
      if (applied.ok && applied.lead && typeof updateLead === 'function') {
        updateLead(existing.id, applied.lead);
      }
      handleOpenLead(existing.id);
      setFeedback('In Kundenakte weitermachen – Angaben übernommen.');
      setTimeout(() => setFeedback(''), 3200);
      setReviewModel(null);
      setLastTurn(null);
      return;
    }
    if (action.action === 'accept_multi_source_intake') {
      handleAcceptMultiSourceIntake(action);
      return;
    }
    if (action.action === 'prepare_ev4_offer') {
      const leadId = action.leadId || lastTurn?.resolvedCustomer?.id;
      if (leadId) {
        handleOpenLead(leadId, { focus: 'offer', modelHint: 'ev4' });
        setFeedback('Kundenakte geöffnet – Angebot vorbereiten.');
        setTimeout(() => setFeedback(''), 3200);
      }
      return;
    }
    if (action.action === 'enrich_trade_in') {
      const leadId = action.leadId || lastTurn?.resolvedCustomer?.id;
      if (leadId) {
        handleOpenLead(leadId, { focus: 'trade_in' });
        setFeedback('Kundenakte geöffnet – Inzahlungnahme ergänzen.');
        setTimeout(() => setFeedback(''), 3200);
      }
      return;
    }
    if (action.action === 'send_documents_package') {
      const snapshot = ctx?.leadsSnapshot || [];
      const leadId = action.leadId
        || lastTurn?.resolvedCustomer?.id
        || resolvePrimaryNavTarget(lastTurn, reviewModel)?.leadId;
      const lead = leadId
        ? (snapshot.find((l) => l.id === leadId) || ctx?.currentCustomer)
        : null;
      if (!lead?.id) {
        setFeedback('Bitte zuerst einen Kunden öffnen.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }
      const applied = applyAcceptedSellerTurn(lead, lastTurn, { postFeedCard: true });
      if (!applied.ok) {
        setFeedback('Upload-Link konnte noch nicht gesendet werden.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }
      if (applied.lead && typeof updateLead === 'function') {
        updateLead(lead.id, applied.lead);
      }
      handleOpenLead(lead.id);
      setFeedback(applied.documentsPackageSent
        ? 'Sicheren Upload-Link gesendet'
        : 'Übernommen');
      setTimeout(() => setFeedback(''), 3200);
      setReviewModel(null);
      setLastTurn(null);
      return;
    }
    if (action.action === 'check_calendar') {
      void (async () => {
        const refreshed = await refreshSellerTurnCalendarCheck({
          turn: lastTurn,
          turnParams: {
            lead: ctx?.currentCustomer || {},
            leadsSnapshot: ctx?.leadsSnapshot || [],
            scopeHint: 'dashboard',
            workingContextItems: ctx?.attachedWorkingObjects || [],
            pendingAction: lastTurn?.pendingAction || null,
            appContext: {
              routeContext: ctx?.routeContext,
              attachedWorkingObjects: ctx?.attachedWorkingObjects,
              dashboardContext: ctx?.dashboardContext,
            },
          },
        });
        if (refreshed.providerMissing) {
          setFeedback('Kalenderverfügbarkeit noch nicht geprüft.');
          setTimeout(() => setFeedback(''), 3200);
          return;
        }
        if (!refreshed.ok || !refreshed.turn) {
          setFeedback(refreshed.label || 'Kalenderprüfung nicht möglich.');
          setTimeout(() => setFeedback(''), 3200);
          return;
        }
        setLastTurn(refreshed.turn);
        setReviewModel(
          refreshed.turn.reviewModel
          || buildUniversalReviewModel(refreshed.turn),
        );
        setFeedback(`Kalender: ${refreshed.label}`);
        setTimeout(() => setFeedback(''), 3200);
      })();
      return;
    }
    if (action.action === 'accept_offer_and_appointment') {
      const executed = executeDualOfferAppointmentAccept({
        lead: ctx?.currentCustomer || null,
        turn: lastTurn,
      });
      if (!executed.ok) {
        setFeedback('Angebot und Termin sind noch nicht gemeinsam übernehmbar.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }
      const leadId = executed.leadId
        || action.leadId
        || lastTurn?.resolvedCustomer?.id;
      if (!leadId) {
        setFeedback('Kein Kunde für Angebot & Termin.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }
      handleOpenLead(leadId, {
        workingContext: executed.handoffWorkingContext || lastTurn?.handoffWorkingContext || null,
      });
      setFeedback('Angebot & Terminvorschlag übernommen – noch nicht gesendet.');
      setTimeout(() => setFeedback(''), 3200);
      const snapshot = ctx?.leadsSnapshot || [];
      const draftLead = snapshot.find((l) => l.id === leadId) || ctx?.currentCustomer || null;
      const calendarProvider = resolveCleverCalendarProvider();
      void maybeCreateCalendarDraftEvent({
        provider: calendarProvider,
        appointment: lastTurn?.preparedAppointment
          || (lastTurn?.preparedActions || []).find((a) => (
            a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
          ))?.payload?.preparedAppointment
          || null,
        lead: draftLead,
      });
      setReviewModel(null);
      setLastTurn(null);
      return;
    }
    if (action.action === 'prepare_followup_offer') {
      const leadId = action.leadId
        || lastTurn?.resolvedCustomer?.id
        || lastTurn?.goldenMoment?.customerId;
      if (!leadId) {
        setFeedback('Kein Kunde für das Nachfolgeangebot.');
        setTimeout(() => setFeedback(''), 3200);
        return;
      }
      setSending(true);
      try {
        const snapshot = ctx?.leadsSnapshot || [];
        const lead = snapshot.find((l) => l.id === leadId) || ctx?.currentCustomer || {};
        const turn = runCleverSellerTurn({
          lead,
          sellerInput: 'Bereite ein Nachfolgeangebot vor.',
          leadsSnapshot: snapshot,
          customerName: lead?.contact?.name || lead?.name || '',
          scopeHint: 'dashboard',
          workingContextItems: ctx.attachedWorkingObjects || [],
          ...buildSellerTurnMemoryParams(agentWorkingMemory),
          appContext: {
            routeContext: ctx.routeContext,
            attachedWorkingObjects: ctx.attachedWorkingObjects,
            dashboardContext: ctx.dashboardContext,
          },
        });
        const policy = resolveSellerResponsePolicy(turn);
        setAgentWorkingMemory((prev) => updateMemoryFromSellerTurn(
          prev,
          turn,
          'Bereite ein Nachfolgeangebot vor.',
          policy,
        ));
        setLastTurn(turn);
        const model = turn.reviewModel
          || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
        setReviewModel(model);
        setFeedback(model?.title || 'Nachfolgeangebot vorbereitet – bitte prüfen');
        setTimeout(() => setFeedback(''), 3200);
      } finally {
        setSending(false);
      }
      return;
    }
    if (action.action === 'write_without_package_details') {
      const base = String(lastTurn.interpretedInput?.raw || draft || '').trim();
      const nextInput = /ohne\s+paketdetails/i.test(base)
        ? base
        : `${base}\n(Ohne Paketdetails schreiben)`;
      setSending(true);
      try {
        const turn = runCleverSellerTurn({
          lead: ctx.currentCustomer || {},
          sellerInput: nextInput,
          leadsSnapshot: ctx.leadsSnapshot || [],
          scopeHint: 'dashboard',
          appContext: {
            routeContext: ctx.routeContext,
            attachedWorkingObjects: ctx.attachedWorkingObjects,
            dashboardContext: ctx.dashboardContext,
          },
          workingContextItems: ctx.attachedWorkingObjects || [],
          pendingAction: lastTurn?.pendingAction || null,
        });
        setLastTurn(turn);
        const model = turn.reviewModel
          || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
        setReviewModel(model);
      } finally {
        setSending(false);
      }
      return;
    }
    if (action.action === 'upload_pdf' || action.id === 'upload_pdf') {
      setFocused(true);
      if (documentInputRef.current && typeof documentInputRef.current.click === 'function') {
        documentInputRef.current.click();
        return;
      }
      pushComposerFeedback('Bitte PDF über + im Composer wählen.', { kind: 'neutral', ms: 2800 });
      return;
    }
    if (action.action === 'enter_rate' || action.id === 'enter_rate') {
      setFocused(true);
      setDraft('Monatsrate ');
      // Kontext behalten – Agent braucht Lead/Turn für den Folgesatz
      return;
    }
    if (action.action === 'calc_cash' || action.id === 'calc_cash') {
      setFocused(true);
      setSending(true);
      try {
        const turn = runCleverSellerTurn({
          lead: ctx?.currentCustomer || {},
          sellerInput: 'Als Barkauf berechnen',
          leadsSnapshot: ctx?.leadsSnapshot || [],
          scopeHint: 'dashboard',
          workingContextItems: ctx?.attachedWorkingObjects || [],
          pendingAction: lastTurn?.pendingAction || null,
          appContext: {
            routeContext: ctx?.routeContext,
            attachedWorkingObjects: ctx?.attachedWorkingObjects,
            dashboardContext: ctx?.dashboardContext,
          },
        });
        setLastTurn(turn);
        const model = turn.reviewModel
          || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
        setReviewModel(model);
        pushComposerFeedback(
          quietReviewFeedback(model, turn, model?.title || 'Barkauf geprüft'),
          { kind: 'neutral', ms: 3200 },
        );
      } finally {
        setSending(false);
      }
      return;
    }
    if (action.action === 'check_discount' || action.id === 'check_discount') {
      setFocused(true);
      setDraft('Bitte Rabatt korrigieren: ');
      pushComposerFeedback('Rabattwert prüfen – bitte korrekten Prozentsatz eintragen.', {
        kind: 'neutral',
        ms: 3200,
      });
      return;
    }
    if (
      action.action === 'open_offer_handoff'
      || action.id === 'create_offer'
    ) {
      const target = resolvePrimaryNavTarget(lastTurn, reviewModel);
      const leadId = action.leadId
        || target?.leadId
        || lastTurn?.resolvedCustomer?.id
        || lastTurn?.handoffWorkingContext?.customerId
        || null;
      if (leadId) {
        handleOpenLead(leadId, {
          ...(target || {}),
          workingContext: lastTurn?.handoffWorkingContext || target?.workingContext || null,
        });
        setReviewModel(null);
        setLastTurn(null);
        return;
      }
      // Incomplete Offer ohne Kundenakte: Composer-Frage statt Mini-Menü
      setFocused(true);
      setDraft('');
      pushComposerFeedback('Welche Monatsrate möchtest du hinterlegen?', {
        kind: 'neutral',
        ms: 3200,
      });
      return;
    }
    if (
      action.action === 'edit_message'
      || action.action === 'send_handoff'
      || action.action === 'send_appointment_proposal'
      || action.action === 'approve_handoff'
      || action.action === 'review_data'
    ) {
      const target = resolvePrimaryNavTarget(lastTurn, reviewModel);
      if (target?.leadId) handleOpenLead(target.leadId, target);
      return;
    }
    if (action.id === 'open_first' || (action.leadId && !action.action)) {
      handleOpenLead(action.leadId);
    }
  }

  async function handleAttachScreenshot(file) {
    if (!file || sending || !ctx) return;
    if (!isCleverScreenshotInterpretClientEnabled()) {
      handleSoftAttach(file, 'photo');
      return;
    }
    setFocused(true);
    setSending(true);
    setFeedback('');
    progressHintSchedulerRef.current?.start(CLEVER_LONG_JOB.SCREENSHOT_OCR);
    try {
      let ocrEngine = null;
      if (isCleverContractOcrEnabled()) {
        ocrEngine = await tryCreateTesseractOcrEngine({
          lang: resolveCleverOcrLang(),
        });
      }
      const requestVision = isCleverSellerOpenAiInterpretClientEnabled()
        ? (payload) => requestCleverScreenshotInterpret(payload)
        : null;

      const { prepared, turn, softAttach } = await runComposerScreenshotAttachTurnWithInterpret({
        file,
        lead: ctx.currentCustomer || {},
        leadsSnapshot: ctx.leadsSnapshot || [],
        scopeHint: 'dashboard',
        workingContextItems: ctx.attachedWorkingObjects || [],
        requestVision,
        ocrEngine,
        // Client-Flag bereits geprüft (Vite); Server-Env hat oft keinen Browser-Key
        force: true,
        appContext: {
          routeContext: ctx.routeContext,
          attachedWorkingObjects: ctx.attachedWorkingObjects,
          dashboardContext: ctx.dashboardContext,
        },
      });

      progressHintSchedulerRef.current?.clear();
      if (softAttach || !turn) {
        handleSoftAttach(file, 'photo');
        setFeedback(prepared?.feedbackManual
          || 'Screenshot konnte nicht gelesen werden – bitte beschreiben.');
        setTimeout(() => setFeedback(''), 3600);
        return;
      }

      if (prepared.draftSeed) {
        setDraft(prepared.draftSeed);
      }
      setLastTurn(turn);
      const model = turn.reviewModel
        || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
      setReviewModel(model);
      setFeedback(model
        ? (prepared.feedbackOk || model.title || 'Screenshot gelesen')
        : (prepared.feedbackOk || 'Screenshot gelesen – bitte prüfen'));
      setTimeout(() => setFeedback(''), 3200);
    } catch (err) {
      progressHintSchedulerRef.current?.clear();
      handleSoftAttach(file, 'photo');
      setFeedback(err?.message || 'Screenshot konnte nicht gelesen werden');
      setTimeout(() => setFeedback(''), 3600);
    } finally {
      progressHintSchedulerRef.current?.clear();
      setSending(false);
    }
  }

  async function handleAttachFile(file) {
    if (!file || sending || !ctx) return;
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name || '');
    const isImage = /^image\//i.test(file.type || '')
      || /\.(png|jpe?g|webp|gif|heic)$/i.test(file.name || '');
    if (isImage) {
      await handleAttachScreenshot(file);
      return;
    }
    if (!isPdf) {
      handleSoftAttach(file, 'document');
      return;
    }
    setFocused(true);
    setSending(true);
    setFeedback('');
    progressHintSchedulerRef.current?.start(CLEVER_LONG_JOB.PDF_OCR);
    try {
      const extracted = await extractMagicOfferPdf(file);
      const ocrProvider = await resolveCleverOcrProvider();
      const { prepared, turn, skipped } = await runComposerPdfAttachTurnWithOcr({
        extracted,
        file,
        lead: ctx.currentCustomer || {},
        leadsSnapshot: ctx.leadsSnapshot || [],
        scopeHint: 'dashboard',
        workingContextItems: ctx.attachedWorkingObjects || [],
        ocrProvider,
        appContext: {
          routeContext: ctx.routeContext,
          attachedWorkingObjects: ctx.attachedWorkingObjects,
          dashboardContext: ctx.dashboardContext,
        },
      });

      if (skipped || (prepared.needsManualDescribe && prepared.kind !== 'contract_pdf')) {
        progressHintSchedulerRef.current?.clear();
        setDraft((prev) => (prev ? `${prev}\n${prepared.draftSeed}` : prepared.draftSeed));
        setFeedback(prepared.feedbackManual);
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      if (prepared.needsManualDescribe && prepared.kind === 'contract_pdf') {
        setDraft((prev) => (prev ? `${prev}\n${prepared.draftSeed}` : prepared.draftSeed));
      } else if (prepared.kind === 'configurator_pdf' || prepared.kind === 'offer_pdf') {
        // Offer-PDF: kurzer Seed statt OCR-/Text-Dump im Composer
        const shortSeed = prepared.draftSeed
          || `PDF: ${extracted?.fileName || file.name || 'dokument.pdf'}`;
        setDraft(shortSeed);
      } else if (prepared.draftSeed) {
        setDraft(prepared.draftSeed);
      }

      const attachmentMeta = prepared.attachment || {
        kind: prepared.kind,
        fileName: extracted?.fileName || file.name,
        extractedText: extracted?.text || '',
      };
      const actions = resolveAttachmentIntentActions(attachmentMeta);
      setAttachmentActions(actions.suggestedActions.length ? actions : null);

      progressHintSchedulerRef.current?.clear();
      if (turn) {
        setLastTurn(turn);
        const model = turn.reviewModel
          || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
        setReviewModel(model);
        // Nach Offer-Review keinen langen PDF-Dump als editierbaren Draft belassen
        if (
          model
          && (prepared.kind === 'configurator_pdf' || prepared.kind === 'offer_pdf')
        ) {
          setDraft(`PDF: ${extracted?.fileName || file.name || 'dokument.pdf'}`);
        }
        setFeedback(model
          ? (prepared.feedbackOk || model.title || 'PDF gelesen')
          : prepared.feedbackManual);
      } else {
        setFeedback(prepared.feedbackManual);
      }
      setTimeout(() => setFeedback(''), 3200);
    } catch (err) {
      progressHintSchedulerRef.current?.clear();
      setFeedback(err?.message || 'PDF konnte nicht gelesen werden');
      setTimeout(() => setFeedback(''), 3200);
    } finally {
      progressHintSchedulerRef.current?.clear();
      setSending(false);
    }
  }

  async function handleSend() {
    const text = String(draft || '').trim();
    if (!text || sending) return;
    setSending(true);
    setFeedback('');
    progressHintSchedulerRef.current?.clear();
    const completeQuietIntakeSubtask = Boolean(
      quietIntakeTask
      && (quietIntakeOpen || quietIntakeContextRef.current?.reviewModel),
    );

    const composerAttachments = collectComposerAttachments({
      lastTurn,
      workingContextItems: ctx.attachedWorkingObjects || [],
    });
    const semantic = shouldUseSemanticInterpreter({
      sellerInput: text,
      attachments: composerAttachments,
      appContext: {
        routeContext: ctx?.routeContext,
        attachedWorkingObjects: ctx?.attachedWorkingObjects,
        dashboardContext: ctx?.dashboardContext,
      },
      workingContext: ctx?.attachedWorkingObjects || [],
    });

    try {
      // Clever 2.0: Agent-Pfad wenn verfügbar (gleiche Experience wie Akte)
      if (isCleverAgentClientEnabled()) {
        const route = routeSellerRequest(text, { workingMemory: agentWorkingMemory });
        if (route === 'clever_agent') {
          progressHintSchedulerRef.current?.start(CLEVER_LONG_JOB.AGENT);
          const agentResult = await requestCleverAgent({
            sellerMessage: text,
            lead: ctx.currentCustomer || {},
            workingContext: (ctx.attachedWorkingObjects || [])[0] || null,
            conversationHistory: getConversationHistoryForAgent(agentWorkingMemory),
            workingMemory: agentWorkingMemory,
            previousOfferPreparation: agentWorkingMemory?.previousOfferPreparation || null,
            leadsSnapshot: ctx?.leadsSnapshot || [],
          }, {
            sellerId: ctx?.sellerId || null,
            dealerId: ctx?.dealerId || null,
          });
          progressHintSchedulerRef.current?.clear();
          setAgentWorkingMemory((prev) => updateAgentWorkingMemory(prev, agentResult, text));
          const agentPolicy = resolveAgentResponsePolicy(agentResult);
          const contextSwitch = resolveContextSwitchFromAgent(agentResult);
          const searchResults = normalizeCustomerSearchResults(
            agentResult.customerSearchResults || [],
          );

          if (
            agentResult?.ok
            || agentResult?.mutations?.length
            || agentResult?.confirmationRequired
          ) {
            setDraft('');
            resetIntentChipsToDefault();
            let rememberUndoToken = null;
            if (agentResult.mutations?.length && ctx?.currentCustomer?.id) {
              const previousLead = JSON.parse(JSON.stringify(ctx.currentCustomer));
              const applied = applyCleverAgentMutations(ctx.currentCustomer, agentResult.mutations);
              if (applied.lead && typeof updateLead === 'function') {
                updateLead(ctx.currentCustomer.id, applied.lead);
              }
              if (agentPolicy.undoAvailable && applied.lead) {
                rememberUndoToken = createRememberUndoToken();
                setRememberUndo({
                  previousLead,
                  leadId: ctx.currentCustomer.id,
                  undoToken: rememberUndoToken,
                });
              }
            }

            // Chat-native: Assistant-Antwort auch im Lead-Feed wenn Akte aktiv
            if (ctx?.currentCustomer?.id && agentPolicy.message) {
              try {
                const posted = postAssistantConversationFeedCard({
                  lead: ctx.currentCustomer,
                  policy: agentPolicy,
                  agentResult,
                  contextSwitch,
                  undoToken: rememberUndoToken,
                });
                if (posted?.lead && typeof updateLead === 'function') {
                  updateLead(ctx.currentCustomer.id, posted.lead);
                }
              } catch { /* feed optional */ }
            }

            if (completeQuietIntakeSubtask) {
              restoreQuietIntakeWorkContext({
                sellerInput: text,
                extractedFacts: agentResult?.extractedFacts || [],
                facts: agentResult?.facts || [],
                rememberDecision: agentResult?.rememberDecision || null,
              });
              if (contextSwitch?.autoOpen && contextSwitch.leadId) {
                handleOpenLead(contextSwitch.leadId);
              }
              setSending(false);
              return;
            }

            if (agentPolicy.showReview && agentResult.confirmationRequired) {
              const reviewTurn = buildAgentReviewTurn(agentResult);
              setLastTurn({
                ...(reviewTurn || {
                  ok: true,
                  assistantReply: agentPolicy.message,
                  pendingAction: agentResult.pendingAction,
                  confirmationRequired: true,
                  agentSource: agentResult.agentSource,
                }),
                customerSearchResults: searchResults,
                resolvedCustomer: agentResult.resolvedCustomer
                  || reviewTurn?.resolvedCustomer
                  || null,
                messageDraft: agentResult.messageDraft || reviewTurn?.messageDraft || null,
                agentDirect: false,
                assistantPolicy: agentPolicy,
              });
              const model = reviewTurn
                ? buildUniversalReviewModel(reviewTurn)
                : null;
              setReviewModel(model || {
                title: '✨ Clever',
                summaryLine: agentPolicy.message,
                body: agentPolicy.message,
                primaryCta: 'Prüfen',
                secondaryCta: 'Verwerfen',
              });
            } else {
              setReviewModel(null);
              setLastTurn({
                ok: true,
                assistantReply: agentPolicy.message,
                agentDirect: true,
                conversationCard: true,
                assistantPolicy: {
                  ...agentPolicy,
                  undoToken: rememberUndoToken || agentPolicy.undoToken || null,
                },
                customerSearchResults: searchResults,
                resolvedCustomer: agentResult.resolvedCustomer || null,
                messageDraft: agentResult.messageDraft || null,
                pendingAction: agentResult.pendingAction || null,
              });
              // Conversation-Slot trägt die Antwort; Toast nur kurz bei fehlender Slot-Anzeige
              setFeedback('');
            }

            // Context-Switch ohne Modulbruch
            if (contextSwitch?.autoOpen && contextSwitch.leadId) {
              handleOpenLead(contextSwitch.leadId);
              if (contextSwitch.hint) {
                setFeedback(contextSwitch.hint.slice(0, 160));
                setTimeout(() => setFeedback(''), 3600);
              }
            }

            setSending(false);
            return;
          }

          if (shouldFallbackToSellerTurn(agentResult)) {
            /* sauberer Fallback → klassischer Seller-Turn */
          } else if (agentResult?.message || agentPolicy.message) {
            setDraft('');
            progressHintSchedulerRef.current?.clear();
            if (completeQuietIntakeSubtask) {
              restoreQuietIntakeWorkContext({
                sellerInput: text,
                extractedFacts: agentResult?.extractedFacts || [],
                facts: agentResult?.facts || [],
              });
            } else {
              setReviewModel(null);
              setLastTurn({
                ok: true,
                assistantReply: agentPolicy.message || agentResult.message,
                agentDirect: true,
                conversationCard: true,
                assistantPolicy: agentPolicy,
                customerSearchResults: searchResults,
                resolvedCustomer: agentResult.resolvedCustomer || null,
              });
              setFeedback('');
            }
            if (contextSwitch?.autoOpen && contextSwitch.leadId) {
              handleOpenLead(contextSwitch.leadId);
            }
            setSending(false);
            return;
          }
        }
      }

      const useServerInterpret = semantic.use
        && isCleverSellerOpenAiInterpretClientEnabled()
        && await shouldRequestServerSellerTurn({
          sellerInput: text,
          attachments: composerAttachments,
        });

      const localTurnParams = {
        lead: ctx?.currentCustomer || {},
        sellerInput: text,
        attachments: composerAttachments,
        leadsSnapshot: ctx?.leadsSnapshot || [],
        scopeHint: 'dashboard',
        appContext: {
          routeContext: ctx?.routeContext,
          attachedWorkingObjects: ctx?.attachedWorkingObjects,
          dashboardContext: ctx?.dashboardContext,
        },
        workingContextItems: ctx?.attachedWorkingObjects || [],
        currentOfferContext: toCurrentOfferContext(
          findOfferWorkingContext(ctx?.attachedWorkingObjects || []),
        ) || buildSellerTurnMemoryParams(agentWorkingMemory).currentOfferContextFromMemory,
        customerName: customerDisplayName || '',
        pendingAction: lastTurn?.pendingAction
          || agentWorkingMemory?.pendingAction
          || null,
        ...buildSellerTurnMemoryParams(agentWorkingMemory),
        intentConstraint,
        messagePurpose: intentPurpose?.messagePurpose || null,
        memoryCategory: intentPurpose?.memoryCategory || null,
        offerAction: intentPurpose?.offerAction || null,
      };

      let turn;
      if (useServerInterpret) {
        progressHintSchedulerRef.current?.start(CLEVER_LONG_JOB.SERVER_INTERPRET);
        const serverTurn = await requestCleverSellerTurn({
          lead: ctx?.currentCustomer || {},
          sellerInput: text,
          attachments: composerAttachments,
          scopeHint: 'dashboard',
          sellerId: ctx?.sellerId || null,
          dealerId: ctx?.dealerId || null,
          intentConstraint,
          messagePurpose: intentPurpose?.messagePurpose || null,
          memoryCategory: intentPurpose?.memoryCategory || null,
          offerAction: intentPurpose?.offerAction || null,
        });
        if (serverTurn?.turnId || serverTurn?.ok || serverTurn?.multiSourceIntake) {
          turn = serverTurn;
        } else {
          turn = await runCleverSellerTurnWithCalendar({
            ...localTurnParams,
            forceAsyncInterpret: semantic.use,
          });
        }
      } else if (semantic.use && isCleverSellerOpenAiInterpretClientEnabled()) {
        // Komplex + Flag, aber kein Server: Async-Pfad (Key nur serverseitig sinnvoll)
        turn = await runCleverSellerTurnAsync(localTurnParams);
      } else {
        turn = await runCleverSellerTurnWithCalendar({
          ...localTurnParams,
          forceAsyncInterpret: false,
        });
      }

      let policy = resolveSellerResponsePolicy(turn);
      setAgentWorkingMemory((prev) => updateMemoryFromSellerTurn(prev, turn, text, policy));

      progressHintSchedulerRef.current?.clear();

      // Zero-Loss Merken: sichere Facts sofort (+ Partial Success), kein Full-Review
      const rememberMode = turn?.rememberDecision?.mode;
      if (
        rememberMode === 'save_with_undo'
        || rememberMode === 'partial_save_with_undo'
      ) {
        setDraft('');
        const safeFacts = turn.rememberDecision?.safeFacts;
        if (
          rememberMode === 'partial_save_with_undo'
          && turn.rememberDecision?.reviewFacts?.length
          && (policy.showReview || shouldShowUniversalReview({
            ...turn,
            extractedFacts: turn.rememberDecision.reviewFacts,
            rememberDecision: { ...turn.rememberDecision, mode: 'review' },
          }))
        ) {
          const remembered = applyRememberWithUndo(turn, { facts: safeFacts });
          if (completeQuietIntakeSubtask) {
            restoreQuietIntakeWorkContext(turn);
            setSending(false);
            return;
          }
          const model = turn.reviewModel
            || buildUniversalReviewModel({
              ...turn,
              extractedFacts: turn.rememberDecision.reviewFacts,
            });
          setReviewModel(model);
          setLastTurn({
            ...turn,
            conversationCard: true,
            assistantPolicy: {
              ...policy,
              undoToken: remembered?.undoToken || null,
            },
            assistantReply: policy.message,
          });
          pushComposerFeedback(quietReviewFeedback(
            model,
            turn,
            model?.title || policy.message || 'Bitte Angaben prüfen',
          ));
          resetIntentChipsToDefault();
          return;
        }
        const remembered = applyRememberWithUndo(turn, { facts: safeFacts });
        if (remembered) {
          // Lead-Feed wenn Akte aktiv
          if (remembered.lead && policy.message) {
            try {
              const posted = postAssistantConversationFeedCard({
                lead: remembered.lead,
                policy,
                undoToken: remembered.undoToken,
              });
              if (posted?.lead && typeof updateLead === 'function') {
                updateLead(remembered.leadId, posted.lead);
              }
            } catch { /* optional */ }
          }
        }
        if (completeQuietIntakeSubtask) {
          restoreQuietIntakeWorkContext(turn);
          setSending(false);
          return;
        }
        if (remembered) {
          setReviewModel(null);
          setLastTurn({
            ...turn,
            conversationCard: true,
            agentDirect: false,
            assistantPolicy: {
              ...policy,
              undoAvailable: true,
              undoToken: remembered.undoToken || null,
            },
            assistantReply: policy.message,
          });
          setFeedback('');
          setFeedbackKind('');
        } else if (policy.showReview || shouldShowUniversalReview(turn)) {
          const model = turn.reviewModel || buildUniversalReviewModel(turn);
          setReviewModel(model);
          setLastTurn(turn);
          pushComposerFeedback(quietReviewFeedback(
            model,
            turn,
            model?.title || 'Bitte Angaben prüfen',
          ));
        } else {
          setReviewModel(null);
          setLastTurn({
            ...turn,
            conversationCard: true,
            assistantPolicy: policy,
            assistantReply: policy.message,
          });
          // Compact confirmation ohne grüne Composer-Zeile
          setFeedback('');
          setFeedbackKind('');
        }
        resetIntentChipsToDefault();
        return;
      }

      // Magic: bei Kundennachricht Async-LLM/Akte-Kontext (Confirm-Vertrag bleibt)
      const hasMessageDraft = Boolean(
        turn?.messageDraft
        || (turn?.preparedActions || []).some((a) => (
          a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.payload?.messageDraft
        )),
      );
      const leadId = turn?.resolvedCustomer?.id || ctx?.currentCustomer?.id || null;
      const snapshot = ctx?.leadsSnapshot || [];
      const magicLead = (leadId && snapshot.find((l) => l.id === leadId))
        || ctx?.currentCustomer
        || null;
      if (hasMessageDraft && magicLead?.id) {
        progressHintSchedulerRef.current?.start(CLEVER_LONG_JOB.MAGIC_PROPOSE);
        const working = turn.handoffWorkingContext
          || (ctx?.attachedWorkingObjects || [])[0]
          || null;
        let openVehicles = [];
        try {
          openVehicles = (buildVehicleOpportunityCards({
            lead: magicLead,
            wishFields: magicLead?.wish ?? {},
          }) || []).map((card) => ({
            modelKey: card.modelKey || card.model || null,
            model: card.modelName || card.model || null,
            label: card.shortLabel || card.label || null,
            shortLabel: card.shortLabel || card.label || null,
            offerId: card.id || card.configurationId || null,
            monthlyRate: card.desiredRate ?? null,
            termMonths: card.termMonths ?? null,
            summary: null,
          }));
        } catch {
          openVehicles = [];
        }
        const enriched = await enrichSellerTurnWithMagicPropose({
          turn,
          sellerInput: text,
          lead: magicLead,
          customerName: magicLead?.contact?.name || magicLead?.name || turn?.resolvedCustomer?.name || '',
          displayName: magicLead?.contact?.name || magicLead?.name || turn?.resolvedCustomer?.name || '',
          workingContext: working,
          offerContext: working?.offerId
            ? {
              offerId: working.offerId,
              title: working.label || working.shortLabel,
              monthlyRate: working.monthlyRate ?? null,
              termMonths: working.termMonths ?? null,
              mileagePerYear: working.mileagePerYear ?? null,
              paymentType: working.paymentType ?? null,
              summary: working.summary || working.shortLabel || null,
              modelKey: working.modelKey || null,
            }
            : null,
          openVehicles,
        });
        progressHintSchedulerRef.current?.clear();
        turn = enriched.turn;
        policy = resolveSellerResponsePolicy(turn);
        setAgentWorkingMemory((prev) => updateMemoryFromSellerTurn(prev, turn, text, policy));
        setDraft('');
        if (completeQuietIntakeSubtask) {
          restoreQuietIntakeWorkContext(turn);
          return;
        }
        const showReview = policy.showReview || shouldShowUniversalReview(turn);
        if (showReview) {
          setLastTurn(turn);
          const model = turn.reviewModel || buildUniversalReviewModel(turn);
          setReviewModel(model);
          resetIntentChipsToDefault();
          pushComposerFeedback(quietReviewFeedback(
            model,
            turn,
            enriched.feedback
              || model?.title
              || policy.message
              || 'Clever hat vorbereitet',
          ));
        } else {
          setReviewModel(null);
          setLastTurn({
            ...turn,
            conversationCard: true,
            assistantPolicy: policy,
            assistantReply: policy.message || enriched.feedback || enriched.magicBody,
          });
          resetIntentChipsToDefault();
          setFeedback('');
          setFeedbackKind('');
        }
        return;
      }

      // Clever 2.0 Response Policy: Review nur für Business-Actions / prepared_action
      setDraft('');
      if (completeQuietIntakeSubtask) {
        restoreQuietIntakeWorkContext(turn);
        return;
      }
      const source = turn?.interpreterDiagnostics?.interpreterSource
        || turn?.openaiEscalation?.interpreterSource
        || null;
      const isFallback = source === 'fallback' || source === 'openai_fallback';
      const showReview = policy.showReview || shouldShowUniversalReview(turn);

      if (showReview) {
        setLastTurn(turn);
        const model = turn.reviewModel || buildUniversalReviewModel(turn);
        setReviewModel(model);
        resetIntentChipsToDefault();
        if (isFallback) {
          pushComposerFeedback(FALLBACK_INTERPRET_WARNING, { kind: 'error', ms: 5200 });
        } else {
          pushComposerFeedback(quietReviewFeedback(
            model,
            turn,
            model?.title || policy.message || 'Clever hat vorbereitet',
          ));
        }
        return;
      }

      // direct_answer / compact_confirmation / clarification → Conversation-Slot
      setReviewModel(null);
      setLastTurn({
        ...turn,
        conversationCard: true,
        assistantPolicy: policy,
        assistantReply: policy.message || turn.assistantReply,
      });
      resetIntentChipsToDefault();
      if (isFallback) {
        pushComposerFeedback(FALLBACK_INTERPRET_WARNING, { kind: 'error', ms: 5200 });
      } else {
        setFeedback('');
        setFeedbackKind('');
      }
    } catch {
      // Draft + Intent behalten – technischer Fehler, One-Turn nicht verbrauchen
      progressHintSchedulerRef.current?.clear();
      pushComposerFeedback(FALLBACK_INTERPRET_WARNING, { kind: 'error', ms: 5200 });
    } finally {
      progressHintSchedulerRef.current?.clear();
      setSending(false);
    }
  }

  const customerResults = normalizeCustomerSearchResults(lastTurn?.customerSearchResults || []);
  const historyResults = lastTurn?.historySearchResults || [];
  const showAssistantConversation = Boolean(
    !reviewModel
    && (lastTurn?.agentDirect || lastTurn?.conversationCard)
    && (lastTurn?.assistantPolicy || lastTurn?.assistantReply),
  );
  const assistantFeedOpts = showAssistantConversation
    ? buildAssistantFeedCardOptions({
      policy: lastTurn.assistantPolicy || {
        kind: 'direct_answer',
        message: lastTurn.assistantReply,
        chips: [],
        undoAvailable: Boolean(lastTurn.assistantPolicy?.undoAvailable),
      },
      agentResult: {
        suggestedActions: lastTurn.resolvedCustomer?.id
          ? [{
            action: 'open_customer',
            label: `${lastTurn.resolvedCustomer.name || lastTurn.resolvedCustomer.contact?.name || 'Kunde'} öffnen`,
            leadId: lastTurn.resolvedCustomer.id,
          }]
          : [],
      },
      contextSwitch: lastTurn.resolvedCustomer?.id
        ? {
          leadId: lastTurn.resolvedCustomer.id,
          name: lastTurn.resolvedCustomer.name || lastTurn.resolvedCustomer.contact?.name,
        }
        : null,
      undoToken: lastTurn.assistantPolicy?.undoToken
        || rememberUndo?.undoToken
        || null,
    })
    : null;
  const showConversationSlot = Boolean(
    reviewModel
    || assistantFeedOpts
    || customerResults.length
    || historyResults.length
    || lastTurn?.todayOverview?.items?.length,
  );

  const reviewSlot = showConversationSlot
    ? (
      <div className="clever-global-composer__review">
        {assistantFeedOpts && !reviewModel ? (
          <div className="clever-global-composer__assistant-card">
            <CleverChatMessage
              text={assistantFeedOpts.text}
              payload={{
                title: assistantFeedOpts.title,
                responseKind: assistantFeedOpts.responseKind,
                chips: assistantFeedOpts.chips,
                ctaLabel: assistantFeedOpts.ctaLabel,
                ctaAction: assistantFeedOpts.ctaAction,
                leadId: assistantFeedOpts.leadId,
                undoAvailable: assistantFeedOpts.undoAvailable,
                undoToken: assistantFeedOpts.undoToken,
              }}
              onCta={(payload) => {
                if (payload.ctaAction === 'open_customer' && payload.leadId) {
                  handleOpenLead(payload.leadId);
                }
              }}
              onUndo={rememberUndo ? handleRememberUndo : null}
              activeUndoToken={rememberUndo?.undoToken || null}
            />
          </div>
        ) : null}
        {reviewModel && Array.isArray(reviewModel.progressLines) && reviewModel.progressLines.length > 0
          && customerResults.length === 0
          && !isQuietIntakeReview(reviewModel)
          && !reviewModel.compactUi
          && (
          <ul className="clever-global-composer__progress" aria-label="Clever Fortschritt">
            {reviewModel.progressLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {reviewModel ? (
        <SellerUniversalReviewCard
          model={reviewModel}
          onAccept={() => {
            if (reviewModel?.reviewType === 'contract_import_review') {
              handleReviewAction({
                action: 'accept_contract_import',
                leadId: lastTurn?.resolvedCustomer?.id,
              });
              return;
            }
            if (reviewModel?.reviewType === 'customer_reply_review' || lastTurn?.customerReply?.detected) {
              handleReviewAction({
                action: 'accept_customer_reply',
                leadId: lastTurn?.customerReply?.matchedLeadId
                  || lastTurn?.resolvedCustomer?.id
                  || null,
              });
              return;
            }
            if (
              reviewModel?.reviewType === 'customer_intake_review'
              || reviewModel?.reviewType === 'inbound_lead_review'
              || lastTurn?.inboundLead?.detected
            ) {
              handleReviewAction({
                action: 'accept_inbound_lead',
                leadId: lastTurn?.inboundLead?.matchedLeadId
                  || lastTurn?.resolvedCustomer?.id
                  || null,
              });
              return;
            }
            if (
              reviewModel?.reviewType === 'customer_contract_tradein_intake_review'
              || reviewModel?.kind === 'multi_source_intake'
              || lastTurn?.multiSourceIntake?.detected
            ) {
              handleReviewAction({
                action: 'accept_multi_source_intake',
                leadId: lastTurn?.resolvedCustomer?.id || null,
              });
              return;
            }
            if (reviewModel?.reviewType === 'request_documents') {
              handleReviewAction({
                action: 'send_documents_package',
                leadId: lastTurn?.resolvedCustomer?.id || null,
              });
              return;
            }
            const target = resolvePrimaryNavTarget(lastTurn, reviewModel);
            // Slice 18: Nachfolge Confirm → Spur markieren (kein Auto-Send)
            const successionAccept = isPrepareSuccessionOfferCue(
              lastTurn?.interpretedInput?.normalized || lastTurn?.interpretedInput?.raw || '',
            ) || (lastTurn?.extractedFacts || []).some((f) => (
              f.field === 'paymentType' && /nachfolge/i.test(String(f.label || ''))
            ));
            if (successionAccept && target?.leadId && typeof updateLead === 'function') {
              const snapshot = ctx?.leadsSnapshot || [];
              const lead = snapshot.find((l) => l.id === target.leadId) || ctx?.currentCustomer;
              if (lead?.id) {
                const applied = applyAcceptedSellerTurn(lead, lastTurn, { postFeedCard: false });
                if (applied.ok && applied.lead) updateLead(lead.id, applied.lead);
              }
            }
            if (target?.leadId) handleOpenLead(target.leadId, target);
            setReviewModel(null);
            setLastTurn(null);
          }}
          onReviewAction={handleReviewAction}
          onConfirmChip={handleConfirmUncertainChip}
          onCorrectChip={(chip) => handleReviewAction({
            action: 'revise_fact',
            field: chip?.field,
            label: chip?.label,
          })}
          onLiveEditChip={handleLiveEditChip}
          onUndo={(rememberUndo || liveEditUndo) ? handleRememberUndo : null}
          onReject={() => {
            setReviewModel(null);
            setLastTurn(null);
          }}
          onDismiss={() => {
            setReviewModel(null);
            setLastTurn(null);
          }}
          onOpenHistoryHit={(hit) => {
            if (!hit) return;
            const leadId = hit.customerId || hit.leadId;
            if (!leadId) return;
            handleOpenLead(leadId, {
              messageId: hit.messageId || hit.id || null,
              offerId: hit.offerId || null,
              hit,
            });
          }}
        />
        ) : null}
        {customerResults.length > 0 && (
          <div className="clever-global-composer__today-list" aria-label="Kundenakte wählen">
            <p className="clever-global-composer__pick-label">Kundenakte wählen</p>
            {customerResults.slice(0, 6).map((item) => {
              const detail = [
                item.email,
                item.phone,
                item.vehicleLabel,
                item.referenceCode ? `Ref. ${item.referenceCode}` : null,
              ].filter(Boolean).join(' · ');
              const reason = Array.isArray(item.matchReasons)
                ? item.matchReasons[0]
                : (item.matchReason || item.lastActivityLabel || null);
              return (
                <button
                  key={item.leadId || item.customerId}
                  type="button"
                  className="clever-global-composer__today-item"
                  onClick={() => handleOpenLead(item.leadId || item.customerId)}
                >
                  <strong>{item.customerName || 'Kundenakte'}</strong>
                  {detail ? <span>{detail}</span> : null}
                  {reason ? <em>{reason}</em> : null}
                </button>
              );
            })}
          </div>
        )}
        {historyResults.length > 0 && (
          <div className="clever-global-composer__today-list">
            {historyResults.slice(0, 4).map((hit) => (
              <button
                key={hit.sourceId || hit.messageId || hit.offerId}
                type="button"
                className="clever-global-composer__today-item"
                onClick={() => handleOpenLead(hit.customerId, {
                  messageId: hit.messageId,
                  offerId: hit.offerId,
                  hit,
                })}
              >
                <strong>{hit.whenLabel || hit.title}</strong>
                <span>{String(hit.matchedText || '').slice(0, 120)}</span>
                {hit.sourceLabel && <em>Quelle: {hit.sourceLabel}</em>}
              </button>
            ))}
          </div>
        )}
        {lastTurn?.todayOverview?.items?.length > 0 && (
          <div className="clever-global-composer__today-list">
            {lastTurn.todayOverview.items.slice(0, 6).map((item) => (
              <button
                key={item.leadId}
                type="button"
                className="clever-global-composer__today-item"
                onClick={() => {
                  if (
                    item.composerAction === 'prepare_followup_offer'
                    || item.actionId === 'prepare_succession_offer'
                  ) {
                    handleReviewAction({
                      action: 'prepare_followup_offer',
                      leadId: item.leadId,
                    });
                    return;
                  }
                  handleOpenLead(item.leadId);
                }}
              >
                <strong>{item.customerName}</strong>
                <span>
                  {item.primaryCtaLabel || item.headline}
                </span>
                {(item.whySummary || item.reasons?.[0]) ? (
                  <em>{item.whySummary || item.reasons[0]}</em>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    )
    : null;

  const shellClass = [
    'clever-global-composer',
    isIdle ? 'clever-global-composer--idle' : 'clever-global-composer--expanded',
    useHeroPortal ? 'clever-global-composer--hero' : 'clever-global-composer--docked',
  ].join(' ');

  // Quick Actions nur im Hero; Dock nie mit Chips/Leitfrage
  const showQuickOutside = Boolean(useHeroPortal);
  const dockCompact = !useHeroPortal && isIdle;

  const node = (
    <>
      <div
        ref={shellRef}
        className={shellClass}
        data-testid="clever-global-composer"
        data-composer-state={surfaceState}
        data-composer-dock={useHeroPortal ? 'hero' : 'docked'}
        data-composer-instance="global"
      >
        {progressHint && (
          <p className="clever-global-composer__hint" role="status">{progressHint}</p>
        )}
        {(
          lastTurn?.interpreterDiagnostics?.interpreterSource === 'fallback'
          || lastTurn?.interpreterDiagnostics?.interpreterSource === 'openai_fallback'
          || lastTurn?.openaiEscalation?.interpreterSource === 'fallback'
        ) && (
          <p className="clever-global-composer__hint" role="alert">
            {FALLBACK_INTERPRET_WARNING}
          </p>
        )}
        {attachmentActions?.suggestedActions?.length && !reviewModel ? (
          <div className="clever-global-composer__attach-actions" role="group" aria-label="Dokument-Aktionen">
            {attachmentActions.suggestedActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`clever-global-composer__attach-action${attachmentActions.preselect ? ' is-preselect' : ''}`}
                onClick={() => {
                  const chip = COMPOSER_INTENT_CHIPS.find(
                    (c) => c.intentConstraint === action.intentConstraint,
                  );
                  if (chip) setSelectedIntentChipId(chip.id);
                  setFocused(true);
                  setFeedback(`${action.label} – bitte prüfen, dann absenden`);
                  setTimeout(() => setFeedback(''), 3200);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        <SharedWorkspaceChat
          role="seller"
          hideFeed
          items={[]}
          draft={draft}
          onDraftChange={(value) => {
            setDraft(value);
            if (value) setFocused(true);
          }}
          onSend={handleSend}
          sending={sending}
          sendFeedback={feedback}
          sendFeedbackKind={feedbackKind}
          placeholder={composerPlaceholder}
          composerLabel={composerLabel}
          sendAriaLabel={intentLabels.sendAriaLabel}
          sendLabel={intentLabels.sendLabel}
          reviewSlot={isIdle ? null : reviewSlot}
          contextPills={isIdle && !useHeroPortal ? [] : contextPills}
          suggestionChips={quietIntakeSuggestChips}
          onSuggestionChip={handleSuggestion}
          hideSuggestionChips={!quietIntakeSuggestChips.length}
          intentChips={visibleIntentChips}
          moreIntentChips={COMPOSER_INTENT_MORE_CHIPS}
          selectedIntentChipId={selectedIntentChipId}
          onIntentChip={(chip) => {
            setSelectedIntentChipId(chip.id);
            setIntentPurpose(null);
            setFocused(true);
            setAttachmentActions(null);
          }}
          secondaryIntentActions={secondaryIntentActions}
          onSecondaryIntentAction={handleSecondaryIntentAction}
          selectedPurposeId={intentPurpose?.id || null}
          intentModeHint={intentModeHint}
          intentChipTooltips={intentChipTooltips}
          hideIntentChips={Boolean(reviewModel) || dockCompact || useHeroPortal}
          compactMode={dockCompact}
          autoGrow
          onComposerFocus={() => setFocused(true)}
          onComposerBlur={() => {
            if (
              !String(draft || '').trim()
              && !reviewModel
              && contextPills.length === 0
              && !dictating
              && !hasPendingAction
              && !customerMessageEdit
            ) {
              setFocused(false);
            }
          }}
          plusActions={plusActions}
          onAttachFile={handleAttachFile}
          micSlot={(
            <DealerAiInlineMic
              variant="toolbar"
              disabled={sending}
              onListeningChange={(active) => {
                setDictating(Boolean(active));
                if (active) setFocused(true);
              }}
              onTranscript={(text) => {
                setFocused(true);
                setDraft((prev) => (prev ? `${prev} ${text}` : text));
              }}
            />
          )}
          emptyHint=""
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="sw-composer__file"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleAttachFile(file);
            event.target.value = '';
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,image/*,.png,.jpg,.jpeg"
          className="sw-composer__file"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleAttachFile(file);
            event.target.value = '';
          }}
        />
      </div>
      {showQuickOutside ? (
        <div className="clever-global-composer__quick" role="group" aria-label="Schnelle Schritte">
          {HOME_QUICK_CHIPS.map((chip) => {
            const Icon = chip.Icon;
            return (
              <button
                key={chip.id}
                type="button"
                className="clever-global-composer__quick-chip"
                disabled={sending}
                onClick={() => handleSuggestion(chip)}
              >
                {Icon ? (
                  <span className="clever-global-composer__quick-icon" aria-hidden>
                    <Icon />
                  </span>
                ) : null}
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );

  if (useHeroPortal) {
    return createPortal(node, heroSlotEl);
  }
  return node;
}
