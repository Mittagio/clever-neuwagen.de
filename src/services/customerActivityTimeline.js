/**
 * Kunden-Timeline – Aktivitätstypen für Angebotswelt & Clever.
 */
import { formatHistoryWhen } from './dealerAiLeadCrm.js';
import { sortHistoryNewestFirst } from './customerAkteHistory.js';

export const CUSTOMER_ACTIVITY_KINDS = {
  VARIANT_VIEWED: 'variant_viewed',
  DOCUMENT_OPENED: 'document_opened',
  CLEVER_QUESTION: 'clever_question',
  FAVORITE_DETECTED: 'favorite_detected',
  VARIANT_EXCLUDED: 'variant_excluded',
  CLEVER_INSIGHT: 'clever_insight',
};

const KIND_META = {
  [CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED]: { icon: '🔍', label: 'Variante angesehen' },
  [CUSTOMER_ACTIVITY_KINDS.DOCUMENT_OPENED]: { icon: '📄', label: 'Dokument geöffnet' },
  [CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION]: { icon: '💬', label: 'Clever-Frage gestellt' },
  [CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED]: { icon: '❤️', label: 'Favorit erkannt' },
  [CUSTOMER_ACTIVITY_KINDS.VARIANT_EXCLUDED]: { icon: '❌', label: 'Variante ausgeschlossen' },
  [CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT]: { icon: '🎯', label: 'Clever-Erkenntnis' },
};

const CUSTOMER_ENGAGEMENT_KINDS = new Set(Object.values(CUSTOMER_ACTIVITY_KINDS));

function formatClockTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function isCustomerEngagementEntry(entry = {}) {
  if (!entry) return false;
  if (entry.customerFacing === true) return true;
  if (entry.activityKind && CUSTOMER_ENGAGEMENT_KINDS.has(entry.activityKind)) return true;
  const text = String(entry.text ?? '').toLowerCase();
  if (/angesehen|favorisiert|ausgeschlossen|frage:|geöffnet|pdf|broschüre|preisliste/.test(text)) {
    return entry.type !== 'system';
  }
  if (entry.type === 'customer_activity') return true;
  return false;
}

export function buildCustomerActivityMeta(kind, fields = {}) {
  return {
    activityKind: kind,
    customerFacing: true,
    modelLabel: fields.modelLabel ?? null,
    trimLabel: fields.trimLabel ?? null,
    documentType: fields.documentType ?? null,
    documentLabel: fields.documentLabel ?? null,
    question: fields.question ?? null,
    cleverAnswer: fields.cleverAnswer ?? null,
    insightText: fields.insightText ?? null,
    eventId: fields.eventId ?? `${kind}-${Date.now()}`,
  };
}

export function buildVariantViewedActivity({ modelLabel, trimLabel } = {}) {
  const label = [modelLabel, trimLabel].filter(Boolean).join(' ').trim();
  return {
    text: label ? `${label} angesehen` : 'Variante angesehen',
    type: 'customer_activity',
    meta: buildCustomerActivityMeta(CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED, { modelLabel, trimLabel }),
  };
}

export function buildDocumentOpenedActivity({ documentLabel, documentType } = {}) {
  return {
    text: documentLabel ?? 'Dokument geöffnet',
    type: 'customer_activity',
    meta: buildCustomerActivityMeta(CUSTOMER_ACTIVITY_KINDS.DOCUMENT_OPENED, {
      documentLabel: documentLabel ?? 'Dokument geöffnet',
      documentType,
    }),
  };
}

export function buildCleverQuestionActivity({ question, cleverAnswer } = {}) {
  const q = String(question ?? '').trim();
  return {
    text: q ? `Frage: „${q}“` : 'Clever-Frage gestellt',
    type: 'customer_activity',
    meta: buildCustomerActivityMeta(CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION, {
      question: q,
      cleverAnswer: cleverAnswer ?? null,
    }),
  };
}

