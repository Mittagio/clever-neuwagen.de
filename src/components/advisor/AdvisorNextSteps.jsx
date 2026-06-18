import { buildPaymentTeaserLine } from '../../logic/vehicleDetailPricing.js';
import { normalizePaymentModeInput } from '../../services/pricing/pricingResolver.js';
import '../vehicle-detail/vehicle-detail.css';

function StepCard({ emoji, title, subtitle, detail, ctaLabel, onClick, active }) {
  return (
    <article className={`vd-advisor-step${active ? ' is-active' : ''}`}>
      <span className="vd-advisor-step__emoji" aria-hidden>{emoji}</span>
      <h3 className="vd-advisor-step__title">{title}</h3>
      <p className="vd-advisor-step__subtitle">{subtitle}</p>
      {detail && <p className="vd-advisor-step__detail">{detail}</p>}
      <button type="button" className="vd-btn vd-btn--secondary vd-btn--sm vd-advisor-step__cta" onClick={onClick}>
        {ctaLabel}
      </button>
    </article>
  );
}

export default function AdvisorNextSteps({
  displayPrice,
  paymentMode,
  wishCount = 0,
  dealerCount = 0,
  onOpenPricing,
  onOpenWishes,
  onOpenDealerCompare,
  wishesActive = false,
  compareActive = false,
}) {
  const mode = normalizePaymentModeInput(paymentMode);
  const priceDetail = displayPrice?.raw ? buildPaymentTeaserLine(displayPrice.raw) : displayPrice?.subtitle;

  const pricingSubtitle = mode === 'cash'
    ? 'Kaufpreis · Einmalzahlung'
    : mode === 'finance'
      ? 'Finanzierung · Rate & Schlussrate'
      : 'Leasing · Laufzeit · Kilometer · Anzahlung';

  return (
    <section className="vd-advisor-steps" aria-labelledby="vd-advisor-steps-title">
      <h2 id="vd-advisor-steps-title" className="vd-advisor-steps__title">Nächste Schritte</h2>
      <p className="vd-advisor-steps__lead">Ihr digitaler Verkaufsberater – kein Konfigurator.</p>
      <div className="vd-advisor-steps__grid">
        <StepCard
          emoji="💰"
          title="Preis optimieren"
          subtitle={displayPrice?.label}
          detail={`${pricingSubtitle}${priceDetail ? ` · ${priceDetail}` : ''}`}
          ctaLabel={mode === 'cash' ? 'Zahlungsart ändern' : 'Rate anpassen'}
          onClick={onOpenPricing}
        />
        <StepCard
          emoji="✨"
          title="Ausstattung finden"
          subtitle="Wünsche auswählen – nicht Pakete konfigurieren"
          detail={wishCount > 0
            ? `${wishCount} Wunsch${wishCount > 1 ? 'e' : ''} aktiv · System ergänzt Pakete automatisch`
            : 'Sitzheizung, Kamera, Wärmepumpe & mehr'}
          ctaLabel="Wünsche wählen"
          onClick={onOpenWishes}
          active={wishesActive}
        />
        <StepCard
          emoji="📍"
          title="Bestes Angebot finden"
          subtitle={dealerCount > 1
            ? `${dealerCount} Händler in Ihrer Nähe`
            : 'Regionaler Händler mit passendem Angebot'}
          detail="Händler vergleichen · nicht Preislisten lesen"
          ctaLabel="Vergleichen"
          onClick={onOpenDealerCompare}
          active={compareActive}
        />
      </div>
    </section>
  );
}
