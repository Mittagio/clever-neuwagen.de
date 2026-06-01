import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  kiaSportage,
  formatPrice,
  getEquipment,
  getAvailableEnginesForTrim,
  getAvailableColorsForTrim,
  getPackagesWithAvailability,
  getAccessoriesWithAvailability,
  getVariant,
  getWltp,
} from '../../data/kiaSportage.js';
import { usePublishedDealerConditions, DEFAULT_DEALER_ID } from '../../context/DealerConditionsContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { calculatePrice } from '../../logic/priceCalculator.js';
import { createOfferFromConfig, buildOfferPath } from '../../logic/offerService.js';
import { createOrLinkLeadForOffer } from '../../logic/offerLeadService.js';
import ConfigCustomerSheet, { CONFIG_RESTORE_KEY } from './ConfigCustomerSheet.jsx';
import PriceSummary from './PriceSummary.jsx';
import ComplianceShieldBanner from '../compliance/ComplianceShieldBanner.jsx';
import { validateVehicleCompliance } from '../../logic/complianceShield.js';
import './SportageConfigurator.css';


const CUSTOMER_GROUPS = [

  { id: 'standard', label: 'Standard' },

  { id: 'corporateBenefits', label: 'Corporate Benefits' },

  { id: 'schwerbehindert', label: 'Schwerbehindert' },

  { id: 'oeffentlicherDienst', label: 'Öffentlicher Dienst' },

  { id: 'gewerbe', label: 'Gewerbe' },

];



const TERM_OPTIONS = [36, 48, 60];

const MILEAGE_OPTIONS = [10000, 15000, 20000];



const DEFAULT_TRIM = kiaSportage.trims.find((t) => t.id === 'vision') ?? kiaSportage.trims[0];

const DEFAULT_ENGINE = getAvailableEnginesForTrim(DEFAULT_TRIM.id)[0]

  ?? kiaSportage.engines.find((e) => e.id === 'tgi-hybrid-2wd')

  ?? kiaSportage.engines[0];

const DEFAULT_COLOR = getAvailableColorsForTrim(DEFAULT_TRIM.id)[0] ?? kiaSportage.colors[0];

const DEFAULT_VARIANT = getVariant(DEFAULT_TRIM.id, DEFAULT_ENGINE.id);



const INITIAL_CONFIG = {

  model: kiaSportage.model,

  variantId: DEFAULT_VARIANT?.id ?? 'sportage-hybrid-2wd-vision',

  engineId: DEFAULT_ENGINE.id,

  trimId: DEFAULT_TRIM.id,

  colorId: DEFAULT_COLOR.id,

  selectedPackageIds: [],

  selectedAccessoryIds: [],

  customerGroup: 'standard',

  paymentType: 'leasing',

  termMonths: 48,

  mileagePerYear: 10000,

  downPayment: 0,

};



