import { useState } from 'react';
import InternalTestCustomerShareWarning from '../shared/InternalTestCustomerShareWarning.jsx';
import {
  buildOfferMailtoHref,
  buildOfferWhatsappHref,
  copyOfferLink,
} from '../../services/vehicleOffer.js';
import { buildPortfolioShareMessage } from '../../services/crm/customerOfferPortfolioService.js';
import './CustomerAktePortfolioShareSheet.css';

export default function CustomerAktePortfolioShareSheet({
  portfolio,
  customerName = '',
  phone = '',
  email = '',
  itemCount = 0,
  onMarkSent,
}) {
  const [toast, setToast] = useState('');
  const url = portfolio?.url ?? '';

  const shareMessage = buildPortfolioShareMessage({
    customerName,
    itemCount,
    url,
    summaryLines: portfolio?.items
      ?.map((item) => item.summaryLine)
      .filter(Boolean) ?? [],
  });
  const whatsappHref = buildOfferWhatsappHref(phone, shareMessage);
  const mailHref = buildOfferMailtoHref(
    email,
    `Ihre ${itemCount === 1 ? 'Angebotsauswahl' : `${itemCount} Vorschläge`}`,
    shareMessage,
  );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleCopy() {
    const ok = await copyOfferLink(url);
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
    onMarkSent?.('copy');
  }

  function handleWhatsApp() {
    if (whatsappHref) {
      window.open(whatsappHref, '_blank', 'noopener');
    }
    onMarkSent?.('whatsapp');
    showToast('WhatsApp geöffnet');
  }

  function handleEmail() {
    if (mailHref) {
      window.location.href = mailHref;
    }
    onMarkSent?.('email');
  }

  return (
    <div className="cust-portfolio-share">
      <InternalTestCustomerShareWarning />
      <p className="cust-portfolio-share__intro">
        {itemCount === 1
          ? '1 Angebot ist im Link enthalten.'
          : `${itemCount} Angebote sind im Link enthalten.`}
        {' '}
        Der Kunde kann pro Vorschlag reagieren.
      </p>

      <div className="cust-portfolio-share__actions">
        <button type="button" className="cust-portfolio-share__btn" onClick={handleCopy}>
          Link kopieren
        </button>
        {whatsappHref ? (
          <button type="button" className="cust-portfolio-share__btn cust-portfolio-share__btn--wa" onClick={handleWhatsApp}>
            WhatsApp
          </button>
        ) : null}
        {mailHref ? (
          <button type="button" className="cust-portfolio-share__btn" onClick={handleEmail}>
            E-Mail
          </button>
        ) : null}
      </div>

      <p className="cust-portfolio-share__url">{url}</p>

      <ul className="cust-portfolio-share__hints">
        <li>Leasing/Finanzierung: PDF separat hochladen, wenn verbindlich.</li>
        <li>Kunde sieht UPE und Richtwert-Rate online.</li>
        <li>Rückmeldungen landen im Clever Eingang.</li>
      </ul>

      {toast ? <p className="cust-portfolio-share__toast" role="status">{toast}</p> : null}
    </div>
  );
}
