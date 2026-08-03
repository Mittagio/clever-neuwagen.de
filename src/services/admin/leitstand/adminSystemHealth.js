import { isMailProductionReady } from '../../mail/mailConfig.js';
import { getActiveTransportLabel } from '../../mail/mailTransport.js';
import {
  buildLeitstandCoreStatus,
  probeMagicIntelligenceHealth,
  readClientFeatureFlags,
} from './adminLeitstandCoreStatus.js';
import { buildPriceListCareStatus } from './buildPriceListCareStatus.js';

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

export { probeMagicIntelligenceHealth, readClientFeatureFlags, buildLeitstandCoreStatus };

export function buildSystemHealthModel({
  apiHealth = null,
  magicHealth = null,
  mailOutbox = [],
  importMetrics = {},
  systemIssues = [],
  activityFeed = [],
  cleverWarnings = [],
  clientFlags = null,
  priceListCare = null,
} = {}) {
  const failedMails = mailOutbox.filter((m) => m.status === 'failed').length;
  const queuedMails = mailOutbox.filter((m) => m.status === 'queued').length;
  const lastMail = mailOutbox[0] ?? null;
  const criticalIssues = systemIssues.filter((i) => i.type === 'critical').length;

  const mailStatus = failedMails > 0 ? 'error' : queuedMails > 2 ? 'warn' : 'ok';
  const apiStatus = apiHealth?.status === 'ok' ? 'ok' : apiHealth ? 'error' : 'unknown';
  const care = priceListCare ?? buildPriceListCareStatus({ importMetrics });

  const core = buildLeitstandCoreStatus({
    clientFlags,
    magicHealth,
    mailOutbox,
    importMetrics,
    activityFeed,
    cleverWarnings,
    systemIssues,
    priceListCare: care,
  });

  const magicSignal = core.signals.find((s) => s.id === 'magic');
  const ocrSignal = core.signals.find((s) => s.id === 'ocr');

  return {
    core,
    priceListCare: care,
    sections: [
      {
        id: 'flags',
        title: 'Feature-Flags · Magic + OCR',
        items: core.flagItems,
      },
      {
        id: 'mail',
        title: 'Mail',
        items: [
          {
            id: 'smtp',
            label: 'SMTP / Versand',
            status: mailStatus === 'error' ? 'error' : mailStatus,
            detail: failedMails
              ? `${failedMails} Fehler`
              : `${getActiveTransportLabel()}${isMailProductionReady() ? '' : ' (nicht produktiv)'}`,
          },
          {
            id: 'last-mail',
            label: 'Letzte Mail',
            status: lastMail ? (lastMail.status === 'failed' ? 'error' : 'ok') : 'unknown',
            detail: lastMail ? `${lastMail.subject} → ${lastMail.to}` : '–',
          },
          {
            id: 'queue',
            label: 'Queue',
            status: queuedMails > 2 ? 'warn' : 'ok',
            detail: `${queuedMails} in Warteschlange`,
          },
        ],
      },
      {
        id: 'ai',
        title: 'KI / Magic',
        items: [
          {
            id: 'openai',
            label: 'OpenAI / Magic',
            status: magicSignal?.status ?? 'unknown',
            detail: magicSignal?.detail ?? '–',
          },
          {
            id: 'ocr',
            label: 'OCR / Dokumente',
            status: ocrSignal?.status ?? 'unknown',
            detail: ocrSignal?.detail ?? '–',
          },
          {
            id: 'health-latency',
            label: 'Magic-Health',
            status: magicHealth?.status === 'ok' ? 'ok' : magicHealth ? 'error' : 'unknown',
            detail: magicHealth?.detail ?? 'Wird geprüft …',
          },
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
        title: 'Preislisten / Datenpflege',
        items: care.items,
      },
      {
        id: 'website',
        title: 'Website',
        items: [
          { id: 'landing', label: 'Landingpage', status: 'ok', detail: 'Online' },
          { id: 'portal', label: 'Händlerportal', status: 'ok', detail: 'Online' },
          {
            id: 'login',
            label: 'Login / Codes',
            status: criticalIssues ? 'warn' : 'ok',
            detail: criticalIssues ? `${criticalIssues} Systemwarnung(en)` : 'Stabil',
          },
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
