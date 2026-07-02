import { useMemo, useState } from 'react';
import {
  formatPaymentBadge,
  formatVehicleCardPrice,
  formatVehicleCardTitle,
} from '../../services/customerAkte.js';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import {
  buildCustomerReactionLines,
  countOpenQuestions,
  getCustomerOfferInteraction,
  resolveLinkStatusLabel,
} from '../../services/customerOfferInteraction.js';
import {
  VEHICLE_OFFER_STATUS_UI,
  buildOfferShareMessage,
  buildOfferWhatsappHref,
  buildOfferMailtoHref,
  copyOfferLink,
} from '../../services/vehicleOffer.js';
import { canEditOfferInCalculator } from '../../services/dealer/openOfferCalculator.js';
import {
  FlowCard,
  FlowChip,
  FlowGhostButton,
  FlowPrimaryButton,
  FlowSecondaryButton,
  FlowSectionHeader,
  FlowStatusBadge,
  OfferFlowLayout,
  VehicleOfferHero,
} from './flow/OfferFlowComponents.jsx';
import './CustomerOfferEdit.css';
import './CustomerOfferProposal.css';

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

function formatWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CustomerOfferProposalView({
  card,
  customerName = '',
  phone = '',
  email = '',
  offer,
  lead = null,
  onBack,
  onEditOffer,
  onPreviewLink,
  onMarkSent,
  onStatusChange,
  onAnswerQuestion,
}) {
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [toast, setToast] = useState('');

  const title = formatVehicleCardTitle(card);
  const price = formatVehicleCardPrice(card);
  const payment = formatPaymentBadge(card.paymentType);
  const statusUi = VEHICLE_OFFER_STATUS_UI[offer?.status] ?? VEHICLE_OFFER_STATUS_UI.draft;
  const interaction = useMemo(
    () => getCustomerOfferInteraction(lead, card?.id),
    [lead, card?.id],
  );
  const showEditInCalculator = canEditOfferInCalculator(card, lead);
  const reactionLines = useMemo(
    () => buildCustomerReactionLines(interaction, offer),
    [interaction, offer],
  );
  const openQuestions = interaction?.customerQuestions?.filter((q) => q.status === 'open') ?? [];
  const answeredQuestions = interaction?.customerQuestions?.filter((q) => q.status === 'answered') ?? [];
  const linkStatus = resolveLinkStatusLabel(offer);

  const heroImage = useMemo(() => resolveConfigureHeroImage({
    modelKey: card?.modelKey,
    colorId: null,
    trimId: null,
  }), [card?.modelKey]);

  const shareMessage = buildOfferShareMessage({
    customerName,
    vehicleTitle: title,
    url: offer?.onlineLink?.url ?? '',
  });
  const whatsappHref = buildOfferWhatsappHref(phone, shareMessage);
  const mailHref = buildOfferMailtoHref(email, `Ihr Angebot: ${title}`, shareMessage);

  const statusOptions = Object.entries(VEHICLE_OFFER_STATUS_UI).map(([id, ui]) => ({
    id,
    label: ui.badge,
  }));

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleCopyAndSend() {
    if (!offer?.onlineLink?.url) {
      showToast('Zuerst Link in der Bearbeitung erstellen');
      return;
    }
    const ok = await copyOfferLink(offer.onlineLink.url);
    if (ok) onMarkSent?.('copy');
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
  }

  function handlePreview() {
    if (offer?.onlineLink?.url) {
      if (onPreviewLink) {
        onPreviewLink(offer.onlineLink.url);
      } else {
        window.open(offer.onlineLink.url, '_blank', 'noopener');
      }
      return;
    }
    showToast('Noch kein Kundenlink vorhanden');
  }

  return (
    <OfferFlowLayout
      backLabel="← Zur Kundenakte"
      onBack={onBack}
      title="Angebotsvorschlag"
    >
      <VehicleOfferHero
        modelLine={title}
        motorLine={card?.trimLabel ?? null}
        imageSrc={heroImage}
        imageAlt={title}
        priceMain={price?.replace(/\s*\/Monat$/, '') ?? null}
        priceSuffix={price?.includes('/Monat') ? '/Monat' : null}
        statusBadge={(
          <>
            <FlowStatusBadge label={statusUi.badge} tone={mapOfferStatusTone(statusUi)} />
            {card.paymentType && card.paymentType !== 'unknown' && (
              <span className="cn-badge cn-badge--payment">{payment.label}</span>
            )}
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
        <FlowSectionHeader title="Kundenlink" />
        <p className="cust-offer-proposal__link-status">{linkStatus}</p>
        {offer?.onlineLink?.url && (
          <p className="cust-offer-proposal__link-url">{offer.onlineLink.url}</p>
        )}
      </FlowCard>

      {reactionLines.length > 0 && (
        <FlowCard variant="flat">
          <FlowSectionHeader title="Kundenreaktionen" />
          <ul className="cust-offer-proposal__reactions">
            {reactionLines.map((line) => (
              <li key={line.id}>
                <span>{line.label}</span>
                {line.at && (
                  <time dateTime={line.at}>{formatWhen(line.at)}</time>
                )}
              </li>
            ))}
          </ul>
        </FlowCard>
      )}

      {openQuestions.length > 0 && (
        <FlowCard variant="flat">
          <FlowSectionHeader
            title="Kundenfragen"
            onEdit={onAnswerQuestion ? () => onAnswerQuestion(openQuestions[0]) : undefined}
            editLabel="Beantworten"
          />
          <ul className="cust-offer-proposal__questions">
            {openQuestions.map((q) => (
              <li key={q.id}>
                <p className="cust-offer-proposal__question-text">&ldquo;{q.text}&rdquo;</p>
                {q.createdAt && (
                  <time dateTime={q.createdAt}>{formatWhen(q.createdAt)}</time>
                )}
              </li>
            ))}
          </ul>
        </FlowCard>
      )}

      {answeredQuestions.length > 0 && (
        <FlowCard variant="flat">
          <FlowSectionHeader title="Beantwortete Fragen" />
          <ul className="cust-offer-proposal__questions">
            {answeredQuestions.map((q) => (
              <li key={q.id}>
                <p className="cust-offer-proposal__question-text">&ldquo;{q.text}&rdquo;</p>
                {q.answerText && (
                  <p className="cust-offer-proposal__answer-text">{q.answerText}</p>
                )}
              </li>
            ))}
          </ul>
        </FlowCard>
      )}

      <div className="cust-offer-proposal__actions">
        {showEditInCalculator && (
          <FlowPrimaryButton type="button" onClick={() => onEditOffer?.(card)}>
            Angebot bearbeiten
          </FlowPrimaryButton>
        )}
        <FlowSecondaryButton type="button" onClick={handlePreview}>
          Kundenlink ansehen
        </FlowSecondaryButton>
        <FlowSecondaryButton
          type="button"
          disabled={!offer?.onlineLink?.url}
          onClick={handleCopyAndSend}
        >
          Kundenlink senden
        </FlowSecondaryButton>
        {openQuestions.length > 0 && onAnswerQuestion && (
          <FlowSecondaryButton type="button" onClick={() => onAnswerQuestion(openQuestions[0])}>
            Frage beantworten
          </FlowSecondaryButton>
        )}
        <FlowGhostButton type="button" onClick={() => setStatusSheetOpen(true)}>
          Status ändern
        </FlowGhostButton>
        {whatsappHref && offer?.onlineLink?.url && (
          <FlowGhostButton
            type="button"
            onClick={() => {
              window.open(whatsappHref, '_blank', 'noopener');
              onMarkSent?.('whatsapp');
            }}
          >
            Per WhatsApp senden
          </FlowGhostButton>
        )}
        {mailHref && offer?.onlineLink?.url && (
          <FlowGhostButton
            type="button"
            onClick={() => {
              window.location.href = mailHref;
              onMarkSent?.('email');
            }}
          >
            Per E-Mail senden
          </FlowGhostButton>
        )}
      </div>

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

      {toast && <p className="cust-offer-proposal__toast" role="status">{toast}</p>}
    </OfferFlowLayout>
  );
}
