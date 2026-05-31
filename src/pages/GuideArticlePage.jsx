import { useEffect, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { getGuideCategory } from '../data/guideCatalog.js';
import {
  generateGuideArticle,
  buildAdvisorDeepLink,
  buildConfiguratorLink,
} from '../services/guideArticleService.js';
import {
  GuideCompareTable,
  GuideLeasingExamples,
  GuideRecommendationList,
  GuideCtaBlock,
  GuideFaq,
} from '../components/guide/GuideComponents.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import '../components/guide/GuideComponents.css';
import './GuidePage.css';

export default function GuideArticlePage() {
  const { slug } = useParams();
  const { publishedConditions: conditions } = usePublishedDealerConditions();

  const article = useMemo(
    () => (slug ? generateGuideArticle(slug, conditions) : null),
    [slug, conditions],
  );

  useEffect(() => {
    if (!article) return;
    document.title = `${article.title} | Clever-Neuwagen Ratgeber`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', article.metaDescription);
    } else {
      const el = document.createElement('meta');
      el.name = 'description';
      el.content = article.metaDescription;
      document.head.appendChild(el);
    }
  }, [article]);

  if (!article) {
    return <Navigate to="/ratgeber" replace />;
  }

  const category = getGuideCategory(article.category);
  const advisorLink = buildAdvisorDeepLink(article);
  const updatedDate = new Date(article.generatedAt).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <PageShell className="guide-shell">
      <article className="guide-page guide-article" itemScope itemType="https://schema.org/Article">
        <div className="guide-page__inner">
          <Link to="/ratgeber" className="guide-back">← Alle Ratgeber-Artikel</Link>

          <header className="guide-hero">
            <p className="guide-hero__kicker">{category?.label ?? 'Ratgeber'}</p>
            <h1 className="guide-hero__title" itemProp="headline">{article.title}</h1>
            <div className="guide-article__meta">
              <span>{article.readMinutes} Min. Lesezeit</span>
              <span>Aktualisiert: {updatedDate}</span>
              <span>{article.dealerName}</span>
            </div>
          </header>

          <p className="guide-article__intro" itemProp="description">{article.intro}</p>

          <section className="guide-section" aria-labelledby="guide-rec-heading">
            <h2 id="guide-rec-heading">Unsere Empfehlungen</h2>
            <GuideRecommendationList recommendations={article.recommendations} />
          </section>

          <section className="guide-section" aria-labelledby="guide-compare-heading">
            <h2 id="guide-compare-heading">Direkter Vergleich</h2>
            <GuideCompareTable items={article.compareItems} />
          </section>

          <section className="guide-section" aria-labelledby="guide-leasing-heading">
            <h2 id="guide-leasing-heading">Aktuelle Leasingbeispiele</h2>
            <GuideLeasingExamples
              examples={article.leasingExamples}
              dealerName={article.dealerName}
            />
            <LegalDisclaimer compact className="guide-disclaimer" />
          </section>

          <section className="guide-section">
            <h2>Konfigurator & Beratung</h2>
            <p className="guide-article__intro" style={{ marginBottom: 16 }}>
              Für Sportage-Modelle können Sie die Ausstattung im Konfigurator prüfen. Für eine persönliche Empfehlung starten Sie den KI-Berater.
            </p>
            <ul className="guide-rec-list">
              {article.recommendations.slice(0, 3).map((rec) => (
                <li key={rec.id} className="guide-rec-item">
                  <span className="guide-rec-item__rank">{rec.rankMedal}</span>
                  <div>
                    <p className="guide-rec-item__name">{rec.fullLabel ?? rec.label}</p>
                    <div className="guide-per-vehicle-cta">
                      {rec.engineId && (
                        <Link to={buildConfiguratorLink(rec)}>Konfigurator öffnen</Link>
                      )}
                      <Link to={advisorLink}>KI-Beratung mit diesem Profil</Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <GuideFaq items={article.faq} />

          <GuideCtaBlock
            advisorLink={advisorLink}
            configuratorLink="/haendler/autohaus-trinkle#sportage-konfigurator"
          />

          <p className="guide-disclaimer">
            Stand {updatedDate}. Alle Preise und Leasingraten sind unverbindliche Beispiele auf Basis der
            veröffentlichten Händlerkonditionen von {article.dealerName}. Abweichungen sind möglich.
          </p>
        </div>
      </article>
    </PageShell>
  );
}
