import { useRef, useState } from 'react';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_REFERENCE_TYPES,
  attachAkteDocument,
  getAkteDocuments,
  getDocumentCategoryLabel,
  removeAkteDocument,
  replaceAkteDocumentFile,
  updateAkteDocument,
} from '../../services/customerAkteDocuments.js';
import { isAcceptedUnterlagenFile } from '../../services/cleverUnterlagen.js';
import './CustomerAkteDocumentsPanel.css';

function formatUploadWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function DocumentRow({
  doc,
  active,
  onSelect,
}) {
  return (
    <button
      type="button"
      className={`cust-docs-row${active ? ' cust-docs-row--active' : ''}`}
      onClick={() => onSelect(doc.id)}
    >
      <span className="cust-docs-row__name">{doc.fileName}</span>
      <span className="cust-docs-row__meta">
        {getDocumentCategoryLabel(doc.category)}
        {doc.uploadedAt ? ` · ${formatUploadWhen(doc.uploadedAt)}` : ''}
      </span>
    </button>
  );
}

/**
 * Strukturierte Dokumente mit Kategorie & Bezug.
 */
export default function CustomerAkteDocumentsPanel({
  unterlagen,
  vehicleCards = [],
  onPersist,
  onDocumentAdded,
  showToast,
}) {
  const fileRef = useRef(null);
  const replaceRef = useRef(null);
  const [activeDocId, setActiveDocId] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    category: 'sonstiges',
    referenceType: 'customer',
    referenceLabel: '',
    description: '',
  });

  const documents = getAkteDocuments(unterlagen);
  const activeDoc = documents.find((d) => d.id === activeDocId) ?? null;

  function persist(next, historyText) {
    onPersist?.(next, historyText ?? 'Dokument aktualisiert', 'unterlagen');
  }

  async function handleUpload(file) {
    if (!file) return;
    if (!isAcceptedUnterlagenFile(file)) {
      showToast?.('Bitte PDF oder Bild wählen');
      return;
    }
    try {
      const next = await attachAkteDocument(unterlagen, file, uploadForm);
      persist(next, `${getDocumentCategoryLabel(uploadForm.category)} hochgeladen`);
      onDocumentAdded?.(next.documents[0], next);
      showToast?.('Dokument gespeichert');
      setUploadForm((prev) => ({ ...prev, description: '', referenceLabel: '' }));
    } catch {
      showToast?.('Upload fehlgeschlagen');
    }
  }

  async function handleReplace(file) {
    if (!activeDocId || !file) return;
    try {
      const next = await replaceAkteDocumentFile(unterlagen, activeDocId, file);
      persist(next, 'Dokument ersetzt');
      showToast?.('Datei ersetzt');
    } catch {
      showToast?.('Ersetzen fehlgeschlagen');
    }
  }

  function patchActiveDoc(patch) {
    if (!activeDocId) return;
    const next = updateAkteDocument(unterlagen, activeDocId, patch);
    persist(next);
  }

  return (
    <section className="cust-docs" aria-labelledby="cust-docs-title">
      <div className="cust-docs__head">
        <h3 id="cust-docs-title" className="cust-docs__title">Dokumente</h3>
        <p className="cust-docs__hint">DAT, Ablöse, Ausweis & mehr – mit Kategorie und Bezug.</p>
      </div>

      <div className="cust-docs__upload-card">
        <div className="cust-docs__fields">
          <label className="cust-docs__label">
            Kategorie
            <select
              className="cust-docs__select"
              value={uploadForm.category}
              onChange={(e) => setUploadForm((p) => ({ ...p, category: e.target.value }))}
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </label>
          <label className="cust-docs__label">
            Bezug
            <select
              className="cust-docs__select"
              value={uploadForm.referenceType}
              onChange={(e) => setUploadForm((p) => ({ ...p, referenceType: e.target.value }))}
            >
              {DOCUMENT_REFERENCE_TYPES.map((ref) => (
                <option key={ref.id} value={ref.id}>{ref.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="cust-docs__label">
          Bezug (kurz)
          <input
            type="text"
            className="cust-docs__input"
            value={uploadForm.referenceLabel}
            onChange={(e) => setUploadForm((p) => ({ ...p, referenceLabel: e.target.value }))}
            placeholder="z. B. Inzahlungnahme EV6"
          />
        </label>
        <label className="cust-docs__label">
          Notiz
          <input
            type="text"
            className="cust-docs__input"
            value={uploadForm.description}
            onChange={(e) => setUploadForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="z. B. Händlerverkaufswert 34.356 €"
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*,application/pdf"
          className="cust-docs__file"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
        <button type="button" className="cust-docs__upload-btn" onClick={() => fileRef.current?.click()}>
          Dokument hochladen
        </button>
      </div>

      {documents.length > 0 && (
        <div className="cust-docs__list-wrap">
          <div className="cust-docs__list">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                active={doc.id === activeDocId}
                onSelect={setActiveDocId}
              />
            ))}
          </div>

          {activeDoc && (
            <div className="cust-docs__detail">
              <p className="cust-docs__detail-title">{activeDoc.fileName}</p>
              <label className="cust-docs__label">
                Kategorie
                <select
                  className="cust-docs__select"
                  value={activeDoc.category}
                  onChange={(e) => patchActiveDoc({ category: e.target.value })}
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </label>
              <label className="cust-docs__label">
                Bezug
                <select
                  className="cust-docs__select"
                  value={activeDoc.referenceType}
                  onChange={(e) => patchActiveDoc({ referenceType: e.target.value })}
                >
                  {DOCUMENT_REFERENCE_TYPES.map((ref) => (
                    <option key={ref.id} value={ref.id}>{ref.label}</option>
                  ))}
                </select>
              </label>
              <label className="cust-docs__label">
                Bezug (kurz)
                <input
                  type="text"
                  className="cust-docs__input"
                  defaultValue={activeDoc.referenceLabel ?? ''}
                  key={`${activeDoc.id}-ref`}
                  onBlur={(e) => patchActiveDoc({ referenceLabel: e.target.value })}
                />
              </label>
              <label className="cust-docs__label">
                Beschreibung
                <textarea
                  className="cust-docs__textarea"
                  rows={2}
                  defaultValue={activeDoc.description ?? ''}
                  key={`${activeDoc.id}-desc`}
                  onBlur={(e) => patchActiveDoc({ description: e.target.value })}
                />
              </label>
              <p className="cust-docs__date">
                Hochgeladen: {formatUploadWhen(activeDoc.uploadedAt)}
              </p>
              <div className="cust-docs__actions">
                {activeDoc.dataUrl && (
                  <a
                    href={activeDoc.dataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cust-docs__action"
                  >
                    Öffnen
                  </a>
                )}
                <button
                  type="button"
                  className="cust-docs__action"
                  onClick={() => replaceRef.current?.click()}
                >
                  Ersetzen
                </button>
                <button
                  type="button"
                  className="cust-docs__action cust-docs__action--danger"
                  onClick={() => {
                    const next = removeAkteDocument(unterlagen, activeDoc.id);
                    persist(next, 'Dokument gelöscht');
                    setActiveDocId(null);
                    showToast?.('Gelöscht');
                  }}
                >
                  Löschen
                </button>
              </div>
              <input
                ref={replaceRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*,application/pdf"
                className="cust-docs__file"
                onChange={(e) => handleReplace(e.target.files?.[0])}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
