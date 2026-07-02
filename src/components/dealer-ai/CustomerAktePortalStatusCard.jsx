import { useMemo, useState } from 'react';
import { buildCustomerPortalStatusCardModel } from '../../services/crm/customerPortalAccessService.js';
import './CustomerAkte.css';

export default function CustomerAktePortalStatusCard({
  lead = null,
  hasOpenInboxMessage = false,
  onCopyLink,
  onPrepareEmail,
  onWriteMessage,
  onPrepareFollowup,
  onReply,
  onOpenInbox,
}) {
  const [showMore, setShowMore] = useState(false);

  const model = useMemo(
    () => buildCustomerPortalStatusCardModel(lead, { hasOpenInboxMessage }),
    [lead, hasOpenInboxMessage],
  );

  if (!model.visible) return null;

  function handleAction(actionId) {
    switch (actionId) {
      case 'copy':
        onCopyLink?.(model.portfolioUrl);
        break;
      case 'email':
        onPrepareEmail?.();
        break;
      case 'message':
        onWriteMessage?.();
        break;
      case 'followup':
        onPrepareFollowup?.();
        break;
      case 'reply':
        onReply?.();
        break;
      case 'inbox':
        onOpenInbox?.();
        break;
      default:
        break;
    }
  }

  return (
    <section className="cust-akte-portal-status" aria-label="Kundenportal">
      <header className="cust-akte-portal-status__head">
        <h3 className="cust-akte-portal-status__title">{model.title}</h3>
        <p className="cust-akte-portal-status__subline">{model.subline}</p>
        {model.advisorLabel ? (
          <p className="cust-akte-portal-status__advisor">
            Ansprechpartner:
            {' '}
            {model.advisorLabel}
          </p>
        ) : null}
      </header>

      <ol className="cust-akte-portal-status__steps">
        {model.steps.map((step) => (
          <li
            key={step.id}
            className={`cust-akte-portal-status__step${step.reached ? ' is-reached' : ''}`}
          >
            <span className="cust-akte-portal-status__step-icon" aria-hidden="true">
              {step.reached ? '✓' : '○'}
            </span>
            <span className="cust-akte-portal-status__step-label">{step.label}</span>
          </li>
        ))}
      </ol>

      {model.lastActivityLabel ? (
        <p className="cust-akte-portal-status__activity">
          Letzte Aktivität:
          {' '}
          {model.lastActivityLabel}
        </p>
      ) : null}

      {model.actions.length > 0 ? (
        <div className="cust-akte-portal-status__actions">
          {model.actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              className={`cust-akte-portal-status__btn${index === 0 ? ' cust-akte-portal-status__btn--primary' : ''}`}
              onClick={() => handleAction(action.id)}
            >
              {action.label}
            </button>
          ))}
          {model.moreActions.length > 0 ? (
            <button
              type="button"
              className="cust-akte-portal-status__more"
              onClick={() => setShowMore((value) => !value)}
              aria-expanded={showMore}
            >
              {showMore ? 'Weniger' : 'Mehr'}
            </button>
          ) : null}
        </div>
      ) : null}

      {showMore && model.moreActions.length > 0 ? (
        <div className="cust-akte-portal-status__more-actions">
          {model.moreActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="cust-akte-portal-status__btn cust-akte-portal-status__btn--ghost"
              onClick={() => handleAction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
