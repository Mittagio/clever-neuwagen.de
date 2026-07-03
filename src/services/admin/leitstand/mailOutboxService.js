/**
 * Admin-Leitstand Mail-Outbox – Kompatibilitäts-Re-Export.
 * Neue Implementierung: src/services/mail/
 */
export {
  MAIL_FROM,
  MAIL_STATUS as MAIL_OUTBOX_STATUS,
  MAIL_STATUS_UI,
  MAIL_TEMPLATE_IDS,
  listMailOutbox,
  countFailedMails,
  countQueuedMails,
  sendViaOutbox,
  sendTemplatedMail,
  retryMail,
  getMailOutboxStats,
  getActiveTransportLabel,
  loadMailOutboxForAdmin,
  getOutboxSource,
  getUnifiedOutboxSnapshot,
  subscribeUnifiedOutbox,
  OUTBOX_SOURCE,
} from '../../mail/mailOutboxService.js';

export { listMailTemplates } from '../../mail/mailTemplateRegistry.js';
