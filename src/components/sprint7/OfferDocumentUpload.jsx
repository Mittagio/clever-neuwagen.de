import { useState } from 'react';
import { addOfferDocument, getOfferDocuments } from '../../services/offerDocumentService.js';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import './OfferDocumentUpload.css';

export default function OfferDocumentUpload({ offer }) {
  const { isLoggedIn, registerDocument } = useCustomerAuth();
  const [docs, setDocs] = useState(() => getOfferDocuments(offer.code));
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function handleFiles(e) {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;

    for (const file of files) {
      addOfferDocument(offer.code, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      if (isLoggedIn) {
        registerDocument({
          offerCode: offer.code,
          fileName: file.name,
          fileSize: file.size,
          vehicleLabel: offer.vehicle?.label,
        });
      }
    }
    setDocs(getOfferDocuments(offer.code));
    showToast(`${files.length} Dokument(e) hochgeladen`);
    e.target.value = '';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <section className="offer-docs card" id="dokumente">
      <h2>Dokumente</h2>
      <p className="offer-docs__hint">
        Führerschein, Ausweis oder Finanzierungsunterlagen – sicher an Ihren Ansprechpartner übermitteln.
      </p>
      <label className="offer-docs__drop">
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.heic"
          onChange={handleFiles}
          className="offer-docs__input"
        />
        <span className="offer-docs__drop-inner">
          <span className="offer-docs__icon" aria-hidden>↑</span>
          Dateien auswählen oder hier ablegen
        </span>
      </label>
      {docs.length > 0 && (
        <ul className="offer-docs__list">
          {docs.map((d) => (
            <li key={d.id}>
              <span className="offer-docs__name">{d.fileName}</span>
              <span className="offer-docs__meta">{formatSize(d.fileSize)} · {new Date(d.uploadedAt).toLocaleDateString('de-DE')}</span>
            </li>
          ))}
        </ul>
      )}
      {!isLoggedIn && (
        <p className="offer-docs__login-hint">
          <a href="/account">Anmelden</a>, um alle Dokumente im Kundenkonto zu sehen.
        </p>
      )}
      {toast && <p className="offer-docs__toast">{toast}</p>}
    </section>
  );
}
