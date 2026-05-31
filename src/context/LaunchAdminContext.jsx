import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLeads } from './LeadsContext.jsx';
import { useOffers } from './OffersContext.jsx';
import { useBilling } from './BillingContext.jsx';
import { useDealerAdmin } from './DealerAdminContext.jsx';
import { usePriceListImport } from './PriceListImportContext.jsx';
import { getLiveSearchBehavior } from '../services/intelligenceAnalytics.js';
import {
  DEMO_PLATFORM_USERS,
  DEMO_EMAIL_TEMPLATES,
  DEMO_SYSTEM_ISSUES,
  DEMO_AUDIT_LOG,
  DEMO_DEALER_DOMAINS,
  DEMO_BACKUPS,
  DEMO_PILOT_NOTES,
  PILOT_DEALER_ID,
} from '../data/demoLaunchAdmin.js';
import {
  computeLaunchChecklist,
  computePlatformAnalytics,
  computePilotStats,
  buildBackupPayload,
} from '../logic/launchReadinessEngine.js';
import { ROLES, USER_STATUS } from '../data/rolesConfig.js';
import { AUDIT_EVENT } from '../services/audit/auditService.js';

const STORAGE_KEY = 'clever-neuwagen-launch-admin';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return {
    users: DEMO_PLATFORM_USERS,
    emailTemplates: DEMO_EMAIL_TEMPLATES,
    systemIssues: DEMO_SYSTEM_ISSUES,
    auditLog: DEMO_AUDIT_LOG,
    domains: DEMO_DEALER_DOMAINS,
    backups: DEMO_BACKUPS,
    pilotNotes: DEMO_PILOT_NOTES,
    currentRole: 'superAdmin',
  };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const LaunchAdminContext = createContext(null);

export function LaunchAdminProvider({ children }) {
  const { leads } = useLeads();
  const { offers } = useOffers();
  const { deliveries, invoices } = useBilling();
  const { dealers } = useDealerAdmin();
  const { getMetrics } = usePriceListImport();
  const [state, setState] = useState(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    function reloadAudit() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.auditLog) {
          setState((prev) => ({ ...prev, auditLog: parsed.auditLog }));
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener(AUDIT_EVENT, reloadAudit);
    return () => window.removeEventListener(AUDIT_EVENT, reloadAudit);
  }, []);

  const importMetrics = getMetrics();
  const intelligenceSearches = useMemo(
    () => getLiveSearchBehavior('30d').map((s) => s.query),
    [],
  );

  const analyticsCtx = useMemo(
    () => ({ dealers, leads, offers, deliveries, invoices, intelligenceSearches }),
    [dealers, leads, offers, deliveries, invoices, intelligenceSearches],
  );

  const api = useMemo(() => ({
    users: state.users,
    emailTemplates: state.emailTemplates,
    systemIssues: state.systemIssues,
    auditLog: state.auditLog,
    domains: state.domains,
    backups: state.backups,
    pilotNotes: state.pilotNotes,
    currentRole: state.currentRole,
    roles: ROLES,
    userStatuses: USER_STATUS,

    getLaunchChecklist() {
      return computeLaunchChecklist({
        dealers,
        invoices,
        importMetrics,
        systemIssues: state.systemIssues,
      });
    },

    getAnalytics() {
      return computePlatformAnalytics(analyticsCtx);
    },

    getPilotStats() {
      return computePilotStats(PILOT_DEALER_ID, {
        leads,
        offers,
        deliveries,
        systemIssues: state.systemIssues,
      });
    },

    setUserStatus(userId, status) {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === userId ? { ...u, status } : u)),
        auditLog: [
          {
            id: `aud-${Date.now()}`,
            actor: 'Admin',
            actorRole: 'superAdmin',
            action: `Benutzerstatus geändert: ${status}`,
            target: userId,
            createdAt: new Date().toISOString(),
          },
          ...prev.auditLog,
        ],
      }));
    },

    updateEmailTemplate(id, partial) {
      setState((prev) => ({
        ...prev,
        emailTemplates: prev.emailTemplates.map((t) =>
          t.id === id ? { ...t, ...partial } : t,
        ),
      }));
    },

    resolveSystemIssue(id) {
      setState((prev) => ({
        ...prev,
        systemIssues: prev.systemIssues.map((i) =>
          i.id === id ? { ...i, type: 'ok', detail: `${i.detail} · behoben` } : i,
        ),
        auditLog: [
          {
            id: `aud-${Date.now()}`,
            actor: 'Admin',
            actorRole: 'superAdmin',
            action: `Systemproblem behoben: ${id}`,
            target: id,
            createdAt: new Date().toISOString(),
          },
          ...prev.auditLog,
        ],
      }));
    },

    createBackup() {
      const payload = buildBackupPayload({
        users: state.users,
        dealers,
        leads,
        offers,
        invoices,
        deliveries,
        exportedAt: new Date().toISOString(),
      });
      const json = JSON.stringify(payload);
      const backup = {
        id: `bak-${Date.now()}`,
        label: `Backup ${new Date().toLocaleString('de-DE')}`,
        size: `${(json.length / 1024).toFixed(1)} KB`,
        createdAt: new Date().toISOString(),
        type: 'local',
        data: payload,
      };
      setState((prev) => ({
        ...prev,
        backups: [backup, ...prev.backups],
        auditLog: [
          {
            id: `aud-${Date.now()}`,
            actor: 'System',
            actorRole: 'system',
            action: 'Backup erstellt',
            target: backup.id,
            createdAt: new Date().toISOString(),
          },
          ...prev.auditLog,
        ],
      }));
      return backup;
    },

    downloadBackup(backupId) {
      const backup = state.backups.find((b) => b.id === backupId);
      if (!backup?.data) return null;
      const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clever-neuwagen-backup-${backupId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    },

    toggleDomainStatus(domainId) {
      setState((prev) => ({
        ...prev,
        domains: prev.domains.map((d) =>
          d.id === domainId
            ? { ...d, status: d.status === 'active' ? 'disabled' : 'active' }
            : d,
        ),
      }));
    },

    addPilotNote(text, priority = 'medium') {
      setState((prev) => ({
        ...prev,
        pilotNotes: [
          { id: `pn-${Date.now()}`, text, priority, createdAt: new Date().toISOString() },
          ...prev.pilotNotes,
        ],
      }));
    },

    resetDemoData() {
      setState(loadState());
    },
  }), [state, dealers, leads, offers, deliveries, invoices, importMetrics, analyticsCtx]);

  return (
    <LaunchAdminContext.Provider value={api}>
      {children}
    </LaunchAdminContext.Provider>
  );
}

export function useLaunchAdmin() {
  const ctx = useContext(LaunchAdminContext);
  if (!ctx) {
    throw new Error('useLaunchAdmin muss innerhalb von LaunchAdminProvider verwendet werden');
  }
  return ctx;
}
