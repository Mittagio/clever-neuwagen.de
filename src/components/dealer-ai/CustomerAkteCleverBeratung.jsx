import { useState } from 'react';
import { Link } from 'react-router-dom';
import './CustomerAkte.css';

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`cust-clever-beratung__status cust-clever-beratung__status--${status.tone}`}>
      {status.label}
    </span>
  );
}

function LabelChips({ labels = [], variant = 'default' }) {
  if (!labels.length) return null;
  return (
    <ul className="cust-clever-beratung__chips">
      {labels.map((label) => (
        <li key={label}>
          <span className={`cust-clever-beratung__chip${variant === 'concern' ? ' cust-clever-beratung__chip--concern' : ''}`}>
            {variant === 'default' ? `✓ ${label}` : label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function VerstaendnisSection({ verstaendnis }) {
  const {
    labels = [],
    concerns = [],
    vehicles = [],
    openPoints = [],
  } = verstaendnis ?? {};

  const hasContent = labels.length > 0
    || concerns.length > 0
    || vehicles.length > 0
    || openPoints.length > 0;

  if (!hasContent) return null;

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--section">
      <p className="cust-clever-beratung__section-title">1. Verständnis</p>
      <LabelChips labels={labels} />
      {concerns.length > 0 && (
        <div className="cust-clever-beratung__subblock">
          <p className="cust-clever-beratung__label">Unsicherheiten</p>
          <LabelChips labels={concerns} variant="concern" />
        </div>
      )}
      {vehicles.length > 0 && (
        <div className="cust-clever-beratung__subblock">
          <p className="cust-clever-beratung__label">Fahrzeuge im Fokus</p>
          <LabelChips labels={vehicles} />
        </div>
      )}
      {openPoints.length > 0 && (
        <div className="cust-clever-beratung__subblock">
          <p className="cust-clever-beratung__label">Offene Punkte</p>
          <ul className="cust-clever-beratung__open">
            {openPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EntwicklungSection({ entwicklung = [] }) {
  if (!entwicklung.length) return null;

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--section">
      <p className="cust-clever-beratung__section-title">2. Entwicklung</p>
      <ol className="cust-clever-beratung__evolution">
        {entwicklung.map((step, index) => (
          <li key={`${step.customerText}-${index}`} className="cust-clever-beratung__evolution-step">
            <p className="cust-clever-beratung__evolution-quote">&ldquo;{step.customerText}&rdquo;</p>
            {step.newLabels?.length > 0 ? (
              <div className="cust-clever-beratung__evolution-new">
                <span className="cust-clever-beratung__evolution-arrow" aria-hidden>↓</span>
                <LabelChips labels={step.newLabels} />
              </div>
            ) : (
              <p className="cust-clever-beratung__evolution-muted">Kein neues Verständnis</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function GespraechseinstiegSection({ gespraechseinstieg }) {
  if (!gespraechseinstieg?.lead) return null;

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--section cust-clever-beratung__block--einstieg">
      <p className="cust-clever-beratung__section-title">3. Gesprächseinstieg</p>
      <p className="cust-clever-beratung__einstieg-lead">{gespraechseinstieg.lead}</p>
      {gespraechseinstieg.context ? (
        <p className="cust-clever-beratung__einstieg-context">{gespraechseinstieg.context}</p>
      ) : null}
    </div>
  );
}

function OriginaltonSection({ originalton }) {
  const [expanded, setExpanded] = useState(false);
  const messages = originalton?.messages ?? [];

  if (!messages.length) return null;

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--section">
      <button
        type="button"
        className="cust-clever-beratung__originalton-toggle"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <span className="cust-clever-beratung__section-title cust-clever-beratung__section-title--inline">
          4. 💬 Originale Aussage des Kunden
        </span>
        <span className="cust-clever-beratung__originalton-hint">
          {expanded ? 'Einklappen' : 'Anzeigen'}
        </span>
      </button>
      {expanded && (
        <div className="cust-clever-beratung__originalton-body">
          {messages.map((message, index) => (
            <p key={`${message}-${index}`} className="cust-clever-beratung__originalton-quote">
              &ldquo;{message}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Kundenakte – Clever Verkäuferbild aus Customer Understanding.
 */
export default function CustomerAkteCleverBeratung({
  view,
  understanding: understandingProp,
  telHref,
  onPrepareOffer,
  onCreateMessage,
  onChangeRecommendation,
}) {
  const understanding = understandingProp ?? view?.understanding;
  if (!understanding?.meta?.hasData) return null;

  const {
    verstaendnis,
    entwicklung,
    gespraechseinstieg,
    originalton,
  } = understanding;

  const {
    status,
    recommendation,
    configuratorUrl,
  } = view ?? {};

  return (
    <section className="cust-clever-beratung" aria-labelledby="cust-clever-beratung-title">
      <header className="cust-clever-beratung__head">
        <div className="cust-clever-beratung__title-row">
          <h2 id="cust-clever-beratung-title" className="cust-clever-beratung__title">
            Clever Beratung
          </h2>
          <StatusBadge status={status} />
        </div>
        <p className="cust-clever-beratung__hint">
          Clever hat den Kunden bereits beraten – hier das Verständnis für Sie.
        </p>
      </header>

      <div className="cust-clever-beratung__card">
        <VerstaendnisSection verstaendnis={verstaendnis} />
        <EntwicklungSection entwicklung={entwicklung} />
        <GespraechseinstiegSection gespraechseinstieg={gespraechseinstieg} />
        <OriginaltonSection originalton={originalton} />

        {recommendation?.vehicleTitle && (
          <div className="cust-clever-beratung__block cust-clever-beratung__block--highlight">
            <p className="cust-clever-beratung__label">Fahrzeugrichtung</p>
            {recommendation.headline ? (
              <p className="cust-clever-beratung__rec-summary">{recommendation.headline}</p>
            ) : null}
            <p className="cust-clever-beratung__rec-title">{recommendation.vehicleTitle}</p>
            <dl className="cust-clever-beratung__rec-meta">
              {recommendation.trimLabel && (
                <div>
                  <dt>Ausstattung</dt>
                  <dd>{recommendation.trimLabel}</dd>
                </div>
              )}
              {recommendation.batteryOrMotor && (
                <div>
                  <dt>Batterie / Motor</dt>
                  <dd>{recommendation.batteryOrMotor}</dd>
                </div>
              )}
              {recommendation.priceLine && (
                <div>
                  <dt>Rate / Preis</dt>
                  <dd>{recommendation.priceLine}</dd>
                </div>
              )}
            </dl>
            {recommendation.whyLines?.length > 0 && (
              <ul className="cust-clever-beratung__reasons">
                {recommendation.whyLines.slice(0, 4).map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
            )}
            {recommendation.alternatives?.length > 0 && (
              <div className="cust-clever-beratung__subblock">
                <p className="cust-clever-beratung__label">Alternativen</p>
                <ul className="cust-clever-beratung__open">
                  {recommendation.alternatives.map((alt) => (
                    <li key={alt.modelKey ?? alt.vehicleTitle}>{alt.vehicleTitle ?? alt.modelLabel}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="cust-clever-beratung__actions">
          <button
            type="button"
            className="cust-clever-beratung__action cust-clever-beratung__action--primary"
            onClick={onPrepareOffer}
          >
            Angebot vorbereiten
          </button>
          {telHref && (
            <a
              href={telHref}
              className="cust-clever-beratung__action"
            >
              Kunde anrufen
            </a>
          )}
          <button
            type="button"
            className="cust-clever-beratung__action"
            onClick={onCreateMessage}
          >
            Nachricht erstellen
          </button>
          {configuratorUrl && (
            <Link
              to={configuratorUrl}
              className="cust-clever-beratung__action"
              target="_blank"
              rel="noopener noreferrer"
            >
              Im Konfigurator öffnen
            </Link>
          )}
          <button
            type="button"
            className="cust-clever-beratung__action cust-clever-beratung__action--ghost"
            onClick={onChangeRecommendation}
          >
            Richtung anpassen
          </button>
        </div>
      </div>
    </section>
  );
}
