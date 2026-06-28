import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { filterAccessoryIdsForTrim, buildConfigureOptions } from '../../services/vehicleConfiguration.js';
import { buildWishConditionsChips } from '../../services/sales/offerSelectionGroup.js';
import {
  applyCashPaymentDefaults,
  buildBaseDraftForVariant,
  buildDraftFromSelectionVariant,
  buildVariantConditionChips,
  buildVariantPackageCatalog,
  buildVariantPrepFeeChips,
  computePackageMonthlyRate,
  computeVariantConfiguratorPreview,
  draftToSelectionVariantFields,
  duplicateSelectionGroupVariant,
  formatCashOfferDiscountLine,
  formatConfiguratorRate,
  formatConfiguratorUvpAmount,
  formatEuroAmount,
  formatPackageDisplayLine,
  PAYMENT_DISCOUNT_QUICK_VALUES,
  resolveVariantDiscountPercent,
  resolveVariantDisplayAmounts,
  VARIANT_DOWN_OPTIONS,
  VARIANT_MILEAGE_OPTIONS,
  VARIANT_PAYMENT_OPTIONS,
  VARIANT_TERM_OPTIONS,
} from '../../services/sales/offerVariantConfigurator.js';
import { FlowChip } from './flow/OfferFlowComponents.jsx';
import ConditionChipRow, { ConditionChipButton } from './ConditionChipRow.jsx';
import './OfferVariantConfigurator.css';

