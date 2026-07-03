import { listComplianceVehicles } from '../../../logic/complianceShield.js';
import { COMPLIANCE_STATUS } from '../../../data/complianceSchema.js';
import { listMailOutbox } from '../../mail/mailOutboxService.js';

export const TASK_PRIORITY = {
  urgent: { id: 'urgent', label: 'Sofort', emoji: '🔴', order: 0 },
  today: { id: 'today', label: 'Heute', emoji: '🟠', order: 1 },
  later: { id: 'later', label: 'Später', emoji: '🔵', order: 2 },
};

/**
 * @param {object} ctx
 * @returns {object[]}
 */
export function buildAdminTaskQueue({
  approvals = [],
  importMetrics = {},
  applications = [],
  systemIssues = [],
  learningRequests = [],
} = {}) {
  const tasks = [];
  const mailOutbox = listMailOutbox();

  for (const approval of approvals.filter((a) => a.status === 'pending')) {
    tasks.push({
      id: `approval-${approval.id}`,
      priority: approval.type === 'dealer' ? 'urgent' : 'today',
      title: approval.title,
      subtitle: approval.subtitle,
      category: 'Freigabe',
      href: '/admin/approvals',
      actionLabel: 'Freigabe prüfen',
    });
  }

  for (const vehicle of listComplianceVehicles()) {
    if (vehicle.status === COMPLIANCE_STATUS.missing) {
      tasks.push({
        id: `compliance-${vehicle.engineId}`,
        priority: 'urgent',
        title: 'WLTP / CO₂ fehlt',
        subtitle: vehicle.vehicleLabel ?? vehicle.engineId,
        category: 'Compliance',
        href: '/admin/compliance',
        actionLabel: 'Daten ergänzen',
      });
    } else if (vehicle.status === COMPLIANCE_STATUS.needs_review) {
      tasks.push({
        id: `compliance-review-${vehicle.engineId}`,
        priority: 'today',
        title: 'CO₂ / Verbrauch prüfen',
        subtitle: vehicle.vehicleLabel ?? vehicle.engineId,
        category: 'Compliance',
        href: '/admin/compliance',
        actionLabel: 'Prüfen',
      });
    }
  }

  if (importMetrics.pending > 0) {
    tasks.push({
      id: 'import-pending',
      priority: 'today',
      title: 'Preislistenimport prüfen',
      subtitle: `${importMetrics.pending} Import(e) warten auf Freigabe`,
      category: 'Import',
      href: '/admin/import',
      actionLabel: 'Import öffnen',
    });
  }

  for (const mail of mailOutbox.filter((m) => m.status === 'failed')) {
    const leadId = mail.leadId ?? mail.meta?.leadId ?? null;
    const leadHint = leadId ? `Lead ${leadId} · ` : '';
    tasks.push({
      id: `mail-${mail.id}`,
      priority: 'urgent',
      title: 'Mail konnte nicht versendet werden',
      subtitle: `${leadHint}${mail.to} · ${mail.error ?? 'Unbekannter Fehler'}`,
      category: 'Mail',
      href: leadId ? `/dealer-ai/lead/${leadId}` : '/admin/system#mail',
      actionLabel: leadId ? 'Kundenakte öffnen' : 'Outbox öffnen',
    });
  }

  for (const app of applications.filter((a) => a.status === 'submitted' || a.status === 'review')) {
    tasks.push({
      id: `onboarding-${app.id}`,
      priority: 'today',
      title: 'Händler wartet auf Freigabe',
      subtitle: app.companyName ?? app.contactName ?? 'Neue Registrierung',
      category: 'Onboarding',
      href: '/admin/onboarding',
      actionLabel: 'Onboarding',
    });
  }

  for (const issue of systemIssues.filter((i) => i.type === 'critical')) {
    tasks.push({
      id: `sys-${issue.id}`,
      priority: 'urgent',
      title: issue.title,
      subtitle: issue.detail,
      category: 'System',
      href: '/admin/system',
      actionLabel: 'System prüfen',
    });
  }

  for (const req of learningRequests.filter((r) => r.status === 'open')) {
    tasks.push({
      id: `learn-${req.id}`,
      priority: 'later',
      title: 'Support / Lernanfrage offen',
      subtitle: req.question ?? req.summary ?? 'Clever-Lexikon',
      category: 'Support',
      href: '/admin/datenpruefung',
      actionLabel: 'Bearbeiten',
    });
  }

  return tasks.sort((a, b) => {
    const pa = TASK_PRIORITY[a.priority]?.order ?? 9;
    const pb = TASK_PRIORITY[b.priority]?.order ?? 9;
    return pa - pb;
  });
}

export function groupTasksByPriority(tasks = []) {
  return {
    urgent: tasks.filter((t) => t.priority === 'urgent'),
    today: tasks.filter((t) => t.priority === 'today'),
    later: tasks.filter((t) => t.priority === 'later'),
  };
}
