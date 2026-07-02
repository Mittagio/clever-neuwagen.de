export default function CustomerPortalAdvisorSection({
  advisor = null,
  onWriteMessage,
}) {
  if (!advisor?.visible) {
    return (
      <section className="cop-panel" aria-label="Ihr Ansprechpartner">
        <header className="cop-panel__header">
          <h2 className="cop-panel__title">Ihr Ansprechpartner</h2>
          <p className="cop-panel__subline">
            Ihr Autohaus meldet sich persönlich bei Ihnen.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="cop-panel" aria-label="Ihr Ansprechpartner">
      <header className="cop-panel__header">
        <h2 className="cop-panel__title">{advisor.title}</h2>
      </header>

      <div className="cop-advisor-card">
        {advisor.initials ? (
          <div className="cop-advisor-card__avatar" aria-hidden="true">
            {advisor.initials}
          </div>
        ) : null}

        <div className="cop-advisor-card__body">
          {advisor.name ? (
            <p className="cop-advisor__name">{advisor.name}</p>
          ) : null}
          {advisor.roleLabel ? (
            <p className="cop-advisor__role">{advisor.roleLabel}</p>
          ) : null}
          {advisor.dealerLabel ? (
            <p className="cop-advisor__dealer">{advisor.dealerLabel}</p>
          ) : null}
        </div>
      </div>

      {(advisor.phone || advisor.email) ? (
        <div className="cop-advisor__contacts">
          {advisor.phone ? (
            <a className="cop-advisor__link" href={`tel:${advisor.phone.replace(/\s/g, '')}`}>
              {advisor.phone}
            </a>
          ) : null}
          {advisor.email ? (
            <a className="cop-advisor__link" href={`mailto:${advisor.email}`}>
              {advisor.email}
            </a>
          ) : null}
        </div>
      ) : null}

      {advisor.responseHint ? (
        <p className="cop-advisor__hint">{advisor.responseHint}</p>
      ) : null}

      <div className="cop-advisor__actions">
        {advisor.showCallAction && advisor.phone ? (
          <a
            className="cop-btn cop-btn--secondary"
            href={`tel:${advisor.phone.replace(/\s/g, '')}`}
          >
            Anrufen
          </a>
        ) : null}
        {advisor.showEmailAction && advisor.email ? (
          <a
            className="cop-btn cop-btn--secondary"
            href={`mailto:${advisor.email}`}
          >
            E-Mail schreiben
          </a>
        ) : null}
        {advisor.showMessageAction ? (
          <button
            type="button"
            className="cop-btn cop-btn--primary"
            onClick={onWriteMessage}
          >
            Nachricht schreiben
          </button>
        ) : null}
      </div>
    </section>
  );
}
