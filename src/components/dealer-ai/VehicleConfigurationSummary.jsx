import { formatUvpLineAmount } from '../../services/configuration/uvpPricing.js';
import './VehicleConfigurationSummary.css';

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

/**
 * UVP-Zusammenfassung – nur Herstellerpreise, keine Händlerkonditionen.
 */
export default function VehicleConfigurationSummary({
  configuration,
  summary,
  compact = false,
  showSelections = true,
}) {
  const uvp = configuration ?? null;
  const lineItems = uvp?.uvpLineItems ?? summary?.uvpLineItems ?? [];
  const total = uvp?.uvpConfigurationPrice ?? summary?.uvpConfigurationPrice ?? summary?.listPrice;

  const selectedPackages = uvp?.selectedPackages ?? [];
  const includedPackages = uvp?.includedPackages ?? [];
  const dealerExtras = uvp?.dealerExtras ?? [];
  const accessories = uvp?.accessories ?? [];

  if (compact) {
    return (
      <div className="vcfg-summary vcfg-summary--compact">
        <p className="vcfg-summary__total-label">UVP Konfiguration</p>
        <p className="vcfg-summary__total-value">{formatCurrency(total)}</p>
      </div>
    );
  }

  return (
    <section className="vcfg-summary" aria-label="UVP-Konfiguration">
      {lineItems.length > 0 && (
        <dl className="vcfg-summary__lines">
          {lineItems.map((item) => (
            <div key={`${item.type}-${item.id}`} className="vcfg-summary__line">
              <dt>{item.label}</dt>
              <dd>{item.type === 'base' ? formatCurrency(item.amount) : formatUvpLineAmount(item.amount)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="vcfg-summary__total">
        <span>Konfigurationspreis (UVP)</span>
        <strong>{formatCurrency(total)}</strong>
      </div>

      {showSelections && (selectedPackages.length > 0 || includedPackages.length > 0 || accessories.length > 0 || dealerExtras.length > 0) && (
        <ul className="vcfg-summary__selections">
          {includedPackages.map((pkg) => (
            <li key={`inc-${pkg.id}`} className="vcfg-summary__sel vcfg-summary__sel--included">
              ✓ {pkg.name} <span>(Serie)</span>
            </li>
          ))}
          {selectedPackages.map((pkg) => (
            <li key={pkg.id} className="vcfg-summary__sel">
              ✓ {pkg.name}
            </li>
          ))}
          {accessories.map((acc) => (
            <li key={acc.id} className="vcfg-summary__sel">✓ {acc.name}</li>
          ))}
          {dealerExtras.map((extra) => (
            <li key={extra.id} className="vcfg-summary__sel">✓ {extra.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
