import { buildPaymentActionDetailLine } from '../../logic/vehicleDetailPricing.js';
import { formatCurrency, getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import './vehicle-detail.css';

function ActionCard({
  title,
  subtitle,
  subtitleClass = 'vd-action-card__subtitle',
  detail,
  hint,
  ctaLabel,
  onClick,
  active,
  children,
}) {
  return (
    <article className={`vd-action-card${active ? ' is-active' : ''}`}>
      <h3 className="vd-action-card__title">{title}</h3>
      {subtitle && <p className={subtitleClass}>{subtitle}</p>}
      {detail && <p className="vd-action-card__detail">{detail}</p>}
      {hint && <p className="vd-action-card__hint">{hint}</p>}
      {children}
      <button type="button" className="vd-btn vd-btn--secondary vd-btn--sm vd-action-card__cta" onClick={onClick}>
        {ctaLabel}
      </button>
    </article>
  );
}

export default function VehicleDetailNextSteps({
  pricing,
  vehicleModel,
  showCustomize = true,
  onRateAdjust,
  onCustomizeOpen,
  onCustomizeChip,
  onWishChipClick,
  customizeActive,
  customizeChips = [],
  wishQuickChips = [],
  offers = [],
  payment = 'leasing',
  compareOpen = false,
  onCompareOpen,
  onViewDealer,
}) {
  const rateDetail = buildPaymentActionDetailLine(pricing);
  const offerCount = offers.length;
  const best = offers[0];
  const hasCompare = offerCount > 1;

  function rateForOffer(offer) {
    if (!offer) return '';
    if (payment === 'cash') return formatCurrency(offer.cashPrice);
    if (payment === 'finance') {
      return `${formatCurrency(offer.financeRate ?? offer.monthlyRate)}/Monat`;
    }
    return `${formatCurrency(offer.monthlyRate)}/Monat`;
  }

  const compareSubtitle = hasCompare
    ? `${offerCount} passende Angebote für ${vehicleModel ?? 'dieses Fahrzeug'}`
    : 'Ihr bestes lokales Angebot';
  const compareDetail = best
    ? `Bestes Angebot: ${best.dealerName} · ${rateForOffer(best)}`
    : null;
  const compareHint = best
    ? `${best.distanceKm} km · ${getAvailabilityPlainLabel(best.availability)}`
    : null;

  return (
    <section className="vd-steps" aria-labelledby="vd-steps-title">
      <h2 id="vd-steps-title" className="vd-steps__title">Nächste Schritte</h2>
      <p className="vd-steps__lead">Was möchten Sie als Nächstes tun?</p>

      <div className="vd-steps__grid">
        <ActionCard
          title="Rate anpassen"
          subtitle={pricing.priceLabel}
          subtitleClass="vd-action-card__rate"
          detail={rateDetail}
          ctaLabel="Anpassen"
          onClick={onRateAdjust}
          active={false}
        />

        {showCustomize && (
          <ActionCard
            title="Fahrzeug anpassen"
            subtitle="Noch nicht ganz Ihr Wunschauto?"
            detail="Sagen Sie, was Ihr Auto haben soll – wir finden die passende Ausstattung."
            hint="Änderungen werden in der Anfrage mitgesendet."
            ctaLabel="Auswählen"
            onClick={onCustomizeOpen}
            active={Boolean(customizeActive)}
          >
            {wishQuickChips.length > 0 && (
              <div className="vd-action-card__chips">
                {wishQuickChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`vd-quick-chip${chip.active ? ' is-active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWishChipClick?.(chip.id);
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </ActionCard>
        )}

        <ActionCard
          title="Händler vergleichen"
          subtitle={compareSubtitle}
          detail={compareDetail}
          hint={compareHint}
          ctaLabel={hasCompare ? 'Vergleichen' : 'Angebot ansehen'}
          onClick={hasCompare ? onCompareOpen : onViewDealer}
          active={compareOpen}
        />
      </div>
    </section>
  );
}
