/**
 * Preisliste als digitale Verkaufstheke.
 * Öffnen = Gesprächssignal, kein Kundenwunsch / kein needProfile.
 */
import { getKiaPdfPriceList } from '../../data/kia/kiaPriceListRegistry.js';
import {
  KIA_PDF_SOURCE_CATALOG,
  KIA_MODELS_PENDING_PDF,
  buildKiaPdfDownloadUrl,
  resolveKiaModelKey,
} from '../../data/technical/brands/kia/pdfSourceCatalog.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

export const PRICE_LIST_VIEWED_TYPE = 'price_list_viewed';
export const PRICE_LIST_FOLLOW_UP_QUESTION_ID = 'price_list_follow_up';
const CLEVER_TURN = 'clever';

export const PRICE_LIST_FOLLOW_UP_STATUS = {
  PENDING: 'pending',
  SHOWN: 'shown',
  RESOLVED: 'resolved',
};

export const PRICE_LIST_FOLLOW_UP_OPTIONS = [
  { id: 'equipment', label: 'Ausstattung' },
  { id: 'powertrain', label: 'Motorisierung' },
  { id: 'price', label: 'Preis' },
  { id: 'nothing', label: 'Noch nicht' },
];

const FOLLOW_UP_CUSTOMER_MESSAGES = {
  equipment: 'In der Preisliste ist mir eine Ausstattung aufgefallen, die interessant wäre.',
  powertrain: 'In der Preisliste ist mir eine Motorisierung aufgefallen, die interessant wäre.',
  price: 'Zum Preis aus der Preisliste hätte ich noch eine Frage.',
  nothing: 'In der Preisliste war nichts Besonderes dabei.',
};

function normalizeModelKey(modelKey = '') {
  return resolveKiaModelKey(String(modelKey ?? '').toLowerCase().replace(/^kia-/, '').trim());
}

function stemFromSourceFile(sourceFile = '') {
  return String(sourceFile).replace(/\.pdf$/i, '').trim();
}

