import { useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import { LEAD_STATUS } from '../../data/leadTypes.js';
import './BackendVehicleShowroom.css';

const SHOWROOM_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'active', label: 'Aktiv' },
  { id: 'unpublished', label: 'Nicht veröffentlicht' },
  { id: 'actionSoon', label: 'Aktion läuft' },
  { id: 'stock', label: 'Lagerbestand' },
  { id: 'availableNow', label: 'Sofort verfügbar' },
  { id: 'ev', label: 'Elektro' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'combustion', label: 'Verbrenner' },
];

const DETAIL_TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'conditions', label: 'Konditionen' },
  { id: 'campaigns', label: 'Aktionen' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'publish', label: 'Veröffentlichung' },
  { id: 'sales', label: 'Verkaufschancen' },
  { id: 'stats', label: 'Statistik' },
];

const CHANNELS = ['Homepage', 'Instagram', 'Facebook', 'WhatsApp', 'Leasingmarkt', 'mobile.de', 'Google Ads'];

const MODEL_META = {
  sportage: { powertrain: 'hybrid', imageModel: 'Sportage', baseRate: 255, stock: 6 },
  ev3: { powertrain: 'ev', imageModel: 'EV3', baseRate: 299, stock: 2 },
  ev4: { powertrain: 'ev', imageModel: 'EV4', baseRate: 319, stock: 1 },
  picanto: { powertrain: 'combustion', imageModel: 'Picanto', baseRate: 189, stock: 3 },
};

const CAMPAIGN_SEED = {
  sportage: [
    { id: 'camp-s-1', name: 'Lagerabverkauf', discount: 25, expiresInDays: 4 },
    { id: 'camp-s-2', name: 'Hausmesse', discount: 20, expiresInDays: 12 },
    { id: 'camp-s-3', name: 'Sommeraktion', discount: 22, expiresInDays: 21 },
    { id: 'camp-s-4', name: 'Black Week', discount: 30, expiresInDays: 51 },
  ],
};

function resolveModelMeta(model) {
  return MODEL_META[model.id] ?? {
    powertrain: 'hybrid',
    imageModel: model.name,
    baseRate: 249,
    stock: 0,
  };
}

function modelLeadMatch(lead, model) {
  const label = `${lead.vehicle?.label ?? ''} ${lead.vehicle?.model ?? ''}`.toLowerCase();
  return label.includes(model.name.toLowerCase());
}

function calcModelStats(model, leads, offers) {
  const modelLeads = leads.filter((lead) => modelLeadMatch(lead, model));
  const inquiries = modelLeads.length;
  const offersCount = modelLeads.filter((lead) => lead.offerCode).length;
  const sales = modelLeads.filter((lead) => lead.status === 'bestellung' || lead.status === 'ausgeliefert').length;
  const conversion = inquiries > 0 ? Math.round((sales / inquiries) * 100) : 0;
  const rates = modelLeads.map((lead) => lead.currentRate).filter((value) => Number.isFinite(value));
  const avgRate = rates.length ? Math.round(rates.reduce((sum, value) => sum + value, 0) / rates.length) : null;
  const offersForModel = offers.filter((offer) => (offer.model ?? '').toLowerCase().includes(model.name.toLowerCase()));
  return {
    inquiries,
    offers: Math.max(offersCount, offersForModel.length),
    sales,
    conversion,
    avgRate,
  };
}

function statusTone(model, actionCount) {
  if (!model.showOnDealerPage) return { label: 'Nicht veröffentlicht', tone: 'red' };
  if (actionCount > 0) return { label: 'Aktion läuft bald aus', tone: 'yellow' };
  return { label: 'Aktiv', tone: 'green' };
}

