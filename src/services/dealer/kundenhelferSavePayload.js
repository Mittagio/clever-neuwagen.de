/**
 * kundenhelferSavePayload – Phase 3b.
 *
 * Regel beim allgemeinen Lead-Save:
 * - kundenhelfer.notes wird NICHT mehr aus dem React-State zurückgeschrieben.
 *   Neue Verkäufer-Erkenntnisse fließen nach crm.sellerInsights.
 * - Bestehende notes + chipCategories laufen legacy/read-only durch
 *   (unverändert vom Lead, bzw. explizit von einem anderen Schreibpfad gesetzt).
 * - conversationNotes + voiceMemos bleiben operativ speicherbar.
 *
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
