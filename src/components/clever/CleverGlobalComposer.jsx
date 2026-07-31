/**
 * CleverGlobalComposer – App-Shell Composer (Slice 1–2 + PDF Slice 13).
 * Orchestrierung nur über runCleverSellerTurn – keine zweite Pipeline.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import SellerUniversalReviewCard from '../dealer-ai/SellerUniversalReviewCard.jsx';
import { useCleverComposerOptional } from '../../context/CleverComposerContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { runCleverSellerTurn } from '../../services/cleverSeller/runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from '../../services/cleverSeller/buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from '../../services/cleverSeller/applyAcceptedSellerTurn.js';
import { extractMagicOfferPdf } from '../../services/dealer/magicOfferPdfExtract.js';
import { runComposerPdfAttachTurn } from '../../services/cleverSeller/runComposerPdfAttachTurn.js';
import { executeDualOfferAppointmentAccept } from '../../services/cleverSeller/executeDualOfferAppointmentAccept.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import './CleverGlobalComposer.css';

const SUGGESTION_CHIPS = [
  { id: 'today', label: 'Was liegt heute an?' },
  { id: 'offer', label: 'Erstelle Herrn Garritano ein Angebot…' },
  { id: 'open', label: 'Öffne Herrn Brandes.' },
  { id: 'tow', label: 'XCeed Anhängelast?' },
];

function buildAkteNavPath({ leadId, messageId = null, offerId = null }) {
  if (!leadId) return null;
  const base = buildKundenaktePath(leadId);
  const params = new URLSearchParams();
  if (messageId) params.set('messageId', messageId);
  if (offerId) params.set('offerId', offerId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function CleverGlobalComposer() {
  const ctx = useCleverComposerOptional();
  const { updateLead } = useLeads();
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

  function handleReviewAction(action) {
    if (!action || !lastTurn) return;
    if (action.action === 'discard') {
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
    if (action.action === 'check_calendar') {
      setFeedback('Kalenderverfügbarkeit noch nicht geprüft.');
      setTimeout(() => setFeedback(''), 3200);
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
      setReviewModel(null);
      setLastTurn(null);
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
      const { prepared, turn, skipped } = runComposerPdfAttachTurn({
        extracted,
        file,
        lead: ctx.currentCustomer || {},
        leadsSnapshot: ctx.leadsSnapshot || [],
        scopeHint: 'dashboard',
        workingContextItems: ctx.attachedWorkingObjects || [],
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

  function handleSend() {
    const text = String(draft || '').trim();
    if (!text || sending) return;
    setSending(true);
    setFeedback('');

    const lower = text.toLowerCase();
    if (/heute an|heute liegt|tages/.test(lower)) {
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
    } else if (/was wollte|noch einmal|zusammenfassung/.test(lower)) {
      setProgressHint('Clever liest den Kundenkontext …');
    } else if (/geschrieben|angebot geschickt|historie|verlauf/.test(lower)) {
      setProgressHint('Clever durchsucht die Kundenhistorie …');
    } else {
      setProgressHint('Clever denkt mit …');
    }

    try {
      const turn = runCleverSellerTurn({
        lead: ctx.currentCustomer || {},
        sellerInput: text,
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
      });
      setLastTurn(turn);
      const model = turn.reviewModel
        || (shouldShowUniversalReview(turn) ? buildUniversalReviewModel(turn) : null);
      setReviewModel(model);
      setDraft('');
      setProgressHint(null);
      if (model) {
        setFeedback(model.title || 'Clever hat vorbereitet');
      } else {
        setFeedback('Clever hat nichts Sicheres gefunden');
      }
      setTimeout(() => setFeedback(''), 2800);
    } catch {
      setProgressHint(null);
      setFeedback('Clever konnte das gerade nicht prüfen');
      setTimeout(() => setFeedback(''), 2800);
    } finally {
      setSending(false);
    }
  }

  const customerResults = lastTurn?.customerSearchResults || [];
  const historyResults = lastTurn?.historySearchResults || [];

  const reviewSlot = reviewModel
    ? (
      <div className="clever-global-composer__review">
        {Array.isArray(reviewModel.progressLines) && reviewModel.progressLines.length > 0 && (
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
            const target = resolvePrimaryNavTarget(lastTurn, reviewModel);
            if (target?.leadId) handleOpenLead(target.leadId, target);
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
          <div className="clever-global-composer__today-list">
            {customerResults.slice(0, 6).map((item) => (
              <button
                key={item.leadId || item.customerId}
                type="button"
                className="clever-global-composer__today-item"
                onClick={() => handleOpenLead(item.leadId || item.customerId)}
              >
                <strong>{item.customerName}</strong>
                <span>{item.vehicleLabel || item.card?.headline || item.matchReason}</span>
                {item.matchReasons?.[0] && (
                  <em>Grund: {item.matchReasons[0]}</em>
                )}
              </button>
            ))}
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
                onClick={() => handleOpenLead(item.leadId)}
              >
                <strong>{item.customerName}</strong>
                <span>{item.headline}</span>
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
      {progressHint && (
        <p className="clever-global-composer__hint" role="status">{progressHint}</p>
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
        placeholder="Was möchten Sie wissen oder erledigen?"
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
