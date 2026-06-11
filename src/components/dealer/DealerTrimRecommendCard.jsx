import { useEffect, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import { resolveTrimPick } from '../../services/dealer/trimWishRecommendation.js';
import { buildVehicleBrief } from '../../services/dealer/vehicleSalesJourney.js';
import './dealer-landing.css';

function ReasonList({ lines }) {
  if (!lines?.length) return null;
  return (
    <ul className="dl-trim-rec__reasons">
      {lines.map((line) => (
        <li key={line}>
          <span aria-hidden>✅</span>
          {' '}
          {line}
        </li>
      ))}
    </ul>
  );
}

/**
 * Schritt 3 – Zuerst Fahrzeug, dann Ausstattung (Verkäufer-Logik).
 */
export default function DealerTrimRecommendCard({
  recommendation,
  modelKey,
  dealerId,
  onConfirm,
  onBack,
}) {
  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const [selectedTrimId, setSelectedTrimId] = useState(recommendation?.primary?.trimId ?? null);

  useEffect(() => {
    setSelectedTrimId(recommendation?.primary?.trimId ?? null);
    setAlternativesOpen(false);
  }, [recommendation]);

  if (!recommendation?.primary) {
    return (
      <section className="dl-trim-rec">
        <p className="dl-trim-rec__fallback">
          Beim
          {' '}
          {recommendation?.vehicleTitle ?? 'Fahrzeug'}
          {' '}
          wählen wir die passende Ausstattung gemeinsam mit Ihnen.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => onConfirm?.(recommendation)}>
          Weiter
        </button>
      </section>
    );
  }

  const {
    vehicleTitle,
    vehicleShortLabel,
    vehicleFitReasons = [],
    primary,
    alternatives = [],
  } = recommendation;

  const selectedPick = resolveTrimPick(recommendation, selectedTrimId) ?? primary;
  const brief = buildVehicleBrief(modelKey ?? recommendation.modelKey);
  const isPrimarySelected = selectedPick.trimId === primary.trimId;

  function handleConfirm() {
    onConfirm?.({
      ...recommendation,
      selectedTrimId: selectedPick.trimId,
      selectedPick,
    });
  }

  function handleSelectAlternative(trimId) {
    setSelectedTrimId(trimId);
    setAlternativesOpen(false);
  }

  return (
    <section className="dl-trim-rec" aria-labelledby="dl-trim-rec-vehicle-title">
      <header className="dl-trim-rec__vehicle">
        <VehicleImage
          brand="Kia"
          model={modelKey ?? recommendation.modelKey}
          dealerId={dealerId}
          bodyType={brief.bodyType}
          className="dl-trim-rec__image-wrap"
          imageClassName="dl-trim-rec__image"
          variant="card"
          glow
        />
        <div className="dl-trim-rec__vehicle-copy">
          <p className="dl-trim-rec__kicker">
            <span aria-hidden>🚗</span>
            {' '}
            Clever empfiehlt den
            {' '}
            {vehicleTitle}
          </p>
          <h2 id="dl-trim-rec-vehicle-title" className="dl-trim-rec__vehicle-title">
            {vehicleTitle}
          </h2>
          <p className="dl-trim-rec__vehicle-intro">
            Dieser
            {' '}
            {vehicleShortLabel}
            {' '}
            passt aktuell am besten zu Ihren Wünschen.
          </p>
          <ReasonList lines={vehicleFitReasons} />
        </div>
      </header>

      <div className="dl-trim-rec__divider" aria-hidden />

      <div className="dl-trim-rec__trim-section">
        <h3 className="dl-trim-rec__trim-heading">Welche Ausstattung empfehlen wir?</h3>

        <article className={`dl-trim-rec__pick${isPrimarySelected ? ' dl-trim-rec__pick--selected' : ''}`}>
          <div className="dl-trim-rec__pick-head">
            <span className="dl-trim-rec__medal" aria-hidden>🥇</span>
            <div>
              <p className="dl-trim-rec__pick-rank">Empfohlen</p>
              <p className="dl-trim-rec__pick-name">
                {primary.trimLabel}
              </p>
            </div>
            {primary.valueNote && (
              <span className="dl-trim-rec__pick-badge">{primary.valueNote}</span>
            )}
          </div>

          <p className="dl-trim-rec__pick-lead">
            Beim
            {' '}
            {vehicleShortLabel}
            {' '}
            würden wir Ihnen die
            {' '}
            <strong>{primary.trimLabel}</strong>
            -Ausstattung empfehlen – dort sind die wichtigsten Extras bereits enthalten.
          </p>

          {primary.includedLines?.length > 0 && (
            <div className="dl-trim-rec__contains">
              <p className="dl-trim-rec__contains-label">Enthält:</p>
              <ReasonList lines={primary.includedLines} />
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary dl-trim-rec__pick-cta"
            onClick={() => {
              setSelectedTrimId(primary.trimId);
              handleConfirm();
            }}
          >
            Mit dieser Ausstattung weiter
          </button>
        </article>

        {alternatives.length > 0 && (
          <div className="dl-trim-rec__alt">
            <button
              type="button"
              className="dl-trim-rec__alt-toggle"
              aria-expanded={alternativesOpen}
              onClick={() => setAlternativesOpen((v) => !v)}
            >
              {alternativesOpen ? 'Weitere Optionen ausblenden' : 'Weitere Ausstattungen'}
            </button>

            {alternativesOpen && (
              <div className="dl-trim-rec__alt-list">
                <p className="dl-trim-rec__alt-label">Weitere Optionen</p>
                {alternatives.map((alt) => (
                  <button
                    key={alt.trimId}
                    type="button"
                    className={`dl-trim-rec__alt-item${selectedTrimId === alt.trimId ? ' dl-trim-rec__alt-item--active' : ''}`}
                    onClick={() => handleSelectAlternative(alt.trimId)}
                  >
                    <span className="dl-trim-rec__alt-name">{alt.trimLabel}</span>
                    {alt.tagline && (
                      <span className="dl-trim-rec__alt-tag">{alt.tagline}</span>
                    )}
                  </button>
                ))}
                {!isPrimarySelected && selectedPick && (
                  <button
                    type="button"
                    className="btn btn-primary dl-trim-rec__alt-cta"
                    onClick={handleConfirm}
                  >
                    Mit
                    {' '}
                    {selectedPick.trimLabel}
                    {' '}
                    weiter
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {onBack && (
        <button type="button" className="btn btn-secondary dl-trim-rec__back" onClick={onBack}>
          Zurück zu Ihren Wünschen
        </button>
      )}
    </section>
  );
}
