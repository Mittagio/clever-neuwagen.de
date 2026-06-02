import PageShell from '../components/layout/PageShell';
import LandingHero from '../components/landing/LandingHero.jsx';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <PageShell className="landing-shell">
      <div className="lp-page lp-page--one-search">
        <LandingHero />
      </div>
    </PageShell>
  );
}
