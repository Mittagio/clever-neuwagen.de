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

/**
 * Clever-Empfehlungs-Historie → kurze Karten-Titel (nie „Clever empfahl…“ als Headline).
 */
function resolveCleverActionActivityMeta(entry = {}) {
  const raw = String(entry.text ?? '').trim();
  const payload = raw
    .replace(/^Clever empfahl:\s*/i, '')
    .replace(/^Clever-Empfehlung befolgt:\s*/i, '')
    .replace(/^✓\s*Clever-Empfehlung erledigt\s*/i, '')
    .trim();
  const hay = `${payload} ${raw}`.toLowerCase();

  if (/angebot/.test(hay) && /erstell|vervollst|prüf|send|link/.test(hay)) {
    return { icon: '📄', label: 'Angebot erstellt' };
  }
  if (/chat|zusammengefasst|zusammenfassung/.test(hay)) {
    return { icon: '✨', label: 'Chat zusammengefasst' };
  }
  if (/notiz/.test(hay)) {
    return { icon: '📝', label: 'Notiz hinzugefügt' };
  }
  if (/nachricht|whatsapp|e-?mail|message/.test(hay)) {
    return { icon: '💬', label: 'Nachricht vorbereitet' };
  }
  if (/anruf|anrufen|telefon|rückruf|kontakt aufnehmen/.test(hay)) {
    return { icon: '📞', label: 'Anruf empfohlen' };
  }
  if (/unterlagen|dokument/.test(hay)) {
    return { icon: '📎', label: 'Unterlagen angefragt' };
  }
  if (/portal|kundenlink|zugangscode/.test(hay)) {
    return { icon: '🔗', label: 'Kundenlink' };
  }
  if (payload) {
    const short = payload.length > 34 ? `${payload.slice(0, 31)}…` : payload;
    return { icon: '✨', label: short };
  }
  return { icon: '✨', label: 'Clever-Empfehlung' };
}

function resolveKindMeta(entry) {
  if (entry.activityKind && KIND_META[entry.activityKind]) {
    return KIND_META[entry.activityKind];
  }
  const text = String(entry.text ?? '');
  const textLower = text.toLowerCase();

  if (
    entry.type === 'clever_action'
    || /^Clever empfahl:/i.test(text)
    || /^Clever-Empfehlung/i.test(text)
  ) {
    return resolveCleverActionActivityMeta(entry);
  }

  if (/favorit|favorisiert/i.test(textLower)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED];
  if (/ausgeschlossen/i.test(textLower)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.VARIANT_EXCLUDED];
  if (/frage:/i.test(textLower)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION];
  if (/angesehen/i.test(textLower)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED];
  if (/geöffnet|pdf|broschüre|preisliste/i.test(textLower)) return KIND_META[CUSTOMER_ACTIVITY_KINDS.DOCUMENT_OPENED];
  if (/kunde (vergleicht|interessiert|beschäftigt)/i.test(textLower)) {
    return KIND_META[CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT];
  }
  if (/angebot/i.test(textLower) && /erstellt|gesendet|geprüft|prüfen|vervollst/i.test(textLower)) {
    return { icon: '📄', label: 'Angebot erstellt' };
  }
  if (/chat|zusammengefasst|zusammenfassung/i.test(textLower)) {
    return { icon: '✨', label: 'Chat zusammengefasst' };
  }
  if (/notiz/i.test(textLower) || entry.type === 'note') {
    return { icon: '📝', label: 'Notiz hinzugefügt' };
  }
  if (entry.type === 'call') return { icon: '📞', label: 'Anruf' };
  if (entry.type === 'communication') return { icon: '💬', label: 'Kommunikation' };
  if (entry.type === 'offer' || entry.type === 'offer_dialog') return { icon: '📄', label: 'Angebot erstellt' };
  if (entry.type === 'note') return { icon: '📝', label: 'Notiz hinzugefügt' };
  return { icon: '•', label: 'Aktivität' };
}

