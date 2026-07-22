import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerAkteSellerInsightCapture from './CustomerAkteSellerInsightCapture.jsx';
import './CustomerAkte.css';

function normalizeLabel(text = '') {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function labelsIncludeTerm(labels = [], term = '') {
  const needle = normalizeLabel(term);
  if (!needle) return false;
  return labels.some((label) => {
    const hay = normalizeLabel(label);
    return hay.includes(needle) || needle.includes(hay);
  });
}

function compactVerstaendnis(verstaendnis = {}) {
  const labels = [...(verstaendnis.labels ?? [])];
  const concerns = [...(verstaendnis.concerns ?? [])];
  const concernKeys = new Set(concerns.map(normalizeLabel));
  const compactLabels = labels.filter((label) => !concernKeys.has(normalizeLabel(label)));
  const vehicles = (verstaendnis.vehicles ?? []).filter(
    (vehicle) => !labelsIncludeTerm(compactLabels, vehicle),
  );

  return {
    labels: compactLabels,
    concerns,
    vehicles,
    openPoints: verstaendnis.openPoints ?? [],
  };
}

function shouldShowRecommendation(recommendation, verstaendnis = {}) {
  if (!recommendation?.vehicleTitle) return false;

  const labels = [
    ...(verstaendnis.labels ?? []),
    ...(verstaendnis.concerns ?? []),
    ...(verstaendnis.vehicles ?? []),
  ];

  const hasVehicleOnly = labelsIncludeTerm(labels, recommendation.vehicleTitle)
    && !recommendation.trimLabel
    && !recommendation.batteryOrMotor
    && !recommendation.priceLine
    && !(recommendation.whyLines?.length)
    && !(recommendation.alternatives?.length)
    && !recommendation.headline;

  if (hasVehicleOnly) return false;

  return Boolean(
    recommendation.trimLabel
    || recommendation.batteryOrMotor
    || recommendation.priceLine
    || recommendation.whyLines?.length
    || recommendation.alternatives?.length
    || recommendation.headline,
  );
}

function originaltonMatchesEntwicklung(originalton, entwicklung = []) {
  const messages = originalton?.messages ?? [];
  const steps = entwicklung.map((step) => step.customerText);
  if (!messages.length || messages.length !== steps.length) return false;
  return messages.every((message, index) => message === steps[index]);
}

function LabelChips({ labels = [], variant = 'default', compact = false }) {
  if (!labels.length) return null;
  return (
    <ul className={`cust-clever-beratung__chips${compact ? ' cust-clever-beratung__chips--compact' : ''}`}>
      {labels.map((label) => (
        <li key={label}>
          <span className={`cust-clever-beratung__chip${variant === 'concern' ? ' cust-clever-beratung__chip--concern' : ''}${compact ? ' cust-clever-beratung__chip--compact' : ''}`}>
            {variant === 'default' ? `✓ ${label}` : label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function GespraechseinstiegSection({ gespraechseinstieg }) {
  if (!gespraechseinstieg?.lead) return null;

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--hero">
      <p className="cust-clever-beratung__hero-eyebrow">Womit beginne ich das Gespräch?</p>
      <p className="cust-clever-beratung__einstieg-lead">{gespraechseinstieg.lead}</p>
      {gespraechseinstieg.context ? (
        <p className="cust-clever-beratung__einstieg-context">{gespraechseinstieg.context}</p>
      ) : null}
    </div>
  );
}

function VerstaendnisSection({ verstaendnis }) {
  const compact = compactVerstaendnis(verstaendnis);
  const {
    labels,
    concerns,
    vehicles,
    openPoints,
  } = compact;

  const hasContent = labels.length > 0
    || concerns.length > 0
    || vehicles.length > 0
    || openPoints.length > 0;

  if (!hasContent) return null;

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--compact">
      <p className="cust-clever-beratung__section-title cust-clever-beratung__section-title--subtle">
        Wunschübergabe von Clever
      </p>
      <LabelChips labels={labels} compact />
      <LabelChips labels={concerns} variant="concern" compact />
      {vehicles.length > 0 && (
        <ul className="cust-clever-beratung__chips cust-clever-beratung__chips--compact">
          {vehicles.map((vehicle) => (
            <li key={vehicle}>
              <span className="cust-clever-beratung__chip cust-clever-beratung__chip--compact">
                🚙 {vehicle}
              </span>
            </li>
          ))}
        </ul>
      )}
      {openPoints.length > 0 && (
        <div className="cust-clever-beratung__open">
          <p className="cust-clever-beratung__open-label">Offen</p>
          <ul className="cust-clever-beratung__open-list">
            {openPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EntwicklungSection({ entwicklung = [], hideQuotes = false }) {
  const [expanded, setExpanded] = useState(false);

  if (!entwicklung.length) return null;

  const summaryLabel = entwicklung.length === 1
    ? 'Ein Gesprächsschritt'
    : `${entwicklung.length} Gesprächsschritte`;

  const latestLabels = entwicklung[entwicklung.length - 1]?.labelsAfter ?? [];

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--fold">
      <button
        type="button"
        className="cust-clever-beratung__fold-toggle"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <span className="cust-clever-beratung__section-title cust-clever-beratung__section-title--subtle cust-clever-beratung__section-title--inline">
          Entwicklung
          <span className="cust-clever-beratung__fold-meta">
            {summaryLabel}
          </span>
        </span>
        <span className="cust-clever-beratung__originalton-hint">
          {expanded ? 'Einklappen' : 'Anzeigen'}
        </span>
      </button>

      {!expanded && latestLabels.length > 0 && (
        <LabelChips labels={latestLabels.slice(-4)} compact />
      )}

      {expanded && (
        <ol className="cust-clever-beratung__evolution cust-clever-beratung__evolution--open">
          {entwicklung.map((step, index) => (
            <li key={`${step.customerText}-${index}`} className="cust-clever-beratung__evolution-step">
              {!hideQuotes && (
                <>
                  {step.source === 'seller' && (
                    <p className="cust-clever-beratung__evolution-source">Verkäufer</p>
                  )}
                  <p className="cust-clever-beratung__evolution-quote">&ldquo;{step.customerText}&rdquo;</p>
                </>
              )}
              {step.newLabels?.length > 0 ? (
                <div className="cust-clever-beratung__evolution-new">
                  {!hideQuotes && (
                    <span className="cust-clever-beratung__evolution-arrow" aria-hidden>↓</span>
                  )}
                  <LabelChips labels={step.newLabels} compact />
                </div>
              ) : (
                <p className="cust-clever-beratung__evolution-muted">Kein neues Verständnis</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function OriginaltonSection({ originalton, defaultCollapsed = true }) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const messages = originalton?.messages ?? [];

  if (!messages.length) return null;

  return (
    <div className="cust-clever-beratung__block cust-clever-beratung__block--fold">
      <button
        type="button"
        className="cust-clever-beratung__fold-toggle"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <span className="cust-clever-beratung__section-title cust-clever-beratung__section-title--subtle cust-clever-beratung__section-title--inline">
          Gespräch ansehen
        </span>
        <span className="cust-clever-beratung__originalton-hint">
          {expanded ? 'Einklappen' : `${messages.length} Nachrichten`}
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
  onAddSellerInsight,
  isSavingInsight = false,
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
    recommendation,
    configuratorUrl,
  } = view ?? {};

  const showRecommendation = useMemo(
    () => shouldShowRecommendation(recommendation, verstaendnis),
    [recommendation, verstaendnis],
  );

  const hideEntwicklungQuotes = originaltonMatchesEntwicklung(originalton, entwicklung);

  return (
    <section className="cust-clever-beratung cust-clever-beratung--kundenbild" aria-labelledby="cust-clever-beratung-title">
      <header className="cust-clever-beratung__head cust-clever-beratung__head--minimal">
        <h2 id="cust-clever-beratung-title" className="cust-clever-beratung__title">
          Kundenbild
        </h2>
        <p className="cust-clever-beratung__hint">
          Was der Kunde erzählt hat – und was Sie im Gespräch gelernt haben.
        </p>
      </header>

      {onAddSellerInsight && (
        <CustomerAkteSellerInsightCapture
          onSubmit={onAddSellerInsight}
          isSaving={isSavingInsight}
        />
      )}

      <div className="cust-clever-beratung__card cust-clever-beratung__card--kundenbild">
        <GespraechseinstiegSection gespraechseinstieg={gespraechseinstieg} />
        <VerstaendnisSection verstaendnis={verstaendnis} />
        <EntwicklungSection entwicklung={entwicklung} hideQuotes={hideEntwicklungQuotes} />
        <OriginaltonSection originalton={originalton} defaultCollapsed />

        {showRecommendation && (
          <div className="cust-clever-beratung__block cust-clever-beratung__block--highlight">
            <p className="cust-clever-beratung__label">Zusatz zur Fahrzeugrichtung</p>
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
                {recommendation.whyLines.slice(0, 3).map((line) => (
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

        <div className="cust-clever-beratung__actions cust-clever-beratung__actions--secondary">
          <button
            type="button"
            className="cust-clever-beratung__action cust-clever-beratung__action--secondary"
            onClick={onPrepareOffer}
          >
            Angebot vorbereiten
          </button>
          {telHref && (
            <a
              href={telHref}
              className="cust-clever-beratung__action cust-clever-beratung__action--secondary"
            >
              Anrufen
            </a>
          )}
          <button
            type="button"
            className="cust-clever-beratung__action cust-clever-beratung__action--secondary"
            onClick={onCreateMessage}
          >
            Nachricht
          </button>
          {configuratorUrl && (
            <Link
              to={configuratorUrl}
              className="cust-clever-beratung__action cust-clever-beratung__action--secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Konfigurator
            </Link>
          )}
          <button
            type="button"
            className="cust-clever-beratung__action cust-clever-beratung__action--ghost cust-clever-beratung__action--secondary"
            onClick={onChangeRecommendation}
          >
            Richtung anpassen
          </button>
        </div>
      </div>
    </section>
  );
}
