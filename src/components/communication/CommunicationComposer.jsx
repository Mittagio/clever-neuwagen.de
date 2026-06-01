import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemplates } from '../../context/TemplatesContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { useDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { personalizeTemplate } from '../../logic/templateService.js';
import { DOCUMENT_TYPES, REMINDER_PRESETS, AI_SCENARIOS } from '../../data/communicationTypes.js';
import { buildOfferPath } from '../../logic/offerService.js';
import './CommunicationComponents.css';

export default function CommunicationComposer({ lead, onToast }) {
  const { templates } = useTemplates();
  const {
    sendEmail,
    sendWhatsApp,
    sendOffer,
    sendDocument,
    setReminder,
    generateAiReply,
  } = useCommunication();
  const { conditions } = useDealerConditions();
  const [message, setMessage] = useState('');
  const [aiScenario, setAiScenario] = useState('');
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  if (!lead) {
    return (
      <div className="comm-composer comm-composer--disabled">
        <p>Lead auswählen, um zu schreiben.</p>
      </div>
    );
  }

  function toast(msg) {
    onToast?.(msg);
  }

  function handleAi() {
    const { text, scenario } = generateAiReply(lead, { scenario: aiScenario || undefined });
    setMessage(text);
    setAiScenario(scenario);
    toast('KI-Antwort eingefügt');
  }

  function handleEmail() {
    if (!message.trim()) {
      toast('Bitte Nachricht eingeben');
      return;
    }
    const res = sendEmail(lead.id, { message: message.trim() });
    if (!res.ok) {
      toast('Keine E-Mail hinterlegt');
      return;
    }
    toast('E-Mail geöffnet – Versand protokolliert');
  }

  function handleWhatsApp() {
    if (!message.trim()) {
      toast('Bitte Nachricht eingeben');
      return;
    }
    const res = sendWhatsApp(lead.id, message.trim());
    if (!res.ok) {
      toast('Keine Telefonnummer hinterlegt');
      return;
    }
    toast('WhatsApp geöffnet');
  }

  async function handleOffer() {
    const res = sendOffer(lead.id);
    if (!res.ok) {
      toast('Angebot konnte nicht erstellt werden');
      return;
    }
    toast(`Angebot ${res.offer.code} versendet`);
    if (res.url) {
      setMessage((prev) => (prev ? prev : `Anbei Ihr Angebot: ${res.url}`));
    }
  }

  function handleDocument(docId) {
    sendDocument(lead.id, docId);
    setShowDocPicker(false);
    toast('Dokumentversand protokolliert');
  }

  function handleReminder(presetId) {
    setReminder(lead.id, presetId);
    setShowReminder(false);
    toast('Wiedervorlage gesetzt');
  }

  function applyTemplate(tpl) {
    const text = personalizeTemplate(tpl.body, lead, conditions.dealerName);
    setMessage(text);
  }

  return (
    <footer className="comm-composer">
      <textarea
        className="comm-composer__input"
        rows={4}
        placeholder="Nachricht an Kunden schreiben…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div className="comm-composer__toolbar">
        <button type="button" className="comm-composer__btn" onClick={handleEmail} title="E-Mail">
          📧 E-Mail
        </button>
        <button type="button" className="comm-composer__btn" onClick={handleWhatsApp} title="WhatsApp">
          💬 WhatsApp
        </button>
        <button type="button" className="comm-composer__btn" onClick={handleOffer} title="Angebot">
          📄 Angebot
        </button>
        <button
          type="button"
          className="comm-composer__btn"
          onClick={() => setShowDocPicker((v) => !v)}
          title="Dokument"
        >
          📎 Dokument
        </button>
        <button type="button" className="comm-composer__btn comm-composer__btn--ai" onClick={handleAi}>
          🤖 KI-Antwort
        </button>
        <button
          type="button"
          className="comm-composer__btn"
          onClick={() => setShowReminder((v) => !v)}
          title="Erinnerung"
        >
          ⏰
        </button>
      </div>

      <div className="comm-composer__links">
        <Link to={`/communication/email?leadId=${lead.id}`}>E-Mail Center</Link>
        <Link to={`/communication/whatsapp?leadId=${lead.id}`}>WhatsApp</Link>
        <Link to="/communication/templates">Vorlagen</Link>
        {lead.offerCode && (
          <Link to={buildOfferPath(lead.offerCode)} target="_blank" rel="noreferrer">
            Angebot öffnen
          </Link>
        )}
      </div>

      {showDocPicker && (
        <div className="comm-composer__picker">
          {DOCUMENT_TYPES.map((doc) => (
            <button key={doc.id} type="button" onClick={() => handleDocument(doc.id)}>
              {doc.label}
            </button>
          ))}
        </div>
      )}

      {showReminder && (
        <div className="comm-composer__picker">
          {REMINDER_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => handleReminder(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <details className="comm-composer__ai-details">
        <summary>KI-Szenario (optional)</summary>
        <select
          value={aiScenario}
          onChange={(e) => setAiScenario(e.target.value)}
          className="comm-composer__select"
        >
          <option value="">Automatisch</option>
          {AI_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </details>

      {templates.length > 0 && (
        <div className="comm-composer__quick-tpl">
          {templates.slice(0, 4).map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}>
              {tpl.title}
            </button>
          ))}
        </div>
      )}
    </footer>
  );
}
