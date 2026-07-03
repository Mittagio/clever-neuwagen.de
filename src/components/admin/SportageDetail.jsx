import { useState } from 'react';
import { sportage, formatPrice } from '../../data/kiaSportage.js';
import { MANUFACTURER_MEDIA } from '../../data/media/manufacturerImages.js';
import { SPORTAGE_TABS } from '../../data/adminCatalog.js';
import { getModelDataStatus, getChangeCenter } from '../../data/vehicleDataService.js';
import DataStatusCard from './DataStatusCard.jsx';
import ChangeCenter from './ChangeCenter.jsx';
import HealthIndicator from './HealthIndicator.jsx';
import StatusBadge from './StatusBadge.jsx';
import VehicleImage from '../shared/VehicleImage.jsx';
import ComplianceShieldBanner from '../compliance/ComplianceShieldBanner.jsx';
import { validateVehicleCompliance } from '../../logic/complianceShield.js';
import { buildAdminEnVkvStatusLabel, resolveVehicleEnvironmentalData } from '../../services/vehicle/vehicleEnvironmentalData.js';
import './SportageDetail.css';

function FieldRow({ label, value, hint }) {
  return (
    <div className="admin-field">
      <span className="admin-field-label">{label}</span>
      <span className="admin-field-value">{value}</span>
      {hint && <span className="admin-field-hint">{hint}</span>}
    </div>
  );
}

function TabGrunddaten() {
  const { admin } = sportage;
  return (
    <div className="admin-tab-content">
      <div className="admin-fields-grid">
        <FieldRow label="Modellname" value={`${sportage.brand} ${sportage.model}`} />
        <FieldRow label="Modelljahr" value={sportage.modelYear} />
        <FieldRow label="Tagline" value={sportage.tagline} />
        <FieldRow label="Stand der Preisliste" value={admin.priceListDate} />
        <FieldRow label="Quelle" value={admin.priceListSource} />
        <FieldRow label="Zuletzt aktualisiert" value={admin.lastUpdated} />
        <FieldRow label="Bearbeitet von" value={admin.updatedBy} />
        <FieldRow label="Status" value={<HealthIndicator health={getModelDataStatus('sportage').health} />} />
      </div>
    </div>
  );
}

