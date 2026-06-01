import { Link } from 'react-router-dom';
import usePageSeo from '../../hooks/usePageSeo';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import CustomerAuthFlow from '../../components/customer/CustomerAuthFlow.jsx';
import AccountDashboard from '../../components/sprint7/AccountDashboard.jsx';
import BrandLogo from '../../components/layout/BrandLogo.jsx';
import '../../components/layout/BrandLogo.css';
import '../CustomerPage.css';

export default function AccountPage() {
  const { isLoggedIn } = useCustomerAuth();

  usePageSeo({
    title: 'Mein Konto',
    description: 'Ihre Angebote, Vergleiche, Favoriten, Dokumente und Fahrzeugstatus bei Clever-Neuwagen.',
    path: '/account',
  });

  return (
    <div className="customer-page">
      <header className="customer-page-header">
        <Link to="/" className="customer-page-logo" aria-label="Clever-Neuwagen Startseite">
          <BrandLogo variant="full" />
        </Link>
        <p className="customer-page-title">Persönlicher Kundenbereich</p>
      </header>

      <main className="customer-page-main">
        {isLoggedIn ? <AccountDashboard /> : <CustomerAuthFlow />}
      </main>
    </div>
  );
}
