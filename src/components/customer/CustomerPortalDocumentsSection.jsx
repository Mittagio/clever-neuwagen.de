function EvidenceGroup({ title, items = [] }) {
  if (!items.length) return null;

  return (
    <div className="cop-docs-area__group">
      <h4 className="cop-docs-area__group-title">{title}</h4>
      <ul className="cop-docs-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`cop-docs-list__item cop-docs-list__item--${item.group}`}
          >
            <span className="cop-docs-list__icon" aria-hidden="true">{item.icon}</span>
            <span className="cop-docs-list__label">{item.label}</span>
            {item.group === 'checked' ? (
              <span className="cop-docs-list__status">{item.statusLabel}</span>
            ) : item.group !== 'open' ? (
              <span className="cop-docs-list__status">{item.statusLabel}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CustomerPortalDocumentsSection({
  documents = null,
  selfDisclosureHref = null,
}) {
  if (!documents) return null;

  const area = documents.documentsArea ?? null;
  if (!area) return null;

  const sd = {
    ...area.selfDisclosureCard,
    href: selfDisclosureHref,
  };
  const upload = area.uploadAction ?? {};
  const groups = area.evidence?.groups ?? {};

  return (
    <section className="cop-panel cop-docs-area" aria-label="Ihre Unterlagen">
      <header className="cop-panel__header">
        <h2 className="cop-panel__title">{area.headline}</h2>
        <p className="cop-panel__subline">{area.subline}</p>
        {area.summaryLabel ? (
          <p className="cop-docs-area__summary" role="status">{area.summaryLabel}</p>
        ) : null}
      </header>

      <section className="cop-docs-area__section" aria-label="Digital ausfüllen">
        <h3 className="cop-docs-area__section-title">Digital ausfüllen</h3>
        <article className="cop-sd-card" aria-label="Selbstauskunft">
          <div className="cop-sd-card__head">
            <h4 className="cop-sd-card__title">Selbstauskunft</h4>
            <span className="cop-sd-card__status">{sd.statusLabel}</span>
          </div>
          {sd.typeLabel ? (
            <p className="cop-sd-card__type">{sd.typeLabel}</p>
          ) : null}
          {sd.showTypePicker ? (
            <p className="cop-sd-card__hint">
              Welche Selbstauskunft möchten Sie ausfüllen?
            </p>
          ) : null}
          {sd.lastSavedLabel ? (
            <p className="cop-sd-card__saved">
              Zuletzt gespeichert:
              {' '}
              {sd.lastSavedLabel}
            </p>
          ) : null}
          {sd.href ? (
            <a className="cop-btn cop-btn--primary cop-sd-card__cta" href={sd.href}>
              {sd.actionLabel}
            </a>
          ) : null}
        </article>
      </section>

      <section className="cop-docs-area__section" aria-label="Nachweise hochladen">
        <h3 className="cop-docs-area__section-title">Nachweise hochladen</h3>

        {groups.open?.length || groups.uploaded?.length || groups.checked?.length ? (
          <>
            <EvidenceGroup title="Noch benötigt" items={groups.open} />
            <EvidenceGroup title="Hochgeladen" items={groups.uploaded} />
            <EvidenceGroup title="Geprüft" items={groups.checked} />
          </>
        ) : (
          <p className="cop-panel__empty">
            Noch keine Nachweise angefordert.
          </p>
        )}

        {area.recommendedEvidence?.length > 0 ? (
          <div className="cop-docs-area__recommended">
            <p className="cop-docs-area__recommended-title">Typische Nachweise</p>
            <ul className="cop-docs-area__recommended-list">
              {area.recommendedEvidence.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {upload.visible && upload.url ? (
          <a
            className={`cop-btn cop-btn--${upload.variant === 'secondary' ? 'secondary' : 'primary'} cop-panel__cta`}
            href={upload.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {upload.label}
          </a>
        ) : null}

        {upload.hint ? (
          <p className="cop-panel__hint">{upload.hint}</p>
        ) : null}
      </section>
    </section>
  );
}
