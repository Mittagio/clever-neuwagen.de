import { useCallback, useMemo, useRef, useState } from 'react';
import {
  formatPaymentBadge,
  formatVehicleCardTitle,
} from '../../services/customerAkte.js';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import {
  VEHICLE_OFFER_STATUS_UI,
  formatFileSize,
  formatUploadWhen,
  buildOfferShareMessage,
  copyOfferLink,
  buildOfferWhatsappHref,
  buildOfferMailtoHref,
} from '../../services/vehicleOffer.js';
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
  FlowSummaryRow,
  OfferFlowLayout,
  VehicleOfferHero,
} from './flow/OfferFlowComponents.jsx';
import './CustomerOfferEdit.css';

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

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

export default function CustomerOfferEditView({
  card,
  customerName = '',
  phone = '',
  email = '',
  referenceCode = null,
  deliveryNote = '',
  offer,
  lead = null,
  telHref = null,
  onBack,
  onSave,
  onUploadPdf,
  onCreateLink,
  onReplacePdf,
  onDeletePdf,
  onMarkSent,
  onStatusChange,
  onEditConditions,
  isSaving = false,
  hasChanges = true,
}) {
  const fileInputRef = useRef(null);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [toast, setToast] = useState('');

  const title = formatVehicleCardTitle(card);
  const payment = formatPaymentBadge(card.paymentType);
  const statusUi = VEHICLE_OFFER_STATUS_UI[offer?.status] ?? VEHICLE_OFFER_STATUS_UI.draft;
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

  const pt = card.paymentType ?? 'unknown';
  const isCash = pt === 'cash';
  const isLeasing = pt === 'leasing';
  const isFinance = pt === 'financing' || pt === 'finance' || pt === 'threeWayFinancing';
  const transferCost = offer?.deliveryFee ?? 990;
  const downPayment = offer?.downPayment ?? 0;
  const paymentLabel = resolvePaymentLabel(pt);

  const offerPrice = isCash && card.desiredPrice != null
    ? card.desiredPrice + transferCost
    : card.desiredRate;

  const rateDisplay = isCash
    ? (card.desiredPrice != null ? formatCurrency(card.desiredPrice + transferCost) : 'offen')
    : (card.desiredRate != null ? `${card.desiredRate.toLocaleString('de-DE')} €/Monat` : 'offen');

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
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }

  async function handleCopyLink() {
    if (!offer?.onlineLink?.url) return;
    const ok = await copyOfferLink(offer.onlineLink.url);
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
    if (ok) onMarkSent?.('copy');
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

  return (
    <OfferFlowLayout
      backLabel="← Zur Kundenakte"
      onBack={onBack}
      title="Gespeichertes Angebot"
      titleAside={referenceCode ?? null}
    >
      <VehicleOfferHero
        modelLine={title}
        motorLine={pt !== 'unknown' ? paymentLabel : null}
        colorLabel={colorLabel}
        imageSrc={heroImage}
        imageAlt={title}
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

      {customerName && (
        <div className="cn-offer-customer-row">
          <span className="cn-offer-customer-row__label">Kunde</span>
          <span className="cn-offer-customer-row__name">{customerName}</span>
        </div>
      )}

      <FlowCard variant="flat">
        <FlowSectionHeader
          title="Konditionen"
          onEdit={handleEditConditionsClick}
          editLabel="Ergänzen"
        />
        {paymentLabel && pt !== 'unknown' && (
          <p className="cn-pricing-type">{paymentLabel}</p>
        )}
        {rateDisplay === 'offen' && (
          <dl className="cn-summary-rows">
            <FlowSummaryRow label="Rate" value="offen" variant="muted" />
          </dl>
        )}
        {(isLeasing || isFinance || isCash) && (
          <FlowPriceDetails
            paymentLabel={null}
            isCash={isCash}
            isLeasing={isLeasing}
            isFinance={isFinance}
            housePrice={card.desiredPrice}
            transferCost={transferCost}
            offerPrice={rateDisplay === 'offen' ? null : offerPrice}
            termMonths={card.termMonths}
            mileagePerYear={card.mileagePerYear}
            downPayment={downPayment}
            formatCurrency={formatCurrency}
          />
        )}
        {pt === 'unknown' && rateDisplay === 'offen' && (
          <dl className="cn-summary-rows">
            <FlowSummaryRow label="Rate" value="offen" variant="muted" />
          </dl>
        )}
        {rateDisplay === 'offen' && (
          <div className="cn-offer-conditions-action">
            <FlowSecondaryButton type="button" onClick={handleEditConditionsClick}>
              Konditionen ergänzen
            </FlowSecondaryButton>
          </div>
        )}
      </FlowCard>

      <FlowCard variant="flat">
        <FlowSectionHeader title="Online-Angebot" />

        {!offer?.pdf ? (
          <div
            className="cust-offer-upload cust-offer-upload--compact"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <p className="cust-offer-upload__title">Noch kein PDF hinterlegt.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="cust-offer-upload__input"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <FlowSecondaryButton type="button" onClick={() => fileInputRef.current?.click()}>
              PDF hochladen
            </FlowSecondaryButton>
          </div>
        ) : (
          <div className="cust-offer-pdf-row">
            <div>
              <p className="cn-vehicle-line">{offer.pdf.fileName}</p>
              <p className="cn-flow-hint">
                {formatUploadWhen(offer.pdf.uploadedAt)}
                {offer.pdf.sizeBytes ? ` · ${formatFileSize(offer.pdf.sizeBytes)}` : ''}
              </p>
            </div>
            <div className="cn-flow-inline-actions">
              {offer.pdf.dataUrl && (
                <FlowGhostButton
                  type="button"
                  onClick={() => window.open(offer.pdf.dataUrl, '_blank', 'noopener')}
                >
                  Öffnen
                </FlowGhostButton>
              )}
              <FlowGhostButton type="button" onClick={() => fileInputRef.current?.click()}>
                Ersetzen
              </FlowGhostButton>
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
          </div>
        )}

        {offer?.pdf && !offer?.onlineLink && (
          <div className="cust-offer-link-create cust-offer-link-create--compact">
            <FlowSecondaryButton type="button" onClick={onCreateLink}>
              Online-Link erstellen
            </FlowSecondaryButton>
          </div>
        )}

        {offer?.onlineLink && (
          <div className="cust-offer-link-ready cust-offer-link-ready--compact">
            <FlowStatusBadge label="Link bereit" tone="ready" />
            <p className="cust-offer-link-ready__url">{offer.onlineLink.url}</p>
            <div className="cn-flow-inline-actions">
              <FlowGhostButton type="button" onClick={handleCopyLink}>
                Link kopieren
              </FlowGhostButton>
              {whatsappHref && (
                <FlowGhostButton
                  type="button"
                  onClick={() => {
                    window.open(whatsappHref, '_blank', 'noopener');
                    onMarkSent?.('whatsapp');
                  }}
                >
                  WhatsApp
                </FlowGhostButton>
              )}
              {mailHref && (
                <FlowGhostButton
                  type="button"
                  onClick={() => {
                    window.location.href = mailHref;
                    onMarkSent?.('email');
                  }}
                >
                  E-Mail
                </FlowGhostButton>
              )}
            </div>
          </div>
        )}
      </FlowCard>

      <FlowStickyFooter>
        <FlowPrimaryButton
          type="button"
          disabled={isSaving || !hasChanges}
          onClick={() => onSave?.()}
        >
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
    </OfferFlowLayout>
  );
}
