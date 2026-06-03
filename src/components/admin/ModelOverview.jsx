import { kiaModels } from '../../data/adminCatalog.js';
import { getModelHealth } from '../../data/vehicleDataService.js';
import { formatKiaPriceFrom, formatKiaMonthlyRate } from '../../data/kia/kiaOfficialPriceList.js';
import { getKiaPdfPriceList } from '../../data/kia/kiaPriceListRegistry.js';
import { getKiaModelMediaEntry } from '../../data/kia/kiaModelImages.js';
import HealthIndicator from './HealthIndicator.jsx';
import './ModelOverview.css';

export default function ModelOverview({ onSelectModel, onBack }) {
  return (
    <section className="admin-section">
      <header className="admin-section-head">
        <button type="button" className="admin-back-btn" onClick={onBack}>← Dashboard</button>
        <h2 className="admin-section-title">Kia Modelle</h2>
        <p className="admin-section-desc">
          Offizielle UPE ab laut{' '}
          <a href="https://www.kia.com/de/broschuere/" target="_blank" rel="noopener noreferrer">
            Kia Preislisten
          </a>
          {' · '}
          🟢 aktuell · 🟡 prüfen · 🔴 veraltet
        </p>
      </header>

      <div className="model-list">
        {kiaModels.map((model) => {
          const pdf = getKiaPdfPriceList(model.id);
          const media = getKiaModelMediaEntry(model.registryKey ?? model.id);
          const pdfVariants = pdf?.variantCount;
          const importNote = pdf?.importNote;
          return (
          <button
            key={model.id}
            type="button"
            className={`model-card ${model.hasDetail ? 'is-clickable' : ''}`}
            disabled={!model.hasDetail}
            onClick={() => model.hasDetail && onSelectModel(model.registryKey ?? model.id)}
          >
            <div className="model-card-leading">
              {media?.hero && (
                <img src={media.hero} alt="" className="model-card-thumb" loading="lazy" />
              )}
              <div className="model-card-main">
              <span className="model-card-name">{model.name}</span>
              <span className="model-card-segment">{model.segment}</span>
              {model.priceFromGross != null && (
                <span className="model-card-price">
                  ab {formatKiaPriceFrom(model.priceFromGross)}
                  {model.monthlyRateFrom != null && model.monthlyRateFrom > 0 && (
                    <> · {formatKiaMonthlyRate(model.monthlyRateFrom)}</>
                  )}
                </span>
              )}
              {pdfVariants != null && pdfVariants > 0 && (
                <span className="model-card-pdf">
                  PDF: {pdfVariants} UPE-Kombinationen
                  {importNote ? ` · ${importNote}` : ''}
                </span>
              )}
              {importNote && (!pdfVariants || pdfVariants === 0) && (
                <span className="model-card-note">{importNote}</span>
              )}
              {model.note && <span className="model-card-note">{model.note}</span>}
              </div>
            </div>
            <div className="model-card-footer">
              <HealthIndicator health={getModelHealth(model.status)} />
              {model.hasDetail ? (
                <span className="model-card-action">Stammdaten →</span>
              ) : (
                <span className="model-card-soon">PDF importiert · Registry folgt</span>
              )}
            </div>
          </button>
          );
        })}
      </div>
    </section>
  );
}
