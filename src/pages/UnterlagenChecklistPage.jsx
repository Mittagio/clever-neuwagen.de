import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import usePageSeo from '../hooks/usePageSeo';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import {
  getDocumentRequest,
  validateDocumentRequestAccess,
  markRequestSlotUploaded,
  getRequestProgress,
  formatRequestExpiry,
} from '../logic/documentRequestService.js';
import { addOfferDocument } from '../services/offerDocumentService.js';
import { DOCUMENT_REQUEST_STATUS } from '../data/documentRequestTypes.js';
import { OFFER_DIALOG_EVENTS } from '../data/offerDialogTypes.js';
import { buildOfferPath } from '../logic/offerService.js';
import BrandLogo from '../components/layout/BrandLogo.jsx';
import '../components/layout/BrandLogo.css';
import './UnterlagenChecklistPage.css';
import './CustomerPage.css';

export default function UnterlagenChecklistPage() {
  const { requestId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { isLoggedIn, email, registerDocument } = useCustomerAuth();
  const { leads, updateLead, addHistory } = useLeads();
  const [request, setRequest] = useState(() => getDocumentRequest(requestId));
  const [toast, setToast] = useState('');

  usePageSeo({
    title: 'Unterlagen einreichen',
    description: 'Checkliste für Ausweis, Gehaltsnachweise und Selbstauskunft – 48h sicherer Upload.',
    path: `/mein-bereich/unterlagen/${requestId}`,
  });

  useEffect(() => {
    setRequest(getDocumentRequest(requestId));
  }, [requestId]);

  const access = useMemo(() => {
    if (!request) return { valid: false, code: 'NOT_FOUND' };
    if (isLoggedIn && email && request.customerEmail === email.trim().toLowerCase()) {
      return { valid: true, via: 'account' };
    }
    return validateDocumentRequestAccess(request, token);
  }, [request, token, isLoggedIn, email]);

  const progress = useMemo(
    () => (request ? getRequestProgress(request) : { done: 0, total: 0, percent: 0 }),
    [request],
  );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function syncLeadDocuments(updatedRequest, slotType, doc) {
    const lead = leads.find((l) => l.id === updatedRequest.leadId);
    if (!lead) return;

    const docEntry = {
      id: doc.id,
      type: slotType,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
      expiresAt: doc.expiresAt,
      requestId: updatedRequest.id,
    };

    updateLead(lead.id, {
      documents: [
        docEntry,
        ...(lead.documents ?? []).filter((d) => d.type !== slotType || d.requestId !== updatedRequest.id),
      ],
    });

    addHistory(
      lead.id,
      `${OFFER_DIALOG_EVENTS.document_uploaded.label}: ${doc.fileName}`,
      'offer_dialog',
      {
        channel: 'offer',
        direction: 'inbound',
        offerCode: updatedRequest.offerCode,
        eventId: 'document_uploaded',
      },
    );
  }

  function handleUpload(slotType, files) {
    if (!request || !files?.length) return;
    const file = files[0];
    const doc = addOfferDocument(request.offerCode, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      slotType,
      requestId: request.id,
    });

    const updated = markRequestSlotUploaded(request.id, slotType, doc);
    setRequest(updated);

    if (isLoggedIn) {
      registerDocument({
        offerCode: request.offerCode,
        fileName: file.name,
        fileSize: file.size,
        label: doc.slotLabel,
      });
    }

    syncLeadDocuments(updated, slotType, doc);
    showToast('Dokument hochgeladen');
  }

  if (!request) {
    return (
      <div className="customer-page unterlagen-page">
        <header className="customer-page-header">
          <Link to="/" className="customer-page-logo" aria-label="Clever-Neuwagen">
            <BrandLogo variant="full" />
          </Link>
        </header>
        <main className="unterlagen-page__empty">
          <h1>Anforderung nicht gefunden</h1>
          <Link to="/mein-bereich">Zum Kundenbereich</Link>
        </main>
      </div>
    );
  }

  if (!access.valid) {
    return (
      <div className="customer-page unterlagen-page">
        <header className="customer-page-header">
          <Link to="/" className="customer-page-logo" aria-label="Clever-Neuwagen">
            <BrandLogo variant="full" />
          </Link>
        </header>
        <main className="unterlagen-page__empty">
          <h1>{access.message ?? 'Zugriff nicht möglich'}</h1>
          <p>Bitte öffnen Sie den Link aus Ihrer E-Mail oder melden Sie sich an.</p>
          <Link to="/login">Anmelden</Link>
        </main>
      </div>
    );
  }

  const isExpired = request.status === DOCUMENT_REQUEST_STATUS.expired.id;
  const selbstauskunftHref = `/selbstauskunft?offer=${encodeURIComponent(request.offerCode ?? '')}&request=${encodeURIComponent(request.id)}`;

  return (
    <div className="customer-page unterlagen-page">
      <header className="customer-page-header">
        <Link to="/" className="customer-page-logo" aria-label="Clever-Neuwagen">
          <BrandLogo variant="full" />
        </Link>
        <p className="customer-page-title">Unterlagen einreichen</p>
      </header>

      <main className="unterlagen-page__main">
        <div className="unterlagen-card">
          <div className="unterlagen-card__head">
            <div>
              <p className="unterlagen-card__kicker">48h-Dokumenten-Tresor</p>
              <h1>Ihre Checkliste</h1>
              {request.offerCode && (
                <p className="unterlagen-card__offer">
                  Angebot{' '}
                  <Link to={buildOfferPath(request.offerCode)}>{request.offerCode}</Link>
                </p>
              )}
            </div>
            <div className="unterlagen-card__progress" aria-label={`${progress.percent}% erledigt`}>
              <span>{progress.done}/{progress.total}</span>
              <div className="unterlagen-card__bar">
                <div className="unterlagen-card__bar-fill" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          </div>

          {request.dealerMessage && (
            <p className="unterlagen-card__message">{request.dealerMessage}</p>
          )}

          <p className={`unterlagen-card__expiry${isExpired ? ' is-expired' : ''}`}>
            {isExpired ? 'Frist abgelaufen' : formatRequestExpiry(request.expiresAt)}
          </p>

          <ul className="unterlagen-checklist">
            {request.slots.map((slot) => {
              const isDone = slot.status === 'uploaded' || slot.status === 'completed';
              const isForm = slot.kind === 'form';

              return (
                <li
                  key={slot.type}
                  className={`unterlagen-checklist__item${isDone ? ' is-done' : ''}`}
                >
                  <div className="unterlagen-checklist__info">
                    <span className="unterlagen-checklist__status" aria-hidden>
                      {isDone ? '✓' : '○'}
                    </span>
                    <div>
                      <strong>{slot.label}</strong>
                      {isDone && slot.fileName && (
                        <p className="unterlagen-checklist__file">{slot.fileName}</p>
                      )}
                    </div>
                  </div>

                  {!isExpired && !isDone && (
                    isForm ? (
                      <Link to={selbstauskunftHref} className="unterlagen-checklist__action">
                        Ausfüllen
                      </Link>
                    ) : (
                      <label className="unterlagen-checklist__upload">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.heic"
                          onChange={(e) => {
                            handleUpload(slot.type, e.target.files);
                            e.target.value = '';
                          }}
                        />
                        Hochladen
                      </label>
                    )
                  )}
                </li>
              );
            })}
          </ul>

          {request.status === DOCUMENT_REQUEST_STATUS.completed.id && (
            <p className="unterlagen-card__success">
              ✓ Alle Unterlagen eingereicht – Ihr Verkäufer wurde informiert.
            </p>
          )}

          <div className="unterlagen-card__footer">
            <Link to="/mein-bereich">Mein Bereich</Link>
            {request.offerCode && (
              <Link to={buildOfferPath(request.offerCode)}>Zur Angebotsseite</Link>
            )}
          </div>
        </div>

        {toast && <p className="unterlagen-page__toast">{toast}</p>}
      </main>
    </div>
  );
}
