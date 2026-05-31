import { Link, useNavigate } from 'react-router-dom';
import { CUSTOMER_STATUS, getVehicleLabel } from '../../data/customerDemoData.js';
import { stashConfigForRestore } from '../configurator/ConfigCustomerSheet.jsx';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import './CustomerItemCard.css';

function formatRate(value) {
  if (value == null) return null;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function CustomerItemCard({ item, type }) {
  const navigate = useNavigate();
  const statusConfig = CUSTOMER_STATUS[item.status] ?? CUSTOMER_STATUS.gespeichert;
  const offerLink = item.offerCode ? `/offer/${item.offerCode}` : null;

  function openConfiguration() {
    stashConfigForRestore(item);
    navigate('/haendler/autohaus-trinkle#sportage-konfigurator');
  }

  return (
    <article className="cust-item">
      <div className="cust-item-main">
        <p className="cust-item-brand">{item.brand ?? 'Kia'}</p>
        <h3 className="cust-item-name">{getVehicleLabel(item)}</h3>
        <div className="cust-item-meta">
          {item.monthlyRate != null && (
            <span className="cust-item-rate">{formatRate(item.monthlyRate)}/Monat</span>
          )}
          {item.color && <span>{item.color}</span>}
          {item.dealer && <span>{item.dealer}</span>}
          {item.date && <span>{formatDate(item.date)}</span>}
        </div>
        {type === 'comparisons' && item.items?.length > 0 && (
          <ul className="cust-item-compare-list">
            {item.items.map((v) => (
              <li key={v.id}>{v.rankMedal} {v.label}</li>
            ))}
          </ul>
        )}
        {item.validUntil && (
          <p className="cust-item-valid">Gültig bis {formatDate(item.validUntil)}</p>
        )}
        {item.offerCode && (
          <p className="cust-item-code">Nr. {item.offerCode}</p>
        )}
        {item.monthlyRate != null && type === 'offers' && (
          <LegalDisclaimer compact className="cust-item-disclaimer" />
        )}
      </div>
      <div className="cust-item-aside">
        <span className={`cust-item-status ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
        {offerLink && (
          <Link to={offerLink} className="cust-item-link">
            Angebot öffnen
          </Link>
        )}
        {type === 'configurations' && item.config && (
          <button type="button" className="cust-item-link cust-item-link--btn" onClick={openConfiguration}>
            Konfiguration öffnen
          </button>
        )}
      </div>
    </article>
  );
}
