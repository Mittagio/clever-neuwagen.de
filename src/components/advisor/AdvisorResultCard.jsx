import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../data/kiaSportage.js';
import { formatAdvisorRate, buildAdvisorMailto, buildAdvisorWhatsAppMessage } from '../../services/advisorEngine.js';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import AdvisorVehicleImage from './AdvisorVehicleImage.jsx';
import './AdvisorComponents.css';

function ActionModal({ title, rec, onClose, onSubmit }) {
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [sent, setSent] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(contact);
    setSent(true);
    setTimeout(onClose, 1800);
  }

  return (
    <div className="adv-modal-overlay" onClick={onClose} role="presentation">
      <div className="adv-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>{title}</h2>
        <p className="adv-modal-vehicle">{rec.fullLabel}</p>
        {sent ? (
          <p className="adv-modal-success">✓ Anfrage gesendet. Wir melden uns bei Ihnen.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Name
              <input type="text" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} required />
            </label>
            <label>
              E-Mail
              <input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} required />
            </label>
            <label>
              Telefon
              <input type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
            </label>
            <button type="submit" className="adv-btn adv-btn--primary">Absenden</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdvisorResultCard({
  rec,
  dealerId,
  dealerName,
  dealerEmail,
  dealerPhone,
  inCompare,
  onToggleCompare,
  onRequestOffer,
  onRequestTestDrive,
  flowMode = false,
}) {
  const [modal, setModal] = useState(null);

  function handleWhatsApp() {
    const msg = buildAdvisorWhatsAppMessage(rec, dealerName);
    const digits = dealerPhone?.replace(/\D/g, '') ?? '';
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <article id={`adv-result-${rec.id}`} className={`adv-result-card${rec.isHotDeal ? ' is-hot' : ''}`}>
      {rec.isHotDeal && (
        <span className="adv-result-card__hot">🔥 Besonders gutes Angebot</span>
      )}

      <AdvisorVehicleImage
        rec={rec}
        dealerId={dealerId}
        className="adv-vehicle-visual adv-vehicle-visual--result"
        imageClassName="adv-vehicle-visual__img"
      />

      <header className="adv-result-card__head">
        <span className="adv-result-card__medal">{rec.rankMedal}</span>
        <div>
          <h3 className="adv-result-card__title">{rec.fullLabel}</h3>
          <p className="adv-result-card__trim">{rec.engineName} · {rec.fuelLabel}</p>
        </div>
        <p className="adv-result-card__rate">
          {formatAdvisorRate(rec.monthlyRate)}
          <span>/Monat</span>
        </p>
      </header>

      <dl className="adv-result-card__facts">
        <div>
          <dt>Lieferzeit</dt>
          <dd>{rec.deliveryTime}</dd>
        </div>
        <div>
          <dt>Verfügbarkeit</dt>
          <dd>{rec.availabilityLabel}</dd>
        </div>
        {rec.hauspreis > 0 && (
          <div>
            <dt>Hauspreis</dt>
            <dd>{formatPrice(rec.hauspreis)}</dd>
          </div>
        )}
        {rec.rangeKm && (
          <div>
            <dt>Reichweite</dt>
            <dd>{rec.rangeKm} km WLTP</dd>
          </div>
        )}
      </dl>

      <div className="adv-result-card__why">
        <p className="adv-result-card__why-title">Warum empfohlen?</p>
        <ul>
          {rec.reasonBullets.map((b) => (
            <li key={b}>✓ {b}</li>
          ))}
        </ul>
        <p className="adv-result-card__explanation">{rec.explanation}</p>
      </div>

      <div className="adv-result-card__actions">
        <button
          type="button"
          className="adv-btn adv-btn--primary"
          onClick={() => (flowMode ? onRequestOffer(rec) : setModal('offer'))}
        >
          {flowMode ? '📋 Angebot erstellen' : '📧 Angebot anfordern'}
        </button>
        <button type="button" className="adv-btn adv-btn--wa" onClick={handleWhatsApp}>
          📱 WhatsApp senden
        </button>
        {!flowMode && (
          <button type="button" className="adv-btn adv-btn--secondary" onClick={() => setModal('testdrive')}>
            🚗 Probefahrt anfragen
          </button>
        )}
        <Link to="/haendler/autohaus-trinkle" className="adv-btn adv-btn--ghost">
          📋 Konfiguration ansehen
        </Link>
        <button
          type="button"
          className={`adv-btn adv-btn--compare${inCompare ? ' is-active' : ''}`}
          onClick={() => onToggleCompare(rec.id)}
        >
          {inCompare ? '✓ Im Vergleich' : 'Zum Vergleich hinzufügen'}
        </button>
      </div>

      <LegalDisclaimer compact className="adv-result-card__disclaimer" />

      {modal === 'offer' && !flowMode && (
        <ActionModal
          title="Angebot anfordern"
          rec={rec}
          onClose={() => setModal(null)}
          onSubmit={(c) => onRequestOffer(rec, c)}
        />
      )}
      {modal === 'testdrive' && !flowMode && (
        <ActionModal
          title="Probefahrt anfragen"
          rec={rec}
          onClose={() => setModal(null)}
          onSubmit={(c) => onRequestTestDrive(rec, c)}
        />
      )}
    </article>
  );
}

export function AdvisorComparePanel({ items, onRemove }) {
  if (!items.length) return null;

  return (
    <section className="adv-compare">
      <h2 className="adv-compare__title">Vergleich ({items.length})</h2>
      <div className="adv-compare__scroll">
        {items.map((item) => (
          <article key={item.id} className="adv-compare-card">
            <button type="button" className="adv-compare-card__remove" onClick={() => onRemove(item.id)} aria-label="Entfernen">✕</button>
            <p className="adv-compare-card__name">{item.fullLabel}</p>
            <p className="adv-compare-card__rate">{formatAdvisorRate(item.monthlyRate)}/Mt.</p>
            <dl className="adv-compare-card__dl">
              <div><dt>Lieferzeit</dt><dd>{item.deliveryTime}</dd></div>
              {item.rangeKm && <div><dt>Reichweite</dt><dd>{item.rangeKm} km</dd></div>}
              <div><dt>Betriebskosten</dt><dd>{item.operatingCostLevel <= 2 ? 'Niedrig' : 'Mittel'}</dd></div>
            </dl>
            <ul className="adv-compare-card__highlights">
              {item.highlights.slice(0, 3).map((h) => <li key={h}>{h}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
