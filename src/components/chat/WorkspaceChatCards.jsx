import { MESSAGE_KIND } from '../../services/crm/customerMessageService.js';

function initialsFromLabel(label = '') {
  const cleaned = String(label).replace(/✨/g, '').trim();
  if (!cleaned) return '·';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function OfferChatCard({ payload = {}, onOpen }) {
  return (
    <article className="sw-card sw-card--offer">
      {payload.heroImage ? (
        <div className="sw-card__media">
          <img src={payload.heroImage} alt="" />
        </div>
      ) : null}
      <div className="sw-card__body">
        <h3 className="sw-card__title">{payload.title || 'Angebot'}</h3>
        {payload.colorLabel ? <p className="sw-card__meta">{payload.colorLabel}</p> : null}
        {payload.rateLine ? <p className="sw-card__rate">{payload.rateLine}</p> : null}
        {payload.subtitle ? <p className="sw-card__meta">{payload.subtitle}</p> : null}
        <button type="button" className="sw-card__link" onClick={() => onOpen?.(payload)}>
          {payload.ctaLabel || 'Angebot ansehen'}
          {' →'}
        </button>
      </div>
    </article>
  );
}

export function DocumentRequestCard({ payload = {}, onUpload }) {
  return (
    <article className="sw-card sw-card--doc-request">
      <p className="sw-card__eyebrow">Unterlage</p>
      <h3 className="sw-card__title">{payload.title || 'Dokument'}</h3>
      <p className="sw-card__meta">{payload.statusLabel || 'Offen'}</p>
      <button type="button" className="sw-card__cta" onClick={() => onUpload?.(payload)}>
        {payload.ctaLabel || 'Hochladen'}
      </button>
    </article>
  );
}

export function SelfDisclosureChatCard({ payload = {}, onStart }) {
  return (
    <article className="sw-card sw-card--sa">
      <p className="sw-card__eyebrow">Selbstauskunft</p>
      <h3 className="sw-card__title">{payload.title || 'Selbstauskunft'}</h3>
      {payload.subtitle ? <p className="sw-card__meta">{payload.subtitle}</p> : null}
      <button type="button" className="sw-card__cta" onClick={() => onStart?.(payload)}>
        {payload.ctaLabel || 'Jetzt ausfüllen'}
      </button>
    </article>
  );
}

export function ChecklistChatCard({ payload = {}, onUpload, onStartSa }) {
  const items = payload.items ?? [];
  return (
    <article className="sw-card sw-card--checklist">
      <p className="sw-card__eyebrow">{payload.title || 'Für die Bestellung fehlen noch Unterlagen'}</p>
      <ul className="sw-checklist">
        {items.map((item) => (
          <li key={item.id} className={item.done ? 'is-done' : ''}>
            <span>{item.done ? '✓' : '○'} {item.label}</span>
            {!item.done && item.id === 'selbstauskunft' ? (
              <button type="button" className="sw-card__mini" onClick={() => onStartSa?.(item)}>
                Jetzt ausfüllen
              </button>
            ) : null}
            {!item.done && item.id !== 'selbstauskunft' ? (
              <button type="button" className="sw-card__mini" onClick={() => onUpload?.(item)}>
                Hochladen
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function CleverChatMessage({ text, payload = {}, onCta = null }) {
  const hasCta = Boolean(payload.ctaLabel && onCta);
  const rawTitle = String(payload.title || 'Clever').replace(/^✨\s*/, '').trim() || 'Clever';
  return (
    <article className={`sw-card sw-card--clever${hasCta ? ' sw-card--clever-banner' : ''}`}>
      <div className="sw-card__clever-head">
        <span className="sw-card__clever-spark" aria-hidden>✨</span>
        <p className="sw-card__clever-label">{rawTitle}</p>
      </div>
      <p className="sw-card__text">{text}</p>
      {payload.sourceLabel ? (
        <p className="sw-card__source">{payload.sourceLabel}</p>
      ) : null}
      {hasCta ? (
        <button
          type="button"
          className="sw-card__cta sw-card__cta--clever"
          onClick={() => onCta(payload)}
        >
          {payload.ctaLabel}
          {' ›'}
        </button>
      ) : null}
    </article>
  );
}

export function StatusChatCard({ payload = {}, text }) {
  return (
    <article className="sw-card sw-card--status">
      <p className="sw-card__title">
        {payload.icon ? `${payload.icon} ` : ''}
        {payload.title || text}
      </p>
      {payload.fileName ? <p className="sw-card__meta">{payload.fileName}</p> : null}
      {payload.statusLabel ? (
        <p className="sw-card__status">✓ {payload.statusLabel}</p>
      ) : null}
    </article>
  );
}

export function AppointmentChatCard({
  payload = {},
  onConfirm = null,
  onChangeRequest = null,
}) {
  const proposed = payload.status === 'proposed' || payload.status === 'draft';
  return (
    <article className="sw-card sw-card--appointment">
      <p className="sw-card__eyebrow">Termin</p>
      <h3 className="sw-card__title">{payload.title || 'Termin'}</h3>
      {payload.vehicleLabel ? <p className="sw-card__meta">{payload.vehicleLabel}</p> : null}
      {payload.whenLabel ? <p className="sw-card__rate">{payload.whenLabel}</p> : null}
      {proposed ? (
        <div className="sw-card__cta-row">
          <button
            type="button"
            className="sw-card__cta"
            onClick={() => onConfirm?.(payload)}
          >
            {payload.ctaConfirm || 'Ja, passt'}
          </button>
          <button
            type="button"
            className="sw-card__link"
            onClick={() => onChangeRequest?.(payload)}
          >
            {payload.ctaChange || 'Anderen Termin vorschlagen'}
          </button>
        </div>
      ) : (
        <p className="sw-card__status">
          ✓
          {' '}
          {payload.statusLabel || 'bestätigt'}
        </p>
      )}
    </article>
  );
}

function TextBubble({ item }) {
  const isCustomer = Boolean(item.isCustomer);
  const isClever = Boolean(item.isClever);
  const initials = isClever ? '✨' : initialsFromLabel(item.senderLabel);

  return (
    <div
      className={`sw-bubble${isCustomer ? ' sw-bubble--customer' : ' sw-bubble--dealer'}${isClever ? ' sw-bubble--clever' : ''}`}
    >
      {!isCustomer ? (
        <span className={`sw-bubble__avatar${isClever ? ' sw-bubble__avatar--clever' : ''}`} aria-hidden>
          {initials}
        </span>
      ) : null}
      <div className="sw-bubble__content">
        <div className="sw-bubble__meta">
          <span className="sw-bubble__label">{item.senderLabel}</span>
          {item.timeLabel ? (
            <time className="sw-bubble__time">{item.timeLabel}</time>
          ) : null}
        </div>
        <div className="sw-bubble__body">
          <p className="sw-bubble__text">{item.text}</p>
        </div>
      </div>
      {isCustomer ? (
        <span className="sw-bubble__avatar sw-bubble__avatar--customer" aria-hidden>
          {initialsFromLabel(item.senderLabel === 'Sie' ? 'K' : item.senderLabel)}
        </span>
      ) : null}
    </div>
  );
}

export function WorkspaceChatItem({
  item,
  onOpenOffer,
  onUploadDocument,
  onStartSelfDisclosure,
  onConfirmAppointment = null,
  onChangeAppointment = null,
  onCleverAction = null,
}) {
  const kind = item.kind || MESSAGE_KIND.TEXT;

  if (kind === MESSAGE_KIND.OFFER_CARD) {
    return <OfferChatCard payload={item.payload} onOpen={onOpenOffer} />;
  }
  if (kind === MESSAGE_KIND.DOCUMENT_REQUEST) {
    return <DocumentRequestCard payload={item.payload} onUpload={onUploadDocument} />;
  }
  if (kind === MESSAGE_KIND.SELF_DISCLOSURE_CARD) {
    return <SelfDisclosureChatCard payload={item.payload} onStart={onStartSelfDisclosure} />;
  }
  if (kind === MESSAGE_KIND.CHECKLIST_CARD) {
    return (
      <ChecklistChatCard
        payload={item.payload}
        onUpload={onUploadDocument}
        onStartSa={onStartSelfDisclosure}
      />
    );
  }
  if (kind === MESSAGE_KIND.APPOINTMENT_CARD) {
    return (
      <AppointmentChatCard
        payload={item.payload}
        onConfirm={onConfirmAppointment}
        onChangeRequest={onChangeAppointment}
      />
    );
  }
  if (kind === MESSAGE_KIND.CLEVER_MESSAGE) {
    return (
      <CleverChatMessage
        text={item.text}
        payload={item.payload}
        onCta={onCleverAction}
      />
    );
  }
  if (kind === MESSAGE_KIND.SYSTEM_STATUS || kind === MESSAGE_KIND.DOCUMENT_CARD) {
    return <StatusChatCard payload={item.payload} text={item.text} />;
  }

  return <TextBubble item={item} />;
}
