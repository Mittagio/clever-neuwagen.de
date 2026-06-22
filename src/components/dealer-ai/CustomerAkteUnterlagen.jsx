import {
  countUnterlagenOpenTasks,
  formatUnterlagenOpenLabel,
} from '../../services/cleverUnterlagen.js';
import './CustomerAkte.css';

export default function CustomerAkteUnterlagen({
  lead,
  paymentType,
  onOpen,
}) {
  const pt = paymentType ?? lead?.paymentType ?? 'leasing';
  const { openCount, showSa, saComplete } = countUnterlagenOpenTasks(lead, pt);
  const statusLabel = formatUnterlagenOpenLabel(openCount, { showSa, saComplete });

  return (
    <section className="cust-akte-unterlagen cust-akte-unterlagen--compact cust-akte-summary" aria-labelledby="cust-akte-unterlagen-title">
      <button
        type="button"
        className="cust-akte-summary__row"
        onClick={onOpen}
      >
        <span className="cust-akte-summary__main">
          <span id="cust-akte-unterlagen-title" className="cust-akte-summary__title">
            Abschluss & Unterlagen
          </span>
          <span className={`cust-akte-summary__line${openCount > 0 ? ' cust-akte-summary__line--warn' : ''}`}>
            {statusLabel}
          </span>
        </span>
        <span className="cust-akte-summary__cta">›</span>
      </button>
    </section>
  );
}
