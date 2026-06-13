import { useCallback, useEffect, useRef, useState } from 'react';
import { buildUpgradePitch } from '../../services/dealer/trimWishRecommendation.js';
import './dealer-landing.css';

function TrimSlide({ trim, isActive, compact = false }) {
  const fulfilled = trim.wishChipLines?.fulfilled ?? [];
  const missing = trim.wishChipLines?.missing ?? [];

  if (compact) {
    return (
      <article
        className={`dl-trim-swipe__slide dl-trim-swipe__slide--compact${isActive ? ' dl-trim-swipe__slide--active' : ''}${trim.recommended ? ' dl-trim-swipe__slide--recommended' : ''}`}
        aria-hidden={!isActive}
      >
        <div className="dl-trim-swipe__slide-head dl-trim-swipe__slide-head--compact">
          {trim.medal && (
            <span className="dl-trim-swipe__medal" aria-hidden>{trim.medal}</span>
          )}
          <p className="dl-trim-swipe__trim-name">{trim.trimLabel}</p>
          {trim.cleverQuotePercent != null && (
            <p className="dl-trim-swipe__percent" aria-label={`${trim.cleverQuotePercent} Prozent Passung`}>
              {trim.cleverQuotePercent}
              %
            </p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`dl-trim-swipe__slide${isActive ? ' dl-trim-swipe__slide--active' : ''}${trim.recommended ? ' dl-trim-swipe__slide--recommended' : ''}`}
      aria-hidden={!isActive}
    >
      <div className="dl-trim-swipe__slide-head">
        {trim.medal && (
          <span className="dl-trim-swipe__medal" aria-hidden>{trim.medal}</span>
        )}
        <div>
          <p className="dl-trim-swipe__trim-name">{trim.trimLabel}</p>
          {trim.roleLabel && (
            <p className="dl-trim-swipe__role">{trim.roleLabel}</p>
          )}
        </div>
        {trim.cleverQuotePercent != null && (
          <p className="dl-trim-swipe__percent" aria-label={`${trim.cleverQuotePercent} Prozent Passung`}>
            {trim.cleverQuotePercent}
            %
          </p>
        )}
      </div>

      {(fulfilled.length > 0 || missing.length > 0) && (
        <ul className="dl-trim-swipe__wish-lines">
          {fulfilled.map((label) => (
            <li key={`ok-${label}`} className="dl-trim-swipe__wish-line dl-trim-swipe__wish-line--ok">
              <span aria-hidden>✓</span>
              {' '}
              {label}
            </li>
          ))}
          {missing.map((label) => (
            <li key={`no-${label}`} className="dl-trim-swipe__wish-line dl-trim-swipe__wish-line--miss">
              <span aria-hidden>✕</span>
              {' '}
              {label}
            </li>
          ))}
        </ul>
      )}

      {!fulfilled.length && !missing.length && trim.includedLines?.length > 0 && (
        <ul className="dl-trim-swipe__wish-lines">
          {trim.includedLines.slice(0, 4).map((line) => (
            <li key={line} className="dl-trim-swipe__wish-line dl-trim-swipe__wish-line--ok">
              <span aria-hidden>✓</span>
              {' '}
              {line}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * Varianten-Swipe mit Live-Passung – Earth in der Mitte, empfohlen.
 */
export default function DealerTrimSwipeCarousel({
  recommendation,
  wishChipIds = [],
  selectedTrimId = null,
  onSelectTrim,
  tabsOnly = false,
  slidesOnly = false,
}) {
  const allTrims = recommendation?.allTrims ?? [];
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const recommendedId = recommendation?.primary?.trimId ?? allTrims[0]?.trimId;
  const resolvedSelectedId = selectedTrimId ?? recommendedId;

  const scrollToIndex = useCallback((index) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[index];
    if (!slide) return;
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (!allTrims.length) return;
    const startIndex = Math.max(0, allTrims.findIndex((trim) => trim.trimId === recommendedId));
    setActiveIndex(startIndex);
    requestAnimationFrame(() => scrollToIndex(startIndex));
  }, [allTrims, recommendedId, scrollToIndex, wishChipIds.join('|')]);

  useEffect(() => {
    const index = allTrims.findIndex((trim) => trim.trimId === resolvedSelectedId);
    if (index >= 0 && index !== activeIndex) {
      setActiveIndex(index);
      scrollToIndex(index);
    }
  }, [resolvedSelectedId, allTrims, activeIndex, scrollToIndex]);

  if (allTrims.length <= 1) return null;

  const upgrade = buildUpgradePitch(recommendation, resolvedSelectedId, wishChipIds);

  function handleTabClick(index, trimId) {
    setActiveIndex(index);
    onSelectTrim?.(trimId);
    if (!tabsOnly) scrollToIndex(index);
  }

  function handleStep(delta) {
    const next = Math.min(allTrims.length - 1, Math.max(0, activeIndex + delta));
    const trim = allTrims[next];
    if (!trim) return;
    handleTabClick(next, trim.trimId);
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const slides = [...track.children];
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let minDistance = Infinity;
    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(center - slideCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closest = index;
      }
    });
    if (closest !== activeIndex) {
      setActiveIndex(closest);
      const trimId = allTrims[closest]?.trimId;
      if (trimId) onSelectTrim?.(trimId);
    }
  }

  return (
    <div className={`dl-trim-swipe${tabsOnly ? ' dl-trim-swipe--tabs-only' : ''}${slidesOnly ? ' dl-trim-swipe--slides-only' : ''}`} aria-live="polite">
      {!slidesOnly && (
      <div className="dl-trim-swipe__tabs" role="tablist" aria-label="Ausstattungsvarianten">
        {allTrims.map((trim, index) => (
          <button
            key={trim.trimId}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className={`dl-trim-swipe__tab${index === activeIndex ? ' dl-trim-swipe__tab--active' : ''}${trim.recommended ? ' dl-trim-swipe__tab--recommended' : ''}`}
            onClick={() => handleTabClick(index, trim.trimId)}
          >
            {trim.medal && (
              <span className="dl-trim-swipe__tab-medal" aria-hidden>{trim.medal}</span>
            )}
            <span className="dl-trim-swipe__tab-label">{trim.trimLabel}</span>
            {trim.cleverQuotePercent != null && (
              <span className="dl-trim-swipe__tab-percent">{trim.cleverQuotePercent}%</span>
            )}
          </button>
        ))}
      </div>
      )}

      {!tabsOnly && slidesOnly && (
        <div className="dl-trim-swipe__compact-nav" aria-label="Ausstattung vergleichen">
          <button
            type="button"
            className="dl-trim-swipe__nav-btn"
            disabled={activeIndex <= 0}
            aria-label="Vorherige Variante"
            onClick={() => handleStep(-1)}
          >
            ←
          </button>
          <div className="dl-trim-swipe__nav-labels" role="tablist">
            {allTrims.map((trim, index) => (
              <button
                key={trim.trimId}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                className={`dl-trim-swipe__nav-label${index === activeIndex ? ' dl-trim-swipe__nav-label--active' : ''}`}
                onClick={() => handleTabClick(index, trim.trimId)}
              >
                {trim.trimLabel}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dl-trim-swipe__nav-btn"
            disabled={activeIndex >= allTrims.length - 1}
            aria-label="Nächste Variante"
            onClick={() => handleStep(1)}
          >
            →
          </button>
        </div>
      )}

      {!tabsOnly && (
      <div
        ref={trackRef}
        className="dl-trim-swipe__track"
        onScroll={handleScroll}
      >
        {allTrims.map((trim, index) => (
          <TrimSlide
            key={trim.trimId}
            trim={trim}
            isActive={index === activeIndex}
            compact={slidesOnly}
          />
        ))}
      </div>
      )}

      {slidesOnly && (
        <p className="dl-trim-swipe__hint">Wischen oder tippen zum Vergleichen</p>
      )}

      {!tabsOnly && upgrade && (
        <aside className="dl-trim-swipe__upgrade">
          <p className="dl-trim-swipe__upgrade-kicker">
            Warum upgraden?
          </p>
          <p className="dl-trim-swipe__upgrade-lead">
            {upgrade.toTrimLabel}
            {' '}
            bietet zusätzlich:
          </p>
          <ul className="dl-trim-swipe__upgrade-list">
            {upgrade.extras.map((extra) => (
              <li key={extra}>
                <span aria-hidden>✓</span>
                {' '}
                {extra}
              </li>
            ))}
          </ul>
          {upgrade.monthlyDelta != null && (
            <p className="dl-trim-swipe__upgrade-price">
              Aufpreis:
              {' '}
              <strong>
                +
                {upgrade.monthlyDelta}
                {' '}
                €/Monat
              </strong>
            </p>
          )}
          <button
            type="button"
            className="btn btn-secondary dl-trim-swipe__upgrade-cta"
            onClick={() => onSelectTrim?.(upgrade.toTrimId)}
          >
            {upgrade.toTrimLabel}
            {' '}
            statt
            {' '}
            {upgrade.fromTrimLabel}
            {' '}
            wählen
          </button>
        </aside>
      )}
    </div>
  );
}
