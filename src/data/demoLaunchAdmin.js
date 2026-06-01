import { EMAIL_VARIABLES } from './rolesConfig.js';

export const DEMO_PLATFORM_USERS = [
  {
    id: 'user-mike',
    name: 'Mike Quach',
    email: 'info@clever-neuwagen.de',
    role: 'superAdmin',
    status: 'active',
    lastLogin: '2026-05-29T08:30:00.000Z',
    dealerId: null,
  },
  {
    id: 'user-trinkle-admin',
    name: 'Mike Quach',
    email: 'leitung@autohaus-trinkle.de',
    role: 'dealerAdmin',
    status: 'active',
    lastLogin: '2026-05-29T07:15:00.000Z',
    dealerId: 'autohaus-trinkle',
  },
  {
    id: 'user-trinkle-sales',
    name: 'Sarah Klein',
    email: 's.klein@autohaus-trinkle.de',
    role: 'sales',
    status: 'active',
    lastLogin: '2026-05-28T16:45:00.000Z',
    dealerId: 'autohaus-trinkle',
  },
  {
    id: 'user-mueller-invite',
    name: 'Thomas Müller',
    email: 't.mueller@autohaus-mueller.de',
    role: 'dealerAdmin',
    status: 'invited',
    lastLogin: null,
    dealerId: 'autohaus-mueller',
  },
];

export const DEMO_EMAIL_TEMPLATES = [
  { id: 'login-code', name: 'Login Code', subject: 'Ihr Anmeldecode für Clever-Neuwagen', preview: 'Ihr Code: {{code}} – gültig 10 Minuten.', variables: ['{{kunde}}'] },
  { id: 'offer-send', name: 'Angebotsversand', subject: 'Ihr Angebot für {{fahrzeug}}', preview: 'Guten Tag {{kunde}}, anbei Ihr Angebot von {{haendler}}: {{angebot}} ab {{rate}}/Monat.', variables: EMAIL_VARIABLES },
  { id: 'test-drive', name: 'Probefahrt', subject: 'Probefahrt bestätigt – {{fahrzeug}}', preview: 'Ihre Probefahrt bei {{haendler}} ist bestätigt.', variables: ['{{kunde}}', '{{fahrzeug}}', '{{haendler}}'] },
  { id: 'dealer-approval', name: 'Händlerfreigabe', subject: 'Willkommen bei Clever-Neuwagen', preview: 'Ihr Händlerkonto {{haendler}} wurde freigeschaltet.', variables: ['{{haendler}}'] },
  { id: 'invoice', name: 'Rechnungen', subject: 'Rechnung {{angebot}} – Clever-Neuwagen', preview: 'Ihre Rechnung für {{haendler}} liegt bei.', variables: ['{{haendler}}', '{{angebot}}', '{{rate}}'] },
  { id: 'delivery', name: 'Auslieferungsbestätigung', subject: 'Haben Sie Ihr Fahrzeug erhalten?', preview: 'Hallo {{kunde}}, haben Sie Ihr {{fahrzeug}} von {{haendler}} erhalten?', variables: EMAIL_VARIABLES },
  { id: 'voucher', name: 'Gutscheinversand', subject: 'Ihr Gutschein von Clever-Neuwagen', preview: 'Vielen Dank {{kunde}}! Ihr Gutschein für {{fahrzeug}} ist bereit.', variables: ['{{kunde}}', '{{fahrzeug}}'] },
];

export const DEMO_SYSTEM_ISSUES = [
  { id: 'sys-1', type: 'warning', title: 'Leasingfaktor fehlt', detail: 'Autohaus Ulm · Kia Sportage · 48 Mt. / 20.000 km', dealerId: 'autohaus-ulm' },
  { id: 'sys-2', type: 'warning', title: 'Lieferzeit fehlt', detail: 'Autohaus Stuttgart · EV3', dealerId: 'autohaus-stuttgart' },
  { id: 'sys-3', type: 'critical', title: 'Fahrzeugdaten unvollständig', detail: 'Kia EV4 – WLTP-Daten fehlen', dealerId: null },
  { id: 'sys-4', type: 'warning', title: 'Händler nicht synchronisiert', detail: 'Autohaus Pforzheim · letzte Sync vor 14 Tagen', dealerId: 'autohaus-pforzheim' },
  { id: 'sys-5', type: 'ok', title: 'Autohaus Trinkle', detail: 'Alle Konditionen synchronisiert', dealerId: 'autohaus-trinkle' },
];

export const DEMO_AUDIT_LOG = [
  { id: 'aud-1', actor: 'Mike Quach', actorRole: 'superAdmin', action: 'Sportage Leasingfaktor geändert', target: 'autohaus-trinkle', createdAt: '2026-05-29T09:30:00.000Z' },
  { id: 'aud-2', actor: 'Admin', actorRole: 'superAdmin', action: 'Preislistenfreigabe erteilt', target: 'kia-sportage', createdAt: '2026-05-29T08:00:00.000Z' },
  { id: 'aud-3', actor: 'Sarah Klein', actorRole: 'sales', action: 'Angebot erstellt', target: 'lead-demo-002', createdAt: '2026-05-28T14:20:00.000Z' },
  { id: 'aud-4', actor: 'Mike Quach', actorRole: 'dealerAdmin', action: 'Konditionen veröffentlicht', target: 'autohaus-trinkle', createdAt: '2026-05-27T11:00:00.000Z' },
  { id: 'aud-5', actor: 'System', actorRole: 'system', action: 'Backup erstellt', target: 'local', createdAt: '2026-05-26T03:00:00.000Z' },
];

export const DEMO_DEALER_DOMAINS = [
  { id: 'dom-trinkle', dealerId: 'autohaus-trinkle', dealerName: 'Autohaus Trinkle', subdomain: 'autohaus-trinkle', host: 'autohaus-trinkle.clever-neuwagen.de', ssl: true, status: 'active', redirect: null },
  { id: 'dom-mueller', dealerId: 'autohaus-mueller', dealerName: 'Autohaus Müller', subdomain: 'autohaus-mueller', host: 'autohaus-mueller.clever-neuwagen.de', ssl: true, status: 'active', redirect: null },
  { id: 'dom-stuttgart', dealerId: 'autohaus-stuttgart', dealerName: 'Autohaus Stuttgart', subdomain: 'autohaus-stuttgart', host: 'autohaus-stuttgart.clever-neuwagen.de', ssl: true, status: 'active', redirect: null },
];

export const DEMO_BACKUPS = [
  { id: 'bak-1', label: 'Backup 29.05.2026 03:00', size: '2,4 MB', createdAt: '2026-05-29T03:00:00.000Z', type: 'local' },
  { id: 'bak-2', label: 'Backup 28.05.2026 03:00', size: '2,3 MB', createdAt: '2026-05-28T03:00:00.000Z', type: 'local' },
];

export const PILOT_DEALER_ID = 'autohaus-trinkle';

export const DEMO_PILOT_NOTES = [
  { id: 'pn-1', text: 'Leasingfaktor-Validierung vor Angebotserstellung verbessern', priority: 'high', createdAt: '2026-05-28T10:00:00.000Z' },
  { id: 'pn-2', text: 'E-Mail-Versand für Auslieferungsbestätigung produktiv schalten', priority: 'medium', createdAt: '2026-05-27T15:00:00.000Z' },
  { id: 'pn-3', text: 'Mobile Konfigurator-Performance auf S25 optimiert', priority: 'done', createdAt: '2026-05-26T09:00:00.000Z' },
];
