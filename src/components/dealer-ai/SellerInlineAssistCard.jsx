import { INLINE_RESULT_TYPES } from '../../services/dealer/sellerInlineComposerAssist.js';
import './SellerInlineAssistCard.css';

/**
 * Kompakte Assist-Card über dem Seller-Composer (kein Fullscreen).
 */
export default function SellerInlineAssistCard({
  results = [],
  onInsertFact = null,
  onUseVerified = null,
  onPrepareReply = null,
  onSendDraft = null,
  onCopyDraft = null,
  onSendActions = null,
  onChoice = null,
  onPrepareOffer = null,
  onSendPortfolio = null,
  onAppointmentPrimary = null,
  onOpenSearchHit = null,
  onDismiss = null,
}) {
  if (!results?.length) return null;

  return (
    <div className="sia-stack" aria-live="polite">
      {results.map((result, index) => (
        <article
          key={`${result.type}-${result.entity || result.modelKey || result.appointment?.id || index}`}
          className={`sia-card sia-card--${result.type}`}
        >
          <header className="sia-card__head">
            <p className="sia-card__title">{result.title || 'Clever'}</p>
            {onDismiss && index === 0 ? (
              <button type="button" className="sia-card__dismiss" onClick={onDismiss} aria-label="Schließen">
                ×
              </button>
            ) : null}
          </header>

          {result.headline ? <p className="sia-card__headline">{result.headline}</p> : null}
          {result.contextLink ? (
            <p className="sia-card__context-link">{result.contextLink}</p>
          ) : null}
          {result.body ? (
            <p className="sia-card__body" style={{ whiteSpace: 'pre-line' }}>{result.body}</p>
          ) : null}
          {result.hint ? <p className="sia-card__hint">{result.hint}</p> : null}

          {result.type === INLINE_RESULT_TYPES.CONTEXT_REMINDER && result.chips?.length ? (
            <ul className="sia-card__chips">
              {result.chips.map((chip) => (
                <li key={chip.label}>
                  <span className="sia-chip">{chip.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {result.type === INLINE_RESULT_TYPES.ACTION_DRAFT && result.actions?.length ? (
            <ul className="sia-card__actions">
              {result.actions.map((action) => (
                <li key={action.id}>
                  ✓
                  {' '}
                  {action.label}
                </li>
              ))}
            </ul>
          ) : null}

          {result.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT && result.body ? (
            <pre className="sia-card__draft">{result.body}</pre>
          ) : null}

          {result.type === INLINE_RESULT_TYPES.APPOINTMENT_DRAFT && result.messageBody ? (
            <pre className="sia-card__draft">{result.messageBody}</pre>
          ) : null}

          {(result.type === INLINE_RESULT_TYPES.OFFER_DRAFT
            || result.type === INLINE_RESULT_TYPES.APPOINTMENT_DRAFT)
            && result.choices?.length ? (
              <div className="sia-card__choices" role="group" aria-label="Optionen">
                {result.choices.map((choice) => (
                  <button
                    key={choice.id || choice.label}
                    type="button"
                    className="sia-choice"
                    onClick={() => onChoice?.(choice)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : null}

          <div className="sia-card__ctas">
            {result.type === INLINE_RESULT_TYPES.FACT_SUGGESTION || result.type === INLINE_RESULT_TYPES.MISSING_FACT ? (
              <>
                {result.insertText ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--primary"
                    onClick={() => onInsertFact?.(result)}
                  >
                    {result.primaryCta || 'In Nachricht übernehmen'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="sia-btn sia-btn--ghost"
                  onClick={() => onPrepareReply?.(result)}
                >
                  {result.secondaryCta || 'Antwort vorbereiten'}
                </button>
              </>
            ) : null}

            {result.type === INLINE_RESULT_TYPES.CONFLICT_WARNING ? (
              <>
                <button
                  type="button"
                  className="sia-btn sia-btn--primary"
                  onClick={() => onUseVerified?.(result)}
                >
                  {result.primaryCta || 'Verifizierten Wert verwenden'}
                </button>
                <button
                  type="button"
                  className="sia-btn sia-btn--ghost"
                  onClick={onDismiss}
                >
                  {result.secondaryCta || 'Trotzdem bearbeiten'}
                </button>
              </>
            ) : null}

            {result.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT ? (
              <>
                <button
                  type="button"
                  className="sia-btn sia-btn--primary"
                  onClick={() => onSendDraft?.(result)}
                >
                  {result.primaryCta || 'Senden'}
                </button>
                <button
                  type="button"
                  className="sia-btn sia-btn--ghost"
                  onClick={() => onInsertFact?.({ ...result, insertText: result.body })}
                >
                  {result.secondaryCta || 'Bearbeiten'}
                </button>
                {onCopyDraft ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--ghost"
                    onClick={() => onCopyDraft?.(result)}
                  >
                    {result.copyCta || 'Kopieren'}
                  </button>
                ) : null}
              </>
            ) : null}

            {result.type === INLINE_RESULT_TYPES.ACTION_DRAFT ? (
              <button
                type="button"
                className="sia-btn sia-btn--primary"
                onClick={() => onSendActions?.(result)}
              >
                {result.primaryCta || 'Senden'}
              </button>
            ) : null}

            {result.type === INLINE_RESULT_TYPES.OFFER_DRAFT ? (
              <>
                {result.primaryCta && result.magic?.canCreateOffer ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--primary"
                    onClick={() => onPrepareOffer?.(result)}
                  >
                    {result.primaryCta}
                  </button>
                ) : null}
                {result.primaryCta && !result.magic?.canCreateOffer && result.insertText ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--primary"
                    onClick={() => onInsertFact?.(result)}
                  >
                    {result.primaryCta}
                  </button>
                ) : null}
                {result.primaryCta && !result.magic?.canCreateOffer && !result.insertText ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--primary"
                    onClick={() => onChoice?.(result.choices?.[0] || { insertText: '21 %' })}
                  >
                    {result.primaryCta}
                  </button>
                ) : null}
                {result.secondaryCta && result.insertText && result.magic?.canCreateOffer ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--ghost"
                    onClick={() => onInsertFact?.(result)}
                  >
                    {result.secondaryCta}
                  </button>
                ) : null}
              </>
            ) : null}

            {result.type === INLINE_RESULT_TYPES.PORTFOLIO_SEND ? (
              <button
                type="button"
                className="sia-btn sia-btn--primary"
                onClick={() => onSendPortfolio?.(result)}
              >
                {result.primaryCta || 'Kundenlink senden'}
              </button>
            ) : null}

            {result.type === INLINE_RESULT_TYPES.APPOINTMENT_DRAFT ? (
              <>
                {result.primaryCta ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--primary"
                    onClick={() => onAppointmentPrimary?.(result)}
                  >
                    {result.primaryCta}
                  </button>
                ) : null}
                {result.secondaryCta && result.messageBody ? (
                  <button
                    type="button"
                    className="sia-btn sia-btn--ghost"
                    onClick={() => onInsertFact?.({
                      ...result,
                      insertText: result.messageBody,
                    })}
                  >
                    {result.secondaryCta}
                  </button>
                ) : null}
              </>
            ) : null}

            {result.type === INLINE_RESULT_TYPES.SEARCH_HIT && result.primaryCta ? (
              <button
                type="button"
                className="sia-btn sia-btn--primary"
                onClick={() => onOpenSearchHit?.(result)}
              >
                {result.primaryCta}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
