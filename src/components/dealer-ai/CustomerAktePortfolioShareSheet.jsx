import { useState } from 'react';
import InternalTestCustomerShareWarning from '../shared/InternalTestCustomerShareWarning.jsx';
import { sendCustomerLoginCodeMail } from '../../services/mail/mailFlowService.js';
import {
  buildOfferMailtoHref,
  copyOfferLink,
} from '../../services/vehicleOffer.js';
import { buildPortfolioShareMessage } from '../../services/crm/customerOfferPortfolioService.js';
import {
  buildPortalShareEmailBody,
  formatPortalAccessStatusLabel,
} from '../../services/crm/customerPortalAccessService.js';
import './CustomerAktePortfolioShareSheet.css';

export default function CustomerAktePortfolioShareSheet({
  portfolio,
  portalAccess = null,
  leadId = null,
  customerName = '',
  email = '',
  itemCount = 0,
  dealerName = 'Clever Neuwagen',
  onMarkSent,
}) {
  const [toast, setToast] = useState('');
  const [sending, setSending] = useState(false);
  const url = portalAccess?.portfolioUrl ?? portfolio?.url ?? '';

  const shareMessage = buildPortfolioShareMessage({
    customerName,
    itemCount,
    url,
    summaryLines: portfolio?.items
      ?.map((item) => item.summaryLine)
      .filter(Boolean) ?? [],
  });
  const emailBody = buildPortalShareEmailBody({
    customerName,
    portfolioUrl: url,
    itemCount,
    summaryLines: portfolio?.items
      ?.map((item) => item.summaryLine)
      .filter(Boolean) ?? [],
  });
  const mailHref = email
    ? buildOfferMailtoHref(
      email,
      itemCount === 1 ? 'Ihre Fahrzeugauswahl' : `Ihre ${itemCount} Fahrzeugvorschläge`,
      `${emailBody}\n\nIhr Zugangscode: ${portalAccess?.accessCode ?? '—'}`,
    )
    : null;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleCopy() {
    const ok = await copyOfferLink(url);
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
    onMarkSent?.('copy');
  }

  async function handleEmailSend() {
    if (!email?.trim()) {
      showToast('Keine E-Mail hinterlegt');
      return;
    }
    setSending(true);
    const mailResult = await sendCustomerLoginCodeMail({
      to: email.trim(),
      customerName: customerName || 'Kunde',
      code: portalAccess?.accessCode ?? '',
      portalUrl: url,
      dealerName,
      meta: {
        flow: 'portfolio-share',
        portfolioId: portfolio?.id,
        leadId: leadId ?? portfolio?.leadId ?? null,
      },
    });
    setSending(false);
    if (mailResult.ok) {
      showToast('E-Mail versendet');
    } else {
      showToast(mailResult.error ?? 'Versand fehlgeschlagen');
    }
    onMarkSent?.({ via: 'email', mailResult });
  }

  function handleMailtoFallback() {
    if (mailHref) window.location.href = mailHref;
    onMarkSent?.({ via: 'mailto' });
  }

  const statusLabel = formatPortalAccessStatusLabel(portalAccess?.status ?? 'prepared');

  return (
    <div className="cust-portfolio-share">
      <InternalTestCustomerShareWarning />

      <h3 className="cust-portfolio-share__title">Kundenlink vorbereitet</h3>
      <p className="cust-portfolio-share__intro">
        Der Kunde erhält diesen Link per E-Mail und bestätigt den Zugang mit einem Code.
      </p>

      <dl className="cust-portfolio-share__meta">
        <div>
          <dt>E-Mail</dt>
          <dd>{email || '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div>
          <dt>Angebote im Link</dt>
          <dd>{itemCount}</dd>
        </div>
      </dl>

      <div className="cust-portfolio-share__actions">
        <button type="button" className="cust-portfolio-share__btn cust-portfolio-share__btn--primary" onClick={handleCopy}>
          Link kopieren
        </button>
        {email ? (
          <button
            type="button"
            className="cust-portfolio-share__btn cust-portfolio-share__btn--primary"
            onClick={handleEmailSend}
            disabled={sending}
          >
            {sending ? 'Wird gesendet …' : 'Per E-Mail senden'}
          </button>
        ) : null}
        {mailHref ? (
          <button type="button" className="cust-portfolio-share__btn" onClick={handleMailtoFallback}>
            Mail-App öffnen
          </button>
        ) : null}
      </div>

      <p className="cust-portfolio-share__url">{url}</p>

      {portalAccess?.accessCode ? (
        <p className="cust-portfolio-share__demo-code">
          Demo-Zugangscode für Test:
          {' '}
          <strong>{portalAccess.accessCode}</strong>
        </p>
      ) : null}

      <ul className="cust-portfolio-share__hints">
        <li>Kein Checkout – nur Angebote vergleichen und Rückmeldung geben.</li>
        <li>Kundenfragen und Nachrichten landen im Clever Eingang.</li>
        <li>Link-Öffnung und Code-Bestätigung werden in der Kundenakte protokolliert.</li>
      </ul>

      {toast ? <p className="cust-portfolio-share__toast" role="status">{toast}</p> : null}
    </div>
  );
}
