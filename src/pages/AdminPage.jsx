import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { hydrateStammdatenFromServer } from '../services/admin/stammdatenHydration.js';
import PageShell from '../components/layout/PageShell';
import AdminDashboard from '../components/admin/AdminDashboard';
import ChangeCenter from '../components/admin/ChangeCenter';
import ModelOverview from '../components/admin/ModelOverview';
import SportageDetail from '../components/admin/SportageDetail';
import AdminSearchTermsPanel from '../components/admin/AdminSearchTermsPanel.jsx';
import AdminOpenQuestionsPanel from '../components/admin/AdminOpenQuestionsPanel.jsx';
import { getChangeCenter } from '../data/vehicleDataService.js';
import '../components/dealer-admin/DealerAdminShared.css';
import './AdminPage.css';

export default function AdminPage() {
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  const globalChanges = getChangeCenter();

  useEffect(() => {
    hydrateStammdatenFromServer();
  }, []);

  function handleSelectBrand(brandId) {
    setSelectedBrand(brandId);
    setSelectedModel(null);
  }

  function handleSelectModel(modelId) {
    setSelectedModel(modelId);
  }

  function handleBackToDashboard() {
    setSelectedBrand(null);
    setSelectedModel(null);
  }

  function handleBackToModels() {
    setSelectedModel(null);
  }

  const isDashboard = !selectedBrand;

  return (
    <PageShell className="admin-shell">
      <div className="admin-page page">
        <div className="container">
          <header className="admin-header">
            <div>
              <p className="admin-header-kicker">Clever-Neuwagen · Fahrzeugdaten</p>
              <h1 className="page-title">Zentrale Fahrzeugpflege</h1>
              <p className="page-subtitle">
                Preislisten, Farben, Ausstattung, Pakete und WLTP – einmal pflegen, alle Händler nutzen.
              </p>
            </div>
            <div className="admin-header-links">
              <Link to="/admin/daten" className="admin-header-link">← Daten</Link>
              <Link to="/admin" className="admin-header-link">Heute</Link>
              <Link to="/admin/haendler" className="admin-header-link">Händler →</Link>
            </div>
          </header>

          {isDashboard && (
            <>
              <AdminDashboard onSelectBrand={handleSelectBrand} />
              <ChangeCenter
                items={globalChanges}
                title="Änderungscenter"
                showFilters
              />
              <AdminOpenQuestionsPanel />
              <AdminSearchTermsPanel />
            </>
          )}

          {selectedBrand === 'kia' && !selectedModel && (
            <ModelOverview
              onSelectModel={handleSelectModel}
              onBack={handleBackToDashboard}
            />
          )}

          {selectedBrand === 'kia' && selectedModel === 'sportage' && (
            <SportageDetail onBack={handleBackToModels} />
          )}
        </div>
      </div>
    </PageShell>
  );
}
