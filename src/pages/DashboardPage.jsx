import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { computeDashboardMetrics, formatKpi } from '../logic/dashboardMetrics.js';
import { getAssistantAnalytics } from '../services/assistantAnalytics.js';
import { getAdvisorAnalytics } from '../services/advisorAnalytics.js';
import { VEHICLE_TYPE_LABELS } from '../services/recommendationEngine.js';
import './DashboardPage.css';

function KpiCard({ label, value, accent }) {
  return (
    <article className={`dash-kpi${accent ? ` dash-kpi--${accent}` : ''}`}>
      <p className="dash-kpi__value">{formatKpi(value)}</p>
      <p className="dash-kpi__label">{label}</p>
    </article>
  );
}

function InsightCard({ title, highlight, sub, bars }) {
  const max = bars?.[0]?.[1] ?? 1;
  return (
    <article className="dash-insight">
      <p className="dash-insight__title">{title}</p>
      <p className="dash-insight__highlight">{highlight}</p>
      {sub && <p className="dash-insight__sub">{sub}</p>}
      {bars?.length > 0 && (
        <div className="dash-bars">
          {bars.map(([label, count]) => (
            <div key={label} className="dash-bar-row">
              <span className="dash-bar-label">{label}</span>
              <div className="dash-bar-track">
                <div
                  className="dash-bar-fill"
                  style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
                />
              </div>
              <span className="dash-bar-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function DashboardPage() {
  const { leads } = useLeads();
  const { offers } = useOffers();
  const { publishedConditions: conditions } = usePublishedDealerConditions();

  const metrics = useMemo(
    () => computeDashboardMetrics(leads, offers),
    [leads, offers],
  );

  const assistantStats = useMemo(() => getAssistantAnalytics(), []);
  const advisorStats = useMemo(() => getAdvisorAnalytics(), []);

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header__top">
          <Link to="/backend" className="dash-header__back">←</Link>
          <div className="dash-header__nav">
            <Link to="/communication">Verkaufschancen</Link>
            <Link to="/offers">Angebote</Link>
            <Link to="/intelligence">Intelligence</Link>
            <Link to="/dealer-ai">Dealer AI</Link>
            <Link to="/assistant">Assistent</Link>
            <Link to="/sales">Verkauf</Link>
          </div>
        </div>
        <h1 className="dash-header__title">Dashboard</h1>
        <p className="dash-header__sub">{conditions.dealerName} · {today}</p>
      </header>

      <main className="dash-main">
        <section className="dash-kpis" aria-label="Kennzahlen">
          <KpiCard label="Verkaufschancen heute" value={metrics.kpis.leadsToday} accent="blue" />
          <KpiCard label="Offene Angebote" value={metrics.kpis.openOffers} accent="purple" />
          <KpiCard label="Probefahrten" value={metrics.kpis.testDrives} accent="teal" />
          <KpiCard label="Bestellungen" value={metrics.kpis.orders} accent="green" />
          <KpiCard label="Auslieferungen" value={metrics.kpis.deliveries} accent="mint" />
        </section>

        <section className="dash-conversion" aria-label="Conversion Rate">
          <div className="dash-conversion__inner">
            <p className="dash-conversion__label">Conversion Rate</p>
            <p className="dash-conversion__value">{metrics.conversionRate}%</p>
            <p className="dash-conversion__detail">
              {metrics.conversionDetail.won} Abschlüsse von {metrics.conversionDetail.pipeline} aktiven Verkaufschancen
            </p>
            <div className="dash-conversion__ring" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" className="dash-ring-bg" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="dash-ring-fill"
                  strokeDasharray={`${metrics.conversionRate * 3.27} 327`}
                />
              </svg>
            </div>
          </div>
        </section>

        <section className="dash-insights" aria-label="Beliebteste">
          <h2 className="dash-section-title">Beliebteste</h2>
          <div className="dash-insights__grid">
            <InsightCard
              title="Fahrzeug"
              highlight={metrics.popular.vehicle.label}
              sub={`${metrics.popular.vehicle.count} Anfragen`}
              bars={metrics.popular.vehicleBreakdown}
            />
            <InsightCard
              title="Konfiguration"
              highlight={metrics.popular.configuration.label}
              sub={metrics.popular.configuration.count > 0
                ? `${metrics.popular.configuration.count}× gewählt`
                : 'Noch keine Daten'}
              bars={metrics.popular.configBreakdown}
            />
            <InsightCard
              title="Leasingrate"
              highlight={metrics.popular.leasingRate ?? '–'}
              sub={metrics.popular.rateSamples > 0
                ? `Aus ${metrics.popular.rateSamples} Angeboten`
                : 'Noch keine Raten'}
            />
          </div>
        </section>

        {assistantStats.sessions > 0 && (
          <section className="dash-insights" aria-label="Verkaufsassistent">
            <h2 className="dash-section-title">Verkaufsassistent</h2>
            <p className="dash-section-sub">{assistantStats.sessions} Beratungen</p>
            <div className="dash-insights__grid">
              <InsightCard
                title="Häufigste Wunschrate"
                highlight={assistantStats.topDesiredRates[0]?.label ? `${assistantStats.topDesiredRates[0].label} €` : '–'}
                sub={assistantStats.topDesiredRates[0] ? `${assistantStats.topDesiredRates[0].count}× angefragt` : 'Noch keine Daten'}
                bars={assistantStats.topDesiredRates.map((r) => [`${r.label} €`, r.count])}
              />
              <InsightCard
                title="Fahrzeugart"
                highlight={VEHICLE_TYPE_LABELS[assistantStats.topVehicleTypes[0]?.label] ?? assistantStats.topVehicleTypes[0]?.label ?? '–'}
                sub={assistantStats.topVehicleTypes[0] ? `${assistantStats.topVehicleTypes[0].count}× gewählt` : 'Noch keine Daten'}
                bars={assistantStats.topVehicleTypes.map((t) => [
                  VEHICLE_TYPE_LABELS[t.label] ?? t.label,
                  t.count,
                ])}
              />
              <InsightCard
                title="Top-Empfehlungen"
                highlight={assistantStats.topRecommendations[0]?.label ?? '–'}
                sub={assistantStats.topRecommendations[0] ? `${assistantStats.topRecommendations[0].count}× empfohlen` : 'Noch keine Daten'}
                bars={assistantStats.topRecommendations.map((r) => [r.label, r.count])}
              />
            </div>
          </section>
        )}

        {advisorStats.sessions > 0 && (
          <section className="dash-insights" aria-label="Kaufberater">
            <h2 className="dash-section-title">Kaufberater</h2>
            <p className="dash-section-sub">{advisorStats.sessions} Beratungen</p>
            <div className="dash-insights__grid">
              <InsightCard
                title="Häufigste Wunschrate"
                highlight={advisorStats.topDesiredRates[0]?.label ? `${advisorStats.topDesiredRates[0].label} €` : '–'}
                sub={advisorStats.topDesiredRates[0] ? `${advisorStats.topDesiredRates[0].count}× angefragt` : 'Noch keine Daten'}
                bars={advisorStats.topDesiredRates.map((r) => [`${r.label} €`, r.count])}
              />
              <InsightCard
                title="Fahrzeugart"
                highlight={advisorStats.topBodyTypes[0]?.label ?? '–'}
                sub={advisorStats.topBodyTypes[0] ? `${advisorStats.topBodyTypes[0].count}× gewählt` : 'Noch keine Daten'}
                bars={advisorStats.topBodyTypes.map((t) => [t.label, t.count])}
              />
              <InsightCard
                title="Top-Empfehlungen"
                highlight={advisorStats.topRecommendations[0]?.label ?? '–'}
                sub={advisorStats.topRecommendations[0] ? `${advisorStats.topRecommendations[0].count}× empfohlen` : 'Noch keine Daten'}
                bars={advisorStats.topRecommendations.map((r) => [r.label, r.count])}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
