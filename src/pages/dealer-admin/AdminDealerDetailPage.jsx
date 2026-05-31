import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { useBilling } from '../../context/BillingContext.jsx';
import { buildReadonlyConditions, PLATFORM_BRANDS, KIA_MODELS } from '../../logic/dealerAdminEngine.js';
import { DEALER_STATUS, FUTURE_INTEGRATIONS } from '../../data/dealerRegistry.js';
import { formatMoney } from '../../data/billingConfig.js';
import {
  AdminOperatorNav,
  OperatorPageHeader,
  DealerStatusBadge,
} from '../../components/dealer-admin/DealerAdminShared.jsx';
import '../../components/dealer-admin/DealerAdminShared.css';

const TABS = [
  { id: 'stammdaten', label: 'Stammdaten' },
  { id: 'vertrag', label: 'Vertragsdaten' },
  { id: 'marken', label: 'Marken' },
  { id: 'modelle', label: 'Modelle' },
  { id: 'konditionen', label: 'Konditionen' },
  { id: 'abrechnung', label: 'Abrechnung' },
  { id: 'aktivitaeten', label: 'Aktivitäten' },
  { id: 'freigaben', label: 'Freigaben' },
];

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE');
}

export default function AdminDealerDetailPage() {
  const { id } = useParams();
  const [tab, setTab] = useState('stammdaten');
  const {
    getDealer,
    getDealerActivities,
    toggleDealerBrand,
    toggleDealerModel,
    updateDealerStatus,
    approvals,
  } = useDealerAdmin();
  const { getDealerDetail, getInvoicesForDealer } = useBilling();

  const dealer = getDealer(id);
  const activities = getDealerActivities(id);
  const billing = getDealerDetail(id);
  const invoices = getInvoicesForDealer(id);
  const conditions = buildReadonlyConditions(id);
  const dealerApprovals = approvals.filter((a) => a.dealerId === id && a.status === 'pending');

  usePageSeo({
    title: dealer?.companyName ?? 'Händler',
    description: 'Händler-Detailansicht im Betreiber-Cockpit.',
    path: `/admin/dealers/${id}`,
  });

  if (!dealer) {
    return (
      <PageShell>
        <div className="dop-page">
          <p>Händler nicht gefunden.</p>
          <Link to="/admin/dealers">← Zurück</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="admin-shell">
      <div className="dop-page">
        <OperatorPageHeader
          title={dealer.companyName}
          subtitle={dealer.city}
          backTo="/admin/dealers"
          actions={(
            <select
              value={dealer.status}
              onChange={(e) => updateDealerStatus(id, e.target.value)}
              className="dop-btn dop-btn--ghost"
            >
              {Object.values(DEALER_STATUS).map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
              ))}
            </select>
          )}
        />
        <AdminOperatorNav />
        <DealerStatusBadge status={dealer.status} />

        <div className="dop-tabs" style={{ marginTop: 16 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`dop-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'stammdaten' && (
          <article className="dop-detail-card">
            <dl>
              <div><dt>Ansprechpartner</dt><dd>{dealer.contactPerson}</dd></div>
              <div><dt>E-Mail</dt><dd><a href={`mailto:${dealer.email}`}>{dealer.email}</a></dd></div>
              <div><dt>Telefon</dt><dd>{dealer.phone || '–'}</dd></div>
              <div><dt>Adresse</dt><dd>{dealer.address}</dd></div>
            </dl>
          </article>
        )}

        {tab === 'vertrag' && (
          <article className="dop-detail-card">
            <dl>
              <div><dt>Status</dt><dd><DealerStatusBadge status={dealer.status} /></dd></div>
              <div><dt>Startdatum</dt><dd>{formatDate(dealer.contract?.startDate)}</dd></div>
              <div><dt>Vertragsart</dt><dd>{dealer.contract?.type ?? '–'}</dd></div>
              <div><dt>Plattformgebühr</dt><dd>{formatMoney(dealer.contract?.platformFee ?? 0)}/Monat</dd></div>
              <div><dt>Provisionsmodell</dt><dd>{dealer.contract?.provisionModel ?? '–'}</dd></div>
              <div><dt>Kündigungsstatus</dt><dd>{dealer.contract?.cancellationStatus ?? '–'}</dd></div>
            </dl>
          </article>
        )}

        {tab === 'marken' && (
          <div className="dop-checklist">
            {PLATFORM_BRANDS.map((brand) => (
              <label key={brand.id} className="dop-check">
                <input
                  type="checkbox"
                  checked={dealer.brands.includes(brand.id)}
                  disabled={!brand.active && !dealer.brands.includes(brand.id)}
                  onChange={(e) => toggleDealerBrand(id, brand.id, e.target.checked)}
                />
                {brand.name}
                {!brand.active && <span style={{ fontSize: '0.75rem', color: '#a3a3a3' }}>(Plattform geplant)</span>}
              </label>
            ))}
          </div>
        )}

        {tab === 'modelle' && dealer.brands.includes('kia') && (
          <div className="dop-checklist">
            <p className="dop-section__title">Kia</p>
            {KIA_MODELS.map((model) => (
              <label key={model.id} className="dop-check">
                <input
                  type="checkbox"
                  checked={(dealer.models?.kia ?? []).includes(model.id)}
                  onChange={(e) => toggleDealerModel(id, 'kia', model.id, e.target.checked)}
                />
                {model.name}
              </label>
            ))}
          </div>
        )}

        {tab === 'konditionen' && (
          <article className="dop-detail-card">
            <p className="dop-kpi__hint" style={{ marginBottom: 12 }}>Nur Lesemodus – Admin sieht alle Händlerkonditionen.</p>
            <dl>
              <div><dt>Rabatte</dt><dd>{JSON.stringify(conditions.discounts).replace(/[{}"]/g, '').replace(/,/g, ', ')}</dd></div>
              <div><dt>Leasingfaktoren</dt><dd>{JSON.stringify(conditions.leasingFactors).replace(/[{}"]/g, '')}</dd></div>
              <div><dt>Finanzierung</dt><dd>{conditions.finance.effectiveRate}% eff. Jahreszins</dd></div>
              <div><dt>Lieferzeiten</dt><dd>{conditions.delivery.default}{conditions.delivery.sportage ? ` · Sportage: ${conditions.delivery.sportage}` : ''}</dd></div>
            </dl>
          </article>
        )}

        {tab === 'abrechnung' && (
          <>
            <div className="dop-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <article className="dop-kpi"><p className="dop-kpi__label">Verkäufe</p><p className="dop-kpi__value">{billing.salesCount}</p></article>
              <article className="dop-kpi"><p className="dop-kpi__label">Provision</p><p className="dop-kpi__value">{formatMoney(billing.successFees)}</p></article>
              <article className="dop-kpi"><p className="dop-kpi__label">Gesamt</p><p className="dop-kpi__value">{formatMoney(billing.total)}</p></article>
            </div>
            <Link to={`/admin/billing/dealer/${id}`} className="dop-header__back">Abrechnungsdetail →</Link>
            {invoices.map((inv) => (
              <article key={inv.id} className="dop-detail-card">
                <p>{inv.invoiceNumber} · {formatMoney(inv.amount)} · {inv.status}</p>
              </article>
            ))}
          </>
        )}

        {tab === 'aktivitaeten' && (
          <ul className="dop-activity-list">
            {activities.map((a) => (
              <li key={a.id} className="dop-activity-item">
                <p className="dop-activity-item__date">{formatDate(a.createdAt)}</p>
                <p className="dop-activity-item__text">{a.action}</p>
              </li>
            ))}
          </ul>
        )}

        {tab === 'freigaben' && (
          <div className="dop-section">
            {dealerApprovals.length === 0 && (
              <p className="dop-kpi__hint">Keine offenen Freigaben für diesen Händler.</p>
            )}
            {dealerApprovals.map((a) => (
              <article key={a.id} className="dop-approval-card">
                <p className="dop-approval-card__title">{a.title}</p>
                <p className="dop-approval-card__sub">{a.subtitle}</p>
                <Link to="/admin/approvals" className="dop-header__back">Im Approval Center →</Link>
              </article>
            ))}
          </div>
        )}

        <p className="dop-future-note">
          Vorbereitet: {FUTURE_INTEGRATIONS.map((f) => f.label).join(', ')}
        </p>
      </div>
    </PageShell>
  );
}
