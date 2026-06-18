import { useState } from 'react';
import './EquipmentDataInspector.css';

function MetaItem({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="eq-inspector-meta__item">
      <span className="eq-inspector-meta__label">{label}</span>
      <span className="eq-inspector-meta__value">{value}</span>
    </div>
  );
}

export default function EquipmentFeatureSourceModal({ detail, onClose }) {
  const [copyMessage, setCopyMessage] = useState('');

  if (!detail) return null;

  async function handleCopy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(detail.copyText);
      } else {
        console.log('[EquipmentFeatureSourceModal] copy', detail.copyText);
      }
      setCopyMessage('Text kopiert.');
    } catch {
      setCopyMessage('Kopieren fehlgeschlagen.');
    }
  }

  return (
    <div className="eq-inspector-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="eq-inspector-modal eq-inspector-source-modal"
        role="dialog"
        aria-labelledby="eq-inspector-source-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="eq-inspector-source-title" className="eq-inspector-modal__title">
          {detail.featureLabel}
        </h3>
        <p className="eq-inspector-muted">
          <code>{detail.featureId}</code>
          {' · '}
          {detail.brand} {detail.model}
          {detail.modelYear ? ` · ${detail.modelYear}` : ''}
        </p>

        <div className="eq-inspector-source-modal__summary">
          <MetaItem label="Ausstattungslinie" value={detail.trimName} />
          <MetaItem label="Status" value={detail.statusDescription} />
          <MetaItem label="Paket" value={detail.packageName} />
          <MetaItem label="Confidence" value={detail.confidence} />
        </div>

        {detail.contradictionNote && (
          <p className="eq-inspector-source-warning" role="status">{detail.contradictionNote}</p>
        )}

        {!detail.hasSource ? (
          <p className="eq-inspector-empty">Keine Quelle hinterlegt</p>
        ) : (
          <div className="eq-inspector-source-list">
            {detail.sources.map((source, index) => (
              <article key={`${source.document}-${source.page}-${index}`} className="eq-inspector-source-card">
                <h4 className="eq-inspector-source-card__title">
                  Quelle {detail.sources.length > 1 ? index + 1 : ''}
                </h4>
                <MetaItem label="Dokument" value={source.document} />
                <MetaItem label="Typ" value={source.sourceType} />
                <MetaItem label="Gültig ab" value={source.validFrom} />
                <MetaItem label="Abschnitt" value={source.section} />
                <MetaItem label="Seite" value={source.page} />
                <MetaItem label="Confidence" value={source.confidence} />
                {source.trimName && <MetaItem label="Trim" value={source.trimName} />}
                {source.packageName && <MetaItem label="Paket" value={source.packageName} />}
                {source.rawText && (
                  <div className="eq-inspector-source-card__raw">
                    <span className="eq-inspector-meta__label">Originaltext</span>
                    <p className="eq-inspector-raw">{source.rawText}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="eq-inspector-modal__actions">
          <button type="button" className="eq-inspector-btn eq-inspector-btn--ghost" onClick={onClose}>
            Schließen
          </button>
          <button
            type="button"
            className="eq-inspector-btn eq-inspector-btn--primary"
            onClick={handleCopy}
            disabled={!detail.copyText}
          >
            Text kopieren
          </button>
        </div>
        {copyMessage && <p className="eq-inspector-hint" role="status">{copyMessage}</p>}
      </div>
    </div>
  );
}
