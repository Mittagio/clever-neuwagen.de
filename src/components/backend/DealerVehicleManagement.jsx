import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DealerVehicleModelCard from './DealerVehicleModelCard.jsx';
import DealerVehicleModelEditor from './DealerVehicleModelEditor.jsx';
import { listManagementModels } from '../../services/dealer/dealerVehicleManagement.js';
import {
  ownedPublishReady,
  previewOwnedVehiclePublish,
} from '../../services/dealer/ownedDemandListing.js';
import './DealerVehicleManagement.css';

const FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'active', label: 'Aktiv' },
  { id: 'inactive', label: 'Inaktiv' },
  { id: 'actions', label: 'Mit Aktion' },
  { id: 'highlight', label: 'Highlights' },
];

export default function DealerVehicleManagement({
  conditions,
  userRole = 'dealerAdmin',
  onUpdateModel,
  onUpdateModelSettings,
  onUpdateDiscount,
  onUpdateLeasingFactor,
  onUpdateFinanceCondition,
  onUpdateFinanceResidual,
  onAddPromotion,
  onUpdatePromotion,
  onRemovePromotion,
  onAddCustomTargetGroup,
  onPublish,
  onCommitOwnedOffer,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedModel, setSelectedModel] = useState(null);
  const [publishModel, setPublishModel] = useState(null);
  const [publishSpec, setPublishSpec] = useState(null);
  const [publishedPath, setPublishedPath] = useState(null);

  const models = useMemo(
    () => listManagementModels(conditions, { search, filter }),
    [conditions, search, filter],
  );

  function openOwnedPublish(model) {
    const preview = previewOwnedVehiclePublish(conditions, model);
    setPublishModel(model);
    setPublishSpec(preview.spec);
    setPublishedPath(null);
  }

  function updatePublishField(key, raw) {
    setPublishSpec((prev) => ({
      ...prev,
      [key]: raw === '' ? null : Number(String(raw).replace(',', '.')),
    }));
  }

  if (publishModel && publishSpec) {
    const vehicleLabel = [publishSpec.model, publishSpec.trim].filter(Boolean).join(' ');
    const ready = ownedPublishReady(publishSpec);
    return (
      <div className="dvm">
        <button
          type="button"
          className="dvm-back"
          onClick={() => {
            setPublishModel(null);
            setPublishSpec(null);
            setPublishedPath(null);
          }}
        >
          ← Fahrzeugverwaltung
        </button>
        <header className="dvm-header">
          <h2 className="dvm-header__title">{vehicleLabel}</h2>
        </header>
        {publishedPath ? (
          <div className="dvm-publish">
            <p className="dvm-header__sub">Veröffentlicht</p>
            <Link className="dvm-model-card__cta" to={publishedPath}>
              Öffentliche Seite ansehen
            </Link>
          </div>
        ) : (
          <div className="dvm-publish">
            <label className="dvm-publish__field">
              <span>Listenpreis</span>
              <input
                inputMode="decimal"
                value={publishSpec.listPriceGross ?? ''}
                onChange={(event) => updatePublishField('listPriceGross', event.target.value)}
              />
            </label>
            <label className="dvm-publish__field">
              <span>Rabatt %</span>
              <input
                inputMode="decimal"
                value={publishSpec.discountPercent ?? ''}
                onChange={(event) => updatePublishField('discountPercent', event.target.value)}
              />
            </label>
            <p className="dvm-publish__line">Zahlungsart · Leasing</p>
            <label className="dvm-publish__field">
              <span>Laufzeit Monate</span>
              <input
                inputMode="numeric"
                value={publishSpec.termMonths ?? ''}
                onChange={(event) => updatePublishField('termMonths', event.target.value)}
              />
            </label>
            <label className="dvm-publish__field">
              <span>Kilometer / Jahr</span>
              <input
                inputMode="numeric"
                value={publishSpec.annualMileage ?? ''}
                onChange={(event) => updatePublishField('annualMileage', event.target.value)}
              />
            </label>
            <label className="dvm-publish__field">
              <span>Anzahlung €</span>
              <input
                inputMode="decimal"
                value={publishSpec.downPayment ?? ''}
                onChange={(event) => updatePublishField('downPayment', event.target.value)}
              />
            </label>
            <label className="dvm-publish__field">
              <span>Gültig bis</span>
              <input
                type="date"
                value={publishSpec.validUntil || ''}
                onChange={(event) => setPublishSpec((prev) => ({
                  ...prev,
                  validUntil: event.target.value,
                }))}
              />
            </label>
            <button
              type="button"
              className="dvm-model-card__cta"
              disabled={!ready || !onCommitOwnedOffer}
              onClick={() => {
                const path = onCommitOwnedOffer(publishSpec);
                setPublishedPath(path || (publishSpec.slug ? `/fahrzeug/${publishSpec.slug}` : null));
              }}
            >
              Veröffentlichen
            </button>
          </div>
        )}
      </div>
    );
  }

  if (selectedModel) {
    return (
      <DealerVehicleModelEditor
        model={selectedModel}
        conditions={conditions}
        userRole={userRole}
        onBack={() => setSelectedModel(null)}
        onUpdateModel={onUpdateModel}
        onUpdateModelSettings={onUpdateModelSettings}
        onUpdateDiscount={onUpdateDiscount}
        onUpdateLeasingFactor={onUpdateLeasingFactor}
        onUpdateFinanceCondition={onUpdateFinanceCondition}
        onUpdateFinanceResidual={onUpdateFinanceResidual}
        onAddPromotion={onAddPromotion}
        onUpdatePromotion={onUpdatePromotion}
        onRemovePromotion={onRemovePromotion}
        onAddCustomTargetGroup={onAddCustomTargetGroup}
        onPublish={onPublish}
      />
    );
  }

  return (
    <div className="dvm">
      <header className="dvm-header">
        <h2 className="dvm-header__title">Fahrzeugverwaltung</h2>
        <p className="dvm-header__sub">
          Modelle, Rabatte und Aktionen – mobil bearbeiten, auf der Kundenseite sichtbar.
        </p>
      </header>

      <div className="dvm-toolbar">
        <input
          type="search"
          className="dvm-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Modell suchen …"
          aria-label="Modell suchen"
        />
      </div>

      <div className="dvm-filters" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`dvm-filter${filter === f.id ? ' is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="dvm-grid">
        {models.length === 0 ? (
          <p className="dvm-empty">Kein Modell gefunden.</p>
        ) : (
          models.map(({ model, card }) => {
            const owned = previewOwnedVehiclePublish(conditions, model);
            return (
              <DealerVehicleModelCard
                key={model.id}
                model={model}
                card={card}
                onManage={setSelectedModel}
                canPublishOwned={Boolean(owned.listing)}
                ownedPublished={owned.alreadyPublished}
                ownedPublicPath={owned.publicPath}
                onPublishOwned={openOwnedPublish}
              />
            );
          })
        )}
      </div>

      <p className="dvm-footer-hint">
        Änderungen werden als Entwurf gespeichert. Vor Veröffentlichung immer die Kundenvorschau prüfen.
      </p>

      <p className="dvm-footer-hint dvm-footer-hint--muted">
        Optional: Excel- oder PDF-Import als Hilfsfunktion – die Hauptpflege erfolgt hier in der Fahrzeugverwaltung.
      </p>
    </div>
  );
}
