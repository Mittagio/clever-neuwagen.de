import { useMemo, useState } from 'react';
import { buildCustomerAkteApplicationDocumentsCardModel } from '../../services/crm/customerPortalShellPresenter.js';
import './CustomerAkte.css';

export default function CustomerAkteApplicationDocumentsCard({
  lead = null,
  onOpenSelfDisclosureReview,
  onOpenUnterlagen,
}) {
  const [showMore, setShowMore] = useState(false);

  const model = useMemo(
    () => buildCustomerAkteApplicationDocumentsCardModel(lead),
    [lead],
  );

  if (!model.visible) return null;

  function handleAction(action) {
    const handler = action?.handlerType ?? action?.id;
    if (handler === 'self_disclosure_review' || action?.id === 'self_disclosure_review') {
      onOpenSelfDisclosureReview?.();
      return;
    }
    if (handler === 'unterlagen' || action?.id === 'open_unterlagen' || action?.id === 'create_upload_link') {
      onOpenUnterlagen?.();
    }
  }

  return (
    <section className="cust-akte-application-docs" aria-label="Antrag und Unterlagen">
      <header className="cust-akte-application-docs__head">
        <h3 className="cust-akte-application-docs__title">{model.title}</h3>
        {model.subline ? (
          <p className="cust-akte-application-docs__subline">{model.subline}</p>
        ) : null}
      </header>

      <dl className="cust-akte-application-docs__rows">
        <div className="cust-akte-application-docs__row">
          <dt>Selbstauskunft</dt>
          <dd>{model.selfDisclosureLabel}</dd>
        </div>
        <div className="cust-akte-application-docs__row">
          <dt>Nachweise</dt>
          <dd>{model.evidenceSummaryLine}</dd>
        </div>
        {model.lastActivityLabel ? (
          <div className="cust-akte-application-docs__row">
            <dt>Letzte Aktivität</dt>
            <dd>{model.lastActivityLabel}</dd>
          </div>
        ) : null}
      </dl>

      {model.actions.length > 0 ? (
        <div className="cust-akte-application-docs__actions">
          {model.actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              className={`cust-akte-application-docs__btn${index === 0 ? ' cust-akte-application-docs__btn--primary' : ''}`}
              onClick={() => handleAction(action)}
            >
              {action.label}
            </button>
          ))}
          {model.moreActions.length > 0 ? (
            <button
              type="button"
              className="cust-akte-application-docs__more"
              onClick={() => setShowMore((value) => !value)}
              aria-expanded={showMore}
            >
              {showMore ? 'Weniger' : 'Mehr'}
            </button>
          ) : null}
        </div>
      ) : null}

      {showMore && model.moreActions.length > 0 ? (
        <div className="cust-akte-application-docs__more-actions">
          {model.moreActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="cust-akte-application-docs__btn cust-akte-application-docs__btn--ghost"
              onClick={() => handleAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
