import { useEffect, useMemo, useState } from 'react';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import {
  applyMarkSelfDisclosureReviewed,
  applyRequestSelfDisclosureCorrection,
  buildSelfDisclosureReviewModel,
} from '../../services/crm/customerPortalSelfDisclosureService.js';

export default function CustomerSelfDisclosureReviewSheet({
  open,
  onClose,
  lead,
  onSave,
  onPrepareCorrectionMessage,
  inboxItemId = null,
  onInboxItemHandled,
  saving = false,
}) {
  const model = useMemo(() => buildSelfDisclosureReviewModel(lead), [lead]);
  const [mode, setMode] = useState('view');
  const [selectedPresets, setSelectedPresets] = useState([]);
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [internalNote, setInternalNote] = useState(model.review?.internalNote ?? '');

  useEffect(() => {
    if (!open) return;
    setMode('view');
    setSelectedPresets([]);
    setCorrectionNotes(model.review?.correctionNotes ?? '');
    setInternalNote(model.review?.internalNote ?? '');
  }, [open, model.review?.correctionNotes, model.review?.internalNote]);

  if (!model.visible) return null;

  function togglePreset(preset) {
    const key = `${preset.sectionId}:${preset.fieldId}`;
    setSelectedPresets((prev) => {
      const exists = prev.some((entry) => `${entry.sectionId}:${entry.fieldId}` === key);
      if (exists) return prev.filter((entry) => `${entry.sectionId}:${entry.fieldId}` !== key);
      return [...prev, { ...preset, note: '' }];
    });
  }

  function handleMarkReviewed() {
    const result = applyMarkSelfDisclosureReviewed(lead, {
      reviewedBy: 'seller',
      internalNote,
    });
    if (!result.ok) return;
    onSave?.(result.leadPatch, { historyText: result.historyText, historyType: 'note' });
    if (inboxItemId) onInboxItemHandled?.(inboxItemId);
    onClose?.();
  }

  function handleRequestCorrection() {
    const fields = selectedPresets.length
      ? selectedPresets
      : model.correctionPresets.slice(0, 1);
    const result = applyRequestSelfDisclosureCorrection(lead, {
      correctionFields: fields,
      correctionNotes,
      internalNote,
      reviewedBy: 'seller',
    });
    if (!result.ok) return;
    onSave?.(result.leadPatch, { historyText: result.historyText, historyType: 'note' });
    onPrepareCorrectionMessage?.(result.customerMessageDraft);
    if (inboxItemId) onInboxItemHandled?.(inboxItemId);
    onClose?.();
  }

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title={model.title}
      footer={(
        <>
          <button type="button" className="dai-btn dai-btn--ghost" onClick={onClose}>
            Schließen
          </button>
          {mode === 'correction' ? (
            <button
              type="button"
              className="dai-btn dai-btn--primary"
              disabled={saving || selectedPresets.length === 0}
              onClick={handleRequestCorrection}
            >
              Korrektur anfordern
            </button>
          ) : (
            <>
              {model.canRequestCorrection ? (
                <button
                  type="button"
                  className="dai-btn dai-btn--secondary"
                  disabled={saving}
                  onClick={() => setMode('correction')}
                >
                  Korrektur anfordern
                </button>
              ) : null}
              {model.canMarkReviewed ? (
                <button
                  type="button"
                  className="dai-btn dai-btn--primary"
                  disabled={saving}
                  onClick={handleMarkReviewed}
                >
                  Als geprüft markieren
                </button>
              ) : null}
            </>
          )}
        </>
      )}
    >
      <div className="cust-sd-review">
        <header className="cust-sd-review__summary">
          <p className="cust-sd-review__eyebrow">Selbstauskunft</p>
          <h3 className="cust-sd-review__headline">{model.typeLabel}</h3>
          {model.submittedAtLabel ? (
            <p className="cust-sd-review__meta">
              Abgesendet:
              {' '}
              {model.submittedAtLabel}
            </p>
          ) : null}
          {model.lastSavedAtLabel ? (
            <p className="cust-sd-review__meta">
              Letzte Bearbeitung:
              {' '}
              {model.lastSavedAtLabel}
            </p>
          ) : null}
          <p className="cust-sd-review__status">
            Status:
            {' '}
            <strong>{model.statusLabel}</strong>
          </p>
          {model.customerName ? (
            <p className="cust-sd-review__meta">{model.customerName}</p>
          ) : null}
        </header>

        <section className="cust-sd-review__indicators" aria-label="Prüfhinweise">
          <h4 className="cust-sd-review__section-title">Kennzahlen</h4>
          <ul className="cust-sd-review__indicator-list">
            {model.indicators.map((indicator) => (
              <li
                key={indicator.id}
                className={`cust-sd-review__indicator${indicator.ok ? ' is-ok' : ' is-missing'}`}
              >
                {indicator.ok ? '✓' : '○'}
                {' '}
                {indicator.label}
              </li>
            ))}
          </ul>
        </section>

        {mode === 'correction' ? (
          <section className="cust-sd-review__correction" aria-label="Korrektur anfordern">
            <h4 className="cust-sd-review__section-title">Punkte markieren</h4>
            <div className="cust-sd-review__preset-grid">
              {model.correctionPresets.map((preset) => {
                const key = `${preset.sectionId}:${preset.fieldId}`;
                const active = selectedPresets.some(
                  (entry) => `${entry.sectionId}:${entry.fieldId}` === key,
                );
                return (
                  <button
                    key={key}
                    type="button"
                    className={`cust-sd-review__preset${active ? ' is-active' : ''}`}
                    onClick={() => togglePreset(preset)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <label className="dai-lead-field">
              <span className="dai-lead-field__label">Hinweis für den Kunden</span>
              <textarea
                className="dai-lead-field__input dai-lead-field__input--area"
                rows={3}
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                placeholder="Optionaler Zusatztext …"
              />
            </label>
          </section>
        ) : null}

        <label className="dai-lead-field cust-sd-review__internal-note">
          <span className="dai-lead-field__label">Interne Notiz (optional)</span>
          <textarea
            className="dai-lead-field__input dai-lead-field__input--area"
            rows={2}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            placeholder="Nur für Verkäufer sichtbar"
          />
        </label>

        <section className="cust-sd-review__sections" aria-label="Abschnitte">
          {model.sections.map((section) => (
            <details key={section.id} className="cust-sd-review__fold" open>
              <summary className="cust-sd-review__fold-title">{section.title}</summary>
              <dl className="cust-sd-review__fields">
                {section.fields.map((field) => (
                  <div key={field.key} className="cust-sd-review__field">
                    <dt>{field.label}</dt>
                    <dd>{field.displayValue}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </section>
      </div>
    </LeadDetailPanel>
  );
}
