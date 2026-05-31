import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemplates } from '../../context/TemplatesContext.jsx';
import { useDealerConditions } from '../../context/DealerConditionsContext.jsx';
import {
  buildShareLink,
  copyToClipboard,
  openMail,
  openWhatsApp,
  personalizeTemplate,
} from '../../logic/templateService.js';
import { buildOfferUrl } from '../../logic/offerService.js';
import './ReplySheet.css';

export default function ReplySheet({ lead, onClose, onSent }) {
  const { templates } = useTemplates();
  const { conditions } = useDealerConditions();
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  const [copying, setCopying] = useState(false);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const message = selected
    ? personalizeTemplate(selected.body, lead, conditions.dealerName)
    : '';

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function recordSent(channel, templateTitle) {
    onSent?.(`Antwort gesendet (${channel}): ${templateTitle}`);
  }

  function handleWhatsApp() {
    if (!selected) return;
    if (!lead.contact.phone) {
      showToast('Keine Telefonnummer hinterlegt');
      return;
    }
    openWhatsApp(lead.contact.phone, message);
    recordSent('WhatsApp', selected.title);
    showToast('WhatsApp geöffnet');
  }

  function handleMail() {
    if (!selected) return;
    if (!lead.contact.email) {
      showToast('Keine E-Mail hinterlegt');
      return;
    }
    openMail(lead.contact.email, lead, message, conditions.dealerName);
    recordSent('E-Mail', selected.title);
    showToast('E-Mail geöffnet');
  }

  async function handleCopy() {
    if (!selected) return;
    setCopying(true);
    try {
      const offerUrl = lead.offerCode
        ? buildOfferUrl(lead.offerCode)
        : undefined;
      const text = buildShareLink(message, offerUrl);
      await copyToClipboard(text);
      recordSent('Kopiert', selected.title);
      showToast('Text kopiert');
    } catch {
      showToast('Kopieren fehlgeschlagen');
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="reply-sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="reply-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Antwort senden"
      >
        <header className="reply-sheet__head">
          <button type="button" className="reply-sheet__close" onClick={onClose}>✕</button>
          <h2 className="reply-sheet__title">Antwort senden</h2>
          <p className="reply-sheet__sub">
            An {lead.contact.name?.trim() || 'Kunde'}
          </p>
        </header>

        <div className="reply-sheet__body">
          <p className="reply-sheet__step">1. Vorlage auswählen</p>
          <div className="reply-sheet__templates">
            {templates.length === 0 ? (
              <p className="reply-sheet__empty">
                Keine Vorlagen.{' '}
                <Link to="/templates">Vorlagen anlegen</Link>
              </p>
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`reply-sheet__tpl${selectedId === tpl.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(tpl.id)}
                >
                  <span className="reply-sheet__tpl-title">{tpl.title}</span>
                  <span className="reply-sheet__tpl-body">{tpl.body}</span>
                </button>
              ))
            )}
          </div>

          {selected && (
            <>
              <p className="reply-sheet__step">2. Vorschau</p>
              <pre className="reply-sheet__preview">{message}</pre>

              <p className="reply-sheet__step">3. Senden</p>
              <div className="reply-sheet__actions">
                <button
                  type="button"
                  className="reply-sheet__action reply-sheet__action--wa"
                  onClick={handleWhatsApp}
                >
                  <span>💬</span>
                  WhatsApp
                </button>
                <button
                  type="button"
                  className="reply-sheet__action reply-sheet__action--mail"
                  onClick={handleMail}
                >
                  <span>✉️</span>
                  Mail
                </button>
                <button
                  type="button"
                  className="reply-sheet__action reply-sheet__action--copy"
                  onClick={handleCopy}
                  disabled={copying}
                >
                  <span>📋</span>
                  {copying ? '…' : 'Link kopieren'}
                </button>
              </div>
            </>
          )}
        </div>

        {toast && <div className="reply-sheet__toast">{toast}</div>}
      </div>
    </div>
  );
}
