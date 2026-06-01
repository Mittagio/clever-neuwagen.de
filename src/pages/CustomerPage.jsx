import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import CustomerAuthFlow from '../components/customer/CustomerAuthFlow.jsx';
import CustomerDashboard from '../components/customer/CustomerDashboard.jsx';
import BrandLogo from '../components/layout/BrandLogo.jsx';
import '../components/layout/BrandLogo.css';
import './CustomerPage.css';

export default function CustomerPage() {
  const { isLoggedIn } = useCustomerAuth();

  return (
    <div className="customer-page">
      <header className="customer-page-header">
        <Link to="/" className="customer-page-logo" aria-label="Clever-Neuwagen Startseite">
          <BrandLogo variant="full" />
        </Link>
        <p className="customer-page-title">Mein Clever-Neuwagen</p>
      </header>

      <main className="customer-page-main">
        {isLoggedIn ? (
          <CustomerDashboard />
        ) : (
          <CustomerAuthFlow />
        )}
      </main>
    </div>
  );
}
