import { useMemo, useState } from 'react';
import { sportage, kiaSportage } from '../../data/kiaSportage.js';
import { calculatePrice } from '../../logic/priceCalculator.js';
import { createOffer } from '../../logic/offerService.js';
import { formatPrice } from '../../data/kiaSportage.js';
import './OfferComponents.css';

const CUSTOMER_GROUPS = [
  { id: 'standard', label: 'Standard' },
  { id: 'corporateBenefits', label: 'Corporate Benefits' },
  { id: 'schwerbehindert', label: 'Schwerbehindert' },
  { id: 'oeffentlicherDienst', label: 'Öffentlicher Dienst' },
  { id: 'gewerbe', label: 'Gewerbe' },
];

const DEFAULT_CONFIG = {
  engineId: 'tgi-hybrid-2wd',
  trimId: 'vision',
  colorId: 'carraraweiss',
  selectedPackageIds: [],
  selectedAccessoryIds: [],
  customerGroup: 'standard',
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 15000,
  downPayment: 0,
};

export default function OfferCreateSheet({
  initialConfig,
  initialCustomer,
  conditions,
  existingOffers,
  onCreate,
  onClose,
}) {
  const [customer, setCustomer] = useState({
    name: initialCustomer?.name ?? '',
    email: initialCustomer?.email ?? '',
    phone: initialCustomer?.phone ?? '',
  });

  const [config, setConfig] = useState({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  const price = useMemo(
    () => calculatePrice(
      { ...config, model: 'Sportage', dealerConditions: conditions },
      conditions,
    ),
    [config, conditions],
  );

  function updateConfig(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const offer = createOffer({
      config,
      customer,
      conditions,
      existingOffers,
      source: initialConfig ? 'configurator' : 'manual',
      status: 'entwurf',
    });
    onCreate(offer);
  }

  const rate = config.paymentType === 'cash'
    ? price.cashPrice
    : config.paymentType === 'finance'
      ? price.financeRate
      : price.leasingRate;

  return (
    <div className="offer-sheet-overlay" onClick={onClose} role="presentation">
      <div className="offer-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="offer-sheet-head">
          <h2>Neues Angebot</h2>
          <button type="button" className="offer-sheet-close" onClick={onClose} aria-label="Schließen">✕</button>
        </header>

        <form className="offer-sheet-form" onSubmit={handleSubmit}>
          <section className="offer-sheet-section">
            <h3>Kunde</h3>
            <div className="offer-sheet-grid">
              <label className="offer-field">
                Name
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Max Mustermann"
                />
              </label>
              <label className="offer-field">
                E-Mail
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                  placeholder="kunde@firma.de"
                />
              </label>
              <label className="offer-field">
                Telefon
                <input
                  type="tel"
                  value={customer.phone}
                  onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="+49 …"
                />
              </label>
            </div>
          </section>

          <section className="offer-sheet-section">
            <h3>Fahrzeug & Konfiguration</h3>
            <div className="offer-sheet-grid">
              <label className="offer-field">
                Ausstattung
                <select value={config.trimId} onChange={(e) => updateConfig('trimId', e.target.value)}>
                  {kiaSportage.trims.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="offer-field">
                Motor
                <select value={config.engineId} onChange={(e) => updateConfig('engineId', e.target.value)}>
                  {sportage.engines.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </label>
              <label className="offer-field">
                Farbe
                <select value={config.colorId} onChange={(e) => updateConfig('colorId', e.target.value)}>
                  {sportage.colors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="offer-field">
                Kundengruppe
                <select value={config.customerGroup} onChange={(e) => updateConfig('customerGroup', e.target.value)}>
                  {CUSTOMER_GROUPS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="offer-sheet-section">
            <h3>Zahlung</h3>
            <div className="offer-payment-tabs">
              {[
                { id: 'leasing', label: 'Leasing' },
                { id: 'finance', label: 'Finanzierung' },
                { id: 'cash', label: 'Kauf' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`offer-payment-tab ${config.paymentType === tab.id ? 'is-active' : ''}`}
                  onClick={() => updateConfig('paymentType', tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="offer-sheet-grid">
              <label className="offer-field">
                Laufzeit (Monate)
                <select value={config.termMonths} onChange={(e) => updateConfig('termMonths', Number(e.target.value))}>
                  {[36, 48, 60].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              {config.paymentType === 'leasing' && (
                <label className="offer-field">
                  km/Jahr
                  <select value={config.mileagePerYear} onChange={(e) => updateConfig('mileagePerYear', Number(e.target.value))}>
                    {[10000, 15000, 20000].map((km) => (
                      <option key={km} value={km}>{km.toLocaleString('de-DE')}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="offer-field">
                Anzahlung (€)
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.downPayment}
                  onChange={(e) => updateConfig('downPayment', Number(e.target.value) || 0)}
                />
              </label>
            </div>
          </section>

          <aside className="offer-sheet-preview">
            <p className="offer-sheet-preview-label">Live-Preis</p>
            <p className="offer-sheet-preview-rate">
              {config.paymentType === 'cash'
                ? formatPrice(rate ?? 0)
                : `${formatPrice(rate ?? 0)}/Monat`}
            </p>
            <p className="offer-sheet-preview-meta">
              Hauspreis {formatPrice(price.hauspreis)} · {price.deliveryTime}
            </p>
          </aside>

          <button type="submit" className="btn btn-primary offer-sheet-submit">
            Angebot erstellen
          </button>
        </form>
      </div>
    </div>
  );
}
