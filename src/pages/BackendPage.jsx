import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useDraftDealerConditions } from '../context/DealerConditionsContext';
import VehicleDataReadonlyBanner from '../components/shared/VehicleDataReadonlyBanner.jsx';
import BackendNav from '../components/backend/BackendNav.jsx';
import BackendSyncStatus from '../components/backend/BackendSyncStatus.jsx';
import BackendHome from '../components/backend/BackendHome.jsx';
import BackendVehicleShowroom from '../components/backend/BackendVehicleShowroom.jsx';
import BackendMarketingHub from '../components/backend/BackendMarketingHub.jsx';
import BackendVerwaltungHub from '../components/backend/BackendVerwaltungHub.jsx';
import BackendDiscounts from '../components/backend/BackendDiscounts.jsx';
import BackendLeasingFactors from '../components/backend/BackendLeasingFactors.jsx';
import BackendFinance from '../components/backend/BackendFinance.jsx';
import BackendDelivery from '../components/backend/BackendDelivery.jsx';
import { getDefaultSection } from '../components/backend/backendAreas.js';
import './BackendPage.css';
import '../components/backend/BackendSyncStatus.css';

const CONDITION_SECTIONS = new Set([
  'discounts', 'leasing', 'finance', 'delivery',
]);

export default function BackendPage() {
  const [activeArea, setActiveArea] = useState('verkaufen');
  const [activeSection, setActiveSection] = useState('home');
  const {
    conditions: draftConditions,
    publishedConditions,
    publishToast,
    hasDraftChanges,
    updateDiscount,
    updateLeasingFactor,
    saveLeasingTerm,
    updateFinance,
    updateFinanceFinalPayment,
    updateDelivery,
    updatePreparationFee,
    updateModel,
    publishDealerChanges,
    discardDraft,
    resetToDefaults,
  } = useDraftDealerConditions();

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

  const showSyncBar = activeArea === 'verwaltung' && activeSection === 'hub';

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
      return (
        <BackendVehicleShowroom
          conditions={draftConditions}
          onUpdateModel={updateModel}
          onUpdateDelivery={updateDelivery}
          onUpdateDiscount={updateDiscount}
        />
      );
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
