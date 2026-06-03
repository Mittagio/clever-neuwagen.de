import { useEffect, useState } from 'react';
import {
  buildDefaultEmailMessage,
  buildDefaultWhatsAppMessage,
  buildEmailSubject,
  refineConversationText,
} from '../../services/sales/conversationTextAssistant.js';
import {
  buildSalesWhatsAppUrl,
  copySalesShareUrl,
  printSalesComparison,
} from '../../services/sales/salesShareService.js';
import {
  recordSmartSalesQr,
  recordSmartSalesSent,
} from '../../services/sales/salesAdvisorStats.js';
import SalesVoiceInput from './SalesVoiceInput.jsx';
import SalesQrModal from './SalesQrModal.jsx';
import { parseCommunicationVoiceInstruction } from '../../services/sales/conversationTextAssistant.js';
import './smartSales.css';

export default function SalesCommunicationCenter({
  matches = [],
  shareUrl,
  customer = {},
  sellerName = '',
  dealerName = '',
  dealerPhone = '',
  wishLabels = [],
  onSent,
}) {
  const [channel, setChannel] = useState('whatsapp');
  const [whatsappText, setWhatsappText] = useState('');
  const [emailText, setEmailText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [toast, setToast] = useState('');

  const ctx = {
    customerName: customer.name || 'Kunde',
    sellerName,
    dealerName,
    matches,
    shareUrl,
    wishLabels,
  };

  useEffect(() => {
    setWhatsappText(buildDefaultWhatsAppMessage(ctx));
    setEmailText(buildDefaultEmailMessage(ctx));
    setEmailSubject(buildEmailSubject(dealerName));
  }, [matches, shareUrl, customer.name, sellerName, dealerName, wishLabels]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function currentText() {
    return channel === 'whatsapp' ? whatsappText : emailText;
  }

  function setCurrentText(text) {
    if (channel === 'whatsapp') setWhatsappText(text);
    else setEmailText(text);
  }

  function handleAiRefine() {
    const refined = refineConversationText(currentText(), aiPrompt, ctx);
    setCurrentText(refined);
    setAiPrompt('');
    showToast('Text angepasst');
  }

  function handleVoiceInstruction(parsed) {
    const instruction = parseCommunicationVoiceInstruction(parsed.transcript);
    const refined = refineConversationText(currentText(), instruction, {
      ...ctx,
      vehicleTitle: matches[0]?.model,
      newRate: matches[0]?.bestOffer?.monthlyRate ?? matches[0]?.monthlyRate,
    });
    setCurrentText(refined);
    showToast('Sprach-Anweisung übernommen');
  }

  function handleWhatsAppOpen() {
    const url = buildSalesWhatsAppUrl({ phone: customer.phone || dealerPhone, message: whatsappText });
    window.open(url, '_blank', 'noopener,noreferrer');
    recordSmartSalesSent();
    onSent?.('whatsapp');
    showToast('WhatsApp geöffnet');
  }

  function handleEmailOpen() {
    const mailto = `mailto:${customer.email ?? ''}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailText)}`;
    window.location.href = mailto;
    recordSmartSalesSent();
    onSent?.('email');
  }

  async function handleCopyLink() {
    const ok = await copySalesShareUrl(shareUrl);
    showToast(ok ? 'Link kopiert' : 'Fehler beim Kopieren');
    if (ok) {
      recordSmartSalesSent();
      onSent?.('link');
    }
  }

  function handlePdf() {
    printSalesComparison();
    recordSmartSalesSent();
    onSent?.('pdf');
  }

  function handleQr() {
    setQrOpen(true);
    recordSmartSalesQr();
    onSent?.('qr');
  }

  return (
    <section className="ss-comm" aria-label="An Kunden senden">
      <h2 className="ss-comm__title">An Kunden senden</h2>

      <div className="ss-comm__tabs">
        <button
          type="button"
          className={`ss-comm__tab${channel === 'whatsapp' ? ' ss-comm__tab--active' : ''}`}
          onClick={() => setChannel('whatsapp')}
        >
          WhatsApp
        </button>
        <button
          type="button"
          className={`ss-comm__tab${channel === 'email' ? ' ss-comm__tab--active' : ''}`}
          onClick={() => setChannel('email')}
        >
          E-Mail
        </button>
      </div>

      {channel === 'email' && (
        <label className="ss-comm__field">
          <span>Betreff</span>
          <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
        </label>
      )}

      <label className="ss-comm__field">
        <span>{channel === 'whatsapp' ? 'WhatsApp-Text' : 'E-Mail-Text'}</span>
        <textarea
          rows={10}
          value={currentText()}
          onChange={(e) => setCurrentText(e.target.value)}
        />
      </label>

      <div className="ss-comm__ai">
        <p className="ss-comm__ai-label">KI-Textassistent</p>
        <div className="ss-comm__ai-row">
          <input
            type="text"
            placeholder='z. B. „Schreibe es professioneller“ oder „Mach es kürzer“'
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <button type="button" className="ss-btn ss-btn--secondary" onClick={handleAiRefine}>
            Text anpassen
          </button>
        </div>
        <SalesVoiceInput onParsed={handleVoiceInstruction} />
      </div>

      <div className="ss-share-grid">
        <button type="button" className="ss-share-btn ss-share-btn--primary" onClick={handleWhatsAppOpen}>
          <span aria-hidden>📱</span> WhatsApp öffnen
        </button>
        <button type="button" className="ss-share-btn" onClick={handleEmailOpen}>
          <span aria-hidden>📧</span> E-Mail öffnen
        </button>
        <button type="button" className="ss-share-btn" onClick={handlePdf}>
          <span aria-hidden>📄</span> PDF erzeugen
        </button>
        <button type="button" className="ss-share-btn" onClick={handleCopyLink}>
          <span aria-hidden>🔗</span> Link kopieren
        </button>
        <button type="button" className="ss-share-btn" onClick={handleQr}>
          <span aria-hidden>📲</span> QR-Code anzeigen
        </button>
      </div>

      <p className="ss-share__url">{shareUrl}</p>
      {toast && <p className="ss-share__toast">{toast}</p>}
      <SalesQrModal open={qrOpen} url={shareUrl} onClose={() => setQrOpen(false)} />
    </section>
  );
}
