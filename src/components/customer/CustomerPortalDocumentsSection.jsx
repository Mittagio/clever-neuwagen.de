export default function CustomerPortalDocumentsSection({ documents = null }) {
  if (!documents) return null;

  return (
    <section className="cop-panel" aria-label="Ihre Unterlagen">
      <header className="cop-panel__header">
        <h2 className="cop-panel__title">Ihre Unterlagen</h2>
        <p className="cop-panel__subline">{documents.subline}</p>
      </header>

      {documents.slots?.length > 0 ? (
        <ul className="cop-docs-list">
          {documents.slots.map((slot) => (
            <li
              key={slot.id}
              className={`cop-docs-list__item${slot.done ? ' is-done' : ''}`}
            >
              <span className="cop-docs-list__icon" aria-hidden="true">
                {slot.done ? '✓' : '○'}
              </span>
              <span className="cop-docs-list__label">{slot.label}</span>
              <span className="cop-docs-list__status">{slot.statusLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cop-panel__empty">
          Noch keine Unterlagen angefordert.
        </p>
      )}

      {documents.hasUploadLink && documents.uploadUrl ? (
        <a
          className="cop-btn cop-btn--primary cop-panel__cta"
          href={documents.uploadUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Unterlagen hochladen
        </a>
      ) : (
        <p className="cop-panel__hint">
          Ihr Verkäufer sendet Ihnen den Upload-Link, sobald Unterlagen benötigt werden.
        </p>
      )}
    </section>
  );
}