function TabMotoren() {
  return (
    <div className="admin-tab-content">
      <div className="admin-item-list">
        {sportage.engines.map((engine) => (
          <article key={engine.id} className="admin-item-card">
            <h3 className="admin-item-title">{engine.name}</h3>
            <div className="admin-item-meta">
              <span>{engine.power} {engine.powerUnit}</span>
              <span>{engine.fuel}</span>
              <span>{engine.transmission}</span>
              <span>{engine.drive}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TabAusstattungen() {
  return (
    <div className="admin-tab-content">
      <div className="admin-item-list">
        {sportage.trims.map((trim) => (
          <article key={trim.id} className="admin-item-card">
            <h3 className="admin-item-title">{trim.name}</h3>
            <p className="admin-item-desc">{trim.description}</p>
            <p className="admin-item-price-label">Basispreise je Motor:</p>
            <ul className="admin-price-list">
              {sportage.upe
                .filter((u) => u.trimId === trim.id)
                .map((u) => {
                  const engine = sportage.engines.find((e) => e.id === u.engineId);
                  return (
                    <li key={`${u.trimId}-${u.engineId}`}>
                      {engine?.name ?? u.engineId}: {formatPrice(u.price)}
                    </li>
                  );
                })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

function TabFarben() {
  return (
    <div className="admin-tab-content">
      <div className="admin-color-list">
        {sportage.colors.map((color) => (
          <article key={color.id} className="admin-color-card">
            <span className="admin-color-swatch" style={{ background: color.hex }} />
            <div className="admin-color-body">
              <h3 className="admin-item-title">{color.name}</h3>
              <p className="admin-item-desc">{color.type}</p>
            </div>
            <span className="admin-color-price">
              {color.price === 0 ? 'Inklusive' : `+${formatPrice(color.price)}`}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

function TabPakete() {
  return (
    <div className="admin-tab-content">
      <div className="admin-item-list">
        {sportage.packages.map((pkg) => {
          const deps = sportage.packageDependencies.filter(
            (d) => d.packageId === pkg.id,
          );
          return (
            <article key={pkg.id} className="admin-item-card">
              <div className="admin-item-header">
                <h3 className="admin-item-title">{pkg.name}</h3>
                <span className="admin-item-price">+{formatPrice(pkg.price)}</span>
              </div>
              <p className="admin-item-desc">{pkg.description}</p>
              {deps.length > 0 && (
                <div className="admin-deps">
                  <span className="admin-deps-label">Abhängigkeiten</span>
                  <ul>
                    {deps.map((dep, i) => (
                      <li key={i}>{dep.note ?? dep.includesFeature ?? JSON.stringify(dep)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TabSerienausstattung() {
  return (
    <div className="admin-tab-content">
      {sportage.trims.map((trim) => {
        const eq = sportage.equipment[trim.id] ?? { standard: [], optional: [] };
        return (
          <article key={trim.id} className="admin-item-card admin-item-card--spaced">
            <h3 className="admin-item-title">{trim.name}</h3>
            <p className="admin-eq-section-label">Serienausstattung</p>
            <ul className="admin-eq-list">
              {eq.standard.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {eq.optional.length > 0 && (
              <>
                <p className="admin-eq-section-label">Optional / Pakete</p>
                <ul className="admin-eq-list admin-eq-list--optional">
                  {eq.optional.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

function TabWltp() {
  return (
    <div className="admin-tab-content">
      <p className="admin-tab-hint">
        WLTP-Werte nur aus Herstellerdatenbank – Änderungen über Preislisten-Import / Admin-Freigabe.
      </p>
      <div className="admin-item-list">
        {sportage.engines.map((engine) => {
          const validation = validateVehicleCompliance({ engineId: engine.id });
          return (
            <article key={engine.id} className="admin-item-card">
              <h3 className="admin-item-title">{engine.name}</h3>
              <p className="admin-item-envkv-status">
                {buildAdminEnVkvStatusLabel(resolveVehicleEnvironmentalData({
                  engineId: engine.id,
                  trimId: 'spirit',
                  isNewPassengerCar: true,
                }))}
              </p>
              <ComplianceShieldBanner validation={validation} compact />
              <div className="admin-wltp-grid">
                <FieldRow label="Kraftstoff" value={validation.values.fuel} />
                <FieldRow label="Verbrauch komb." value={validation.values.consumptionCombined} />
                <FieldRow label="CO₂ komb." value={validation.values.co2Combined} />
                <FieldRow label="CO₂-Klasse" value={validation.values.co2Class} />
                <FieldRow label="Datenstandard" value={validation.values.dataStandard} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TabBilder() {
  const media = MANUFACTURER_MEDIA.kia?.sportage ?? {};
  const entries = Object.entries(media);

  return (
    <div className="admin-tab-content">
      <p className="admin-tab-hint">
        Herstellerbilder aus ManufacturerMediaSystem · Pfad: public/images/manufacturers/kia/sportage/
      </p>
      <div className="admin-image-grid">
        {entries.map(([key]) => (
          <article key={key} className="admin-image-card">
            <div className="admin-image-wrap">
              <VehicleImage
                brand="Kia"
                model="Sportage"
                variant={key === 'default' ? 'card' : key}
                className="admin-image-wrap__visual"
                imageClassName="admin-image-wrap__img"
                alt={`${sportage.model} ${key}`}
                showSourceBadge
              />
            </div>
            <span className="admin-image-label">{key}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function TabAenderungsverlauf() {
  return (
    <div className="admin-tab-content">
      <div className="admin-changelog">
        {sportage.changeLog.map((entry, i) => (
          <article key={i} className="admin-changelog-item">
            <time className="admin-changelog-date">{entry.date}</time>
            <div className="admin-changelog-body">
              <p className="admin-changelog-change">{entry.change}</p>
              <p className="admin-changelog-source">Quelle: {entry.source}</p>
            </div>
            <StatusBadge status={entry.status} type="change" />
          </article>
        ))}
      </div>
    </div>
  );
}

const TAB_COMPONENTS = {
  grunddaten: TabGrunddaten,
  motoren: TabMotoren,
  ausstattungen: TabAusstattungen,
  farben: TabFarben,
  pakete: TabPakete,
  serienausstattung: TabSerienausstattung,
  wltp: TabWltp,
  bilder: TabBilder,
  aenderungsverlauf: TabAenderungsverlauf,
};

export default function SportageDetail({ onBack }) {
  const [activeTab, setActiveTab] = useState('grunddaten');
  const TabContent = TAB_COMPONENTS[activeTab] ?? TabGrunddaten;
  const dataStatus = getModelDataStatus('sportage');
  const modelChanges = getChangeCenter({ model: 'sportage' });

  return (
    <section className="admin-section sportage-detail">
      <header className="admin-section-head">
        <button type="button" className="admin-back-btn" onClick={onBack}>← Kia Modelle</button>
        <div className="sportage-detail-head">
          <div>
            <h2 className="admin-section-title">{sportage.brand} {sportage.model}</h2>
            <p className="admin-section-desc">
              Modelljahr {sportage.modelYear} · Fahrzeugdaten-Service
            </p>
          </div>
          <HealthIndicator health={dataStatus.health} size="lg" />
        </div>
      </header>

      <DataStatusCard status={dataStatus} />

      <ChangeCenter
        items={modelChanges}
        title="Änderungen · Sportage"
      />

      <nav className="admin-tabs" aria-label="Sportage Stammdaten">
        {SPORTAGE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="admin-tab-panel card">
        <TabContent />
      </div>
    </section>
  );
}
