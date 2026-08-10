import { useMemo, useState } from 'react';
import {
  IconBranch,
  IconCopy,
} from './AkteIcons.jsx';
import './SellerUniversalReviewCard.css';

const COMPACT_REVIEW_TYPES = new Set([
  'customer_contract_tradein_intake_review',
  'customer_intake_review',
  'inbound_lead_review',
  'customer_intake',
  'multi_source_apply_result',
  'offer_prepare',
  'offer_incomplete',
  'offer_and_message_review',
  'offer_and_appointment_review',
  'appointment_and_message_review',
]);

function isCompactReviewModel(model) {
  if (!model) return false;
  if (
    model.compactUi
    || model.kind === 'multi_source_intake'
    || model.kind === 'customer_intake'
  ) {
    return true;
  }
  return COMPACT_REVIEW_TYPES.has(model.reviewType) || COMPACT_REVIEW_TYPES.has(model.kind);
}

function pickPrimaryBody(model) {
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const knowledge = sections.find((s) => s.kind === 'knowledge_result');
  if (knowledge) {
    // Beratungsantwort zuerst – nicht nur Meta (Titel / Quelle)
    if (knowledge.body) return String(knowledge.body).trim();
    return [knowledge.headline, knowledge.line].filter(Boolean).join('\n');
  }
  const knowledgeMsg = sections.find((s) => s.kind === 'knowledge_and_message_review');
  if (knowledgeMsg?.body) return String(knowledgeMsg.body).trim();
  const intakeSec = sections.find((s) => (
    s.kind === 'customer_intake_review'
    || s.kind === 'inbound_lead_review'
    || s.kind === 'customer_contract_tradein_intake_review'
    || s.kind === 'multi_source_apply_result'
  ));
  // Compact Fact-Group Reviews: kein langer Body-/Bericht-Text
  if (
    isCompactReviewModel(model)
    && Array.isArray(model?.groups)
    && model.groups.length
  ) {
    return '';
  }
  if (
    intakeSec?.kind === 'customer_contract_tradein_intake_review'
    && Array.isArray(model?.groups)
    && model.groups.length
  ) {
    return '';
  }
  if (intakeSec?.body) return String(intakeSec.body).trim();
  if (model?.body && (
    model.reviewType === 'customer_intake_review'
    || model.kind === 'customer_intake'
    || model.reviewType === 'customer_contract_tradein_intake_review'
    || model.reviewType === 'multi_source_apply_result'
  )) {
    return String(model.body).trim();
  }
  const replySec = sections.find((s) => s.kind === 'customer_reply_review');
  if (replySec?.body) return String(replySec.body).trim();
  const docsSec = sections.find((s) => s.kind === 'request_documents');
  if (docsSec?.body) return String(docsSec.body).trim();
  if (docsSec?.headline) return String(docsSec.headline).trim();
  const contractMem = sections.find((s) => s.kind === 'contract_memory_result');
  if (contractMem?.body) return String(contractMem.body).trim();
  const contractMsg = sections.find((s) => s.kind === 'contract_import_review' || s.kind === 'contract_import');
  if (contractMsg?.body) return String(contractMsg.body).trim();
  // Offer/Appointment-Composites: Struktur über Groups/Hero, nicht <pre>-Bericht
  if (isCompactReviewModel(model)) return '';
  const apptMsg = sections.find((s) => s.kind === 'appointment_and_message_review');
  if (apptMsg?.body) return String(apptMsg.body).trim();
  const offerMsg = sections.find((s) => s.kind === 'offer_and_message_review');
  if (offerMsg?.body) return String(offerMsg.body).trim();
  const today = sections.find((s) => s.kind === 'today_overview');
  if (today?.items?.length) {
    return today.items.slice(0, 4).map((item) => (
      [item.customerName, item.headline, item.reasons?.[0] ? `Grund: ${item.reasons[0]}` : null]
        .filter(Boolean)
        .join('\n')
    )).join('\n\n');
  }
  const customerSearch = sections.find((s) => s.kind === 'customer_search_results');
  if (customerSearch?.results?.length) {
    if (customerSearch.results.length === 1) {
      return [
        customerSearch.headline,
        customerSearch.line,
        customerSearch.body,
      ].filter(Boolean).join('\n');
    }
    return customerSearch.results.slice(0, 4).map((r) => (
      [r.customerName, r.vehicleLabel, r.matchReason ? `Grund: ${r.matchReason}` : null]
        .filter(Boolean)
        .join('\n')
    )).join('\n\n');
  }
  const customerSummary = sections.find((s) => s.kind === 'customer_summary');
  if (customerSummary?.body) return String(customerSummary.body).trim();
  const historyResults = sections.find((s) => (
    s.kind === 'history_search_results' || s.kind === 'offer_history_result'
  ));
  if (historyResults) {
    return [
      historyResults.headline,
      historyResults.body,
      historyResults.line,
    ].filter(Boolean).join('\n');
  }
  const noResult = sections.find((s) => s.kind === 'no_search_result');
  if (noResult?.body) return String(noResult.body).trim();
  const draftSection = sections.find((s) => (
    (s.kind === 'message_draft'
      || s.kind === 'appointment_propose'
      || s.kind === 'golden_moment'
      || s.kind === 'history_search')
    && s.body
  ));
  if (draftSection?.body) return String(draftSection.body).trim();

  const lines = [];
  for (const section of sections) {
    if (section.headline) lines.push(section.headline);
    if (section.line) lines.push(section.line);
    if (section.inheritedLine) lines.push(section.inheritedLine);
    if (section.changes?.length) {
      for (const change of section.changes) {
        const value = change.from && change.to
          ? `${change.from} → ${change.to}`
          : (change.to || change.from);
        if (value) lines.push(`${change.label}: ${value}`);
      }
    }
  }
  if (lines.length) return lines.join('\n');

  const groups = Array.isArray(model?.groups) ? model.groups : [];
  if (groups.length) {
    return groups.map((g) => g.line).filter(Boolean).join('\n');
  }
  return model?.summaryLine || '';
}

