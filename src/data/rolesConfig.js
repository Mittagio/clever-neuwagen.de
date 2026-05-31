/** Rollen & Rechte – Sprint 4 Launch Readiness */

export const ROLES = {
  superAdmin: {
    id: 'superAdmin',
    label: 'Super Admin',
    description: 'Clever-Neuwagen Betreiber – voller Zugriff',
    scope: 'platform',
  },
  dealerAdmin: {
    id: 'dealerAdmin',
    label: 'Händler Admin',
    description: 'Autohausleitung',
    scope: 'dealer',
  },
  sales: {
    id: 'sales',
    label: 'Verkäufer',
    description: 'Leads, Angebote, Konfiguration',
    scope: 'dealer',
  },
  customer: {
    id: 'customer',
    label: 'Kunde',
    description: 'Angebote, Vergleich, KI-Beratung',
    scope: 'customer',
  },
};

export const PERMISSIONS = {
  platformAll: 'platform.all',
  dealersManage: 'dealers.manage',
  approvalsManage: 'approvals.manage',
  pricelistApprove: 'pricelist.approve',
  billingManage: 'billing.manage',
  provisionsManage: 'provisions.manage',
  dealerAccount: 'dealer.account',
  dealerStaff: 'dealer.staff',
  dealerConditions: 'dealer.conditions',
  dealerOffers: 'dealer.offers',
  leadsEdit: 'leads.edit',
  offersCreate: 'offers.create',
  customersCreate: 'customers.create',
  configureVehicles: 'configure.vehicles',
  billingView: 'billing.view',
  offersView: 'offers.view',
  compareSave: 'compare.save',
  advisorUse: 'advisor.use',
};

const ROLE_PERMISSIONS = {
  superAdmin: Object.values(PERMISSIONS),
  dealerAdmin: [
    PERMISSIONS.dealerAccount,
    PERMISSIONS.dealerStaff,
    PERMISSIONS.dealerConditions,
    PERMISSIONS.dealerOffers,
    PERMISSIONS.leadsEdit,
    PERMISSIONS.offersCreate,
    PERMISSIONS.customersCreate,
    PERMISSIONS.configureVehicles,
    PERMISSIONS.billingView,
  ],
  sales: [
    PERMISSIONS.leadsEdit,
    PERMISSIONS.offersCreate,
    PERMISSIONS.customersCreate,
    PERMISSIONS.configureVehicles,
  ],
  customer: [
    PERMISSIONS.offersView,
    PERMISSIONS.compareSave,
    PERMISSIONS.advisorUse,
  ],
};

export function canAccess(roleId, permission) {
  const perms = ROLE_PERMISSIONS[roleId] ?? [];
  return perms.includes(PERMISSIONS.platformAll) || perms.includes(permission);
}

export function getPermissionsForRole(roleId) {
  return ROLE_PERMISSIONS[roleId] ?? [];
}

export const USER_STATUS = {
  active: { id: 'active', label: 'Aktiv', emoji: '🟢', tone: 'success' },
  invited: { id: 'invited', label: 'Einladung versendet', emoji: '🟡', tone: 'warning' },
  disabled: { id: 'disabled', label: 'Deaktiviert', emoji: '🔴', tone: 'danger' },
};

export const SYSTEM_SEVERITY = {
  ok: { id: 'ok', label: 'OK', emoji: '🟢', tone: 'success' },
  warning: { id: 'warning', label: 'Warnung', emoji: '🟡', tone: 'warning' },
  critical: { id: 'critical', label: 'Kritisch', emoji: '🔴', tone: 'danger' },
};

export const DOMAIN_STRUCTURE = {
  main: { host: 'clever-neuwagen.de', label: 'Hauptseite', url: 'https://clever-neuwagen.de' },
  admin: { host: 'admin.clever-neuwagen.de', label: 'Admin', url: 'https://admin.clever-neuwagen.de' },
  portal: { host: 'portal.clever-neuwagen.de', label: 'Händlerportal', url: 'https://portal.clever-neuwagen.de' },
};

export const EMAIL_VARIABLES = [
  '{{kunde}}',
  '{{fahrzeug}}',
  '{{haendler}}',
  '{{angebot}}',
  '{{rate}}',
];

export const SECURITY_PREP = [
  { id: '2fa', label: 'Zwei-Faktor-Authentifizierung (2FA)', active: false },
  { id: 'login-limits', label: 'Login-Limits & Brute-Force-Schutz', active: false },
  { id: 'devices', label: 'Geräteverwaltung', active: false },
  { id: 'sessions', label: 'Session Management', active: false },
];

export const BACKUP_PREP = [
  { id: 'db', label: 'Datenbank-Backup', active: false },
  { id: 'cloud', label: 'Cloud-Backup (S3/Blob)', active: false },
];
