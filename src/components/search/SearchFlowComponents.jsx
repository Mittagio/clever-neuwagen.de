import { Link } from 'react-router-dom';
import { useState } from 'react';
import EditableSearchChip from './EditableSearchChip.jsx';
import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import LocalVehicleOfferCard from './LocalVehicleOfferCard.jsx';
import './SearchFlowComponents.css';
import './localVehicleOfferCard.css';

export function CompactSearchSummary({ chips, onEditChip, title = 'Ihre Suche' }) {
  if (!chips.length) return null;

  return (
    <div className="search-summary-compact" aria-label="Suchzusammenfassung">
      {title && <p className="search-summary-compact__title">{title}</p>}
      <div className="search-summary-compact__row">
        {chips.map((chip) => (
          <EditableSearchChip key={chip.id} chip={chip} onEdit={onEditChip} />
        ))}
      </div>
    </div>
  );
}

export function KiSummaryHero({ chips, onEditChip }) {
  return (
    <section className="ki-summary-hero" aria-label="Ihre Suche">
      <h1 className="ki-summary-hero__headline">Das könnte zu Ihnen passen.</h1>
      <p className="ki-summary-hero__sub">Basierend auf Ihrer Beschreibung</p>
      {chips.length > 0 && (
        <div className="ki-summary-hero__chips">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="ki-lifestyle-chip"
              onClick={() => onEditChip?.(chip)}
            >
              <span className="ki-lifestyle-chip__emoji" aria-hidden="true">{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** @deprecated Nutze KiSummaryHero auf der Ergebnisseite */
export function SearchUnderstandingChips({ chips, onEditChip }) {
  const mapped = chips.map((c) => ({
    ...c,
    emoji: c.emoji ?? '🏷',
  }));
  return <KiSummaryHero chips={mapped} onEditChip={onEditChip} />;
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

/** Inline-Hinweis – kein Overlay, kein Blocking (Sprint Standort entschärfen) */
export function LocationHintCard({
  filters,
  localized,
  locationLabel,
  radiusOptions,
  onAllowLocation,
  onManualSubmit,
  onChangeRadius,
}) {
  const [manual, setManual] = useState('');
  const [radiusOpen, setRadiusOpen] = useState(false);

  if (localized) {
    const radiusLabel = filters.radius == null
      ? 'Deutschlandweit'
      : `${filters.radius} km Radius`;

    return (
      <section className="loc-hint loc-hint--active" aria-label="Standort">
        <div className="loc-hint__active-row">
          <p className="loc-hint__active-label">
            📍 {locationLabel} · {radiusLabel}
          </p>
          <button
            type="button"
            className="loc-hint__link-btn"
            onClick={() => setRadiusOpen((v) => !v)}
            aria-expanded={radiusOpen}
          >
            Radius ändern
          </button>
        </div>
        {radiusOpen && (
          <div className="loc-hint__radius-row">
            {radiusOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`loc-hint__radius-chip${filters.radius === opt.value ? ' is-active' : ''}`}
                onClick={() => {
                  onChangeRadius?.(opt.value);
                  setRadiusOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="loc-hint" aria-label="Lokale Händler finden">
      <h2 className="loc-hint__title">📍 Lokale Händler finden</h2>
      <p className="loc-hint__text">Aktuell werden deutschlandweite Angebote angezeigt.</p>
      <div className="loc-hint__actions">
        <button type="button" className="loc-hint__primary" onClick={onAllowLocation}>
          Standort freigeben
        </button>
        <form
          className="loc-hint__plz-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            onManualSubmit?.(manual);
            setManual('');
          }}
        >
          <input
            type="text"
            className="loc-hint__plz-input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="PLZ eingeben"
            aria-label="PLZ eingeben"
            inputMode="numeric"
          />
          <button type="submit" className="loc-hint__plz-submit">Übernehmen</button>
        </form>
      </div>
    </section>
  );
}

function availabilityText(availability) {
  if (availability === 'sofort') return 'Sofort verfügbar';
  if (availability === 'vorlauf') return 'Im Vorlauf';
  return 'Bestellfahrzeug';
}

export function TopRecommendationCard({ vehicle, onViewOffer }) {
  if (!vehicle) return null;

  return (
    <LocalVehicleOfferCard
      vehicle={vehicle}
      isTopPick
      onViewOffer={onViewOffer}
      className="top-rec-hero"
    />
  );
}

export function VehicleResultsGrid({ vehicles, onViewOffer }) {
  if (!vehicles.length) return null;

  return (
    <section className="vehicle-grid" aria-label="Weitere Angebote in Ihrer Nähe">
      <h2 className="vehicle-grid__title">Weitere Angebote in Ihrer Nähe</h2>
      <div className="vehicle-grid__list">
        {vehicles.map((vehicle) => (
          <LocalVehicleOfferCard
            key={vehicle.id}
            vehicle={vehicle}
            onViewOffer={onViewOffer}
            className="vehicle-grid-card"
          />
        ))}
      </div>
    </section>
  );
}

export function HorizontalVehicleStrip({ vehicles, onViewOffer }) {
  if (!vehicles.length) return null;

  return (
    <section className="vehicle-strip" aria-label="Weitere Fahrzeuge in der Nähe">
      <h2 className="vehicle-strip__title">Weitere Fahrzeuge in der Nähe</h2>
      <div className="vehicle-strip__scroll">
        {vehicles.map((vehicle) => (
          <LocalVehicleOfferCard
            key={vehicle.id}
            vehicle={vehicle}
            onViewOffer={onViewOffer}
            showImage
            className="vehicle-strip-card"
          />
        ))}
      </div>
    </section>
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
  variant = 'default',
}) {
  return (
    <div className={`offer-chips__inner${variant === 'refine' ? ' offer-chips__inner--refine' : ''}`}>
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
    </div>
  );
}

export function RefineSearchPanel(props) {
  return (
    <details className="refine-search">
      <summary className="refine-search__summary">⚙ Suche verfeinern</summary>
      <div className="refine-search__body">
        <OfferFilterChips {...props} variant="refine" />
      </div>
    </details>
  );
}

/** @deprecated Nutze RefineSearchPanel */
export function AdjustResultsPanel(props) {
  return <RefineSearchPanel {...props} />;
}

export function NoExactMatchPanel({ suggestions, onSelectSuggestion }) {
  if (!suggestions.length) return null;

  return (
    <section className="no-exact-match card" aria-label="Alternative Vorschläge">
      <h2 className="no-exact-match__title">Keine exakten Treffer gefunden.</h2>
      <p className="no-exact-match__sub">Ähnliche Möglichkeiten:</p>
      <div className="no-exact-match__chips">
        {suggestions.map((item) => (
          <button
            key={item.id}
            type="button"
            className="no-exact-match__chip"
            onClick={() => onSelectSuggestion?.(item)}
          >
            {item.emoji ? `${item.emoji} ` : ''}{item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ResultsQuestionLink({ searchQuery }) {
  const params = new URLSearchParams({ from: 'results' });
  if (searchQuery) params.set('q', searchQuery.slice(0, 200));

  return (
    <p className="results-question-link-wrap">
      <Link to={`/assistant?${params.toString()}`} className="results-question-link">
        💬 Frage zu den Ergebnissen?
      </Link>
    </p>
  );
}