export default function SportageConfigurator({ dealerName, dealerId = DEFAULT_DEALER_ID }) {
  const { publishedConditions, getConditionsForModel } = usePublishedDealerConditions(dealerId);
  const { addLead, leads, updateLead } = useLeads();
  const { addOffer, getExistingCodes, offers, linkLead } = useOffers();
  const {
    isLoggedIn,
    email: sessionEmail,
    customerData,
    registerConfiguration,
    registerOffer,
    linkConfigOffer,
    saveProfile,
  } = useCustomerAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [sheetMode, setSheetMode] = useState(null);
  const [toast, setToast] = useState('');
  const dealerConditions = getConditionsForModel('sportage');
  const price = useMemo(() => {
    const input = { ...config, model: kiaSportage.model, dealerConditions: publishedConditions };
    const result = calculatePrice(input, dealerConditions);
    if (result?.configurationPrice != null && result?.primaryRate != null) {
      return result;
    }
    return calculatePrice(
      { ...INITIAL_CONFIG, model: kiaSportage.model, dealerConditions: publishedConditions },
      dealerConditions,
    );
  }, [config, publishedConditions, dealerConditions]);



  const availableEngines = useMemo(

    () => getAvailableEnginesForTrim(config.trimId),

    [config.trimId],

  );



  const availableColors = useMemo(

    () => getAvailableColorsForTrim(config.trimId),

    [config.trimId],

  );



  const packagesWithStatus = useMemo(

    () => getPackagesWithAvailability(config.trimId, config.engineId, config.selectedPackageIds),

    [config.trimId, config.engineId, config.selectedPackageIds],

  );



  const accessoriesWithStatus = useMemo(

    () => getAccessoriesWithAvailability(config.trimId, config.engineId),

    [config.trimId, config.engineId],

  );



  const activeEquipment = getEquipment(config.trimId);

  const wltp = getWltp(config.engineId);

  const compliance = useMemo(
    () => validateVehicleCompliance({
      engineId: config.engineId,
      trimId: config.trimId,
      brand: kiaSportage.brand,
      model: kiaSportage.model,
    }),
    [config.engineId, config.trimId],
  );

  const activeVariant = getVariant(config.trimId, config.engineId);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CONFIG_RESTORE_KEY);
      if (!raw) return;
      const restored = JSON.parse(raw);
      sessionStorage.removeItem(CONFIG_RESTORE_KEY);
      if (restored?.trimId && restored?.engineId) {
        setConfig((prev) => ({ ...prev, ...restored }));
      }
    } catch {
      sessionStorage.removeItem(CONFIG_RESTORE_KEY);
    }
  }, []);

  function showToastMessage(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  function configLabels() {
    const trim = kiaSportage.trims.find((t) => t.id === config.trimId);
    const engine = kiaSportage.engines.find((e) => e.id === config.engineId);
    const color = kiaSportage.colors.find((c) => c.id === config.colorId);
    return {
      trimName: trim?.name ?? config.trimId,
      engineName: engine?.name ?? config.engineId,
      colorName: color?.name ?? config.colorId,
      variantLabel: `${trim?.name ?? ''} ${engine?.name ?? ''}`.trim(),
    };
  }

  function persistConfiguration(contact) {
    const labels = configLabels();
    saveProfile(
      { name: contact.name, phone: contact.phone },
      contact.email,
    );
    return registerConfiguration(
      config,
      price,
      dealerName ?? publishedConditions.dealerName,
      labels,
      contact.email,
    );
  }

  function handleSaveConfigClick() {
    if (isLoggedIn) {
      persistConfiguration({
        name: customerData?.profile?.name ?? '',
        email: sessionEmail,
        phone: customerData?.profile?.phone ?? '',
      });
      showToastMessage('Konfiguration gespeichert');
      return;
    }
    setSheetMode('save');
  }

  function handleSaveSubmit(contact) {
    persistConfiguration(contact);
    setSheetMode(null);
    showToastMessage('Konfiguration gespeichert');
  }

  function handleRequestQuoteClick() {
    setSheetMode('offer');
  }

  function handleOfferSubmit(contact) {
    const labels = configLabels();
    const customer = {
      name: contact.name?.trim() ?? '',
      email: contact.email?.trim().toLowerCase() ?? '',
      phone: contact.phone?.trim() ?? '',
    };

    saveProfile({ name: customer.name, phone: customer.phone }, customer.email);

    const configEntry = registerConfiguration(
      config,
      price,
      dealerName ?? publishedConditions.dealerName,
      labels,
      customer.email,
    );

    const offer = createOfferFromConfig(
      config,
      price,
      publishedConditions,
      customer,
      offers ?? getExistingCodes(),
    );
    offer.status = 'versendet';

    addOffer(offer);

    const { lead, leadId, isNew } = createOrLinkLeadForOffer(offer, leads);
    if (isNew) addLead({ ...lead, source: 'configurator' });
    else updateLead(leadId, lead);
    linkLead(offer.code, leadId);

    registerOffer(offer, customer.email);
    if (configEntry?.id) {
      linkConfigOffer(configEntry.id, offer.code, customer.email);
    }

    setSheetMode(null);
    navigate(buildOfferPath(offer.code));
  }


  useEffect(() => {

    if (!availableEngines.some((e) => e.id === config.engineId)) {

      const nextEngine = availableEngines[0];

      const nextVariant = nextEngine

        ? getVariant(config.trimId, nextEngine.id)

        : null;

      setConfig((prev) => ({

        ...prev,

        engineId: nextEngine?.id ?? prev.engineId,

        variantId: nextVariant?.id ?? prev.variantId,

      }));

    }

  }, [config.trimId, availableEngines, config.engineId]);



  useEffect(() => {

    if (!availableColors.some((c) => c.id === config.colorId)) {

      setConfig((prev) => ({

        ...prev,

        colorId: availableColors[0]?.id ?? prev.colorId,

      }));

    }

  }, [config.trimId, availableColors, config.colorId]);



  useEffect(() => {

    setConfig((prev) => ({

      ...prev,

      selectedPackageIds: prev.selectedPackageIds.filter(

        (id) => packagesWithStatus.some((p) => p.id === id && p.availability.allowed),

      ),

      selectedAccessoryIds: prev.selectedAccessoryIds.filter(

        (id) => accessoriesWithStatus.some((a) => a.id === id && a.availability.allowed),

      ),

    }));

  }, [config.trimId, config.engineId, packagesWithStatus, accessoriesWithStatus]);



  function update(partial) {

    setConfig((prev) => {

      const next = { ...prev, ...partial };

      if (partial.trimId || partial.engineId) {

        const trimId = partial.trimId ?? prev.trimId;

        const engineId = partial.engineId ?? prev.engineId;

        const variant = getVariant(trimId, engineId);

        next.variantId = variant?.id ?? prev.variantId;

        next.trimId = trimId;

        next.engineId = engineId;

      }

      return next;

    });

  }



  function togglePackage(packageId) {

    setConfig((prev) => {

      const ids = prev.selectedPackageIds.includes(packageId)

        ? prev.selectedPackageIds.filter((id) => id !== packageId)

        : [...prev.selectedPackageIds, packageId];

      return { ...prev, selectedPackageIds: ids };

    });

  }



  function toggleAccessory(accessoryId) {
    setConfig((prev) => {
      const ids = prev.selectedAccessoryIds.includes(accessoryId)
        ? prev.selectedAccessoryIds.filter((id) => id !== accessoryId)
        : [...prev.selectedAccessoryIds, accessoryId];
      return { ...prev, selectedAccessoryIds: ids };
    });
  }

  return (
    <div className="configurator">

      <div className="configurator-options">

        <section className="config-section">

          <h2 className="config-section-title">Ausstattung</h2>

          <div className="option-grid">

            {kiaSportage.trims.map((trim) => (

              <button

                key={trim.id}

                type="button"

                className={`option-card ${config.trimId === trim.id ? 'is-active' : ''}`}

                onClick={() => update({ trimId: trim.id })}

              >

                <span className="option-card-name">{trim.name}</span>

                <span className="option-card-desc">{trim.shortDescription}</span>

              </button>

            ))}

          </div>

          {activeEquipment.standard.length > 0 && (

            <ul className="config-equipment-list">

              {activeEquipment.standard.slice(0, 4).map((item) => (

                <li key={item}>{item}</li>

              ))}

              {activeEquipment.standard.length > 4 && (

                <li className="config-equipment-more">

                  +{activeEquipment.standard.length - 4} weitere Serienausstattungen

                </li>

              )}

            </ul>

          )}

        </section>



        <section className="config-section">

          <h2 className="config-section-title">Motor / Getriebe</h2>

          <div className="option-grid">

            {availableEngines.map((engine) => {

              const variant = getVariant(config.trimId, engine.id);

              return (

                <button

                  key={engine.id}

                  type="button"

                  disabled={!variant}

                  className={`option-card ${config.engineId === engine.id ? 'is-active' : ''} ${!variant ? 'is-disabled' : ''}`}

                  onClick={() => update({ engineId: engine.id })}

                >

                  <span className="option-card-name">{engine.name}</span>

                  <span className="option-card-desc">

                    {engine.powerPs} PS · {engine.transmission}

                  </span>

                  <span className="option-card-desc">{engine.fuelType} · {engine.drive}</span>

                  {variant && (

                    <span className="option-card-price">ab {formatPrice(variant.priceGross)}</span>

                  )}

                </button>

              );

            })}

          </div>

        </section>



        <section className="config-section">

          <h2 className="config-section-title">Farbe</h2>

          <div className="color-grid">

            {availableColors.map((color) => (

              <button

                key={color.id}

                type="button"

                className={`color-swatch ${config.colorId === color.id ? 'is-active' : ''}`}

                onClick={() => update({ colorId: color.id })}

                title={color.name}

                aria-label={`${color.name}${color.priceGross ? `, +${formatPrice(color.priceGross)}` : ''}`}

              >

                <span

                  className={`color-swatch-circle${color.type === 'twoTone' ? ' color-swatch-circle--twotone' : ''}`}

                  style={{ background: color.hexPreview }}

                />

                <span className="color-swatch-name">{color.name}</span>

                {color.priceGross > 0 && (

                  <span className="color-swatch-price">+{formatPrice(color.priceGross)}</span>

                )}

              </button>

            ))}

          </div>

        </section>



        <section className="config-section">

          <h2 className="config-section-title">Pakete</h2>

          <div className="package-list">

            {packagesWithStatus.map((pkg) => {

              const selected = config.selectedPackageIds.includes(pkg.id);

              const disabled = !pkg.availability.allowed;

              return (

                <label

                  key={pkg.id}

                  className={`package-item ${selected ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}

                >

                  <input

                    type="checkbox"

                    checked={selected}

                    disabled={disabled}

                    onChange={() => !disabled && togglePackage(pkg.id)}

                  />

                  <div className="package-item-body">

                    <span className="package-item-name">{pkg.name}</span>

                    <span className="package-item-desc">{pkg.description}</span>

                    {disabled && (

                      <span className="package-item-hint">{pkg.availability.reason}</span>

                    )}

                  </div>

                  <span className="package-item-price">+{formatPrice(pkg.priceGross)}</span>

                </label>

              );

            })}

          </div>

        </section>



        <section className="config-section">

          <h2 className="config-section-title">Zubehör</h2>

          <div className="package-list">

            {accessoriesWithStatus.map((acc) => {

              const selected = config.selectedAccessoryIds.includes(acc.id);

              const disabled = !acc.availability.allowed;

              return (

                <label

                  key={acc.id}

                  className={`package-item ${selected ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}

                >

                  <input

                    type="checkbox"

                    checked={selected}

                    disabled={disabled}

                    onChange={() => !disabled && toggleAccessory(acc.id)}

                  />

                  <div className="package-item-body">

                    <span className="package-item-name">{acc.name}</span>

                    <span className="package-item-desc">{acc.description}</span>

                    {disabled && (

                      <span className="package-item-hint">{acc.availability.reason}</span>

                    )}

                    {acc.notes && !disabled && (

                      <span className="package-item-hint">{acc.notes}</span>

                    )}

                  </div>

                  <span className="package-item-price">+{formatPrice(acc.priceGross)}</span>

                </label>

              );

            })}

          </div>

        </section>



        <ComplianceShieldBanner
          validation={compliance}
          compact
          showFields={false}
        />

        {wltp && (

          <section className="config-section config-section--wltp">

            <h2 className="config-section-title">WLTP</h2>

            <div className="config-wltp-card">

              <p className="config-wltp-row">

                <span>Verbrauch komb.</span>

                <strong>{wltp.consumptionCombined}</strong>

              </p>

              <p className="config-wltp-row">

                <span>CO₂</span>

                <strong>{wltp.co2Combined?.min ?? wltp.co2Combined} g/km · Klasse {wltp.efficiencyClass ?? wltp.co2Class}</strong>

              </p>

            </div>

          </section>

        )}



        <section className="config-section">

          <h2 className="config-section-title">Kundengruppe</h2>

          <div className="form-group">

            <select

              className="form-select"

              value={config.customerGroup}

              onChange={(e) => update({ customerGroup: e.target.value })}

            >

              {CUSTOMER_GROUPS.map((g) => (

                <option key={g.id} value={g.id}>

                  {g.label} (−{dealerConditions.discounts[g.id]}&nbsp;%)

                </option>

              ))}

            </select>

          </div>

        </section>



        <section className="config-section">

          <h2 className="config-section-title">Zahlungsart</h2>

          <div className="payment-tabs" role="tablist">

            {[

              { id: 'leasing', label: 'Leasing' },

              { id: 'finance', label: 'Finanzierung' },

              { id: 'cash', label: 'Barkauf' },

            ].map((tab) => (

              <button

                key={tab.id}

                type="button"

                role="tab"

                aria-selected={config.paymentType === tab.id}

                className={`payment-tab ${config.paymentType === tab.id ? 'is-active' : ''}`}

                onClick={() => update({ paymentType: tab.id })}

              >

                {tab.label}

              </button>

            ))}

          </div>



          {config.paymentType !== 'cash' && (

            <div className="payment-details">

              <div className="form-group">

                <label className="form-label" htmlFor="termMonths">Laufzeit</label>

                <select

                  id="termMonths"

                  className="form-select"

                  value={config.termMonths}

                  onChange={(e) => update({ termMonths: Number(e.target.value) })}

                >

                  {TERM_OPTIONS.map((m) => (

                    <option key={m} value={m}>{m} Monate</option>

                  ))}

                </select>

              </div>



              {config.paymentType === 'leasing' && (

                <div className="form-group">

                  <label className="form-label" htmlFor="mileage">Kilometer pro Jahr</label>

                  <select

                    id="mileage"

                    className="form-select"

                    value={config.mileagePerYear}

                    onChange={(e) => update({ mileagePerYear: Number(e.target.value) })}

                  >

                    {MILEAGE_OPTIONS.map((km) => (

                      <option key={km} value={km}>{km.toLocaleString('de-DE')} km/Jahr</option>

                    ))}

                  </select>

                </div>

              )}



              <div className="form-group">

                <label className="form-label" htmlFor="downPayment">Anzahlung</label>

                <input

                  id="downPayment"

                  type="number"

                  className="form-input"

                  min={0}

                  step={500}

                  value={config.downPayment}

                  onChange={(e) => update({ downPayment: Number(e.target.value) || 0 })}

                />

              </div>

            </div>

          )}

        </section>



        {kiaSportage.legalNotes?.length > 0 && (

          <section className="config-section config-section--legal">

            <ul className="config-legal-notes">

              {kiaSportage.legalNotes.map((note) => (

                <li key={note}>{note}</li>

              ))}

            </ul>

            {activeVariant && (

              <p className="config-meta">

                Preisliste {kiaSportage.priceListDate} · Version {kiaSportage.modelYear}

              </p>

            )}

          </section>

        )}

      </div>



      <PriceSummary
        price={price}
        dealerName={dealerName}
        config={config}
        isLoggedIn={isLoggedIn}
        onSaveConfig={handleSaveConfigClick}
        onRequestQuote={handleRequestQuoteClick}
      />

      {sheetMode && (
        <ConfigCustomerSheet
          mode={sheetMode}
          dealerName={dealerName ?? publishedConditions.dealerName}
          onClose={() => setSheetMode(null)}
          onSubmit={sheetMode === 'save' ? handleSaveSubmit : handleOfferSubmit}
        />
      )}

      {toast && <p className="config-toast" role="status">{toast}</p>}
    </div>
  );
}