/**
 * Aktive Verkaufschance für Backend-Übergaben (z. B. Ausstattung prüfen → Akte).
 */
const STORAGE_KEY = 'clever_active_sales_chance_id';

export function setActiveSalesChanceId(leadId) {
  if (typeof sessionStorage === 'undefined') return;
  if (!leadId) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, leadId);
}

export function getActiveSalesChanceId() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY) || null;
}

export function clearActiveSalesChanceId() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}
