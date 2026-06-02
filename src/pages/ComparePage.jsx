import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import WishCompareTable from '../components/wish/WishCompareTable.jsx';
import { WishSummaryBar } from '../components/wish/WishChips.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import { filterMarketplaceVehicles } from '../logic/marketplaceService.js';
import {
  filtersFromSearchParams,
  buildFahrzeugeSearchUrl,
  adjustRateForTerm,
} from '../logic/oneSearchService.js';
import { parseCustomerWish, wishesToSummaryChips } from '../services/wish/wishParser.js';
import { matchVehiclesToWish } from '../services/wish/wishMatchEngine.js';
import { loadCompareSlugs } from '../services/customerCompareService.js';
import '../components/wish/wish.css';

export default function ComparePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);

  const slugs = useMemo(() => {
    const fromUrl = (searchParams.get('slugs') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (fromUrl.length) return fromUrl;
    return loadCompareSlugs();
  }, [location.search]);

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [location.search],
  );

  const wishes = useMemo(
    () => parseCustomerWish(filters.query, filters.features),
    [filters.query, filters.features],
  );

  const summaryChips = useMemo(
    () => wishesToSummaryChips(wishes),
    [wishes],
  );

  const matches = useMemo(() => {
    const vehicles = MARKETPLACE_VEHICLES.filter((v) => slugs.includes(v.slug));
    const filtered = filterMarketplaceVehicles(vehicles, filters).map((vehicle) => ({
      ...vehicle,
      displayRate: adjustRateForTerm(vehicle.monthlyRate, filters.termMonths),
    }));
    const ranked = matchVehiclesToWish({
      wishes,
      vehicles: filtered,
      getDisplayRate: (v) => v.displayRate,
    });
    return slugs
      .map((slug) => ranked.find((m) => m.slug === slug))
      .filter(Boolean);
  }, [slugs, filters, wishes]);

  const wishFeatureIds = wishes.features.filter(
    (f) => !['family_suv', 'elektro', 'benzin'].includes(f),
  );

  return (
    <PageShell>
      <div className="wish-compare-page">
        <header className="wish-compare-page__head">
          <Link to={buildFahrzeugeSearchUrl(filters)} className="wish-compare-page__back">
            ← Zurück zu den Ergebnissen
          </Link>
          <h1>Wunschvergleich</h1>
          <p>Vergleichen Sie Fahrzeuge nach Ihren Wünschen – nicht nur nach technischen Daten.</p>
        </header>

        {summaryChips.length > 0 && (
          <WishSummaryBar chips={summaryChips} />
        )}

        {matches.length >= 2 ? (
          <WishCompareTable matches={matches} wishFeatureIds={wishFeatureIds} />
        ) : (
          <div className="wish-compare-page__empty">
            <p>Wählen Sie mindestens zwei Fahrzeuge auf der Ergebnisseite aus.</p>
            <button type="button" onClick={() => navigate(buildFahrzeugeSearchUrl(filters))}>
              Zur Fahrzeugsuche
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
