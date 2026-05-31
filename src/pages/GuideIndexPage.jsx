import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { GUIDE_ARTICLES, GUIDE_CATEGORIES, getGuideCategory } from '../data/guideCatalog.js';
import { GuideArticleCard, GuideCategoryNav } from '../components/guide/GuideComponents.jsx';
import '../components/guide/GuideComponents.css';
import './GuidePage.css';

export default function GuideIndexPage() {
  const [activeCategory, setActiveCategory] = useState(null);

  const filtered = useMemo(() => {
    if (!activeCategory) return GUIDE_ARTICLES;
    return GUIDE_ARTICLES.filter((a) => a.category === activeCategory);
  }, [activeCategory]);

  return (
    <PageShell className="guide-shell">
      <div className="guide-page">
        <div className="guide-page__inner guide-page__inner--wide">
          <header className="guide-hero">
            <p className="guide-hero__kicker">Ratgeber</p>
            <h1 className="guide-hero__title">Auto-Kaufberatung mit echten Leasingbeispielen</h1>
            <p className="guide-hero__sub">
              Vergleiche, Empfehlungen und aktuelle Händlerkonditionen – automatisch aus unserem KI-Berater, verständlich aufbereitet.
            </p>
          </header>

          <GuideCategoryNav activeCategory={activeCategory} onSelect={setActiveCategory} />

          <div className="guide-grid">
            {filtered.map((article) => (
              <GuideArticleCard
                key={article.slug}
                article={article}
                categoryLabel={getGuideCategory(article.category)?.label ?? article.category}
              />
            ))}
          </div>

          <aside className="guide-cta" style={{ marginTop: '40px' }}>
            <h2 className="guide-cta__title">Individuelle Beratung</h2>
            <p className="guide-cta__text">
              Kein Artikel trifft Ihre Situation? Der KI-Kaufberater findet in wenigen Minuten passende Fahrzeuge.
            </p>
            <div className="guide-cta__actions">
              <Link to="/berater?start=1" className="guide-cta__btn guide-cta__btn--primary">
                🤖 KI-Beratung starten
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
