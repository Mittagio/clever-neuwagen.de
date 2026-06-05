import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import CleverQuoteBadge from '../components/cleverQuote/CleverQuoteBadge.jsx';
import {
  loadSalesShareSession,
  confirmSalesShareInquiry,
} from '../services/sales/salesShareService.js';
import { recordOfferViewed } from '../services/sales/salesAdvisorStats.js';
import { formatCurrency } from '../logic/marketplaceService.js';
import '../components/sales-advisor/smartSales.css';

function ShareVariantRow({ entry, onOpen }) {
  const match = entry.match ?? entry;
  const trimLabel = entry.trimLabel ?? match.trimLabel ?? 'Ausstattung';
  const rate = match.monthlyRate;

  return (
    <button type="button" className="ss-share-variant" onClick={() => onOpen(match.slug)}>
      <span>
        {trimLabel}
        {entry.isPrimary && <span className="ss-share-variant__badge">Empfohlen</span>}
      </span>
      <span>{rate != null ? `${formatCurrency(rate)}/Monat` : '—'}</span>
    </button>
  );
}

function ShareModelLineCard({ group, onOpenVehicle }) {
  const primary = group.primaryMatch;
  const trimVariants = group.trimVariants ?? [];

  return (
    <article className="ss-share-line">
      <header className="ss-share-line__head">
        <h2>{group.label ?? primary?.title}</h2>
        {primary?.cleverQuote && (
          <CleverQuoteBadge cleverQuote={primary.cleverQuote} size="sm" showTier={false} />
        )}
      </header>

      {primary && (
        <div className="ss-share-line__primary">
          <p className="ss-share-line__trim">{primary.trimLabel ?? 'Ausstattung'}</p>
          <p className="ss-share-line__rate">
            {primary.monthlyRate != null ? `${formatCurrency(primary.monthlyRate)}/Monat` : '—'}
          </p>
          <Link to={`/fahrzeug/${primary.slug}?wunsch=1`} className="ss-btn ss-btn--primary ss-btn--block">
            Angebot ansehen
          </Link>
        </div>
      )}

      {group.hasMultipleVariants && trimVariants.length > 1 && (
        <div className="ss-share-line__variants">
          <p className="ss-share-line__variants-label">Alle Ausstattungen</p>
          {trimVariants.map((entry) => (
            <ShareVariantRow
              key={entry.trimKey ?? entry.match?.slug}
              entry={entry}
              onOpen={onOpenVehicle}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export default function SalesCompareSharePage() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inquirySent, setInquirySent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadSalesShareSession(token).then((loaded) => {
      if (cancelled) return;
      if (loaded) recordOfferViewed();
      setSession(loaded);
      setInquirySent(Boolean(loaded?.inquiryConfirmed));
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleConfirmInquiry() {
    const updated = await confirmSalesShareInquiry(token);
    if (updated) {
      setSession(updated);
      setInquirySent(true);
    } else {
      setInquirySent(true);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="ss-share-page">
          <p>Empfehlung wird geladen …</p>
        </div>
      </PageShell>
    );
  }

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
  const hasModelLines = session.modelLineGroups?.length > 0;

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

        {hasModelLines ? (
          <div className="ss-share-page__lines">
            {session.modelLineGroups.map((group) => (
              <ShareModelLineCard
                key={group.modelLineKey}
                group={group}
                onOpenVehicle={(slug) => {
                  window.location.href = `/fahrzeug/${slug}?wunsch=1`;
                }}
              />
            ))}
          </div>
        ) : (
          <div className="ss-share-page__grid">
            {session.matches.map((row, index) => (
              <article key={row.slug} className="ss-share-card">
                <span className="ss-share-card__rank">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                </span>
                <h2>{row.title}</h2>
                {row.trimLabel && <p className="ss-share-card__trim">{row.trimLabel}</p>}
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
        )}

        <div className="ss-share-page__actions">
          <button
            type="button"
            className="ss-btn ss-btn--primary"
            onClick={handleConfirmInquiry}
            disabled={inquirySent}
          >
            {inquirySent ? 'Anfrage bestätigt' : 'Anfrage bestätigen'}
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
