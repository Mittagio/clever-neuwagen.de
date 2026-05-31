import { formatPrice } from '../../data/kiaSportage.js';
import AvailabilityBadge from '../shared/AvailabilityBadge.jsx';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import './PriceSummary.css';

const CUSTOMER_LABELS = {
  standard: 'Standard',
  corporateBenefits: 'Corporate Benefits',
  schwerbehindert: 'Schwerbehindert',
  oeffentlicherDienst: 'Öffentlicher Dienst',
  gewerbe: 'Gewerbe',
};

const PAYMENT_LABELS = {
  leasing: 'Leasingrate',
  finance: 'Finanzierungsrate',
  cash: 'Barkaufpreis',
};

export default function PriceSummary({
  price,
  dealerName,
  config,
  onRequestQuote,
  onSaveConfig,
  isLoggedIn,
}) {
  const {
    configurationPrice = 0,
    discountPercent = 0,
    discountAmount = 0,
    housePrice = 0,
    hauspreis = housePrice,
    preparationFee = 0,
    cashPrice = 0,
    leasingRate = null,
    financeRate = null,
    finalPayment = null,
    deliveryTime = '–',
    availability,
    paymentType = 'leasing',
    displayPaymentType,
    primaryRate = 0,
    warnings = [],
    breakdown = {},
    leasing = {},
    finance = {},
    meta = {},
    selectedVariant,
  } = price ?? {};

  const effectiveHauspreis = hauspreis || housePrice;
  const effectivePayment = displayPaymentType ?? paymentType;
  const showLeasingUnavailable = paymentType === 'leasing' && leasingRate == null;
  const showFinanceUnavailable = paymentType === 'finance' && financeRate == null;

  const termMonths = config?.termMonths ?? leasing.termMonths ?? 48;
  const mileagePerYear = config?.mileagePerYear ?? leasing.mileagePerYear ?? 10000;

  const heroLabel = showLeasingUnavailable || showFinanceUnavailable
    ? PAYMENT_LABELS.cash
    : PAYMENT_LABELS[paymentType] ?? 'Ihr Preis';

  const heroRate = primaryRate ?? cashPrice ?? 0;

  return (
    <aside className="price-summary" aria-live="polite" aria-atomic="false">
      <div className="price-summary-sticky">
        {dealerName && (
          <p className="price-summary-dealer">{dealerName}</p>
        )}

        <div className="price-summary-hero">
          <p className="price-summary-label">{heroLabel}</p>
          <p className="price-summary-primary">
            {effectivePayment === 'cash' || showLeasingUnavailable || showFinanceUnavailable
              ? formatPrice(heroRate)
              : `${formatPrice(heroRate)}/Monat`}
          </p>
          <p className="price-summary-sub">
            {paymentType === 'leasing' && !showLeasingUnavailable
              && `${termMonths} Monate · ${mileagePerYear.toLocaleString('de-DE')} km/Jahr`}
            {paymentType === 'finance' && !showFinanceUnavailable
              && `${termMonths} Monate · Schlussrate ca. ${formatPrice(finalPayment ?? 0)}`}
            {(effectivePayment === 'cash' || showLeasingUnavailable || showFinanceUnavailable)
              && 'Inkl. Bereitstellung'}
          </p>
        </div>

        {(showLeasingUnavailable || showFinanceUnavailable) && (
          <p className="price-summary-fallback-hint">
            {paymentType === 'leasing'
              ? 'Leasing für diese Kombination nicht kalkulierbar – Barkaufpreis als Orientierung.'
              : 'Finanzierung für diese Laufzeit nicht kalkulierbar – Barkaufpreis als Orientierung.'}
          </p>
        )}

        <dl className="price-summary-breakdown">
          <div className="price-row">
            <dt>Konfigurationspreis (UPE)</dt>
            <dd>{formatPrice(configurationPrice)}</dd>
          </div>
          {selectedVariant && (
            <div className="price-row price-row-muted">
              <dt>Variante</dt>
              <dd>{formatPrice(breakdown.variantPrice ?? selectedVariant.priceGross)}</dd>
            </div>
          )}
          {(breakdown.colorPrice ?? 0) > 0 && (
            <div className="price-row price-row-muted">
              <dt>Farbe</dt>
              <dd>+{formatPrice(breakdown.colorPrice)}</dd>
            </div>
          )}
          {(breakdown.packagesPrice ?? 0) > 0 && (
            <div className="price-row price-row-muted">
              <dt>Pakete</dt>
              <dd>+{formatPrice(breakdown.packagesPrice)}</dd>
            </div>
          )}
          {(breakdown.accessoriesPrice ?? 0) > 0 && (
            <div className="price-row price-row-muted">
              <dt>Zubehör</dt>
              <dd>+{formatPrice(breakdown.accessoriesPrice)}</dd>
            </div>
          )}
          <div className="price-row price-row-discount">
            <dt>
              Rabatt ({CUSTOMER_LABELS[meta.customerGroup] ?? meta.customerGroup}, {discountPercent}&nbsp;%)
            </dt>
            <dd>−{formatPrice(discountAmount)}</dd>
          </div>
          <div className="price-row price-row-strong">
            <dt>Hauspreis</dt>
            <dd>{formatPrice(effectiveHauspreis)}</dd>
          </div>

          {paymentType === 'leasing' && leasingRate != null && (
            <div className="price-row">
              <dt>Leasingrate</dt>
              <dd>{formatPrice(leasingRate)}/Monat</dd>
            </div>
          )}

          {paymentType === 'finance' && financeRate != null && (
            <div className="price-row">
              <dt>Finanzierungsrate</dt>
              <dd>{formatPrice(financeRate)}/Monat</dd>
            </div>
          )}

          <div className="price-row">
            <dt>Barkaufpreis</dt>
            <dd>{formatPrice(cashPrice)}</dd>
          </div>
        </dl>

        {paymentType === 'leasing' && leasing.factor != null && (
          <p className="price-summary-note">
            LF {leasing.factor} · Anzahlung {formatPrice(leasing.downPayment ?? 0)}
          </p>
        )}

        {paymentType === 'finance' && finance.interestRate != null && (
          <p className="price-summary-note">
            Eff. Jahreszins {finance.interestRate}&nbsp;% · Schlussrate {formatPrice(finalPayment ?? 0)}
          </p>
        )}

        {warnings.length > 0 && (
          <ul className="price-summary-warnings">
            {warnings.map((w, i) => (
              <li key={`${w.type}-${i}`}>{w.message}</li>
            ))}
          </ul>
        )}

        <div className="price-summary-delivery">
          {availability ? (
            <AvailabilityBadge
              type={availability.type}
              label={availability.label}
              compact
            />
          ) : (
            <>
              <span className="price-summary-delivery-icon" aria-hidden="true">🚚</span>
              <span>Lieferzeit: <strong>{deliveryTime}</strong></span>
            </>
          )}
        </div>

        <LegalDisclaimer className="price-summary-disclaimer" />

        <div className="price-summary-actions">
          <button
            type="button"
            className="btn btn-secondary price-summary-save"
            onClick={onSaveConfig}
          >
            {isLoggedIn ? '💾 Speichern' : '💾 In Mein Konto speichern'}
          </button>
          <button
            type="button"
            className="btn btn-primary price-summary-cta"
            onClick={onRequestQuote}
          >
            Angebot anfragen
          </button>
        </div>
      </div>
    </aside>
  );
}
