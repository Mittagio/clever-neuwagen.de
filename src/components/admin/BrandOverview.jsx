import { BRAND_STATUS } from '../../data/adminCatalog.js';
import StatusBadge from './StatusBadge.jsx';
import './BrandOverview.css';

export default function BrandOverview({ brands, onSelectBrand }) {
  return (
    <section className="admin-section">
      <header className="admin-section-head">
        <h2 className="admin-section-title">Markenübersicht</h2>
        <p className="admin-section-desc">Zentral gepflegte Fahrzeugmarken für alle Händler</p>
      </header>

      <div className="brand-grid">
        {brands.map((brand) => {
          const isActive = brand.status === 'active';
          return (
            <button
              key={brand.id}
              type="button"
              className={`brand-card ${isActive ? 'is-active' : 'is-planned'}`}
              disabled={!isActive}
              onClick={() => isActive && onSelectBrand(brand.id)}
            >
              <div className="brand-card-top">
                <span className="brand-card-name">{brand.name}</span>
                <StatusBadge status={brand.status} type="brand" />
              </div>
              <p className="brand-card-meta">
                {isActive
                  ? `${brand.modelCount} Modelle gepflegt`
                  : BRAND_STATUS.planned.label}
              </p>
              {isActive && <span className="brand-card-action">Modelle anzeigen →</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
