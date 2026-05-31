/**

 * Bidirektionale Sync: localStorage ↔ Server-Datei

 */



import {

  loadIntelligenceStore,

  saveIntelligenceStore,

} from './intelligenceStorageAdapter.js';

import {

  mergeIntelligenceStores,

  intelligenceStoresEqual,

} from './intelligenceEventMerge.js';
import { syncPublishedTrends } from './trendPublishService.js';



let syncPromise = null;



const syncState = {

  status: 'idle',

  lastSyncAt: null,

  eventCount: 0,

  serverOnline: null,

  lastError: null,

};



function emitSyncUpdate() {

  if (typeof window !== 'undefined') {

    window.dispatchEvent(new CustomEvent('clever-intelligence-sync'));

  }

}



export function getIntelligenceSyncStatus() {

  return { ...syncState };

}



export async function syncIntelligenceEvents() {

  if (typeof fetch === 'undefined') {

    syncState.status = 'offline';

    syncState.lastError = 'no-fetch';

    emitSyncUpdate();

    return { ok: false, reason: 'no-fetch' };

  }



  if (syncPromise) return syncPromise;



  syncState.status = 'syncing';

  emitSyncUpdate();



  syncPromise = (async () => {

    try {

      const res = await fetch('/api/v1/intelligence/events');

      if (!res.ok) {

        syncState.status = 'error';

        syncState.serverOnline = false;

        syncState.lastError = 'server-unavailable';

        emitSyncUpdate();

        return { ok: false, reason: 'server-unavailable' };

      }



      const remote = await res.json();

      const local = loadIntelligenceStore();

      const merged = mergeIntelligenceStores(local, remote);



      saveIntelligenceStore(merged);



      if (!intelligenceStoresEqual(merged, remote)) {

        await fetch('/api/v1/intelligence/events', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ events: merged.events, mode: 'replace' }),

        });

      }



      syncState.status = 'synced';

      syncState.serverOnline = true;

      syncState.eventCount = merged.events.length;

      syncState.lastSyncAt = new Date().toISOString();

      syncState.lastError = null;

      emitSyncUpdate();



      if (typeof window !== 'undefined') {

        window.dispatchEvent(new CustomEvent('clever-intelligence-update'));

      }



      return {

        ok: true,

        count: merged.events.length,

        merged: !intelligenceStoresEqual(local, merged) || !intelligenceStoresEqual(remote, merged),

      };

    } catch {

      syncState.status = 'offline';

      syncState.serverOnline = false;

      syncState.lastError = 'offline';

      emitSyncUpdate();

      return { ok: false, reason: 'offline' };

    } finally {

      syncPromise = null;

    }

  })();



  return syncPromise;

}



const FOCUS_SYNC_MIN_MS = 30_000;

let lastFocusSyncAt = 0;



export function setupIntelligenceSync() {

  if (typeof window === 'undefined') return;



  syncIntelligenceEvents();
  syncPublishedTrends();

  window.addEventListener('focus', () => {
    if (Date.now() - lastFocusSyncAt < FOCUS_SYNC_MIN_MS) return;
    lastFocusSyncAt = Date.now();
    syncIntelligenceEvents();
    syncPublishedTrends();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastFocusSyncAt < FOCUS_SYNC_MIN_MS) return;
    lastFocusSyncAt = Date.now();
    syncIntelligenceEvents();
    syncPublishedTrends();
  });
}

