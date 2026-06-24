/**
 * Änderungsverlauf für Modell-Konditionen
 */

const MAX_HISTORY = 80;

let historyIdCounter = 0;

function nextHistoryId() {
  historyIdCounter += 1;
  return `hist-${Date.now()}-${historyIdCounter}`;
}

export function appendChangeHistory(conditions = {}, entry = {}) {
  const history = conditions.changeHistory ?? [];
  const record = {
    id: nextHistoryId(),
    at: new Date().toISOString(),
    actor: entry.actor ?? 'Händler',
    actorRole: entry.actorRole ?? 'dealerAdmin',
    modelId: entry.modelId ?? null,
    action: entry.action ?? 'update',
    summary: entry.summary ?? 'Änderung',
    field: entry.field ?? null,
  };
  return {
    changeHistory: [record, ...history].slice(0, MAX_HISTORY),
  };
}

export function getModelChangeHistory(conditions = {}, modelId = '', limit = 20) {
  return (conditions.changeHistory ?? [])
    .filter((entry) => !modelId || entry.modelId === modelId)
    .slice(0, limit);
}

export function formatHistoryEntry(entry = {}) {
  const date = entry.at ? new Date(entry.at) : null;
  const when = date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    : '–';
  return {
    ...entry,
    when,
    label: `${entry.actor ?? 'Händler'}: ${entry.summary ?? 'Änderung'}`,
  };
}