function parseEuroInput(value) {
  if (value === '' || value == null) return null;
  const cleaned = String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function VariantPackageCard({
  pkg,
  priceLine,
  onAdd,
  onRemove,
}) {
  const isSelected = pkg.status === 'selected';
  const isIncluded = pkg.status === 'included';
  const isBlocked = pkg.status === 'blocked';

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
      {isIncluded && (
        <p className="ovc__package-note">Bereits in Ausstattung enthalten</p>
      )}
      {isBlocked && (
        <p className="ovc__package-note">Voraussetzungen fehlen</p>
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
 * Varianten-Konfigurator: Fahrzeug zusammenstellen, dann Konditionen.
 */
export default function OfferVariantConfigurator({
  group,
  variant,
  lead,
  onSave,
  onDuplicate,
  onBack,
  isSaving = false,
}) {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!group?.modelKey || !variant) {
      setDraft(null);
      return;
    }
    setDraft(buildDraftFromSelectionVariant({ group, variant, lead, conditions }));
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

  const packageRateById = useMemo(() => {
    if (!draft || preview.isCash) return {};
    const map = {};
    for (const pkg of catalog.packages) {
      if (pkg.status === 'included' || pkg.status === 'blocked') continue;
      map[pkg.id] = computePackageMonthlyRate(draft, pkg.id, conditions);
    }
    return map;
  }, [draft, catalog.packages, conditions, preview.isCash]);

  const defaultPreparationFee = conditions?.preparationFee ?? 1290;
  const activeDiscountPercent = draft
    ? resolveVariantDiscountPercent(draft, conditions)
    : 0;
  const discountQuickValues = useMemo(() => {
    const values = new Set([...PAYMENT_DISCOUNT_QUICK_VALUES, activeDiscountPercent]);
    return [...values].filter((v) => v != null).sort((a, b) => a - b);
  }, [activeDiscountPercent]);

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

  if (!draft || !group || !variant) return null;

  const paymentType = draft.paymentType ?? 'leasing';
  const vehicleTitle = `Kia ${draft.model} · ${draft.trimLabel ?? 'Ausstattung'}`;
  const displayAmounts = resolveVariantDisplayAmounts(draft, preview, variant);
  const isCash = preview.isCash;
  const cashOffer = preview.cashOffer;
  const isLeasing = paymentType === 'leasing';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';
  const showFinanceFields = !isCash;
  const preparationFee = draft.preparationFee ?? defaultPreparationFee;
  const prepChips = buildVariantPrepFeeChips(defaultPreparationFee);
  const uvpFormatted = formatConfiguratorUvpAmount(draft).replace(/\s*UPE\s*$/i, '').trim();

  const wishChips = buildWishConditionsChips(group?.wishConditions ?? {});
  const activeConditionChips = buildVariantConditionChips({
    payment: {
      paymentType: draft.paymentType,
      termMonths: draft.termMonths,
      mileagePerYear: draft.mileagePerYear,
      downPayment: draft.downPayment ?? 0,
    },
  });

  const handleSave = () => {
    const nextVariant = draftToSelectionVariantFields(variant, draft, preview, catalog);
    onSave?.(group, nextVariant);
  };

  const handleDuplicate = () => {
    const nextGroup = duplicateSelectionGroupVariant(group, variant, draft, preview, catalog);
    onDuplicate?.(nextGroup);
  };

  const handlePaymentType = (optId) => {
    if (optId === 'cash') {
      setDraft((prev) => applyCashPaymentDefaults(
        { ...prev, paymentType: 'cash' },
        conditions,
      ));
      return;
    }
    patch({ paymentType: optId, ...(optId === 'cash' ? { mileagePerYear: null } : {}) });
  };

  return (
    <div className="ovc" role="dialog" aria-label={vehicleTitle}>
      <div className="ovc__scroll">
        <header className="ovc__header">
          <button type="button" className="ovc__back" onClick={onBack}>
            ← Zur Auswahl
          </button>
          <h1 className="ovc__title">{vehicleTitle}</h1>
        </header>

        {wishChips.length > 0 && (
          <div className="ovc__wish-strip">
            <ConditionChipRow label="Kundenwunsch" chips={wishChips} />
          </div>
        )}

        <section className="ovc__section" aria-labelledby="ovc-packages-title">
          <h2 id="ovc-packages-title" className="ovc__section-title">Pakete &amp; Optionen</h2>
          <div className="ovc__packages">
            {catalog.packages.map((pkg) => (
              <VariantPackageCard
                key={pkg.id}
                pkg={pkg}
                priceLine={formatPackageDisplayLine(
                  pkg,
                  paymentType,
                  packageRateById[pkg.id],
                )}
                onAdd={togglePackage}
                onRemove={togglePackage}
              />
            ))}
            {!catalog.packages.length && (
              <p className="ovc__empty-note">Keine Pakete für diese Ausstattung.</p>
            )}
          </div>
        </section>

        {configureOptions.colors?.length > 0 && (
          <section className="ovc__section ovc__section--compact" aria-labelledby="ovc-color-title">
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
          <section className="ovc__section ovc__section--compact" aria-labelledby="ovc-accessories-title">
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

        <section className="ovc__section" aria-labelledby="ovc-conditions-title">
          <h2 id="ovc-conditions-title" className="ovc__section-title">Konditionen</h2>

          <div className="ovc__payment-chips">
            {VARIANT_PAYMENT_OPTIONS.map((opt) => (
              <ConditionChipButton
                key={opt.id}
                active={paymentType === opt.id}
                onClick={() => handlePaymentType(opt.id)}
              >
                {opt.label.replace(' / Bar', '')}
              </ConditionChipButton>
            ))}
          </div>

          {showFinanceFields && (
            <div className="ovc__cond-toolbar">
              <label className="ovc__toolbar-field">
                <span className="ovc__toolbar-label">Laufzeit</span>
                <select
                  className="ovc__toolbar-select"
                  value={draft.termMonths ?? VARIANT_TERM_OPTIONS[2]}
                  onChange={(e) => patch({ termMonths: Number(e.target.value) })}
                >
                  {VARIANT_TERM_OPTIONS.map((months) => (
                    <option key={months} value={months}>{months} Mon.</option>
                  ))}
                </select>
              </label>
              {isLeasing && (
                <label className="ovc__toolbar-field">
                  <span className="ovc__toolbar-label">km/Jahr</span>
                  <select
                    className="ovc__toolbar-select"
                    value={draft.mileagePerYear ?? VARIANT_MILEAGE_OPTIONS[1]}
                    onChange={(e) => patch({ mileagePerYear: Number(e.target.value) })}
                  >
                    {VARIANT_MILEAGE_OPTIONS.map((km) => (
                      <option key={km} value={km}>{km.toLocaleString('de-DE')}</option>
                    ))}
                  </select>
                </label>
              )}
              {isFinance && (
                <label className="ovc__toolbar-field">
                  <span className="ovc__toolbar-label">Anzahlung</span>
                  <select
                    className="ovc__toolbar-select"
                    value={draft.downPayment ?? 0}
                    onChange={(e) => patch({ downPayment: Number(e.target.value) })}
                  >
                    {VARIANT_DOWN_OPTIONS.map((amount) => (
                      <option key={amount} value={amount}>
                        {amount.toLocaleString('de-DE')} €
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {!isCash && (
            <details className="ovc__details">
              <summary>Anzeige aus PDF überschreiben</summary>
              <label className="ovc__field ovc__field--full">
                <span className="ovc__field-label">Rate für Kundenlink</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="ovc__input"
                  placeholder={formatConfiguratorRate(preview)}
                  value={draft.displayRateOverride != null ? String(draft.displayRateOverride) : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      patch({ displayRateOverride: null });
                      return;
                    }
                    patch({ displayRateOverride: parseEuroInput(raw) });
                  }}
                />
                {draft.displayRateOverride != null && (
                  <span className="ovc__field-hint">Überschreibt Anzeige im Kundenlink</span>
                )}
              </label>
            </details>
          )}
        </section>

        {isCash && cashOffer && (
          <section className="ovc__section" aria-labelledby="ovc-cash-offer-title">
            <h2 id="ovc-cash-offer-title" className="ovc__section-title">Barkauf</h2>

            <div className="ovc__cash-breakdown" aria-label="Preisaufbau">
              <div className="ovc__cash-row">
                <span>UPE</span>
                <strong>{formatEuroAmount(cashOffer.uvp)}</strong>
              </div>
              {cashOffer.discountPercent > 0 && (
                <div className="ovc__cash-row ovc__cash-row--discount">
                  <span>{formatCashOfferDiscountLine(cashOffer)?.split(':')[0] ?? 'Rabatt'}</span>
                  <strong>− {formatEuroAmount(cashOffer.discountAmount)}</strong>
                </div>
              )}
              <div className="ovc__cash-row">
                <span>Fahrzeugpreis</span>
                <strong>{formatEuroAmount(cashOffer.housePrice)}</strong>
              </div>
              <div className="ovc__cash-row">
                <span>Überführung</span>
                <strong>{formatEuroAmount(cashOffer.preparationFee)}</strong>
              </div>
              <div className="ovc__cash-row ovc__cash-row--total">
                <span>Angebotspreis</span>
                <strong>{formatEuroAmount(cashOffer.totalPrice)}</strong>
              </div>
            </div>

            <label className="ovc__field ovc__field--full">
              <span className="ovc__field-label">Rabatt</span>
              <div className="ovc__chip-row">
                {discountQuickValues.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    className={`ovc__chip${activeDiscountPercent === pct ? ' is-active' : ''}`}
                    onClick={() => patch({
                      customerGroup: 'custom',
                      customDiscountPercent: pct,
                    })}
                  >
                    {pct} %
                  </button>
                ))}
              </div>
              <div className="ovc__inline-input">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  className="ovc__input ovc__input--compact"
                  placeholder="%"
                  value={draft.customDiscountPercent ?? ''}
                  onChange={(e) => patch({
                    customerGroup: 'custom',
                    customDiscountPercent: e.target.value === ''
                      ? null
                      : Number(e.target.value),
                  })}
                />
                <span className="ovc__input-suffix">%</span>
              </div>
            </label>

            <label className="ovc__field ovc__field--full">
              <span className="ovc__field-label">Rabatt-Bezeichnung (optional)</span>
              <input
                type="text"
                className="ovc__input"
                placeholder="z. B. Jubiläumsaktion"
                value={draft.discountLabel ?? ''}
                onChange={(e) => patch({ discountLabel: e.target.value || null })}
              />
            </label>

            <div className="ovc__field ovc__field--full">
              <span className="ovc__field-label">Überführung</span>
              <div className="ovc__chip-row">
                {prepChips.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={`ovc__chip${preparationFee === amount ? ' is-active' : ''}`}
                    onClick={() => patch({ preparationFee: amount })}
                  >
                    {amount.toLocaleString('de-DE')} €
                  </button>
                ))}
              </div>
            </div>

            <details className="ovc__details">
              <summary>Anzeige aus PDF überschreiben</summary>
              <label className="ovc__field ovc__field--full">
                <span className="ovc__field-label">Kaufpreis für Kundenlink</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="ovc__input"
                  placeholder={formatEuroAmount(cashOffer.totalPrice)}
                  value={draft.displayPriceOverride != null ? String(draft.displayPriceOverride) : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      patch({ displayPriceOverride: null });
                      return;
                    }
                    patch({ displayPriceOverride: parseEuroInput(raw) });
                  }}
                />
              </label>
            </details>
          </section>
        )}
      </div>

      <footer className="ovc__footer">
        <ConditionChipRow chips={activeConditionChips} />
        <div className="ovc__footer-prices">
          <div className="ovc__footer-price-col">
            <span className="ovc__footer-price-label">UPE</span>
            <span className="ovc__footer-price-value">{uvpFormatted}</span>
          </div>
          <div className="ovc__footer-price-col ovc__footer-price-col--main">
            <span className="ovc__footer-price-label">{isCash ? 'Angebotspreis' : 'Rate'}</span>
            <span className="ovc__footer-price-value ovc__footer-price-value--accent">
              {displayAmounts.formatted}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="ovc__btn ovc__btn-primary ovc__btn--footer-save"
          onClick={handleSave}
          disabled={isSaving}
        >
          Variante speichern
        </button>
        <div className="ovc__footer-secondary">
          <button
            type="button"
            className="ovc__text-btn"
            onClick={handleDuplicate}
            disabled={isSaving}
          >
            Duplizieren
          </button>
          <button type="button" className="ovc__text-btn" onClick={onBack} disabled={isSaving}>
            Zurück
          </button>
        </div>
      </footer>
    </div>
  );
}
