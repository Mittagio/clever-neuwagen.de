import './offerFlowDesign.css';

export function OfferFlowLayout({
  backLabel,
  onBack,
  title,
  subtitle,
  titleAside,
  children,
  className = '',
}) {
  return (
    <div className={`cn-flow ${className}`.trim()}>
      <header className="cn-flow-header">
        {onBack && backLabel && (
          <button type="button" className="cn-flow-header__back" onClick={onBack}>
            {backLabel}
          </button>
        )}
        {title && (
          <div className="cn-flow-header__title-row">
            <h1 className="cn-flow-header__title">{title}</h1>
            {titleAside && (
              <span className="cn-flow-header__aside">{titleAside}</span>
            )}
          </div>
        )}
        {subtitle && <p className="cn-flow-header__subtitle">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}

export function VehicleOfferHero({
  modelLine,
  motorLine,
  colorLabel,
  imageSrc,
  imageAlt,
  priceMain,
  priceLabel,
  priceSuffix,
  metaLine,
  footerMeta,
  badges = [],
  statusBadge,
  paymentBadge,
  imageSize = 'large',
  showImage = true,
}) {
  return (
    <section className="cn-hero" aria-label="Fahrzeug und Preis">
      <div className="cn-hero__vehicle">
        {modelLine && <p className="cn-hero__model">{modelLine}</p>}
        {motorLine && <p className="cn-hero__motor">{motorLine}</p>}
        {colorLabel && <p className="cn-hero__color">{colorLabel}</p>}
        {metaLine && !showImage && (
          <p className="cn-hero__meta-line">{metaLine}</p>
        )}
      </div>

      {showImage && imageSrc && (
        <div className="cn-hero__image-wrap">
          <img
            className={`cn-hero__image${imageSize === 'compact' ? ' cn-hero__image--compact' : ''}`}
            src={imageSrc}
            alt={imageAlt ?? modelLine ?? 'Fahrzeug'}
          />
        </div>
      )}

      {(priceMain || priceLabel) && (
        <div className="cn-hero__price-block">
          {priceMain && (
            <p className="cn-hero__price">
              {priceMain}
              {priceSuffix && (
                <span className="cn-hero__price-suffix">{priceSuffix}</span>
              )}
            </p>
          )}
          {priceLabel && (
            <p className="cn-hero__price-label">{priceLabel}</p>
          )}
        </div>
      )}

      {(badges.length > 0 || statusBadge || paymentBadge) && (
        <div className="cn-hero__status-row">
          {statusBadge}
          {paymentBadge}
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`cn-badge cn-badge--${badge.tone ?? 'discount'}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {footerMeta && (
        <p className="cn-hero__uvp">{footerMeta}</p>
      )}

      {metaLine && showImage && !footerMeta && (
        <p className="cn-hero__uvp">{metaLine}</p>
      )}
    </section>
  );
}

export function FlowCard({ children, className = '', variant = 'default' }) {
  const variantClass = variant === 'warn' ? ' cn-flow-card--warn' : variant === 'flat' ? ' cn-flow-card--flat' : '';
  return (
    <section className={`cn-flow-card${variantClass}${className ? ` ${className}` : ''}`}>
      {children}
    </section>
  );
}

export function FlowSectionHeader({ title, onEdit, editLabel = 'Bearbeiten' }) {
  return (
    <div className="cn-section-head">
      <h3 className="cn-section-head__title">{title}</h3>
      {onEdit && (
        <button type="button" className="cn-section-head__edit" onClick={onEdit}>
          {editLabel}
        </button>
      )}
    </div>
  );
}

export function FlowSummaryRow({ label, value, variant = 'default' }) {
  return (
    <div className={`cn-summary-row cn-summary-row--${variant}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function FlowSummaryRows({ children }) {
  return <dl className="cn-summary-rows">{children}</dl>;
}

export function FlowChip({ label, selected, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`cn-flow-chip${selected ? ' is-selected' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

export function FlowPrimaryButton({ children, className = '', ...props }) {
  return (
    <button type="button" className={`cn-btn-primary ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function FlowSecondaryButton({ children, className = '', ...props }) {
  return (
    <button type="button" className={`cn-btn-secondary ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function FlowGhostButton({ children, className = '', ...props }) {
  return (
    <button type="button" className={`cn-btn-ghost ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function FlowStatusBadge({ label, tone = 'neutral' }) {
  return <span className={`cn-badge cn-badge--status-${tone}`}>{label}</span>;
}

export function FlowStickyFooter({ hint, saved, children, className = '' }) {
  return (
    <footer className={`cn-flow-foot ${className}`.trim()}>
      {hint && <p className="cn-flow-foot__hint">{hint}</p>}
      {saved && <p className="cn-flow-foot__saved">{saved}</p>}
      <div className="cn-flow-foot__actions">{children}</div>
    </footer>
  );
}

function formatDiscountAmount(amount) {
  if (amount == null) return '–';
  return `− ${Number(amount).toLocaleString('de-DE')} €`;
}

export function FlowPriceDetails({
  paymentLabel,
  isCash,
  isLeasing,
  isFinance,
  uvpTotal,
  discountPercent,
  discountAmount,
  housePrice,
  transferCost,
  offerPrice,
  termMonths,
  mileagePerYear,
  downPayment,
  formatCurrency,
}) {
  const fmt = formatCurrency ?? ((v) => `${Number(v).toLocaleString('de-DE')} €`);

  return (
    <>
      {paymentLabel && <p className="cn-pricing-type">{paymentLabel}</p>}
      <FlowSummaryRows>
        {isCash && (
          <>
            {uvpTotal != null && <FlowSummaryRow label="UVP" value={fmt(uvpTotal)} />}
            {discountPercent != null && (
              <FlowSummaryRow label="Rabatt" value={`${discountPercent} %`} />
            )}
            {discountAmount != null && (
              <FlowSummaryRow
                label="Rabattbetrag"
                value={formatDiscountAmount(discountAmount)}
                variant="discount"
              />
            )}
            {housePrice != null && (
              <FlowSummaryRow label="Händlerpreis" value={fmt(housePrice)} />
            )}
            {transferCost != null && (
              <FlowSummaryRow label="Überführung" value={fmt(transferCost)} />
            )}
            {offerPrice != null && (
              <FlowSummaryRow label="Endpreis" value={fmt(offerPrice)} variant="total" />
            )}
          </>
        )}
        {isLeasing && (
          <>
            {termMonths && (
              <FlowSummaryRow label="Laufzeit" value={`${termMonths} Monate`} />
            )}
            {mileagePerYear && (
              <FlowSummaryRow
                label="Kilometer"
                value={`${mileagePerYear.toLocaleString('de-DE')} km/Jahr`}
              />
            )}
            {downPayment != null && (
              <FlowSummaryRow label="Anzahlung" value={fmt(downPayment)} />
            )}
            {transferCost != null && (
              <FlowSummaryRow label="Überführung" value={fmt(transferCost)} />
            )}
            {offerPrice != null && (
              <FlowSummaryRow
                label="Rate"
                value={`${offerPrice.toLocaleString('de-DE')} €/Monat`}
                variant="total"
              />
            )}
          </>
        )}
        {isFinance && (
          <>
            {termMonths && (
              <FlowSummaryRow label="Laufzeit" value={`${termMonths} Monate`} />
            )}
            {downPayment != null && (
              <FlowSummaryRow label="Anzahlung" value={fmt(downPayment)} />
            )}
            {transferCost != null && (
              <FlowSummaryRow label="Überführung" value={fmt(transferCost)} />
            )}
            {offerPrice != null && (
              <FlowSummaryRow
                label="Rate"
                value={`${offerPrice.toLocaleString('de-DE')} €/Monat`}
                variant="total"
              />
            )}
          </>
        )}
      </FlowSummaryRows>
    </>
  );
}
