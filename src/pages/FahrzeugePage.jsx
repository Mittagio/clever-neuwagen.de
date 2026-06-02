import { useMemo, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import PageShell from '../components/layout/PageShell';

import { NoExactMatchPanel } from '../components/search/SearchFlowComponents.jsx';

import CleverInsightsPanel from '../components/search/CleverInsightsPanel.jsx';

import DesktopSearchRefine from '../components/search/DesktopSearchRefine.jsx';

import MagicLensDrawer from '../components/magic-lens/MagicLensDrawer.jsx';

import { WishSummaryBar } from '../components/wish/WishChips.jsx';

import { WishTopMatchCard, WishVehicleGridCard } from '../components/wish/WishVehicleCards.jsx';

import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';

import { filterMarketplaceVehicles } from '../logic/marketplaceService.js';

import { buildSearchFallbackSuggestions } from '../logic/searchFallbackService.js';

import { buildCleverInsights, pickMobileInsight } from '../logic/cleverInsightsService.js';

import {

  filtersFromSearchParams,

  buildFahrzeugeSearchUrl,

  hasLocalizedSearch,

  adjustRateForTerm,

  getVehicleOfferPath,

} from '../logic/oneSearchService.js';

import { getLocationDisplayLabel, parseManualLocationInput } from '../logic/advisorLocation.js';

import { parseCustomerWish, wishesToSummaryChips } from '../services/wish/wishParser.js';

import { matchVehiclesToWish } from '../services/wish/wishMatchEngine.js';

import { toggleCompareSlug } from '../services/customerCompareService.js';

import './FahrzeugePage.css';

import '../components/wish/wish.css';



const DEFAULT_FILTERS = {

  query: '',

  city: '',

  plz: '',

  locLabel: '',

  locSkip: false,

  radius: null,

  maxRate: null,

  maxPrice: null,

  type: 'all',

  fuel: '',

  payment: '',

  model: '',

  trim: '',

  brand: '',

  availability: '',

  household: '',

  termMonths: 48,

  mileagePerYear: 10000,

  sort: 'best',

  seo: '',

  features: [],

};



export default function FahrzeugePage() {

  const location = useLocation();

  const navigate = useNavigate();

  const [editChip, setEditChip] = useState(null);

  const [editValue, setEditValue] = useState('');

  const [lensExpandSignal, setLensExpandSignal] = useState(0);

  const [desktopRefineOpen, setDesktopRefineOpen] = useState(false);



  const filters = useMemo(

    () => filtersFromSearchParams(new URLSearchParams(location.search)),

    [location.search],

  );



  const localized = hasLocalizedSearch(filters);

  const locationLabel = useMemo(

    () => getLocationDisplayLabel({

      city: filters.city,

      plz: filters.plz,

      label: filters.locLabel,

    }),

    [filters.city, filters.plz, filters.locLabel],

  );



  const wishes = useMemo(

    () => parseCustomerWish(filters.query, filters.features),

    [filters.query, filters.features],

  );



  const summaryChips = useMemo(

    () => wishesToSummaryChips(wishes, {

      locationLabel,

      localized,

      radius: filters.radius ?? 25,

    }),

    [wishes, locationLabel, localized, filters.radius],

  );



  const filtered = useMemo(() => {

    const base = filterMarketplaceVehicles(MARKETPLACE_VEHICLES, filters);

    return base.map((vehicle) => ({

      ...vehicle,

      displayRate: adjustRateForTerm(vehicle.monthlyRate, filters.termMonths),

    }));

  }, [filters]);



  const wishMatches = useMemo(

    () => matchVehiclesToWish({

      wishes,

      vehicles: filtered,

      getDisplayRate: (v) => v.displayRate,

    }),

    [wishes, filtered],

  );



  const fallbackSuggestions = useMemo(

    () => (wishMatches.length === 0 ? buildSearchFallbackSuggestions(filters, MARKETPLACE_VEHICLES) : []),

    [wishMatches.length, filters],

  );



  const cleverInsights = useMemo(

    () => buildCleverInsights({

      filters,

      vehicles: MARKETPLACE_VEHICLES,

      wishes,

      wishMatches,

      maxInsights: 3,

    }),

    [filters, wishes, wishMatches],

  );



  const mobileInsight = useMemo(

    () => pickMobileInsight(cleverInsights),

    [cleverInsights],

  );



  const topMatch = wishMatches[0] ?? null;

  const restMatches = wishMatches.slice(1, 9);

  const hasResults = wishMatches.length > 0;



  function pushFilters(next) {

    navigate(buildFahrzeugeSearchUrl(next));

  }



  function patchFilters(patch) {

    pushFilters({ ...filters, ...patch });

  }



  function resetFilters() {

    pushFilters({ ...DEFAULT_FILTERS, query: filters.query });

  }



  function handleAllowLocation() {

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(

      () => {

        patchFilters({ city: 'Göppingen', plz: '73033', radius: 25, locSkip: false });

        setEditChip(null);

      },

      () => {},

      { timeout: 8000 },

    );

  }



  function handleEditChip(chip) {

    if (chip.field === 'feature') {

      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {

        setDesktopRefineOpen(true);

      } else {

        setLensExpandSignal((n) => n + 1);

      }

      return;

    }

    setEditChip(chip);

    if (chip.field === 'maxRate') {

      setEditValue(String(filters.maxRate ?? '').replace(/\D/g, ''));

    } else if (chip.field === 'location') {

      setEditValue(filters.city || filters.plz || '');

    } else {

      setEditValue('');

    }

  }



  function saveChipEdit() {

    if (!editChip) return;

    const val = editValue.trim();

    if (editChip.field === 'maxRate') patchFilters({ maxRate: Number(val) || null });

    else if (editChip.field === 'location') {

      const loc = parseManualLocationInput(val);

      if (loc) patchFilters({ city: loc.city ?? '', plz: loc.plz ?? '', radius: filters.radius ?? 25 });

    }

    setEditChip(null);

  }



  function viewOffer(vehicle) {

    navigate(getVehicleOfferPath(vehicle));

  }



  function viewWishDetail(vehicle) {

    const params = new URLSearchParams(location.search);

    params.set('wunsch', '1');

    navigate(`/fahrzeug/${vehicle.slug}?${params.toString()}`);

  }



  function handleCompare() {

    const slugs = wishMatches.slice(0, 3).map((m) => m.slug);

    slugs.forEach((s) => toggleCompareSlug(s));

    const params = new URLSearchParams(location.search);

    params.set('slugs', slugs.join(','));

    navigate(`/compare?${params.toString()}`);

  }



  function applyFallbackSuggestion(suggestion) {

    patchFilters(suggestion.patch);

  }



  function applyCleverInsight(insight) {

    patchFilters(insight.patch);

  }



  return (

    <PageShell>

      <div className="marketplace-page marketplace-page--results-v2 marketplace-page--wish marketplace-page--magic-lens">

        <div className="marketplace-page__container">

          {(hasResults || summaryChips.length > 0) && (

            <WishSummaryBar chips={summaryChips} onEditChip={handleEditChip} />

          )}



          <CleverInsightsPanel

            className="clever-insights--desktop"

            insights={cleverInsights}

            onApply={applyCleverInsight}

          />



          <DesktopSearchRefine

            filters={filters}

            onPatch={patchFilters}

            open={desktopRefineOpen}

            onToggleOpen={setDesktopRefineOpen}

          />



          {topMatch && (

            <WishTopMatchCard

              match={topMatch}

              onViewOffer={viewOffer}

              onAdjustWishes={() => {

                if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {

                  setDesktopRefineOpen(true);

                } else {

                  setLensExpandSignal((n) => n + 1);

                }

              }}

              onCompare={handleCompare}

            />

          )}



          {restMatches.length > 0 && (

            <section className="wish-grid-list" aria-label="Weitere passende Angebote">

              <h2 className="wish-grid-list__title">Weitere passende Angebote</h2>

              <div className="wish-grid-list__grid">

                {restMatches.map((match) => (

                  <WishVehicleGridCard

                    key={match.vehicleId}

                    match={match}

                    onViewOffer={() => viewWishDetail(match.vehicle)}

                  />

                ))}

              </div>

            </section>

          )}



          {!hasResults && (

            <NoExactMatchPanel

              suggestions={fallbackSuggestions}

              onSelectSuggestion={applyFallbackSuggestion}

            />

          )}

        </div>



        <MagicLensDrawer

          filters={filters}

          onChange={pushFilters}

          onReset={resetFilters}

          expandSignal={lensExpandSignal}

          mobileTip={mobileInsight}

          onApplyTip={applyCleverInsight}

        />



        {editChip && (

          <div className="chip-edit-overlay" onClick={() => setEditChip(null)} role="presentation">

            <div className="chip-edit-sheet" onClick={(e) => e.stopPropagation()}>

              <strong>{editChip.label} ändern</strong>

              <input

                value={editValue}

                onChange={(e) => setEditValue(e.target.value)}

                placeholder={editChip.field === 'location' ? 'PLZ oder Ort' : undefined}

                autoFocus

              />

              {editChip.field === 'location' && !localized && (

                <button type="button" className="chip-edit-sheet__geo" onClick={handleAllowLocation}>

                  Standort freigeben

                </button>

              )}

              <button type="button" onClick={saveChipEdit}>Übernehmen</button>

            </div>

          </div>

        )}

      </div>

    </PageShell>

  );

}


