import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { ACCOUNT_TABS, getAccountEmptyMessage, VEHICLE_STATUS_STAGES } from '../../data/accountTabs.js';
import { mergeLiveOffers } from '../../services/customerAccountService.js';
import { buildOfferPath } from '../../logic/offerService.js';
import CustomerItemCard from '../customer/CustomerItemCard.jsx';
import './AccountDashboard.css';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AccountDashboard() {
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

  const currentTab = ACCOUNT_TABS.find((t) => t.id === activeTab);

  const counts = ACCOUNT_TABS.reduce((acc, tab) => {
    const list = tab.key === 'offers'
      ? mergeLiveOffers(customerData?.offers ?? [], globalOffers, email)
      : customerData?.[tab.key] ?? [];
    acc[tab.id] = list.length;
    return acc;
  }, {});

  function renderTabContent() {
    if (activeTab === 'documents') {
      const docs = mergedData?.documents ?? [];
      if (!docs.length) {
        return (
          <div className="account-empty">
            <p>{getAccountEmptyMessage('documents')}</p>
          </div>
        );
      }
      return (
        <ul className="account-doc-list">
          {docs.map((doc) => (
            <li key={doc.id} className="account-doc-item">
              <div>
                <p className="account-doc-item__name">{doc.label ?? doc.fileName}</p>
                <p className="account-doc-item__meta">
                  {doc.vehicleLabel && <span>{doc.vehicleLabel} · </span>}
                  {formatDate(doc.uploadedAt)}
                </p>
              </div>
              {doc.offerCode && (
                <Link to={buildOfferPath(doc.offerCode)} className="account-doc-item__link">
                  Zum Angebot
                </Link>
              )}
            </li>
          ))}
        </ul>
      );
    }

    if (activeTab === 'vehicleStatus') {
      const statuses = mergedData?.vehicleStatus ?? [];
      if (!statuses.length) {
        return (
          <div className="account-empty">
            <p>{getAccountEmptyMessage('vehicleStatus')}</p>
          </div>
        );
      }
      return (
        <div className="account-status-list">
          {statuses.map((vs) => {
            const stageMeta = VEHICLE_STATUS_STAGES[vs.stage] ?? { label: vs.stage };
            return (
              <article key={vs.id} className="account-status-card">
                <div className="account-status-card__head">
                  <h3>{vs.label}</h3>
                  <span className="account-status-card__badge">{stageMeta.label}</span>
                </div>
                <p className="account-status-card__dealer">{vs.dealer}</p>
                <p className="account-status-card__delivery">Lieferzeit: {vs.deliveryTime}</p>
                {vs.offerCode && (
                  <Link to={buildOfferPath(vs.offerCode)} className="account-status-card__link">
                    Angebot öffnen
                  </Link>
                )}
                {vs.events?.length > 0 && (
                  <ul className="account-status-timeline">
                    {vs.events.slice(-4).reverse().map((ev, i) => (
                      <li key={`${ev.at}-${i}`}>
                        <span>{formatDate(ev.at)}</span>
                        {ev.label}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      );
    }

    const items = mergedData?.[currentTab?.key] ?? [];
    if (!items.length) {
      return (
        <div className="account-empty">
          <p>{getAccountEmptyMessage(activeTab)}</p>
          {(activeTab === 'offers' || activeTab === 'comparisons' || activeTab === 'favorites') && (
            <Link to="/berater?start=1" className="account-empty-cta">
              KI-Beratung starten
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="account-list">
        {items.map((item) => (
          <CustomerItemCard key={item.id ?? item.offerCode} item={item} type={activeTab} />
        ))}
      </div>
    );
  }

  return (
    <div className="account-dashboard">
      <header className="account-dashboard-header">
        <div>
          <p className="account-dashboard-greeting">Mein Bereich</p>
          <p className="account-dashboard-email">{email}</p>
        </div>
        <button type="button" className="account-dashboard-logout" onClick={logout}>
          Abmelden
        </button>
      </header>

      <nav className="account-tabs" aria-label="Kundenkonto">
        {ACCOUNT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`account-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span className="account-tab-count">{counts[tab.id]}</span>
            )}
          </button>
        ))}
      </nav>

      <section className="account-section">
        <h2 className="account-section-title">{currentTab?.headline}</h2>
        {renderTabContent()}
      </section>
    </div>
  );
}