function pickMetaLine(model) {
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const offer = sections.find((s) => (
    s.kind === 'offer_change' || s.kind === 'offer_prepare' || s.kind === 'track_feedback'
  ));
  if (offer?.headline) return offer.headline;
  if (offer?.line) return offer.line;
  if (model?.missingLine) return model.missingLine;
  return null;
}

function actionTone(action, index) {
  if (action?.tone === 'primary' || action?.tone === 'secondary' || action?.tone === 'compact') {
    return action.tone;
  }
  if (index === 0) return 'primary';
  if (index === 1) return 'secondary';
  return 'compact';
}

/**
 * Cursor-artige Review: eine Antwort + schmale Icon-CTAs (Ja / Nein / Vielleicht / Kopieren).
 * Settled (`status`): letzte übernommene/gesendete Aktion ohne Accept-CTAs.
 */
export default function SellerUniversalReviewCard({
  model = null,
  onAccept = null,
  onAcceptAndRevise = null,
  onMaybe = null,
  onDismiss = null,
  onOpenHistoryHit = null,
  onReviewAction = null,
  /** accepted | ready_to_send | sent – settled last-action mode */
  status = null,
  statusLabel = null,
  onOpenChat = null,
  /** Settled + ready_to_send: Nachricht jetzt senden */
  onSend = null,
}) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showCollapsedContext, setShowCollapsedContext] = useState(false);
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const groups = Array.isArray(model?.groups) ? model.groups : [];
  const body = useMemo(() => pickPrimaryBody(model), [model]);
  const metaLine = useMemo(() => pickMetaLine(model), [model]);
  const knowledgeMsg = sections.find((s) => s.kind === 'knowledge_and_message_review');
  const apptMsg = sections.find((s) => s.kind === 'appointment_and_message_review');
  const appointmentReview = model?.appointmentReview || apptMsg?.appointmentReview || null;
  const isAppointmentReview = model?.reviewType === 'appointment_and_message_review'
    || Boolean(appointmentReview);
  const collapsedContext = model?.collapsedContext || null;
  const offerMsg = sections.find((s) => s.kind === 'offer_and_message_review');
  const offerAppt = sections.find((s) => s.kind === 'offer_and_appointment_review');
  const offerPrep = sections.find((s) => (
    s.kind === 'offer_prepare' || s.kind === 'offer_incomplete'
  ));
  const offerReview = model?.offerReview || null;
  const isOfferReview = Boolean(offerReview)
    || model?.reviewType === 'offer_and_message_review'
    || model?.reviewType === 'offer_and_appointment_review'
    || model?.reviewType === 'offer_prepare'
    || model?.reviewType === 'offer_incomplete';
  const conflictBox = model?.conflictBox || offerReview?.conflict || null;
  const contractMsg = sections.find((s) => s.kind === 'contract_import_review');
  const contractMem = sections.find((s) => s.kind === 'contract_memory_result');
  const docsSec = sections.find((s) => s.kind === 'request_documents');
  const intakeSec = sections.find((s) => (
    s.kind === 'customer_intake_review'
    || s.kind === 'inbound_lead_review'
    || s.kind === 'customer_contract_tradein_intake_review'
  ));
  const applyResultSec = sections.find((s) => s.kind === 'multi_source_apply_result');
  const replySec = sections.find((s) => s.kind === 'customer_reply_review');
  const reviewActions = knowledgeMsg?.primaryActions
    || offerAppt?.primaryActions
    || offerMsg?.primaryActions
    || apptMsg?.primaryActions
    || offerPrep?.primaryActions
    || contractMsg?.primaryActions
    || contractMem?.primaryActions
    || sections.find((s) => s.kind === 'contract_offer_compare_result')?.primaryActions
    || docsSec?.primaryActions
    || sections.find((s) => s.kind === 'today_overview')?.primaryActions
    || sections.find((s) => s.kind === 'golden_moment')?.primaryActions
    || applyResultSec?.primaryActions
    || intakeSec?.primaryActions
    || replySec?.primaryActions
    || [];
  const secondaryReviewActions = applyResultSec?.secondaryActions
    || intakeSec?.secondaryActions
    || replySec?.secondaryActions
    || offerAppt?.secondaryActions
    || offerMsg?.secondaryActions
    || apptMsg?.secondaryActions
    || offerPrep?.secondaryActions
    || [];
  const sources = knowledgeMsg?.sources
    || contractMsg?.evidence
    || contractMem?.evidence
    || model?.sources
    || [];
  const historyHit = sections.find((s) => (
    (s.kind === 'history_search'
      || s.kind === 'history_search_results'
      || s.kind === 'offer_history_result')
    && s.hit
  ))?.hit;
  const isApplyResult = model.reviewType === 'multi_source_apply_result'
    || model.kind === 'multi_source_apply_result';
  const isCompactReview = isCompactReviewModel(model);
  const settled = Boolean(status) || isApplyResult;
  const showFactGroups = !isAppointmentReview && !isOfferReview && groups.length > 0 && (
    isCompactReview
    || isApplyResult
  );
  const hero = model?.hero || null;
  const heroName = isAppointmentReview
    ? (appointmentReview?.whenLine || hero?.name || null)
    : isOfferReview
      ? (offerReview?.heroLine || hero?.name || null)
      : (hero?.name
        || groups.find((g) => g.id === 'customer')?.line
        || null);
  const statusLines = (isAppointmentReview || isOfferReview)
    ? []
    : (Array.isArray(model?.progressLines)
      ? model.progressLines.slice(0, 2)
      : []);
  const collapsedGroups = (Array.isArray(collapsedContext?.groups)
    ? collapsedContext.groups
    : []
  ).filter((group) => (
    (Array.isArray(group.items) && group.items.length > 0)
    || (Array.isArray(group.chips) && group.chips.length > 0)
    || Boolean(String(group.line || '').trim())
  ));
  const hasCollapsedFacts = collapsedGroups.length > 0;

  if (!model || (!groups.length && !sections.length && !body)) return null;

  const resolvedStatusLabel = statusLabel
    || (isApplyResult
      ? (model.partialFailure ? 'Teilweise' : 'Angelegt')
      : status === 'ready_to_send'
        ? 'Bereit zum Senden'
        : status === 'sent'
          ? 'Gesendet'
          : status
            ? 'Übernommen'
            : null);

  async function handleCopy() {
    const text = body
      || model.summaryLine
      || groups.map((g) => g.line).filter(Boolean).join('\n')
      || '';
    if (!text) return;
    try {
      await navigator.clipboard?.writeText?.(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function handleMaybe() {
    if (typeof onMaybe === 'function') {
      onMaybe(model);
      return;
    }
    onAcceptAndRevise?.(model);
  }

  function handleReviewAction(action) {
    if (!action) return;
    if (action.action === 'view_sources') {
      setShowSources((v) => !v);
      return;
    }
    if (action.action === 'toggle_context') {
      setShowCollapsedContext((v) => !v);
      return;
    }
    if (action?.disabled) return;
    if (typeof onReviewAction === 'function') {
      onReviewAction(action, model);
      return;
    }
    if (action.action === 'discard') {
      onDismiss?.(model);
      return;
    }
    onAccept?.(model, action);
  }

  const primaryBtnActions = [];
  const compactFromPrimary = [];
  if (isCompactReview) {
    reviewActions.forEach((action, index) => {
      if (actionTone(action, index) === 'compact') compactFromPrimary.push(action);
      else primaryBtnActions.push(action);
    });
  }
  const compactBtnActions = isCompactReview
    ? [...compactFromPrimary, ...secondaryReviewActions]
      .filter((action) => (
        // Appointment hat eigenen Kontext-Toggle; Offer zeigt „Erkannte Angaben“ als Link
        isOfferReview || action?.action !== 'toggle_context'
      ))
    : [];

  return (
    <article
      className={`sur-card sur-card--cursor${settled ? ' sur-card--settled' : ''}${isCompactReview ? ' sur-card--multi' : ''}`}
      aria-live="polite"
    >
      <header className="sur-card__meta">
        <span className="sur-card__when">{settled ? 'zuletzt' : 'gerade eben'}</span>
        {model.title ? (
          <span className="sur-card__eyebrow">{model.title.replace(/^✨\s*/, '')}</span>
        ) : null}
        {resolvedStatusLabel ? (
          <span className="sur-card__status" data-status={status || 'accepted'}>
            {resolvedStatusLabel}
          </span>
        ) : null}
      </header>

      {isCompactReview && (heroName || hero?.eyebrow) ? (
        <div className="sur-card__hero">
          {hero?.eyebrow ? (
            <span className="sur-card__hero-eyebrow">{hero.eyebrow}</span>
          ) : null}
          <h3 className="sur-card__hero-name">
            {isAppointmentReview
              ? (appointmentReview?.whenLine || heroName || 'Terminvorschlag')
              : isOfferReview
                ? (offerReview?.heroLine || heroName || 'Angebot')
                : (heroName || 'Neuer Kunde')}
          </h3>
          {isAppointmentReview ? (
            <div className="sur-card__appt-meta">
              {appointmentReview?.appointmentTypeLabel ? (
                <p className="sur-card__hero-sub">{appointmentReview.appointmentTypeLabel}</p>
              ) : null}
              {appointmentReview?.vehicleLabel ? (
                <p className="sur-card__hero-sub">{appointmentReview.vehicleLabel}</p>
              ) : null}
              {appointmentReview?.calendarLabel ? (
                <p className="sur-card__status-line">{appointmentReview.calendarLabel}</p>
              ) : null}
            </div>
          ) : isOfferReview ? (
            (offerReview?.conditionsLine || hero?.subtitle) ? (
              <p className="sur-card__hero-sub">
                {offerReview?.conditionsLine || hero.subtitle}
              </p>
            ) : null
          ) : hero?.subtitle ? (
            <p className="sur-card__hero-sub">{hero.subtitle}</p>
          ) : null}
        </div>
      ) : null}

      {isCompactReview && !isAppointmentReview && !isOfferReview && statusLines.length > 0 ? (
        <p className="sur-card__status-line" aria-label="Clever Status">
          {statusLines.join(' · ')}
        </p>
      ) : null}

      {!isCompactReview && metaLine ? (
        <p className="sur-card__context">{metaLine}</p>
      ) : null}

      {conflictBox ? (
        <div className="sur-card__check" role="status">
          <p className="sur-card__check-title">⚠ {conflictBox.title}</p>
          {conflictBox.body ? (
            <p className="sur-card__check-body">{conflictBox.body}</p>
          ) : null}
          {conflictBox.action?.label ? (
            <button
              type="button"
              className="sur-card__btn sur-card__btn--secondary sur-card__check-btn"
              onClick={() => handleReviewAction(conflictBox.action)}
            >
              {conflictBox.action.label}
            </button>
          ) : null}
        </div>
      ) : (Array.isArray(model?.warnings) && model.warnings.length > 0 ? (
        <ul className="sur-card__warnings" aria-label="Hinweise">
          {model.warnings.slice(0, 3).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null)}

      {isAppointmentReview && appointmentReview?.message ? (
        <div className="sur-card__message-block">
          <span className="sur-card__fact-title">Nachricht</span>
          <pre className="sur-card__draft">{`„${appointmentReview.message}“`}</pre>
        </div>
      ) : null}

      {showFactGroups ? (
        <ul className={`sur-card__facts${isCompactReview ? ' sur-card__facts--compact' : ''}`} aria-label="Erkannte Angaben">
          {groups
            .filter((group) => {
              const hasContent = (
                (Array.isArray(group.items) && group.items.length > 0)
                || (Array.isArray(group.chips) && group.chips.length > 0)
                || Boolean(String(group.line || '').trim())
              );
              if (!hasContent) return false;
              return !(isCompactReview && group.id === 'customer' && heroName);
            })
            .map((group) => {
              const chips = Array.isArray(group.chips) && group.chips.length
                ? group.chips
                : null;
              const showItemList = !isCompactReview
                && Array.isArray(group.items)
                && group.items.length > 1
                && !chips;
              return (
                <li key={group.id || group.title} className="sur-card__fact">
                  <span className="sur-card__fact-title">{group.title}</span>
                  {isCompactReview && chips ? (
                    <span className="sur-card__chips">
                      {chips.map((chip) => (
                        <span key={`${group.id}-${chip}`} className="sur-card__chip">{chip}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="sur-card__fact-line">{group.line}</span>
                  )}
                  {showItemList ? (
                    <ul className="sur-card__fact-items">
                      {group.items.map((item) => (
                        <li
                          key={`${group.id}-${item.label}`}
                          className={item.tone === 'open' ? 'sur-card__fact-item--open' : undefined}
                        >
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
        </ul>
      ) : (!isAppointmentReview && body) ? (
        <pre className="sur-card__draft">{body}</pre>
      ) : (!isAppointmentReview ? (
        <p className="sur-card__summary">{model.summaryLine}</p>
      ) : null)}

      {isAppointmentReview && appointmentReview?.usedContextSummary ? (
        <div className="sur-card__used-context">
          <p className="sur-card__used-context-line">
            Verwendeter Kontext: {appointmentReview.usedContextSummary}
          </p>
          <button
            type="button"
            className="sur-card__text-link"
            onClick={() => setShowCollapsedContext((v) => !v)}
          >
            {showCollapsedContext ? 'Kontext ausblenden' : 'Kontext anzeigen'}
          </button>
        </div>
      ) : null}

      {showSources && sources.length > 0 ? (
        <ul className="sur-card__sources" aria-label="Quellen">
          {sources.map((src) => (
            <li key={src.id || src.label}>
              <strong>{src.label}</strong>
              {' → '}
              Quelle: {src.source === 'seller_input' ? 'Verkäuferangabe' : (src.source || 'verifiziert')}
            </li>
          ))}
        </ul>
      ) : null}

      {((!settled || isApplyResult) && (reviewActions.length > 0 || secondaryReviewActions.length > 0)) ? (
        isCompactReview ? (
          <div className="sur-card__actions" role="group" aria-label="Review-Aktionen">
            <div className="sur-card__actions-main">
              {primaryBtnActions.map((action, index) => {
                const tone = actionTone(action, index);
                return (
                  <button
                    key={action.id || action.label}
                    type="button"
                    className={`sur-card__btn sur-card__btn--${tone}${action.disabled ? ' is-disabled' : ''}`}
                    disabled={Boolean(action.disabled)}
                    onClick={() => handleReviewAction(action)}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
            {compactBtnActions.length > 0 ? (
              <div className="sur-card__actions-more">
                {compactBtnActions.map((action) => {
                  const label = action.action === 'toggle_context'
                    ? (showCollapsedContext
                      ? (isOfferReview ? 'Erkannte Angaben ausblenden' : 'Kontext ausblenden')
                      : (isOfferReview ? 'Erkannte Angaben anzeigen' : (action.label || 'Kontext anzeigen')))
                    : action.label;
                  return (
                    <button
                      key={action.id || action.label}
                      type="button"
                      className="sur-card__text-link"
                      onClick={() => handleReviewAction(action)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="sur-card__text-actions" role="group" aria-label="Review-Aktionen">
            {reviewActions.map((action) => (
              <button
                key={action.id || action.label}
                type="button"
                className="sur-card__text-link"
                onClick={() => handleReviewAction(action)}
              >
                {action.label}
              </button>
            ))}
            {secondaryReviewActions.map((action) => (
              <button
                key={action.id || action.label}
                type="button"
                className="sur-card__text-link"
                onClick={() => handleReviewAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )
      ) : null}

      {showCollapsedContext && collapsedGroups.length ? (
        <ul className="sur-card__facts sur-card__facts--compact" aria-label="Erkannte Angaben">
          {collapsedGroups.map((group) => (
            <li key={group.id || group.title} className="sur-card__fact">
              <span className="sur-card__fact-title">{group.title}</span>
              {Array.isArray(group.chips) && group.chips.length ? (
                <span className="sur-card__chips sur-card__chips--always">
                  {group.chips.map((chip) => (
                    <span key={`${group.id}-${chip}`} className="sur-card__chip">{chip}</span>
                  ))}
                </span>
              ) : (
                <span className="sur-card__fact-line">{group.line}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {isOfferReview && hasCollapsedFacts
        && !compactBtnActions.some((a) => a.action === 'toggle_context') ? (
        <button
          type="button"
          className="sur-card__text-link"
          onClick={() => setShowCollapsedContext((v) => !v)}
        >
          {showCollapsedContext ? 'Erkannte Angaben ausblenden' : 'Erkannte Angaben anzeigen'}
        </button>
      ) : null}

      {historyHit && onOpenHistoryHit ? (
        <button
          type="button"
          className="sur-card__text-link"
          onClick={() => onOpenHistoryHit(historyHit)}
        >
          Im Verlauf öffnen
        </button>
      ) : null}

      {settled && onOpenChat ? (
        <button
          type="button"
          className="sur-card__text-link"
          onClick={() => onOpenChat()}
        >
          Im Chat ansehen
        </button>
      ) : null}

      {settled && status === 'ready_to_send' && typeof onSend === 'function' && body ? (
        <button
          type="button"
          className="sur-card__send"
          onClick={() => onSend(body)}
        >
          Jetzt senden
        </button>
      ) : null}

      <div className="sur-card__toolbar" role="group" aria-label="Clever Aktionen">
        {!settled && typeof onMaybe === 'function' ? (
          <button
            type="button"
            className="sur-card__icon-btn"
            onClick={handleMaybe}
            title="Im Composer weiterarbeiten"
            aria-label="Im Composer weiterarbeiten"
          >
            <IconBranch />
          </button>
        ) : null}
        {!settled && !reviewActions.length && typeof onAccept === 'function' ? (
          <button
            type="button"
            className="sur-card__text-link sur-card__toolbar-accept"
            onClick={() => onAccept?.(model)}
          >
            Übernehmen
          </button>
        ) : null}
        <button
          type="button"
          className="sur-card__icon-btn"
          onClick={handleCopy}
          title={copied ? 'Kopiert' : 'Kopieren'}
          aria-label={copied ? 'Kopiert' : 'Kopieren'}
        >
          <IconCopy />
        </button>
        {settled && onDismiss ? (
          <button
            type="button"
            className="sur-card__icon-btn sur-card__icon-btn--dismiss"
            onClick={() => onDismiss?.(model)}
            title="Ausblenden"
            aria-label="Ausblenden"
          >
            ×
          </button>
        ) : null}
        {copied ? <span className="sur-card__copied">Kopiert</span> : null}
      </div>
    </article>
  );
}