function buildActivityInitials(label = '') {
  const cleaned = String(label || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  if (!cleaned) return 'CL';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function resolveActivityTone(entry = {}, meta = {}) {
  const kind = entry.activityKind || entry.type || '';
  const text = String(entry.text || meta.label || '').toLowerCase();
  if (kind === CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED || /favorit/.test(text)) return 'rose';
  if (kind === CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION || /frage|nachricht/.test(text)) return 'blue';
  if (kind === CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT || /chat|zusammengefasst|erkenntnis/.test(text)) return 'amber';
  if (kind === 'offer' || kind === 'offer_dialog' || /angebot/.test(text)) return 'blue';
  if (kind === 'note' || /notiz/.test(text)) return 'green';
  if (kind === 'call') return 'purple';
  return 'slate';
}

function withActivityCardFields(presentation, entry, meta) {
  const headline = presentation.headline || meta.label || 'Aktivität';
  return {
    ...presentation,
    avatarInitials: buildActivityInitials(headline),
    avatarTone: resolveActivityTone(entry, meta),
  };
}

export function formatTimelinePresentation(entry = {}) {
  const meta = resolveKindMeta(entry);
  const time = formatClockTime(entry.at);
  const whenLabel = formatHistoryWhen(entry.at);
  const isCleverActionEntry = entry.type === 'clever_action'
    || /^Clever empfahl:/i.test(String(entry.text ?? ''))
    || /^Clever-Empfehlung/i.test(String(entry.text ?? ''));

  if (entry.type === 'customer_message' || entry.meta?.isCustomerMessage) {
    const inbound = entry.direction === 'inbound' || entry.meta?.direction === 'inbound';
    const channel = entry.channel ?? entry.meta?.channel ?? 'clever';
    const channelLabel = channel === 'clever'
      ? 'Clever'
      : channel === 'whatsapp'
        ? 'WhatsApp'
        : channel === 'email'
          ? 'E-Mail'
          : channel === 'sms'
            ? 'SMS'
            : channel;
    const preview = String(entry.text ?? '')
      .replace(/^Nachricht vom Kunden:\s*„?/i, '')
      .replace(/^Clever Nachricht gesendet:\s*„?/i, '')
      .replace(/“$/, '')
      .trim();

    return withActivityCardFields({
      id: entry.id,
      icon: inbound ? '💬' : '📤',
      time,
      whenLabel,
      headline: inbound ? 'Nachricht vom Kunden' : 'Clever Nachricht gesendet',
      body: preview || entry.text,
      channelLabel: inbound ? null : `Kanal: ${channelLabel}`,
      cleverAnswer: null,
      isQuestion: false,
      entry,
    }, entry, { label: inbound ? 'Nachricht vom Kunden' : 'Clever Nachricht gesendet' });
  }

  if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_QUESTION) {
    return withActivityCardFields({
      id: entry.id,
      icon: meta.icon,
      time,
      whenLabel,
      headline: `${meta.label}`,
      body: entry.question ? `„${entry.question}“` : entry.text,
      cleverAnswer: entry.cleverAnswer ?? null,
      isQuestion: true,
      entry,
    }, entry, meta);
  }

  if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.CLEVER_INSIGHT) {
    return withActivityCardFields({
      id: entry.id,
      icon: meta.icon,
      time,
      whenLabel,
      headline: meta.label,
      body: entry.insightText ?? entry.text,
      isInsight: true,
      entry,
    }, entry, meta);
  }

  let detail = entry.text;
  if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.VARIANT_VIEWED) {
    detail = [entry.modelLabel, entry.trimLabel].filter(Boolean).join(' ') || entry.text;
    detail = detail.includes('angesehen') ? detail : `${detail} angesehen`;
  } else if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.FAVORITE_DETECTED) {
    detail = [entry.modelLabel, entry.trimLabel].filter(Boolean).join(' ') || entry.text;
  } else if (entry.activityKind === CUSTOMER_ACTIVITY_KINDS.DOCUMENT_OPENED) {
    detail = entry.documentLabel || entry.text;
  } else if (isCleverActionEntry) {
    // Payload als Body, nie als Karten-Titel (Titel = kurzes Meta-Label)
    detail = String(entry.text ?? '')
      .replace(/^Clever empfahl:\s*/i, '')
      .replace(/^Clever-Empfehlung befolgt:\s*/i, '')
      .trim() || null;
  }

  const shortTitle = meta.label && meta.label !== 'Aktivität'
    ? meta.label
    : (detail || 'Aktivität');
  const bodyText = detail && detail !== shortTitle ? detail : null;

  return withActivityCardFields({
    id: entry.id,
    icon: meta.icon,
    time,
    whenLabel,
    headline: shortTitle,
    body: bodyText,
    cleverAnswer: null,
    isQuestion: false,
    entry,
  }, entry, meta);
}

/**
 * Kompakte Stage-Aktivitäten: neueste zuerst, doppelte Titel entdoppeln,
 * Analytics-Spam („Clever empfahl“) nicht die ganze Reihe füllen.
 */
export function pickRecentStageActivities(history = [], limit = 3) {
  const sorted = sortHistoryNewestFirst(history);
  const preferred = [];
  const fallback = [];
  const seenHeadlines = new Set();
  const seenFallback = new Set();

  for (const entry of sorted) {
    const presentation = formatTimelinePresentation(entry);
    if (!presentation?.headline) continue;
    const key = String(presentation.headline).trim().toLowerCase();
    if (seenHeadlines.has(key)) continue;

    const isAnalytics = entry.type === 'clever_action'
      || /^Clever empfahl:/i.test(String(entry.text ?? ''));
    if (isAnalytics) {
      if (seenFallback.has(key)) continue;
      fallback.push(presentation);
      seenFallback.add(key);
      continue;
    }
    preferred.push(presentation);
    seenHeadlines.add(key);
    if (preferred.length >= limit) break;
  }

  if (preferred.length < limit) {
    for (const item of fallback) {
      const key = String(item.headline).trim().toLowerCase();
      if (seenHeadlines.has(key)) continue;
      preferred.push(item);
      seenHeadlines.add(key);
      if (preferred.length >= limit) break;
    }
  }

  return preferred.slice(0, limit);
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
