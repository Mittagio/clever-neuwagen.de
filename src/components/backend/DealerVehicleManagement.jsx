import { useMemo, useState } from 'react';
import DealerVehicleModelCard from './DealerVehicleModelCard.jsx';
import DealerVehicleModelEditor from './DealerVehicleModelEditor.jsx';
import { listManagementModels } from '../../services/dealer/dealerVehicleManagement.js';
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
  onAddPromotion,
  onUpdatePromotion,
  onRemovePromotion,
  onAddCustomTargetGroup,
  onPublish,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedModel, setSelectedModel] = useState(null);

  const models = useMemo(
    () => listManagementModels(conditions, { search, filter }),
    [conditions, search, filter],
  );

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
          models.map(({ model, card }) => (
            <DealerVehicleModelCard
              key={model.id}
              model={model}
              card={card}
              onManage={setSelectedModel}
            />
          ))
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
