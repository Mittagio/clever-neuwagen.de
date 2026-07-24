/**
 * Clever Dealer Plugin – lokale Session-Persistenz (Resume).
 * Keine sensiblen Dokumente / Bankdaten. Essential/functional Consent.
 */

import { getStoredConsent } from '../cookieConsentService.js';
import { normalizePluginPageContext } from './cleverDealerPluginContext.js';

export const PLUGIN_SESSION_STORAGE_PREFIX = 'clever-dealer-plugin-session';
export const PLUGIN_SESSION_SCHEMA_VERSION = 1;

/**
 * @param {object} [hostConsent] { functional?, analytics?, marketing? }
 */
export function canPersistPluginSession(hostConsent = null) {
  if (hostConsent && typeof hostConsent === 'object') {
    if (hostConsent.functional === false) return false;
    return true;
  }
  const stored = getStoredConsent();
  if (!stored) return true;
  if (stored.categories?.essential === false) return false;
  return true;
}

export function pluginSessionStorageKey(dealerId = 'default') {
  return `${PLUGIN_SESSION_STORAGE_PREFIX}:${dealerId || 'default'}`;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Schlanke Snapshot-Form aus Happy-Path-Session.
 * @param {object} session
 * @param {object} pageContext
 */
export function buildPluginSessionSnapshot(session = {}, pageContext = {}) {
  return {
    schemaVersion: PLUGIN_SESSION_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    pageContext: normalizePluginPageContext(pageContext),
    session: {
      phase: session.phase,
      dealerName: session.dealerName,
      turns: session.turns ?? [],
      needProfile: session.needProfile ?? {},
      consultationProfile: session.consultationProfile ?? null,
      notepadLabels: session.notepadLabels ?? [],
      vehicleNotepadLabels: session.vehicleNotepadLabels ?? [],
      vehicleProfile: session.vehicleProfile ?? null,
      pendingQuestion: session.pendingQuestion ?? null,
      selectedModelKey: session.selectedModelKey ?? null,
      conversationMode: session.conversationMode ?? null,
      offerRequested: session.offerRequested ?? false,
      softHandoffDismissed: session.softHandoffDismissed ?? false,
      submittedLeadId: session.submittedLead?.id ?? null,
      conversationSignals: session.conversationSignals ?? {},
    },
  };
}

/**
 * @param {string} dealerId
 * @param {object} snapshot
 * @param {object} [hostConsent]
 */
export function savePluginSession(dealerId, snapshot, hostConsent = null) {
  if (!canPersistPluginSession(hostConsent)) return false;
  if (!isBrowser()) return false;
  try {
    const key = pluginSessionStorageKey(dealerId);
    const payload = {
      ...snapshot,
      lastActivityAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} dealerId
 * @param {object} [hostConsent]
 */
export function loadPluginSession(dealerId, hostConsent = null) {
  if (!canPersistPluginSession(hostConsent)) return null;
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(pluginSessionStorageKey(dealerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.session || !Array.isArray(parsed.session.turns)) return null;
    if ((parsed.session.notepadLabels?.length ?? 0) === 0 && (parsed.session.turns?.length ?? 0) === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} dealerId
 */
export function clearPluginSession(dealerId) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(pluginSessionStorageKey(dealerId));
  } catch {
    /* ignore */
  }
}

/**
 * Resume lohnt sich, wenn es echten Fortschritt gibt.
 * @param {object|null} snapshot
 */
export function shouldOfferPluginResume(snapshot) {
  if (!snapshot?.session) return false;
  const labels = snapshot.session.notepadLabels?.length ?? 0;
  const turns = snapshot.session.turns?.length ?? 0;
  return labels > 0 || turns > 0;
}
