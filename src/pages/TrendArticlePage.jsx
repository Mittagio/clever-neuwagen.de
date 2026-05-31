import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { getTrendCategory } from '../data/trendCatalog.js';
import {
  generateTrendArticle,
  buildTrendAdvisorLink,
} from '../services/trendArticleService.js';
import { shareTrendArticle } from '../services/trendShareService.js';import { buildConfiguratorLink } from '../services/guideArticleService.js';
import {
  GuideCompareTable,
  GuideLeasingExamples,
  GuideRecommendationList,
  GuideCtaBlock,
} from '../components/guide/GuideComponents.jsx';
import { TrendMarketInsights, TrendDealsStrip } from '../components/trends/TrendComponents.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import '../components/guide/GuideComponents.css';
import '../components/trends/TrendComponents.css';
import './GuidePage.css';

export default function TrendArticlePage() {
  const { slug } = useParams();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const [shareMsg, setShareMsg] = useState('');

  const article = useMemo(
    () => (slug ? generateTrendArticle(slug, conditions) : null),
    [slug, conditions],
  );

  async function handleShare() {
    if (!article) return;
    const result = await shareTrendArticle(article);
    if (result.ok && result.method === 'clipboard') {
      setShareMsg('Link kopiert – bereit zum Teilen');
    } else if (result.ok) {
      setShareMsg('Geteilt');
    }
    if (result.ok) {
      setTimeout(() => setShareMsg(''), 2800);
    }
  }

  useEffect(() => {
    if (!article) return;
    document.title = `${article.title} | Clever-Neuwagen Trends`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', article.metaDescription);
    }
  }, [article]);

  if (!article) {
    return <Navigate to="/trends" replace />;
  }

  if (article.isRatgeberMirror && article.url) {
    return <Navigate to={article.url} replace />;
  }

  const category = getTrendCategory(article.category);
  const advisorLink = buildTrendAdvisorLink(article);
  const updatedDate = new Date(article.generatedAt).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const isLive = article.marketInsights?.dataMode === 'live';

  return (
    <PageShell className="guide-shell">
      <article className="guide-page guide-article" itemScope itemType="https://schema.org/Article">
        <div className="guide-page__inner">
          <Link to="/trends" className="guide-back">← Alle Trends</Link>

          <header className="guide-hero">
            <p className="guide-hero__kicker">{category?.label ?? 'Markttrend'}</p>
            <h1 className="guide-hero__title" itemProp="headline">{article.title}</h1>
            <div className="guide-article__meta">
              <span>{article.readMinutes} Min. Lesezeit</span>
              <span>Aktualisiert: {updatedDate}</span>
              <span>{article.dealerName}</span>
              <span className={isLive ? 'trend-live-badge' : 'trend-demo-badge'}>
                {isLive ? 'Live-Daten' : 'Demo-Daten'}
              </span>
              <button type="button" className="trend-share-btn" onClick={handleShare}>
                Teilen
              </button>
            </div>
            {shareMsg && <p className="trend-share-msg" role="status">{shareMsg}</p>}
          </header>

          <p className="guide-article__intro" itemProp="description">{article.intro}</p>

          <TrendMarketInsights insights={article.marketInsights} />
          <TrendDealsStrip recommendations={article.recommendations} />

          <section className="guide-section" aria-labelledby="trend-rec-heading">
            <h2 id="trend-rec-heading">Top-Empfehlungen</h2>
            <GuideRecommendationList recommendations={article.recommendations} />
          </section>

          <section className="guide-section" aria-labelledby="trend-compare-heading">
            <h2 id="trend-compare-heading">Vergleich</h2>
            <GuideCompareTable items={article.compareItems} />
          </section>

          <section className="guide-section" aria-labelledby="trend-leasing-heading">
            <h2 id="trend-leasing-heading">Aktuelle Leasingbeispiele</h2>
            <GuideLeasingExamples
              examples={article.leasingExamples}
              dealerName={article.dealerName}
            />
            <LegalDisclaimer compact className="guide-disclaimer" />
          </section>

          <section className="guide-section">
            <h2>Nächster Schritt</h2>
            <ul className="guide-rec-list">
              {article.recommendations.slice(0, 3).map((rec) => (
                <li key={rec.id} className="guide-rec-item">
                  <span className="guide-rec-item__rank">{rec.rankMedal}</span>
                  <div>
                    <p className="guide-rec-item__name">{rec.fullLabel ?? rec.label}</p>
                    <div className="guide-per-vehicle-cta">
                      {rec.engineId && (
                        <Link to={buildConfiguratorLink(rec)}>Konfigurator</Link>
                      )}
                      <Link to={advisorLink}>KI-Beratung</Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <GuideCtaBlock
            advisorLink={advisorLink}
            configuratorLink="/haendler/autohaus-trinkle#sportage-konfigurator"
          />

          <p className="guide-disclaimer">
            Stand {updatedDate}. Trendseiten werden aus Marktdaten und Händlerkonditionen von{' '}
            {article.dealerName} generiert. Alle Preise unverbindlich.
          </p>
        </div>
      </article>
    </PageShell>
  );
}
