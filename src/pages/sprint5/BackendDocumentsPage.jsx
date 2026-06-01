import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { DOCUMENT_TYPES } from '../../data/documentTypes.js';
import { getDocumentTypeLabel } from '../../data/documentTypes.js';
import {
  deleteDocument,
  fetchDocuments,
  fetchSelbstauskunftList,
  getDocumentDownloadUrl,
  uploadDocument,
} from '../../services/documentVaultApi.js';
import {
  auditDocumentDeleted,
  auditDocumentUploaded,
} from '../../services/sprint5Audit.js';
import {
  formatGermanDateTime,
  formatExpiryCountdown,
  getDocumentStatus,
  DOCUMENT_TTL_HOURS,
} from '../../utils/documentExpiry.js';
import './Sprint5Shared.css';
import './BackendDocumentsPage.css';

export default function BackendDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadType, setUploadType] = useState('personalausweis');
  const [leadId, setLeadId] = useState('');
  const [tick, setTick] = useState(0);
  const [selbstauskunft, setSelbstauskunft] = useState([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, sa] = await Promise.all([
        fetchDocuments({ includeDeleted: showDeleted }),
        fetchSelbstauskunftList().catch(() => []),
      ]);
      setDocuments(list);
      setSelbstauskunft(sa);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      load();
    }, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  usePageSeo({
    title: 'Dokumenten-Tresor',
    description: 'DSGVO-konforme Dokumentenverwaltung mit 48h Auto-Löschung.',
    path: '/backend/documents',
  });

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { document } = await uploadDocument({
        file,
        fileType: uploadType,
        leadId: leadId || undefined,
        sellerName: 'Verkäufer Trinkle',
      });
      auditDocumentUploaded(document, 'Kunde');
      await load();
    } catch (err) {
      setError(err.message);
    }
    e.target.value = '';
  }

  async function handleDelete(id) {
    if (!window.confirm('Dokument jetzt löschen? Datei wird unwiderruflich entfernt.')) return;
    try {
      const { document } = await deleteDocument(id);
      auditDocumentDeleted(document, { automatic: false, actor: 'Verkäufer' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PageShell>
      <div className="s5-page doc-vault">
        <Link to="/backend" className="s5-header__back">← Backend</Link>
        <p className="s5-header__kicker">DSGVO · Dokumenten-Tresor</p>
        <h1 className="s5-header__title">Sensible Dokumente</h1>
        <p className="s5-header__sub">
          Keine dauerhafte Archivierung. Automatische Löschung nach {DOCUMENT_TTL_HOURS} Stunden.
          Nach Löschung bleibt nur der Audit-Eintrag.
        </p>

        <div className="s5-banner s5-banner--info">
          Clever-Neuwagen ist kein Dokumentenarchiv. Dateien werden physisch vom Server entfernt.
        </div>

        {error && <div className="s5-banner s5-banner--warn" role="alert">{error}</div>}

        <section className="s5-card doc-vault__upload">
          <h2 className="s5-card__title">Demo-Upload (Kunde)</h2>
          <div className="s5-grid-2">
            <label className="s5-field">
              <span>Dokumententyp</span>
              <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="s5-field">
              <span>Lead-ID (optional)</span>
              <input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="lead-…" />
            </label>
          </div>
          <label className="s5-btn s5-btn--primary doc-vault__file-btn">
            Dokument hochladen
            <input type="file" hidden onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png" />
          </label>
        </section>

        <div className="doc-vault__toolbar">
          <label className="doc-vault__toggle">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Gelöschte / Audit-Einträge anzeigen
          </label>
          <button type="button" className="s5-btn s5-btn--ghost" onClick={load}>Aktualisieren</button>
        </div>

        {loading && <p className="doc-vault__muted">Lade Dokumente…</p>}

        <ul className="doc-vault__list">
          {documents.map((doc) => {
            const status = getDocumentStatus(doc);
            const countdown = doc.deletedAt
              ? '–'
              : formatExpiryCountdown(doc.expiresAt);
            void tick;

            return (
              <li key={doc.id} className={`doc-vault__item doc-vault__item--${status.tone}`}>
                <div className="doc-vault__item-head">
                  <h3>{getDocumentTypeLabel(doc.fileType)}</h3>
                  <span className="doc-vault__status">{status.emoji} {status.label}</span>
                </div>

                {!doc.deletedAt ? (
                  <>
                    <dl className="doc-vault__meta">
                      <div>
                        <dt>Hochgeladen</dt>
                        <dd>{formatGermanDateTime(doc.uploadedAt)}</dd>
                      </div>
                      <div>
                        <dt>Verkäufer</dt>
                        <dd>{doc.sellerName}</dd>
                      </div>
                      <div>
                        <dt>Löschung in</dt>
                        <dd className="doc-vault__countdown">{countdown}</dd>
                      </div>
                    </dl>
                    <div className="doc-vault__actions">
                      <a
                        href={getDocumentDownloadUrl(doc.id)}
                        className="s5-btn s5-btn--secondary"
                        download
                      >
                        Herunterladen
                      </a>
                      <button type="button" className="s5-btn s5-btn--ghost" onClick={() => handleDelete(doc.id)}>
                        Jetzt löschen
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="doc-vault__audit">
                    <p><strong>Dokumententyp:</strong> {getDocumentTypeLabel(doc.fileType)}</p>
                    <p><strong>Upload:</strong> {formatGermanDateTime(doc.uploadedAt)}</p>
                    <p><strong>Gelöscht:</strong> {formatGermanDateTime(doc.deletedAt)}</p>
                    <p><strong>Datei:</strong> nicht mehr vorhanden</p>
                    {doc.deletedAutomatically && (
                      <p className="doc-vault__muted">Automatisch nach Ablauf gelöscht</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {!loading && documents.length === 0 && (
          <p className="doc-vault__muted">Noch keine Dokumente im Tresor.</p>
        )}

        {selbstauskunft.length > 0 && (
          <section className="s5-card" style={{ marginTop: 24 }}>
            <h2 className="s5-card__title">Digitale Selbstauskunft (strukturiert)</h2>
            <ul className="doc-vault__list">
              {selbstauskunft.slice(0, 5).map((sa) => (
                <li key={sa.id} className="doc-vault__item">
                  <h3>{sa.personal?.firstName} {sa.personal?.lastName}</h3>
                  <p className="doc-vault__muted">
                    {formatGermanDateTime(sa.createdAt)} · Netto {sa.income?.netIncome ?? '–'} €
                    · {sa.employment?.employer ?? 'Arbeitgeber n. a.'}
                  </p>
                </li>
              ))}
            </ul>
            <Link to="/selbstauskunft" className="s5-header__back">Formular für Kunden →</Link>
          </section>
        )}
      </div>
    </PageShell>
  );
}
