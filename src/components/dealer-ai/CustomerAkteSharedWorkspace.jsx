import { useMemo, useState } from 'react';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import { buildSharedWorkspaceTimeline } from '../../services/crm/sharedWorkspaceService.js';
import { sendCleverChannelMessage } from '../../services/crm/customerMessageService.js';

/**
 * Verkäufer-Sicht: gleicher Conversation-Verlauf wie im Kundenportal.
 */
export default function CustomerAkteSharedWorkspace({
  lead,
  customerName = '',
  onPersistLead = null,
  isSaving = false,
}) {
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);

  const timeline = useMemo(
    () => buildSharedWorkspaceTimeline(lead, { role: 'seller' }),
    [lead],
  );

  function handleSend(text) {
    if (!text || sending) return;
    setSending(true);
    try {
      const result = sendCleverChannelMessage({
        lead,
        text,
        createdByName: 'Verkäufer',
      });
      if (!result.message) {
        setFeedback('Nachricht konnte nicht gesendet werden.');
        return;
      }
      onPersistLead?.(result.lead, {
        historyText: 'Nachricht im gemeinsamen Arbeitsraum gesendet',
      });
      setDraft('');
      setFeedback('Gesendet');
      setTimeout(() => setFeedback(''), 2500);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="cust-akte-workspace" aria-label="Gemeinsamer Arbeitsraum">
      <header className="cust-akte-workspace__header">
        <h2 className="cust-akte-workspace__title">{timeline.header?.title || customerName}</h2>
        {timeline.header?.subtitle ? (
          <p className="cust-akte-workspace__sub">{timeline.header.subtitle}</p>
        ) : null}
        <p className="cust-akte-workspace__tabs" aria-label="Status">
          <span>Chat</span>
          <span>
            Angebote
            {' '}
            {timeline.progress?.offerCount ?? 0}
          </span>
          <span>
            Unterlagen
            {' '}
            {timeline.progress?.documentsLabel ?? '0/0'}
          </span>
          <span>
            Selbstauskunft
            {timeline.progress?.selfDisclosureOpen ? ' •' : ''}
          </span>
        </p>
      </header>
      <SharedWorkspaceChat
        role="seller"
        items={timeline.items}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={sending || isSaving}
        sendFeedback={feedback}
        placeholder={`Was möchten Sie ${customerName || 'dem Kunden'} schreiben?`}
        micSlot={(
          <DealerAiInlineMic
            variant="fab"
            disabled={sending || isSaving}
            onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))}
          />
        )}
        plusActions={[
          { id: 'file', icon: '📄', label: 'Datei senden', onClick: () => setFeedback('Datei über Unterlagen-Sheet senden') },
          { id: 'offer', icon: '🚗', label: 'Angebot', onClick: () => setFeedback('Angebot über Clever vorbereiten') },
          { id: 'sa', icon: '✍️', label: 'Formular', onClick: () => setDraft('Schick ihm bitte die Selbstauskunft.') },
          { id: 'req', icon: '📎', label: 'Anfordern', onClick: () => setDraft('Schreib ihm, dass noch Unterlagen fehlen.') },
        ]}
        emptyHint="Noch kein Verlauf. Clever kann Nachricht + Unterlagen gemeinsam vorbereiten."
      />
    </section>
  );
}
