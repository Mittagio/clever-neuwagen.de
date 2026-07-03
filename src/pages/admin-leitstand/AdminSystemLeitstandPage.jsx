import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../../hooks/usePageSeo';
import { usePriceListImport } from '../../context/PriceListImportContext.jsx';
import { useLaunchAdmin } from '../../context/LaunchAdminContext.jsx';
import {
  AlPageHeader,
  AlSection,
  AlHealthCard,
  AlMailRow,
  AlLinkGrid,
} from '../../components/admin/leitstand/AdminLeitstandShell.jsx';
import '../../components/admin/leitstand/adminLeitstand.css';
import { buildSystemHealthModel, probeApiHealth } from '../../services/admin/leitstand/adminSystemHealth.js';
import { listMailOutbox, retryMail, MAIL_FROM } from '../../services/admin/leitstand/mailOutboxService.js';
import { getAdminLeitstandState, subscribeAdminLeitstand } from '../../services/admin/leitstand/adminLeitstandStore.js';
import { buildActivityFeedGrouped } from '../../services/admin/leitstand/adminActivityFeed.js';

export default function AdminSystemLeitstandPage() {
  const { getMetrics } = usePriceListImport();
  const { systemIssues, auditLog } = useLaunchAdmin();
  const importMetrics = getMetrics();
  const [leitstand, setLeitstand] = useState(getAdminLeitstandState);
  const [apiHealth, setApiHealth] = useState(null);

  useEffect(() => subscribeAdminLeitstand(setLeitstand), []);

  useEffect(() => {
    probeApiHealth().then(setApiHealth);
  }, []);

  usePageSeo({
    title: 'Admin · System',
    description: 'Systemstatus, Mail-Outbox und Aktivitätsfeed.',
    path: '/admin/system',
  });

  const health = buildSystemHealthModel({
    apiHealth,
    mailOutbox: leitstand.mailOutbox,
    importMetrics,
    systemIssues,
  });

  const mailItems = listMailOutbox();
  const activity = buildActivityFeedGrouped(leitstand.activityFeed);

  return (
    <>
      <AlPageHeader
        title="System"
        subtitle={`Kommunikations-Hub: ${MAIL_FROM}`}
        action={(
          <Link to="/admin/email" className="al-btn al-btn--ghost">Vorlagen →</Link>
        )}
      />

      {health.sections.map((section) => (
        <AlHealthCard key={section.id} title={section.title} items={section.items} />
      ))}

      <AlSection title="Mail-Outbox" id="mail">
        <p className="al-header__sub" style={{ marginBottom: 10 }}>
          Versendet · Warteschlange · Fehlgeschlagen · Erneut senden
        </p>
        {mailItems.map((mail) => (
          <AlMailRow
            key={mail.id}
            mail={mail}
            onRetry={(id) => retryMail(id)}
          />
        ))}
        {!mailItems.length && <p className="al-empty">Outbox leer.</p>}
      </AlSection>

      <AlSection
        title="Aktivitätsfeed"
        action={<Link to="/admin/audit" className="al-btn al-btn--ghost">Audit →</Link>}
      >
        <ul className="al-activity-feed">
          {activity.slice(0, 15).map((entry) => (
            <li key={entry.id} className="al-activity-feed__item">
              <p className="al-activity-feed__actor">{entry.actor}</p>
              <p className="al-activity-feed__action">{entry.action}</p>
              {entry.detail ? <p className="al-timeline__detail">{entry.detail}</p> : null}
              <time className="al-activity-feed__time" dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString('de-DE')}
              </time>
            </li>
          ))}
        </ul>
        {!activity.length && auditLog?.length > 0 && (
          <ul className="al-activity-feed">
            {auditLog.slice(0, 10).map((log) => (
              <li key={log.id} className="al-activity-feed__item">
                <p className="al-activity-feed__actor">{log.actor}</p>
                <p className="al-activity-feed__action">{log.action}</p>
                <time className="al-activity-feed__time">{log.createdAt}</time>
              </li>
            ))}
          </ul>
        )}
      </AlSection>

      <AlSection title="Erweitert">
        <AlLinkGrid links={[
          { to: '/admin/launch', label: 'Launch', emoji: '🚀' },
          { to: '/admin/launch/system', label: 'Fehlercenter', emoji: '🔧' },
          { to: '/admin/analytics', label: 'Analytics', emoji: '📈' },
          { to: '/admin/billing', label: 'Abrechnung', emoji: '💶' },
        ]}
        />
      </AlSection>
    </>
  );
}
