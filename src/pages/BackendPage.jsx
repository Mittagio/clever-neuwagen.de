import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useDraftDealerConditions } from '../context/DealerConditionsContext';
import VehicleDataReadonlyBanner from '../components/shared/VehicleDataReadonlyBanner.jsx';
import BackendNav from '../components/backend/BackendNav.jsx';
import BackendSyncStatus from '../components/backend/BackendSyncStatus.jsx';
import BackendDashboard from '../components/backend/BackendDashboard.jsx';
import BackendModels from '../components/backend/BackendModels.jsx';
import BackendDiscounts from '../components/backend/BackendDiscounts.jsx';
import BackendLeasingFactors from '../components/backend/BackendLeasingFactors.jsx';
import BackendFinance from '../components/backend/BackendFinance.jsx';
import BackendDelivery from '../components/backend/BackendDelivery.jsx';
import InventoryManager from '../components/backend/InventoryManager.jsx';
import BackendPublish from '../components/backend/BackendPublish.jsx';
import { formatPrice } from '../data/kiaSportage.js';
import { calculatePrice } from '../logic/priceCalculator.js';
import './BackendPage.css';
import '../components/backend/BackendSyncStatus.css';

const PREVIEW_CONFIG = {
  model: 'Sportage',
  engineId: 'tgi-hybrid-2wd',
  trimId: 'vision',
  colorId: 'carraraweiss',
  selectedPackageIds: [],
  customerGroup: 'standard',
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 15000,
  downPayment: 0,
};

export default function BackendPage() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const {
    conditions: draftConditions,
    publishedConditions,
    draftSavedAt,
    publishToast,
    hasDraftChanges,
    getConditionsForModel,
    updateDiscount,
    updateLeasingFactor,
    saveLeasingTerm,
    updateFinance,
    updateFinanceFinalPayment,
    updateDelivery,
    updatePreparationFee,
    updateModel,
    updateModelContact,
    addInventoryItem,
    updateInventoryItem,
    removeInventoryItem,
    publishDealerChanges,
    discardDraft,
    resetToDefaults,
  } = useDraftDealerConditions();

  const draftSportage = getConditionsForModel('sportage', 'draft');
  const publishedSportage = getConditionsForModel('sportage', 'published');

  const draftPreview = useMemo(
    () => calculatePrice(
      { ...PREVIEW_CONFIG, dealerConditions: draftConditions },
      draftSportage,
    ),
    [draftConditions, draftSportage],
  );

  const publishedPreview = useMemo(
    () => calculatePrice(
      { ...PREVIEW_CONFIG, dealerConditions: publishedConditions },
      publishedSportage,
    ),
    [publishedConditions, publishedSportage],
  );

  function renderSection() {
    switch (activeSection) {
      case 'dashboard':
        return <BackendDashboard conditions={draftConditions} publishedConditions={publishedConditions} />;
      case 'models':
        return (
          <BackendModels
            conditions={draftConditions}
            onUpdateModel={updateModel}
            onUpdateModelContact={updateModelContact}
          />
        );
      case 'discounts':
        return (
          <BackendDiscounts
            conditions={draftConditions}
            onUpdateDiscount={updateDiscount}
          />
        );
      case 'leasing':
        return (
          <BackendLeasingFactors
            conditions={draftConditions}
            onUpdateLeasingFactor={updateLeasingFactor}
            onSaveLeasingTerm={saveLeasingTerm}
          />
        );
      case 'finance':
        return (
          <BackendFinance
            conditions={draftConditions}
            onUpdateFinance={updateFinance}
            onUpdateFinanceFinalPayment={updateFinanceFinalPayment}
          />
        );
      case 'delivery':
        return (
          <BackendDelivery
            conditions={draftConditions}
            onUpdateDelivery={updateDelivery}
            onUpdatePreparationFee={updatePreparationFee}
          />
        );
      case 'inventory':
        return (
          <InventoryManager
            inventory={draftConditions.inventoryVehicles ?? []}
            onAdd={addInventoryItem}
            onUpdate={updateInventoryItem}
            onRemove={removeInventoryItem}
          />
        );
      case 'publish':
        return (
          <BackendPublish
            conditions={draftConditions}
            publishedConditions={publishedConditions}
            onPublish={() => publishDealerChanges()}
            onDiscard={() => discardDraft()}
            hasDraftChanges={hasDraftChanges()}
          />
        );
      default:
        return <BackendDashboard conditions={draftConditions} publishedConditions={publishedConditions} />;
    }
  }

  return (
    <PageShell>
      <div className="backend page">
        <div className="container">
          <header className="backend-header">
            <div>
              <h1 className="page-title">Händler-Backend</h1>
              <p className="page-subtitle">
                {draftConditions.dealerName} – Entwurf bearbeiten, dann veröffentlichen.
              </p>
            </div>
            <div className="backend-header-actions">
              <Link to="/haendler/autohaus-trinkle" className="btn btn-primary">
                Händlerseite
              </Link>
              <button type="button" className="btn btn-secondary" onClick={resetToDefaults}>
                Zurücksetzen
              </button>
            </div>
          </header>

          <VehicleDataReadonlyBanner />

          <BackendSyncStatus
            draftConditions={draftConditions}
            publishedConditions={publishedConditions}
            hasDraftChanges={hasDraftChanges()}
            onPublish={() => publishDealerChanges()}
            onDiscard={() => discardDraft()}
          />

          <aside className="backend-preview card">
            <p className="backend-preview-label">Entwurf vs. veröffentlicht · 48 Mt. / 15.000 km</p>
            <div className="backend-preview-compare">
              <div>
                <span className="backend-preview-tag">Entwurf</span>
                <p className="backend-preview-rate">
                  {draftPreview.leasingRate != null
                    ? `${formatPrice(draftPreview.leasingRate)}/Monat`
                    : formatPrice(draftPreview.cashPrice)}
                </p>
              </div>
              <div>
                <span className="backend-preview-tag backend-preview-tag--pub">Live</span>
                <p className="backend-preview-rate backend-preview-rate--muted">
                  {publishedPreview.leasingRate != null
                    ? `${formatPrice(publishedPreview.leasingRate)}/Monat`
                    : formatPrice(publishedPreview.cashPrice)}
                </p>
              </div>
            </div>
            {draftSavedAt && (
              <p className="backend-preview-meta">
                Entwurf gespeichert {new Date(draftSavedAt).toLocaleTimeString('de-DE')}
              </p>
            )}
          </aside>

          <BackendNav activeSection={activeSection} onSectionChange={setActiveSection} />

          <main className="backend-main">
            {renderSection()}
          </main>

          <p className="backend-save-note">
            Entwürfe werden automatisch gespeichert. Kunden sehen erst nach „Veröffentlichen“ die neuen Konditionen.
          </p>

          {publishToast && (
            <div className="backend-toast" role="status">{publishToast}</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
