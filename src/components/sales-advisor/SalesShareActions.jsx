import { useState } from 'react';
import {
  buildSalesMailto,
  buildSalesWhatsAppMessage,
  buildSalesWhatsAppUrl,
  copySalesShareUrl,
  printSalesComparison,
} from '../../services/sales/salesShareService.js';
import {
  recordSmartSalesQr,
  recordSmartSalesSent,
} from '../../services/sales/salesAdvisorStats.js';
import SalesQrModal from './SalesQrModal.jsx';

export default function SalesShareActions({
  matches = [],
  shareUrl,
  customer = {},
  sellerName = '',
  dealerName = '',
  dealerPhone = '',
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  const messagePayload = {
    customerName: customer.name || 'Kunde',
    sellerName,
    dealerName,
    matches,
    shareUrl,
  };

  function handleWhatsApp() {
    const message = buildSalesWhatsAppMessage(messagePayload);
    const url = buildSalesWhatsAppUrl({ phone: customer.phone || dealerPhone, message });
    window.open(url, '_blank', 'noopener,noreferrer');
    recordSmartSalesSent();
    showToast('WhatsApp geöffnet');
  }

  function handleEmail() {
    const mailto = buildSalesMailto({
      customerEmail: customer.email,
      ...messagePayload,
    });
    window.location.href = mailto;
    recordSmartSalesSent();
  }

  async function handleCopyLink() {
    const ok = await copySalesShareUrl(shareUrl);
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
    if (ok) recordSmartSalesSent();
  }

  function handlePdf() {
    printSalesComparison();
    recordSmartSalesSent();
  }

  function handleQr() {
    setQrOpen(true);
    recordSmartSalesQr();
  }

  return (
    <section className="ss-share" aria-label="Angebot erzeugen">
      <h2 className="ss-share__title">Angebot erzeugen</h2>
      <div className="ss-share-grid">
        <button type="button" className="ss-share-btn" onClick={handleWhatsApp}>
          <span aria-hidden>📱</span> WhatsApp senden
        </button>
        <button type="button" className="ss-share-btn" onClick={handleEmail}>
          <span aria-hidden>📧</span> E-Mail senden
        </button>
        <button type="button" className="ss-share-btn" onClick={handlePdf}>
          <span aria-hidden>📄</span> PDF erzeugen
        </button>
        <button type="button" className="ss-share-btn" onClick={handleCopyLink}>
          <span aria-hidden>🔗</span> Link erzeugen
        </button>
        <button type="button" className="ss-share-btn ss-share-btn--primary" onClick={handleQr}>
          <span aria-hidden>📲</span> QR-Code anzeigen
        </button>
      </div>
      <p className="ss-share__url">{shareUrl}</p>
      {toast && <p className="ss-share__toast">{toast}</p>}
      <SalesQrModal open={qrOpen} url={shareUrl} onClose={() => setQrOpen(false)} />
    </section>
  );
}
