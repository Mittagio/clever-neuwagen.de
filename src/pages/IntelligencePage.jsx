import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TIME_PERIODS,
  INTELLIGENCE_SECTIONS,
  getIntelligenceDashboard,
} from '../services/intelligenceEngine.js';
import {
  getIntelligenceSyncStatus,
  syncIntelligenceEvents,
} from '../services/intelligenceSync.js';
import {
  publishTrendPage,
  unpublishTrendPage,
} from '../services/trendPublishService.js';
import { getIntelligenceEventCount } from '../services/intelligenceAnalytics.js';
import { PeriodTabs, MockBadge, SyncStatusBar } from '../components/intelligence/IntelligenceShared.jsx';
import {
  OverviewPanel,
  SearchPanel,
  RecommendationsPanel,
  ComparisonsPanel,
  OffersPanel,
  SalesPanel,
  TrendsPanel,
} from '../components/intelligence/IntelligencePanels.jsx';
import '../components/intelligence/IntelligenceComponents.css';
import './IntelligencePage.css';

export default function IntelligencePage() {
  const [period, setPeriod] = useState('7d');
  const [section, setSection] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncStatus, setSyncStatus] = useState(() => getIntelligenceSyncStatus());
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setSyncStatus(getIntelligenceSyncStatus());
  }, []);

  useEffect(() => {
    function onUpdate() {
      refresh();
    }
    window.addEventListener('clever-intelligence-update', onUpdate);
    window.addEventListener('clever-intelligence-sync', onUpdate);
    window.addEventListener('clever-published-trends-update', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('clever-intelligence-update', onUpdate);
      window.removeEventListener('clever-intelligence-sync', onUpdate);
      window.removeEventListener('clever-published-trends-update', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [refresh]);

  async function handleManualSync() {
    await syncIntelligenceEvents();
    refresh();
  }

  function handlePublishTrend(page) {
    publishTrendPage(page);
    refresh();
    showToast(`„${page.title}" ist live unter /trends/${page.slug}`);
  }

  function handleUnpublishTrend(slug) {
    unpublishTrendPage(slug);
    refresh();
    showToast('Trend wurde zurückgezogen');
  }

  const data = useMemo(() => getIntelligenceDashboard(period), [period, refreshKey]);
  const eventCount = getIntelligenceEventCount();

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="intel-page">
      <header className="intel-header">
        <div className="intel-header__top">
          <Link to="/dashboard" className="intel-header__back">← Dashboard</Link>
          <div className="intel-header__badges">
            <Link to="/intelligence/api" className="intel-header__api">API</Link>
            <MockBadge mode={data.overview.dataMode} />
          </div>
        </div>
        <h1 className="intel-header__title">Clever Intelligence</h1>
        <p className="intel-header__sub">
          Markt- & Entscheidungs-Analytics · {today}
        </p>
        <p className="intel-header__desc">
          Lernt aus Suchanfragen, Beratungen, Vergleichen, Angeboten und Verkäufen –
          einzigartige Daten für bessere Empfehlungen.
        </p>

        <div className="intel-header__controls">
          <PeriodTabs periods={TIME_PERIODS} active={period} onChange={setPeriod} />
        </div>

        <SyncStatusBar
          status={syncStatus}
          eventCount={eventCount}
          onSync={handleManualSync}
        />

        <nav className="intel-nav" aria-label="Intelligence-Bereiche">
          {INTELLIGENCE_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`intel-nav__btn${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="intel-main">
        {section === 'overview' && (
          <OverviewPanel overview={data.overview} bestDeals={data.bestDeals} />
        )}
        {section === 'search' && (
          <SearchPanel search={data.search} equipmentDemand={data.equipmentDemand} />
        )}
        {section === 'recommendations' && (
          <RecommendationsPanel recommendations={data.recommendations} />
        )}
        {section === 'comparisons' && (
          <ComparisonsPanel comparisons={data.comparisons} />
        )}
        {section === 'offers' && (
          <OffersPanel offers={data.offers} />
        )}
        {section === 'sales' && (
          <SalesPanel sales={data.sales} />
        )}
        {section === 'trends' && (
          <TrendsPanel
            leasing={data.leasing}
            familyIndex={data.familyIndex}
            electroIndex={data.electroIndex}
            delivery={data.delivery}
            bestDeals={data.bestDeals}
            trendPages={data.trendPages}
            scoreWeights={data.scoreWeights}
            onPublishTrend={handlePublishTrend}
            onUnpublishTrend={handleUnpublishTrend}
          />
        )}
      </main>
      {toast && <p className="intel-toast" role="status">{toast}</p>}
    </div>
  );
}
