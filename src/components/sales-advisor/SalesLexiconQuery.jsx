import { useMemo, useState } from 'react';
import { getMarketplaceVehiclePool } from '../../data/marketplacePool.js';
import { answerVehicleLexiconQuery } from '../../services/lexicon/vehicleLexiconService.js';
import DealerLexiconPanel from '../dealer/DealerLexiconPanel.jsx';
import './smartSales.css';

const EXAMPLES = [
  'Fahrzeug mit meiste Reichweite',
  'Kofferraum mindestens 500 Liter',
  'Garage Höhe 2 Meter',
  '7-Sitzer mit 3 Isofix',
];

/**
 * Freitext-Lexikon für Verkäufer – Kundenfrage → Fakten aus Kia-Datenbank.
 */
export default function SalesLexiconQuery({ dealerSlug = '' }) {
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [answer, setAnswer] = useState(null);

  const vehiclePool = useMemo(() => {
    const pool = getMarketplaceVehiclePool();
    if (!dealerSlug) return pool;
    return pool.filter((v) => (v.dealerSlug ?? dealerSlug) === dealerSlug);
  }, [dealerSlug]);

  function runQuery(text) {
    const value = text.trim();
    if (!value) return;
    setSubmitted(value);
    setAnswer(answerVehicleLexiconQuery(value, vehiclePool));
  }

  function handleSubmit(event) {
    event.preventDefault();
    runQuery(draft);
  }

  return (
    <section className="ss-lexicon" aria-labelledby="ss-lexicon-title">
      <header className="ss-lexicon__head">
        <h2 id="ss-lexicon-title" className="ss-lexicon__title">Fahrzeug-Lexikon</h2>
        <p className="ss-lexicon__lead">
          Nur für Sie als Berater: Kundenfrage eingeben – Clever antwortet mit Kia-Stammdaten (Maße, Kofferraum, Reichweite …).
        </p>
      </header>

      <form className="ss-lexicon__form" onSubmit={handleSubmit}>
        <input
          type="search"
          className="ss-lexicon__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="z. B. Kofferraum über 500 Liter"
          aria-label="Kundenfrage für das Fahrzeug-Lexikon"
        />
        <button type="submit" className="ss-btn ss-btn--secondary" disabled={!draft.trim()}>
          Prüfen
        </button>
      </form>

      <div className="ss-lexicon__examples" role="list" aria-label="Beispielfragen">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="ss-lexicon__example"
            onClick={() => {
              setDraft(example);
              runQuery(example);
            }}
          >
            {example}
          </button>
        ))}
      </div>

      {answer && (
        <DealerLexiconPanel
          answer={answer}
          query={submitted}
          compact
          className="ss-lexicon__panel"
        />
      )}
    </section>
  );
}
