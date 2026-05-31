import { useMemo, useRef, useState } from 'react';
import DealerOfferCard from './DealerOfferCard';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { dealerListings, SEARCH_DEFAULTS } from '../../data/dealerListings.js';
import { buildDealerOffers } from '../../logic/buildDealerOffers.js';

const BRANDS = ['Kia', 'Hyundai', 'VW', 'Skoda', 'BMW', 'Mercedes'];

export default function LandingClassicSearch() {
  const { publishedConditions } = usePublishedDealerConditions();
  const searchRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [brandModel, setBrandModel] = useState(`${SEARCH_DEFAULTS.brand} ${SEARCH_DEFAULTS.model}`);
  const [plz, setPlz] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  const search = useMemo(() => {
    const parts = brandModel.trim().split(/\s+/);
    return { brand: parts[0] ?? '', model: parts.slice(1).join(' ') || parts[0] || '', plz };
  }, [brandModel, plz]);

  const offers = useMemo(
    () => buildDealerOffers(dealerListings, publishedConditions, search),
    [publishedConditions, search],
  );

  function openSearch() {
    setExpanded(true);
    requestAnimationFrame(() => {
      searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearchActive(true);
  }

  return (
    <section className="lp-section lp-classic" aria-labelledby="lp-classic-title" ref={searchRef}>
      <h2 id="lp-classic-title" className="lp-section__title lp-section__title--center">
        Sie wissen bereits, welches Fahrzeug Sie suchen?
      </h2>
      <p className="lp-classic__lead">
        Klassische Suche nach Marke, Modell und PLZ – für alle, die gezielt stöbern möchten.
      </p>

      {!expanded ? (
        <button type="button" className="lp-btn lp-btn--secondary lp-classic__open" onClick={openSearch}>
          🚗 Fahrzeuge durchsuchen
        </button>
      ) : (
        <div className="lp-classic__panel">
          <div className="lp-classic__brands" aria-label="Marken">
            {BRANDS.map((brand) => (
              <button
                key={brand}
                type="button"
                className="lp-chip lp-chip--small"
                onClick={() => setBrandModel(`${brand} `)}
              >
                {brand}
              </button>
            ))}
          </div>

          <form className="lp-classic__form" onSubmit={handleSearch}>
            <div className="lp-classic__fields">
              <div className="lp-classic__field">
                <label htmlFor="lp-brand-model">Marke / Modell</label>
                <input
                  id="lp-brand-model"
                  type="text"
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
                  placeholder={`z. B. ${SEARCH_DEFAULTS.brand} ${SEARCH_DEFAULTS.model}`}
                />
              </div>
              <div className="lp-classic__field lp-classic__field--plz">
                <label htmlFor="lp-plz">PLZ</label>
                <input
                  id="lp-plz"
                  type="text"
                  maxLength={5}
                  inputMode="numeric"
                  value={plz}
                  onChange={(e) => setPlz(e.target.value.replace(/\D/g, ''))}
                  placeholder={SEARCH_DEFAULTS.plzExample}
                />
              </div>
              <button type="submit" className="lp-btn lp-btn--primary">Suchen</button>
            </div>
          </form>

          {searchActive && (
            <div className="lp-classic__results" aria-live="polite">
              <p className="lp-classic__count">
                {offers.length} {offers.length === 1 ? 'Angebot' : 'Angebote'}
                {plz ? ` · PLZ ${plz}` : ''}
              </p>
              {offers.length > 0 ? (
                <div className="lp-classic__offers">
                  {offers.map((offer) => (
                    <DealerOfferCard key={offer.slug} offer={offer} />
                  ))}
                </div>
              ) : (
                <p className="lp-classic__empty">Keine Händlerangebote für diese Suche.</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
