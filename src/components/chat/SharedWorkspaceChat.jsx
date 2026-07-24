import { useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceChatItem } from './WorkspaceChatCards.jsx';
import './SharedWorkspaceChat.css';

/**
 * Gemeinsamer Clever-Arbeitsraum – Chat als Vorgang (Kunde & Verkäufer).
 */
export default function SharedWorkspaceChat({
  role = 'customer',
  items = [],
  draft = '',
  onDraftChange,
  onSend,
  sending = false,
  sendFeedback = '',
  placeholder = '',
  composerLabel = '',
  onOpenOffer,
  onUploadDocument,
  onStartSelfDisclosure,
  onPlusAction,
  plusSheetOpen = false,
  plusActions = [],
  onClosePlus,
  micSlot = null,
  reviewSlot = null,
  emptyHint = 'Noch keine Nachrichten. Schreiben Sie die erste Nachricht.',
}) {
  const endRef = useRef(null);
  const [localPlus, setLocalPlus] = useState(false);
  const showPlus = plusSheetOpen || localPlus;

  const count = items.length;
  useEffect(() => {
    if (!count) return;
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [count, sendFeedback]);

  const resolvedPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    return role === 'seller'
      ? 'Was möchten Sie dem Kunden schreiben?'
      : 'Nachricht an Ihr Autohaus …';
  }, [placeholder, role]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    onSend?.(draft.trim());
  }

  function openPlus() {
    if (onPlusAction) {
      onPlusAction('open');
      return;
    }
    setLocalPlus(true);
  }

  function closePlus() {
    onClosePlus?.();
    setLocalPlus(false);
  }

  return (
    <section className={`sw-chat sw-chat--${role}`} aria-label="Gemeinsamer Arbeitsraum">
      <div className="sw-chat__feed">
        {!items.length ? (
          <p className="sw-chat__empty">{emptyHint}</p>
        ) : (
          <ul className="sw-chat__list">
            {items.map((item) => (
              <li key={item.id} className="sw-chat__item">
                <WorkspaceChatItem
                  item={item}
                  onOpenOffer={onOpenOffer}
                  onUploadDocument={onUploadDocument}
                  onStartSelfDisclosure={onStartSelfDisclosure}
                />
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} aria-hidden="true" />
      </div>

      {reviewSlot}

      {showPlus && plusActions.length > 0 ? (
        <div className="sw-plus-sheet" role="dialog" aria-label="Aktionen">
          <div className="sw-plus-sheet__grid">
            {plusActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="sw-plus-sheet__btn"
                onClick={() => {
                  action.onClick?.();
                  closePlus();
                }}
              >
                <span className="sw-plus-sheet__icon" aria-hidden>{action.icon || '•'}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="sw-plus-sheet__close" onClick={closePlus}>
            Schließen
          </button>
        </div>
      ) : null}

      <form className="sw-composer" onSubmit={handleSubmit}>
        {composerLabel ? (
          <label className="sw-composer__label" htmlFor={`sw-composer-${role}`}>
            {composerLabel}
          </label>
        ) : null}
        <div className="sw-composer__row">
          <button
            type="button"
            className="sw-composer__plus"
            aria-label="Mehr Aktionen"
            onClick={openPlus}
          >
            +
          </button>
          <textarea
            id={`sw-composer-${role}`}
            className="sw-composer__input"
            rows={2}
            value={draft}
            onChange={(e) => onDraftChange?.(e.target.value)}
            placeholder={resolvedPlaceholder}
            disabled={sending}
          />
          {micSlot}
          <button
            type="submit"
            className="sw-composer__send"
            disabled={sending || !draft.trim()}
            aria-label="Senden"
          >
            ➤
          </button>
        </div>
        {sendFeedback ? (
          <p className="sw-composer__feedback" role="status">{sendFeedback}</p>
        ) : null}
      </form>
    </section>
  );
}
