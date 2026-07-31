/**
 * Clever composer-only: nach Accept/Send die letzte Aktion sichtbar halten
 * (Cursor-ähnlich), ohne den vollen Chat-Feed wieder einzublenden.
 */

export const COMPOSER_LAST_ACTION_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  READY_TO_SEND: 'ready_to_send',
  SENT: 'sent',
});

/**
 * @param {string} [status]
 * @returns {string}
 */
export function statusLabelForComposerLastAction(status) {
  if (status === COMPOSER_LAST_ACTION_STATUS.READY_TO_SEND) return 'Bereit zum Senden';
  if (status === COMPOSER_LAST_ACTION_STATUS.SENT) return 'Gesendet';
  return 'Übernommen';
}

function pickBodyFromReviewModel(model = {}) {
  const sections = Array.isArray(model?.actionSections) ? model.actionSections : [];
  const draftSection = sections.find((s) => (
    (s.kind === 'message_draft'
      || s.kind === 'appointment_propose'
      || s.kind === 'golden_moment'
      || s.kind === 'history_search')
    && s.body
  ));
  if (draftSection?.body) return String(draftSection.body).trim();

  const lines = [];
  for (const section of sections) {
    if (section.headline) lines.push(section.headline);
    if (section.line) lines.push(section.line);
    if (section.changes?.length) {
      for (const change of section.changes) {
        const value = change.from && change.to
          ? `${change.from} → ${change.to}`
          : (change.to || change.from);
        if (value) lines.push(`${change.label}: ${value}`);
      }
    }
  }
  if (lines.length) return lines.join('\n');

  const groups = Array.isArray(model?.groups) ? model.groups : [];
  if (groups.length) {
    return groups.map((g) => g.line).filter(Boolean).join('\n');
  }
  return String(model?.summaryLine || '').trim();
}

/**
 * Snapshot aus Universal-Review-Model für den Last-Action-Slot.
 * @param {object|null} model
 * @param {{ status?: string, body?: string, statusLabel?: string }} [opts]
 */
export function buildComposerLastActionFromReviewModel(model, {
  status = COMPOSER_LAST_ACTION_STATUS.ACCEPTED,
  body = '',
  statusLabel = '',
} = {}) {
  if (!model && !body) return null;
  const resolvedBody = String(body || pickBodyFromReviewModel(model) || '').trim();
  const summaryLine = String(model?.summaryLine || '').trim();
  if (!resolvedBody && !summaryLine) return null;

  return {
    title: model?.title || 'Clever',
    body: resolvedBody,
    summaryLine: summaryLine || null,
    metaLine: model?.missingLine || null,
    status,
    statusLabel: statusLabel || statusLabelForComposerLastAction(status),
    /** Synthetic review model for SellerUniversalReviewCard settled mode */
    model: {
      title: model?.title || 'Clever',
      summaryLine: summaryLine || resolvedBody.slice(0, 120),
      actionSections: resolvedBody
        ? [{ kind: 'message_draft', body: resolvedBody }]
        : (model?.actionSections || []),
      groups: Array.isArray(model?.groups) ? model.groups : [],
      missingLine: model?.missingLine || null,
    },
  };
}

/**
 * @param {{ body?: string, title?: string, status?: string, statusLabel?: string, summaryLine?: string }} opts
 */
export function buildComposerLastActionFromText({
  body = '',
  title = 'Clever',
  status = COMPOSER_LAST_ACTION_STATUS.SENT,
  statusLabel = '',
  summaryLine = '',
} = {}) {
  const resolvedBody = String(body || '').trim();
  if (!resolvedBody) return null;
  return buildComposerLastActionFromReviewModel({
    title,
    summaryLine: summaryLine || resolvedBody.slice(0, 120),
    actionSections: [{ kind: 'message_draft', body: resolvedBody }],
    groups: [],
  }, { status, body: resolvedBody, statusLabel });
}
