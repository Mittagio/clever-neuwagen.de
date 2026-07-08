import {
  buildKundenwissenOverview,
  countKundenwissenItems,
} from '../../services/kundenwissenCategories.js';
import './CustomerAkte.css';

/**
 * Kundenwissen – kompakte Kategorien im Profilkopf (keine Detail-Chips).
 * Bei vorhandenem Customer Understanding: reduzierter Werkzeug-Einstieg.
 */
export default function CustomerAkteKundenhelfer({
  notes = '',
  chipCategories = {},
  conversationNotes = [],
  voiceMemos = [],
  lead = null,
  onOpenSheet,
  variant = 'profile',
  subdued = false,
  hasCustomerUnderstanding = false,
}) {
  const categories = buildKundenwissenOverview(notes, lead, chipCategories);
  const totalCount = countKundenwissenItems(notes, lead, chipCategories);
  const conversationCount = conversationNotes?.length ?? 0;
  const memoCount = voiceMemos?.length ?? 0;

  if (variant !== 'profile') {
    return null;
  }

  if (hasCustomerUnderstanding) {
    return (
      <div className="cust-akte-kw cust-akte-kw--tool" aria-label="Verkaufsnotizen">
        <div className="cust-akte-kw__tool-lines">
          <button
            type="button"
            className="cust-akte-kw__tool-line"
            onClick={() => onOpenSheet?.()}
          >
            Verkaufsnotizen (
            {conversationCount}
            )
          </button>
          <button
            type="button"
            className="cust-akte-kw__tool-line"
            onClick={() => onOpenSheet?.()}
          >
            Sprachmemos (
            {memoCount}
            )
          </button>
        </div>
        <button
          type="button"
          className="cust-akte-kw__tool-open"
          onClick={() => onOpenSheet?.()}
        >
          Öffnen
        </button>
      </div>
    );
  }

  if (!totalCount) {
    return (
      <div className="cust-akte-kw cust-akte-kw--empty" aria-label="Kundenwissen">
        <button type="button" className="cust-akte-kw__add" onClick={() => onOpenSheet?.()}>
          + Info hinzufügen
        </button>
      </div>
    );
  }

  return (
    <div className={`cust-akte-kw${subdued ? ' cust-akte-kw--subdued' : ''}`} aria-label="Kundenwissen">
      <p className="cust-akte-kw__title">{subdued ? 'Ihre Notizen' : 'Kundenwissen'}</p>
      <div className="cust-akte-kw__grid">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="cust-akte-kw__cat"
            onClick={() => onOpenSheet?.(category.id)}
          >
            <span className="cust-akte-kw__cat-icon" aria-hidden>{category.icon}</span>
            <span className="cust-akte-kw__cat-label">
              {category.label}
              {' '}
              {category.count}
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="cust-akte-kw__add" onClick={() => onOpenSheet?.()}>
        + Info hinzufügen
      </button>
    </div>
  );
}
