import { useEffect, useMemo, useRef, useState } from 'react';
import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import SellerInlineAssistCard from './SellerInlineAssistCard.jsx';
import { buildSharedWorkspaceTimeline } from '../../services/crm/sharedWorkspaceService.js';
import { sendCleverChannelMessage } from '../../services/crm/customerMessageService.js';
import {
  insertInlineFactIntoDraft,
  runSellerInlineAssist,
} from '../../services/dealer/sellerInlineComposerAssist.js';
import { sendSellerWorkspacePackage } from '../../services/crm/sharedWorkspaceService.js';
import { formatCustomerDisplayName } from '../../services/dealerAiParser.js';

const DEBOUNCE_MS = 380;

/**
 * Verkäufer-Sicht: gemeinsamer Conversation-Verlauf + ein Composer (inkl. Clever Inline).
 * Chips / Tab-Leisten leben in der Akte-Shell – hier nur die Arbeitsfläche Chat.
 */
export default function CustomerAkteSharedWorkspace({
  lead,
  customerName = '',
  onPersistLead = null,
  isSaving = false,
  cleverMode = false,
  focusToken = 0,
  onOpenOffer = null,
  onUploadDocument = null,
  onStartSelfDisclosure = null,
}) {
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [assist, setAssist] = useState(null);
  const debounceRef = useRef(null);
  const composerInputRef = useRef(null);

  const timeline = useMemo(
    () => buildSharedWorkspaceTimeline(lead, { role: 'seller' }),
    [lead],
  );

  const displayName = formatCustomerDisplayName(customerName) || 'dem Kunden';

  const placeholder = cleverMode
    ? `Was soll Clever für ${displayName} erledigen?`
    : `Nachricht an ${displayName} …`;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const text = String(draft ?? '').trim();
    if (text.length < 3) {
      setAssist(null);
      return undefined;
    }
    debounceRef.current = setTimeout(() => {
      const result = runSellerInlineAssist(lead, text);
      setAssist(result.ok ? result : null);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, lead]);

  useEffect(() => {
    if (!focusToken) return;
    const el = document.getElementById('sw-composer-seller');
    if (!el) return;
    el.focus?.();
    composerInputRef.current = el;
  }, [focusToken, cleverMode]);

  function persistMessages(nextLead, historyText) {
    onPersistLead?.(nextLead, { historyText });
  }

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
      persistMessages(result.lead, 'Nachricht im gemeinsamen Arbeitsraum gesendet');
      setDraft('');
      setAssist(null);
      setFeedback('Gesendet');
      setTimeout(() => setFeedback(''), 2500);
    } finally {
      setSending(false);
    }
  }

  function handleInsertFact(result) {
    const insert = result.insertText || result.body;
    setDraft((prev) => insertInlineFactIntoDraft(prev, insert));
    setFeedback('Fakt übernommen');
    setTimeout(() => setFeedback(''), 2000);
  }

  function handleUseVerified(result) {
    const verified = result.verified;
    setDraft((prev) => {
      let next = String(prev ?? '');
      if (result.claimed != null) {
        next = next.replace(
          new RegExp(String(result.claimed), 'g'),
          String(verified),
        );
      }
      return insertInlineFactIntoDraft(next, result.insertText || '');
    });
    setAssist(null);
    setFeedback('Verifizierten Wert übernommen');
    setTimeout(() => setFeedback(''), 2200);
  }

  function handlePrepareReply(result) {
    if (result.insertText) {
      setDraft((prev) => insertInlineFactIntoDraft(prev, result.insertText));
      setAssist(null);
      return;
    }
    handleInsertFact(result);
  }

  function handleSendDraft(result) {
    const body = result.draft?.body || result.body;
    if (body) handleSend(body);
  }

  function handleSendActions(result) {
    setSending(true);
    try {
      const sent = sendSellerWorkspacePackage({
        lead,
        body: result.draft?.body || result.body,
        actions: result.actions || [],
        createdByName: 'Verkäufer',
      });
      if (!sent.ok) {
        setFeedback('Paket konnte nicht gesendet werden.');
        return;
      }
      persistMessages(sent.lead, 'Workspace-Paket gesendet');
      setDraft('');
      setAssist(null);
      setFeedback('Gesendet');
      setTimeout(() => setFeedback(''), 2500);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="cust-akte-workspace cust-akte-workspace--chat-only" aria-label="Gemeinsamer Arbeitsraum">
      <SharedWorkspaceChat
        role="seller"
        items={timeline.items}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={sending || isSaving}
        sendFeedback={feedback}
        placeholder={placeholder}
        onOpenOffer={onOpenOffer}
        onUploadDocument={onUploadDocument}
        onStartSelfDisclosure={onStartSelfDisclosure}
        reviewSlot={(
          <SellerInlineAssistCard
            results={assist?.results ?? []}
            onInsertFact={handleInsertFact}
            onUseVerified={handleUseVerified}
            onPrepareReply={handlePrepareReply}
            onSendDraft={handleSendDraft}
            onSendActions={handleSendActions}
            onDismiss={() => setAssist(null)}
          />
        )}
        micSlot={(
          <DealerAiInlineMic
            variant="fab"
            disabled={sending || isSaving}
            onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))}
          />
        )}
        plusActions={[
          {
            id: 'file',
            icon: '📄',
            label: 'Datei senden',
            onClick: () => onUploadDocument?.(),
          },
          {
            id: 'offer',
            icon: '🚗',
            label: 'Angebot',
            onClick: () => setDraft((prev) => (prev ? prev : 'Mach dem Kunden ein Angebot.')),
          },
          {
            id: 'sa',
            icon: '✍️',
            label: 'Formular',
            onClick: () => setDraft('Schick ihm bitte die Selbstauskunft.'),
          },
          {
            id: 'req',
            icon: '📎',
            label: 'Anfordern',
            onClick: () => setDraft('Schreib ihm, dass noch Unterlagen fehlen.'),
          },
        ]}
        emptyHint="Noch kein Verlauf. Tippen oder sprechen – Clever nutzt denselben Kundenkontext wie die Chips oben."
      />
    </section>
  );
}
