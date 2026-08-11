/**
 * CleverComposerContext – App-weiter Context Stack für den Global Composer.
 * Surfaces: Dashboard rendert Global Composer; Kundenakte nutzt denselben
 * Orchestrator (`runCleverSellerTurn`) im Akte-Composer mit festem Lead –
 * Global Composer dort ausgeblendet (kein Doppel-Render).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useLeads } from './LeadsContext.jsx';

const CleverComposerContext = createContext(null);

function resolveSurface(pathname = '') {
  const path = String(pathname).split('?')[0];
  if (path === '/backend' || path === '/backend/') return 'dashboard';
  if (path.startsWith('/backend/kundenakte/')) return 'customer_akte';
  if (path.startsWith('/verkaufsassistent')) return 'verkaufsassistent';
  if (path.startsWith('/backend')) return 'backend';
  return 'other';
}

function readGlobalComposerFlag() {
  const vite = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_CLEVER_GLOBAL_COMPOSER
    : undefined;
  if (vite === 'false' || vite === '0') return false;
  return true;
}

export function CleverComposerProvider({ children }) {
  const { pathname } = useLocation();
  const { leads } = useLeads();
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [currentVehicleTrack, setCurrentVehicleTrack] = useState(null);
  const [currentOffer, setCurrentOffer] = useState(null);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [attachedWorkingObjects, setAttachedWorkingObjects] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [dashboardContext, setDashboardContext] = useState({ surface: 'home' });
  const [composerHeroSlotEl, setComposerHeroSlotEl] = useState(null);
  const [composerDocked, setComposerDocked] = useState(false);
  /** Dashboard-Karten → Composer (Today / Empfiehlt / Tasks) */
  const [composerRequest, setComposerRequest] = useState(null);

  const surface = resolveSurface(pathname);
  const enabled = readGlobalComposerFlag();

  const registerComposerHeroSlot = useCallback((el) => {
    setComposerHeroSlotEl(el || null);
  }, []);

  const requestComposerAction = useCallback((action = {}) => {
    if (!action || typeof action !== 'object') return null;
    const id = `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const next = { id, ...action };
    setComposerRequest(next);
    return id;
  }, []);

  const consumeComposerRequest = useCallback((id) => {
    setComposerRequest((prev) => (prev && prev.id === id ? null : prev));
  }, []);

  const clearWorkspaceContext = useCallback(() => {
    setCurrentCustomer(null);
    setCurrentVehicleTrack(null);
    setCurrentOffer(null);
    setCurrentDocument(null);
    setCurrentConversation(null);
    setAttachedWorkingObjects([]);
    setPendingAction(null);
  }, []);

  // Context Sync: Kundenakte → Lead aus Route; sonst Reset
  useEffect(() => {
    if (surface === 'customer_akte') {
      const match = String(pathname).match(/\/backend\/kundenakte\/([^/?#]+)/);
      const leadId = match?.[1] ? decodeURIComponent(match[1]) : null;
      const lead = (Array.isArray(leads) ? leads : []).find((l) => l.id === leadId) || null;
      setCurrentCustomer(lead);
      return;
    }
    if (surface !== 'verkaufsassistent') {
      clearWorkspaceContext();
    }
  }, [surface, pathname, leads, clearWorkspaceContext]);

  // Außerhalb Dashboard: Dock-State und Hero-Slot zurücksetzen
  useEffect(() => {
    if (surface !== 'dashboard') {
      setComposerDocked(false);
      setComposerHeroSlotEl(null);
    }
  }, [surface]);

  const shouldShowGlobalComposer = Boolean(
    enabled && surface === 'dashboard',
  );

  const value = useMemo(() => ({
    routeContext: { pathname, surface },
    currentCustomer,
    currentVehicleTrack,
    currentOffer,
    currentDocument,
    currentConversation,
    attachedWorkingObjects,
    pendingAction,
    dashboardContext,
    leadsSnapshot: Array.isArray(leads) ? leads : [],
    setCurrentCustomer,
    setCurrentVehicleTrack,
    setCurrentOffer,
    setCurrentDocument,
    setCurrentConversation,
    setAttachedWorkingObjects,
    setPendingAction,
    setDashboardContext,
    clearWorkspaceContext,
    composerRequest,
    requestComposerAction,
    consumeComposerRequest,
    shouldShowGlobalComposer,
    globalComposerEnabled: enabled,
    composerHeroSlotEl,
    registerComposerHeroSlot,
    composerDocked,
    setComposerDocked,
  }), [
    pathname,
    surface,
    currentCustomer,
    currentVehicleTrack,
    currentOffer,
    currentDocument,
    currentConversation,
    attachedWorkingObjects,
    pendingAction,
    dashboardContext,
    leads,
    clearWorkspaceContext,
    composerRequest,
    requestComposerAction,
    consumeComposerRequest,
    shouldShowGlobalComposer,
    enabled,
    composerHeroSlotEl,
    registerComposerHeroSlot,
    composerDocked,
  ]);

  return (
    <CleverComposerContext.Provider value={value}>
      {children}
    </CleverComposerContext.Provider>
  );
}

export function useCleverComposer() {
  const ctx = useContext(CleverComposerContext);
  if (!ctx) {
    throw new Error('useCleverComposer requires CleverComposerProvider');
  }
  return ctx;
}

/** Sicher für optionale Nutzung außerhalb des Providers. */
export function useCleverComposerOptional() {
  return useContext(CleverComposerContext);
}
