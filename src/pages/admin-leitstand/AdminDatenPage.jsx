import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../../hooks/usePageSeo';
import {
  AlPageHeader,
  AlSection,
  AlReleaseCard,
  AlLinkGrid,
} from '../../components/admin/leitstand/AdminLeitstandShell.jsx';
import '../../components/admin/leitstand/adminLeitstand.css';
import { listReleases, publishReleaseToDealers } from '../../services/admin/leitstand/adminReleaseCenter.js';
import { getAdminLeitstandState, subscribeAdminLeitstand } from '../../services/admin/leitstand/adminLeitstandStore.js';
import { getBrandDashboard } from '../../data/vehicleDataService.js';

const DATA_LINKS = [
  { to: '/admin/daten/fahrzeuge', label: 'Fahrzeugpflege', emoji: '🚗', hint: 'Marken & Modelle' },
  { to: '/admin/import', label: 'Preislisten', emoji: '📋', hint: 'Import & Freigabe' },
  { to: '/admin/compliance', label: 'WLTP / CO₂', emoji: '⚡', hint: 'Compliance Shield' },
  { to: '/admin/datenpruefung', label: 'Datenprüfung', emoji: '🔍', hint: 'Qualität & Inspector' },
  { to: '/admin/foundation', label: 'Konfigurator', emoji: '🧩', hint: 'Fundament & Regeln' },
  { to: '/admin/approvals', label: 'Freigaben', emoji: '✓', hint: 'Approval Center' },
];

export default function AdminDatenPage() {
  const [leitstand, setLeitstand] = useState(getAdminLeitstandState);
  const brands = getBrandDashboard();

  useEffect(() => subscribeAdminLeitstand(setLeitstand), []);

  usePageSeo({
    title: 'Admin · Daten',
    description: 'Zentrale Fahrzeugdaten – Entwurf → Prüfung → Freigabe.',
    path: '/admin/daten',
  });

  const releases = leitstand.releases?.length ? leitstand.releases : listReleases();

  function handlePublish(releaseId) {
    publishReleaseToDealers(releaseId, 'Mike');
  }

  return (
    <>
      <AlPageHeader
        title="Daten"
        subtitle="Entwurf → Prüfung → Freigabe → alle Händler aktualisieren."
      />

      <AlSection
        title="Release-Center"
        action={<Link to="/admin/import" className="al-btn al-btn--ghost">Import →</Link>}
      >
        <p className="al-header__sub" style={{ marginBottom: 12 }}>
          Nichts geht sofort live. Erst prüfen, dann veröffentlichen.
        </p>
        {releases.map((release) => (
          <AlReleaseCard key={release.id} release={release} onPublish={handlePublish} />
        ))}
        {!releases.length && (
          <p className="al-empty">Keine ausstehenden Releases.</p>
        )}
      </AlSection>

      <AlSection title="Marken-Status">
        <div className="al-kpi-grid">
          {brands.map((brand) => (
            <article key={brand.id} className="al-kpi">
              <span className="al-kpi__emoji">{brand.status === 'active' ? '🟢' : '⚪'}</span>
              <p className="al-kpi__value">{brand.name}</p>
              <p className="al-kpi__label">{brand.modelCount} Modelle</p>
              <p className="al-kpi__hint">🟢 {brand.stats.current} · 🟡 {brand.stats.review} · 🔴 {brand.stats.outdated}</p>
            </article>
          ))}
        </div>
      </AlSection>

      <AlSection title="Bereiche">
        <AlLinkGrid links={DATA_LINKS} />
      </AlSection>

      <AlSection title="Workflow">
        <div className="al-timeline">
          <div className="al-timeline__item">
            <span className="al-timeline__time">1</span>
            <div className="al-timeline__body">
              <p className="al-timeline__text"><strong>Entwurf</strong> – Daten bearbeiten (Import, Admin)</p>
            </div>
          </div>
          <div className="al-timeline__item">
            <span className="al-timeline__time">2</span>
            <div className="al-timeline__body">
              <p className="al-timeline__text"><strong>Prüfung</strong> – Datenprüfung & Compliance</p>
            </div>
          </div>
          <div className="al-timeline__item">
            <span className="al-timeline__time">3</span>
            <div className="al-timeline__body">
              <p className="al-timeline__text"><strong>Freigabe</strong> – Release-Center</p>
            </div>
          </div>
          <div className="al-timeline__item">
            <span className="al-timeline__time">4</span>
            <div className="al-timeline__body">
              <p className="al-timeline__text"><strong>Veröffentlichung</strong> – alle Händler synchron</p>
            </div>
          </div>
        </div>
      </AlSection>
    </>
  );
}
