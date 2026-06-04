import { useMemo, useState } from 'react';



import { useLocation, useNavigate } from 'react-router-dom';



import PageShell from '../components/layout/PageShell';



import CleverInsightsPanel from '../components/search/CleverInsightsPanel.jsx';



import DesktopSearchRefine from '../components/search/DesktopSearchRefine.jsx';



import MagicLensDrawer from '../components/magic-lens/MagicLensDrawer.jsx';



import DiscoveryResultsView from '../components/discovery/DiscoveryResultsView.jsx';



import { getMarketplaceVehiclePool } from '../data/marketplacePool.js';

const MARKETPLACE_VEHICLES = getMarketplaceVehiclePool();



import { filterMarketplaceVehicles } from '../logic/marketplaceService.js';



import { buildCleverInsights, pickMobileInsight } from '../logic/cleverInsightsService.js';



import {



  filtersFromSearchParams,



  buildFahrzeugeSearchUrl,



  hasLocalizedSearch,



  adjustRateForTerm,



  resolveFiltersWithIntent,



} from '../logic/oneSearchService.js';



import { parseCustomerWish } from '../services/wish/wishParser.js';
import { applyPlausibilityCorrection } from '../services/search/plausibilityChecker.js';



import { matchVehiclesToWish } from '../services/wish/wishMatchEngine.js';



import { toggleCompareSlug } from '../services/customerCompareService.js';

import { buildNeverEmptyResults } from '../logic/neverEmptyResultsService.js';
import {
  extractResultCatalogFromVehicles,
  toggleExcludedBrand,
  toggleExcludedModel,
  computeOfferStats,
  collectVehiclesFromResults,
} from '../logic/brandResultsFilter.js';
import {
  detectSearchConflict,
  applyConflictToFilters,
  mergeSearchConflicts,
  resolveSearchConflict,
} from '../services/search/searchConflictHint.js';
import { parseSearchIntent } from '../services/search/searchIntentParser.js';

import SearchChipEditor from '../components/search/SearchChipEditor.jsx';



import './FahrzeugePage.css';



import '../components/wish/wish.css';

import '../components/discovery/discovery-results.css';







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

  modelExplicit: false,

  excludedBrands: [],

  excludedModels: [],

};







