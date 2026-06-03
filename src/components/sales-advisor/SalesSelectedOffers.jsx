import { getLiveChipLabels } from '../../data/salesAdvisorChips.js';
import './smartSales.css';

export default function SalesSelectedOffers({ matches = [], compareSlugs = [], onRemove }) {
  const selected = matches.filter((m) => compareSlugs.includes(m.slug));
  if (!selected.length) {
    return (
      <aside className="ss-selected ss-selected--empty">
        <h2>Ausgewählte Angebote</h2>
        <p>Fahrzeuge zum Vergleich hinzufügen</p>
      </aside>
    );
  }

  return (
    <aside className="ss-selected" aria-label="Ausgewählte Angebote">
      <h2>Ausgewählt ({selected.length})</h2>
      <ul className="ss-selected__list">
        {selected.map((m) => (
          <li key={m.slug} className="ss-selected__item">
            <span>{m.model ?? m.title}</span>
            <button type="button" onClick={() => onRemove?.(m.slug)} aria-label="Entfernen">×</button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function getWishLabelsFromChipIds(chipIds = []) {
  return getLiveChipLabels(chipIds).map((c) => c.label.replace(/^[^\s]+\s/, ''));
}
