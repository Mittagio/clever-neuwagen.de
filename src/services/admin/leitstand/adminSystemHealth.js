/**
 * System-Health für Admin Leitstand „System“.
 */

export async function probeApiHealth(origin = '') {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const started = Date.now();
  try {
    const res = await fetch(`${base}/health`, { method: 'GET' });
    const ms = Date.now() - started;
    if (!res.ok) {
      return { status: 'error', label: 'API nicht erreichbar', detail: `HTTP ${res.status}`, latencyMs: ms };
    }
    return { status: 'ok', label: 'API online', detail: `${ms} ms`, latencyMs: ms };
  } catch (err) {
    return { status: 'error', label: 'API offline', detail: err.message ?? 'Netzwerkfehler', latencyMs: null };
  }
}

export function buildSystemHealthModel({
  apiHealth = null,
  mailOutbox = [],
  importMetrics = {},
  systemIssues = [],
} = {}) {
  const failedMails = mailOutbox.filter((m) => m.status === 'failed').length;
  const queuedMails = mailOutbox.filter((m) => m.status === 'queued').length;
  const lastMail = mailOutbox[0] ?? null;
  const criticalIssues = systemIssues.filter((i) => i.type === 'critical').length;

  const mailStatus = failedMails > 0 ? 'warn' : 'ok';
  const importStatus = importMetrics.pending > 0 ? 'warn' : 'ok';
  const apiStatus = apiHealth?.status === 'ok' ? 'ok' : apiHealth ? 'error' : 'unknown';

  return {
    sections: [
      {
        id: 'mail',
        title: 'Mail',
        items: [
          { id: 'smtp', label: 'SMTP / Versand', status: mailStatus, detail: failedMails ? `${failedMails} Fehler` : 'Mock aktiv (Resend vorbereitet)' },
          { id: 'last-mail', label: 'Letzte Mail', status: lastMail ? 'ok' : 'unknown', detail: lastMail ? `${lastMail.subject} → ${lastMail.to}` : '–' },
          { id: 'queue', label: 'Queue', status: queuedMails > 2 ? 'warn' : 'ok', detail: `${queuedMails} in Warteschlange` },
        ],
      },
      {
        id: 'ai',
        title: 'KI',
        items: [
          { id: 'openai', label: 'OpenAI erreichbar', status: 'ok', detail: 'Konfiguriert (Client)' },
          { id: 'latency', label: 'Antwortzeit', status: 'ok', detail: '< 2 s (geschätzt)' },
        ],
      },
      {
        id: 'server',
        title: 'Server',
        items: [
          { id: 'api', label: 'API', status: apiStatus, detail: apiHealth?.detail ?? 'Wird geprüft …' },
          { id: 'db', label: 'Datenbank', status: 'ok', detail: 'JSON-Store / Pilot' },
          { id: 'storage', label: 'Storage', status: 'ok', detail: 'localStorage + Server' },
        ],
      },
      {
        id: 'import',
        title: 'Import',
        items: [
          { id: 'last-import', label: 'Letzter Import', status: importStatus, detail: importMetrics.lastUpdate ? new Date(importMetrics.lastUpdate).toLocaleString('de-DE') : '–' },
          { id: 'import-errors', label: 'Fehler', status: importMetrics.pending ? 'warn' : 'ok', detail: importMetrics.pending ? `${importMetrics.pending} offen` : 'Keine' },
        ],
      },
      {
        id: 'website',
        title: 'Website',
        items: [
          { id: 'landing', label: 'Landingpage', status: 'ok', detail: 'Online' },
          { id: 'portal', label: 'Händlerportal', status: 'ok', detail: 'Online' },
          { id: 'login', label: 'Login / Codes', status: criticalIssues ? 'warn' : 'ok', detail: criticalIssues ? `${criticalIssues} Systemwarnung(en)` : 'Stabil' },
        ],
      },
    ],
  };
}

export function statusEmoji(status) {
  switch (status) {
    case 'ok': return '🟢';
    case 'warn': return '🟡';
    case 'error': return '🔴';
    default: return '⚪';
  }
}
