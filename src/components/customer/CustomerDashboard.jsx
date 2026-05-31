import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { CUSTOMER_TABS, getEmptyTabMessage } from '../../data/customerDemoData.js';
import { mergeLiveOffers } from '../../services/customerAccountService.js';
import CustomerItemCard from './CustomerItemCard.jsx';
import './CustomerDashboard.css';

export default function CustomerDashboard() {
  const { email, customerData, logout } = useCustomerAuth();
  const { offers: globalOffers } = useOffers();
  const [activeTab, setActiveTab] = useState('offers');

  const mergedData = useMemo(() => {
    if (!customerData) return null;
    return {
      ...customerData,
      offers: mergeLiveOffers(customerData.offers ?? [], globalOffers, email),
    };
  }, [customerData, globalOffers, email]);

  const currentTab = CUSTOMER_TABS.find((t) => t.id === activeTab);
  const items = mergedData?.[currentTab?.key] ?? [];

  const counts = CUSTOMER_TABS.reduce((acc, tab) => {
    const list = tab.key === 'offers'
      ? mergeLiveOffers(customerData?.offers ?? [], globalOffers, email)
      : customerData?.[tab.key] ?? [];
    acc[tab.id] = list.length;
    return acc;
  }, {});

  return (
    <div className="cust-dashboard">
      <header className="cust-dashboard-header">
        <div>
          <p className="cust-dashboard-greeting">Mein Clever-Neuwagen</p>
          <p className="cust-dashboard-email">{email}</p>
        </div>
        <button type="button" className="cust-dashboard-logout" onClick={logout}>
          Abmelden
        </button>
      </header>

      <nav className="cust-tabs" aria-label="Mein Bereich">
        {CUSTOMER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cust-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span className="cust-tab-count">{counts[tab.id]}</span>
            )}
          </button>
        ))}
      </nav>

      <section className="cust-list-section">
        <h2 className="cust-list-title">Meine {currentTab?.label}</h2>

        {items.length > 0 ? (
          <div className="cust-list">
            {items.map((item) => (
              <CustomerItemCard key={item.id ?? item.offerCode} item={item} type={activeTab} />
            ))}
          </div>
        ) : (
          <div className="cust-empty">
            <p>{getEmptyTabMessage(activeTab)}</p>
            {(activeTab === 'offers' || activeTab === 'comparisons' || activeTab === 'configurations') && (
              <Link
                to={activeTab === 'configurations' ? '/haendler/autohaus-trinkle#sportage-konfigurator' : '/berater?start=1'}
                className="cust-empty-cta"
              >
                {activeTab === 'configurations' ? 'Sportage konfigurieren' : 'KI-Beratung starten'}
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
