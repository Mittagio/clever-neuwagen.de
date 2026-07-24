import SharedWorkspaceChat from '../chat/SharedWorkspaceChat.jsx';

/**
 * Kundenportal – Chat-Tab = Shared Workspace (kein paralleler Messenger).
 */
export default function CustomerPortalMessagesSection({
  items = [],
  threads = [],
  draft = '',
  onDraftChange,
  onSend,
  sending = false,
  sendFeedback = '',
  onOpenOffer,
  onUploadDocument,
  onStartSelfDisclosure,
  plusActions = [],
  dealerName = 'Autohaus',
}) {
  const timelineItems = items.length
    ? items
    : threads.flatMap((thread) => thread.messages ?? []);

  return (
    <SharedWorkspaceChat
      role="customer"
      items={timelineItems}
      draft={draft}
      onDraftChange={onDraftChange}
      onSend={onSend}
      sending={sending}
      sendFeedback={sendFeedback}
      placeholder={`Nachricht an ${dealerName} …`}
      composerLabel={`Nachricht an ${dealerName}`}
      onOpenOffer={onOpenOffer}
      onUploadDocument={onUploadDocument}
      onStartSelfDisclosure={onStartSelfDisclosure}
      plusActions={plusActions}
      emptyHint="Noch keine Nachrichten. Fragen Sie hier nach Ihrem Angebot oder laden Sie Unterlagen hoch."
    />
  );
}
