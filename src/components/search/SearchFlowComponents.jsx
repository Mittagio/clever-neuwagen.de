import { useState } from 'react';
import './SearchFlowComponents.css';

export function SearchUnderstandingChips({ chips, onEditChip }) {
  if (!chips.length) return null;

  return (
    <section className="search-understood card" aria-label="KI hat verstanden">
      <p className="search-understood__title">KI hat verstanden</p>
      <div className="search-understood__chips">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="search-chip"
            onClick={() => onEditChip?.(chip)}
            title="Tippen zum Ändern"
          >
            🏷 {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function LocationPromptDialog({ open, onAllowLocation, onManualSubmit, onDismiss }) {
  const [manual, setManual] = useState('');

  if (!open) return null;

  return (
    <div className="search-loc-dialog" role="dialog" aria-labelledby="search-loc-title">
      <div className="search-loc-dialog__card">
        <h2 id="search-loc-title">📍 Angebote in Ihrer Nähe finden?</h2>
        <button type="button" className="search-loc-dialog__primary" onClick={onAllowLocation}>
          Standort freigeben
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onManualSubmit?.(manual);
          }}
          className="search-loc-dialog__manual"
        >
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="PLZ oder Ort eingeben"
            aria-label="PLZ oder Ort"
          />
          <button type="submit">Übernehmen</button>
        </form>
        <button type="button" className="search-loc-dialog__skip" onClick={onDismiss}>
          Später
        </button>
      </div>
    </div>
  );
}

export function TopRecommendationCard({ vehicle, termMonths, onViewOffer }) {
  if (!vehicle) return null;

  const availability = vehicle.availability === 'sofort'
    ? '🟢 Sofort verfügbar'
    : vehicle.availability === 'vorlauf'
      ? '🟡 Im Vorlauf'
      : '🔵 Bestellfahrzeug';

  return (
    <article className="top-rec card">
      <p className="top-rec__badge">Beste Empfehlung</p>
      <h2>{vehicle.title}</h2>
      <p className="top-rec__rate">{vehicle.displayRate ?? vehicle.monthlyRate} €/Monat</p>
      <ul className="top-rec__meta">
        <li>{vehicle.distanceKm} km entfernt</li>
        <li>{vehicle.discountPercent} % Rabatt</li>
        <li>{availability}</li>
        <li>{vehicle.deliveryTime}</li>
        {termMonths ? <li>{termMonths} Monate Laufzeit</li> : null}
      </ul>
      <button type="button" className="top-rec__cta" onClick={() => onViewOffer?.(vehicle)}>
        Angebot ansehen
      </button>
    </article>
  );
}

export function OfferFilterChips({
  filters,
  onChangeTerm,
  onChangeMileage,
  onChangeRadius,
  onChangeSort,
  termOptions,
  mileageOptions,
  radiusOptions,
  sortOptions,
}) {
  return (
    <section className="offer-chips card" aria-label="Angebots-Filter">
      <div className="offer-chips__group">
        <span className="offer-chips__label">Laufzeit</span>
        <div className="offer-chips__row">
          {termOptions.map((m) => (
            <button
              key={m}
              type="button"
              className={`offer-chip${filters.termMonths === m ? ' is-active' : ''}`}
              onClick={() => onChangeTerm(m)}
            >
              {m} Monate
            </button>
          ))}
        </div>
      </div>
      <div className="offer-chips__group">
        <span className="offer-chips__label">Kilometer</span>
        <div className="offer-chips__row offer-chips__row--scroll">
          {mileageOptions.map((km) => (
            <button
              key={km}
              type="button"
              className={`offer-chip${filters.mileagePerYear === km ? ' is-active' : ''}`}
              onClick={() => onChangeMileage(km)}
            >
              {km.toLocaleString('de-DE')}
            </button>
          ))}
        </div>
      </div>
      <div className="offer-chips__group">
        <span className="offer-chips__label">Radius</span>
        <div className="offer-chips__row">
          {radiusOptions.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={`offer-chip${filters.radius === opt.value ? ' is-active' : ''}`}
              onClick={() => onChangeRadius(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="offer-chips__group">
        <span className="offer-chips__label">Sortierung</span>
        <div className="offer-chips__row offer-chips__row--scroll">
          {sortOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`offer-chip${filters.sort === opt.id ? ' is-active' : ''}`}
              onClick={() => onChangeSort(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
