import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONFIGURATOR_FEATURE_IDS, getFeatureLabel } from '../../data/features/featureCatalog.js';
import {
  analyzeSingleWish,
  buildPackageInsight,
  buildWishInsight,
  getDetailWishChips,
} from '../../services/configurator/wishMagicService.js';
import {
  PackageInsightCard,
  TrimCompareCards,
  WishFeatureTag,
  WishFeatureTagList,
} from './WishFeatureTag.jsx';
import './vehicle-detail.css';

function WishChip({ id, label, variant, badge, exploring, onClick }) {
  const chipVariant = exploring && variant === 'idle' ? 'exploring' : variant;
  return (
    <button
      type="button"
      className={`vd-wish-chip vd-wish-chip--${chipVariant}`}
      onClick={() => onClick(id)}
    >
      {(variant === 'standard' || variant === 'wish' || variant === 'pending') && (
        <span className="vd-wish-chip__check" aria-hidden>✓</span>
      )}
      <span className="vd-wish-chip__text">{label}</span>
      {badge && <span className="vd-wish-chip__badge">{badge}</span>}
    </button>
  );
}

export default function VehicleWishPanel({
  vehicle,
  trimId,
  trimName,
  wishIds = [],
  exploreWishId = null,
  onExploreWishChange,
  onWishIdsChange,
  onApplyConfiguration,
  onTrimUpgrade,
  paymentType = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
  baselineEnginePricing = null,
  showMoreLink = true,
  embedded = false,
}) {
  const [showAllWishes, setShowAllWishes] = useState(false);

  const quickChipIds = useMemo(
    () => getDetailWishChips(vehicle.brand, vehicle.model),
    [vehicle.brand, vehicle.model],
  );

  const chipIds = showAllWishes ? CONFIGURATOR_FEATURE_IDS : quickChipIds;

  useEffect(() => {
    if (exploreWishId && !quickChipIds.includes(exploreWishId)) {
      setShowAllWishes(true);
    }
  }, [exploreWishId, quickChipIds]);

  const previewWishIds = useMemo(() => {
    if (!exploreWishId || wishIds.includes(exploreWishId)) return wishIds;
    return [...wishIds, exploreWishId];
  }, [wishIds, exploreWishId]);

  const insight = useMemo(() => {
    if (!previewWishIds.length) return null;
    return buildWishInsight({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishFeatureIds: previewWishIds,
      paymentType,
      termMonths,
      mileagePerYear,
      downPayment,
      financeDown,
      financeBalloon,
      baselineEnginePricing,
    });
  }, [
    vehicle,
    trimId,
    previewWishIds,
    paymentType,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
    baselineEnginePricing,
  ]);

  const singleExplore = useMemo(() => {
    if (!exploreWishId || wishIds.includes(exploreWishId)) return null;
    return analyzeSingleWish({
      brand: vehicle.brand,
      model: vehicle.model,
      trimId,
      wishId: exploreWishId,
      paymentType,
      termMonths,
      mileagePerYear,
    });
  }, [vehicle, trimId, exploreWishId, wishIds, paymentType, termMonths, mileagePerYear]);

  const explorePackageInsight = useMemo(() => {
    if (!singleExplore?.packageId) return null;
    return buildPackageInsight(
      vehicle.brand,
      vehicle.model,
      singleExplore.packageId,
      previewWishIds,
      paymentType,
    );
  }, [singleExplore, vehicle, previewWishIds, paymentType]);

  const statusById = useMemo(() => {
    const map = new Map();
    insight?.wishStatuses?.forEach((s) => map.set(s.id, s));
    return map;
  }, [insight]);

  const serialWishes = insight?.wishStatuses?.filter((w) => w.variant === 'standard') ?? [];
  const pendingWishes = insight?.wishStatuses?.filter((w) => w.variant === 'wish') ?? [];

  function handleChipClick(id) {
    if (wishIds.includes(id)) {
      onWishIdsChange(wishIds.filter((w) => w !== id));
      if (exploreWishId === id) onExploreWishChange?.(null);
      return;
    }
    onExploreWishChange?.(id);
  }

  function handleApply(options = {}) {
    const nextIds = previewWishIds;
    const targetTrimId = options.trimId ?? trimId;
    const resolution = options.resolution
      ?? (targetTrimId !== trimId
        ? buildWishInsight({
          brand: vehicle.brand,
          model: vehicle.model,
          trimId: targetTrimId,
          wishFeatureIds: nextIds,
          paymentType,
          termMonths,
          mileagePerYear,
          downPayment,
          financeDown,
          financeBalloon,
          baselineEnginePricing,
        }).resolution
        : insight?.resolution);

    onWishIdsChange(nextIds);
    if (options.trimId && options.trimId !== trimId) {
      onTrimUpgrade?.(options.trimId);
    }
    onApplyConfiguration?.({
      wishIds: nextIds,
      packageIds: resolution?.packageIds ?? [],
      accessoryIds: resolution?.accessoryIds ?? [],
    });
    onExploreWishChange?.(null);
  }

  function chipState(id) {
    const inPreview = previewWishIds.includes(id);
    if (!inPreview) return { variant: 'idle', badge: null };
    const st = statusById.get(id);
    if (st) {
      const badge = st.badge === 'Ihr Wunsch' && !wishIds.includes(id) ? 'noch offen' : st.badge;
      const variant = badge === 'noch offen' ? 'pending' : st.variant;
      return { variant, badge };
    }
    return { variant: 'pending', badge: 'noch offen' };
  }

  const exploreLabel = exploreWishId ? getFeatureLabel(exploreWishId) : null;
  const explorePriceLabel = singleExplore?.newRateLabel ?? insight?.newRateLabel;
  const priceDeltaLabel = insight?.priceDeltaLabel;

  return (
    <div className={`vd-wish${embedded ? ' vd-wish--embedded' : ''}`}>
      <div className="vd-wish__intro">
        <p className="vd-wish__question">Was soll Ihr Fahrzeug haben?</p>
        {trimName && (
          <p className="vd-wish__trim">
            {vehicle.brand} {vehicle.model} {trimName}
          </p>
        )}
      </div>

      {insight?.magicSummary && !singleExplore && (
        <div className="vd-wish-magic">
          <p className="vd-wish-magic__eyebrow">Clever-Neuwagen denkt mit</p>
          <p className="vd-wish-magic__text">{insight.magicSummary}</p>
          {priceDeltaLabel && (
            <p className="vd-wish-magic__delta">{priceDeltaLabel}</p>
          )}
        </div>
      )}

      <section className="vd-wish-section" aria-label="Ihre Wünsche">
        <h3 className="vd-wish-section__title">Ihre Wünsche</h3>
        <div className="vd-wish__chips">
          {chipIds.map((id) => {
            const { variant, badge } = chipState(id);
            return (
              <WishChip
                key={id}
                id={id}
                label={getFeatureLabel(id)}
                variant={variant}
                badge={badge}
                exploring={exploreWishId === id}
                onClick={handleChipClick}
              />
            );
          })}
        </div>
        {showMoreLink && !showAllWishes && (
          <button type="button" className="vd-wish__more" onClick={() => setShowAllWishes(true)}>
            Weitere Wünsche hinzufügen
          </button>
        )}
      </section>

      {singleExplore && singleExplore.status === 'missing' && (
        <div className="vd-wish-rec vd-wish-rec--missing">
          <WishFeatureTag label={exploreLabel} variant="unavailable" badge="Nicht verfügbar" />
          <p className="vd-wish-rec__text">
            Der {vehicle.model} kann „{exploreLabel}“ in der Ausstattung {trimName} nicht bieten.
          </p>
          {singleExplore.alternatives?.length > 0 && (
            <ul className="vd-wish-rec__alt-list">
              {singleExplore.alternatives.map((alt) => (
                <li key={alt.label}>
                  <Link to={`/fahrzeuge?q=${encodeURIComponent(alt.model)}`}>{alt.label}</Link>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => onExploreWishChange?.(null)}>
            Ohne {exploreLabel} weiter
          </button>
        </div>
      )}

      {singleExplore && singleExplore.status === 'standard' && (
        <section className="vd-wish-section vd-wish-section--glow">
          <h3 className="vd-wish-section__title">Bereits enthalten</h3>
          <WishFeatureTag label={exploreLabel} variant="standard" badge="Serienmäßig" />
          <p className="vd-wish-rec__text">
            Gute Nachricht: {exploreLabel} ist beim {vehicle.model} {trimName} serienmäßig dabei.
          </p>
          <button type="button" className="vd-btn vd-btn--primary" onClick={() => handleApply()}>
            Passt bereits
          </button>
        </section>
      )}

      {singleExplore && (singleExplore.status === 'package' || singleExplore.status === 'accessory') && (
        <section className="vd-wish-section vd-wish-section--glow">
          <PackageInsightCard
            packageInsight={explorePackageInsight}
            priceLabel={explorePriceLabel}
            priceImpactLabel={explorePackageInsight?.priceImpactLabel}
            onApply={() => handleApply()}
            applyLabel={singleExplore.packageName ? `${singleExplore.packageName} übernehmen` : 'Übernehmen'}
          />
          <button type="button" className="vd-btn vd-btn--ghost" onClick={() => onExploreWishChange?.(null)}>
            Ohne {exploreLabel} weiter
          </button>
        </section>
      )}

      {singleExplore && singleExplore.status === 'package_other_trim' && (
        <section className="vd-wish-section vd-wish-section--glow">
          <WishFeatureTag label={exploreLabel} variant="wish" badge="Ihr Wunsch" />
          <PackageInsightCard
            packageInsight={explorePackageInsight}
            priceLabel={explorePriceLabel}
            priceImpactLabel={explorePackageInsight?.priceImpactLabel}
          />
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block"
            onClick={() => handleApply({
              trimId: singleExplore.suggestedTrimId,
              resolution: singleExplore.resolution,
            })}
          >
            {singleExplore.suggestedTrimName} mit {singleExplore.packageName} anzeigen
          </button>
        </section>
      )}

      {singleExplore && singleExplore.status === 'standard_other_trim' && (
        <section className="vd-wish-section vd-wish-section--glow">
          <h3 className="vd-wish-section__title">Bereits enthalten</h3>
          <WishFeatureTag label={exploreLabel} variant="standard" badge="Serienmäßig" />
          <p className="vd-wish-rec__text">In der {singleExplore.suggestedTrimName} serienmäßig enthalten.</p>
          {explorePriceLabel && (
            <p className="vd-wish-rec__rate">Ab <strong>{explorePriceLabel}</strong></p>
          )}
          <button
            type="button"
            className="vd-btn vd-btn--primary"
            onClick={() => handleApply({ trimId: singleExplore.suggestedTrimId })}
          >
            {singleExplore.suggestedTrimName} anzeigen
          </button>
        </section>
      )}

      {!singleExplore && wishIds.length > 0 && insight && (
        <>
          {serialWishes.length > 0 && (
            <section className="vd-wish-section vd-wish-section--glow">
              <h3 className="vd-wish-section__title">Bereits enthalten</h3>
              <p className="vd-wish-section__lead">
                {serialWishes.length} Ihrer Wünsche sind in der {trimName} serienmäßig dabei.
              </p>
              <WishFeatureTagList
                items={serialWishes.map((w) => ({
                  id: w.id,
                  label: w.label,
                  variant: 'standard',
                  badge: 'Serienmäßig',
                }))}
              />
            </section>
          )}

          {insight.packageInsights.length > 0 && (
            <section className="vd-wish-section vd-wish-section--glow">
              <h3 className="vd-wish-section__title">Empfohlene Ergänzung</h3>
              {insight.packageInsights.map((pkg) => (
                <PackageInsightCard
                  key={pkg.packageId}
                  packageInsight={pkg}
                  priceImpactLabel={pkg.priceImpactLabel}
                  priceLabel={insight.packageInsights.length === 1 ? insight.newRateLabel : null}
                />
              ))}
              {insight.newRateLabel && (
                <p className="vd-wish-rec__rate">
                  Neue Empfehlung: <strong>{insight.newRateLabel}</strong>
                  {priceDeltaLabel && <span className="vd-wish-rec__delta"> ({priceDeltaLabel})</span>}
                </p>
              )}
              <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={() => handleApply()}>
                Mit Wunsch-Ausstattung weiter
              </button>
            </section>
          )}

          {!insight.packageInsights.length && pendingWishes.length > 0 && insight.newRateLabel && (
            <p className="vd-wish-rec__rate">
              Ihre Auswahl: <strong>{insight.newRateLabel}</strong>
            </p>
          )}
        </>
      )}

      {!singleExplore && insight?.betterTrimInsight && (
        <section className="vd-wish-section vd-wish-section--glow">
          <TrimCompareCards
            betterTrimInsight={insight.betterTrimInsight}
            vehicleModel={vehicle.model}
            onApplyBetter={() => handleApply({ trimId: insight.betterTrimInsight.trimId })}
            onKeepCurrent={() => handleApply()}
          />
        </section>
      )}
    </div>
  );
}
