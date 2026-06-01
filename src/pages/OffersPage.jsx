import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useOffers } from '../context/OffersContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { OFFER_STATUS, OFFER_STATUS_ORDER } from '../data/offerTypes.js';
import { createOrLinkLeadForOffer } from '../logic/offerLeadService.js';
import {
  formatOfferRate,
  formatTrackingDate,
  getPaymentLabel,
  getSourceLabel,
  printOfferPdf,
  buildOfferPath,
} from '../logic/offerService.js';
import OfferStatusChip from '../components/offers/OfferStatusChip.jsx';
import OfferCreateSheet from '../components/offers/OfferCreateSheet.jsx';
import OfferQuickSend from '../components/offers/OfferQuickSend.jsx';
import OfferTracking from '../components/offers/OfferTracking.jsx';
import OfferVehicleImage from '../components/shared/OfferVehicleImage.jsx';
import './OffersPage.css';

export default function OffersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { offers, addOffer, updateOfferStatus, markSent, linkLead, getOfferUrl } = useOffers();
  const { leads, addLead, updateLead } = useLeads();
  const { publishedConditions: conditions } = usePublishedDealerConditions();

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState(
    location.state?.selectedCode ?? offers[0]?.code ?? null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (location.state?.selectedCode) {
      setSelectedCode(location.state.selectedCode);
    }
  }, [location.state]);

  const filtered = useMemo(() => {
    let list = [...offers].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    if (filter !== 'all') {
      list = list.filter((o) => o.status === filter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.code.toLowerCase().includes(q)
          || o.customer.name?.toLowerCase().includes(q)
          || o.customer.email?.toLowerCase().includes(q)
          || o.vehicle.label?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [offers, filter, search]);

  const selected = offers.find((o) => o.code === selectedCode) ?? filtered[0] ?? null;
  const offerUrl = selected ? getOfferUrl(selected.code) : '';

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function handleCreateOffer(offer) {
    addOffer(offer);
    const { lead, leadId, isNew } = createOrLinkLeadForOffer(offer, leads);
    if (isNew) {
      addLead(lead);
    } else {
      updateLead(leadId, lead);
    }
    linkLead(offer.code, leadId);
    setSelectedCode(offer.code);
    setShowCreate(false);
    showToast(`Angebot ${offer.code} erstellt${isNew ? ' · Lead angelegt' : ' · Lead verknüpft'}`);
  }

  function handleStatusChange(code, status) {
    updateOfferStatus(code, status);
    showToast(`Status: ${OFFER_STATUS[status]?.label ?? status}`);
  }

  return (
    <div className="offers-page">
      <aside className={`offers-page__list${selected ? ' offers-page__list--hidden-mobile' : ''}`}>
        <header className="offers-page__header">
          <div className="offers-page__header-top">
            <Link to="/backend" className="offers-page__back">←</Link>
            <h1 className="offers-page__title">Angebote</h1>
            <Link to="/sales" className="offers-page__sales" title="Verkäufermodus">⚡</Link>
          </div>
          <input
            type="search"
            className="offers-page__search"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="offers-page__new-btn"
            onClick={() => setShowCreate(true)}
          >
            + Neues Angebot
          </button>
        </header>

        <div className="offers-page__filters" role="tablist">
          <button
            type="button"
            className={`offers-page__filter${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Alle ({offers.length})
          </button>
          {OFFER_STATUS_ORDER.map((key) => {
            const count = offers.filter((o) => o.status === key).length;
            if (!count) return null;
            return (
              <button
                key={key}
                type="button"
                className={`offers-page__filter${filter === key ? ' is-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {OFFER_STATUS[key].label} ({count})
              </button>
            );
          })}
        </div>

        <ul className="offers-page__cards">
          {filtered.map((offer) => (
            <li key={offer.code}>
              <button
                type="button"
                className={`offers-card${selected?.code === offer.code ? ' is-selected' : ''}`}
                onClick={() => setSelectedCode(offer.code)}
              >
                <div className="offers-card__top">
                  <OfferStatusChip status={offer.status} compact />
                  <span className="offers-card__code">{offer.code}</span>
                </div>
                <p className="offers-card__vehicle">{offer.vehicle.label}</p>
                <p className="offers-card__customer">
                  {offer.customer.name || offer.customer.email || 'Ohne Kunde'}
                </p>
                <p className="offers-card__rate">{formatOfferRate(offer.pricing)}</p>
                <p className="offers-card__meta">
                  {getSourceLabel(offer.source)} · {formatTrackingDate(offer.updatedAt)}
                </p>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="offers-page__empty">Keine Angebote gefunden</li>
          )}
        </ul>
      </aside>

      <main className={`offers-page__detail${!selected ? ' offers-page__detail--empty' : ''}`}>
        {!selected ? (
          <div className="offers-page__placeholder">
            <p>Angebot wählen oder neues Angebot erstellen</p>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Neues Angebot
            </button>
          </div>
        ) : (
          <>
            <header className="offers-detail__header">
              <button
                type="button"
                className="offers-detail__back-mobile"
                onClick={() => setSelectedCode(null)}
              >
                ← Liste
              </button>
              <div>
                <p className="offers-detail__code">{selected.code}</p>
                <h2 className="offers-detail__title">{selected.vehicle.label}</h2>
                <p className="offers-detail__customer">
                  {selected.customer.name}
                  {selected.customer.email && ` · ${selected.customer.email}`}
                </p>
              </div>
              <OfferStatusChip status={selected.status} />
            </header>

            <OfferVehicleImage
              offer={selected}
              dealerId={conditions.dealerId}
              className="offers-detail__visual"
              imageClassName="offers-detail__visual-img"
            />

            <section className="offers-detail__section">
              <h3>Preis & Zahlung</h3>
              <p className="offers-detail__rate">{formatOfferRate(selected.pricing)}</p>
              <p className="offers-detail__rate-label">{getPaymentLabel(selected.pricing.paymentType)}</p>
              <dl className="offers-detail__dl">
                <div>
                  <dt>Leasing</dt>
                  <dd>{selected.pricing.leasingRate != null ? `${selected.pricing.leasingRate} €/Monat` : '–'}</dd>
                </div>
                <div>
                  <dt>Finanzierung</dt>
                  <dd>{selected.pricing.financeRate != null ? `${selected.pricing.financeRate} €/Monat` : '–'}</dd>
                </div>
                <div>
                  <dt>Kaufpreis</dt>
                  <dd>{selected.pricing.cashPrice != null ? `${selected.pricing.cashPrice.toLocaleString('de-DE')} €` : '–'}</dd>
                </div>
                <div>
                  <dt>Lieferzeit</dt>
                  <dd>{selected.deliveryTime}</dd>
                </div>
              </dl>
            </section>

            <section className="offers-detail__section">
              <h3>Konfiguration</h3>
              <ul className="offers-detail__config">
                {selected.configuration.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="offers-detail__section">
              <h3>Status</h3>
              <div className="offers-detail__status-grid">
                {OFFER_STATUS_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`offers-detail__status-btn${selected.status === key ? ' is-active' : ''}`}
                    style={{
                      color: OFFER_STATUS[key].color,
                      background: selected.status === key ? OFFER_STATUS[key].bg : 'transparent',
                      borderColor: OFFER_STATUS[key].bg,
                    }}
                    onClick={() => handleStatusChange(selected.code, key)}
                  >
                    {OFFER_STATUS[key].label}
                  </button>
                ))}
              </div>
            </section>

            <section className="offers-detail__section">
              <h3>Schnellversand</h3>
              <OfferQuickSend
                offer={selected}
                url={offerUrl}
                onMarkSent={() => markSent(selected.code)}
              />
            </section>

            <section className="offers-detail__section">
              <OfferTracking tracking={selected.tracking} />
            </section>

            <section className="offers-detail__actions">
              <button
                type="button"
                className="btn btn-primary offers-detail__action"
                onClick={() => navigate(buildOfferPath(selected.code))}
              >
                Kundenansicht öffnen
              </button>
              <button
                type="button"
                className="btn btn-secondary offers-detail__action"
                onClick={() => {
                  navigate(buildOfferPath(selected.code));
                  setTimeout(printOfferPdf, 400);
                }}
              >
                PDF erzeugen
              </button>
              {selected.leadId && (
                <Link
                  to="/leads"
                  state={{ selectedLeadId: selected.leadId }}
                  className="btn btn-secondary offers-detail__action"
                >
                  Lead anzeigen
                </Link>
              )}
            </section>
          </>
        )}
      </main>

      {showCreate && (
        <OfferCreateSheet
          conditions={conditions}
          existingOffers={offers}
          onCreate={handleCreateOffer}
          onClose={() => setShowCreate(false)}
        />
      )}

      {toast && <p className="offers-page__toast">{toast}</p>}
    </div>
  );
}
