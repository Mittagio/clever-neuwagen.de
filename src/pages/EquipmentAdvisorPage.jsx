import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { sportage } from '../data/kiaSportage.js';
import {
  analyzeEquipmentWishes,
  buildConfigFromEquipmentResult,
  buildEquipmentPriceFromResult,
  CUSTOMER_WISHES,
  formatPrice,
} from '../logic/equipmentAdvisor.js';
import { createOfferFromConfig, buildOfferPath } from '../logic/offerService.js';
import { createOrLinkLeadForOffer } from '../logic/offerLeadService.js';
import ConfigCustomerSheet, { stashConfigForRestore } from '../components/configurator/ConfigCustomerSheet.jsx';
import { recordIntelligenceEquipment } from '../services/intelligenceAnalytics.js';
import EquipmentFlowProgress from '../components/equipment/EquipmentFlowProgress.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import './EquipmentAdvisorPage.css';

export default function EquipmentAdvisorPage() {
  const navigate = useNavigate();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { leads, addLead, updateLead } = useLeads();
  const { offers, addOffer, linkLead, getExistingCodes } = useOffers();
  const {
    isLoggedIn,
    email: sessionEmail,
    customerData,
    registerConfiguration,
    registerOffer,
    linkConfigOffer,
    saveProfile,
  } = useCustomerAuth();

  const [selected, setSelected] = useState([]);
  const [sheetMode, setSheetMode] = useState(null);
  const [flowComplete, setFlowComplete] = useState(false);
  const [createdOfferCode, setCreatedOfferCode] = useState(null);
  const [toast, setToast] = useState('');

  const result = useMemo(
    () => analyzeEquipmentWishes(selected, conditions),
    [selected, conditions],
  );

  const hasResult = !result.empty && result.recommended && !result.allImpossible;
  const flowStep = sheetMode === 'offer' ? 'offer' : hasResult ? 'result' : 'wishes';

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  function toggleWish(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id],
    );
    setFlowComplete(false);
    setCreatedOfferCode(null);
  }

  function buildLabels(rec) {
    const wishLabels = selected
      .map((id) => CUSTOMER_WISHES.find((w) => w.id === id)?.label)
      .filter(Boolean);
    return {
      trimName: rec.trimName,
      engineName: sportage.engines.find((e) => e.id === 'tgi-hybrid-2wd')?.name,
      colorName: sportage.colors.find((c) => c.id === 'carraraweiss')?.name,
      variantLabel: rec.trimName,
      wishLabels,
    };
  }

  function openInConfigurator() {
    const config = buildConfigFromEquipmentResult(result.recommended);
    if (!config) return;
    stashConfigForRestore({ config });
    navigate('/haendler/autohaus-trinkle#sportage-konfigurator');
  }

  function persistRecommendation(contact) {
    const config = buildConfigFromEquipmentResult(result.recommended);
    const price = buildEquipmentPriceFromResult(result.recommended, conditions);
    const labels = buildLabels(result.recommended);

    saveProfile(
      { name: contact.name, phone: contact.phone },
      contact.email,
    );

    return registerConfiguration(
      config,
      {
        ...price,
        primaryRate: result.recommended.pricing.leasingRate,
        configurationPrice: result.recommended.pricing.listPrice,
        hauspreis: price?.hauspreis ?? price?.housePrice,
      },
      conditions.dealerName,
      labels,
      contact.email,
    );
  }

  function handleSaveClick() {
    if (!hasResult) return;
    if (isLoggedIn) {
      persistRecommendation({
        name: customerData?.profile?.name ?? '',
        email: sessionEmail,
        phone: customerData?.profile?.phone ?? '',
      });
      showToast('Empfehlung gespeichert');
      return;
    }
    setSheetMode('save');
  }

  function recordEquipmentWishes() {
    const features = selected
      .map((id) => CUSTOMER_WISHES.find((w) => w.id === id)?.label)
      .filter(Boolean);
    if (features.length) {
      recordIntelligenceEquipment(features, { source: 'equipment_advisor' });
    }
  }

  function handleSaveSubmit(contact) {
    recordEquipmentWishes();
    persistRecommendation(contact);
    setSheetMode(null);
    showToast('Empfehlung gespeichert');
  }

  function handleOfferClick() {
    if (!hasResult) return;
    setSheetMode('offer');
  }

  function handleOfferSubmit(contact) {
    recordEquipmentWishes();
    const config = buildConfigFromEquipmentResult(result.recommended);
    const price = buildEquipmentPriceFromResult(result.recommended, conditions);
    const customer = {
      name: contact.name?.trim() ?? '',
      email: contact.email?.trim().toLowerCase() ?? '',
      phone: contact.phone?.trim() ?? '',
    };

    const configEntry = persistRecommendation(contact);

    const offer = createOfferFromConfig(
      config,
      price,
      conditions,
      customer,
      offers ?? getExistingCodes(),
    );
    offer.status = 'versendet';
    offer.source = 'equipment';

    addOffer(offer);

    const { lead, leadId, isNew } = createOrLinkLeadForOffer(offer, leads);
    if (isNew) addLead({ ...lead, source: 'berater' });
    else updateLead(leadId, lead);
    linkLead(offer.code, leadId);

    registerOffer(offer, customer.email);
    if (configEntry?.id) {
      linkConfigOffer(configEntry.id, offer.code, customer.email);
    }

    setSheetMode(null);
    setFlowComplete(true);
    setCreatedOfferCode(offer.code);
    showToast(`Angebot ${offer.code} erstellt`);
  }

  return (
    <div className="eq-advisor">
      <header className="eq-advisor__hero">
        <Link to="/haendler/autohaus-trinkle" className="eq-advisor__back">
          ← Zurück
        </Link>
        <p className="eq-advisor__kicker">Ausstattungsberater</p>
        <h1 className="eq-advisor__title">Was wünschen Sie sich?</h1>
        <p className="eq-advisor__sub">
          Tippen Sie Ihre Wünsche an – wir zeigen die passende {sportage.model}-Variante inkl. Pakete und Preis.
        </p>
        <Link to="/berater?start=1" className="eq-advisor__ki-link">
          🤖 Oder KI-Kaufberater starten
        </Link>
      </header>

      <EquipmentFlowProgress currentStep={flowStep} completed={flowComplete} />

      <section className="eq-advisor__wishes">
        <div className="eq-advisor__wish-grid">
          {CUSTOMER_WISHES.map((wish) => {
            const isOn = selected.includes(wish.id);
            return (
              <button
                key={wish.id}
                type="button"
                className={`eq-advisor__wish${isOn ? ' eq-advisor__wish--on' : ''}`}
                onClick={() => toggleWish(wish.id)}
                aria-pressed={isOn}
              >
                <span className="eq-advisor__wish-emoji">{wish.emoji}</span>
                <span className="eq-advisor__wish-label">{wish.label}</span>
                <span className="eq-advisor__wish-check">{isOn ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </section>

      {result.empty && (
        <section className="eq-advisor__empty card">
          <p>Wählen Sie mindestens einen Wunsch – das Ergebnis erscheint sofort.</p>
        </section>
      )}

      {!result.empty && result.recommended && (
        <>
          <section className="eq-advisor__result eq-advisor__result--good card">
            <div className="eq-advisor__result-head">
              <span className="eq-advisor__status eq-advisor__status--ok">✓ Empfohlen</span>
            </div>
            <h2 className="eq-advisor__variant">{result.recommended.vehicleLabel}</h2>

            {result.recommended.packages.length > 0 && (
              <div className="eq-advisor__packages">
                <p className="eq-advisor__packages-title">Dazu empfohlen:</p>
                <ul className="eq-advisor__packages-list">
                  {result.recommended.packages.map((pkg) => (
                    <li key={pkg.id}>
                      <span>{pkg.label}</span>
                      {pkg.price > 0 && (
                        <span className="eq-advisor__pkg-price">+{formatPrice(pkg.price)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="eq-advisor__fulfilled">
              {result.fulfilledWishes.map((w) => (
                <li key={w.id} className={w.included ? 'is-ok' : 'is-miss'}>
                  <span>{w.included ? '✓' : '○'}</span>
                  <span>{w.emoji} {w.label}</span>
                  {w.viaPackage && (
                    <span className="eq-advisor__via">über {w.viaPackage}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="eq-advisor__price card">
            <p className="eq-advisor__price-label">Ihr Preis</p>
            <p className="eq-advisor__price-main">
              ab {formatPrice(result.recommended.pricing.cashPrice)}
            </p>
            <p className="eq-advisor__price-leasing">
              oder {formatPrice(result.recommended.pricing.leasingRate)}/Monat Leasing
            </p>
            {result.recommended.priceDelta > 0 && (
              <p className="eq-advisor__price-delta">
                +{formatPrice(result.recommended.priceDelta)} für Ihre Wünsche
              </p>
            )}
            <LegalDisclaimer compact className="eq-advisor__disclaimer" />
          </section>
        </>
      )}

      {!result.empty && result.impossible.length > 0 && (
        <section className="eq-advisor__result eq-advisor__result--bad card">
          <div className="eq-advisor__result-head">
            <span className="eq-advisor__status eq-advisor__status--no">✗ Nicht möglich mit</span>
          </div>
          <ul className="eq-advisor__impossible-list">
            {result.impossible.map((t) => (
              <li key={t.trimId}>
                <strong>{sportage.model} {t.trimName}</strong>
                {t.missingWishes.length > 0 && (
                  <span className="eq-advisor__missing">
                    fehlt: {t.missingWishes.join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!result.empty && result.allImpossible && (
        <section className="eq-advisor__result eq-advisor__result--warn card">
          <p>
            Mit dieser Kombination ist kein {sportage.model} möglich.
            Bitte weniger Wünsche wählen oder uns anrufen.
          </p>
          {conditions.contact?.phone && (
            <a href={`tel:${conditions.contact.phone}`} className="eq-advisor__call">
              {conditions.contact.phone}
            </a>
          )}
        </section>
      )}

      {flowComplete && createdOfferCode && (
        <section className="eq-advisor__success card">
          <p className="eq-advisor__success-title">✓ Angebot erstellt</p>
          <p>Angebotsnummer: <strong>{createdOfferCode}</strong></p>
          <div className="eq-advisor__success-actions">
            <Link to={buildOfferPath(createdOfferCode)} className="btn btn-primary">
              Angebot ansehen
            </Link>
            <Link to="/kunde" className="btn btn-secondary">
              Mein Clever-Neuwagen
            </Link>
          </div>
        </section>
      )}

      {hasResult && !flowComplete && (
        <footer className="eq-advisor__footer">
          <button type="button" className="btn btn-primary" onClick={handleOfferClick}>
            Angebot anfragen
          </button>
          <button type="button" className="btn btn-secondary" onClick={openInConfigurator}>
            Im Konfigurator öffnen
          </button>
          <button type="button" className="btn btn-ghost eq-advisor__save-btn" onClick={handleSaveClick}>
            {isLoggedIn ? '💾 Speichern' : '💾 In Mein Konto speichern'}
          </button>
        </footer>
      )}

      {sheetMode && (
        <ConfigCustomerSheet
          mode={sheetMode}
          dealerName={conditions.dealerName}
          onClose={() => setSheetMode(null)}
          onSubmit={sheetMode === 'save' ? handleSaveSubmit : handleOfferSubmit}
        />
      )}

      {toast && <p className="eq-advisor__toast" role="status">{toast}</p>}
    </div>
  );
}
