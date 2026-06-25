import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { filterAccessoryIdsForTrim, buildConfigureOptions } from '../../services/vehicleConfiguration.js';
import {
  buildBaseDraftForVariant,
  buildConfiguratorSummaryLine,
  buildDraftFromSelectionVariant,
  buildPackageWishStatus,
  buildVariantPackageCatalog,
  buildWishAlignmentRows,
  computeVariantConfiguratorPreview,
  draftToSelectionVariantFields,
  duplicateSelectionGroupVariant,
  formatConfiguratorDelta,
  formatConfiguratorRate,
  formatPackageMonthlyDelta,
  VARIANT_DOWN_OPTIONS,
  VARIANT_MILEAGE_OPTIONS,
  VARIANT_TERM_OPTIONS,
} from '../../services/sales/offerVariantConfigurator.js';
import { OFFER_VARIANT_STATUS } from '../../services/sales/offerSelectionGroup.js';
import { FlowChip } from './flow/OfferFlowComponents.jsx';
import './OfferVariantConfigurator.css';

function VariantPackageCard({
  pkg,
  paymentType,
  wishStatus,
  onAdd,
  onRemove,
}) {
  const isSelected = pkg.status === 'selected';
  const isIncluded = pkg.status === 'included';
  const isBlocked = pkg.status === 'blocked';
  const priceLine = formatPackageMonthlyDelta(pkg, paymentType);

  return (
    <article className={`ovc__package${isSelected ? ' is-selected' : ''}${isIncluded ? ' is-included' : ''}`}>
      <div className="ovc__package-head">
        <span className="ovc__package-name">{pkg.name}</span>
        <span className="ovc__package-price">{isIncluded ? 'Serie' : priceLine}</span>
      </div>
      {pkg.highlights?.length > 0 && (
        <ul className="ovc__package-features">
          {pkg.highlights.slice(0, 5).map((item) => (
            <li key={item}>✓ {item}</li>
          ))}
        </ul>
      )}
      {wishStatus && (
        <p className="ovc__package-wish">
          {wishStatus === 'fulfilled' ? '✓ erfüllt Wunsch' : '⚠ teilweise Wunsch'}
        </p>
      )}
      {isIncluded && (
        <p className="ovc__package-wish">Bereits in Ausstattung enthalten</p>
      )}
      {isBlocked && (
        <p className="ovc__package-wish">Voraussetzungen fehlen</p>
      )}
      {!isIncluded && !isBlocked && (
        <div className="ovc__package-actions">
          {isSelected ? (
            <button type="button" className="ovc__btn" onClick={() => onRemove(pkg.id)}>
              entfernen
            </button>
          ) : (
            <button type="button" className="ovc__btn ovc__btn-primary" onClick={() => onAdd(pkg.id)}>
              hinzufügen
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Vollständiger Angebots-Konfigurator für eine Clever-Auswahl-Variante.
 */
export default function OfferVariantConfigurator({
  group,
  variant,
  lead,
  wishConditionChips = [],
  equipmentWishes = [],
  wishEquipmentText = '',
  onSave,
  onDuplicate,
  onBack,
  isSaving = false,
}) {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const [draft, setDraft] = useState(null);
  const [customDownActive, setCustomDownActive] = useState(false);
  const [customDownValue, setCustomDownValue] = useState('');

  useEffect(() => {
    const initial = buildDraftFromSelectionVariant({ group, variant, lead, conditions });
    setDraft(initial);
    const down = initial?.downPayment ?? 0;
    setCustomDownActive(!VARIANT_DOWN_OPTIONS.includes(down) && down > 0);
    setCustomDownValue(!VARIANT_DOWN_OPTIONS.includes(down) && down > 0 ? String(down) : '');
  }, [group, variant, lead, conditions]);

  const baseDraft = useMemo(() => buildBaseDraftForVariant(draft), [draft]);
  const configureOptions = useMemo(
    () => (draft ? buildConfigureOptions(draft.modelKey, draft.trimId) : { colors: [], accessories: [] }),
    [draft?.modelKey, draft?.trimId],
  );
  const catalog = useMemo(() => buildVariantPackageCatalog(draft), [draft]);
  const preview = useMemo(
    () => computeVariantConfiguratorPreview(draft, conditions, baseDraft),
    [draft, conditions, baseDraft],
  );

  const wishRows = useMemo(() => buildWishAlignmentRows({
    draft,
    wishConditionChips,
    equipmentWishes,
    wishEquipmentText,
    preview,
    catalog,
  }), [draft, wishConditionChips, equipmentWishes, wishEquipmentText, preview, catalog]);

  const patch = useCallback((partial) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const togglePackage = useCallback((packageId) => {
    if (!draft) return;
    const ids = new Set(draft.packageIds ?? []);
    if (ids.has(packageId)) ids.delete(packageId);
    else ids.add(packageId);
    patch({ packageIds: [...ids] });
  }, [draft, patch]);

  const handleCustomDownApply = () => {
    const num = Number(String(customDownValue).replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(num) && num >= 0) {
      patch({ downPayment: Math.round(num) });
    }
  };

  if (!draft || !group || !variant) return null;

  const paymentType = draft.paymentType ?? 'leasing';
  const isLeasing = paymentType === 'leasing';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';
  const modelLine = `Kia ${draft.model}`;
  const summaryLine = buildConfiguratorSummaryLine(draft);
  const selectedPackageNames = (draft.packageIds ?? [])
    .map((id) => catalog.packages.find((p) => p.id === id)?.name)
    .filter(Boolean);

  const handleSave = () => {
    const nextVariant = draftToSelectionVariantFields(variant, draft, preview, catalog);
    onSave?.(group, nextVariant);
  };

  const handleDuplicate = () => {
    const nextGroup = duplicateSelectionGroupVariant(group, variant, draft, preview, catalog);
    onDuplicate?.(nextGroup);
  };

  return (
    <div className="ovc" role="dialog" aria-label="Variante konfigurieren">
      <div className="ovc__scroll">
        <header className="ovc__header">
          <button type="button" className="ovc__back" onClick={onBack}>
            ← Zur Auswahl
          </button>
          <h1 className="ovc__title">Variante konfigurieren</h1>
          <p className="ovc__subtitle">
            {modelLine}
            {' '}
            {draft.trimLabel}
          </p>
          <div className="ovc__meta">
            <span className="ovc__badge">{preview.paymentLabel}</span>
            <span className="ovc__badge ovc__badge--rate">{formatConfiguratorRate(preview)}</span>
            <span className="ovc__badge ovc__badge--draft">
              {OFFER_VARIANT_STATUS.DRAFT === variant.status ? 'Entwurf' : variant.label}
            </span>
          </div>
        </header>

        {(isLeasing || isFinance) && (
          <section className="ovc__section" aria-labelledby="ovc-conditions-title">
            <h2 id="ovc-conditions-title" className="ovc__section-title">Konditionen</h2>

            <div className="ovc__field">
              <span className="ovc__label">Laufzeit</span>
              <div className="ovc__chips">
                {VARIANT_TERM_OPTIONS.map((months) => (
                  <FlowChip
                    key={months}
                    label={`${months} Mon.`}
                    selected={draft.termMonths === months}
                    onClick={() => patch({ termMonths: months })}
                  />
                ))}
              </div>
            </div>

            {isLeasing && (
              <div className="ovc__field">
                <span className="ovc__label">Kilometer / Jahr</span>
                <div className="ovc__chips">
                  {VARIANT_MILEAGE_OPTIONS.map((km) => (
                    <FlowChip
                      key={km}
                      label={`${(km / 1000).toLocaleString('de-DE')}k`}
                      selected={draft.mileagePerYear === km}
                      onClick={() => patch({ mileagePerYear: km })}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="ovc__field">
              <span className="ovc__label">Anzahlung</span>
              <div className="ovc__chips">
                {VARIANT_DOWN_OPTIONS.map((amount) => (
                  <FlowChip
                    key={amount}
                    label={amount === 0 ? '0 €' : `${amount.toLocaleString('de-DE')} €`}
                    selected={!customDownActive && draft.downPayment === amount}
                    onClick={() => {
                      setCustomDownActive(false);
                      patch({ downPayment: amount });
                    }}
                  />
                ))}
                <FlowChip
                  label="eigener Betrag"
                  selected={customDownActive}
                  onClick={() => setCustomDownActive(true)}
                />
              </div>
              {customDownActive && (
                <div className="ovc__custom-down">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="z. B. 2500"
                    value={customDownValue}
                    onChange={(e) => setCustomDownValue(e.target.value)}
                    onBlur={handleCustomDownApply}
                  />
                  <button type="button" className="ovc__btn" onClick={handleCustomDownApply}>
                    OK
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {wishRows.length > 0 && (
          <section className="ovc__section" aria-labelledby="ovc-wish-title">
            <h2 id="ovc-wish-title" className="ovc__section-title">Kundenwünsche</h2>
            <ul className="ovc__wish-list">
              {wishRows.map((row) => (
                <li
                  key={row.id}
                  className={`ovc__wish-item is-${row.status === 'fulfilled' ? 'fulfilled' : row.status === 'partial' ? 'partial' : 'missing'}`}
                >
                  <span aria-hidden="true">{row.statusIcon}</span>
                  <span>{row.label}</span>
                  {row.status !== 'open' && (
                    <span>– {row.statusLabel}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="ovc__section" aria-labelledby="ovc-packages-title">
          <h2 id="ovc-packages-title" className="ovc__section-title">Pakete &amp; Optionen</h2>
          <div className="ovc__packages">
            {catalog.packages.map((pkg) => (
              <VariantPackageCard
                key={pkg.id}
                pkg={pkg}
                paymentType={paymentType}
                wishStatus={buildPackageWishStatus(pkg, wishRows)}
                onAdd={togglePackage}
                onRemove={togglePackage}
              />
            ))}
            {!catalog.packages.length && (
              <p className="ovc__footer-line">Für diese Ausstattung sind keine Pakete hinterlegt.</p>
            )}
          </div>
        </section>

        {configureOptions.colors?.length > 0 && (
          <section className="ovc__section" aria-labelledby="ovc-color-title">
            <h2 id="ovc-color-title" className="ovc__section-title">Farbe</h2>
            <div className="ovc__colors">
              {configureOptions.colors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`ovc__color-chip${draft.colorId === color.id ? ' is-selected' : ''}`}
                  onClick={() => patch({ colorId: color.id, colorLabel: color.label })}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {configureOptions.accessories?.length > 0 && (
          <section className="ovc__section" aria-labelledby="ovc-accessories-title">
            <h2 id="ovc-accessories-title" className="ovc__section-title">Zubehör</h2>
            <div className="ovc__chips">
              {configureOptions.accessories.map((acc) => {
                const selected = (draft.accessoryIds ?? []).includes(acc.id);
                return (
                  <FlowChip
                    key={acc.id}
                    label={acc.label ?? acc.name}
                    selected={selected}
                    onClick={() => {
                      const ids = new Set(draft.accessoryIds ?? []);
                      if (selected) ids.delete(acc.id);
                      else ids.add(acc.id);
                      patch({
                        accessoryIds: filterAccessoryIdsForTrim(
                          draft.modelKey,
                          draft.trimId,
                          [...ids],
                        ),
                      });
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>

      <footer className="ovc__footer">
        <div className="ovc__footer-summary">
          <p className="ovc__footer-line">
            {modelLine}
            {' '}
            {draft.trimLabel}
          </p>
          <p className="ovc__footer-line">{summaryLine}</p>
          {selectedPackageNames.length > 0 && (
            <ul className="ovc__selected-packages">
              {selectedPackageNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
          <p className="ovc__footer-rate">
            Neue Rate:
            {' '}
            {formatConfiguratorRate(preview)}
          </p>
          {preview.delta != null && preview.delta !== 0 && (
            <p className="ovc__footer-delta">
              Mehrpreis:
              {' '}
              {formatConfiguratorDelta(preview.delta, preview.isCash)}
            </p>
          )}
        </div>
        <div className="ovc__footer-actions">
          <button
            type="button"
            className="ovc__btn ovc__btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            Variante speichern
          </button>
          <button
            type="button"
            className="ovc__btn"
            onClick={handleDuplicate}
            disabled={isSaving}
          >
            Als weitere Variante duplizieren
          </button>
          <button type="button" className="ovc__btn" onClick={onBack} disabled={isSaving}>
            Zur Auswahl zurück
          </button>
        </div>
      </footer>
    </div>
  );
}