export function buildFavoriteActivity({ modelLabel, trimLabel } = {}) {
  const label = [modelLabel, trimLabel].filter(Boolean).join(' ').trim();
  return {
    text: label ? `${label} favorisiert` : 'Favorit erkannt',
    type: 'customer_activity',
    meta: buildCustomerActivityMeta(CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED, { modelLabel, trimLabel }),
  };
}

export function buildVariantExcludedActivity({ modelLabel, trimLabel } = {}) {
  const label = [modelLabel, trimLabel].filter(Boolean).join(' ').trim();
  return {
    text: label ? `${label} ausgeschlossen` : 'Variante ausgeschlossen',
    type: 'customer_activity',
    meta: buildCustomerActivityMeta(CUSTOMER_ACTIVITY_KINDS.VARIANT_EXCLUDED, { modelLabel, trimLabel }),
  };
}

export function buildCleverInsightActivity(insightText) {
  const text = String(insightText ?? '').trim();
  return {
    text,
    type: 'customer_activity',
    meta: buildCustomerActivityMeta(CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT, { insightText: text }),
  };
}

export function extractLexiconQuestionAnswer(searchState) {
  const result = searchState?.result;
  if (!result) return { question: searchState?.query ?? '', cleverAnswer: null };
  const answer = result.shortAnswer
    ?? result.primaryFacts?.[0]?.value
    ?? result.relatedFacts?.map((f) => `${f.label}: ${f.value}`).join(' · ')
    ?? null;
  return {
    question: searchState.query ?? result.query ?? '',
    cleverAnswer: answer,
  };
}

function resolveKindMeta(entry) {
  if (entry.activityKind && KIND_META[entry.activityKind]) {
    return KIND_META[entry.activityKind];
  }
  const text = String(entry.text ?? '').toLowerCase();
  if (/favorit|favorisiert/i.test(text)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED];
  if (/ausgeschlossen/i.test(text)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.VARIANT_EXCLUDED];
  if (/frage:/i.test(text)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION];
  if (/angesehen/i.test(text)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED];
  if (/geöffnet|pdf|broschüre|preisliste/i.test(text)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.DOCUMENT_OPENED];
  if (/kunde (vergleicht|interessiert|beschäftigt)/i.test(text)) {
    return KIND_META[CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT];
  }
  if (entry.type === 'call') return { icon: '📞', label: 'Anruf' };
  if (entry.type === 'communication') return { icon: '💬', label: 'Kommunikation' };
  if (entry.type === 'offer' || entry.type === 'offer_dialog') return { icon: '📄', label: 'Angebot' };
  if (entry.type === 'note') return { icon: '📝', label: 'Notiz' };
  return { icon: '•', label: 'Aktivität' };
}

export function formatTimelinePresentation(entry = {}) {
  const meta = resolveKindMeta(entry);
  const time = formatClockTime(entry.at);
  const whenLabel = formatHistoryWhen(entry.at);

  if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION) {
    return {
      id: entry.id,
      icon: meta.icon,
      time,
      whenLabel,
      headline: `${meta.label}`,
      body: entry.question ? `„${entry.question}“` : entry.text,
      cleverAnswer: entry.cleverAnswer ?? null,
      isQuestion: true,
      entry,
    };
  }

  if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT) {
    return {
      id: entry.id,
      icon: meta.icon,
      time,
      whenLabel,
      headline: meta.label,
      body: entry.insightText ?? entry.text,
      isInsight: true,
      entry,
    };
  }

  let body = entry.text;
  if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED) {
    body = [entry.modelLabel, entry.trimLabel].filter(Boolean).join(' ') || entry.text;
    body = body.includes('angesehen') ? body : `${body} angesehen`;
  }

  return {
    id: entry.id,
    icon: meta.icon,
    time,
    whenLabel,
    headline: body,
    body: null,
    cleverAnswer: null,
    isQuestion: false,
    entry,
  };
}

