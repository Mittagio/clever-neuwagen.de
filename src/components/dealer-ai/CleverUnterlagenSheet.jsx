import { useCallback, useRef, useState } from 'react';
import {
  UNTERLAGEN_STATUS,
  UNTERLAGEN_HISTORY,
  attachFileToUnterlageSlot,
  buildUnterlagenShareMessage,
  computeUnterlagenSummary,
  createUnterlagenUploadLink,
  getUnterlagenSubline,
  historyKeyForSlot,
  isAcceptedUnterlagenFile,
  markUnterlageStatus,
  removeUnterlageFile,
} from '../../services/cleverUnterlagen.js';
import {
  SELBSTAUSKUNFT_HISTORY,
  buildSelbstauskunftShareMessage,
  createSelbstauskunftLink,
  formatSelbstauskunftSummary,
  getSelbstauskunft,
  getSelbstauskunftStatusUi,
  markSelbstauskunftChecked,
  needsSelbstauskunft,
} from '../../services/cleverSelbstauskunft.js';
import { copyOfferLink } from '../../services/vehicleOffer.js';
import './CleverUnterlagenSheet.css';

function formatUploadWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function CleverUnterlagenSheet({
  lead,
  paymentType,
  customerName = '',
  phone = '',
  email = '',
  vehicleTitle = '',
  vehicleConditions = '',
  isGewerbe = false,
  onClose,
  onSave,
}) {
  const fileRef = useRef(null);
  const pdfRef = useRef(null);
  const [activeSlot, setActiveSlot] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState('');

  const pt = paymentType ?? lead?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, pt);
  const unterlagen = summary.data;
  const showSelbstauskunft = needsSelbstauskunft(pt);
  const selbstauskunft = getSelbstauskunft(unterlagen);
  const selbstauskunftUi = getSelbstauskunftStatusUi(selbstauskunft.status);
  const selbstauskunftSummary = formatSelbstauskunftSummary(
    selbstauskunft,
    selbstauskunft.uploadCount ?? Object.keys(selbstauskunft.uploads ?? {}).length,
  );

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  function persist(next, historyText, historyType = 'note') {
    onSave?.(next, historyText, historyType);
  }

  async function handleFile(file, slotId = activeSlot) {
    if (!slotId || !file) return;
    if (!isAcceptedUnterlagenFile(file)) {
      showToast('Bitte PDF oder Bild wählen');
      return;
    }
    const next = await attachFileToUnterlageSlot(unterlagen, slotId, file);
    const histKey = historyKeyForSlot(slotId);
    let histText = histKey ? UNTERLAGEN_HISTORY[histKey] : `${summary.slots.find((s) => s.id === slotId)?.label} hochgeladen`;
    if (slotId === 'selbstauskunft') {
      histText = SELBSTAUSKUNFT_HISTORY.pdf_uploaded;
    }
    persist(next, histText, slotId === 'selbstauskunft' ? 'selbstauskunft' : 'unterlagen');
    showToast('Unterlage hinterlegt');
    setActiveSlot(null);
  }

  function handleCreateSelbstauskunftLink() {
    const next = createSelbstauskunftLink(unterlagen, lead, {
      paymentType: pt,
      customerName,
      email,
      vehicleTitle,
      vehicleConditions,
      isGewerbe,
    });
    persist(next, SELBSTAUSKUNFT_HISTORY.link_created, 'selbstauskunft_link');
    showToast('Link bereit');
  }

  async function handleCopySelbstauskunftLink() {
    if (!selbstauskunft.link?.url) return;
    const ok = await copyOfferLink(selbstauskunft.link.url);
    if (ok) persist(unterlagen, SELBSTAUSKUNFT_HISTORY.link_sent_copy, 'selbstauskunft_sent');
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
  }

  function handleSelbstauskunftWhatsapp() {
    if (!selbstauskunft.link?.url) return;
    const msg = buildSelbstauskunftShareMessage({ customerName, url: selbstauskunft.link.url });
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) {
      showToast('Mit Telefonnummer geht WhatsApp schneller');
      return;
    }
    const normalized = digits.startsWith('0') ? `49${digits.slice(1)}` : digits;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    persist(unterlagen, SELBSTAUSKUNFT_HISTORY.link_sent_whatsapp, 'selbstauskunft_sent');
  }

  function handleSelbstauskunftEmail() {
    if (!selbstauskunft.link?.url) return;
    const msg = buildSelbstauskunftShareMessage({ customerName, url: selbstauskunft.link.url });
    if (!email?.trim()) {
      showToast('Mit E-Mail oder Telefonnummer ist der Link schneller beim Kunden.');
      return;
    }
    const subject = 'Selbstauskunft & Unterlagen – online ausfüllen';
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    persist(unterlagen, SELBSTAUSKUNFT_HISTORY.link_sent_email, 'selbstauskunft_sent');
  }

  function handleCreateLink() {
    const next = createUnterlagenUploadLink(lead, pt);
    persist(next, UNTERLAGEN_HISTORY.link_created, 'unterlagen_link');
    showToast('Link bereit');
  }

  async function handleCopyLink() {
    if (!unterlagen.uploadLink?.url) return;
    const ok = await copyOfferLink(unterlagen.uploadLink.url);
    showToast(ok ? 'Link kopiert' : 'Link konnte nicht kopiert werden');
  }

  function handleWhatsapp() {
    if (!unterlagen.uploadLink?.url) return;
    const msg = buildUnterlagenShareMessage({ customerName, url: unterlagen.uploadLink.url });
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) {
      showToast('Mit Telefonnummer geht WhatsApp schneller');
      return;
    }
    const normalized = digits.startsWith('0') ? `49${digits.slice(1)}` : digits;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    persist(unterlagen, UNTERLAGEN_HISTORY.link_sent_whatsapp, 'unterlagen_sent');
  }

  function handleEmail() {
    if (!unterlagen.uploadLink?.url) return;
    const msg = buildUnterlagenShareMessage({ customerName, url: unterlagen.uploadLink.url });
    if (!email?.trim()) {
      showToast('Mit E-Mail ist der Link schneller raus');
      return;
    }
    const subject = 'Ihre Unterlagen – sicher hochladen';
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    persist(unterlagen, UNTERLAGEN_HISTORY.link_sent_email, 'unterlagen_sent');
  }

  const isSelbstauskunftSlot = activeSlot === 'selbstauskunft';

  return (
    <div className="clever-unterlagen-sheet">
      <header className="clever-unterlagen-sheet__head">
        <button type="button" className="clever-unterlagen-sheet__close" onClick={onClose} aria-label="Schließen">
          ×
        </button>
        <div>
          <h2 className="clever-unterlagen-sheet__title">Clever Unterlagen</h2>
          <p className="clever-unterlagen-sheet__sub">{summary.headline}</p>
          <p className="clever-unterlagen-sheet__hint">{getUnterlagenSubline(pt)}</p>
        </div>
      </header>

      {showSelbstauskunft && (
        <section className="clever-sa-card">
          <div className="clever-sa-card__head">
            <h3 className="clever-sa-card__title">Selbstauskunft</h3>
            <span className={`clever-sa-card__status clever-sa-card__status--${selbstauskunftUi.tone}`}>
              {selbstauskunftSummary}
            </span>
          </div>
          <p className="clever-sa-card__hint">Mit Selbstauskunft ist die Bankanfrage startklar.</p>
          {!selbstauskunft.link?.url ? (
            <button
              type="button"
              className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--primary"
              onClick={handleCreateSelbstauskunftLink}
            >
              Selbstauskunft-Link senden
            </button>
          ) : (
            <>
              <p className="clever-sa-card__link-status">Link bereit</p>
              <div className="clever-unterlagen-sheet__link-actions">
                <button type="button" className="clever-unterlagen-sheet__btn" onClick={handleCopySelbstauskunftLink}>
                  Link kopieren
                </button>
                <button type="button" className="clever-unterlagen-sheet__btn" onClick={handleSelbstauskunftWhatsapp}>
                  WhatsApp
                </button>
                <button type="button" className="clever-unterlagen-sheet__btn" onClick={handleSelbstauskunftEmail}>
                  E-Mail
                </button>
              </div>
              {(!phone?.trim() && !email?.trim()) && (
                <p className="clever-sa-card__contact-hint">
                  Mit E-Mail oder Telefonnummer ist der Link schneller beim Kunden.
                </p>
              )}
            </>
          )}
          <div className="clever-sa-card__modes">
            <button type="button" className="clever-sa-card__mode" onClick={handleCreateSelbstauskunftLink}>
              Online ausfüllen lassen
            </button>
            <button type="button" className="clever-sa-card__mode" onClick={() => setActiveSlot('selbstauskunft')}>
              PDF hochladen
            </button>
          </div>
        </section>
      )}

      <ul className="clever-unterlagen-sheet__list">
        {summary.slots.map((slot) => {
          if (showSelbstauskunft && slot.id === 'selbstauskunft') return null;
          const item = unterlagen.items[slot.id] ?? { status: UNTERLAGEN_STATUS.open.id };
          const statusUi = UNTERLAGEN_STATUS[item.status] ?? UNTERLAGEN_STATUS.open;
          return (
            <li key={slot.id}>
              <button
                type="button"
                className="clever-unterlagen-sheet__row"
                onClick={() => setActiveSlot(slot.id)}
              >
                <span className="clever-unterlagen-sheet__row-label">{slot.label}</span>
                <span className={`clever-unterlagen-sheet__row-status clever-unterlagen-sheet__row-status--${statusUi.tone}`}>
                  {statusUi.label}
                </span>
                <span className="clever-unterlagen-sheet__row-chev" aria-hidden>›</span>
              </button>
            </li>
          );
        })}
      </ul>

      {activeSlot && (
        <div className="clever-unterlagen-sheet__detail">
          <p className="clever-unterlagen-sheet__detail-title">
            {isSelbstauskunftSlot ? 'Selbstauskunft (PDF)' : summary.slots.find((s) => s.id === activeSlot)?.label}
          </p>
          {unterlagen.items[activeSlot]?.fileName && (
            <p className="clever-unterlagen-sheet__detail-meta">
              {unterlagen.items[activeSlot].fileName}
              {unterlagen.items[activeSlot].uploadedAt
                ? ` · ${formatUploadWhen(unterlagen.items[activeSlot].uploadedAt)}`
                : ''}
            </p>
          )}

          {isSelbstauskunftSlot && (
            <p className="clever-sa-card__pdf-hint">
              Wenn der Kunde ein ausgefülltes PDF zurückschickt, können Sie es hier hochladen.
            </p>
          )}

          <div
            className={`clever-unterlagen-sheet__upload${dragOver ? ' clever-unterlagen-sheet__upload--drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer?.files?.[0]);
            }}
          >
            <p className="clever-unterlagen-sheet__upload-hint clever-unterlagen-sheet__upload-hint--desktop">
              PDF oder Bild hier ablegen
            </p>
            <input
              ref={isSelbstauskunftSlot ? pdfRef : fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*,application/pdf"
              className="clever-unterlagen-sheet__file-input"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className="clever-unterlagen-sheet__btn"
              onClick={() => (isSelbstauskunftSlot ? pdfRef : fileRef).current?.click()}
            >
              {isSelbstauskunftSlot ? 'PDF hochladen' : 'Datei auswählen'}
            </button>
            {!isSelbstauskunftSlot && (
              <button
                type="button"
                className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--ghost"
                onClick={() => fileRef.current?.click()}
              >
                Foto aufnehmen
              </button>
            )}
          </div>

          <div className="clever-unterlagen-sheet__detail-actions">
            {unterlagen.items[activeSlot]?.dataUrl && (
              <a
                href={unterlagen.items[activeSlot].dataUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--ghost"
              >
                Öffnen
              </a>
            )}
            <button
              type="button"
              className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--ghost"
              onClick={() => (isSelbstauskunftSlot ? pdfRef : fileRef).current?.click()}
            >
              Ersetzen
            </button>
            <button
              type="button"
              className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--ghost"
              onClick={() => {
                const next = removeUnterlageFile(unterlagen, activeSlot);
                persist(next);
                showToast('Entfernt');
              }}
            >
              Löschen
            </button>
            {!isSelbstauskunftSlot && (
              <>
                <button
                  type="button"
                  className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--ghost"
                  onClick={() => {
                    const next = markUnterlageStatus(unterlagen, activeSlot, UNTERLAGEN_STATUS.checked.id);
                    persist(next, UNTERLAGEN_HISTORY.checked, 'unterlagen');
                    showToast('Als geprüft markiert');
                  }}
                >
                  Als geprüft markieren
                </button>
                <button
                  type="button"
                  className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--ghost"
                  onClick={() => {
                    const next = markUnterlageStatus(unterlagen, activeSlot, UNTERLAGEN_STATUS.not_needed.id);
                    persist(next);
                    setActiveSlot(null);
                  }}
                >
                  Nicht benötigt
                </button>
              </>
            )}
            {isSelbstauskunftSlot && selbstauskunft.status === 'completed' && (
              <button
                type="button"
                className="clever-unterlagen-sheet__btn clever-unterlagen-sheet__btn--ghost"
                onClick={() => {
                  const next = markSelbstauskunftChecked(unterlagen);
                  persist(next, SELBSTAUSKUNFT_HISTORY.checked, 'selbstauskunft');
                  showToast('Als geprüft markiert');
                }}
              >
                Als geprüft markieren
              </button>
            )}
          </div>
        </div>
      )}

      <section className="clever-unterlagen-sheet__link">
        <h3 className="clever-unterlagen-sheet__link-title">Unterlagen-Link senden</h3>
        {!unterlagen.uploadLink?.url ? (
          <button type="button" className="clever-unterlagen-sheet__btn" onClick={handleCreateLink}>
            Unterlagen-Link erstellen
          </button>
        ) : (
          <>
            <p className="clever-unterlagen-sheet__link-status">Link bereit</p>
            <div className="clever-unterlagen-sheet__link-actions">
              <button type="button" className="clever-unterlagen-sheet__btn" onClick={handleCopyLink}>Link kopieren</button>
              <button type="button" className="clever-unterlagen-sheet__btn" onClick={handleWhatsapp}>WhatsApp</button>
              <button type="button" className="clever-unterlagen-sheet__btn" onClick={handleEmail}>E-Mail</button>
            </div>
          </>
        )}
      </section>

      <p className="clever-unterlagen-sheet__privacy">
        Unterlagen sind nur für berechtigte Nutzer im Autohaus sichtbar.
      </p>

      {toast && <p className="clever-unterlagen-sheet__toast" role="status">{toast}</p>}
    </div>
  );
}
