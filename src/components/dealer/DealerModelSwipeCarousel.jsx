import { useCallback, useEffect, useRef, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import DealerAdvisorCleverQuote from './DealerAdvisorCleverQuote.jsx';
import './dealer-landing.css';

function ModelSlide({ pick, dealerId, isActive }) {
  const v = pick.group?.primaryMatch?.vehicle;
  const bodyType = v?.bodyType ?? 'suv';
  const cleverQuote = pick.group?.modelQuote ?? pick.group?.primaryMatch?.cleverQuote;
  const modelChecks = pick.group?.modelChecks ?? [];

  return (
    <article
      className={`dl-model-swipe__slide${isActive ? ' dl-model-swipe__slide--active' : ''}${pick.badge ? ' dl-model-swipe__slide--recommended' : ''}`}
      aria-hidden={!isActive}
    >
      <div className="dl-model-swipe__visual">
        <VehicleImage
          brand="Kia"
          model={pick.modelKey}
          dealerId={dealerId}
          bodyType={bodyType}
          className="dl-model-swipe__image-wrap"
          imageClassName="dl-model-swipe__image"
          variant="hero"
          glow
        />
      </div>

      <div className="dl-model-swipe__body">
        <div className="dl-model-swipe__head">
          <div className="dl-model-swipe__head-main">
            {pick.badge && (
              <span className="dl-model-swipe__badge">{pick.badge}</span>
            )}
            {!pick.badge && pick.medal && (
              <span className="dl-model-swipe__medal" aria-hidden>{pick.medal}</span>
            )}
            <h3 className="dl-model-swipe__title">{pick.title}</h3>
          </div>
        </div>

        {pick.matchPercent != null && (
          <DealerAdvisorCleverQuote
            cleverQuote={cleverQuote ?? { percent: pick.matchPercent }}
            checks={modelChecks}
            wishLines={pick.lines}
          />
        )}
      </div>
    </article>
  );
}

/**
 * Clever empfiehlt – Tinder/Tesla-Swipe für 1–3 passende Modelle (kein EV-Katalog).
 */
export default function DealerModelSwipeCarousel({
  picks = [],
  dealerId,
  activeModelKey = null,
  onActiveChange,
  onSelectModel,
}) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const resolvedIndex = activeModelKey
    ? Math.max(0, picks.findIndex((pick) => pick.modelKey === activeModelKey))
    : activeIndex;

  const scrollToIndex = useCallback((index) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[index];
    if (!slide) return;
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (!picks.length) return;
    const index = resolvedIndex >= 0 ? resolvedIndex : 0;
    setActiveIndex(index);
    requestAnimationFrame(() => scrollToIndex(index));
  }, [picks.length, resolvedIndex, scrollToIndex]);

  useEffect(() => {
    const pick = picks[activeIndex];
    if (pick) onActiveChange?.(pick);
  }, [activeIndex, picks, onActiveChange]);

  if (!picks.length) return null;

  const activePick = picks[activeIndex] ?? picks[0];
  const ctaLabel = activePick.shortTitle ?? activePick.title?.replace(/^Kia\s+/i, '') ?? 'Modell';

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const slides = [...track.children];
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const dist = Math.abs(center - slideCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = index;
      }
    });
    if (closest !== activeIndex) {
      setActiveIndex(closest);
    }
  }

  function handleTabClick(index) {
    setActiveIndex(index);
    scrollToIndex(index);
  }

  return (
    <div className="dl-model-swipe">
      {picks.length > 1 && (
        <div className="dl-model-swipe__tabs" role="tablist" aria-label="Passende Modelle">
          {picks.map((pick, index) => (
            <button
              key={pick.modelKey}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={`dl-model-swipe__tab${index === activeIndex ? ' dl-model-swipe__tab--active' : ''}${pick.badge ? ' dl-model-swipe__tab--recommended' : ''}`}
              onClick={() => handleTabClick(index)}
            >
              {pick.medal && (
                <span className="dl-model-swipe__tab-medal" aria-hidden>{pick.medal}</span>
              )}
              <span className="dl-model-swipe__tab-label">
                {pick.shortTitle ?? pick.title}
              </span>
              {pick.matchPercent != null && (
                <span className="dl-model-swipe__tab-cq">
                  <span aria-hidden>🏆</span>
                  {' '}
                  {pick.matchPercent}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div
        ref={trackRef}
        className="dl-model-swipe__track"
        onScroll={handleScroll}
        role="list"
        aria-label="Clever empfiehlt diese Fahrzeuge"
      >
        {picks.map((pick, index) => (
          <ModelSlide
            key={pick.modelKey}
            pick={pick}
            dealerId={dealerId}
            isActive={index === activeIndex}
          />
        ))}
      </div>

      {picks.length > 1 && (
        <div className="dl-model-swipe__dots" aria-hidden>
          {picks.map((pick, index) => (
            <span
              key={pick.modelKey}
              className={`dl-model-swipe__dot${index === activeIndex ? ' dl-model-swipe__dot--active' : ''}`}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary dl-model-swipe__cta"
        onClick={() => onSelectModel?.(activePick.modelKey)}
      >
        {ctaLabel}
        {' '}
        ansehen
      </button>
    </div>
  );
}
