import { useState, useMemo } from 'react';
import {
  isBrandActive,
  isModelActive,
  flattenCatalogModels,
} from '../../logic/brandResultsFilter.js';
import './results-brand-model-filter.css';

const MOBILE_PREVIEW = 4;

function BookingChip({ active, label, count, onClick, size = 'md' }) {
  return (
    <button
      type="button"
      className={`rbmf-chip rbmf-chip--${size}${active ? ' is-active' : ' is-off'}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="rbmf-chip__label">{label}</span>
      <span className="rbmf-chip__meta">
        <span className="rbmf-chip__count">{count}</span>
        {active && <span className="rbmf-chip__check" aria-hidden="true">✓</span>}
      </span>
    </button>
  );
}

function BrandModelPanel({
  catalog,
  excludedBrands,
  excludedModels,
  onToggleBrand,
  onToggleModel,
  layout = 'flat',
}) {
  const { brands } = catalog;

  return (
    <div className={`rbmf-panel rbmf-panel--${layout}`}>
      <div className="rbmf-panel__section">
        <p className="rbmf-panel__section-label">Marken</p>
        <div className="rbmf-panel__chips" role="group" aria-label="Marken">
          {brands.map((b) => {
            const active = isBrandActive(b.id, excludedBrands);
            return (
              <BookingChip
                key={b.id}
                active={active}
                label={b.label}
                count={b.count}
                onClick={() => onToggleBrand?.(b.id)}
              />
            );
          })}
        </div>
      </div>

      {brands.some((b) => b.models?.length) && (
        <div className="rbmf-panel__section rbmf-panel__section--models">
          <p className="rbmf-panel__section-label">Modelle</p>
          {layout === 'flat' ? (
            <div className="rbmf-panel__chips" role="group" aria-label="Modelle">
              {brands.map((b) =>
                (b.models ?? []).map((m) => {
                  const active = isModelActive(m.id, excludedModels, excludedBrands, b.id);
                  return (
                    <BookingChip
                      key={m.id}
                      size="sm"
                      active={active}
                      label={m.label}
                      count={m.count}
                      onClick={() => onToggleModel?.(m.id)}
                    />
                  );
                }),
              )}
            </div>
          ) : (
            brands.map((b) => {
              if (!b.models?.length) return null;
              return (
                <div key={b.id} className="rbmf-brand-group">
                  <p className="rbmf-brand-group__name">{b.label}</p>
                  <div className="rbmf-panel__chips" role="group" aria-label={`Modelle ${b.label}`}>
                    {b.models.map((m) => {
                      const active = isModelActive(m.id, excludedModels, excludedBrands, b.id);
                      return (
                        <BookingChip
                          key={m.id}
                          size="sm"
                          active={active}
                          label={m.label}
                          count={m.count}
                          onClick={() => onToggleModel?.(m.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MobileChipRow({
  items,
  excludedBrands,
  excludedModels,
  onToggleBrand,
  onToggleModel,
  type,
  limit,
}) {
  const shown = items.slice(0, limit);
  return (
    <div className="rbmf-mobile-preview__chips">
      {shown.map((item) => {
        const active = type === 'brand'
          ? isBrandActive(item.id, excludedBrands)
          : isModelActive(item.id, excludedModels, excludedBrands, item.brandId);
        const onClick = type === 'brand'
          ? () => onToggleBrand?.(item.id)
          : () => onToggleModel?.(item.id);
        return (
          <BookingChip
            key={item.id}
            size="sm"
            active={active}
            label={item.label}
            count={item.count}
            onClick={onClick}
          />
        );
      })}
    </div>
  );
}

export default function ResultsBrandModelFilter({
  catalog = { brands: [] },
  excludedBrands = [],
  excludedModels = [],
  onToggleBrand,
  onToggleModel,
  showSection = true,
  visibleCount = 0,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const brands = catalog.brands ?? [];
  const flatModels = useMemo(() => flattenCatalogModels(catalog), [catalog]);

  if (!showSection || brands.length === 0) return null;

  const brandsOverflow = brands.length > MOBILE_PREVIEW;
  const modelsOverflow = flatModels.length > MOBILE_PREVIEW;
  const needsMobileSheet = brandsOverflow || modelsOverflow;

  const sheetCta = visibleCount > 0
    ? `${visibleCount} Angebote`
    : 'Fertig';

  return (
    <div className="rbmf-block" aria-label="Marken und Modelle">
      <div className="rbmf-mobile">
        {brands.length > 0 && (
          <div className="rbmf-mobile-preview">
            <p className="rbmf-panel__section-label">Marken</p>
            <MobileChipRow
              items={brands}
              excludedBrands={excludedBrands}
              excludedModels={excludedModels}
              onToggleBrand={onToggleBrand}
              onToggleModel={onToggleModel}
              type="brand"
              limit={brandsOverflow ? MOBILE_PREVIEW : brands.length}
            />
          </div>
        )}

        {flatModels.length > 0 && (
          <div className="rbmf-mobile-preview">
            <p className="rbmf-panel__section-label">Modelle</p>
            <MobileChipRow
              items={flatModels}
              excludedBrands={excludedBrands}
              excludedModels={excludedModels}
              onToggleBrand={onToggleBrand}
              onToggleModel={onToggleModel}
              type="model"
              limit={modelsOverflow ? MOBILE_PREVIEW : flatModels.length}
            />
          </div>
        )}

        {needsMobileSheet && (
          <button
            type="button"
            className="rbmf-mobile__more"
            onClick={() => setSheetOpen(true)}
          >
            Alle anzeigen
          </button>
        )}
      </div>

      <div className="rbmf-desktop">
        <BrandModelPanel
          catalog={catalog}
          excludedBrands={excludedBrands}
          excludedModels={excludedModels}
          onToggleBrand={onToggleBrand}
          onToggleModel={onToggleModel}
          layout="flat"
        />
      </div>

      {sheetOpen && (
        <div
          className="rbmf-sheet"
          role="presentation"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="rbmf-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rbmf-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="rbmf-sheet__close"
              onClick={() => setSheetOpen(false)}
              aria-label="Schließen"
            >
              ×
            </button>
            <h2 id="rbmf-sheet-title" className="rbmf-sheet__title">
              Marken &amp; Modelle
            </h2>
            <BrandModelPanel
              catalog={catalog}
              excludedBrands={excludedBrands}
              excludedModels={excludedModels}
              onToggleBrand={onToggleBrand}
              onToggleModel={onToggleModel}
              layout="grouped"
            />
            <button
              type="button"
              className="rbmf-sheet__apply"
              onClick={() => setSheetOpen(false)}
            >
              {sheetCta}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
