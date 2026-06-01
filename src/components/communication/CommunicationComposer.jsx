import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemplates } from '../../context/TemplatesContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { useDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { personalizeTemplate } from '../../logic/templateService.js';
import { DOCUMENT_TYPES, REMINDER_PRESETS, AI_SCENARIOS } from '../../data/communicationTypes.js';
import { REMINDER_TYPES } from '../../data/salesChanceTypes.js';
import { buildOfferPath } from '../../logic/offerService.js';
import './CommunicationComponents.css';

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CommunicationComposer({ lead, onToast }) {
  const { templates } = useTemplates();
  const {
    sendEmail,
    sendWhatsApp,
    sendOffer,
    sendDocument,
    setReminder,
    setDetailedReminder,
    generateAiReply,
  } = useCommunication();
  const { conditions } = useDealerConditions();
  const [message, setMessage] = useState('');
  const [aiScenario, setAiScenario] = useState('');
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    date: tomorrowIso(),
    time: '10:00',
    note: '',
    type: 'call',
  });
  const [sending, setSending] = useState(false);

  if (!lead) {
    return (
      <div className="comm-composer comm-composer--disabled">
        <p>Verkaufschance auswählen, um zu schreiben.</p>
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

  async function handleEmail() {
    if (!message.trim()) {
      toast('Bitte Nachricht eingeben');
      return;
    }
    setSending(true);
    const res = await sendEmail(lead.id, { message: message.trim() });
    setSending(false);
    if (!res.ok) {
      toast('Keine E-Mail hinterlegt');
      return;
    }
    toast('E-Mail versendet (Mock-Service)');
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
    toast(`Angebot ${res.offer.code} – versendet`);
    if (res.url) {
      setMessage((prev) => (prev ? prev : `Anbei Ihr Angebot: ${res.url}`));
    }
  }

  function handleDocument(docId) {
    sendDocument(lead.id, docId);
    setShowDocPicker(false);
    toast('Dokumentversand protokolliert');
  }

  function handleReminderPreset(presetId) {
    setReminder(lead.id, presetId);
    setShowReminder(false);
    toast('Wiedervorlage gesetzt');
  }

  function handleDetailedReminder(e) {
    e.preventDefault();
    setDetailedReminder(lead.id, reminderForm);
    setShowReminder(false);
    toast('Wiedervorlage gespeichert');
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
        <button type="button" className="comm-composer__btn comm-composer__btn--ai" onClick={handleAi}>
          🤖 Antwort erzeugen
        </button>
        <button
          type="button"
          className="comm-composer__btn"
          onClick={handleEmail}
          disabled={sending}
          title="E-Mail senden"
        >
          📧 E-Mail senden
        </button>
        <button type="button" className="comm-composer__btn" onClick={handleWhatsApp} title="WhatsApp">
          💬 WhatsApp öffnen
        </button>
        <button type="button" className="comm-composer__btn" onClick={handleOffer} title="Angebot anhängen">
          📄 Angebot anhängen
        </button>
        <button
          type="button"
          className="comm-composer__btn"
          onClick={() => {
            setShowDocPicker((v) => !v);
            setShowReminder(false);
          }}
          title="Dokument anhängen"
        >
          📎 Dokument anhängen
        </button>
        <button
          type="button"
          className="comm-composer__btn"
          onClick={() => {
            setShowReminder((v) => !v);
            setShowDocPicker(false);
          }}
          title="Wiedervorlage"
        >
          ⏰ Wiedervorlage setzen
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
        <div className="comm-composer__reminder-panel">
          <p className="comm-composer__reminder-title">Schnell</p>
          <div className="comm-composer__picker">
            {REMINDER_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => handleReminderPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <form className="comm-composer__reminder-form" onSubmit={handleDetailedReminder}>
            <p className="comm-composer__reminder-title">Detailliert</p>
            <label>
              Datum
              <input
                type="date"
                value={reminderForm.date}
                onChange={(e) => setReminderForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </label>
            <label>
              Uhrzeit
              <input
                type="time"
                value={reminderForm.time}
                onChange={(e) => setReminderForm((f) => ({ ...f, time: e.target.value }))}
              />
            </label>
            <label>
              Typ
              <select
                value={reminderForm.type}
                onChange={(e) => setReminderForm((f) => ({ ...f, type: e.target.value }))}
              >
                {REMINDER_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label>
              Notiz
              <input
                type="text"
                value={reminderForm.note}
                onChange={(e) => setReminderForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="z. B. Rückruf nach Angebot"
              />
            </label>
            <button type="submit" className="comm-composer__reminder-save">
              Wiedervorlage speichern
            </button>
          </form>
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
          {templates.slice(0, 6).map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}>
              {tpl.title}
            </button>
          ))}
        </div>
      )}
    </footer>
  );
}
