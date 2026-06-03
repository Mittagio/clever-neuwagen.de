import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import CleverQuoteBadge from '../components/cleverQuote/CleverQuoteBadge.jsx';
import { loadSalesShareSession } from '../services/sales/salesShareService.js';
import { recordOfferViewed } from '../services/sales/salesAdvisorStats.js';
import { formatCurrency } from '../logic/marketplaceService.js';
import '../components/sales-advisor/smartSales.css';

export default function SalesCompareSharePage() {
  const { token } = useParams();
  const [inquirySent, setInquirySent] = useState(false);

  const session = useMemo(() => {
    const s = loadSalesShareSession(token);
    if (s) recordOfferViewed();
    return s;
  }, [token]);

  if (!session) {
    return (
      <PageShell>
        <div className="ss-share-page ss-share-page--empty">
          <h1>Link nicht gefunden</h1>
          <p>Dieser Vergleichslink ist abgelaufen oder ungültig.</p>
          <Link to="/fahrzeuge">Zur Fahrzeugsuche</Link>
        </div>
      </PageShell>
    );
  }

  const customerName = session.customer?.name?.trim();

  return (
    <PageShell>
      <div className="ss-share-page">
        <header className="ss-share-page__head">
          <p className="ss-share-page__kicker">{session.dealerName}</p>
          <h1>
            {customerName
              ? `Ihr persönlicher Fahrzeugvergleich, ${customerName}`
              : 'Ihr persönlicher Fahrzeugvergleich'}
          </h1>
          <p className="ss-share-page__sub">
            CleverQuote™ zeigt, welches Fahrzeug am besten zu Ihren Wünschen passt.
          </p>
        </header>

        <div className="ss-share-page__grid">
          {session.matches.map((row, index) => (
            <article key={row.slug} className="ss-share-card">
              <span className="ss-share-card__rank">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
              </span>
              <h2>{row.title}</h2>
              {row.cleverQuote && (
                <CleverQuoteBadge cleverQuote={row.cleverQuote} size="md" />
              )}
              <p className="ss-share-card__rate">{formatCurrency(row.monthlyRate)}/Monat</p>
              <p className="ss-share-card__delivery">{row.deliveryTime}</p>
              <Link to={`/fahrzeug/${row.slug}?wunsch=1`} className="ss-btn ss-btn--primary ss-btn--block">
                Fahrzeug ansehen
              </Link>
            </article>
          ))}
        </div>

        <div className="ss-share-page__actions">
          <button
            type="button"
            className="ss-btn ss-btn--primary"
            onClick={() => setInquirySent(true)}
          >
            Anfrage bestätigen
          </button>
          <a
            href={`mailto:${session.customer?.email || ''}?subject=${encodeURIComponent('Rückfrage zu meinem Fahrzeugvergleich')}`}
            className="ss-btn ss-btn--secondary"
          >
            Rückfrage stellen
          </a>
        </div>

        {inquirySent && (
          <p className="ss-share-page__confirm">Vielen Dank – {session.dealerName} meldet sich bei Ihnen.</p>
        )}

        {session.sellerName && (
          <footer className="ss-share-page__footer">
            <p>Ihr Ansprechpartner: {session.sellerName}</p>
          </footer>
        )}
      </div>
    </PageShell>
  );
}
