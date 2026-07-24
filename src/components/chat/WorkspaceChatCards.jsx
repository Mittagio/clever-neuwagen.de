import { MESSAGE_KIND } from '../../services/crm/customerMessageService.js';

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

export function CleverChatMessage({ text, payload = {} }) {
  return (
    <article className="sw-card sw-card--clever">
      <p className="sw-card__clever-label">{payload.title || '✨ Clever'}</p>
      <p className="sw-card__text">{text}</p>
      {payload.sourceLabel ? (
        <p className="sw-card__source">{payload.sourceLabel}</p>
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

export function WorkspaceChatItem({
  item,
  onOpenOffer,
  onUploadDocument,
  onStartSelfDisclosure,
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
  if (kind === MESSAGE_KIND.CLEVER_MESSAGE) {
    return <CleverChatMessage text={item.text} payload={item.payload} />;
  }
  if (kind === MESSAGE_KIND.SYSTEM_STATUS || kind === MESSAGE_KIND.DOCUMENT_CARD) {
    return <StatusChatCard payload={item.payload} text={item.text} />;
  }

  return (
    <div className={`sw-bubble${item.isCustomer ? ' sw-bubble--customer' : ' sw-bubble--dealer'}`}>
      <span className="sw-bubble__label">{item.senderLabel}</span>
      <div className="sw-bubble__body">
        <p className="sw-bubble__text">{item.text}</p>
        {item.timeLabel ? <time className="sw-bubble__time">{item.timeLabel}</time> : null}
      </div>
    </div>
  );
}
