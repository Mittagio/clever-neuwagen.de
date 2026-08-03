import { useMemo, useState } from 'react';
import {
  IconBranch,
  IconCopy,
  IconThumbDown,
  IconThumbUp,
} from './AkteIcons.jsx';
import './SellerUniversalReviewCard.css';

function pickPrimaryBody(model) {
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const knowledge = sections.find((s) => s.kind === 'knowledge_result');
  if (knowledge?.headline) {
    return [knowledge.title, knowledge.headline, knowledge.line].filter(Boolean).join('\n');
  }
  const knowledgeMsg = sections.find((s) => s.kind === 'knowledge_and_message_review');
  if (knowledgeMsg?.body) return String(knowledgeMsg.body).trim();
  const docsSec = sections.find((s) => s.kind === 'request_documents');
  if (docsSec?.body) return String(docsSec.body).trim();
  if (docsSec?.headline) return String(docsSec.headline).trim();
  const contractMem = sections.find((s) => s.kind === 'contract_memory_result');
  if (contractMem?.body) return String(contractMem.body).trim();
  const contractMsg = sections.find((s) => s.kind === 'contract_import_review' || s.kind === 'contract_import');
  if (contractMsg?.body) return String(contractMsg.body).trim();
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
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const groups = Array.isArray(model?.groups) ? model.groups : [];
  const body = useMemo(() => pickPrimaryBody(model), [model]);
  const metaLine = useMemo(() => pickMetaLine(model), [model]);
  const knowledgeMsg = sections.find((s) => s.kind === 'knowledge_and_message_review');
  const apptMsg = sections.find((s) => s.kind === 'appointment_and_message_review');
  const contractMsg = sections.find((s) => s.kind === 'contract_import_review');
  const contractMem = sections.find((s) => s.kind === 'contract_memory_result');
  const docsSec = sections.find((s) => s.kind === 'request_documents');
  const reviewActions = knowledgeMsg?.primaryActions
    || apptMsg?.primaryActions
    || contractMsg?.primaryActions
    || contractMem?.primaryActions
    || docsSec?.primaryActions
    || sections.find((s) => s.kind === 'offer_and_message_review')?.primaryActions
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
  const settled = Boolean(status);

  if (!model || (!groups.length && !sections.length && !body)) return null;

  const canMaybe = typeof onMaybe === 'function' || typeof onAcceptAndRevise === 'function';
  const resolvedStatusLabel = statusLabel
    || (status === 'ready_to_send'
      ? 'Bereit zum Senden'
      : status === 'sent'
        ? 'Gesendet'
        : status
          ? 'Übernommen'
          : null);

  async function handleCopy() {
    const text = body || model.summaryLine || '';
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

  return (
    <article
      className={`sur-card sur-card--cursor${settled ? ' sur-card--settled' : ''}`}
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

      {metaLine ? (
        <p className="sur-card__context">{metaLine}</p>
      ) : null}

      {body ? (
        <pre className="sur-card__draft">{body}</pre>
      ) : (
        <p className="sur-card__summary">{model.summaryLine}</p>
      )}

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

      {!settled && reviewActions.length > 0 ? (
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
        </div>
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
        {!settled ? (
          <>
            <button
              type="button"
              className="sur-card__icon-btn"
              onClick={() => onAccept?.(model)}
              title="Ja – übernehmen"
              aria-label="Ja – übernehmen"
            >
              <IconThumbUp />
            </button>
            <button
              type="button"
              className="sur-card__icon-btn"
              onClick={() => onDismiss?.(model)}
              title="Nein – verwerfen"
              aria-label="Nein – verwerfen"
            >
              <IconThumbDown />
            </button>
            {canMaybe ? (
              <button
                type="button"
                className="sur-card__icon-btn"
                onClick={handleMaybe}
                title="Vielleicht – im Composer weiterbearbeiten"
                aria-label="Vielleicht – im Composer weiterbearbeiten"
              >
                <IconBranch />
              </button>
            ) : null}
          </>
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
