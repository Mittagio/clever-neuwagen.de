/**
 * Empty-draft Composer-Effekt: Chip-/Review-vorbereitete Assists nicht verwerfen.
 *
 * Wenn `pinned`, bleibt die Karte bis dismiss, erfolgreichem Send oder
 * bis Tipp-Assist sie ersetzt — sonst würde `setDraft('')` + lead-Refresh
 * die Karte sofort wieder löschen.
 *
 * @param {{ pinned?: boolean, confirmAssist?: { ok?: boolean } | null }} opts
 * @returns {boolean} true = Assist darf auf null / confirmAssist zurückgesetzt werden
 */
export function shouldClearAssistOnEmptyDraft({ pinned = false, confirmAssist = null } = {}) {
  if (pinned) return false;
  // confirmAssist steuert nur den Ersatzwert im Caller, nicht ob wir clearen.
  void confirmAssist;
  return true;
}
