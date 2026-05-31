import { Link } from 'react-router-dom';
import { getBrandDashboard } from '../../data/vehicleDataService.js';
import { usePriceListImport } from '../../context/PriceListImportContext.jsx';
import { formatImportDate } from '../../data/priceListImport.js';
import HealthIndicator from './HealthIndicator.jsx';
import './AdminDashboard.css';

export default function AdminDashboard({ onSelectBrand }) {
  const brandData = getBrandDashboard();
  const { getMetrics } = usePriceListImport();
  const importMetrics = getMetrics();

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-head">
        <h2 className="admin-section-title">Dashboard · Pflegezustand</h2>
        <p className="admin-section-desc">
          Clever-Neuwagen pflegt zentral alle Fahrzeugdaten – Händler müssen keine Preislisten, Farben oder WLTP pflegen.
        </p>
      </header>

      <Link to="/admin/import" className="dashboard-import-banner">
        <div className="dashboard-import-banner__top">
          <span className="dashboard-import-banner__title">Preislisten Import</span>
          {importMetrics.pending > 0 && (
            <span className="dashboard-import-banner__badge">
              {importMetrics.pending} Freigabe{importMetrics.pending > 1 ? 'n' : ''}
            </span>
          )}
        </div>
        <div className="dashboard-import-banner__stats">
          <span>{importMetrics.total} Importe</span>
          <span>{importMetrics.today} heute</span>
          <span>
            Stand {importMetrics.lastUpdate ? formatImportDate(importMetrics.lastUpdate) : '–'}
          </span>
        </div>
        <span className="dashboard-import-banner__action">Preisliste hochladen →</span>
      </Link>

      <div className="dashboard-brand-grid">
        {brandData.map((brand) => {
          const isActive = brand.status === 'active';
          return (
            <button
              key={brand.id}
              type="button"
              className={`dashboard-brand-card ${isActive ? 'is-active' : 'is-planned'}`}
              disabled={!isActive}
              onClick={() => isActive && onSelectBrand(brand.id)}
            >
              <div className="dashboard-brand-top">
                <span className="dashboard-brand-name">{brand.name}</span>
                <HealthIndicator
                  health={brand.healthKey ?? 'review'}
                  size="sm"
                />
              </div>

              {isActive ? (
                <>
                  <p className="dashboard-brand-meta">
                    {brand.modelCount} Modelle · Stand {brand.lastUpdated}
                  </p>
                  <div className="dashboard-brand-stats">
                    <span className="dashboard-stat dashboard-stat--current">
                      🟢 {brand.stats.current}
                    </span>
                    <span className="dashboard-stat dashboard-stat--review">
                      🟡 {brand.stats.review}
                    </span>
                    <span className="dashboard-stat dashboard-stat--outdated">
                      🔴 {brand.stats.outdated}
                    </span>
                  </div>
                  <span className="dashboard-brand-action">Modelle verwalten →</span>
                </>
              ) : (
                <p className="dashboard-brand-planned">Markenpflege geplant</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
