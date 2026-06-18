import { useState } from 'react';
import {
  buildOfferEmailContent,
  buildWhatsAppSendUrl,
  copyOfferLink,
  formatOfferRate,
  getPaymentLabel,
  markOfferSent,
} from '../../logic/offerService.js';
import InternalTestCustomerShareWarning from '../shared/InternalTestCustomerShareWarning.jsx';
import './OfferComponents.css';

export default function OfferQuickSend({ offer, url, onSent, onMarkSent }) {
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleCopy() {
    const ok = await copyOfferLink(url);
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
  }

  function handleEmail() {
    const { mailto } = buildOfferEmailContent(offer, url);
    window.location.href = mailto;
    handleSent();
  }

  function handleWhatsApp() {
    const waUrl = buildWhatsAppSendUrl(offer, url, offer.dealer.contact?.phone);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    handleSent();
  }

  function handleSent() {
    if (onMarkSent) onMarkSent(markOfferSent(offer));
    if (onSent) onSent();
    showToast('Versand protokolliert');
  }

  return (
    <div className="offer-quick-send">
      <InternalTestCustomerShareWarning />
      <p className="offer-quick-send-preview">
        {getPaymentLabel(offer.pricing.paymentType)}: <strong>{formatOfferRate(offer.pricing)}</strong>
      </p>
      <div className="offer-quick-send-actions">
        <button type="button" className="offer-send-btn" onClick={handleEmail}>
          <span aria-hidden="true">📧</span> E-Mail
        </button>
        <button type="button" className="offer-send-btn" onClick={handleWhatsApp}>
          <span aria-hidden="true">📱</span> WhatsApp
        </button>
        <button type="button" className="offer-send-btn" onClick={handleCopy}>
          <span aria-hidden="true">🔗</span> Link kopieren
        </button>
      </div>
      <p className="offer-quick-send-url">{url}</p>
      {toast && <p className="offer-quick-send-toast">{toast}</p>}
    </div>
  );
}
