/** Sicherheits-Grundlagen (Sprint 5 – Vorbereitung Livebetrieb) */

export const SECURITY_BASELINE = [
  {
    id: 'https',
    label: 'HTTPS only',
    status: 'ready',
    detail: 'Let\'s Encrypt via nginx – siehe DEPLOY.md',
  },
  {
    id: 'encryption',
    label: 'Dateiverschlüsselung (Tresor)',
    status: 'optional',
    detail: 'AES-256-GCM wenn DOCUMENT_ENCRYPTION_KEY gesetzt (≥32 Zeichen)',
  },
  {
    id: 'login-limits',
    label: 'Login-Limits',
    status: 'planned',
    detail: 'Rate-Limiting für /backend – Sprint 6',
  },
  {
    id: 'session-timeout',
    label: 'Session-Timeout',
    status: 'planned',
    detail: '30 Min. Inaktivität – mit Auth-Rollout',
  },
  {
    id: '2fa',
    label: '2FA',
    status: 'planned',
    detail: 'TOTP für Admin/Verkäufer – Vorbereitung im Rollenmodell',
  },
  {
    id: 'document-ttl',
    label: 'Dokumenten-Auto-Löschung',
    status: 'active',
    detail: '48 Stunden – serverseitig, physisch gelöscht',
  },
];

export const SECURITY_STATUS_LABELS = {
  active: 'Aktiv',
  ready: 'Bereit',
  optional: 'Optional',
  planned: 'Geplant',
};
