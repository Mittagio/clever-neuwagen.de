import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import { listWebsiteInquiryLeads } from '../../services/dealer/dealerInquiryLeadService.js';
import { formatLeadTime } from '../../logic/leadService.js';
import {
  countMissingLeasingFactors,
  formatPublishedAt,
  getModelStatusLabel,
} from '../../data/dealerConditionsSchema.js';
import './BackendSections.css';

export default function BackendDashboard({ conditions }) {
  const { leads } = useLeads();

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const openLeads = leads.filter((l) =>
      l.status === 'neu' || l.status === 'inBearbeitung',
    ).length;
    const todayLeads = leads.filter((l) => {
      const created = l.createdAt ?? l.date;
      if (!created) return false;
      return new Date(created).toDateString() === today;
    }).length;
    const activeModels = conditions.activeModels?.filter((m) => m.active) ?? [];
    const missingLf = activeModels.reduce(
      (sum, m) => sum + countMissingLeasingFactors(conditions, m.id),
      0,
    );

    const websiteInquiries = listWebsiteInquiryLeads(leads, conditions.dealerId ?? null, 5);

    return { openLeads, todayLeads, activeModels, missingLf, websiteInquiries };
  }, [leads, conditions]);

  return (
    <div className="backend-sections">
      <section className="backend-card">
        <h2 className="backend-card-title">Übersicht</h2>
        <div className="backend-stat-grid">
          <div className="backend-stat">
            <span className="backend-stat-value">{stats.activeModels.length}</span>
            <span className="backend-stat-label">Aktive Modelle</span>
          </div>
          <div className="backend-stat">
            <span className="backend-stat-value">{stats.missingLf}</span>
            <span className="backend-stat-label">Fehlende LF-Zellen</span>
          </div>
          <div className="backend-stat">
            <span className="backend-stat-value">{stats.openLeads}</span>
            <span className="backend-stat-label">Offene Verkaufschancen</span>
          </div>
          <div className="backend-stat">
            <span className="backend-stat-value">{stats.todayLeads}</span>
            <span className="backend-stat-label">Heutige Verkaufschancen</span>
          </div>
        </div>
      </section>

      {stats.websiteInquiries.length > 0 && (
        <section className="backend-card">
          <h2 className="backend-card-title">Website-Anfragen mit erkannten Wünschen</h2>
          <p className="backend-card-lead">
            Kunden haben auf der Händlerseite geschrieben – Clever hat die Wünsche verstanden.
          </p>
          <ul className="backend-website-inquiries">
            {stats.websiteInquiries.map((lead) => (
              <li key={lead.id} className="backend-website-inquiries__item">
                <div className="backend-website-inquiries__head">
                  <strong>{lead.contact?.name?.trim() || 'Website-Anfrage'}</strong>
                  <span>{formatLeadTime(lead.updatedAt ?? lead.createdAt)}</span>
                </div>
                {lead.wishLabels?.length > 0 && (
                  <p className="backend-website-inquiries__wishes">
                    {lead.wishLabels.slice(0, 4).join(' · ')}
                  </p>
                )}
                {lead.inquiryContext?.searchQuery && (
                  <p className="backend-website-inquiries__query">
                    „{lead.inquiryContext.searchQuery}“
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Link to="/leads/classic" className="btn btn-secondary backend-card-link">
            Alle Verkaufschancen öffnen
          </Link>
        </section>
      )}

      <section className="backend-card">
        <h2 className="backend-card-title">Modelle</h2>
        <ul className="backend-model-status-list">
          {conditions.activeModels?.map((model) => (
            <li key={model.id} className="backend-model-status-item">
              <span className="backend-model-status-name">{model.brand} {model.name}</span>
              <span className={`backend-model-status-badge backend-model-status-badge--${model.active ? 'active' : 'prep'}`}>
                {getModelStatusLabel(model)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="backend-card">
        <h2 className="backend-card-title">Veröffentlichung</h2>
        <dl className="backend-meta-list">
          <div>
            <dt>Letzte Synchronisation</dt>
            <dd>{formatPublishedAt(conditions.lastPublishedAt)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`backend-sync-badge backend-sync-badge--${conditions.syncStatus ?? 'pending'}`}>
                {conditions.syncStatus === 'synchronized' ? 'Synchronisiert' : 'Entwurf'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Händlerseite</dt>
            <dd>{conditions.dealerPageOnline ? '🟢 Online' : '⚪ Offline'}</dd>
          </div>
        </dl>
        <Link to="/backend/billing" className="btn btn-secondary backend-card-link">Abrechnung</Link>
        <Link to="/backend/documents" className="btn btn-secondary backend-card-link">Dokumenten-Tresor (48h)</Link>
        <Link to="/backend/publishing" className="btn btn-secondary backend-card-link">Publishing Center</Link>
        <Link to="/communication" className="btn btn-secondary backend-card-link">Sales Communication Center</Link>
        <Link to="/leads/classic" className="btn btn-secondary backend-card-link">Verkaufschancen (klassisch)</Link>
        <Link to="/offers" className="btn btn-secondary backend-card-link">Angebotszentrum</Link>
        <Link to="/assistant" className="btn btn-secondary backend-card-link">Verkaufsassistent</Link>
        <Link to="/dealer-ai" className="btn btn-primary backend-card-link">Dealer AI</Link>
      </section>
    </div>
  );
}
