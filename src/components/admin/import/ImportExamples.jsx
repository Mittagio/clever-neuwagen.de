import { PRICE_LIST_EXAMPLES } from '../../../data/priceListTemplates.js';
import './ImportExamples.css';

export default function ImportExamples({ onSelectExample }) {
  return (
    <div className="import-examples">
      <h3 className="import-examples__title">Beispiel-Preislisten</h3>
      <p className="import-examples__desc">
        KI erkennt Modelle, Preise, Pakete, Farben, WLTP und Reichweiten – unabhängig vom Format.
      </p>
      <ul className="import-examples__list">
        {PRICE_LIST_EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              className="import-examples__card"
              onClick={() => onSelectExample?.(ex)}
            >
              <span className="import-examples__format">{ex.format}</span>
              <strong>{ex.brand} {ex.model}</strong>
              <span className="import-examples__file">{ex.fileName}</span>
              <span className="import-examples__hint">{ex.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