export default function BackendVehicleShowroom({
  conditions,
  onUpdateModel,
  onUpdateDelivery,
  onUpdateDiscount,
}) {
  const { leads } = useLeads();
  const { offers } = useOffers();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedModelId, setSelectedModelId] = useState(conditions.activeModels?.[0]?.id ?? 'sportage');
  const [campaignsByModel, setCampaignsByModel] = useState(CAMPAIGN_SEED);

  const showroomModels = useMemo(() => {
    return (conditions.activeModels ?? []).map((model) => {
      const meta = resolveModelMeta(model);
      const stats = calcModelStats(model, leads, offers);
      const campaigns = campaignsByModel[model.id] ?? [];
      const actionSoonCount = campaigns.filter((campaign) => campaign.expiresInDays <= 7).length;
      const tone = statusTone(model, actionSoonCount);
      const delivery = conditions.deliveryByModel?.[model.id]?.defaultDeliveryTime ?? model.defaultDeliveryTime ?? '4–6 Wochen';
      const discount = conditions.discountsByModel?.[model.id]?.aktion ?? conditions.discountsByModel?.[model.id]?.standard ?? 0;
      const inventory = (conditions.inventoryVehicles ?? []).filter(
        (item) => (item.model ?? '').toLowerCase().includes(model.name.toLowerCase()),
      );
      return {
        ...model,
        meta,
        stats,
        inventoryCount: inventory.length || meta.stock,
        availableNowCount: inventory.filter((item) => item.type === 'lager').length,
        campaigns,
        actionSoonCount,
        tone,
        delivery,
        discount,
        baseRate: stats.avgRate ?? meta.baseRate,
      };
    });
  }, [conditions, leads, offers, campaignsByModel]);

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return showroomModels.filter((model) => {
      if (query) {
        const haystack = `${model.brand} ${model.name}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      switch (activeFilter) {
        case 'active':
          return model.active;
        case 'unpublished':
          return !model.showOnDealerPage;
        case 'actionSoon':
          return model.actionSoonCount > 0;
        case 'stock':
          return model.inventoryCount > 0;
        case 'availableNow':
          return model.availableNowCount > 0;
        case 'ev':
          return model.meta.powertrain === 'ev';
        case 'hybrid':
          return model.meta.powertrain === 'hybrid';
        case 'combustion':
          return model.meta.powertrain === 'combustion';
        default:
          return true;
      }
    });
  }, [showroomModels, activeFilter, search]);

  const selectedModel = showroomModels.find((model) => model.id === selectedModelId) ?? showroomModels[0] ?? null;

  const topKpis = useMemo(() => {
    const activeModels = showroomModels.filter((model) => model.active).length;
    const inquiries = showroomModels.reduce((sum, model) => sum + model.stats.inquiries, 0);
    const offerCount = showroomModels.reduce((sum, model) => sum + model.stats.offers, 0);
    const sales = showroomModels.reduce((sum, model) => sum + model.stats.sales, 0);
    const conversion = inquiries > 0 ? Math.round((sales / inquiries) * 100) : 0;
    const campaigns = showroomModels.reduce((sum, model) => sum + model.campaigns.length, 0);
    return { activeModels, inquiries, offerCount, sales, conversion, campaigns };
  }, [showroomModels]);

  function addCampaign() {
    if (!selectedModel) return;
    const title = window.prompt('Name der Aktion', 'Neue Aktion');
    if (!title) return;
    setCampaignsByModel((prev) => {
      const next = [...(prev[selectedModel.id] ?? [])];
      next.push({
        id: `camp-${selectedModel.id}-${Date.now()}`,
        name: title,
        discount: 15,
        expiresInDays: 14,
      });
      return { ...prev, [selectedModel.id]: next };
    });
  }

  return (
    <section className="vehicle-showroom">
      <header className="vehicle-showroom__head card">
        <h2>Vehicle Showroom Dashboard</h2>
        <p>Fahrzeuge als Verkaufsprodukte: sehen, steuern, optimieren.</p>
        <div className="vehicle-showroom__kpis">
          <article><span>Aktive Modelle</span><strong>{topKpis.activeModels}</strong></article>
          <article><span>Anfragen</span><strong>{topKpis.inquiries}</strong></article>
          <article><span>Angebote</span><strong>{topKpis.offerCount}</strong></article>
          <article><span>Verkäufe</span><strong>{topKpis.sales}</strong></article>
          <article><span>Conversion</span><strong>{topKpis.conversion}%</strong></article>
          <article><span>Aktive Aktionen</span><strong>{topKpis.campaigns}</strong></article>
        </div>
      </header>

      <div className="vehicle-showroom__controls card">
        <input
          type="search"
          className="form-input"
          placeholder="Fahrzeug suchen: Sportage, EV3, EV4, Niro, Ceed, Sorento"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="vehicle-showroom__filters">
          {SHOWROOM_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`vehicle-showroom__filter${activeFilter === filter.id ? ' is-active' : ''}`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="vehicle-showroom__grid">
        {filteredModels.map((model) => (
          <article key={model.id} className="vehicle-card card">
            <VehicleImage
              brand={model.brand}
              model={model.meta.imageModel}
              className="vehicle-card__image"
              alt={`${model.brand} ${model.name}`}
            />
            <div className="vehicle-card__body">
              <h3>{model.brand} {model.name}</h3>
              <p className={`vehicle-card__status vehicle-card__status--${model.tone.tone}`}>
                {model.tone.tone === 'green' ? '🟢' : model.tone.tone === 'yellow' ? '🟡' : '🔴'} {model.tone.label}
              </p>
              <dl>
                <div><dt>Rate ab</dt><dd>{model.baseRate} €</dd></div>
                <div><dt>Aktiver Rabatt</dt><dd>{model.discount ?? 0} %</dd></div>
                <div><dt>Lieferzeit</dt><dd>{model.delivery}</dd></div>
                <div><dt>Anfragen</dt><dd>{model.stats.inquiries}</dd></div>
                <div><dt>Angebote</dt><dd>{model.stats.offers}</dd></div>
                <div><dt>Abschlüsse</dt><dd>{model.stats.sales}</dd></div>
                <div><dt>Conversion</dt><dd>{model.stats.conversion} %</dd></div>
                <div><dt>Aktive Aktionen</dt><dd>{model.campaigns.length}</dd></div>
              </dl>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSelectedModelId(model.id);
                  setActiveTab('overview');
                }}
              >
                Bearbeiten
              </button>
            </div>
          </article>
        ))}
      </div>

      {selectedModel && (
        <section className="vehicle-dossier card">
          <header className="vehicle-dossier__head">
            <div>
              <h3>{selectedModel.brand} {selectedModel.name}</h3>
              <p>{selectedModel.delivery} · {selectedModel.inventoryCount} Fahrzeuge im Bestand</p>
            </div>
          </header>

          <nav className="vehicle-dossier__tabs" aria-label="Fahrzeugakte">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' && (
            <div className="vehicle-dossier__grid">
              <VehicleImage brand={selectedModel.brand} model={selectedModel.meta.imageModel} className="vehicle-dossier__hero" />
              <article><span>Status</span><strong>{selectedModel.tone.label}</strong></article>
              <article><span>Rate</span><strong>{selectedModel.baseRate} €</strong></article>
              <article><span>Rabatt</span><strong>{selectedModel.discount ?? 0} %</strong></article>
              <article><span>Lieferzeit</span><strong>{selectedModel.delivery}</strong></article>
              <article><span>Lagerbestand</span><strong>{selectedModel.inventoryCount}</strong></article>
              <article><span>Ansprechpartner</span><strong>{selectedModel.contact?.name || 'Verkaufsteam'}</strong></article>
            </div>
          )}

          {activeTab === 'conditions' && (
            <div className="vehicle-dossier__form-grid">
              <label>
                Standardrabatt
                <input
                  type="number"
                  className="form-input"
                  value={conditions.discountsByModel?.[selectedModel.id]?.standard ?? 0}
                  onChange={(event) => onUpdateDiscount(selectedModel.id, 'standard', event.target.value)}
                />
              </label>
              <label>
                Aktionsrabatt
                <input
                  type="number"
                  className="form-input"
                  value={conditions.discountsByModel?.[selectedModel.id]?.aktion ?? ''}
                  onChange={(event) => onUpdateDiscount(selectedModel.id, 'aktion', event.target.value)}
                />
              </label>
              <label>
                Lieferzeit
                <input
                  type="text"
                  className="form-input"
                  value={conditions.deliveryByModel?.[selectedModel.id]?.defaultDeliveryTime ?? selectedModel.delivery}
                  onChange={(event) => onUpdateDelivery(selectedModel.id, 'defaultDeliveryTime', event.target.value)}
                />
              </label>
              <article>
                <span>Leasing</span>
                <strong>{selectedModel.baseRate} € / Monat</strong>
              </article>
              <article>
                <span>Finanzierung</span>
                <strong>{Math.round(selectedModel.baseRate * 1.15)} € / Monat</strong>
              </article>
              <article>
                <span>Barpreis</span>
                <strong>{(selectedModel.baseRate * 120).toLocaleString('de-DE')} €</strong>
              </article>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="vehicle-dossier__stack">
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCampaign}>➕ Aktion erstellen</button>
              {(selectedModel.campaigns ?? []).map((campaign) => (
                <article key={campaign.id} className="vehicle-dossier__list-item">
                  <strong>{campaign.name}</strong>
                  <span>{campaign.discount} %</span>
                  <span>Läuft ab in {campaign.expiresInDays} Tagen</span>
                </article>
              ))}
              {(selectedModel.campaigns ?? []).length === 0 && <p>Noch keine Aktionen hinterlegt.</p>}
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="vehicle-dossier__stack">
              {CHANNELS.map((channel) => (
                <article key={channel} className="vehicle-dossier__list-item">
                  <strong>{channel}</strong>
                  <span>{selectedModel.active ? 'Aktiv' : 'Entwurf'}</span>
                </article>
              ))}
            </div>
          )}

          {activeTab === 'publish' && (
            <div className="vehicle-dossier__form-grid">
              <label className="backend-toggle">
                <input
                  type="checkbox"
                  checked={selectedModel.showOnDealerPage !== false}
                  onChange={(event) => onUpdateModel(selectedModel.id, { showOnDealerPage: event.target.checked })}
                />
                <span>Homepage sichtbar</span>
              </label>
              <label className="backend-toggle">
                <input
                  type="checkbox"
                  checked={selectedModel.syncToLanding !== false}
                  onChange={(event) => onUpdateModel(selectedModel.id, { syncToLanding: event.target.checked })}
                />
                <span>KI sichtbar</span>
              </label>
              <label className="backend-toggle">
                <input
                  type="checkbox"
                  checked={selectedModel.active !== false}
                  onChange={(event) => onUpdateModel(selectedModel.id, { active: event.target.checked })}
                />
                <span>Veröffentlicht</span>
              </label>
              <article><span>Compliance-Status</span><strong>{selectedModel.showOnDealerPage ? 'Freigegeben' : 'Prüfung offen'}</strong></article>
              <article><span>WLTP geprüft</span><strong>{selectedModel.active ? 'Ja' : 'Offen'}</strong></article>
              <article><span>CO₂ geprüft</span><strong>{selectedModel.active ? 'Ja' : 'Offen'}</strong></article>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="vehicle-dossier__stack">
              {leads.filter((lead) => modelLeadMatch(lead, selectedModel)).map((lead) => (
                <article key={lead.id} className="vehicle-dossier__list-item">
                  <strong>{lead.contact.name || 'Unbekannt'}</strong>
                  <span>{LEAD_STATUS[lead.status]?.label ?? lead.status}</span>
                </article>
              ))}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="vehicle-dossier__form-grid">
              <article><span>Anfragen</span><strong>{selectedModel.stats.inquiries}</strong></article>
              <article><span>Angebote</span><strong>{selectedModel.stats.offers}</strong></article>
              <article><span>Verkäufe</span><strong>{selectedModel.stats.sales}</strong></article>
              <article><span>Conversion</span><strong>{selectedModel.stats.conversion} %</strong></article>
              <article><span>Durchschnittsrate</span><strong>{selectedModel.stats.avgRate ?? selectedModel.baseRate} €</strong></article>
              <article><span>Beliebteste Laufzeit</span><strong>48 Monate</strong></article>
              <article><span>Beliebteste Kilometerleistung</span><strong>15.000 km</strong></article>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
