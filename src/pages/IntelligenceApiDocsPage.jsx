import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  INTELLIGENCE_API_RESOURCES,
  INTELLIGENCE_API_VERSION,
  buildIntelligenceApiUrl,
  downloadIntelligenceJson,
  exportIntelligenceJson,
  getIntelligenceApiManifest,
  getIntelligenceApiSummary,
} from '../services/intelligenceApi.js';
import { hasLiveIntelligenceData } from '../services/intelligenceAnalytics.js';
import { TIME_PERIODS } from '../services/intelligenceEngine.js';
import './IntelligenceApiPage.css';

export default function IntelligenceApiDocsPage() {
  const [period, setPeriod] = useState('7d');
  const [previewResource, setPreviewResource] = useState('overview');
  const [copied, setCopied] = useState('');

  const manifest = useMemo(() => getIntelligenceApiManifest(), []);
  const preview = useMemo(
    () => exportIntelligenceJson(previewResource, period),
    [previewResource, period],
  );
  const summary = useMemo(() => getIntelligenceApiSummary(period), [period]);
  const isLive = hasLiveIntelligenceData();

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="intel-api-page">
      <header className="intel-api-header">
        <Link to="/intelligence" className="intel-api-back">← Intelligence</Link>
        <h1 className="intel-api-title">Intelligence API</h1>
        <p className="intel-api-sub">
          Version {INTELLIGENCE_API_VERSION} · JSON für KI-Systeme, Partner und interne Tools
        </p>
        <span className={`intel-api-mode intel-api-mode--${isLive ? 'live' : 'mock'}`}>
          {isLive ? 'Live-Daten' : 'Demo-Daten'}
        </span>
      </header>

      <main className="intel-api-main">
        <section className="intel-api-card">
          <h2>Server-Endpoint</h2>
          <p className="intel-api-text">
            Mit <code>npm run dev</code> starten Server (Port 3001) und Vite gemeinsam.
            Der Node-Server liefert echtes JSON; Events werden bidirektional mit dem Browser synchronisiert.
          </p>
          <div className="intel-api-quick">
            <code className="intel-api-code">GET http://localhost:3001/api/v1/intelligence/overview?period=7d</code>
            <code className="intel-api-code">GET http://localhost:3001/api/v1/intelligence/events</code>
            <code className="intel-api-code">GET http://localhost:3001/api/v1/trends/published</code>
            <code className="intel-api-code">GET http://localhost:3001/api/v1/intelligence/published-trends?period=7d</code>
          </div>
        </section>

        <section className="intel-api-card">
          <p className="intel-api-text">
            Jede Ressource liefert strukturiertes JSON mit Metadaten, Datenmodus und Links zu Trends/Ratgeber.
          </p>
          <div className="intel-api-quick">
            <code className="intel-api-code">{buildIntelligenceApiUrl('overview', period)}</code>
            <button
              type="button"
              className="intel-api-btn"
              onClick={() => copyText(buildIntelligenceApiUrl('overview', period), 'overview-url')}
            >
              {copied === 'overview-url' ? 'Kopiert' : 'URL kopieren'}
            </button>
            <a
              href={buildIntelligenceApiUrl('overview', period)}
              target="_blank"
              rel="noreferrer"
              className="intel-api-btn intel-api-btn--ghost"
            >
              JSON öffnen
            </a>
          </div>
        </section>

        <section className="intel-api-card">
          <h2>Parameter</h2>
          <div className="intel-api-params">
            <label className="intel-api-label">
              Zeitraum
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                {TIME_PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="intel-api-card">
          <h2>Ressourcen</h2>
          <ul className="intel-api-resources">
            {INTELLIGENCE_API_RESOURCES.map((res) => (
              <li key={res.id} className="intel-api-resource">
                <div>
                  <p className="intel-api-resource__name">{res.name}</p>
                  <p className="intel-api-resource__desc">{res.description}</p>
                  <code className="intel-api-code intel-api-code--sm">
                    GET /api/v1/intelligence/{res.id}
                  </code>
                </div>
                <div className="intel-api-resource__actions">
                  <button
                    type="button"
                    className="intel-api-btn intel-api-btn--sm"
                    onClick={() => setPreviewResource(res.id)}
                  >
                    Vorschau
                  </button>
                  <a
                    href={buildIntelligenceApiUrl(res.id, period)}
                    target="_blank"
                    rel="noreferrer"
                    className="intel-api-btn intel-api-btn--sm intel-api-btn--ghost"
                  >
                    JSON
                  </a>
                  <button
                    type="button"
                    className="intel-api-btn intel-api-btn--sm"
                    onClick={() => downloadIntelligenceJson(res.id, period)}
                  >
                    Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="intel-api-card">
          <h2>KI-Zusammenfassung</h2>
          <p className="intel-api-text">Kompakter Text für LLM-Kontext und Zitierungen.</p>
          <pre className="intel-api-preview intel-api-preview--summary">{summary.summary}</pre>
          <button
            type="button"
            className="intel-api-btn"
            onClick={() => copyText(summary.summary, 'summary')}
          >
            {copied === 'summary' ? 'Kopiert' : 'Zusammenfassung kopieren'}
          </button>
        </section>

        <section className="intel-api-card">
          <h2>JSON-Vorschau: {previewResource}</h2>
          <pre className="intel-api-preview">{preview}</pre>
          <button
            type="button"
            className="intel-api-btn"
            onClick={() => copyText(preview, 'preview')}
          >
            {copied === 'preview' ? 'Kopiert' : 'JSON kopieren'}
          </button>
        </section>

        <section className="intel-api-card intel-api-card--muted">
          <h2>Manifest</h2>
          <pre className="intel-api-preview intel-api-preview--sm">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        </section>
      </main>
    </div>
  );
}
