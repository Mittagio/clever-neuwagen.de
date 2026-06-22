import { useCallback, useMemo, useRef, useState } from 'react';
import {
  formatPaymentBadge,
  formatVehicleCardConditionsDot,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
  getCustomerFirstName,
} from '../../services/customerAkte.js';
import { formatHistoryWhen } from '../../services/dealerAiLeadCrm.js';
import { polishHistoryText } from '../../services/cleverSalesCoach.js';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
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
import InternalTestCustomerShareWarning from '../shared/InternalTestCustomerShareWarning.jsx';
import {
  FlowCard,
  FlowChip,
  FlowGhostButton,
  FlowPriceDetails,
  FlowPrimaryButton,
  FlowSecondaryButton,
  FlowSectionHeader,
  FlowStatusBadge,
  FlowStickyFooter,
  OfferFlowLayout,
  VehicleOfferHero,
} from './flow/OfferFlowComponents.jsx';
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

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

function mapOfferStatusTone(statusUi = {}) {
  const map = {
    draft: 'draft',
    ready: 'ready',
    sent: 'sent',
    opened: 'opened',
    accepted: 'sent',
    rejected: 'neutral',
  };
  return map[statusUi.tone] ?? 'neutral';
}

function getMissingConditionFields(card = {}) {
  const missing = [];
  const pt = card.paymentType ?? 'unknown';
  if (!pt || pt === 'unknown') missing.push('Zahlungsart');
  const isLeasing = pt === 'leasing';
  const isFinance = pt === 'financing' || pt === 'finance' || pt === 'threeWayFinancing';
  const isCash = pt === 'cash';
  if (isLeasing || isFinance) {
    if (!card.termMonths) missing.push('Laufzeit');
    if (isLeasing && !card.mileagePerYear) missing.push('Kilometer');
    if (!card.desiredRate) missing.push('Rate');
  }
  if (isCash && !card.desiredPrice) missing.push('Angebotspreis');
  return missing;
}

function resolveCardConfiguration(lead, card) {
  const configs = lead?.crm?.vehicleConfigurations ?? [];
  if (!configs.length) return null;
  if (card.configurationId) {
    return configs.find((vc) => vc.id === card.configurationId) ?? null;
  }
  return configs.find((vc) => (vc.modelKey ?? '') === (card.modelKey ?? '')) ?? configs[0];
}

