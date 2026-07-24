import { useState } from 'react';
import './MagicOfferReview.css';

function formatEuro(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '–';
  return `${Number(amount).toLocaleString('de-DE', {
    minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
    maximumFractionDigits: 2,
  })} €`;
}

/**
 * Magic-Ergebnis: Positionsrechnung oder Rate-Intake – Verkäufer bestätigt.
 */
export default function MagicOfferReview({
  preparation,
  onCreateOffer,
  onChangeDetails,
  onOpenPriceList,
  onCorrection,
  onChooseOfferType,
  onBack,
  isWorking = false,
}) {
  const [correction, setCorrection] = useState('');
  if (!preparation) return null;

  const lines = preparation.positionLines ?? [];
  const calc = preparation.calculation ?? {};
  const isCash = preparation.mode === 'cash_magic';
  const isLeasing = preparation.mode === 'leasing_intake';
  const isFinance = preparation.mode === 'financing_intake';

  return (
    <section className="magic-offer-review" aria-label="Angebot vorbereitet">
      {onBack && (
        <button type="button" className="magic-offer-review__back" onClick={onBack}>
          ← Zurück
        </button>
      )}

      <header className="magic-offer-review__head">
        <p className="magic-offer-review__kicker">✨ Angebot vorbereitet</p>
        <h1 className="magic-offer-review__title">{preparation.headline ?? 'Angebot'}</h1>
        {preparation.subline && (
          <p className="magic-offer-review__sub">{preparation.subline}</p>
        )}
      </header>

      {preparation.promptMessage && !preparation.canCreateOffer && (
        <div className="magic-offer-review__prompt" role="status">
          <p>{preparation.promptMessage}</p>
          {preparation.decision?.action === 'ask_rate' && (
            <div className="magic-offer-review__choices">
              <button
                type="button"
                className="magic-offer-review__choice"
                onClick={() => {
                  const el = document.getElementById('magic-correct');
                  el?.focus();
                }}
              >
                Rate eingeben
              </button>
            </div>
          )}
          {preparation.choices?.length > 0 && (
            <div className="magic-offer-review__choices">
              {preparation.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="magic-offer-review__choice"
                  onClick={() => onChooseOfferType?.(choice)}
                >
                  {choice === 'purchase' ? 'Kauf' : choice === 'financing' ? 'Finanzierung' : 'Leasing'}
                </button>
              ))}
            </div>
          )}
          {preparation.suggestions?.length > 0 && (
            <ul className="magic-offer-review__suggestions">
              {preparation.suggestions.map((item) => (
                <li key={item.id}>{item.code ? `${item.code} · ` : ''}{item.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isCash && lines.length > 0 && (
        <div className="magic-offer-review__table" aria-label="Preisaufstellung">
          <p className="magic-offer-review__table-label">UPE</p>
          {lines.map((row) => (
            <div
              key={row.id}
              className={`magic-offer-review__row magic-offer-review__row--${row.kind}`}
            >
              <span>{row.label}</span>
              <strong>{formatEuro(row.amount)}</strong>
            </div>
          ))}
        </div>
      )}

      {isCash && calc.endPrice != null && (
        <div className="magic-offer-review__total">
          <p className="magic-offer-review__total-value">{formatEuro(calc.endPrice)}</p>
          <p className="magic-offer-review__total-label">Endpreis</p>
        </div>
      )}

      {(isLeasing || isFinance) && calc.monthlyRate != null && (
        <div className="magic-offer-review__rate-card">
          <p className="magic-offer-review__rate-value">{formatEuro(calc.monthlyRate)}</p>
          <p className="magic-offer-review__rate-label">pro Monat</p>
          <ul className="magic-offer-review__meta">
            {calc.durationMonths != null && <li>{calc.durationMonths} Monate</li>}
            {calc.annualMileageKm != null && (
              <li>{Number(calc.annualMileageKm).toLocaleString('de-DE')} km/Jahr</li>
            )}
            {calc.specialPayment === 0 && <li>0 € Sonderzahlung</li>}
            {calc.downPayment != null && isFinance && (
              <li>Anzahlung {formatEuro(calc.downPayment)}</li>
            )}
            {calc.finalPayment != null && (
              <li>Schlussrate {formatEuro(calc.finalPayment)}</li>
            )}
            {calc.effectiveInterestRate != null && (
              <li>Effektiver Jahreszins {String(calc.effectiveInterestRate).replace('.', ',')} %</li>
            )}
            {calc.transferCost != null && (
              <li>Überführung {formatEuro(calc.transferCost)}</li>
            )}
          </ul>
        </div>
      )}

      {preparation.verifiedPrices && isCash && (
        <p className="magic-offer-review__verified">✓ Preise verifiziert</p>
      )}

      {preparation.canCreateOffer && (
        <button
          type="button"
          className="magic-offer-review__primary"
          disabled={isWorking}
          onClick={onCreateOffer}
        >
          {isWorking ? 'Wird erstellt …' : 'Angebot erstellen'}
        </button>
      )}

      <div className="magic-offer-review__correct">
        <label className="magic-offer-review__correct-label" htmlFor="magic-correct">
          Angaben ändern
        </label>
        <div className="magic-offer-review__correct-row">
          <input
            id="magic-correct"
            className="magic-offer-review__correct-input"
            value={correction}
            placeholder="z. B. P11 raus · Mach 22 % · Überführung 990"
            onChange={(event) => setCorrection(event.target.value)}
            disabled={isWorking}
          />
          <button
            type="button"
            className="magic-offer-review__correct-btn"
            disabled={isWorking || !correction.trim()}
            onClick={() => {
              onCorrection?.(correction.trim());
              setCorrection('');
            }}
          >
            Übernehmen
          </button>
        </div>
      </div>

      <div className="magic-offer-review__links">
        <button type="button" className="magic-offer-review__link" onClick={onChangeDetails}>
          Manuell anpassen
        </button>
        {onOpenPriceList && (
          <button type="button" className="magic-offer-review__link" onClick={onOpenPriceList}>
            Preisliste ansehen ↗
          </button>
        )}
      </div>
    </section>
  );
}
