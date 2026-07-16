import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import usePageSeo from '../hooks/usePageSeo';
import { AdminOperatorNav } from '../components/dealer-admin/DealerAdminShared.jsx';
import { usePriceListImport } from '../context/PriceListImportContext.jsx';
import AdminOpenQuestionsPanel from '../components/admin/AdminOpenQuestionsPanel.jsx';
import CleverLearningRequestsAdmin from '../components/admin/CleverLearningRequestsAdmin.jsx';
import CleverKnowledgeReviewAdmin from '../components/admin/CleverKnowledgeReviewAdmin.jsx';
import CleverQualityAdmin from '../components/admin/CleverQualityAdmin.jsx';
import EquipmentDataInspector from '../components/admin/EquipmentDataInspector.jsx';
import KiaTechnicalSyncPanel from '../components/admin/KiaTechnicalSyncPanel.jsx';
import ImportKpiBar from '../components/admin/import/ImportKpiBar.jsx';
import {
  buildDatenpruefungKpis,
  DATENPRUEFUNG_TABS,
} from '../services/admin/datenpruefungAdminPresenter.js';
import '../components/dealer-admin/DealerAdminShared.css';
import './DatenpruefungAdminPage.css';

function KpiTile({ label, value, hint }) {
  return (
    <div className="dp-admin__kpi">
      <span className="dp-admin__kpi-value">{value ?? '–'}</span>
      <span className="dp-admin__kpi-label">{label}</span>
      {hint && <span className="dp-admin__kpi-label">{hint}</span>}
    </div>
  );
}

export default function DatenpruefungAdminPage() {
  const [tab, setTab] = useState('uebersicht');
  const [technicalSummary, setTechnicalSummary] = useState(null);
  const { getMetrics } = usePriceListImport();
  const importMetrics = getMetrics();

  usePageSeo({
    title: 'Datenprüfung',
    description: 'Oberadmin: Preislisten, technische Daten und Clever-Wissen prüfen und freigeben.',
    path: '/admin/datenpruefung',
  });

  useEffect(() => {
    document.title = 'Datenprüfung | Clever-Neuwagen Admin';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/admin/technical-sync/kia');
        const data = await res.json();
        if (!cancelled && data.ok && data.report?.summary) {
          setTechnicalSummary(data.report.summary);
        }
      } catch {
        if (!cancelled) setTechnicalSummary(null);
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  const kpis = useMemo(
    () => buildDatenpruefungKpis({
      pendingImports: importMetrics.pending,
      technicalMismatch: technicalSummary?.mismatch ?? null,
      technicalPendingProfiles: technicalSummary?.pendingProfiles ?? null,
    }),
    [importMetrics.pending, technicalSummary],
  );

  return (
    <PageShell className="admin-shell">
      <div className="dp-admin page">
        <div className="container">
          <header className="dp-admin__header">
            <Link to="/admin" className="dp-admin__back">← Zentrale Fahrzeugpflege</Link>
            <h1 className="dp-admin__title">Datenprüfung</h1>
            <p className="dp-admin__subtitle">
              PDF hochladen oder online abgleichen → Werte prüfen → freigeben.
              Nur freigegebene Daten erscheinen im Clever-Lexikon als harte Fakten.
            </p>
          </header>

          <AdminOperatorNav />

          <p className="dp-admin__workflow">
            Workflow: <strong>Quelle</strong> (Preisliste) → <strong>Extraktion</strong> →{' '}
            <strong>Abgleich</strong> → <strong>Freigabe</strong> → Lexikon / Beratung
          </p>

          <div className="dp-admin__kpi-grid" aria-label="Offene Prüfpunkte">
            <KpiTile label="Preislisten offen" value={kpis.pendingImports} />
            <KpiTile label="Technik-Abweichungen" value={kpis.technicalMismatch ?? '–'} />
            <KpiTile label="Profile fehlen" value={kpis.technicalPendingProfiles ?? '–'} />
            <KpiTile label="Clever Lernfragen" value={kpis.openLearningRequests} />
            <KpiTile label="Wissen in Prüfung" value={kpis.pendingKnowledgeAnswers} />
            <KpiTile label="Kundenfragen offen" value={kpis.openCustomerQuestions} />
          </div>

          <div className="dp-admin__tabs" role="tablist" aria-label="Datenprüfung Bereiche">
            {DATENPRUEFUNG_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`dp-admin__tab${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="dp-admin__panel" role="tabpanel">
            {tab === 'uebersicht' && (
              <div className="dp-admin__quick-links">
                {DATENPRUEFUNG_TABS.filter((t) => t.id !== 'uebersicht').map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="dp-admin__quick-link"
                    onClick={() => setTab(item.id)}
                  >
                    <strong>{item.label}</strong>
                    <span>Bereich öffnen →</span>
                  </button>
                ))}
              </div>
            )}

            {tab === 'preislisten' && (
              <section className="dp-admin__card">
                <h2 className="dp-admin__card-title">Preislisten Import</h2>
                <p className="dp-admin__card-desc">
                  Hersteller-PDFs hochladen, Änderungen prüfen und nach Freigabe an alle Händler ausrollen.
                </p>
                <ImportKpiBar metrics={importMetrics} />
                <div className="dp-admin__link-row">
                  <Link to="/admin/import" className="dp-admin__link-btn">
                    Zum Preislisten-Import
                  </Link>
                  <Link to="/admin/import/history" className="dp-admin__link-secondary">
                    Historie
                  </Link>
                </div>
              </section>
            )}

            {tab === 'technisch' && (
              <KiaTechnicalSyncPanel title="Technische Daten · Kia" />
            )}

            {tab === 'ausstattung' && (
              <div className="dp-admin__stack">
                <section className="dp-admin__card">
                  <h2 className="dp-admin__card-title">Ausstattungs-Inspector</h2>
                  <p className="dp-admin__card-desc">
                    Import-Profile, unbekannte Features und technische Datenlücken je Modell prüfen.
                  </p>
                </section>
                <EquipmentDataInspector />
              </div>
            )}

            {tab === 'qualitaet' && (
              <CleverQualityAdmin />
            )}

            {tab === 'lernen' && (
              <div className="dp-admin__stack">
                <CleverLearningRequestsAdmin />
                <CleverKnowledgeReviewAdmin />
              </div>
            )}

            {tab === 'kundenfragen' && (
              <AdminOpenQuestionsPanel />
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
