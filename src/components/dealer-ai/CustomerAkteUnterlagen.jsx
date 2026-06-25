import {
  countUnterlagenOpenTasks,
  formatUnterlagenOpenLabel,
} from '../../services/cleverUnterlagen.js';
import { countAkteDocuments, formatDocumentsCompactLabel } from '../../services/customerAkteDocuments.js';
import './CustomerAkte.css';

export default function CustomerAkteUnterlagen({
  lead,
  paymentType,
  onOpen,
}) {
  const pt = paymentType ?? lead?.paymentType ?? 'leasing';
  const { openCount, showSa, saComplete } = countUnterlagenOpenTasks(lead, pt);
  const docCount = countAkteDocuments(lead);
  const taskLabel = formatUnterlagenOpenLabel(openCount, { showSa, saComplete });
  const statusLabel = docCount > 0
    ? `${formatDocumentsCompactLabel(docCount)}${openCount > 0 ? ` · ${taskLabel}` : ''}`
    : taskLabel;
  return (
    <section className="cust-akte-unterlagen cust-akte-compact-row cust-akte-tier-3" aria-labelledby="cust-akte-unterlagen-title">
      <div className="cust-akte-compact-row__main">
        <span id="cust-akte-unterlagen-title" className="cust-akte-compact-row__title">Unterlagen</span>
        <span className={`cust-akte-compact-row__meta${openCount > 0 ? ' cust-akte-compact-row__meta--warn' : ''}`}>
          {statusLabel}
        </span>
      </div>
      <button type="button" className="cust-akte-compact-row__action" onClick={onOpen}>
        Alle anzeigen
      </button>
    </section>
  );
}
