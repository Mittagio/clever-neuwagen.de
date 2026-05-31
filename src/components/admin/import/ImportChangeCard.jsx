import { CHANGE_TYPE_LABELS } from '../../../data/priceListImport.js';
import './ImportChangeCard.css';

export default function ImportChangeCard({ change }) {
  const typeLabel = CHANGE_TYPE_LABELS[change.type] ?? change.type;

  return (
    <article className="import-change">
      <header className="import-change__head">
        <span className="import-change__type">{typeLabel}</span>
        <h3 className="import-change__field">{change.field}</h3>
      </header>
      <div className="import-change__compare">
        <div className="import-change__side import-change__side--old">
          <span className="import-change__label">ALT</span>
          <p className="import-change__value">{change.oldValue}</p>
        </div>
        <span className="import-change__arrow" aria-hidden>→</span>
        <div className="import-change__side import-change__side--new">
          <span className="import-change__label">NEU</span>
          <p className="import-change__value">{change.newValue}</p>
        </div>
      </div>
    </article>
  );
}
