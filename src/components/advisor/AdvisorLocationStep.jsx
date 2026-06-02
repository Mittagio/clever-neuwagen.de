import { useState } from 'react';
import { parseManualLocationInput } from '../../logic/advisorLocation.js';
import { geocodePlzOrCity, reverseGeocodeCoords } from '../../services/geocodingService.js';
import './AdvisorLocationStep.css';

export default function AdvisorLocationStep({ onUseLocation, onSkip }) {
  const [manualValue, setManualValue] = useState('');
  const [manualError, setManualError] = useState('');
  const [geoError, setGeoError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  async function handleManualSubmit(event) {
    event.preventDefault();
    setManualError('');
    setManualLoading(true);
    try {
      const local = parseManualLocationInput(manualValue);
      if (local?.city) {
        onUseLocation(local);
        return;
      }
      const resolved = await geocodePlzOrCity(manualValue);
      if (!resolved) {
        setManualError('Bitte PLZ (5 Ziffern) oder Ort eingeben.');
        return;
      }
      onUseLocation(resolved);
    } catch {
      setManualError('Ort konnte nicht gefunden werden. Bitte PLZ oder einen bekannten Ort eingeben.');
    } finally {
      setManualLoading(false);
    }
  }

  function handleGeolocation() {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Standort ist in diesem Browser nicht verfügbar.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const resolved = await reverseGeocodeCoords(latitude, longitude);
          onUseLocation(resolved);
        } catch {
          onUseLocation({ label: 'Ihr Standort', source: 'geo' });
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        setGeoError('Standort konnte nicht ermittelt werden. Bitte PLZ oder Ort eingeben.');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }

  return (
    <section className="ai-loc-step card" aria-labelledby="ai-loc-step-title">
      <h2 id="ai-loc-step-title">Angebote in Ihrer Nähe anzeigen?</h2>
      <p className="ai-loc-step__sub">
        Wir suchen passende Händlerangebote im Umkreis von 25&nbsp;km.
      </p>

      <div className="ai-loc-step__actions">
        <button type="button" className="ai-loc-step__btn ai-loc-step__btn--primary" onClick={handleGeolocation} disabled={geoLoading || manualLoading}>
          📍 {geoLoading ? 'Standort wird ermittelt…' : 'Standort automatisch verwenden'}
        </button>
        <button
          type="button"
          className="ai-loc-step__btn"
          disabled={geoLoading || manualLoading}
          onClick={() => {
            setShowManual((v) => !v);
            setManualError('');
          }}
        >
          PLZ / Ort eingeben
        </button>
        <button type="button" className="ai-loc-step__btn ai-loc-step__btn--ghost" onClick={onSkip} disabled={geoLoading || manualLoading}>
          Ohne Standort fortfahren
        </button>
      </div>

      {geoError && <p className="ai-loc-step__error" role="alert">{geoError}</p>}

      {showManual && (
        <form className="ai-loc-step__manual" onSubmit={handleManualSubmit}>
          <label htmlFor="ai-loc-manual">PLZ oder Ort</label>
          <input
            id="ai-loc-manual"
            type="text"
            inputMode="text"
            autoComplete="postal-code"
            placeholder="z. B. 70173 oder Stuttgart"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            disabled={manualLoading}
          />
          {manualError && <p className="ai-loc-step__error" role="alert">{manualError}</p>}
          <button type="submit" className="ai-loc-step__btn ai-loc-step__btn--primary" disabled={manualLoading}>
            {manualLoading ? 'Wird gesucht…' : 'Standort übernehmen'}
          </button>
        </form>
      )}
    </section>
  );
}
