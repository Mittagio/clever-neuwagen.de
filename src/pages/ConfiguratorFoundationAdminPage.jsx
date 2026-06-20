import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import FoundationOverview from '../components/admin/foundation/FoundationOverview.jsx';
import FoundationRulesPanel from '../components/admin/foundation/FoundationRulesPanel.jsx';
import FoundationDataStatusPanel from '../components/admin/foundation/FoundationDataStatusPanel.jsx';
import FoundationChangeLogPanel from '../components/admin/foundation/FoundationChangeLogPanel.jsx';
import FoundationTestConfigurator from '../components/admin/foundation/FoundationTestConfigurator.jsx';
import { kiaFoundationSeed } from '../data/foundation/seeds/kiaFoundationSeed.js';
import { fetchFoundationDatabase } from '../services/foundation/configuratorFoundationApi.js';
import { setFoundationDatabase } from '../services/foundation/configuratorFoundationRegistry.js';
import './ConfiguratorFoundationAdminPage.css';

const TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'rules', label: 'Regeln' },
  { id: 'status', label: 'Datenstatus' },
  { id: 'changelog', label: 'Änderungsprotokoll' },
  { id: 'test', label: 'Test-Konfiguration' },
];

export default function ConfiguratorFoundationAdminPage() {
  const [tab, setTab] = useState('overview');
  const [database, setDatabase] = useState(kiaFoundationSeed);
  const [selectedModelYearId, setSelectedModelYearId] = useState('sportage-2027');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchFoundationDatabase();
      if (res.database) {
        setDatabase(res.database);
        setFoundationDatabase(res.database);
      }
    } catch (err) {
      setLoadError(err.message ?? 'Server nicht erreichbar – lokaler Seed aktiv');
      setDatabase(kiaFoundationSeed);
      setFoundationDatabase(kiaFoundationSeed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const modelYearOptions = useMemo(
    () => (database?.modelYears ?? []).map((my) => ({
      id: my.id,
      label: `${database.models.find((m) => m.id === my.modelId)?.name ?? my.modelId} ${my.modelYear}`,
    })),
    [database],
  );

  return (
    <PageShell className="cf-admin-shell">
      <div className="cf-admin page">
        <div className="container">
          <header className="cf-admin__header">
            <div>
              <p className="cf-admin__kicker">Konfigurator-Fundament · Herstellerübergreifend</p>
              <h1 className="page-title">Fahrzeugdaten & Regeln</h1>
              <p className="page-subtitle">
                Manufacturer → Model → ModelYear → Regeln. Kia ist der erste Hersteller; Suzuki, Hyundai, Ford folgen mit derselben Struktur.
              </p>
            </div>
            <div className="cf-admin__links">
              <Link to="/admin" className="cf-admin__link">← Zentrale Fahrzeugpflege</Link>
              <button type="button" className="cf-admin__link-btn" onClick={reload} disabled={loading}>
                {loading ? 'Lädt …' : 'Neu laden'}
              </button>
            </div>
          </header>

          {loadError && (
            <p className="cf-admin__notice" role="status">{loadError}</p>
          )}

          <div className="cf-admin__toolbar">
            <nav className="cf-admin__tabs" aria-label="Foundation-Bereiche">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`cf-admin__tab${tab === t.id ? ' is-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <label className="cf-admin__year-select">
              <span>Modelljahr</span>
              <select
                value={selectedModelYearId}
                onChange={(e) => setSelectedModelYearId(e.target.value)}
              >
                {modelYearOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          {tab === 'overview' && (
            <FoundationOverview
              database={database}
              selectedModelYearId={selectedModelYearId}
              onSelectModelYear={setSelectedModelYearId}
            />
          )}
          {tab === 'rules' && (
            <FoundationRulesPanel
              database={database}
              modelYearId={selectedModelYearId}
              onDatabaseChange={setDatabase}
            />
          )}
          {tab === 'status' && (
            <FoundationDataStatusPanel
              database={database}
              modelYearId={selectedModelYearId}
            />
          )}
          {tab === 'changelog' && (
            <FoundationChangeLogPanel
              database={database}
              modelYearId={selectedModelYearId}
            />
          )}
          {tab === 'test' && (
            <FoundationTestConfigurator
              database={database}
              modelYearId={selectedModelYearId}
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