function formatDocumentStand(isoOrDate = '') {
  const raw = String(isoOrDate ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function modelDisplayLabel(modelKey) {
  const key = normalizeModelKey(modelKey);
  const attrs = KIA_MODEL_ATTRIBUTES[key];
  if (attrs?.label) return attrs.label;
  const catalog = getKiaPdfPriceList(key);
  if (catalog?.model) return catalog.model;
  return key.toUpperCase();
}

/**
 * Verifizierte Preisliste für ein Modell (nur offizielle Quellen).
 * @param {string} modelKey
 * @returns {object|null}
 */
export function resolveVerifiedPriceListDocument(modelKey) {
  const key = normalizeModelKey(modelKey);
  if (!key) return null;

  const importEntry = getKiaPdfPriceList(key);
  const catalogEntry = KIA_PDF_SOURCE_CATALOG.find((e) => e.modelKey === key)
    ?? (importEntry?.sourceFile
      ? KIA_PDF_SOURCE_CATALOG.find((e) => e.stem === stemFromSourceFile(importEntry.sourceFile))
      : null);

  let downloadUrl = catalogEntry?.downloadUrl ?? null;
  let stem = catalogEntry?.stem ?? null;
  let sourceFile = importEntry?.sourceFile ?? (stem ? `${stem}.pdf` : null);

  if (!downloadUrl && importEntry?.sourceFile) {
    stem = stemFromSourceFile(importEntry.sourceFile);
    downloadUrl = buildKiaPdfDownloadUrl(stem);
    sourceFile = importEntry.sourceFile;
  }

  if (!downloadUrl) {
    const pending = KIA_MODELS_PENDING_PDF.find((e) => e.modelKey === key && e.downloadUrl);
    if (pending) {
      downloadUrl = pending.downloadUrl;
      stem = pending.stem ?? null;
      sourceFile = stem ? `${stem}.pdf` : null;
    }
  }

  if (!downloadUrl) return null;

  const documentDate = importEntry?.importedAt ?? null;
  const standLabel = formatDocumentStand(documentDate);

  return {
    brandKey: 'kia',
    modelKey: key,
    modelLabel: importEntry?.model ?? catalogEntry?.model ?? modelDisplayLabel(key),
    documentType: 'price_list',
    market: 'DE',
    documentId: sourceFile || stem || key,
    sourceFile,
    sourceUrl: downloadUrl,
    sourceTitle: `Kia ${importEntry?.model ?? catalogEntry?.model ?? modelDisplayLabel(key)} Preisliste`,
    documentDate,
    standLabel,
    verificationStatus: importEntry ? 'verified' : 'official_source',
    priceListSource: importEntry?.priceListSource
      ?? 'Kia Deutschland GmbH – offizielle Preisliste PDF',
    outdated: false,
    outdatedNote: null,
  };
}

/**
 * @param {object} session
 */
export function getPriceListSignalState(session = {}) {
  return session.conversationSignals?.priceList ?? {
    views: [],
    followUpStatus: null,
    lastViewedModelKey: null,
    followUpTurnId: null,
  };
}

/**
 * Speichert price_list_viewed – kein Notizzettel, kein needProfile.
 * @param {object} session
 * @param {{ modelKey: string, conversationTurnId?: string|null }} payload
 */
export function recordPriceListViewed(session = {}, payload = {}) {
  const doc = resolveVerifiedPriceListDocument(payload.modelKey);
  if (!doc) return session;

  const prev = getPriceListSignalState(session);
  const view = {
    type: PRICE_LIST_VIEWED_TYPE,
    modelKey: doc.modelKey,
    documentId: doc.documentId,
    sourceUrl: doc.sourceUrl,
    timestamp: new Date().toISOString(),
    conversationTurnId: payload.conversationTurnId ?? null,
  };

  const views = [...(prev.views ?? []), view].slice(-8);
  const followUpStatus = prev.followUpStatus === PRICE_LIST_FOLLOW_UP_STATUS.SHOWN
    || prev.followUpStatus === PRICE_LIST_FOLLOW_UP_STATUS.RESOLVED
    ? prev.followUpStatus
    : PRICE_LIST_FOLLOW_UP_STATUS.PENDING;

  return {
    ...session,
    conversationSignals: {
      ...(session.conversationSignals ?? {}),
      priceList: {
        ...prev,
        views,
        lastViewedModelKey: doc.modelKey,
        followUpStatus,
      },
    },
  };
}

/**
 * @param {object} session
 * @param {{ hasPendingQuestion?: boolean, inOfferWorld?: boolean }} [ctx]
 */
export function shouldOfferPriceListFollowUp(session = {}, ctx = {}) {
  if (ctx.inOfferWorld) return false;
  if (ctx.hasPendingQuestion) return false;

  const state = getPriceListSignalState(session);
  if (state.followUpStatus !== PRICE_LIST_FOLLOW_UP_STATUS.PENDING) return false;
  if (!(state.views?.length > 0)) return false;

  const alreadyShown = (session.turns ?? []).some(
    (t) => t.questionId === PRICE_LIST_FOLLOW_UP_QUESTION_ID
      || t.priceListFollowUp === true,
  );
  if (alreadyShown) return false;

  return true;
}

/**
 * @param {object} session
 */
export function buildPriceListFollowUpTurn(session = {}) {
  const state = getPriceListSignalState(session);
  const modelKey = state.lastViewedModelKey;
  const label = modelDisplayLabel(modelKey);
  const nextTopics = [
    {
      id: 'pl_equipment',
      label: 'Ausstattung',
      customerMessage: FOLLOW_UP_CUSTOMER_MESSAGES.equipment,
    },
    {
      id: 'pl_powertrain',
      label: 'Motoren',
      customerMessage: FOLLOW_UP_CUSTOMER_MESSAGES.powertrain,
    },
    {
      id: 'pl_price',
      label: 'Preise',
      customerMessage: FOLLOW_UP_CUSTOMER_MESSAGES.price,
    },
    {
      id: 'pl_packages',
      label: 'Pakete',
      customerMessage: 'Welche Pakete gibt es in der Preisliste?',
    },
  ];

  return {
    type: CLEVER_TURN,
    id: `price-list-follow-up-${Date.now()}`,
    questionId: PRICE_LIST_FOLLOW_UP_QUESTION_ID,
    text: `War in der Preisliste zum ${label} schon etwas dabei, das Ihnen besonders gefallen hat?`,
    options: PRICE_LIST_FOLLOW_UP_OPTIONS.map((o) => ({ ...o })),
    nextTopics,
    priceListFollowUp: true,
    priceListModelKey: modelKey,
    hint: null,
    aiGenerated: false,
  };
}

/**
 * @param {object} session
 */
export function appendPriceListFollowUpIfNeeded(session = {}, ctx = {}) {
  if (!shouldOfferPriceListFollowUp(session, ctx)) return session;

  const turn = buildPriceListFollowUpTurn(session);
  const prev = getPriceListSignalState(session);

  return {
    ...session,
    pendingQuestion: {
      id: PRICE_LIST_FOLLOW_UP_QUESTION_ID,
      prompt: turn.text,
    },
    conversationSignals: {
      ...(session.conversationSignals ?? {}),
      priceList: {
        ...prev,
        followUpStatus: PRICE_LIST_FOLLOW_UP_STATUS.SHOWN,
        followUpTurnId: turn.id,
      },
    },
    turns: [...(session.turns ?? []), turn],
  };
}

/**
 * @param {object} session
 */
export function markPriceListFollowUpResolved(session = {}) {
  const prev = getPriceListSignalState(session);
  if (!prev.followUpStatus || prev.followUpStatus === PRICE_LIST_FOLLOW_UP_STATUS.RESOLVED) {
    return session;
  }
  return {
    ...session,
    conversationSignals: {
      ...(session.conversationSignals ?? {}),
      priceList: {
        ...prev,
        followUpStatus: PRICE_LIST_FOLLOW_UP_STATUS.RESOLVED,
      },
    },
    pendingQuestion: session.pendingQuestion?.id === PRICE_LIST_FOLLOW_UP_QUESTION_ID
      ? null
      : session.pendingQuestion,
  };
}

/**
 * Antwort auf Follow-up-Option → Kundennachricht (kein automatischer Wunsch).
 * @param {string} answerId
 */
export function customerMessageForPriceListFollowUpAnswer(answerId) {
  return FOLLOW_UP_CUSTOMER_MESSAGES[answerId] ?? null;
}

/**
 * Verkäufer-Aktivitäten (getrennt von Kundenwünschen).
 * @param {object} session
 * @returns {string[]}
 */
export function buildPriceListActivityLines(session = {}) {
  const views = getPriceListSignalState(session).views ?? [];
  if (!views.length) return [];

  const seen = new Set();
  const lines = [];
  for (const view of views) {
    const key = view.modelKey;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(`Preisliste ${modelDisplayLabel(key)} angesehen`);
  }
  return lines;
}

/**
 * Snapshot-Feld für Plugin-Resume (ohne needProfile).
 * @param {object} session
 */
export function serializePriceListSignalsForSnapshot(session = {}) {
  return session.conversationSignals?.priceList ?? null;
}
