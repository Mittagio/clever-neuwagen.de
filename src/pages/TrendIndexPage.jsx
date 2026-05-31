import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { TREND_CATEGORIES, getTrendCategory } from '../data/trendCatalog.js';
import { listPublicTrendPages } from '../services/trendArticleService.js';
import { TrendPageCard, TrendFeaturedCard, TrendCategoryNav } from '../components/trends/TrendComponents.jsx';
import '../components/guide/GuideComponents.css';
import '../components/trends/TrendComponents.css';
import './GuidePage.css';

export default function TrendIndexPage() {
  const [activeCategory, setActiveCategory] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function onUpdate() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener('clever-published-trends-update', onUpdate);
    window.addEventListener('clever-intelligence-update', onUpdate);
    return () => {
      window.removeEventListener('clever-published-trends-update', onUpdate);
      window.removeEventListener('clever-intelligence-update', onUpdate);
    };
  }, []);

  const pages = useMemo(() => listPublicTrendPages('7d'), [refreshKey]);

  const featured = useMemo(
    () => pages
      .filter((page) => page.source === 'intelligence' && page.publishedAt)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 3),
    [pages],
  );

  const filtered = useMemo(() => {
    let list = pages;
    if (activeCategory) {
      list = pages.filter((p) => {
        const cat = (p.category ?? '').toLowerCase();
        return cat === activeCategory || cat.includes(activeCategory);
      });
    }
    const featuredSlugs = new Set(featured.map((p) => p.slug));
    return list.filter((p) => !featuredSlugs.has(p.slug) || activeCategory);
  }, [pages, activeCategory, featured]);

  return (
    <PageShell className="guide-shell">
      <div className="guide-page">
        <div className="guide-page__inner guide-page__inner--wide">
          <header className="guide-hero">
            <p className="guide-hero__kicker">Trends</p>
            <h1 className="guide-hero__title">Was der Markt gerade sucht</h1>
            <p className="guide-hero__sub">
              Automatisch aktualisierte Einordnungen aus Beratungen, Vergleichen und Angeboten –
              mit echten Leasingbeispielen und Empfehlungen.
            </p>
          </header>

          <TrendCategoryNav
            categories={TREND_CATEGORIES}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
          />

          {!activeCategory && featured.length > 0 && (
            <section className="trend-featured-strip" aria-label="Neu veröffentlichte Trends">
              <h2 className="trend-featured-strip__head">Frisch aus Intelligence</h2>
              {featured.map((page) => (
                <TrendFeaturedCard
                  key={page.slug}
                  page={page}
                  categoryLabel={
                    getTrendCategory(page.category)?.label
                    ?? page.category
                    ?? 'Trend'
                  }
                />
              ))}
            </section>
          )}

          <div className="guide-grid">
            {filtered.map((page) => (
              <TrendPageCard
                key={page.slug}
                page={page}
                categoryLabel={
                  getTrendCategory(page.category)?.label
                  ?? page.category
                  ?? 'Trend'
                }
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="guide-article__intro">Keine Trends in dieser Kategorie.</p>
          )}

          <aside className="guide-cta" style={{ marginTop: '40px' }}>
            <h2 className="guide-cta__title">Mehr Hintergrundwissen</h2>
            <p className="guide-cta__text">
              Ausführliche Ratgeber-Artikel mit FAQ und dauerhaften Vergleichen finden Sie im Ratgeber.
            </p>
            <div className="guide-cta__actions">
              <Link to="/ratgeber" className="guide-cta__btn guide-cta__btn--secondary">
                Zum Ratgeber
              </Link>
              <Link to="/berater?start=1" className="guide-cta__btn guide-cta__btn--primary">
                🤖 KI-Beratung
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
