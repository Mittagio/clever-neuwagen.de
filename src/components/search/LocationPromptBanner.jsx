import { useState } from 'react';
import { parseManualLocationInput } from '../../logic/advisorLocation.js';
import './locationPromptBanner.css';

const RADIUS_OPTIONS = [
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: null, label: 'Deutschlandweit' },
];

export function LocationRadiusBar({ filters, onPatch, variant = 'full' }) {
  const [open, setOpen] = useState(false);
  if (!filters.city && !filters.plz && !filters.locLabel) return null;

  const loc = filters.locLabel || filters.city || filters.plz;
  const radius = filters.radius ?? 25;
  const radiusLabel = radius == null ? 'Deutschlandweit' : `${radius} km Radius`;

  return (
    <div
      className={`loc-radius-bar loc-radius-bar--${variant}`}
      aria-label="Standort"
    >
      <p className="loc-radius-bar__summary">
        <span className="loc-radius-bar__pin" aria-hidden>📍</span>
        {loc} · {radiusLabel}
        <button
          type="button"
          className="loc-radius-bar__toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Schließen' : 'Radius ändern'}
        </button>
      </p>
      {open && (
        <div className="loc-radius-bar__chips">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className={`loc-radius-bar__chip${filters.radius === opt.value ? ' is-active' : ''}`}
              onClick={() => onPatch({ radius: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated Alias */
export function LocationRadiusChips(props) {
  return <LocationRadiusBar {...props} />;
}

export default function LocationPromptBanner({
  onAllowLocation,
  onLocationSubmit,
  variant = 'full',
}) {
  const [plzInput, setPlzInput] = useState('');
  const [showPlz, setShowPlz] = useState(false);
  const compact = variant === 'compact';

  function handlePlzSubmit(e) {
    e.preventDefault();
    const loc = parseManualLocationInput(plzInput);
    if (loc) {
      onLocationSubmit?.({
        city: loc.city ?? '',
        plz: loc.plz ?? '',
        locLabel: loc.city || loc.plz || '',
        radius: 25,
        locSkip: false,
      });
      setPlzInput('');
      setShowPlz(false);
    }
  }

  return (
    <aside
      className={`loc-prompt-banner loc-prompt-banner--calm${compact ? ' loc-prompt-banner--compact' : ''}`}
      aria-label="Händler in Ihrer Nähe"
    >
      <div className={compact ? 'loc-prompt-banner__inline' : undefined}>
        <p className="loc-prompt-banner__title">📍 Händler in Ihrer Nähe anzeigen</p>
        {!compact && (
          <p className="loc-prompt-banner__sub">
            Mit Ihrem Standort zeigen wir passende Angebote regionaler Händler.
          </p>
        )}
        <div className="loc-prompt-banner__actions">
          <button type="button" className="loc-prompt-banner__primary" onClick={onAllowLocation}>
            Standort verwenden
          </button>
          <button
            type="button"
            className="loc-prompt-banner__secondary"
            onClick={() => setShowPlz((v) => !v)}
          >
            PLZ eingeben
          </button>
        </div>
      </div>
      {showPlz && (
        <form className="loc-prompt-banner__plz" onSubmit={handlePlzSubmit}>
          <input
            type="text"
            placeholder="PLZ oder Ort"
            value={plzInput}
            onChange={(e) => setPlzInput(e.target.value)}
            aria-label="PLZ oder Ort"
          />
          <button type="submit">Übernehmen</button>
        </form>
      )}
    </aside>
  );
}
