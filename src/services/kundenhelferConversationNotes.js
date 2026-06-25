/**
 * Gesprächsnotizen im Clever Kundenhelfer (Fließtext, nicht Chips).
 */

export const CONVERSATION_LINK_TYPES = [
  { id: 'customer', label: 'Kunde' },
  { id: 'vehicle', label: 'Fahrzeug' },
  { id: 'offer', label: 'Angebot' },
];

function createId() {
  return `cn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {string} text
 */
export function createConversationNote(text = '') {
  const now = new Date().toISOString();
  return {
    id: createId(),
    text: String(text).trim(),
    important: false,
    linkType: null,
    linkId: null,
    linkLabel: null,
    includeInOffer: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @param {object[]} notes
 */
export function normalizeConversationNotes(notes = []) {
  if (!Array.isArray(notes)) return [];
  return notes.filter((n) => n && typeof n === 'object' && n.id);
}

/**
 * @param {object[]} notes
 * @param {string} id
 * @param {object} patch
 */
export function updateConversationNote(notes, id, patch = {}) {
  const list = normalizeConversationNotes(notes);
  return list.map((note) => {
    if (note.id !== id) return note;
    return {
      ...note,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * @param {object[]} notes
 * @param {string} id
 */
export function deleteConversationNote(notes, id) {
  return normalizeConversationNotes(notes).filter((note) => note.id !== id);
}

/**
 * @param {object[]} notes
 */
export function countConversationNotes(notes = []) {
  return normalizeConversationNotes(notes).length;
}

/**
 * @param {object[]} notes
 */
export function countImportantConversationNotes(notes = []) {
  return normalizeConversationNotes(notes).filter((n) => n.important).length;
}

/**
 * Notizen für Angebotsübernahme.
 * @param {object[]} notes
 */
export function getOfferConversationNotes(notes = []) {
  return normalizeConversationNotes(notes).filter((n) => n.includeInOffer && n.text?.trim());
}

/**
 * @param {object[]} notes
 * @param {number} [limit]
 */
export function getConversationNotePreview(notes = [], limit = 1) {
  const sorted = [...normalizeConversationNotes(notes)].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  );
  return sorted.slice(0, limit);
}
