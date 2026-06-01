import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { useTemplates } from '../../context/TemplatesContext.jsx';
import { useDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { personalizeTemplate } from '../../logic/templateService.js';
import '../../components/communication/CommunicationComponents.css';

export default function CommunicationEmailPage() {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const { leads, sendEmail, getLead } = useCommunication();
  const { templates } = useTemplates();
  const { conditions } = useDealerConditions();
  const [selectedLeadId, setSelectedLeadId] = useState(leadId ?? '');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toast, setToast] = useState('');

  const lead = getLead(selectedLeadId);

  const subjectDefault = useMemo(() => {
    if (!lead) return '';
    return `Ihre Anfrage – ${lead.vehicle?.label ?? 'Fahrzeug'} | ${conditions.dealerName}`;
  }, [lead, conditions.dealerName]);

  function applyTemplate(id) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl || !lead) return;
    setBody(personalizeTemplate(tpl.body, lead, conditions.dealerName));
    setTemplateId(id);
  }

  function handleSend(e) {
    e.preventDefault();
    if (!selectedLeadId) {
      setToast('Bitte Lead wählen');
      return;
    }
    const res = sendEmail(selectedLeadId, {
      message: body,
      subject: subject || subjectDefault,
      templateId: templateId || undefined,
    });
    setToast(res.ok ? 'E-Mail geöffnet – Versand protokolliert' : 'Keine E-Mail beim Lead');
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="comm-subpage">
      <header className="comm-subpage__head">
        <Link to={selectedLeadId ? `/communication?leadId=${selectedLeadId}` : '/communication'} className="comm-subpage__back">←</Link>
        <h1>E-Mail Center</h1>
      </header>

      <form className="comm-subpage__card" onSubmit={handleSend}>
        <label className="comm-subpage__label" htmlFor="email-lead">Lead</label>
        <select
          id="email-lead"
          className="comm-subpage__select"
          value={selectedLeadId}
          onChange={(e) => setSelectedLeadId(e.target.value)}
        >
          <option value="">Lead wählen…</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.contact.name || 'Unbekannt'} – {l.vehicle?.label ?? 'Fahrzeug'}
            </option>
          ))}
        </select>

        <label className="comm-subpage__label" htmlFor="email-tpl">Vorlage</label>
        <select
          id="email-tpl"
          className="comm-subpage__select"
          value={templateId}
          onChange={(e) => applyTemplate(e.target.value)}
        >
          <option value="">Keine Vorlage</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>

        <label className="comm-subpage__label" htmlFor="email-subject">Betreff</label>
        <input
          id="email-subject"
          className="comm-subpage__input"
          value={subject || subjectDefault}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={subjectDefault}
        />

        <label className="comm-subpage__label" htmlFor="email-body">Nachricht</label>
        <textarea
          id="email-body"
          className="comm-subpage__textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nachricht schreiben…"
        />

        <div className="comm-subpage__actions">
          <button type="submit" className="comm-subpage__btn">📧 Senden (Mail-App)</button>
          <Link to="/communication/templates" className="comm-subpage__btn comm-subpage__btn--secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Vorlagen bearbeiten
          </Link>
        </div>

        <p className="comm-subpage__hint">
          Versand öffnet Ihr Standard-E-Mail-Programm. Der Vorgang wird im Lead-Verlauf und Audit-Log gespeichert.
        </p>
      </form>

      {toast && <p className="comm-subpage__hint" role="status">{toast}</p>}
    </div>
  );
}
