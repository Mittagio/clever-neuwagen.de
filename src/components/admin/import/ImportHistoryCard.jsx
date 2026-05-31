import {
  countApprovedChanges,
  formatImportDate,
  IMPORT_STATUS_LABELS,
} from '../../../data/priceListImport.js';
import './ImportHistoryCard.css';

export default function ImportHistoryCard({ importRecord }) {
  const changesCount = countApprovedChanges(importRecord);
  const date = formatImportDate(importRecord.approvedAt ?? importRecord.uploadedAt);

  return (
    <article className="import-history-card">
      <div className="import-history-card__date">{date}</div>
      <div className="import-history-card__body">
        <h3 className="import-history-card__title">
          {importRecord.brand} {importRecord.model}
        </h3>
        <p className="import-history-card__version">Version {importRecord.version}</p>
        <p className="import-history-card__meta">
          {changesCount} Änderung{changesCount !== 1 ? 'en' : ''} übernommen
        </p>
        {importRecord.sourceFile?.name && (
          <p className="import-history-card__file">{importRecord.sourceFile.name}</p>
        )}
      </div>
      <span className={`import-history-card__status import-history-card__status--${importRecord.status}`}>
        {IMPORT_STATUS_LABELS[importRecord.status] ?? importRecord.status}
      </span>
    </article>
  );
}

export function ImportHistoryEmpty() {
  return (
    <div className="import-history-empty">
      <p className="import-history-empty__title">Noch keine freigegebenen Importe</p>
      <p className="import-history-empty__sub">
        Nach dem Upload und der Freigabe erscheinen Preislisten hier.
      </p>
    </div>
  );
}
