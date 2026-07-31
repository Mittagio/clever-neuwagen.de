/**
 * CleverComposerContext – App-weiter Context Stack für den Global Composer.
 * Slice 1: Dashboard-Mount; Kundenakte behält bestehenden Composer.
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

  const surface = resolveSurface(pathname);
  const enabled = readGlobalComposerFlag();

  const clearWorkspaceContext = useCallback(() => {
    setCurrentCustomer(null);
    setCurrentVehicleTrack(null);
    setCurrentOffer(null);
    setCurrentDocument(null);
    setCurrentConversation(null);
    setAttachedWorkingObjects([]);
    setPendingAction(null);
  }, []);

  // Context Reset: Dashboard / Navigation ohne Akte → keinen Kunden behalten
  useEffect(() => {
    if (surface !== 'customer_akte' && surface !== 'verkaufsassistent') {
      clearWorkspaceContext();
    }
  }, [surface, clearWorkspaceContext]);

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
    shouldShowGlobalComposer,
    globalComposerEnabled: enabled,
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
    shouldShowGlobalComposer,
    enabled,
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
