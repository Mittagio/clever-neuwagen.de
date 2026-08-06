/**
 * kundenhelferSavePayload – Phase 3b.
 *
 * Regel beim allgemeinen Lead-Save:
 * - kundenhelfer.notes wird NICHT mehr aus dem React-State zurückgeschrieben.
 *   Neue Verkäufer-Erkenntnisse fließen nach crm.sellerInsights.
 * - Bestehende notes + chipCategories laufen legacy/read-only durch
 *   (unverändert vom Lead, bzw. explizit von einem anderen Schreibpfad gesetzt).
 * - conversationNotes + voiceMemos bleiben operativ speicherbar.
 */
import { joinKundenhelferNotes, parseKundenhelferNotes } from '../cleverKundenhelfer.js';
import { getSellerInsightsFromLead } from './sellerInsights.js';

/**
 * Anzeige-Notes für Kundenhelfer-UI: sellerInsights (inkl. Lazy-Migration aus notes).
 * @param {object} lead
 */
export function buildKundenhelferDisplayNotes(lead = {}) {
  const texts = getSellerInsightsFromLead(lead).map((insight) => insight.text);
  return joinKundenhelferNotes(texts);
}

/**
 * Notes im offenen Kundenhelfer-Sheet: lokaler Edit-State hat Vorrang
 * (inkl. leerer String), sonst Lead-Display aus sellerInsights.
 * @param {string|null|undefined} notes
 * @param {object} [lead]
 */
export function resolveKundenhelferSheetNotes(notes, lead = {}) {
  if (typeof notes === 'string') return notes;
  return buildKundenhelferDisplayNotes(lead);
}

/**
 * Neue Chips/Freitexte zwischen zwei Notes-Strings (nur hinzugefügte, kein Toggle-off).
 * @param {string} beforeNotes
 * @param {string} afterNotes
 * @returns {string[]}
 */
export function collectNewKundenhelferChips(beforeNotes = '', afterNotes = '') {
  const before = parseKundenhelferNotes(beforeNotes);
  const after = parseKundenhelferNotes(afterNotes);
  const beforeSet = new Set(before);
  return after.filter((chip) => !beforeSet.has(chip));
}

/**
 * @param {{
 *   existingKundenhelfer?: object,
 *   extraKundenhelfer?: object,
 *   voiceMemos?: object[],
 *   conversationNotes?: object[],
 * }} [params]
 * @returns {object} kundenhelfer-Patch für crm
 */
export function buildKundenhelferSavePatch({
  existingKundenhelfer = {},
  extraKundenhelfer = {},
  voiceMemos = [],
  conversationNotes = [],
} = {}) {
  return {
    ...(existingKundenhelfer ?? {}),
    ...(extraKundenhelfer ?? {}),
    voiceMemos,
    conversationNotes,
  };
}