function resolvePaymentLabel(paymentType) {
  const raw = PAYMENT_TYPE_LABELS[paymentType] ?? paymentType;
  return String(raw)
    .replace(' / Barzahlung', '')
    .replace('Kauf / Barzahlung', 'Kauf')
    .trim();
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
  onEditConditions,
  isSaving = false,
}) {
  const fileInputRef = useRef(null);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [unterlagenOpen, setUnterlagenOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');

  const title = formatVehicleCardTitle(card);
  const payment = formatPaymentBadge(card.paymentType);
  const statusUi = VEHICLE_OFFER_STATUS_UI[offer?.status] ?? VEHICLE_OFFER_STATUS_UI.draft;
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

  const configuration = useMemo(
    () => resolveCardConfiguration(lead, card),
    [lead, card],
  );

  const heroImage = useMemo(() => resolveConfigureHeroImage({
    modelKey: card.modelKey ?? configuration?.modelKey,
    colorId: configuration?.colorId,
    trimId: configuration?.trimId,
  }), [card.modelKey, configuration?.colorId, configuration?.trimId]);

  const colorLabel = configuration?.colorLabel ?? null;
  const missingFields = useMemo(() => getMissingConditionFields(card), [card]);
  const isIncomplete = missingFields.length > 0;

  const pt = card.paymentType ?? 'unknown';
  const isCash = pt === 'cash';
  const isLeasing = pt === 'leasing';
  const isFinance = pt === 'financing' || pt === 'finance' || pt === 'threeWayFinancing';
  const transferCost = offer?.deliveryFee ?? 990;
  const downPayment = offer?.downPayment ?? 0;
  const paymentLabel = resolvePaymentLabel(pt);

  const heroPrice = formatVehicleCardPrice(card);
  const priceMain = heroPrice
    ?? (isIncomplete ? 'Noch unklar' : '–');
  const priceLabel = isCash
    ? 'Angebotspreis'
    : (isLeasing || isFinance ? 'Monatliche Rate' : null);
  const priceSuffix = !isCash && card.desiredRate != null ? '/ Monat' : null;

  const offerPrice = isCash && card.desiredPrice != null
    ? card.desiredPrice + transferCost
    : card.desiredRate;

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

  function handleEditConditionsClick() {
    if (onEditConditions) {
      onEditConditions(card);
      return;
    }
    showToast('Konditionen können im Angebotsflow ergänzt werden');
  }

  const statusOptions = Object.entries(VEHICLE_OFFER_STATUS_UI).map(([id, ui]) => ({
    id,
    label: ui.badge,
  }));

  const hasCustomer = Boolean(customerName || phone || email);
  const hasDeliveryNote = Boolean(deliveryNote?.trim());
  const hasNote = Boolean(offer?.note?.trim());

  return (
    <OfferFlowLayout
      backLabel="← Zur Kundenakte"
      onBack={onBack}
      title="Gespeichertes Angebot"
      subtitle={customerName ? `Für ${customerName}` : 'Angebot in der Kundenakte'}
    >
      <VehicleOfferHero
        modelLine={title}
        colorLabel={colorLabel}
        imageSrc={heroImage}
        imageAlt={title}
        priceMain={priceMain}
        priceLabel={priceLabel}
        priceSuffix={priceSuffix}
        statusBadge={(
          <>
            <FlowStatusBadge label={statusUi.badge} tone={mapOfferStatusTone(statusUi)} />
            {pt !== 'unknown' && (
              <span className="cn-badge cn-badge--payment">{payment.label}</span>
            )}
            <button
              type="button"
              className="cn-flow-status-edit"
              onClick={() => setStatusSheetOpen(true)}
            >
              Status ändern
            </button>
          </>
        )}
      />

      {referenceCode && (
        <p className="cn-flow-meta">Ref. {referenceCode}</p>
      )}

      {hasCustomer && (
        <details className="cn-customer-fold">
          <summary>
            <span className="cn-customer-fold__label">Kunde</span>
            <span className="cn-customer-fold__name">{customerName || '–'}</span>
          </summary>
          <div className="cn-customer-fold__body">
            {phone && <p>{phone}</p>}
            {email && <p>{email}</p>}
            {(telHref || whatsappHref || email) && (
              <div className="cust-offer-contact-links">
                {telHref && <a href={telHref}>Anrufen</a>}
                {whatsappHref && (
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                )}
                {email && <a href={`mailto:${email}`}>E-Mail</a>}
              </div>
            )}
          </div>
        </details>
      )}

      {isIncomplete ? (
        <FlowCard variant="warn">
          <p className="cn-flow-card__title-text">Angebot noch nicht vollständig</p>
          <p className="cn-flow-card__subtext">Fehlende Angaben:</p>
          <ul className="cn-missing-list">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <FlowPrimaryButton type="button" onClick={handleEditConditionsClick}>
            Konditionen ergänzen
          </FlowPrimaryButton>
        </FlowCard>
      ) : (
        <FlowCard>
          <FlowSectionHeader title="Preisdetails" />
          <FlowPriceDetails
            paymentLabel={paymentLabel}
            isCash={isCash}
            isLeasing={isLeasing}
            isFinance={isFinance}
            housePrice={card.desiredPrice}
            transferCost={transferCost}
            offerPrice={offerPrice}
            termMonths={card.termMonths}
            mileagePerYear={card.mileagePerYear}
            downPayment={downPayment}
            formatCurrency={formatCurrency}
          />
        </FlowCard>
      )}

      {(hasDeliveryNote || hasNote) && (
        <FlowCard variant="flat">
          <FlowSectionHeader title="Weitere Angaben" />
          {hasDeliveryNote && (
            <p className="cn-flow-hint">
              <strong>Übergabe:</strong> {deliveryNote}
            </p>
          )}
          {hasNote && (
            <p className="cn-flow-hint">
              <strong>Notiz:</strong> {offer.note}
            </p>
          )}
        </FlowCard>
      )}

      <FlowCard>
        <FlowSectionHeader title="Online-Angebot" />
        <InternalTestCustomerShareWarning />

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
            <FlowPrimaryButton type="button" onClick={() => fileInputRef.current?.click()}>
              PDF hochladen
            </FlowPrimaryButton>
            <FlowSecondaryButton
              type="button"
              className="cust-offer-upload__mobile"
              onClick={() => fileInputRef.current?.click()}
            >
              Datei auswählen
            </FlowSecondaryButton>
          </div>
        ) : (
          <>
            <p className="cn-vehicle-line">{offer.pdf.fileName}</p>
            <p className="cn-flow-hint">
              {formatUploadWhen(offer.pdf.uploadedAt)}
              {offer.pdf.sizeBytes ? ` · ${formatFileSize(offer.pdf.sizeBytes)}` : ''}
              {' · '}Angebot hinterlegt
            </p>
            <div className="cn-flow-card__actions">
              {offer.pdf.dataUrl && (
                <FlowSecondaryButton
                  type="button"
                  onClick={() => window.open(offer.pdf.dataUrl, '_blank', 'noopener')}
                >
                  PDF öffnen
                </FlowSecondaryButton>
              )}
              <FlowSecondaryButton type="button" onClick={() => fileInputRef.current?.click()}>
                PDF ersetzen
              </FlowSecondaryButton>
              <FlowGhostButton type="button" onClick={onDeletePdf}>
                Löschen
              </FlowGhostButton>
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
          </>
        )}

        {offer?.pdf && !offer?.onlineLink && (
          <div className="cust-offer-link-create">
            <p className="cn-flow-card__title-text">Noch kein Online-Link</p>
            <p className="cn-flow-card__subtext">
              Erstelle einen Link für deinen Kunden – ohne Dateianhang.
            </p>
            <FlowPrimaryButton type="button" onClick={onCreateLink}>
              Online-Link erstellen
            </FlowPrimaryButton>
          </div>
        )}

        {offer?.onlineLink && (
          <div className="cust-offer-link-ready">
            <FlowStatusBadge label="Link bereit" tone="ready" />
            <p className="cust-offer-link-ready__url">{offer.onlineLink.url}</p>
            <div className="cn-flow-inline-actions">
              <FlowSecondaryButton type="button" onClick={handleCopyLink}>
                Link kopieren
              </FlowSecondaryButton>
              <FlowSecondaryButton type="button" onClick={handleWhatsapp}>
                WhatsApp
              </FlowSecondaryButton>
              <FlowSecondaryButton type="button" onClick={handleEmail}>
                E-Mail
              </FlowSecondaryButton>
            </div>
            <FlowGhostButton
              type="button"
              onClick={() => window.open(offer.onlineLink.url, '_blank', 'noopener')}
            >
              Vorschau öffnen
            </FlowGhostButton>
            {!email && (
              <p className="cn-flow-hint">Mit E-Mail ist der Link schneller raus.</p>
            )}
            {!phone && (
              <p className="cn-flow-hint">Mit Telefonnummer geht WhatsApp schneller.</p>
            )}
          </div>
        )}
      </FlowCard>

      {offer?.onlineLink && (
        <FlowCard>
          <FlowSectionHeader title="Öffnungsstatus" />
          {!opened ? (
            <p className="cn-flow-hint">{formatOpenedTracking(offer.tracking)}</p>
          ) : (
            <>
              <FlowStatusBadge label="Geöffnet" tone="opened" />
              <p className="cn-flow-hint">
                {firstName} hat das Angebot {formatUploadWhen(offer.tracking.lastOpenedAt).toLowerCase()} geöffnet.
              </p>
              <p className="cn-flow-hint">{formatOpenedTracking(offer.tracking)}</p>
            </>
          )}
        </FlowCard>
      )}

      {showSmartAction && (
        <FlowCard variant="warn">
          <div className="cn-flow-nbs">
            <span aria-hidden>★</span>
            <div>
              <p className="cn-flow-nbs__title">Guter Moment</p>
              <p className="cn-flow-nbs__text">
                {firstName} hat das Angebot geöffnet. Ein kurzer Anruf kann jetzt den Unterschied machen.
              </p>
            </div>
          </div>
          <FlowPrimaryButton type="button" onClick={() => { window.location.href = telHref; }}>
            Jetzt anrufen
          </FlowPrimaryButton>
        </FlowCard>
      )}

      {lead && (
        <FlowCard>
          <FlowSectionHeader title="Abschluss vorbereiten" />
          <p className="cn-flow-hint">{unterlagenSubline}</p>
          {unterlagenSummary && (
            <p className="cn-vehicle-line" style={{ fontSize: '0.9rem' }}>
              {unterlagenSummary.headline}
            </p>
          )}
          {showSelbstauskunft && selbstauskunftLine && (
            <p className="cn-flow-hint">Selbstauskunft · {selbstauskunftLine}</p>
          )}
          <div className="cn-flow-card__actions">
            <FlowPrimaryButton type="button" onClick={() => setUnterlagenOpen(true)}>
              {showSelbstauskunft ? 'Selbstauskunft-Link senden' : 'Unterlagen öffnen'}
            </FlowPrimaryButton>
            <FlowSecondaryButton type="button" onClick={() => setUnterlagenOpen(true)}>
              Unterlagen öffnen
            </FlowSecondaryButton>
          </div>
        </FlowCard>
      )}

      <FlowCard>
        <FlowSectionHeader title="Verlauf" />
        <ul className="cn-timeline">
          {timeline.map((item, i) => (
            <li
              key={`${item.text}-${i}`}
              className={`cn-timeline__item${item.muted ? ' cn-timeline__item--muted' : ''}`}
            >
              <span aria-hidden>{item.icon}</span>
              <span>
                {item.text}
                {item.when && <span className="cn-timeline__when">{item.when}</span>}
              </span>
            </li>
          ))}
        </ul>
      </FlowCard>

      <FlowStickyFooter>
        <FlowPrimaryButton type="button" disabled={isSaving} onClick={() => onSave?.()}>
          {isSaving ? 'Speichert…' : 'Speichern'}
        </FlowPrimaryButton>
        <FlowSecondaryButton type="button" onClick={onBack}>
          Zur Kundenakte
        </FlowSecondaryButton>
      </FlowStickyFooter>

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
                <FlowChip
                  key={opt.id}
                  label={opt.label}
                  selected={offer?.status === opt.id}
                  onClick={() => {
                    onStatusChange?.(opt.id);
                    setStatusSheetOpen(false);
                  }}
                />
              ))}
            </div>
            <FlowGhostButton type="button" onClick={() => setStatusSheetOpen(false)}>
              Schließen
            </FlowGhostButton>
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
    </OfferFlowLayout>
  );
}
