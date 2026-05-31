import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { useBilling } from '../../context/BillingContext.jsx';
import { useVoucherPartners } from '../../context/VoucherPartnersContext.jsx';
import {
  REWARD_TEMPLATES,
  REWARD_PARTNER_PREP,
  PAYMENT_PROVIDERS_PREP,
  formatMoney,
} from '../../data/billingConfig.js';
import {
  AdminBillingNav,
  BillingPageHeader,
} from '../../components/billing/BillingShared.jsx';
import { Link } from 'react-router-dom';
import '../../components/billing/BillingShared.css';

const REWARD_ICONS = {
  verbrenner: '⛽',
  hybrid: '🔋',
  elektro: '⚡',
};

export default function AdminRewardsPage() {
  const { resetDemoData } = useBilling();
  const { partners } = useVoucherPartners();

  usePageSeo({
    title: 'Gutscheine',
    description: 'Gutscheinverwaltung für Auslieferungsbelohnungen.',
    path: '/admin/rewards',
  });

  const activePartners = partners.filter((p) => p.active);

  return (
    <PageShell className="bill-shell">
      <div className="bill-page">
        <BillingPageHeader
          title="Gutscheinverwaltung"
          subtitle="Belohnungen nach bestätigter Auslieferung – nach Antriebsart."
          actions={(
            <Link to="/partner-verwaltung" className="bill-btn bill-btn--secondary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              Partner verwalten →
            </Link>
          )}
        />
        <AdminBillingNav />

        <h2 className="bill-section-title">Gutschein-Vorlagen</h2>
        <div className="bill-reward-grid">
          {REWARD_TEMPLATES.map((tpl) => (
            <article key={tpl.id} className="bill-reward-card">
              <div className="bill-reward-card__icon">{REWARD_ICONS[tpl.driveType] ?? '🎁'}</div>
              <p className="bill-reward-card__title">{tpl.label}</p>
              <p className="bill-reward-card__title">{tpl.title}</p>
              <p className="bill-reward-card__amount">{formatMoney(tpl.amount)}</p>
            </article>
          ))}
        </div>

        <h2 className="bill-section-title" style={{ marginTop: 28 }}>Partner (vorbereitet)</h2>
        <div className="bill-reward-grid">
          {REWARD_PARTNER_PREP.map((p) => (
            <article key={p.id} className="bill-reward-card">
              <p className="bill-reward-card__title">{p.name}</p>
              <p className="bill-delivery-card__meta">
                {p.type === 'fuel' ? '⛽ Tankstelle' : '⚡ Laden'}
              </p>
              <span className="bill-dealer-active">{p.status === 'ready' ? 'Bereit' : 'Geplant'}</span>
            </article>
          ))}
        </div>

        <p className="bill-delivery-card__meta" style={{ marginTop: 16 }}>
          {activePartners.length} aktive Partner in der Partnerverwaltung (Aral, Shell, Esso, EnBW, Ionity u. a.)
        </p>

        <h2 className="bill-section-title" style={{ marginTop: 28 }}>Zahlungs-Integration (Zukunft)</h2>
        <div className="bill-list">
          {PAYMENT_PROVIDERS_PREP.map((p) => (
            <div key={p.id} className="bill-delivery-card">
              <p className="bill-delivery-card__name">{p.label}</p>
              <p className="bill-delivery-card__meta">{p.active ? 'Aktiv' : 'Vorbereitet – nicht aktiv'}</p>
            </div>
          ))}
        </div>

        <button type="button" className="bill-btn bill-btn--secondary" style={{ marginTop: 24 }} onClick={resetDemoData}>
          Demo-Abrechnungsdaten zurücksetzen
        </button>
      </div>
    </PageShell>
  );
}
