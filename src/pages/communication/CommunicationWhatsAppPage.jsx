import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { useDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { useTemplates } from '../../context/TemplatesContext.jsx';
import { personalizeTemplate } from '../../logic/templateService.js';
import { buildOfferUrl } from '../../logic/offerService.js';
import '../../components/communication/CommunicationComponents.css';

export default function CommunicationWhatsAppPage() {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const { leads, sendWhatsApp, getLead } = useCommunication();
  const { templates } = useTemplates();
  const { conditions } = useDealerConditions();
  const [selectedLeadId, setSelectedLeadId] = useState(leadId ?? '');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');

  const lead = getLead(selectedLeadId);
  const offerUrl = lead?.offerCode ? buildOfferUrl(lead.offerCode) : null;

  function applyTemplate(id) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl || !lead) return;
    let text = personalizeTemplate(tpl.body, lead, conditions.dealerName);
    if (offerUrl) text += `\n\n👉 ${offerUrl}`;
    setMessage(text);
  }

  function handleOpen() {
    if (!selectedLeadId) {
      setToast('Bitte Verkaufschance wählen');
      return;
    }
    const res = sendWhatsApp(selectedLeadId, message);
    setToast(res.ok ? 'WhatsApp geöffnet – Historie gespeichert' : 'Keine Telefonnummer');
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="comm-subpage">
      <header className="comm-subpage__head">
        <Link to={selectedLeadId ? `/communication?leadId=${selectedLeadId}` : '/communication'} className="comm-subpage__back">←</Link>
        <h1>WhatsApp Center</h1>
      </header>

      <div className="comm-subpage__card">
        <p className="comm-subpage__hint" style={{ marginTop: 0 }}>
          <strong>Phase 1:</strong> Nachricht wird erzeugt, Klick öffnet WhatsApp mit vorausgefülltem Text.
          Phase 2 (WhatsApp Business API) folgt.
        </p>

        <label className="comm-subpage__label" htmlFor="wa-lead">Verkaufschance</label>
        <select
          id="wa-lead"
          className="comm-subpage__select"
          value={selectedLeadId}
          onChange={(e) => setSelectedLeadId(e.target.value)}
        >
          <option value="">Verkaufschance wählen…</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.contact.name || 'Unbekannt'} – {l.contact.phone || 'ohne Tel.'}
            </option>
          ))}
        </select>

        <label className="comm-subpage__label" htmlFor="wa-tpl">Vorlage</label>
        <select
          id="wa-tpl"
          className="comm-subpage__select"
          onChange={(e) => applyTemplate(e.target.value)}
          defaultValue=""
        >
          <option value="">Vorlage wählen…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>

        <label className="comm-subpage__label" htmlFor="wa-msg">Nachricht</label>
        <textarea
          id="wa-msg"
          className="comm-subpage__textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="WhatsApp-Nachricht…"
        />

        {offerUrl && (
          <p className="comm-subpage__hint">Angebotslink: {offerUrl}</p>
        )}

        <div className="comm-subpage__actions">
          <button type="button" className="comm-subpage__btn" onClick={handleOpen}>
            💬 In WhatsApp öffnen
          </button>
        </div>
      </div>

      {toast && <p className="comm-subpage__hint" role="status">{toast}</p>}
    </div>
  );
}
