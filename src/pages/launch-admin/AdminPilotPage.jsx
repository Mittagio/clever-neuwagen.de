import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  LaunchAdminNav,
  LaunchPageHeader,
  LaunchKpi,
  LaunchProgress,
  FlowChain,
  LaunchCard,
  SystemSeverityChip,
} from '../../components/launch-admin/LaunchAdminShared.jsx';
import '../../components/launch-admin/LaunchAdminShared.css';

export default function AdminPilotPage() {
  const { getPilotStats, pilotNotes, addPilotNote } = useLaunchAdmin();
  const { resetPilotLead } = useLeads();
  const pilot = getPilotStats();

  usePageSeo({
    title: 'Pilot Trinkle',
    description: 'Pilotbetrieb Autohaus Trinkle – Erkenntnisse sammeln.',
    path: '/admin/pilot',
  });

  return (
    <PageShell className="admin-shell">
      <div className="launch-page">
        <LaunchPageHeader
          title="Pilotbetrieb Autohaus Trinkle"
          subtitle="Alle Erkenntnisse aus dem ersten echten Betrieb."
          actions={(
            <>
              <Link
                to="/leads"
                state={{ openPilot: true }}
                className="launch-btn launch-btn--primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                Demo starten →
              </Link>
              <Link to="/admin/dealers/autohaus-trinkle" className="launch-btn launch-btn--secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Händler-Detail
              </Link>
            </>
          )}
        />
        <LaunchAdminNav />

        <LaunchCard>
          <p className="launch-card__title">30-Sekunden Demo</p>
          <p className="launch-card__sub">
            Lead <strong>Markus Brenner</strong> · Sportage Vision · Status Bestellung
          </p>
          <ol className="launch-kpi__hint" style={{ margin: '12px 0', paddingLeft: 20, lineHeight: 1.6 }}>
            <li>Demo starten → Lead öffnen</li>
            <li>Status <strong>Ausgeliefert</strong> setzen</li>
            <li>Bestätigungslink kopieren → Ja → Gutschein wählen</li>
            <li>/admin/deliveries · /admin/audit prüfen</li>
          </ol>
          <div className="launch-header__actions">
            <Link to="/leads" state={{ openPilot: true }} className="launch-btn launch-btn--primary" style={{ textDecoration: 'none' }}>
              Demo starten
            </Link>
            <button type="button" className="launch-btn launch-btn--secondary" onClick={() => resetPilotLead()}>
              Demo zurücksetzen
            </button>
          </div>
        </LaunchCard>

        <LaunchProgress percent={pilot.pilotPercent} label={`Pilot ${pilot.pilotPercent} %`} />

        <div className="launch-kpi-grid">
          <LaunchKpi label="Leads" value={pilot.leads} />
          <LaunchKpi label="Angebote" value={pilot.offers} />
          <LaunchKpi label="Verkäufe" value={pilot.sales} />
          <LaunchKpi label="Offene Fehler" value={pilot.issues.length} />
        </div>

        <h2 className="launch-checklist-section__title">End-to-End Flow</h2>
        <FlowChain phases={pilot.phases} />

        <h2 className="launch-checklist-section__title">Fehler & Warnungen</h2>
        {pilot.issues.length === 0 && <p className="launch-kpi__hint">Keine offenen Probleme für Trinkle.</p>}
        {pilot.issues.map((issue) => (
          <LaunchCard key={issue.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p className="launch-card__title">{issue.title}</p>
                <p className="launch-card__sub">{issue.detail}</p>
              </div>
              <SystemSeverityChip type={issue.type} />
            </div>
          </LaunchCard>
        ))}

        <h2 className="launch-checklist-section__title">Verbesserungsvorschläge</h2>
        {pilotNotes.map((note) => (
          <LaunchCard key={note.id}>
            <p className="launch-card__title">{note.text}</p>
            <p className="launch-kpi__hint">{note.priority} · {new Date(note.createdAt).toLocaleDateString('de-DE')}</p>
          </LaunchCard>
        ))}

        <button
          type="button"
          className="launch-btn launch-btn--secondary"
          style={{ marginTop: 12 }}
          onClick={() => addPilotNote('Neuer Verbesserungsvorschlag aus Pilotbetrieb', 'medium')}
        >
          + Vorschlag erfassen
        </button>
      </div>
    </PageShell>
  );
}
