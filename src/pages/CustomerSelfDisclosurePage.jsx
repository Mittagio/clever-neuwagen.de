import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import usePageSeo from '../hooks/usePageSeo';
import { useLeads } from '../context/LeadsContext.jsx';
import { PAYMENT_TYPE_LABELS } from '../services/dealerAiParser.js';
import { isAcceptedUnterlagenFile, getCleverUnterlagen } from '../services/cleverUnterlagen.js';
import {
  EMPTY_SELBSTAUSKUNFT_FORM,
  SELBSTAUSKUNFT_HISTORY,
  applySelbstauskunftSessionToUnterlagen,
  getCustomerUploadSlots,
} from '../services/cleverSelbstauskunft.js';
import {
  attachSelfDisclosureUpload,
  getSelfDisclosureByToken,
  markSelfDisclosureInProgress,
  markSelfDisclosureOpened,
  submitSelfDisclosure,
  validateSelfDisclosureAccess,
} from '../logic/selfDisclosureService.js';
import './CustomerSelfDisclosurePage.css';

function Field({ label, id, type = 'text', value, onChange, placeholder, inputMode }) {
  return (
    <label className="csd-field" htmlFor={id}>
      <span className="csd-field__label">{label}</span>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        className="csd-field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CustomerSelfDisclosurePage() {
  const { token } = useParams();
  const { leads, updateLead, addHistory } = useLeads();
  const [session, setSession] = useState(() => getSelfDisclosureByToken(token));
  const [form, setForm] = useState(EMPTY_SELBSTAUSKUNFT_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState('');
  const [activeUpload, setActiveUpload] = useState(null);
  const fileRef = useRef(null);

  usePageSeo({
    title: 'Selbstauskunft & Unterlagen',
    description: 'Selbstauskunft online ausfüllen und Unterlagen hochladen.',
    path: `/customer/self-disclosure/${token}`,
  });

  const access = useMemo(() => validateSelfDisclosureAccess(session), [session]);
  const uploadSlots = useMemo(
    () => getCustomerUploadSlots(session?.isGewerbe),
    [session?.isGewerbe],
  );

  useEffect(() => {
    if (!token || !access.valid) return;
    const opened = markSelfDisclosureOpened(token);
    if (opened) {
      setSession(opened);
      syncToLead(opened, SELBSTAUSKUNFT_HISTORY.customer_opened, 'selbstauskunft_opened', true);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session?.formData) {
      setForm({ ...EMPTY_SELBSTAUSKUNFT_FORM, ...session.formData });
    }
    if (session?.status === 'completed') setSubmitted(true);
  }, [session]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  function syncToLead(nextSession, historyText, historyType, silentDuplicate = false) {
    if (!nextSession?.leadId) return;
    const lead = leads.find((l) => l.id === nextSession.leadId);
    if (!lead) return;

    const unterlagen = applySelbstauskunftSessionToUnterlagen(
      getCleverUnterlagen(lead),
      nextSession,
    );

    updateLead(lead.id, {
      crm: {
        ...(lead.crm ?? {}),
        cleverUnterlagen: unterlagen,
      },
    });

    if (historyText) {
      const already = silentDuplicate && (lead.history ?? []).some((h) => h.text === historyText);
      if (!already) {
        addHistory(lead.id, historyText, historyType ?? 'selbstauskunft');
      }
    }
  }

  function updateForm(section, field, value) {
    const nextForm = {
      ...form,
      [section]: { ...form[section], [field]: value },
    };
    setForm(nextForm);
    const nextSession = markSelfDisclosureInProgress(token, nextForm);
    if (nextSession) {
      setSession(nextSession);
      if (!session?.startedAt) {
        syncToLead(nextSession, SELBSTAUSKUNFT_HISTORY.customer_started, 'selbstauskunft');
      }
    }
  }

  async function handleUpload(file) {
    if (!activeUpload || !file) return;
    if (!isAcceptedUnterlagenFile(file)) {
      showToast('Bitte PDF oder Bild wählen');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const nextSession = attachSelfDisclosureUpload(token, activeUpload, {
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl,
    });
    if (nextSession) {
      setSession(nextSession);
      const slotLabel = uploadSlots.find((s) => s.id === activeUpload)?.label ?? activeUpload;
      syncToLead(nextSession, `${slotLabel} hochgeladen`, 'selbstauskunft_upload');
      showToast('Hochgeladen');
      setActiveUpload(null);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextSession = submitSelfDisclosure(token, form);
    if (!nextSession) return;
    setSession(nextSession);
    syncToLead(nextSession, SELBSTAUSKUNFT_HISTORY.submitted, 'selbstauskunft_submitted');
    setSubmitted(true);
    showToast('Vielen Dank – Ihre Angaben sind eingegangen.');
  }

  if (!session) {
    return (
      <div className="csd-page">
        <p className="csd-empty">Link nicht gefunden.</p>
      </div>
    );
  }

  if (!access.valid) {
    return (
      <div className="csd-page">
        <p className="csd-empty">{access.message}</p>
      </div>
    );
  }

  const paymentLabel = PAYMENT_TYPE_LABELS[session.paymentType] ?? session.paymentType;

  if (submitted) {
    return (
      <div className="csd-page">
        <div className="csd-success">
          <h1>Vielen Dank</h1>
          <p>Ihre Selbstauskunft und Unterlagen sind bei uns eingegangen.</p>
          <p className="csd-success__hint">Ihr Verkäufer meldet sich, sobald die Bankanfrage vorbereitet werden kann.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="csd-page">
      <header className="csd-header">
        <p className="csd-header__dealer">{session.dealerName}</p>
        <h1 className="csd-header__title">Selbstauskunft & Unterlagen</h1>
        <p className="csd-header__sub">
          Bitte füllen Sie die Angaben aus und laden Sie die benötigten Unterlagen hoch.
        </p>
        <div className="csd-context">
          <p className="csd-context__vehicle">{session.vehicleTitle || 'Ihr Fahrzeugangebot'}</p>
          <p className="csd-context__meta">
            {[paymentLabel, session.vehicleConditions].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <form className="csd-form" onSubmit={handleSubmit}>
        <section className="csd-section">
          <h2 className="csd-section__title">Persönliche Daten</h2>
          <Field label="Name" id="name" value={form.personal.name} onChange={(v) => updateForm('personal', 'name', v)} />
          <Field label="Adresse" id="address" value={form.personal.address} onChange={(v) => updateForm('personal', 'address', v)} />
          <Field label="Geburtsdatum" id="birthDate" type="date" value={form.personal.birthDate} onChange={(v) => updateForm('personal', 'birthDate', v)} />
          <Field label="Telefonnummer" id="phone" type="tel" value={form.personal.phone} onChange={(v) => updateForm('personal', 'phone', v)} />
          <Field label="E-Mail" id="email" type="email" value={form.personal.email} onChange={(v) => updateForm('personal', 'email', v)} />
        </section>

        <section className="csd-section">
          <h2 className="csd-section__title">Beruf / Einkommen</h2>
          <Field label="Beschäftigungsart" id="empType" value={form.employment.type} onChange={(v) => updateForm('employment', 'type', v)} placeholder="z. B. Angestellt" />
          <Field label="Arbeitgeber" id="employer" value={form.employment.employer} onChange={(v) => updateForm('employment', 'employer', v)} />
          <Field label="Nettoeinkommen (€)" id="netIncome" inputMode="decimal" value={form.employment.netIncome} onChange={(v) => updateForm('employment', 'netIncome', v)} />
          <Field label="Eintrittsdatum" id="employedSince" type="date" value={form.employment.employedSince} onChange={(v) => updateForm('employment', 'employedSince', v)} />
        </section>

        <section className="csd-section">
          <h2 className="csd-section__title">Wohnsituation</h2>
          <label className="csd-field" htmlFor="housing">
            <span className="csd-field__label">Wohnsituation</span>
            <select
              id="housing"
              className="csd-field__input"
              value={form.housing.situation}
              onChange={(e) => updateForm('housing', 'situation', e.target.value)}
            >
              <option value="miete">Miete</option>
              <option value="eigentum">Eigentum</option>
              <option value="familie">Bei Eltern / Familie</option>
            </select>
          </label>
          <Field label="Monatliche Belastung (€)" id="monthlyCost" inputMode="decimal" value={form.housing.monthlyCost} onChange={(v) => updateForm('housing', 'monthlyCost', v)} />
        </section>

        <section className="csd-section">
          <h2 className="csd-section__title">Bankverbindung</h2>
          <Field label="IBAN" id="iban" value={form.bank.iban} onChange={(v) => updateForm('bank', 'iban', v)} />
          <Field label="Kontoinhaber" id="accountHolder" value={form.bank.accountHolder} onChange={(v) => updateForm('bank', 'accountHolder', v)} />
        </section>

        <section className="csd-section">
          <h2 className="csd-section__title">Fahrzeug / Angebot bestätigen</h2>
          <p className="csd-offer-confirm">
            {session.vehicleTitle}
            <br />
            <span>{[paymentLabel, session.vehicleConditions].filter(Boolean).join(' · ')}</span>
          </p>
          <label className="csd-check">
            <input
              type="checkbox"
              checked={form.vehicle.confirmed}
              onChange={(e) => updateForm('vehicle', 'confirmed', e.target.checked)}
            />
            <span>Angebot stimmt mit meinem Wunsch überein</span>
          </label>
        </section>

        <section className="csd-section">
          <h2 className="csd-section__title">Unterlagen hochladen</h2>
          <ul className="csd-upload-list">
            {uploadSlots.map((slot) => {
              const uploaded = session.uploads?.[slot.id];
              return (
                <li key={slot.id}>
                  <button
                    type="button"
                    className="csd-upload-row"
                    onClick={() => setActiveUpload(slot.id)}
                  >
                    <span>{slot.label}{slot.optional ? ' (optional)' : ''}</span>
                    <span className={`csd-upload-row__status${uploaded ? ' csd-upload-row__status--done' : ''}`}>
                      {uploaded ? 'Hochgeladen' : 'Offen'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {activeUpload && (
            <div className="csd-upload-panel">
              <p className="csd-upload-panel__title">
                {uploadSlots.find((s) => s.id === activeUpload)?.label}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*,application/pdf"
                className="csd-file-input"
                onChange={(e) => handleUpload(e.target.files?.[0])}
              />
              <button type="button" className="csd-btn" onClick={() => fileRef.current?.click()}>
                Datei auswählen
              </button>
              <button type="button" className="csd-btn csd-btn--ghost" onClick={() => fileRef.current?.click()}>
                Foto aufnehmen
              </button>
            </div>
          )}
        </section>

        <p className="csd-privacy">
          Ihre Angaben werden nur für Angebot, Bankprüfung und Vertragsabwicklung verwendet.
        </p>

        <button type="submit" className="csd-btn csd-btn--primary csd-btn--block">
          Absenden
        </button>
      </form>

      {toast && <p className="csd-toast" role="status">{toast}</p>}
    </div>
  );
}