export function getActivityDashboard(history = [], lastSeenAt = null) {
  const sorted = sortHistoryNewestFirst(history);
  const total = sorted.length;
  const seenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;

  const isNew = (entry) => {
    if (!seenMs) return false;
    return new Date(entry.at ?? 0).getTime() > seenMs;
  };

  let newCustomerActivities = 0;
  let newQuestions = 0;
  let newFavorites = 0;

  for (const entry of sorted) {
    if (!isNew(entry)) continue;
    if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION) newQuestions += 1;
    if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED) newFavorites += 1;
    if (isCustomerEngagementEntry(entry)) newCustomerActivities += 1;
  }

  return {
    total,
    newCustomerActivities,
    newQuestions,
    newFavorites,
    hasUnread: newCustomerActivities > 0,
  };
}

export function getLastCustomerActivityHint(history = []) {
  const sorted = sortHistoryNewestFirst(history);
  const latest = sorted.find(isCustomerEngagementEntry);
  if (!latest) return null;

  const presentation = formatTimelinePresentation(latest);
  if (latest.activityKind === CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED) {
    const label = [latest.modelLabel, latest.trimLabel].filter(Boolean).join(' ');
    return label
      ? `Kunde interessiert sich aktuell für ${label}.`
      : 'Kunde hat einen Favoriten erkannt.';
  }
  if (latest.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION && latest.question) {
    return `Kunde fragte zuletzt: „${latest.question}“`;
  }
  if (latest.activityKind === CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED) {
    const label = [latest.modelLabel, latest.trimLabel].filter(Boolean).join(' ');
    return label
      ? `Kunde interessiert sich aktuell für ${label}.`
      : presentation.headline;
  }
  if (latest.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT) {
    return latest.insightText ?? latest.text;
  }
  if (/angebot.*geöffnet|geöffnet/i.test(latest.text ?? '')) {
    return 'Kunde hat kürzlich ein Angebot geöffnet.';
  }
  return presentation.headline;
}

export function detectCleverInsights(history = []) {
  const customerActs = sortHistoryNewestFirst(history).filter(isCustomerEngagementEntry);
  const insights = [];
  const viewedModels = new Set();

  for (const entry of customerActs) {
    if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED) {
      const label = [entry.modelLabel, entry.trimLabel].filter(Boolean).join(' ').trim();
      if (label) viewedModels.add(label);
    }
  }

  if (viewedModels.size >= 2) {
    insights.push(`Kunde vergleicht ${[...viewedModels].slice(0, 3).join(' und ')}.`);
  }

  const questions = customerActs
    .filter((e) => e.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION)
    .map((e) => `${e.question ?? ''} ${e.cleverAnswer ?? ''}`.toLowerCase());

  const questionHaystack = questions.join(' ');
  if (/reichweite|weit komme|kilometer|km\b|batterie/.test(questionHaystack)) {
    insights.push('Kunde beschäftigt sich aktuell mit Reichweite.');
  }
  if (/ausstattung|wärmepumpe|head-up|panorama|komfort|paket/.test(questionHaystack)) {
    insights.push('Kunde interessiert sich für Ausstattung.');
  }

  const favorite = customerActs.find((e) => e.activityKind === CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED);
  if (favorite) {
    const label = [favorite.modelLabel, favorite.trimLabel].filter(Boolean).join(' ').trim();
    if (label) insights.push(`Kunde interessiert sich stark für ${label}.`);
  }

  return [...new Set(insights)];
}

export function mergeInsightActivities(history = [], insights = []) {
  const existing = new Set(
    (history ?? [])
      .filter((e) => e.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT)
      .map((e) => String(e.insightText ?? e.text ?? '').trim()),
  );
  return insights
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t) => !existing.has(t))
    .map((insightText) => buildCleverInsightActivity(insightText));
}

export function buildQuestionReplyDraft(question, answer, customerName = '') {
  const greeting = customerName?.trim() ? `Hallo ${customerName.trim()},\n\n` : '';
  const q = question?.trim() ? `zu Ihrer Frage „${question.trim()}“` : 'zu Ihrer Frage';
  const a = answer?.trim() ?? '';
  return `${greeting}${q}: ${a}\n\nBei weiteren Fragen melden Sie sich gern.`;
}
