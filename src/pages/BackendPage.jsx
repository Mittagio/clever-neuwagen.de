import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useDraftDealerConditions } from '../context/DealerConditionsContext';
import VehicleDataReadonlyBanner from '../components/shared/VehicleDataReadonlyBanner.jsx';
import BackendNav from '../components/backend/BackendNav.jsx';
import BackendSyncStatus from '../components/backend/BackendSyncStatus.jsx';
import BackendHome from '../components/backend/BackendHome.jsx';
import BackendVehicleShowroom from '../components/backend/BackendVehicleShowroom.jsx';
import DealerVehicleManagement from '../components/backend/DealerVehicleManagement.jsx';
import EquipmentDataInspector from '../components/admin/EquipmentDataInspector.jsx';
import EquipmentSalesSearch from '../components/admin/EquipmentSalesSearch.jsx';
import CleverLearningRequestsAdmin from '../components/admin/CleverLearningRequestsAdmin.jsx';
import BackendMarketingHub from '../components/backend/BackendMarketingHub.jsx';
import BackendVerwaltungHub from '../components/backend/BackendVerwaltungHub.jsx';
import BackendDiscounts from '../components/backend/BackendDiscounts.jsx';
import BackendLeasingFactors from '../components/backend/BackendLeasingFactors.jsx';
import BackendFinance from '../components/backend/BackendFinance.jsx';
import BackendDelivery from '../components/backend/BackendDelivery.jsx';
import { getDefaultSection } from '../components/backend/backendAreas.js';
import './BackendPage.css';
import '../components/backend/BackendSyncStatus.css';
import '../components/backend/backend-mobile.css';

const CONDITION_SECTIONS = new Set([
  'discounts', 'leasing', 'finance', 'delivery',
]);

export default function BackendPage() {
  const location = useLocation();
  const [activeArea, setActiveArea] = useState('verkaufen');
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    if (location.pathname === '/backend/fahrzeuge') {
      setActiveArea('fahrzeuge');
      setActiveSection('overview');
    }
  }, [location.pathname]);
  const {
    conditions: draftConditions,
    publishedConditions,
    publishToast,
    hasDraftChanges,
    updateDiscount,
    updateLeasingFactor,
    updateFinanceCondition,
    saveLeasingTerm,
    updateFinance,
    updateFinanceFinalPayment,
    updateDelivery,
    updatePreparationFee,
    updateModel,
    updateModelSettings,
    addModelPromotion,
    updateModelPromotion,
    removeModelPromotion,
    addCustomTargetGroup,
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

  const showConditionTools = CONDITION_SECTIONS.has(activeSection)
    && activeArea !== 'verkaufen'
    && activeArea !== 'marketing';

  const showSyncBar = activeArea === 'verwaltung' && activeSection === 'hub';

  const showPublishDock = hasDraftChanges() && activeArea === 'verwaltung';
  const isHome = activeArea === 'verkaufen' && activeSection === 'home';

  function renderContent() {
    if (activeArea === 'verkaufen' && activeSection === 'home') {
      return (
        <BackendHome />
      );
    }

    if (activeArea === 'fahrzeuge') {
      if (activeSection === 'equipment-sales-search') {
        return <EquipmentSalesSearch />;
      }
      if (activeSection === 'equipment-inspector') {
        return <EquipmentDataInspector />;
      }
      if (activeSection === 'clever-learning-requests') {
        return <CleverLearningRequestsAdmin />;
      }
      if (activeSection === 'showroom') {
        return (
          <BackendVehicleShowroom
            conditions={draftConditions}
            onUpdateModel={updateModel}
            onUpdateDelivery={updateDelivery}
            onUpdateDiscount={updateDiscount}
          />
        );
      }
      return (
        <DealerVehicleManagement
          conditions={draftConditions}
          userRole="dealerAdmin"
          onUpdateModel={updateModel}
          onUpdateModelSettings={updateModelSettings}
          onUpdateDiscount={updateDiscount}
          onUpdateLeasingFactor={updateLeasingFactor}
          onUpdateFinanceCondition={updateFinanceCondition}
          onAddPromotion={addModelPromotion}
          onUpdatePromotion={updateModelPromotion}
          onRemovePromotion={removeModelPromotion}
          onAddCustomTargetGroup={addCustomTargetGroup}
          onPublish={() => publishDealerChanges()}
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
      <div className={`backend page backend--v2 backend--mf5${showPublishDock ? ' backend--has-publish-dock' : ''}${isHome ? ' backend--home' : ''}`}>
        <div className="container">
          {!isHome && (
            <header className="backend-header backend-header--slim">
              <div>
                <p className="backend-header-eyebrow">Händler-Backend</p>
                <h1 className="page-title backend-header-title">{draftConditions.dealerName}</h1>
              </div>
            </header>
          )}

          <BackendNav
            compact={isHome}
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

          {showPublishDock && (
            <div className="backend-publish-dock" role="region" aria-label="Veröffentlichen">
              <button
                type="button"
                className="backend-publish-dock__primary"
                onClick={() => publishDealerChanges()}
              >
                Änderungen veröffentlichen
              </button>
              <button
                type="button"
                className="backend-publish-dock__discard"
                onClick={() => discardDraft()}
              >
                Verwerfen
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
