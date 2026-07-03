import { useMemo } from 'react';
import usePageSeo from '../../hooks/usePageSeo';
import { useDealerAdmin } from '../../context/DealerAdminContext.jsx';
import { useDealerRegistration } from '../../context/DealerRegistrationContext.jsx';
import { usePriceListImport } from '../../context/PriceListImportContext.jsx';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import { listLearningRequests } from '../../services/admin/cleverLearningRequestService.js';
import {
  AlPageHeader,
  AlTaskCard,
} from '../../components/admin/leitstand/AdminLeitstandShell.jsx';
import '../../components/admin/leitstand/adminLeitstand.css';
import { buildAdminTaskQueue, groupTasksByPriority, TASK_PRIORITY } from '../../services/admin/leitstand/adminTaskQueue.js';

export default function AdminAufgabenPage() {
  const { approvals } = useDealerAdmin();
  const { applications } = useDealerRegistration();
  const { getMetrics } = usePriceListImport();
  const { systemIssues } = useLaunchAdmin();
  const importMetrics = getMetrics();

  usePageSeo({
    title: 'Admin · Aufgaben',
    description: 'Priorisierte Aufgaben für den Clever Admin.',
    path: '/admin/aufgaben',
  });

  const tasks = useMemo(() => buildAdminTaskQueue({
    approvals,
    importMetrics,
    applications,
    systemIssues,
    learningRequests: listLearningRequests(),
  }), [approvals, importMetrics, applications, systemIssues]);

  const grouped = useMemo(() => groupTasksByPriority(tasks), [tasks]);

  return (
    <>
      <AlPageHeader
        title="Aufgaben"
        subtitle="Von oben nach unten abarbeiten – nicht nach Modulen suchen."
      />

      {(['urgent', 'today', 'later']).map((key) => {
        const meta = TASK_PRIORITY[key];
        const items = grouped[key];
        if (!items.length) return null;
        return (
          <div key={key} className="al-task-group">
            <h2 className="al-task-group__title">{meta.emoji} {meta.label}</h2>
            {items.map((task) => (
              <AlTaskCard key={task.id} task={task} />
            ))}
          </div>
        );
      })}

      {!tasks.length && (
        <p className="al-empty">Keine offenen Aufgaben – alles erledigt.</p>
      )}
    </>
  );
}
