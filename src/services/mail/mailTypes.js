export const MAIL_STATUS = {
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed',
};

export const MAIL_STATUS_UI = {
  [MAIL_STATUS.QUEUED]: { label: 'Wartend', emoji: '⏳' },
  [MAIL_STATUS.SENT]: { label: 'Versendet', emoji: '✅' },
  [MAIL_STATUS.FAILED]: { label: 'Fehlgeschlagen', emoji: '❌' },
};
