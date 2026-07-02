import { useMemo, useRef, useEffect } from 'react';

export default function CustomerPortalMessagesSection({
  threads = [],
  draft = '',
  onDraftChange,
  onSend,
  sending = false,
  sendFeedback = '',
}) {
  const chatEndRef = useRef(null);
  const hasMessages = threads.some((thread) => thread.messages?.length > 0);
  const singleThread = threads.length === 1;
  const totalCount = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.messages?.length ?? 0), 0),
    [threads],
  );

  useEffect(() => {
    if (!hasMessages) return;
    chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [hasMessages, totalCount, sendFeedback]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    onSend?.(draft.trim());
  }

  return (
    <section className="cop-messages" aria-label="Ihre Nachrichten">
      <header className="cop-messages__header">
        <h2 className="cop-messages__title">Ihre Nachrichten</h2>
        <p className="cop-messages__subline">
          Fragen und Antworten zu Ihrer Fahrzeugauswahl.
        </p>
      </header>

      {!hasMessages ? (
        <p className="cop-messages__empty">
          Noch keine Nachrichten vorhanden.
          <span className="cop-messages__empty-hint">
            Sie können dem Autohaus hier eine Frage stellen.
          </span>
        </p>
      ) : (
        <div className="cop-messages__threads">
          {threads.map((thread) => (
            <div key={thread.id} className="cop-messages__thread">
              {!singleThread && thread.title ? (
                <h3 className="cop-messages__thread-title">{thread.title}</h3>
              ) : null}
              <ul className="cop-messages__chat" aria-label={thread.title || 'Nachrichtenverlauf'}>
                {thread.messages.map((message) => (
                  <li
                    key={message.id}
                    className={`cop-msg${message.isCustomer ? ' cop-msg--customer' : ' cop-msg--dealer'}`}
                  >
                    <span className="cop-msg__label">{message.senderLabel}</span>
                    <div className="cop-msg__bubble">
                      <p className="cop-msg__text">{message.text}</p>
                      {message.timeLabel ? (
                        <time className="cop-msg__time" dateTime={message.createdAt}>
                          {message.timeLabel}
                        </time>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div ref={chatEndRef} className="cop-messages__anchor" aria-hidden="true" />
        </div>
      )}

      <form className="cop-messages__compose" onSubmit={handleSubmit}>
        <label className="cop-messages__compose-label" htmlFor="cop-portal-message">
          Ihre Nachricht an das Autohaus
        </label>
        <textarea
          id="cop-portal-message"
          className="cop-textarea cop-messages__textarea"
          rows={4}
          placeholder="Ihre Nachricht an das Autohaus …"
          value={draft}
          onChange={(event) => onDraftChange?.(event.target.value)}
          disabled={sending}
        />
        <div className="cop-messages__compose-actions">
          <button
            type="submit"
            className="cop-btn cop-btn--primary cop-messages__send"
            disabled={sending || !draft.trim()}
          >
            {sending ? 'Wird gesendet …' : 'Nachricht senden'}
          </button>
        </div>
        {sendFeedback ? (
          <p className="cop-messages__feedback" role="status">{sendFeedback}</p>
        ) : null}
      </form>
    </section>
  );
}
