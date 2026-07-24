import { useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import './MagicOfferEntry.css';

/**
 * Primärer Einstieg: Magic · PDF · Manuell (Legacy-Kalkulator).
 */
export default function MagicOfferEntry({
  modelLabel = 'Fahrzeug',
  wishLine = null,
  onPrepare,
  onUploadPdf,
  onManual,
  onBack,
  isWorking = false,
  initialText = '',
}) {
  const [text, setText] = useState(initialText);

  function handlePrepare() {
    if (!text.trim() || isWorking) return;
    onPrepare?.(text.trim());
  }

  return (
    <section className="magic-offer-entry" aria-label="Angebot erstellen">
      {onBack && (
        <button type="button" className="magic-offer-entry__back" onClick={onBack}>
          ← Zur Kundenakte
        </button>
      )}

      <header className="magic-offer-entry__head">
        <h1 className="magic-offer-entry__title">Angebot erstellen</h1>
        <p className="magic-offer-entry__model">{modelLabel}</p>
        {wishLine && (
          <p className="magic-offer-entry__wish">Kundenwunsch: {wishLine}</p>
        )}
      </header>

      <p className="magic-offer-entry__question">Was möchten Sie anbieten?</p>

      <div className="magic-offer-entry__card magic-offer-entry__card--magic">
        <p className="magic-offer-entry__card-title">✨ Clever sagen</p>
        <p className="magic-offer-entry__card-text">
          Schreiben oder sprechen Sie einfach:
        </p>
        <p className="magic-offer-entry__example">
          „EV3 GT-Line mit P10, P11 und P12, Terracotta, 21 %, plus 1.290 € Überführung.“
        </p>
        <div className="magic-offer-entry__compose">
          <textarea
            className="magic-offer-entry__input"
            rows={4}
            value={text}
            disabled={isWorking}
            placeholder="z. B. EV3 GT-Line, P10 + P12, Terracotta, 21 %, 1.290 € Überführung …"
            onChange={(event) => setText(event.target.value)}
            aria-label="Angebot beschreiben"
          />
          <DealerAiInlineMic
            variant="fab"
            disabled={isWorking}
            onTranscript={(spoken) => {
              setText((prev) => (prev ? `${prev} ${spoken}` : spoken));
            }}
          />
        </div>
        <button
          type="button"
          className="magic-offer-entry__primary"
          disabled={isWorking || !text.trim()}
          onClick={handlePrepare}
        >
          {isWorking ? 'Wird vorbereitet …' : 'Angebot vorbereiten'}
        </button>
      </div>

      <p className="magic-offer-entry__or">oder</p>

      <div className="magic-offer-entry__card">
        <p className="magic-offer-entry__card-title">📄 Fertiges Angebot übernehmen</p>
        <p className="magic-offer-entry__card-text">
          PDF aus Kia, ALD, Bank11, DMS …
        </p>
        <label className="magic-offer-entry__pdf">
          <span>PDF hochladen</span>
          <input
            type="file"
            accept="application/pdf"
            disabled={isWorking}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onUploadPdf?.(file);
            }}
          />
        </label>
      </div>

      <button
        type="button"
        className="magic-offer-entry__manual"
        onClick={onManual}
        disabled={isWorking}
      >
        Manuell erfassen →
      </button>
    </section>
  );
}
