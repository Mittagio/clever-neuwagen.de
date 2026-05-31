import PageShell from '../components/layout/PageShell';
import LandingHero from '../components/landing/LandingHero.jsx';
import LandingTrust from '../components/landing/LandingTrust.jsx';
import LandingTrending from '../components/landing/LandingTrending.jsx';
import LandingStats from '../components/landing/LandingStats.jsx';
import LandingClassicSearch from '../components/landing/LandingClassicSearch.jsx';
import LandingWhy from '../components/landing/LandingWhy.jsx';
import LandingDealerNetwork from '../components/landing/LandingDealerNetwork.jsx';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <PageShell className="landing-shell">
      <div className="lp-page">
        <LandingHero />
        <div className="lp-page__container">
          <LandingTrust />
          <LandingTrending />
          <LandingStats />
          <LandingClassicSearch />
          <LandingWhy />
          <LandingDealerNetwork />
        </div>
      </div>
    </PageShell>
  );
}
