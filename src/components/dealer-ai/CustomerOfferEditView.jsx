import { useCallback, useRef, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import {
  formatPaymentBadge,
  formatVehicleCardConditionsDot,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  getCustomerFirstName,
  getCustomerInitials,
} from '../../services/customerAkte.js';
import { formatHistoryWhen } from '../../services/dealerAiLeadCrm.js';
import { polishHistoryText } from '../../services/cleverSalesCoach.js';
import {
  VEHICLE_OFFER_STATUS,
  VEHICLE_OFFER_STATUS_UI,
  VEHICLE_OFFER_HISTORY,
  formatFileSize,
  formatUploadWhen,
  formatOpenedTracking,
  buildOfferShareMessage,
  copyOfferLink,
  buildOfferWhatsappHref,
  buildOfferMailtoHref,
} from '../../services/vehicleOffer.js';
import {
  computeUnterlagenSummary,
  getUnterlagenSubline,
} from '../../services/cleverUnterlagen.js';
import {
  formatSelbstauskunftSummary,
  getSelbstauskunft,
  needsSelbstauskunft,
} from '../../services/cleverSelbstauskunft.js';
import CleverUnterlagenSheet from './CleverUnterlagenSheet.jsx';
import './CustomerOfferEdit.css';
import './CleverUnterlagenSheet.css';

function buildOfferTimeline(offer = {}, history = []) {
  const items = [];
  const offerHistoryTypes = new Set([
    'offer_pdf', 'offer_link', 'offer_sent_email', 'offer_sent_whatsapp',
    'offer_opened', 'offer_accepted', 'offer_rejected',
  ]);

  history
    .filter((h) => offerHistoryTypes.has(h.type) || /angebot/i.test(h.text ?? ''))
    .slice(0, 8)
    .forEach((h) => {
      items.push({
        icon: h.type?.includes('opened') ? '👁' : h.type?.includes('whatsapp') ? '💬' : h.type?.includes('email') ? '✉' : '•',
        text: polishHistoryText(h.text),
        when: formatHistoryWhen(h.at),
        muted: false,
      });
    });

  if (!offer.pdf && !items.some((i) => /pdf/i.test(i.text))) {
    items.push({ icon: '○', text: 'Angebot-PDF noch nicht vorhanden', muted: true });
  }
  if (offer.pdf && !offer.onlineLink) {
    items.unshift({
      icon: '✓',
      text: VEHICLE_OFFER_HISTORY.pdf_uploaded,
      when: formatUploadWhen(offer.pdf.uploadedAt),
      muted: false,
    });
  }
  if (offer.onlineLink && offer.status === VEHICLE_OFFER_STATUS.LINK_READY && !offer.sentAt) {
    items.unshift({
      icon: '○',
      text: 'Link noch nicht gesendet',
      muted: true,
    });
  }

  return items.slice(0, 6);
}

export default function CustomerOfferEditView({
  card,
  customerName = '',
  phone = '',
  email = '',
  referenceCode = null,
  deliveryNote = '',
  offer,
  history = [],
  lead = null,
  telHref = null,
  onBack,
  onSave,
  onSaveUnterlagen,
  onUploadPdf,
  onCreateLink,
  onReplacePdf,
  onDeletePdf,
  onMarkSent,
  onStatusChange,
  isSaving = false,
}) {
  const fileInputRef = useRef(null);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [unterlagenOpen, setUnterlagenOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');

  const title = formatVehicleCardTitle(card);
  const payment = formatPaymentBadge(card.paymentType);
  const statusUi = VEHICLE_OFFER_STATUS_UI[offer?.status] ?? VEHICLE_OFFER_STATUS_UI.draft;
  const isCollapsed = ['sent', 'opened', 'accepted'].includes(offer?.status);
  const firstName = getCustomerFirstName(customerName);
  const shareMessage = buildOfferShareMessage({
    customerName,
    vehicleTitle: title,
    url: offer?.onlineLink?.url ?? '',
  });
  const whatsappHref = buildOfferWhatsappHref(phone, shareMessage);
  const mailHref = buildOfferMailtoHref(
    email,
    `Ihr Angebot: ${title}`,
    shareMessage,
  );
  const timeline = buildOfferTimeline(offer, history);
  const opened = (offer?.tracking?.openCount ?? 0) > 0;
  const showSmartAction = offer?.status === VEHICLE_OFFER_STATUS.OPENED && telHref;
  const unterlagenSummary = lead ? computeUnterlagenSummary(lead, card.paymentType) : null;
  const unterlagenSubline = getUnterlagenSubline(card.paymentType);
  const conditionsLine = formatVehicleCardConditionsDot(card);
  const showSelbstauskunft = needsSelbstauskunft(card.paymentType);
  const selbstauskunft = lead ? getSelbstauskunft(lead?.crm?.cleverUnterlagen) : null;
  const selbstauskunftLine = selbstauskunft
    ? formatSelbstauskunftSummary(selbstauskunft, selbstauskunft.uploadCount ?? 0)
    : null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
      showToast('Bitte eine PDF-Datei wählen');
      return;
    }
    onUploadPdf?.(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }

  async function handleCopyLink() {
    if (!offer?.onlineLink?.url) return;
    const ok = await copyOfferLink(offer.onlineLink.url);
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
    if (ok) onMarkSent?.('copy');
  }

  function handleWhatsapp() {
    if (!whatsappHref) {
      showToast('Mit Telefonnummer geht WhatsApp schneller');
      return;
    }
    window.open(whatsappHref, '_blank', 'noopener');
    onMarkSent?.('whatsapp');
  }

  function handleEmail() {
    if (!mailHref) {
      showToast('Mit E-Mail ist der Link schneller raus');
      return;
    }
    window.location.href = mailHref;
    onMarkSent?.('email');
  }

  const statusOptions = Object.entries(VEHICLE_OFFER_STATUS_UI).map(([id, ui]) => ({
    id,
    label: ui.badge,
  }));

  return (
    <div className="cust-offer-edit">
      <div className="cust-offer-toolbar">
        <button type="button" className="cust-offer-toolbar__back" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <h1 className="cust-offer-toolbar__title">Angebot bearbeiten</h1>
        <button type="button" className="cust-offer-toolbar__more" aria-label="Mehr">
          ⋯
        </button>
      </div>

      <div className="cust-offer-customer">
        <div className="cust-offer-customer__avatar" aria-hidden>
          {getCustomerInitials(customerName)}
        </div>
        <div>
          <p className="cust-offer-customer__name">
            {customerName || 'Kunde noch offen'}
            <span className="cust-offer-customer__tag">Kunde</span>
          </p>
          <div className="cust-offer-customer__icons">
            {telHref && <a href={telHref} aria-label="Anrufen">📞</a>}
            {whatsappHref && <a href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">💬</a>}
            {email && <a href={`mailto:${email}`} aria-label="E-Mail">✉</a>}
          </div>
        </div>
      </div>

      <article className="cust-offer-hero-card">
        <div className="cust-offer-hero-card__image">
          <VehicleImage
            brand="Kia"
            model={card.modelKey}
            bodyType={card.bodyType ?? 'suv'}
            variant="card"
            className="cust-offer-hero-card__img-wrap"
            imageClassName="cust-offer-hero-card__img"
          />
        </div>
        <div>
          <span className={`cust-offer-hero-card__payment cust-offer-hero-card__payment--${payment.tone}`}>
            {payment.label}
          </span>
          <p className="cust-offer-hero-card__title">{title}</p>
          {formatVehicleCardConditionsDot(card) && (
            <p className="cust-offer-hero-card__terms">{formatVehicleCardConditionsDot(card)}</p>
          )}
          {formatVehicleCardPrice(card) && (
            <p className="cust-offer-hero-card__price">{formatVehicleCardPrice(card)}</p>
          )}
        </div>
      </article>

      <div className={`cust-offer-status-banner cust-offer-status-banner--${statusUi.bannerTone}`}>
        <div>
          <p className="cust-offer-status-banner__badge">{statusUi.badge}</p>
          <p className="cust-offer-status-banner__text">{statusUi.banner}</p>
        </div>
        <button
          type="button"
          className="cust-offer-status-banner__change"
          onClick={() => setStatusSheetOpen(true)}
        >
          Status ändern
        </button>
      </div>

      {referenceCode && (
        <p className="cust-offer-ref">Ref. {referenceCode}</p>
      )}

      <section className="cust-offer-section">
        <h2 className="cust-offer-section__title">Konditionen</h2>
        {isCollapsed && !conditionsOpen ? (
          <button
            type="button"
            className="cust-offer-conditions-collapsed"
            onClick={() => setConditionsOpen(true)}
          >
            <span>
              {formatVehicleCardConditionsDot(card) || payment.label}
            </span>
            <span className="cust-offer-conditions-collapsed__price">
              {formatVehicleCardPrice(card)}
            </span>
            <span className="cust-offer-conditions-collapsed__chev" aria-hidden>›</span>
          </button>
        ) : (
          <div className="cust-offer-data">
            <div className="cust-offer-data__row">
              <span className="cust-offer-data__label">Laufzeit</span>
              <span className="cust-offer-data__value">
                {card.termMonths ? `${card.termMonths} Monate` : '—'}
              </span>
            </div>
            <div className="cust-offer-data__row">
              <span className="cust-offer-data__label">Kilometerleistung</span>
              <span className="cust-offer-data__value">
                {card.mileagePerYear
                  ? `${Number(card.mileagePerYear).toLocaleString('de-DE')} km / Jahr`
                  : '—'}
              </span>
            </div>
            <div className="cust-offer-data__row">
              <span className="cust-offer-data__label">Rate</span>
              <span className="cust-offer-data__value">{formatVehicleCardPrice(card) ?? '—'}</span>
            </div>
            <div className="cust-offer-data__row">
              <span className="cust-offer-data__label">Anzahlung</span>
              <span className="cust-offer-data__value">
                {offer?.downPayment != null ? `${offer.downPayment} €` : '0 €'}
              </span>
            </div>
            <div className="cust-offer-data__row">
              <span className="cust-offer-data__label">Überführung</span>
              <span className="cust-offer-data__value">
                {offer?.deliveryFee != null ? `${offer.deliveryFee} €` : '990 €'}
              </span>
            </div>
            <div className="cust-offer-data__row">
              <span className="cust-offer-data__label">Zahlungsart</span>
              <span className="cust-offer-data__value">{payment.label}</span>
            </div>
          </div>
        )}
      </section>

      <section className="cust-offer-section">
        <h2 className="cust-offer-section__title">Angebotsdaten</h2>
        <div className="cust-offer-data">
          {[
            ['Fahrzeug', title],
            ['Konditionen', formatVehicleCardConditionsDot(card)?.replace(/ • /g, ' · ') ?? '—'],
            ['Preis / Rate', formatVehicleCardPrice(card) ?? '—'],
            ['Kunde', customerName || '—'],
            ['Übergabe', deliveryNote || '—'],
            ['Notiz', offer?.note || '—'],
          ].map(([label, value]) => (
            <button
              key={label}
              type="button"
              className="cust-offer-data__row cust-offer-data__row--btn"
              onClick={() => showToast('Bearbeitung folgt bald')}
            >
              <span className="cust-offer-data__label">{label}</span>
              <span className="cust-offer-data__value">{value}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cust-offer-section">
        <h2 className="cust-offer-section__title">Online-Angebot</h2>

        {!offer?.pdf ? (
          <div
            className={`cust-offer-upload${dragOver ? ' cust-offer-upload--drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <span className="cust-offer-upload__icon" aria-hidden>☁</span>
            <p className="cust-offer-upload__title">Noch kein Angebot hinterlegt.</p>
            <p className="cust-offer-upload__sub">PDF hochladen und als Online-Angebot bereitstellen.</p>
            <p className="cust-offer-upload__hint cust-offer-upload__hint--desktop">PDF hierher ziehen</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="cust-offer-upload__input"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className="cust-offer-btn cust-offer-btn--primary"
              onClick={() => fileInputRef.current?.click()}
            >
              PDF hochladen
            </button>
            <button
              type="button"
              className="cust-offer-btn cust-offer-btn--secondary cust-offer-upload__mobile"
              onClick={() => fileInputRef.current?.click()}
            >
              Datei auswählen
            </button>
          </div>
        ) : (
          <div className="cust-offer-pdf">
            <p className="cust-offer-pdf__name">{offer.pdf.fileName}</p>
            <p className="cust-offer-pdf__meta">
              {formatUploadWhen(offer.pdf.uploadedAt)}
              {offer.pdf.sizeBytes ? ` · ${formatFileSize(offer.pdf.sizeBytes)}` : ''}
              {' · '}Angebot hinterlegt
            </p>
            <div className="cust-offer-pdf__actions">
              {offer.pdf.dataUrl && (
                <a
                  href={offer.pdf.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cust-offer-btn cust-offer-btn--secondary"
                >
                  PDF öffnen
                </a>
              )}
              <button
                type="button"
                className="cust-offer-btn cust-offer-btn--secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                PDF ersetzen
              </button>
              <button
                type="button"
                className="cust-offer-btn cust-offer-btn--ghost"
                onClick={onDeletePdf}
              >
                Löschen
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="cust-offer-upload__input"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  onReplacePdf?.();
                }}
              />
            </div>
          </div>
        )}

        {offer?.pdf && !offer?.onlineLink && (
          <div className="cust-offer-link-create">
            <p className="cust-offer-link-create__title">Noch kein Online-Link</p>
            <p className="cust-offer-link-create__sub">Erstelle einen Link für deinen Kunden – ohne Dateianhang.</p>
            <button
              type="button"
              className="cust-offer-btn cust-offer-btn--primary cust-offer-btn--block"
              onClick={onCreateLink}
            >
              Online-Link erstellen
            </button>
          </div>
        )}

        {offer?.onlineLink && (
          <div className="cust-offer-link-ready">
            <p className="cust-offer-link-ready__status">Link bereit</p>
            <p className="cust-offer-link-ready__url">{offer.onlineLink.url}</p>
            <div className="cust-offer-link-actions">
              <button type="button" className="cust-offer-btn cust-offer-btn--secondary" onClick={handleCopyLink}>
                Link kopieren
              </button>
              <button type="button" className="cust-offer-btn cust-offer-btn--secondary" onClick={handleWhatsapp}>
                WhatsApp
              </button>
              <button type="button" className="cust-offer-btn cust-offer-btn--secondary" onClick={handleEmail}>
                E-Mail
              </button>
            </div>
            <button
              type="button"
              className="cust-offer-link-btn"
              onClick={() => window.open(offer.onlineLink.url, '_blank', 'noopener')}
            >
              Vorschau öffnen
            </button>
            {!email && (
              <p className="cust-offer-hint">Mit E-Mail ist der Link schneller raus.</p>
            )}
            {!phone && (
              <p className="cust-offer-hint">Mit Telefonnummer geht WhatsApp schneller.</p>
            )}
          </div>
        )}
      </section>

      {offer?.onlineLink && (
        <section className="cust-offer-section">
          <h2 className="cust-offer-section__title">Öffnungsstatus</h2>
          {!opened ? (
            <p className="cust-offer-muted">{formatOpenedTracking(offer.tracking)}</p>
          ) : (
            <div className="cust-offer-opened-card">
              <span className="cust-offer-opened-card__icon" aria-hidden>👁</span>
              <div>
                <p className="cust-offer-opened-card__title">Geöffnet</p>
                <p className="cust-offer-opened-card__text">
                  {firstName} hat das Angebot {formatUploadWhen(offer.tracking.lastOpenedAt).toLowerCase()} geöffnet.
                </p>
                <p className="cust-offer-opened-card__text">
                  {formatOpenedTracking(offer.tracking)}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {showSmartAction && (
        <section className="cust-offer-section cust-offer-nbs">
          <div className="cust-offer-nbs__box">
            <span className="cust-offer-nbs__star" aria-hidden>★</span>
            <div>
              <p className="cust-offer-nbs__title">Guter Moment</p>
              <p className="cust-offer-nbs__text">
                {firstName} hat das Angebot geöffnet. Ein kurzer Anruf kann jetzt den Unterschied machen.
              </p>
            </div>
          </div>
          <a href={telHref} className="cust-offer-nbs__cta">
            Jetzt anrufen
          </a>
        </section>
      )}

      {lead && (
        <section className="cust-offer-unterlagen" aria-labelledby="cust-offer-unterlagen-title">
          <h2 id="cust-offer-unterlagen-title" className="cust-offer-unterlagen__title">
            Abschluss vorbereiten
          </h2>
          <p className="cust-offer-unterlagen__sub">{unterlagenSubline}</p>
          {unterlagenSummary && (
            <p className="cust-offer-unterlagen__status">{unterlagenSummary.headline}</p>
          )}
          {showSelbstauskunft && selbstauskunftLine && (
            <p className="cust-offer-unterlagen__sa">Selbstauskunft · {selbstauskunftLine}</p>
          )}
          <div className="cust-offer-unterlagen__actions">
            <button
              type="button"
              className="cust-offer-btn cust-offer-btn--primary cust-offer-btn--block"
              onClick={() => setUnterlagenOpen(true)}
            >
              {showSelbstauskunft ? 'Selbstauskunft-Link senden' : 'Unterlagen öffnen'}
            </button>
            <button
              type="button"
              className="cust-offer-btn cust-offer-btn--secondary cust-offer-btn--block"
              onClick={() => setUnterlagenOpen(true)}
            >
              Unterlagen öffnen
            </button>
          </div>
        </section>
      )}

      <section className="cust-offer-section">
        <h2 className="cust-offer-section__title">Verlauf</h2>
        <ul className="cust-offer-timeline">
          {timeline.map((item, i) => (
            <li
              key={`${item.text}-${i}`}
              className={`cust-offer-timeline__item${item.muted ? ' cust-offer-timeline__item--muted' : ''}`}
            >
              <span aria-hidden>{item.icon}</span>
              <span>
                {item.text}
                {item.when && <span className="cust-offer-timeline__when">{item.when}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="cust-offer-footer">
        <button
          type="button"
          className="cust-offer-btn cust-offer-btn--primary cust-offer-btn--block"
          disabled={isSaving}
          onClick={() => onSave?.()}
        >
          {isSaving ? 'Speichert…' : 'Speichern'}
        </button>
        <button
          type="button"
          className="cust-offer-btn cust-offer-btn--secondary cust-offer-btn--block"
          onClick={onBack}
        >
          Zur Kundenakte
        </button>
      </footer>

      {statusSheetOpen && (
        <div
          className="cust-offer-sheet-backdrop"
          role="dialog"
          aria-label="Status ändern"
          onClick={() => setStatusSheetOpen(false)}
        >
          <div className="cust-offer-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="cust-offer-sheet__title">Status ändern</h3>
            <div className="cust-offer-sheet__chips">
              {statusOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`cust-offer-sheet__chip${offer?.status === opt.id ? ' is-active' : ''}`}
                  onClick={() => {
                    onStatusChange?.(opt.id);
                    setStatusSheetOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cust-offer-btn cust-offer-btn--ghost cust-offer-btn--block"
              onClick={() => setStatusSheetOpen(false)}
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {toast && <p className="cust-offer-toast" role="status">{toast}</p>}

      {unterlagenOpen && lead && (
        <div
          className="cust-offer-sheet-backdrop"
          role="dialog"
          aria-label="Clever Unterlagen"
          onClick={() => setUnterlagenOpen(false)}
        >
          <div className="cust-offer-sheet cust-offer-sheet--unterlagen" onClick={(e) => e.stopPropagation()}>
            <CleverUnterlagenSheet
              lead={lead}
              paymentType={card.paymentType}
              customerName={customerName}
              phone={phone}
              email={email}
              vehicleTitle={title}
              vehicleConditions={conditionsLine}
              isGewerbe={lead?.wish?.customerGroup === 'gewerbe' || lead?.crm?.customerGroup === 'gewerbe'}
              onClose={() => setUnterlagenOpen(false)}
              onSave={onSaveUnterlagen}
            />
          </div>
        </div>
      )}
    </div>
  );
}
