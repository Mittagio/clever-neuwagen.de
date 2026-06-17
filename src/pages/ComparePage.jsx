import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import CompareResultsHub from '../components/compare/CompareResultsHub.jsx';
import { WishSummaryBar } from '../components/wish/WishChips.jsx';
import { getMarketplaceVehiclePool } from '../data/marketplacePool.js';

const MARKETPLACE_VEHICLES = getMarketplaceVehiclePool();
import { filterMarketplaceVehicles } from '../logic/marketplaceService.js';
import {
  filtersFromSearchParams,
  buildFahrzeugeSearchUrl,
  adjustRateForTerm,
} from '../logic/oneSearchService.js';
import { parseCustomerWish, wishesToSummaryChips } from '../services/wish/wishParser.js';
import { matchVehiclesToWish } from '../services/wish/wishMatchEngine.js';
import { hasCleverQuoteWishes } from '../services/cleverQuote/cleverQuoteService.js';
import { loadCompareSlugs } from '../services/customerCompareService.js';
import '../components/wish/wish.css';
import '../components/compare/compare-mobile.css';

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

  const paymentMode = filters.payment ?? 'leasing';

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
    return ranked.filter((m) => slugs.includes(m.slug));
  }, [slugs, filters, wishes]);

  const useCleverQuote = hasCleverQuoteWishes(wishes);

  function viewVehicle(match) {
    const slug = match?.slug ?? match?.vehicle?.slug;
    if (!slug) return;
    const params = new URLSearchParams(location.search);
    params.delete('slugs');
    params.set('wunsch', '1');
    navigate(`/fahrzeug/${slug}?${params.toString()}`);
  }

  return (
    <PageShell>
      <div className="wish-compare-page wish-compare-page--mf3">
        <header className="wish-compare-page__head">
          <Link to={buildFahrzeugeSearchUrl(filters)} className="wish-compare-page__back">
            ← Zurück zu den Ergebnissen
          </Link>
          <h1>{useCleverQuote ? 'Welches passt besser?' : 'Wunschvergleich'}</h1>
          <p>
            {useCleverQuote
              ? 'Vergleichen Sie Fahrzeuge nach CleverQuote™ – Passung vor Ausstattungscodes.'
              : 'Vergleichen Sie Fahrzeuge nach Ihren Wünschen – nicht nur nach technischen Daten.'}
          </p>
        </header>

        {summaryChips.length > 0 && (
          <WishSummaryBar chips={summaryChips} />
        )}

        {matches.length >= 2 ? (
          <CompareResultsHub
            matches={matches}
            paymentMode={paymentMode}
            wishes={wishes}
            onViewVehicle={viewVehicle}
          />
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

