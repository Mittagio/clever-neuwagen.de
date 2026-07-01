import {
  buildKundenwissenOverview,
  countKundenwissenItems,
} from '../../services/kundenwissenCategories.js';
import './CustomerAkte.css';

/**
 * Kundenwissen – kompakte Kategorien im Profilkopf (keine Detail-Chips).
 */
export default function CustomerAkteKundenhelfer({
  notes = '',
  chipCategories = {},
  conversationNotes = [],
  lead = null,
  onOpenSheet,
  variant = 'profile',
}) {
  const categories = buildKundenwissenOverview(notes, lead, chipCategories);
  const totalCount = countKundenwissenItems(notes, lead, chipCategories);

  if (variant !== 'profile') {
    return null;
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
    <div className="cust-akte-kw" aria-label="Kundenwissen">
      <p className="cust-akte-kw__title">Kundenwissen</p>
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
