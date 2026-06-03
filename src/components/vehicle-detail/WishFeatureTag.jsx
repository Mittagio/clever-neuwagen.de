/**
 * Ausstattungs-Chip mit Status: wish | standard | bonus | unavailable | idle | exploring | pending
 */
export function WishFeatureTag({
  label,
  variant = 'idle',
  badge = null,
  onClick,
  asButton = true,
}) {
  const className = `vd-feat-tag vd-feat-tag--${variant}${onClick && asButton ? ' vd-feat-tag--clickable' : ''}`;
  const content = (
    <>
      {(variant === 'standard' || variant === 'wish' || variant === 'pending') && (
        <span className="vd-feat-tag__icon" aria-hidden>✓</span>
      )}
      <span className="vd-feat-tag__label">{label}</span>
      {badge && <span className="vd-feat-tag__badge">{badge}</span>}
    </>
  );

  if (onClick && asButton) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}

export function WishFeatureTagList({ items = [], onItemClick }) {
  if (!items.length) return null;
  return (
    <div className="vd-feat-tag-list">
      {items.map((item) => (
        <WishFeatureTag
          key={item.id ?? item.label}
          label={item.label}
          variant={item.variant}
          badge={item.badge}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
          asButton={Boolean(onItemClick)}
        />
      ))}
    </div>
  );
}

export function PackageInsightCard({
  packageInsight,
  priceLabel,
  priceImpactLabel,
  onApply,
  applyLabel,
}) {
  if (!packageInsight) return null;
  const priceLine = priceImpactLabel ?? priceLabel;
  return (
    <article className="vd-pkg-card">
      <p className="vd-pkg-card__eyebrow">Für Ihren Wunsch empfehlen wir</p>
      <p className="vd-pkg-card__name">{packageInsight.packageName}</p>
      {priceLine && (
        <p className="vd-pkg-card__price">{priceLine}</p>
      )}
      {packageInsight.description && (
        <p className="vd-pkg-card__desc">{packageInsight.description}</p>
      )}
      {packageInsight.wishItems?.length > 0 && (
        <div className="vd-pkg-card__group">
          <p className="vd-pkg-card__group-title">Ihr Wunsch erfüllt</p>
          <WishFeatureTagList items={packageInsight.wishItems} />
        </div>
      )}
      {packageInsight.bonusItems?.length > 0 && (
        <div className="vd-pkg-card__group">
          <p className="vd-pkg-card__group-title">Zusätzlich enthalten</p>
          <WishFeatureTagList items={packageInsight.bonusItems} />
        </div>
      )}
      {onApply && (
        <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onApply}>
          {applyLabel ?? `${packageInsight.packageName} übernehmen`}
        </button>
      )}
    </article>
  );
}

export function TrimCompareCards({ betterTrimInsight, vehicleModel, onApplyBetter, onKeepCurrent }) {
  if (!betterTrimInsight) return null;
  return (
    <div className="vd-trim-compare">
      <p className="vd-wish-rec__title">Bessere Ausstattung gefunden</p>
      <p className="vd-wish-rec__text">
        Mit Ihren Wünschen ist der {vehicleModel} {betterTrimInsight.trimName} sinnvoller.
      </p>
      <div className="vd-trim-compare__grid">
        <article className="vd-trim-compare__card">
          <p className="vd-trim-compare__label">Aktuell</p>
          <p className="vd-trim-compare__trim">
            {vehicleModel} {betterTrimInsight.currentTrimName}
          </p>
          <p className="vd-trim-compare__price">{betterTrimInsight.currentPriceLabel}</p>
          {betterTrimInsight.currentPackagesLabel && (
            <p className="vd-trim-compare__meta">{betterTrimInsight.currentPackagesLabel}</p>
          )}
        </article>
        <article className="vd-trim-compare__card vd-trim-compare__card--best">
          <p className="vd-trim-compare__label">Empfohlen</p>
          <p className="vd-trim-compare__trim">
            {vehicleModel} {betterTrimInsight.trimName}
          </p>
          <p className="vd-trim-compare__price">{betterTrimInsight.displayPriceLabel}</p>
          {betterTrimInsight.savingsLabel && (
            <p className="vd-trim-compare__savings">{betterTrimInsight.savingsLabel}</p>
          )}
        </article>
      </div>
      {betterTrimInsight.serialOnTrim?.length > 0 && (
        <div className="vd-pkg-card__group">
          <p className="vd-pkg-card__group-title">Bereits enthalten</p>
          <WishFeatureTagList items={betterTrimInsight.serialOnTrim} />
        </div>
      )}
      {betterTrimInsight.stillNeedsPackage?.length > 0 && (
        <div className="vd-pkg-card__group">
          <p className="vd-pkg-card__group-title">Noch als Paket nötig</p>
          <WishFeatureTagList items={betterTrimInsight.stillNeedsPackage} />
        </div>
      )}
      <div className="vd-wish-rec__actions">
        <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onApplyBetter}>
          {betterTrimInsight.trimName} übernehmen
        </button>
        <button type="button" className="vd-btn vd-btn--ghost vd-btn--block" onClick={onKeepCurrent}>
          {betterTrimInsight.currentTrimName} mit Paketen behalten
        </button>
      </div>
    </div>
  );
}
