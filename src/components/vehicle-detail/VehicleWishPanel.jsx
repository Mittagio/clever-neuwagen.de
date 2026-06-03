import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONFIGURATOR_FEATURE_IDS, getFeatureLabel } from '../../data/features/featureCatalog.js';
import {
  analyzeSingleWish,
  buildPackageInsight,
  buildWishInsight,
  getDetailWishChips,
  mapWishToBadge,
  mapWishToChipVariant,
} from '../../services/configurator/wishMagicService.js';
import { PackageInsightBlock, WishFeatureTag, WishFeatureTagList } from './WishFeatureTag.jsx';
import './vehicle-detail.css';

function WishChip({ id, label, variant, badge, exploring, onClick }) {
  const chipVariant = exploring && variant === 'idle' ? 'exploring' : variant;
  return (
    <button
      type="button"
      className={`vd-wish-chip vd-wish-chip--${chipVariant}`}
      onClick={() => onClick(id)}
    >
      {(variant === 'standard' || variant === 'wish') && (
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
  currentRateLabel,
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
    });
  }, [vehicle, trimId, previewWishIds, paymentType, termMonths, mileagePerYear]);

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
    );
  }, [singleExplore, vehicle, previewWishIds]);

  const statusById = useMemo(() => {
    const map = new Map();
    insight?.wishStatuses?.forEach((s) => map.set(s.id, s));
    return map;
  }, [insight]);

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

  function handleSkipExplore() {
    onExploreWishChange?.(null);
  }

  function chipState(id) {
    const inPreview = previewWishIds.includes(id);
    if (!inPreview) return { variant: 'idle', badge: null };
    const st = statusById.get(id);
    if (st) return { variant: st.variant, badge: st.badge };
    return { variant: 'wish', badge: 'Ihr Wunsch' };
  }

  const exploreLabel = exploreWishId ? getFeatureLabel(exploreWishId) : null;
  const exploreRateLabel = singleExplore?.newRateLabel ?? insight?.newRateLabel;

  return (
    <div className={`vd-wish${embedded ? ' vd-wish--embedded' : ''}`}>
      <div className="vd-wish__intro">
        <p className="vd-wish__question">Was soll Ihr Fahrzeug haben?</p>
        {trimName && (
          <p className="vd-wish__trim">
            {vehicle.brand} {vehicle.model} {trimName}
            {currentRateLabel && <span> · {currentRateLabel}</span>}
          </p>
        )}
      </div>

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

      {singleExplore && singleExplore.status === 'missing' && (
        <div className="vd-wish-rec vd-wish-rec--missing">
          <p className="vd-wish-rec__title">Dieses Fahrzeug erfüllt den Wunsch nicht</p>
          <WishFeatureTag label={exploreLabel} variant="unavailable" badge="Nicht verfügbar" />
          <p className="vd-wish-rec__text">
            Der {vehicle.model} kann „{exploreLabel}“ in der Ausstattung {trimName} nicht bieten.
          </p>
          {singleExplore.alternatives?.length > 0 && (
            <>
              <p className="vd-wish-rec__sub">Passende Alternativen:</p>
              <ul className="vd-wish-rec__alt-list">
                {singleExplore.alternatives.map((alt) => (
                  <li key={alt.label}>
                    <Link to={`/fahrzeuge?q=${encodeURIComponent(alt.model)}`}>{alt.label}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="vd-btn vd-btn--ghost vd-btn--sm" onClick={handleSkipExplore}>
            Ohne {exploreLabel} weiter
          </button>
        </div>
      )}

      {singleExplore && singleExplore.status === 'standard' && (
        <div className="vd-wish-rec vd-wish-rec--standard vd-wish-rec--glow">
          <p className="vd-wish-rec__title">Bereits enthalten</p>
          <WishFeatureTag label={exploreLabel} variant="standard" badge="Serienmäßig" />
          <p className="vd-wish-rec__text">
            {exploreLabel} ist beim {vehicle.model} {trimName} serienmäßig dabei.
          </p>
          <button type="button" className="vd-btn vd-btn--primary vd-btn--sm" onClick={() => handleApply()}>
            Übernehmen
          </button>
          <button type="button" className="vd-btn vd-btn--ghost vd-btn--sm" onClick={handleSkipExplore}>
            Schließen
          </button>
        </div>
      )}

      {singleExplore && (singleExplore.status === 'package' || singleExplore.status === 'accessory') && (
        <div className="vd-wish-rec vd-wish-rec--package vd-wish-rec--glow">
          <p className="vd-wish-rec__title">{exploreLabel}</p>
          <PackageInsightBlock
            packageInsight={explorePackageInsight}
            rateLabel={exploreRateLabel}
            onApply={() => handleApply()}
            applyLabel={singleExplore.packageName ? `${singleExplore.packageName} übernehmen` : 'Übernehmen'}
          />
          <button type="button" className="vd-btn vd-btn--ghost" onClick={handleSkipExplore}>
            Ohne {exploreLabel} weiter
          </button>
        </div>
      )}

      {singleExplore && singleExplore.status === 'package_other_trim' && (
        <div className="vd-wish-rec vd-wish-rec--package vd-wish-rec--other-trim vd-wish-rec--glow">
          <p className="vd-wish-rec__title">{exploreLabel}</p>
          <WishFeatureTag label={exploreLabel} variant="wish" badge="Ihr Wunsch" />
          <p className="vd-wish-rec__text">
            Verfügbar mit {singleExplore.suggestedTrimName}
            {singleExplore.packageName ? ` und ${singleExplore.packageName}` : ''}
          </p>
          {explorePackageInsight && (
            <PackageInsightBlock packageInsight={explorePackageInsight} rateLabel={exploreRateLabel} />
          )}
          <div className="vd-wish-rec__actions">
            <button
              type="button"
              className="vd-btn vd-btn--primary"
              onClick={() => handleApply({
                trimId: singleExplore.suggestedTrimId,
                resolution: singleExplore.resolution,
              })}
            >
              {singleExplore.suggestedTrimName} mit {singleExplore.packageName} anzeigen
            </button>
            <button type="button" className="vd-btn vd-btn--ghost" onClick={handleSkipExplore}>
              Ohne {exploreLabel} weiter
            </button>
          </div>
        </div>
      )}

      {singleExplore && singleExplore.status === 'standard_other_trim' && (
        <div className="vd-wish-rec vd-wish-rec--standard vd-wish-rec--glow">
          <WishFeatureTag label={exploreLabel} variant="standard" badge="Serienmäßig" />
          <p className="vd-wish-rec__text">
            In der Ausstattung {singleExplore.suggestedTrimName} bereits serienmäßig enthalten.
          </p>
          {exploreRateLabel && (
            <p className="vd-wish-rec__rate">
              Ab {singleExplore.suggestedTrimName}: <strong>{exploreRateLabel}</strong>
            </p>
          )}
          <button
            type="button"
            className="vd-btn vd-btn--primary"
            onClick={() => handleApply({ trimId: singleExplore.suggestedTrimId })}
          >
            {singleExplore.suggestedTrimName} anzeigen
          </button>
        </div>
      )}

      {!singleExplore && wishIds.length > 0 && insight && (
        <div className="vd-wish-rec vd-wish-rec--summary vd-wish-rec--glow">
          <p className="vd-wish-rec__title">Ihre Wünsche</p>
          <WishFeatureTagList
            items={insight.wishStatuses.map((w) => ({
              id: w.id,
              label: w.label,
              variant: w.variant,
              badge: w.badge,
            }))}
          />

          {insight.packageInsights.map((pkg) => (
            <PackageInsightBlock
              key={pkg.packageId}
              packageInsight={pkg}
              rateLabel={insight.packageInsights.length === 1 ? insight.newRateLabel : null}
            />
          ))}

          {insight.packageInsights.length > 1 && insight.newRateLabel && (
            <p className="vd-wish-rec__rate">
              Neue Rate: <strong>{insight.newRateLabel}</strong>
            </p>
          )}

          {(insight.packageInsights.length > 0 || insight.accessoryInsights.length > 0) && (
            <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={() => handleApply()}>
              Pakete übernehmen
            </button>
          )}
        </div>
      )}

      {insight?.betterTrimInsight && (
        <div className="vd-wish-rec vd-wish-rec--alt-trim vd-wish-rec--glow">
          <p className="vd-wish-rec__title">Bessere Ausstattung gefunden</p>
          <p className="vd-wish-rec__text">
            Mit Ihren Wünschen ist der {vehicle.model} {insight.betterTrimInsight.trimName} sinnvoller.
          </p>
          <div className="vd-wish-rec__compare">
            <p>
              <span>{vehicle.model} {insight.betterTrimInsight.currentTrimName}</span>
              <strong>{insight.betterTrimInsight.currentMonthlyRateLabel}</strong>
            </p>
            <p className="vd-wish-rec__compare-best">
              <span>{vehicle.model} {insight.betterTrimInsight.trimName}</span>
              <strong>{insight.betterTrimInsight.monthlyRateLabel}</strong>
            </p>
          </div>

          {insight.betterTrimInsight.serialOnTrim?.length > 0 && (
            <>
              <p className="vd-wish-rec__sub">Bereits enthalten im {insight.betterTrimInsight.trimName}</p>
              <WishFeatureTagList items={insight.betterTrimInsight.serialOnTrim} />
            </>
          )}

          {insight.betterTrimInsight.stillNeedsPackage?.length > 0 && (
            <>
              <p className="vd-wish-rec__sub">Noch als Paket nötig</p>
              <WishFeatureTagList items={insight.betterTrimInsight.stillNeedsPackage} />
            </>
          )}

          {insight.betterTrimInsight.packages?.map((pkg) => (
            <PackageInsightBlock key={pkg.packageId} packageInsight={pkg} />
          ))}

          <div className="vd-wish-rec__actions">
            <button
              type="button"
              className="vd-btn vd-btn--primary vd-btn--block"
              onClick={() => handleApply({ trimId: insight.betterTrimInsight.trimId })}
            >
              {insight.betterTrimInsight.trimName} übernehmen
            </button>
            <button type="button" className="vd-btn vd-btn--ghost" onClick={() => handleApply()}>
              {insight.betterTrimInsight.currentTrimName} mit Paketen behalten
            </button>
          </div>
        </div>
      )}

      {wishIds.length > 0 && insight?.packageInsights?.length > 0 && !exploreWishId && (
        <p className="vd-wish__applied">
          {insight.packageInsights.map((p) => p.packageName).join(' · ')} empfohlen
        </p>
      )}
    </div>
  );
}
