import { Link } from 'react-router-dom';
import { useState } from 'react';
import PageShell from '../components/layout/PageShell';
import AdminDashboard from '../components/admin/AdminDashboard';
import ChangeCenter from '../components/admin/ChangeCenter';
import ModelOverview from '../components/admin/ModelOverview';
import SportageDetail from '../components/admin/SportageDetail';
import OperatorDashboard from '../components/dealer-admin/OperatorDashboard.jsx';
import AdminSearchTermsPanel from '../components/admin/AdminSearchTermsPanel.jsx';
import { AdminOperatorNav, AdminNotificationBell } from '../components/dealer-admin/DealerAdminShared.jsx';
import { getChangeCenter } from '../data/vehicleDataService.js';
import '../components/dealer-admin/DealerAdminShared.css';
import './AdminPage.css';

export default function AdminPage() {
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  const globalChanges = getChangeCenter();

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
              <p className="admin-header-kicker">Clever-Neuwagen · Fahrzeugdaten-Service</p>
              <h1 className="page-title">Zentrale Fahrzeugpflege</h1>
              <p className="page-subtitle">
                Preislisten, Farben, Ausstattung, Pakete und WLTP – einmal pflegen, alle Händler nutzen.
              </p>
            </div>
            <div className="admin-header-links">
              <AdminNotificationBell />
              {!isDashboard && (
                <button type="button" className="admin-header-link-btn" onClick={handleBackToDashboard}>
                  ← Dashboard
                </button>
              )}
              <Link to="/admin/dealers" className="admin-header-link">Händler →</Link>
              <Link to="/admin/approvals" className="admin-header-link">Freigaben →</Link>
              <Link to="/admin/billing" className="admin-header-link">Abrechnung →</Link>
              <Link to="/backend" className="admin-header-link">Händler-Backend →</Link>
              <Link to="/admin/import" className="admin-header-link">Preislisten Import →</Link>
              <Link to="/admin/compliance" className="admin-header-link">Compliance Shield →</Link>
              <Link to="/admin/launch" className="admin-header-link admin-header-link--launch">Launch →</Link>
            </div>
          </header>

          {isDashboard && (
            <>
              <AdminOperatorNav />
              <OperatorDashboard />
              <AdminDashboard onSelectBrand={handleSelectBrand} />
              <ChangeCenter
                items={globalChanges}
                title="Änderungscenter"
                showFilters
              />
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
