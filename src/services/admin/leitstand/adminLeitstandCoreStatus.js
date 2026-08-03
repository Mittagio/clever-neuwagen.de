/**
 * Phase 4 schlank – Admin-Leitstand Kernstatus.
 * Zeigt Zentrale warum Magic/OCR/Mail „hängt“ – ohne Secrets.
 */
import {
  isCleverContractOcrEnabled,
  resolveCleverOcrEnginePreference,
  resolveCleverOcrLang,
} from '../../cleverSeller/resolveCleverOcrProvider.js';

const API_HEALTH = '/api/v1/clever/shared-intelligence/health';

function viteEnv() {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  } catch {
    return {};
  }
}

function flagOn(value) {
  return value === true || /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

/**
 * Client-seitige Feature-Flags (nur booleans/labels – keine Keys).
 * @param {object} [env]
 */
export function readClientFeatureFlags(env = viteEnv()) {
  const magicMessage = flagOn(env?.VITE_CLEVER_MAGIC_MESSAGE_ENABLED)
    || flagOn(env?.VITE_CLEVER_SELLER_COPILOT_ENABLED);
  const sellerCopilot = flagOn(env?.VITE_CLEVER_SELLER_COPILOT_ENABLED);
  const sellerOpenAiInterpret = flagOn(env?.VITE_CLEVER_SELLER_OPENAI_INTERPRET_ENABLED);
  const lexiconAi = flagOn(env?.VITE_CLEVER_LEXICON_AI_ENABLED);
  const ocrEnabled = isCleverContractOcrEnabled(env);
  return {
    magicMessage,
    sellerCopilot,
    sellerOpenAiInterpret,
    lexiconAi,
    contractOcr: ocrEnabled,
    ocrEngine: resolveCleverOcrEnginePreference(env),
    ocrLang: resolveCleverOcrLang(env),
  };
}

/**
 * Server-Health ohne Secrets (openaiConfigured = boolean only).
 * @param {string} [origin]
 */
export async function probeMagicIntelligenceHealth(origin = '') {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const started = Date.now();
  try {
    const res = await fetch(`${base}${API_HEALTH}`, { method: 'GET' });
    const ms = Date.now() - started;
    if (!res.ok) {
      return {
        status: 'error',
        label: 'Magic/KI Health nicht erreichbar',
        detail: `HTTP ${res.status}`,
        latencyMs: ms,
        flags: null,
      };
    }
    const data = await res.json().catch(() => ({}));
    return {
      status: data.ok === false ? 'error' : 'ok',
      label: 'Magic/KI Health',
      detail: `${ms} ms`,
      latencyMs: ms,
      flags: {
        magicMessage: flagOn(data.magicMessage),
        sellerCopilot: flagOn(data.sellerCopilot),
        sellerOpenAiInterpret: flagOn(data.sellerOpenAiInterpret),
        lexiconAi: flagOn(data.lexiconAi),
        openaiConfigured: flagOn(data.openaiConfigured),
        contractOcr: flagOn(data.contractOcr),
      },
    };
  } catch (err) {
    return {
      status: 'error',
      label: 'Magic/KI offline',
      detail: err?.message ?? 'Netzwerkfehler',
      latencyMs: null,
      flags: null,
    };
  }
}

function statusFromBool(on, { warnWhenOff = false } = {}) {
  if (on) return 'ok';
  return warnWhenOff ? 'warn' : 'unknown';
}

/**
 * Letzte Clever-/OCR-/Dokument-Warnungen aus Store + Activity.
 * @param {{ cleverWarnings?: object[], activityFeed?: object[], systemIssues?: object[] }} sources
 * @param {number} [limit]
 */
export function collectCleverWarnings(sources = {}, limit = 8) {
  const fromStore = (sources.cleverWarnings ?? []).map((w) => ({
    id: w.id,
    kind: w.kind ?? 'clever',
    title: w.title ?? w.action ?? 'Clever-Warnung',
    detail: w.detail ?? null,
    severity: w.severity ?? 'warn',
    createdAt: w.createdAt,
    source: 'store',
  }));

  const fromFeed = (sources.activityFeed ?? [])
    .filter((e) => e.severity === 'urgent' || e.severity === 'warn')
    .filter((e) => {
      const blob = `${e.action ?? ''} ${e.detail ?? ''} ${e.entityType ?? ''}`.toLowerCase();
      return /ocr|scan|dokument|vertrag|magic|openai|fallback|mail|wltp|clever/i.test(blob);
    })
    .map((e) => ({
      id: e.id,
      kind: e.entityType ?? 'activity',
      title: e.action,
      detail: e.detail,
      severity: e.severity === 'urgent' ? 'error' : 'warn',
      createdAt: e.createdAt,
      source: 'activity',
    }));

  const fromIssues = (sources.systemIssues ?? [])
    .filter((i) => i.type === 'critical' || i.type === 'warning')
    .map((i) => ({
      id: i.id,
      kind: 'system',
      title: i.title,
      detail: i.detail,
      severity: i.type === 'critical' ? 'error' : 'warn',
      createdAt: i.createdAt ?? null,
      source: 'system',
    }));

  return [...fromStore, ...fromFeed, ...fromIssues]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

/**
 * Schlanker Kernstatus für Heute + System.
 */
export function buildLeitstandCoreStatus({
  clientFlags = null,
  magicHealth = null,
  mailOutbox = [],
  importMetrics = {},
  activityFeed = [],
  cleverWarnings = [],
  systemIssues = [],
} = {}) {
  const flags = clientFlags ?? readClientFeatureFlags();
  const server = magicHealth?.flags ?? null;

  const magicClientOn = flags.magicMessage || flags.sellerCopilot;
  const magicServerOn = server ? (server.magicMessage || server.sellerCopilot) : null;
  const openaiConfigured = server?.openaiConfigured;
  const magicEffective = magicServerOn ?? magicClientOn;

  let magicStatus = 'unknown';
  let magicDetail = 'Health wird geprüft …';
  if (magicHealth?.status === 'error') {
    magicStatus = 'error';
    magicDetail = `Ausfall · ${magicHealth.detail ?? 'Health offline'} · Fallback lokal`;
  } else if (server) {
    if (!magicEffective) {
      magicStatus = 'warn';
      magicDetail = 'Magic aus (Flag) · Verkäufer nutzt lokalen Fallback';
    } else if (openaiConfigured === false) {
      magicStatus = 'warn';
      magicDetail = 'Flag an, OpenAI nicht konfiguriert · Fallback';
    } else {
      magicStatus = 'ok';
      magicDetail = 'Magic/OpenAI bereit (ohne Key-Anzeige)';
    }
  } else if (magicClientOn) {
    magicStatus = 'ok';
    magicDetail = 'Client-Flag an · Server-Health ausstehend';
  } else {
    magicStatus = 'warn';
    magicDetail = 'Magic Client aus · lokaler Fallback';
  }

  const ocrServer = server?.contractOcr;
  const ocrOn = ocrServer ?? flags.contractOcr;
  const ocrStatus = ocrOn ? 'ok' : 'warn';
  const ocrDetail = ocrOn
    ? `an · Engine ${flags.ocrEngine} · ${flags.ocrLang}`
    : 'aus · Scans → manuell beschreiben';

  const failedMails = mailOutbox.filter((m) => m.status === 'failed').length;
  const queuedMails = mailOutbox.filter((m) => m.status === 'queued').length;
  const mailStatus = failedMails > 0 ? 'error' : queuedMails > 2 ? 'warn' : 'ok';
  const mailDetail = failedMails
    ? `${failedMails} fehlgeschlagen${queuedMails ? ` · ${queuedMails} wartend` : ''}`
    : queuedMails
      ? `${queuedMails} in Warteschlange`
      : 'keine Fehler';

  const warnings = collectCleverWarnings({ cleverWarnings, activityFeed, systemIssues }, 8);
  const warnStatus = warnings.some((w) => w.severity === 'error')
    ? 'error'
    : warnings.length
      ? 'warn'
      : 'ok';

  const pendingImports = importMetrics.pending ?? 0;
  const priceStatus = pendingImports > 0 ? 'warn' : importMetrics.lastUpdate ? 'ok' : 'unknown';
  const priceDetail = pendingImports > 0
    ? `${pendingImports} Import(e) offen`
    : importMetrics.lastUpdate
      ? `letzter Stand ${new Date(importMetrics.lastUpdate).toLocaleString('de-DE')}`
      : 'kein Import-Stand';

  const signals = [
    {
      id: 'magic',
      label: 'Magic / OpenAI',
      status: magicStatus,
      detail: magicDetail,
      href: '/admin/system#kern',
    },
    {
      id: 'ocr',
      label: 'OCR / Dokumente',
      status: ocrStatus,
      detail: ocrDetail,
      href: '/admin/system#kern',
    },
    {
      id: 'mail',
      label: 'Mail-Outbox',
      status: mailStatus,
      detail: mailDetail,
      href: '/admin/system#mail',
    },
    {
      id: 'warnings',
      label: 'Clever-Warnungen',
      status: warnStatus,
      detail: warnings.length ? `${warnings.length} zuletzt` : 'keine',
      href: '/admin/system#warnungen',
    },
    {
      id: 'prices',
      label: 'Preislisten',
      status: priceStatus,
      detail: priceDetail,
      href: '/admin/daten',
    },
  ];

  const flagItems = [
    {
      id: 'flag-magic',
      label: 'Magic Message',
      status: statusFromBool(magicEffective, { warnWhenOff: true }),
      detail: magicEffective ? 'an' : 'aus',
    },
    {
      id: 'flag-copilot',
      label: 'Seller Copilot',
      status: statusFromBool(server?.sellerCopilot ?? flags.sellerCopilot, { warnWhenOff: true }),
      detail: (server?.sellerCopilot ?? flags.sellerCopilot) ? 'an' : 'aus',
    },
    {
      id: 'flag-interpret',
      label: 'OpenAI Interpret',
      status: statusFromBool(server?.sellerOpenAiInterpret ?? flags.sellerOpenAiInterpret, { warnWhenOff: true }),
      detail: (server?.sellerOpenAiInterpret ?? flags.sellerOpenAiInterpret) ? 'an' : 'aus',
    },
    {
      id: 'flag-ocr',
      label: 'Contract OCR',
      status: ocrStatus,
      detail: ocrDetail,
    },
    {
      id: 'flag-openai',
      label: 'OpenAI konfiguriert',
      status: openaiConfigured === true
        ? 'ok'
        : openaiConfigured === false
          ? 'warn'
          : 'unknown',
      detail: openaiConfigured === true
        ? 'ja (Key nicht sichtbar)'
        : openaiConfigured === false
          ? 'nein · Fallback'
          : 'unbekannt',
    },
  ];

  const overall = signals.some((s) => s.status === 'error')
    ? 'error'
    : signals.some((s) => s.status === 'warn')
      ? 'warn'
      : 'ok';

  return {
    overall,
    signals,
    flagItems,
    warnings,
    flags,
    magicHealth,
  };
}
