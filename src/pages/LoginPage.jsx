import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import usePageSeo from '../hooks/usePageSeo';
import CustomerAuthFlow from '../components/customer/CustomerAuthFlow.jsx';
import BrandLogo from '../components/layout/BrandLogo.jsx';
import '../components/layout/BrandLogo.css';
import './CustomerPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return') || '/mein-bereich';

  usePageSeo({
    title: 'Anmelden',
    description: 'Anmeldung per E-Mail-Code – ohne Passwort.',
    path: '/login',
  });

  return (
    <div className="customer-page">
      <header className="customer-page-header">
        <Link to="/" className="customer-page-logo" aria-label="Clever-Neuwagen Startseite">
          <BrandLogo variant="full" />
        </Link>
        <p className="customer-page-title">Anmelden</p>
      </header>
      <main className="customer-page-main">
        <CustomerAuthFlow onSuccess={() => navigate(returnTo, { replace: true })} />
      </main>
    </div>
  );
}
