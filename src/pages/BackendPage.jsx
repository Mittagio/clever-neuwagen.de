import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useDraftDealerConditions } from '../context/DealerConditionsContext';
import VehicleDataReadonlyBanner from '../components/shared/VehicleDataReadonlyBanner.jsx';
import BackendNav from '../components/backend/BackendNav.jsx';
import BackendSyncStatus from '../components/backend/BackendSyncStatus.jsx';
import BackendHome from '../components/backend/BackendHome.jsx';
import BackendFahrzeugeOverview from '../components/backend/BackendFahrzeugeOverview.jsx';
import BackendMarketingHub from '../components/backend/BackendMarketingHub.jsx';
import BackendVerwaltungHub from '../components/backend/BackendVerwaltungHub.jsx';
import BackendModels from '../components/backend/BackendModels.jsx';
import BackendDiscounts from '../components/backend/BackendDiscounts.jsx';
import BackendLeasingFactors from '../components/backend/BackendLeasingFactors.jsx';
import BackendFinance from '../components/backend/BackendFinance.jsx';
import BackendDelivery from '../components/backend/BackendDelivery.jsx';
import InventoryManager from '../components/backend/InventoryManager.jsx';
import BackendPublish from '../components/backend/BackendPublish.jsx';
import { getDefaultSection } from '../components/backend/backendAreas.js';
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

const CONDITION_SECTIONS = new Set([
  'models', 'discounts', 'leasing', 'finance', 'delivery', 'inventory', 'publish',
]);

export default function BackendPage() {
  const [activeArea, setActiveArea] = useState('verkaufen');
  const [activeSection, setActiveSection] = useState('home');
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

  const handleAreaChange = useCallback((areaId) => {
    setActiveArea(areaId);
    setActiveSection(getDefaultSection(areaId));
  }, []);

  const handleSectionChange = useCallback((sectionId) => {
    setActiveSection(sectionId);
  }, []);

  const handleNavigate = useCallback((areaId, sectionId) => {
    setActiveArea(areaId);
    setActiveSection(sectionId ?? getDefaultSection(areaId));
  }, []);

  const showConditionTools = CONDITION_SECTIONS.has(activeSection)
    && activeArea !== 'verkaufen'
    && activeArea !== 'marketing';

  const showSyncBar = (activeArea === 'fahrzeuge' && activeSection === 'publish')
    || (activeArea === 'verwaltung' && activeSection === 'hub');

  function renderContent() {
    if (activeArea === 'verkaufen' && activeSection === 'home') {
      return (
        <BackendHome
          conditions={draftConditions}
          onNavigate={handleNavigate}
        />
      );
    }

    if (activeArea === 'fahrzeuge') {
      switch (activeSection) {
        case 'overview':
          return (
            <BackendFahrzeugeOverview
              conditions={draftConditions}
              onSectionChange={handleSectionChange}
            />
          );
        case 'models':
          return (
            <BackendModels
              conditions={draftConditions}
              onUpdateModel={updateModel}
              onUpdateModelContact={updateModelContact}
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
          return null;
      }
    }

    if (activeArea === 'marketing' && activeSection === 'hub') {
      return <BackendMarketingHub />;
    }

    if (activeArea === 'verwaltung') {
      switch (activeSection) {
        case 'hub':
          return (
            <BackendVerwaltungHub
              conditions={draftConditions}
              publishedConditions={publishedConditions}
              onSectionChange={handleSectionChange}
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
        default:
          return null;
      }
    }

    return null;
  }

  return (
    <PageShell>
      <div className="backend page backend--v2">
        <div className="container">
          <header className="backend-header backend-header--slim">
            <div>
              <p className="backend-header-eyebrow">Händler-Backend</p>
              <h1 className="page-title backend-header-title">{draftConditions.dealerName}</h1>
            </div>
            <div className="backend-header-actions">
              <Link to="/haendler/autohaus-trinkle" className="btn btn-secondary btn-sm">
                Händlerseite
              </Link>
              <Link to="/dealer-ai" className="btn btn-primary btn-sm">
                🤖 Dealer AI
              </Link>
            </div>
          </header>

          <BackendNav
            activeArea={activeArea}
            activeSection={activeSection}
            onAreaChange={handleAreaChange}
            onSectionChange={handleSectionChange}
          />

          {showConditionTools && <VehicleDataReadonlyBanner />}

          {showSyncBar && (
            <BackendSyncStatus
              draftConditions={draftConditions}
              publishedConditions={publishedConditions}
              hasDraftChanges={hasDraftChanges()}
              onPublish={() => publishDealerChanges()}
              onDiscard={() => discardDraft()}
            />
          )}

          {showConditionTools && activeSection === 'publish' && (
            <aside className="backend-preview card">
              <p className="backend-preview-label">Entwurf vs. Live · 48 Mt. / 15.000 km</p>
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
                  Entwurf {new Date(draftSavedAt).toLocaleTimeString('de-DE')}
                </p>
              )}
            </aside>
          )}

          <main className="backend-main">
            {renderContent()}
          </main>

          {showConditionTools && (
            <p className="backend-save-note">
              Entwürfe werden automatisch gespeichert. Kunden sehen erst nach „Veröffentlichen“ die neuen Konditionen.
              {' '}
              <button type="button" className="backend-save-note__reset" onClick={resetToDefaults}>
                Zurücksetzen
              </button>
            </p>
          )}

          {publishToast && (
            <div className="backend-toast" role="status">{publishToast}</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
