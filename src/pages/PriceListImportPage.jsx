import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import ImportKpiBar from '../components/admin/import/ImportKpiBar.jsx';
import ImportUploadForm from '../components/admin/import/ImportUploadForm.jsx';
import ImportAnalysisCenter from '../components/admin/import/ImportAnalysisCenter.jsx';
import ImportChangeCard from '../components/admin/import/ImportChangeCard.jsx';
import ImportApprovalBar from '../components/admin/import/ImportApprovalBar.jsx';
import { usePriceListImport } from '../context/PriceListImportContext.jsx';
import './PriceListImportPage.css';

export default function PriceListImportPage() {
  const {
    reviewImport,
    analyzing,
    analyzeError,
    uploadAndAnalyze,
    approveImport,
    rejectImport,
    getMetrics,
  } = usePriceListImport();

  const [toast, setToast] = useState('');
  const metrics = getMetrics();

  useEffect(() => {
    document.title = 'Preislisten Import | Clever-Neuwagen Admin';
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleUpload(meta, file) {
    await uploadAndAnalyze(meta, file);
  }

  function handleApprove() {
    if (!reviewImport) return;
    const result = approveImport(reviewImport.id);
    const msg = result?.applyResult?.message
      ?? `${reviewImport.brand} ${reviewImport.model} – Änderungen übernommen`;
    showToast(msg);
  }

  function handleReject() {
    if (!reviewImport) return;
    rejectImport(reviewImport.id);
    showToast('Import abgelehnt – keine Daten aktualisiert');
  }

  return (
    <PageShell className="import-shell">
      <div className="import-page page">
        <div className="container">
          <header className="import-page__header">
            <div>
              <Link to="/admin" className="import-page__back">← Admin</Link>
              <h1 className="import-page__title">Preislisten Import</h1>
              <p className="import-page__subtitle">
                Neue Hersteller-Preislisten hochladen und Fahrzeugdaten automatisch aktualisieren.
              </p>
            </div>
            <Link to="/admin/import/history" className="import-page__history-btn">
              Historie
            </Link>
          </header>

          <ImportKpiBar metrics={metrics} />

          <div className="import-page__grid">
            <section className="import-page__card">
              <h2 className="import-page__section-title">Upload</h2>
              <p className="import-page__section-desc">
                Händler pflegen keine Fahrzeugdaten mehr – nach Ihrer Freigabe werden alle Händler automatisch aktualisiert.
              </p>
              <ImportUploadForm onSubmit={handleUpload} disabled={analyzing} />
              {analyzeError && (
                <p className="import-page__error" role="alert">{analyzeError}</p>
              )}
            </section>

            <section className="import-page__card import-page__card--analysis">
              <ImportAnalysisCenter importRecord={reviewImport} loading={analyzing} />
              {!analyzing && !reviewImport && (
                <p className="import-page__placeholder">
                  Nach dem Upload erscheint hier die Analyse mit allen erkannten Änderungen.
                </p>
              )}
            </section>
          </div>

          {reviewImport && !analyzing && (
            <>
              <section className="import-page__changes">
                <h2 className="import-page__section-title">Änderungsübersicht vor Freigabe</h2>
                <p className="import-page__section-desc">
                  {reviewImport.changes.length} erkannte Änderungen · Version {reviewImport.version}
                  {reviewImport.analysisSummary?.newEngines > 0 && (
                    <> · z. B. neue Ausstattungslinien</>
                  )}
                </p>
                <div className="import-page__change-grid">
                  {reviewImport.changes.map((change) => (
                    <ImportChangeCard key={change.id} change={change} />
                  ))}
                </div>
              </section>

              <ImportApprovalBar
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </>
          )}
        </div>
      </div>

      {toast && <div className="import-page__toast" role="status">{toast}</div>}
    </PageShell>
  );
}
