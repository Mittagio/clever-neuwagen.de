import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import usePageSeo from '../../hooks/usePageSeo';
import { submitSelbstauskunft } from '../../services/documentVaultApi.js';
import { auditSelbstauskunftCreated } from '../../services/sprint5Audit.js';
import './Sprint5Shared.css';
import './SelbstauskunftPage.css';

const INITIAL = {
  personal: {
    firstName: '',
    lastName: '',
    birthDate: '',
    maritalStatus: '',
    children: '',
  },
  housing: {
    type: 'miete',
    since: '',
  },
  employment: {
    employer: '',
    employedSince: '',
    jobTitle: '',
  },
  income: {
    netIncome: '',
    otherIncome: '',
  },
  obligations: {
    loans: '',
    leasing: '',
    alimony: '',
  },
  consent: false,
};

export default function SelbstauskunftPage() {
  const [form, setForm] = useState(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  usePageSeo({
    title: 'Digitale Selbstauskunft',
    description: 'Selbstauskunft online ausfüllen – strukturierte Daten für den Verkäufer.',
    path: '/selbstauskunft',
  });

  function updateSection(section, field, value) {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.consent) {
      setError('Bitte stimmen Sie der Datenverarbeitung zu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { item } = await submitSelbstauskunft(form);
      auditSelbstauskunftCreated(item);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="s5-page sa-page">
          <div className="s5-card sa-success">
            <h1 className="s5-header__title">Vielen Dank!</h1>
            <p>Ihre Selbstauskunft wurde übermittelt. Der Verkäufer erhält strukturierte Daten – kein PDF-Parsing nötig.</p>
            <Link to="/" className="s5-btn s5-btn--primary">Zur Startseite</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="s5-page sa-page">
        <p className="s5-header__kicker">Finanzierung</p>
        <h1 className="s5-header__title">Digitale Selbstauskunft</h1>
        <p className="s5-header__sub">PDF ersetzen – alle Angaben strukturiert an Ihren Ansprechpartner.</p>

        {error && <div className="s5-banner s5-banner--warn">{error}</div>}

        <form className="sa-form" onSubmit={handleSubmit}>
          <section className="s5-card">
            <h2 className="s5-card__title">Persönliche Daten</h2>
            <div className="s5-grid-2">
              <label className="s5-field">
                <span>Vorname *</span>
                <input required value={form.personal.firstName} onChange={(e) => updateSection('personal', 'firstName', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Nachname *</span>
                <input required value={form.personal.lastName} onChange={(e) => updateSection('personal', 'lastName', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Geburtsdatum</span>
                <input type="date" value={form.personal.birthDate} onChange={(e) => updateSection('personal', 'birthDate', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Familienstand</span>
                <select value={form.personal.maritalStatus} onChange={(e) => updateSection('personal', 'maritalStatus', e.target.value)}>
                  <option value="">Bitte wählen</option>
                  <option value="ledig">Ledig</option>
                  <option value="verheiratet">Verheiratet</option>
                  <option value="geschieden">Geschieden</option>
                </select>
              </label>
              <label className="s5-field">
                <span>Kinder</span>
                <input value={form.personal.children} onChange={(e) => updateSection('personal', 'children', e.target.value)} placeholder="z. B. 2" />
              </label>
            </div>
          </section>

          <section className="s5-card">
            <h2 className="s5-card__title">Wohnsituation</h2>
            <div className="s5-grid-2">
              <label className="s5-field">
                <span>Wohnform</span>
                <select value={form.housing.type} onChange={(e) => updateSection('housing', 'type', e.target.value)}>
                  <option value="miete">Miete</option>
                  <option value="eigentum">Eigentum</option>
                </select>
              </label>
              <label className="s5-field">
                <span>Wohnhaft seit</span>
                <input value={form.housing.since} onChange={(e) => updateSection('housing', 'since', e.target.value)} placeholder="MM/JJJJ" />
              </label>
            </div>
          </section>

          <section className="s5-card">
            <h2 className="s5-card__title">Arbeit</h2>
            <div className="s5-grid-2">
              <label className="s5-field">
                <span>Arbeitgeber</span>
                <input value={form.employment.employer} onChange={(e) => updateSection('employment', 'employer', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Beschäftigt seit</span>
                <input value={form.employment.employedSince} onChange={(e) => updateSection('employment', 'employedSince', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Beruf</span>
                <input value={form.employment.jobTitle} onChange={(e) => updateSection('employment', 'jobTitle', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="s5-card">
            <h2 className="s5-card__title">Einkommen</h2>
            <div className="s5-grid-2">
              <label className="s5-field">
                <span>Nettoeinkommen (€/Monat)</span>
                <input type="number" min="0" value={form.income.netIncome} onChange={(e) => updateSection('income', 'netIncome', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Sonstige Einnahmen</span>
                <input value={form.income.otherIncome} onChange={(e) => updateSection('income', 'otherIncome', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="s5-card">
            <h2 className="s5-card__title">Verpflichtungen</h2>
            <div className="s5-grid-2">
              <label className="s5-field">
                <span>Kredite</span>
                <input value={form.obligations.loans} onChange={(e) => updateSection('obligations', 'loans', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Leasingverträge</span>
                <input value={form.obligations.leasing} onChange={(e) => updateSection('obligations', 'leasing', e.target.value)} />
              </label>
              <label className="s5-field">
                <span>Unterhalt</span>
                <input value={form.obligations.alimony} onChange={(e) => updateSection('obligations', 'alimony', e.target.value)} />
              </label>
            </div>
          </section>

          <label className="sa-consent">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))}
            />
            <span>
              Ich willige in die Verarbeitung meiner Angaben zum Zweck der Finanzierungsanfrage ein.
              Weitere Informationen in der{' '}
              <Link to="/legal/datenschutz">Datenschutzerklärung</Link>.
            </span>
          </label>

          <button type="submit" className="s5-btn s5-btn--primary" disabled={loading}>
            {loading ? 'Wird gesendet…' : 'Selbstauskunft absenden'}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
