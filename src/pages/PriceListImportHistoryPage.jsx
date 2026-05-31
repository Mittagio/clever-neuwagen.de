import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import ImportKpiBar from '../components/admin/import/ImportKpiBar.jsx';
import ImportHistoryCard, { ImportHistoryEmpty } from '../components/admin/import/ImportHistoryCard.jsx';
import { usePriceListImport } from '../context/PriceListImportContext.jsx';
import './PriceListImportHistoryPage.css';

export default function PriceListImportHistoryPage() {
  const { getHistory, getMetrics } = usePriceListImport();
  const history = getHistory();
  const metrics = getMetrics();

  useEffect(() => {
    document.title = 'Import-Historie | Clever-Neuwagen Admin';
  }, []);

  return (
    <PageShell className="import-shell">
      <div className="import-history-page page">
        <div className="container">
          <header className="import-history-page__header">
            <div>
              <Link to="/admin/import" className="import-history-page__back">← Import</Link>
              <h1 className="import-history-page__title">Import-Historie</h1>
              <p className="import-history-page__subtitle">
                Alle importierten Preislisten und freigegebenen Aktualisierungen.
              </p>
            </div>
          </header>

          <ImportKpiBar metrics={metrics} />

          {history.length === 0 ? (
            <ImportHistoryEmpty />
          ) : (
            <div className="import-history-page__list">
              {history.map((record) => (
                <ImportHistoryCard key={record.id} importRecord={record} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