export default function FahrzeugePage() {



  const location = useLocation();



  const navigate = useNavigate();



  const [editChip, setEditChip] = useState(null);



  const [lensExpandSignal, setLensExpandSignal] = useState(0);



  const [desktopRefineOpen, setDesktopRefineOpen] = useState(false);



  const filters = useMemo(() => {
    let f = resolveFiltersWithIntent(
      filtersFromSearchParams(new URLSearchParams(location.search)),
    );
    const intentConflict = detectSearchConflict(parseSearchIntent(f.query ?? ''));
    f = applyConflictToFilters(f, intentConflict);
    return f;
  }, [location.search]);

  const localized = hasLocalizedSearch(filters);

  const wishes = useMemo(() => {
    const w = parseCustomerWish(filters.query, filters.features);
    if (filters.modelExplicit && filters.model) {
      w.model = filters.model;
      w.brand = filters.brand || w.brand;
      w.trim = filters.trim || w.trim;
    } else {
      w.model = null;
      w.trim = null;
      w.brand = null;
    }
    if (filters.maxRate) {
      w.budget = { ...w.budget, maxMonthlyRate: filters.maxRate, type: filters.payment || 'leasing' };
    }
    if (filters.fuel === 'elektro' && !w.features.includes('elektro')) {
      w.features = [...w.features, 'elektro'];
    }
    return w;
  }, [filters]);

  const vehiclesForCatalogPool = useMemo(() => {
    const base = filterMarketplaceVehicles(MARKETPLACE_VEHICLES, {
      ...filters,
      excludedBrands: [],
      excludedModels: [],
    });
    return base.map((vehicle) => ({
      ...vehicle,
      displayRate: adjustRateForTerm(vehicle.monthlyRate, filters.termMonths),
    }));
  }, [filters]);

  const matchesForCatalog = useMemo(
    () => matchVehiclesToWish({
      wishes,
      vehicles: vehiclesForCatalogPool,
      getDisplayRate: (v) => v.displayRate,
    }),
    [wishes, vehiclesForCatalogPool],
  );

  const neverEmptyForCatalog = useMemo(
    () => buildNeverEmptyResults({
      filters: { ...filters, excludedBrands: [], excludedModels: [] },
      wishes,
      exactMatches: matchesForCatalog,
      allVehicles: MARKETPLACE_VEHICLES,
    }),
    [filters, wishes, matchesForCatalog],
  );

  const catalogPoolVehicles = useMemo(() => {
    const fromResults = collectVehiclesFromResults(neverEmptyForCatalog);
    if (fromResults.length > 0) return fromResults;
    return vehiclesForCatalogPool;
  }, [neverEmptyForCatalog, vehiclesForCatalogPool]);

  const resultCatalog = useMemo(
    () => extractResultCatalogFromVehicles(catalogPoolVehicles),
    [catalogPoolVehicles],
  );

  const searchConflict = useMemo(
    () => mergeSearchConflicts(
      detectSearchConflict(parseSearchIntent(filters.query ?? '')),
      { ...filters, _catalogBrandCount: resultCatalog.brands.length },
    ),
    [filters, resultCatalog.brands.length],
  );

  function handleToggleBrand(brandId) {
    patchFilters({
      excludedBrands: toggleExcludedBrand(filters.excludedBrands, brandId),
    });
  }

  function handleResolveSearchConflict() {
    pushFilters(resolveSearchConflict(filters, searchConflict));
  }

  function handleToggleModel(modelId) {
    patchFilters({
      excludedModels: toggleExcludedModel(filters.excludedModels, modelId),
    });
  }

  function handleShowAllBrands() {
    patchFilters({ excludedBrands: [], excludedModels: filters.excludedModels });
  }

  function handleResetSearch() {
    navigate('/fahrzeuge');
  }






  const filtered = useMemo(() => {



    const base = filterMarketplaceVehicles(MARKETPLACE_VEHICLES, filters);



    return base.map((vehicle) => ({



      ...vehicle,



      displayRate: adjustRateForTerm(vehicle.monthlyRate, filters.termMonths),



    }));



  }, [filters]);







  const exactMatches = useMemo(



    () => matchVehiclesToWish({



      wishes,



      vehicles: filtered,



      getDisplayRate: (v) => v.displayRate,



    }),



    [wishes, filtered],



  );







  const neverEmptyResults = useMemo(
    () => buildNeverEmptyResults({
      filters,
      wishes,
      exactMatches,
      allVehicles: MARKETPLACE_VEHICLES,
    }),
    [filters, wishes, exactMatches],
  );

  const offerStats = useMemo(
    () => computeOfferStats(
      catalogPoolVehicles,
      filters.excludedBrands,
      filters.excludedModels,
    ),
    [catalogPoolVehicles, filters.excludedBrands, filters.excludedModels],
  );

  const displayResults = useMemo(() => {
    const allHidden = resultCatalog.brands.length > 0
      && resultCatalog.brands.every((b) => filters.excludedBrands?.includes(b.id));
    if (!allHidden) return neverEmptyResults;
    return {
      ...neverEmptyResults,
      topMatch: null,
      restMatches: [],
      alternativeMatches: [],
      popularMatches: [],
      showAlternativeSection: false,
      status: null,
    };
  }, [neverEmptyResults, resultCatalog.brands, filters.excludedBrands]);






  const cleverInsights = useMemo(



    () => buildCleverInsights({



      filters,



      vehicles: MARKETPLACE_VEHICLES,



      wishes,



      wishMatches: exactMatches,



      maxInsights: 3,



    }),



    [filters, wishes, exactMatches],



  );







  const mobileInsight = useMemo(



    () => pickMobileInsight(cleverInsights),



    [cleverInsights],



  );







  function pushFilters(next) {



    navigate(buildFahrzeugeSearchUrl(next));



  }







  function patchFilters(patch) {



    pushFilters({ ...filters, ...patch });



  }



  function handlePlausibilityChoice(correction, accept) {



    pushFilters(applyPlausibilityCorrection(filters, correction, accept));



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
    setEditChip(chip);
  }

  function handleOpenSearchFromChip() {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setDesktopRefineOpen(true);
    } else {
      setLensExpandSignal((n) => n + 1);
    }
  }







  function viewWishDetail(vehicle) {



    const params = new URLSearchParams(location.search);



    params.set('wunsch', '1');



    navigate(`/fahrzeug/${vehicle.slug}?${params.toString()}`);



  }







  function handleCompare() {



    const slugs = exactMatches.slice(0, 3).map((m) => m.slug);



    slugs.forEach((s) => toggleCompareSlug(s));



    const params = new URLSearchParams(location.search);



    params.set('slugs', slugs.join(','));



    navigate(`/compare?${params.toString()}`);



  }







  function applyCleverInsight(insight) {



    patchFilters(insight.patch);



  }



  function handleExpandDealerRadius() {

    patchFilters({ radius: 50 });

  }



  function handleCustomizeVehicle() {

    if (neverEmptyResults.topMatch?.vehicle) {

      viewWishDetail(neverEmptyResults.topMatch.vehicle);

    }

  }



  function handleMoreFromDealer() {

    const slug = neverEmptyResults.topMatch?.vehicle?.dealerSlug;

    if (slug) navigate(`/haendler/${slug}`);

  }



  function handleLocationSubmit(loc) {

    patchFilters({

      city: loc.city ?? '',

      plz: loc.plz ?? '',

      locLabel: loc.city || loc.plz || '',

      radius: loc.radius ?? 25,

      locSkip: false,

    });

  }







  return (



    <PageShell>



      <div className="marketplace-page marketplace-page--results-v2 marketplace-page--wish marketplace-page--magic-lens marketplace-page--discovery">



        <div className="marketplace-page__container">



          <DiscoveryResultsView

            filters={filters}

            wishes={wishes}

            results={displayResults}
            offerStats={offerStats}

            onEditChip={handleEditChip}

            onViewOffer={viewWishDetail}

            onCustomize={handleCustomizeVehicle}

            onCompare={handleCompare}

            onExpandRadius={handleExpandDealerRadius}

            onAllowLocation={handleAllowLocation}

            onLocationSubmit={handleLocationSubmit}

            onPatchFilters={patchFilters}

            onPlausibilityChoice={handlePlausibilityChoice}

            resultCatalog={resultCatalog}

            excludedBrands={filters.excludedBrands}

            excludedModels={filters.excludedModels}

            searchConflict={searchConflict}

            onResolveSearchConflict={handleResolveSearchConflict}

            onToggleBrand={handleToggleBrand}

            onToggleModel={handleToggleModel}

            onShowAllBrands={handleShowAllBrands}

            onResetSearch={handleResetSearch}

            onDealerProfile={handleMoreFromDealer}

            onEditSearch={handleOpenSearchFromChip}

            refineSlot={(

              <>

                <DesktopSearchRefine

                  filters={filters}

                  onPatch={patchFilters}

                  open={desktopRefineOpen}

                  onToggleOpen={setDesktopRefineOpen}

                />

                <CleverInsightsPanel

                  className="clever-insights--desktop"

                  insights={cleverInsights}

                  onApply={applyCleverInsight}

                />

              </>

            )}

          />



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

          <SearchChipEditor

            chip={editChip}

            filters={filters}

            localized={localized}

            onClose={() => setEditChip(null)}

            onApply={patchFilters}

            onAllowLocation={handleAllowLocation}

            onOpenSearch={handleOpenSearchFromChip}

          />

        )}



      </div>



    </PageShell>



  );



}



