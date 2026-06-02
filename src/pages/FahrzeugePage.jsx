import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import {
  SearchUnderstandingChips,
  LocationPromptDialog,
  TopRecommendationCard,
  OfferFilterChips,
} from '../components/search/SearchFlowComponents.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import {
  filterMarketplaceVehicles,
  getAvailabilityMeta,
  formatCurrency,
} from '../logic/marketplaceService.js';
import {
  filtersFromSearchParams,
  buildFahrzeugeSearchUrl,
  buildUnderstandingChips,
  needsLocationPrompt,
  sortMarketplaceVehicles,
  adjustRateForTerm,
  getVehicleOfferPath,
  TERM_CHIP_OPTIONS,
  MILEAGE_CHIP_OPTIONS,
  RADIUS_CHIP_OPTIONS,
  SORT_CHIP_OPTIONS,
} from '../logic/oneSearchService.js';
import { parseManualLocationInput } from '../logic/advisorLocation.js';
import './FahrzeugePage.css';

export default function FahrzeugePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [editChip, setEditChip] = useState(null);
  const [editValue, setEditValue] = useState('');

  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(location.search)),
    [location.search],
  );

  useEffect(() => {
    if (needsLocationPrompt(filters)) {
      setLocDialogOpen(true);
    }
  }, [filters.city, filters.plz, filters.locSkip, filters.locLabel]);

  const chips = useMemo(() => buildUnderstandingChips(filters), [filters]);

  const filtered = useMemo(() => {
    const base = filterMarketplaceVehicles(MARKETPLACE_VEHICLES, {
      ...filters,
      q: filters.city || filters.plz || '',
    });
    return sortMarketplaceVehicles(base, filters.sort).map((vehicle) => ({
      ...vehicle,
      displayRate: adjustRateForTerm(vehicle.monthlyRate, filters.termMonths),
    }));
  }, [filters]);

  const topPick = filtered[0] ?? null;
  const rest = filtered.slice(1);

  function pushFilters(next) {
    navigate(buildFahrzeugeSearchUrl(next));
  }

  function patchFilters(patch) {
    pushFilters({ ...filters, ...patch });
  }

  function handleAllowLocation() {
    if (!navigator.geolocation) {
      setLocDialogOpen(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        patchFilters({ city: 'Göppingen', plz: '73033', radius: 25, locSkip: false });
        setLocDialogOpen(false);
      },
      () => setLocDialogOpen(true),
      { timeout: 8000 },
    );
  }

  function handleManualLocation(value) {
    const loc = parseManualLocationInput(value);
    if (!loc) return;
    patchFilters({
      city: loc.city ?? '',
      plz: loc.plz ?? '',
      radius: filters.radius ?? 25,
      locSkip: false,
    });
    setLocDialogOpen(false);
  }

  function handleEditChip(chip) {
    setEditChip(chip);
    setEditValue(chip.label.replace(/^bis\s/, '').replace(/\s€.*$/, '').replace(/\skm$/, ''));
  }

  function saveChipEdit() {
    if (!editChip) return;
    const val = editValue.trim();
    if (editChip.field === 'model') patchFilters({ model: val });
    else if (editChip.field === 'trim') patchFilters({ trim: val });
    else if (editChip.field === 'maxRate') patchFilters({ maxRate: Number(val) || null });
    else if (editChip.field === 'location') {
      const loc = parseManualLocationInput(val);
      if (loc) patchFilters({ city: loc.city ?? '', plz: loc.plz ?? '' });
    }
    setEditChip(null);
  }

  function viewOffer(vehicle) {
    navigate(getVehicleOfferPath(vehicle));
  }

  return (
    <PageShell>
      <div className="marketplace-page marketplace-page--one-search">
        <div className="marketplace-page__container">
          <header className="marketplace-head">
            <h1>Passende Fahrzeuge</h1>
            <p>Echte Angebote von Händlern in Ihrer Nähe – basierend auf Ihrer Beschreibung.</p>
          </header>

          <SearchUnderstandingChips chips={chips} onEditChip={handleEditChip} />

          <OfferFilterChips
            filters={filters}
            termOptions={TERM_CHIP_OPTIONS}
            mileageOptions={MILEAGE_CHIP_OPTIONS}
            radiusOptions={RADIUS_CHIP_OPTIONS}
            sortOptions={SORT_CHIP_OPTIONS}
            onChangeTerm={(termMonths) => patchFilters({ termMonths })}
            onChangeMileage={(mileagePerYear) => patchFilters({ mileagePerYear })}
            onChangeRadius={(radius) => patchFilters({ radius })}
            onChangeSort={(sort) => patchFilters({ sort })}
          />

          {topPick && (
            <TopRecommendationCard
              vehicle={topPick}
              termMonths={filters.termMonths}
              onViewOffer={viewOffer}
            />
          )}

          {rest.length > 0 && (
            <section className="market-list-section">
              <h2>Weitere passende Fahrzeuge</h2>
              <div className="marketplace-results">
                {rest.map((vehicle) => {
                  const availability = getAvailabilityMeta(vehicle.availability);
                  return (
                    <article key={vehicle.id} className="market-list-card card">
                      <VehicleImage brand={vehicle.brand} model={vehicle.imageModel} className="market-card__image" />
                      <div className="market-list-card__body">
                        <h3>{vehicle.title}</h3>
                        <p className="market-list-card__rate">
                          {formatCurrency(vehicle.displayRate)}/Monat
                        </p>
                        <p>{vehicle.discountPercent}% Rabatt · {vehicle.deliveryTime}</p>
                        <p>{vehicle.dealerName} · {vehicle.distanceKm} km</p>
                        <p className={`market-card__availability market-card__availability--${availability.color}`}>
                          {availability.label}
                        </p>
                        <div className="market-list-card__actions">
                          <Link to={getVehicleOfferPath(vehicle)}>Angebot ansehen</Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <p className="marketplace-empty card">
              Keine Treffer. Chips anpassen oder Radius erweitern.
            </p>
          )}
        </div>

        <LocationPromptDialog
          open={locDialogOpen}
          onAllowLocation={handleAllowLocation}
          onManualSubmit={handleManualLocation}
          onDismiss={() => {
            patchFilters({ locSkip: true });
            setLocDialogOpen(false);
          }}
        />

        {editChip && (
          <div className="chip-edit-overlay" onClick={() => setEditChip(null)} role="presentation">
            <div className="chip-edit-sheet" onClick={(e) => e.stopPropagation()}>
              <strong>{editChip.label} ändern</strong>
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={saveChipEdit}>Übernehmen</button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
