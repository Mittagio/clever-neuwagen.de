/**
 * Ausstattungs-Chip mit Status: wish | standard | bonus | unavailable | idle | exploring
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
      {variant === 'standard' && <span className="vd-feat-tag__icon" aria-hidden>✓</span>}
      {variant === 'wish' && <span className="vd-feat-tag__icon" aria-hidden>✓</span>}
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

export function PackageInsightBlock({ packageInsight, rateLabel, onApply, applyLabel }) {
  if (!packageInsight) return null;
  return (
    <div className="vd-pkg-insight">
      <p className="vd-wish-rec__lead">Für Ihren Wunsch empfehlen wir:</p>
      <p className="vd-wish-rec__package-name">{packageInsight.packageName}</p>
      {packageInsight.description && (
        <p className="vd-wish-rec__text">{packageInsight.description}</p>
      )}
      {packageInsight.wishItems.length > 0 && (
        <>
          <p className="vd-wish-rec__sub">Ihr Wunsch</p>
          <WishFeatureTagList items={packageInsight.wishItems} />
        </>
      )}
      {packageInsight.bonusItems.length > 0 && (
        <>
          <p className="vd-wish-rec__sub">Zusätzlich enthalten</p>
          <WishFeatureTagList items={packageInsight.bonusItems} />
        </>
      )}
      {rateLabel && (
        <p className="vd-wish-rec__rate">
          Neue Rate: <strong>{rateLabel}</strong>
        </p>
      )}
      {onApply && (
        <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onApply}>
          {applyLabel ?? `${packageInsight.packageName} übernehmen`}
        </button>
      )}
    </div>
  );
}
