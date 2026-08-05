/**
 * CleverGlobalComposer – Dashboard-Surface des Clever-Composers.
 * Orchestrierung nur über runCleverSellerTurn – keine zweite Pipeline.
 * Kundenakte: gleicher Orchestrator in CustomerAkteSharedWorkspace (fester Lead);
 * dieser Global Composer wird dort nicht gerendert.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import SellerUniversalReviewCard from '../dealer-ai/SellerUniversalReviewCard.jsx';
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
import { executeDualOfferAppointmentAccept } from '../../services/cleverSeller/executeDualOfferAppointmentAccept.js';
import { resolveCleverOcrProvider } from '../../services/cleverSeller/resolveCleverOcrProvider.js';
import { resolveCleverCalendarProvider } from '../../services/cleverSeller/resolveCleverCalendarProvider.js';
import { maybeCreateCalendarDraftEvent } from '../../services/cleverSeller/checkCalendarAvailability.js';
import { refreshSellerTurnCalendarCheck } from '../../services/cleverSeller/refreshSellerTurnCalendarCheck.js';
import { enrichSellerTurnWithMagicPropose } from '../../services/cleverSeller/enrichSellerTurnWithMagicPropose.js';
import { SELLER_TURN_INTENTS } from '../../services/cleverSeller/sellerFactTypes.js';
import { isPrepareSuccessionOfferCue } from '../../services/cleverSeller/prepareSuccessionOfferFromLead.js';
import { shouldUseSemanticInterpreter } from '../../services/cleverSeller/multiSource/evaluateComplexSellerTurn.js';
import { applyConfirmedMultiSourceIntakePlan } from '../../services/cleverSeller/multiSource/applyConfirmedMultiSourceIntakePlan.js';
import { buildMultiSourceApplyResultReview } from '../../services/cleverSeller/multiSource/buildMultiSourceApplyResultReview.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import { buildVehicleOpportunityCards } from '../../services/customerAkte.js';
import {
  isCleverSellerOpenAiInterpretClientEnabled,
  requestCleverSellerTurn,
  shouldRequestServerSellerTurn,
} from '../../services/clever/intelligence/cleverSharedIntelligenceClient.js';
import './CleverGlobalComposer.css';

const FALLBACK_INTERPRET_WARNING = [
  'Clever konnte den gesamten Fall nicht vollständig',
  'mit dem Sprachmodell interpretieren.',
  'Bitte prüfen Sie die erkannten Angaben.',
].join(' ');

const SUGGESTION_CHIPS = [
  { id: 'showroom', label: 'Showroom starten' },
  { id: 'model', label: 'Modell auswählen' },
  { id: 'intake', label: 'Neue Anfrage' },
];

const COMPOSER_PLACEHOLDER = 'Frage etwas, diktiere eine Notiz, füge eine Anfrage ein oder lade ein Dokument hoch …';
const COMPOSER_LEITFRAGE = 'Was soll Clever heute für dich erledigen?';

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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reviewModel, setReviewModel] = useState(null);
  const [lastTurn, setLastTurn] = useState(null);
  const [progressHint, setProgressHint] = useState(null);

  const visible = Boolean(ctx?.shouldShowGlobalComposer);

  const contextPills = useMemo(() => {
    if (!ctx) return [];
    return (ctx.attachedWorkingObjects || []).map((obj) => ({
      id: obj.id || obj.offerId || obj.label,
      label: obj.label || 'Arbeitsobjekt',
    }));
  }, [ctx]);

  if (!visible) return null;

  function handleSuggestion(chip) {
    if (!chip) return;
    if (chip.id === 'showroom') {
      navigate('/verkaufsassistent?view=showroom');
      return;
    }
    if (chip.id === 'model') {
      navigate('/verkaufsassistent?view=model');
      return;
    }
    if (chip.id === 'intake') {
      setDraft('Hier eine Anfrage:\n\n');
      setFeedback('Anfrage einfügen oder diktieren – dann absenden');
      setTimeout(() => setFeedback(''), 3200);
      return;
    }
    if (chip.id === 'today') setDraft('Was liegt heute an?');
    else if (chip.id === 'tow') setDraft('XCeed Anhängelast?');
    else if (chip.id === 'open') setDraft('Öffne Herrn Brandes.');
    else if (chip.id === 'summary') setDraft('Was wollte Herr Brandes noch einmal?');
    else if (chip.id === 'offer') {
      setDraft('Erstelle Herrn Garritano ein Angebot für den Picanto GT-Line für 17.000 €.');
    }
    else if (chip.label) setDraft(chip.label);
  }

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
    ));
    if (offerMsg || turn?.handoffWorkingContext) {
      const leadId = turn?.resolvedCustomer?.id
        || turn?.handoffWorkingContext?.customerId
        || offerMsg?.primaryActions?.[0]?.leadId;
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

  function handleReviewAction(action) {
    if (!action || !lastTurn) return;
    if (action.action === 'discard') {
      setReviewModel(null);
      setLastTurn(null);
      return;
    }
    if (action.action === 'open_customer_search') {
      const contact = lastTurn?.inboundLead?.contact || lastTurn?.customerReply?.contact || {};
      const hint = contact.fullName || contact.email || contact.phone || '';
      setReviewModel(null);
      setLastTurn(null);
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
        setFeedback('Kunde angelegt – Angaben übernommen.');
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
      setFeedback('Anfrage verknüpft – Angaben übernommen.');
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
          appContext: {
            routeContext: ctx.routeContext,
            attachedWorkingObjects: ctx.attachedWorkingObjects,
            dashboardContext: ctx.dashboardContext,
          },
        });
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
    if (
      action.action === 'edit_message'
      || action.action === 'send_handoff'
      || action.action === 'send_appointment_proposal'
      || action.action === 'open_offer_handoff'
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

  async function handleAttachFile(file) {
    if (!file || sending || !ctx) return;
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name || '');
    if (!isPdf) {
      setFeedback('Bitte PDF reinwerfen (Vertrag oder Konfigurator).');
      setTimeout(() => setFeedback(''), 2800);
      return;
    }
    setSending(true);
    setProgressHint('Clever liest das PDF …');
    setFeedback('PDF wird gelesen …');
    try {
      const extracted = await extractMagicOfferPdf(file);
      setProgressHint('Clever prüft Scan / OCR …');
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
        setDraft((prev) => (prev ? `${prev}\n${prepared.draftSeed}` : prepared.draftSeed));
        setFeedback(prepared.feedbackManual);
        setProgressHint(null);
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      if (prepared.needsManualDescribe && prepared.kind === 'contract_pdf') {
        setDraft((prev) => (prev ? `${prev}\n${prepared.draftSeed}` : prepared.draftSeed));
      } else if (prepared.draftSeed) {
        setDraft(prepared.draftSeed);
      }

      if (turn) {
        setLastTurn(turn);
        const model = turn.reviewModel
          || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
        setReviewModel(model);
        setFeedback(model
          ? (prepared.feedbackOk || model.title || 'PDF gelesen')
          : prepared.feedbackManual);
      } else {
        setFeedback(prepared.feedbackManual);
      }
      setProgressHint(null);
      setTimeout(() => setFeedback(''), 3200);
    } catch (err) {
      setProgressHint(null);
      setFeedback(err?.message || 'PDF konnte nicht gelesen werden');
      setTimeout(() => setFeedback(''), 3200);
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    const text = String(draft || '').trim();
    if (!text || sending) return;
    setSending(true);
    setFeedback('');

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

    const lower = text.toLowerCase();
    if (semantic.use) {
      setProgressHint('Clever analysiert Dump und Dokument …');
    } else if (/heute an|heute liegt|tages/.test(lower)) {
      setProgressHint('Clever prüft Ihre heutigen Vorgänge …');
    } else if (/termin|montag|dienstag|mittwoch|donnerstag|freitag|schlag.*vor|probefahrt/.test(lower)) {
      setProgressHint('Clever bereitet Terminvorschlag und Nachricht vor …');
    } else if (/technologie|ausstattung|schiebedach|picanto|gt-line/.test(lower) && /schreib|erklär/.test(lower)) {
      setProgressHint('Clever prüft Fahrzeugwissen und bereitet die Nachricht vor …');
    } else if (/anhängelast|reichweite|tank|wärmepumpe|kofferraum/.test(lower)) {
      setProgressHint('Clever sucht in den verifizierten Fahrzeugdaten …');
    } else if (/erstell|angebot für|mach.*angebot/.test(lower)) {
      setProgressHint('Clever bereitet Angebot und Nachricht vor …');
    } else if (/öffne|finde den kunden|finde den|suche/.test(lower)) {
      setProgressHint('Clever sucht in Ihren Kunden …');
    } else if (/anfrage|betreff:|ursprüngliche nachricht|forwarded|weitergeleitet|von:/.test(lower)) {
      setProgressHint('Clever liest die Anfrage und sucht den Kunden …');
    } else if (/was wollte|noch einmal|zusammenfassung/.test(lower)) {
      setProgressHint('Clever liest den Kundenkontext …');
    } else if (/geschrieben|angebot geschickt|historie|verlauf/.test(lower)) {
      setProgressHint('Clever durchsucht die Kundenhistorie …');
    } else if (/nachfass|kundenlink|schreib|nachricht|mail/.test(lower)) {
      setProgressHint('Clever schreibt die Kundennachricht …');
    } else {
      setProgressHint('Clever denkt mit …');
    }

    try {
      const useServerInterpret = semantic.use
        && isCleverSellerOpenAiInterpretClientEnabled()
        && await shouldRequestServerSellerTurn({
          sellerInput: text,
          attachments: composerAttachments,
        });

      const localTurnParams = {
        lead: ctx.currentCustomer || {},
        sellerInput: text,
        attachments: composerAttachments,
        leadsSnapshot: ctx.leadsSnapshot || [],
        scopeHint: 'dashboard',
        appContext: {
          routeContext: ctx.routeContext,
          attachedWorkingObjects: ctx.attachedWorkingObjects,
          dashboardContext: ctx.dashboardContext,
        },
        workingContextItems: ctx.attachedWorkingObjects || [],
        customerName: '',
        pendingAction: lastTurn?.pendingAction || null,
      };

      let turn;
      if (useServerInterpret) {
        setProgressHint('Clever analysiert Dump und Dokument …');
        const serverTurn = await requestCleverSellerTurn({
          lead: ctx.currentCustomer || {},
          sellerInput: text,
          attachments: composerAttachments,
          scopeHint: 'dashboard',
          sellerId: ctx.sellerId || null,
          dealerId: ctx.dealerId || null,
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

      // Magic: bei Kundennachricht Async-LLM/Akte-Kontext (Confirm-Vertrag bleibt)
      const hasMessageDraft = Boolean(
        turn?.messageDraft
        || (turn?.preparedActions || []).some((a) => (
          a.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE && a.payload?.messageDraft
        )),
      );
      const leadId = turn?.resolvedCustomer?.id || ctx.currentCustomer?.id || null;
      const snapshot = ctx.leadsSnapshot || [];
      const magicLead = (leadId && snapshot.find((l) => l.id === leadId))
        || ctx.currentCustomer
        || null;
      if (hasMessageDraft && magicLead?.id) {
        setProgressHint('Clever schreibt die Kundennachricht …');
        const working = turn.handoffWorkingContext
          || (ctx.attachedWorkingObjects || [])[0]
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
        turn = enriched.turn;
        setLastTurn(turn);
        const model = turn.reviewModel
          || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
        setReviewModel(model);
        setDraft('');
        setProgressHint(null);
        if (enriched.magicBody && enriched.feedback) {
          setFeedback(enriched.feedback);
        } else if (model) {
          setFeedback(model.title || 'Clever hat vorbereitet');
        } else {
          setFeedback('Clever hat nichts Sicheres gefunden');
        }
        setTimeout(() => setFeedback(''), 3200);
        return;
      }

      setLastTurn(turn);
      const model = turn.reviewModel
        || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
      setReviewModel(model);
      setDraft('');
      setProgressHint(null);
      const source = turn?.interpreterDiagnostics?.interpreterSource
        || turn?.openaiEscalation?.interpreterSource
        || null;
      const isFallback = source === 'fallback' || source === 'openai_fallback';
      if (isFallback) {
        setFeedback(FALLBACK_INTERPRET_WARNING);
      } else if (model) {
        setFeedback(model.title || 'Clever hat vorbereitet');
      } else {
        setFeedback('Clever hat nichts Sicheres gefunden');
      }
      setTimeout(() => setFeedback(''), isFallback ? 5200 : 2800);
    } catch {
      // Draft behalten – Seller Input nicht verlieren
      setProgressHint(null);
      setFeedback(FALLBACK_INTERPRET_WARNING);
      setTimeout(() => setFeedback(''), 5200);
    } finally {
      setSending(false);
    }
  }

  const customerResults = lastTurn?.customerSearchResults || [];
  const historyResults = lastTurn?.historySearchResults || [];

  const reviewSlot = reviewModel
    ? (
      <div className="clever-global-composer__review">
        {Array.isArray(reviewModel.progressLines) && reviewModel.progressLines.length > 0
          && customerResults.length === 0
          && reviewModel.reviewType !== 'customer_contract_tradein_intake_review'
          && reviewModel.kind !== 'multi_source_intake'
          && !reviewModel.compactUi
          && (
          <ul className="clever-global-composer__progress" aria-label="Clever Fortschritt">
            {reviewModel.progressLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
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
                {item.reasons?.[0] && (
                  <em>Grund: {item.reasons[0]}</em>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
    : null;

  return (
    <div className="clever-global-composer" data-testid="clever-global-composer">
      <p className="clever-global-composer__leitfrage">{COMPOSER_LEITFRAGE}</p>
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
      <SharedWorkspaceChat
        role="seller"
        hideFeed
        items={[]}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={sending}
        sendFeedback={feedback}
        placeholder={COMPOSER_PLACEHOLDER}
        composerLabel="Clever"
        sendAriaLabel="An Clever senden"
        reviewSlot={reviewSlot}
        contextPills={contextPills}
        suggestionChips={SUGGESTION_CHIPS}
        onSuggestionChip={handleSuggestion}
        onAttachFile={handleAttachFile}
        emptyHint=""
      />
    </div>
  );
}
