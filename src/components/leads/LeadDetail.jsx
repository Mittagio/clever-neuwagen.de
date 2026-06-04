import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LEAD_STATUS, LEAD_STATUS_ORDER, PAYMENT_TYPES } from '../../data/leadTypes.js';
import { useLeads } from '../../context/LeadsContext.jsx';
import { formatLeadTime, formatRate, buildWhatsAppLink } from '../../logic/leadService.js';
import { buildDeliveryConfirmUrl } from '../../logic/deliveryConfirmation.js';
import DeliveryFlowSteps from '../delivery/DeliveryFlowSteps.jsx';
import LeadVehicleImage from './LeadVehicleImage.jsx';
import DealerInquiryBriefView from '../inquiry/DealerInquiryBriefView.jsx';
import '../inquiry/DealerInquiryBriefView.css';

export default function LeadDetail({ lead, onBack }) {
  const {
    updateContact,
    updateNotes,
    updateStatus,
    addHistory,
    resendDeliveryConfirmation,
    resendVoucherEmail,
    resetPilotLead,
  } = useLeads();
  const [noteDraft, setNoteDraft] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [toast, setToast] = useState('');
  if (!lead) return null;

  const status = LEAD_STATUS[lead.status] ?? LEAD_STATUS.neu;

  function handleNoteSubmit(e) {
    e.preventDefault();
    const text = noteDraft.trim();
    if (!text) return;
    addHistory(lead.id, text, 'note');
    updateNotes(lead.id, lead.notes ? `${lead.notes}\n${text}` : text);
    setNoteDraft('');
  }

  function handleWhatsApp() {
    if (!lead.contact.phone) return;
    const msg = `Hallo ${lead.contact.name || ''}, hier ist ${lead.vehicle?.label ?? 'Ihr Fahrzeug'} – wie besprochen.`;
    window.open(buildWhatsAppLink(msg, lead.contact.phone), '_blank', 'noopener');
  }

  function handleReplySent(historyText) {
    addHistory(lead.id, historyText, 'offer');
    setReplyOpen(false);
  }

  async function handleStatusChange(key) {
    if (key === 'ausgeliefert') {
      setToast('Sende Auslieferungsbestätigung…');
    }
    const result = await updateStatus(lead.id, key);
    if (key === 'ausgeliefert') {
      if (result?.ok === false && result?.code === 'NO_EMAIL') {
        setToast('Fehler: Keine Kunden-E-Mail hinterlegt');
      } else if (result?.ok === false) {
        setToast(result?.historyText ?? 'E-Mail-Versand fehlgeschlagen');
      } else {
        setToast('Auslieferungsbestätigung per E-Mail gesendet');
      }
      setTimeout(() => setToast(''), 4000);
    }
  }

  async function handleRetryDeliveryEmail() {
    setToast('Sende E-Mail erneut…');
    const result = await resendDeliveryConfirmation(lead.id);
    setToast(result?.ok ? 'Bestätigungs-E-Mail erneut gesendet' : (result?.historyText ?? 'Versand fehlgeschlagen'));
    setTimeout(() => setToast(''), 3500);
  }

  async function handleRetryVoucherEmail() {
    setToast('Sende Gutschein-E-Mail…');
    const result = await resendVoucherEmail(lead.id);
    setToast(result?.ok ? 'Gutschein-E-Mail gesendet' : (result?.historyText ?? 'Versand fehlgeschlagen'));
    setTimeout(() => setToast(''), 3500);
  }

  async function handleCopyDeliveryLink() {
    if (!lead.deliveryConfirmation?.token) return;
    try {
      await navigator.clipboard.writeText(
        buildDeliveryConfirmUrl(lead.deliveryConfirmation.token),
      );
      setToast('Bestätigungslink kopiert');
      setTimeout(() => setToast(''), 2500);
    } catch {
      setToast('Kopieren fehlgeschlagen');
      setTimeout(() => setToast(''), 2500);
    }
  }

  const delivery = lead.deliveryConfirmation;

  function handleResetPilot() {
    resetPilotLead();
    setToast('Pilot-Demo zurückgesetzt');
    setTimeout(() => setToast(''), 2500);
  }

  return (
    <div className="lead-detail">
      {lead.pilot && (
        <div className="lead-detail__pilot-banner">
          <strong>🏁 Pilot Trinkle</strong>
          <span>1. Ausgeliefert · 2. Link kopieren · 3. Ja · 4. Gutschein</span>
          <button type="button" className="lead-detail__pilot-reset" onClick={handleResetPilot}>
            Demo zurücksetzen
          </button>
        </div>
      )}
      <header className="lead-detail__header">
        <button type="button" className="lead-detail__back" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <div className="lead-detail__header-info">
          <h2 className="lead-detail__name">{lead.contact.name?.trim() || 'Unbekannt'}</h2>
          <p className="lead-detail__sub">{lead.vehicle?.label}</p>
        </div>
        {lead.contact.phone && (
          <button type="button" className="lead-detail__wa" onClick={handleWhatsApp} aria-label="WhatsApp">
            💬
          </button>
        )}
      </header>

      <div className="lead-detail__reply-bar">
        <button
          type="button"
          className="lead-detail__reply-btn"
          onClick={() => setReplyOpen(true)}
        >
          Antwort senden
        </button>
        <Link to="/templates" className="lead-detail__templates-link">
          Vorlagen
        </Link>
      </div>

      <div className="lead-detail__scroll">        <section className="lead-detail__card">
          <h3 className="lead-detail__card-title">Kontakt</h3>
          <label className="lead-detail__field">
            <span>Name</span>
            <input
              type="text"
              value={lead.contact.name}
              onChange={(e) => updateContact(lead.id, { name: e.target.value })}
              placeholder="Name eingeben"
            />
          </label>
          <label className="lead-detail__field">
            <span>Telefon</span>
            <input
              type="tel"
              value={lead.contact.phone}
              onChange={(e) => updateContact(lead.id, { phone: e.target.value })}
              placeholder="+49 …"
            />
          </label>
          <label className="lead-detail__field">
            <span>E-Mail</span>
            <input
              type="email"
              value={lead.contact.email}
              onChange={(e) => updateContact(lead.id, { email: e.target.value })}
              placeholder="name@mail.de"
            />
          </label>
        </section>

        <section className="lead-detail__card">
          <h3 className="lead-detail__card-title">Fahrzeug</h3>
          <LeadVehicleImage
            lead={lead}
            dealerId={lead.dealerId}
            className="lead-detail__vehicle-visual"
            imageClassName="lead-detail__vehicle-visual-img"
          />
          <p className="lead-detail__vehicle-name">{lead.vehicle?.label}</p>
          {lead.vehicle?.engine && (
            <p className="lead-detail__vehicle-meta">{lead.vehicle.engine}</p>
          )}
        </section>

        {lead.inquiryBrief && (
          <section className="lead-detail__card lead-detail__brief-card">
            <h3 className="lead-detail__card-title">Anfrage – Clever-Zusammenfassung</h3>
            <DealerInquiryBriefView brief={lead.inquiryBrief} showDealerNote={false} />
          </section>
        )}

        <section className="lead-detail__card">
          <h3 className="lead-detail__card-title">Zahlungsart</h3>
          <div className="lead-detail__pills">
            {Object.values(PAYMENT_TYPES).map((pt) => (
              <span
                key={pt.id}
                className={`lead-detail__pill${lead.paymentType === pt.id ? ' lead-detail__pill--on' : ''}`}
              >
                {pt.label}
              </span>
            ))}
          </div>
          <div className="lead-detail__rates">
            <div>
              <span className="lead-detail__rate-label">Wunschrate</span>
              <strong>{formatRate(lead.desiredRate)}</strong>
            </div>
            <div>
              <span className="lead-detail__rate-label">Angebot</span>
              <strong>{formatRate(lead.currentRate)}{lead.currentRate != null ? '/Monat' : ''}</strong>
            </div>
          </div>
        </section>

        <section className="lead-detail__card">
          <h3 className="lead-detail__card-title">Status</h3>
          <div className="lead-detail__status-grid">
            {LEAD_STATUS_ORDER.map((key) => {
              const s = LEAD_STATUS[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`lead-detail__status-btn${lead.status === key ? ' is-active' : ''}`}
                  style={{
                    '--status-color': s.color,
                    '--status-bg': s.bg,
                  }}
                  onClick={() => handleStatusChange(key)}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="lead-detail__status-current" style={{ color: status.color }}>
            Aktuell: {status.label}
          </p>

          {(lead.status === 'ausgeliefert' || lead.status === 'auslieferung_bestaetigt') && delivery && (
            <div className="lead-detail__delivery">
              <p className="lead-detail__delivery-title">Auslieferungs-Flow</p>
              <DeliveryFlowSteps deliveryConfirmation={delivery} compact />

              {delivery.emailError && (
                <p className="lead-detail__delivery-warn">{delivery.emailError}</p>
              )}

              {delivery.voucher?.code && (
                <p className="lead-detail__delivery-ok">
                  Gutschein: {delivery.voucher.partnerName} · {delivery.voucher.code}
                </p>
              )}

              {delivery.provisionReleased && (
                <p className="lead-detail__delivery-ok">
                  Provision {delivery.provisionAmount ?? 49} € freigegeben · abrechenbar
                </p>
              )}

              <div className="lead-detail__delivery-actions">
                {delivery.token && (
                  <button type="button" className="lead-detail__delivery-link" onClick={handleCopyDeliveryLink}>
                    Link kopieren
                  </button>
                )}
                {(delivery.emailError || delivery.status === 'error') && (
                  <button type="button" className="lead-detail__delivery-link" onClick={handleRetryDeliveryEmail}>
                    E-Mail erneut senden
                  </button>
                )}
                {delivery.rewards?.selectedPartnerId && delivery.voucher?.status !== 'sent' && (
                  <button type="button" className="lead-detail__delivery-link" onClick={handleRetryVoucherEmail}>
                    Gutschein erneut senden
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="lead-detail__card">
          <h3 className="lead-detail__card-title">Notizen</h3>
          <textarea
            className="lead-detail__notes"
            value={lead.notes}
            onChange={(e) => updateNotes(lead.id, e.target.value)}
            placeholder="Interne Notizen…"
            rows={3}
          />
        </section>

        <section className="lead-detail__history">
          <h3 className="lead-detail__card-title">Historie</h3>
          <div className="lead-detail__chat">
            {(lead.history ?? []).map((entry) => (
              <div
                key={entry.id}
                className={`lead-detail__bubble lead-detail__bubble--${entry.type}`}
              >
                <p>{entry.text}</p>
                <time>{formatLeadTime(entry.at)}</time>
              </div>
            ))}
          </div>

          <form className="lead-detail__composer" onSubmit={handleNoteSubmit}>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Notiz hinzufügen…"
            />
            <button type="submit" disabled={!noteDraft.trim()} aria-label="Senden">
              ➤
            </button>
          </form>
        </section>
      </div>

      {replyOpen && (
        <ReplySheet
          lead={lead}
          onClose={() => setReplyOpen(false)}
          onSent={handleReplySent}
        />
      )}

      {toast && <div className="lead-detail__toast">{toast}</div>}
    </div>
  );
}