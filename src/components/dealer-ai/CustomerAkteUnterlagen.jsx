import {
  computeUnterlagenSummary,
  getUnterlagenSubline,
} from '../../services/cleverUnterlagen.js';
import {
  formatSelbstauskunftSummary,
  getSelbstauskunft,
  needsSelbstauskunft,
} from '../../services/cleverSelbstauskunft.js';
import './CustomerAkte.css';

export default function CustomerAkteUnterlagen({
  lead,
  paymentType,
  onOpen,
}) {
  const pt = paymentType ?? lead?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, pt);
  const subline = getUnterlagenSubline(pt);
  const showSa = needsSelbstauskunft(pt);
  const selbstauskunft = getSelbstauskunft(summary.data);
  const saSummary = showSa
    ? formatSelbstauskunftSummary(selbstauskunft, selbstauskunft.uploadCount ?? 0)
    : null;

  return (
    <section className="cust-akte-unterlagen" aria-labelledby="cust-akte-unterlagen-title">
      <button type="button" className="cust-akte-unterlagen__card" onClick={onOpen}>
        <div className="cust-akte-unterlagen__head">
          <div>
            <h2 id="cust-akte-unterlagen-title" className="cust-akte-unterlagen__title">
              Clever Unterlagen
            </h2>
            <p className="cust-akte-unterlagen__sub">
              {showSa
                ? 'Alles für Bank, Leasing und Abschluss an einem Ort.'
                : 'Alles für Bank, Zulassung und Abschluss an einem Ort.'}
            </p>
          </div>
          <span className="cust-akte-unterlagen__chev" aria-hidden>›</span>
        </div>
        <p className="cust-akte-unterlagen__status">{summary.headline}</p>
        {showSa && saSummary && (
          <p className="cust-akte-unterlagen__sa">Selbstauskunft · {saSummary}</p>
        )}
        <p className="cust-akte-unterlagen__hint">{subline}</p>
        {(summary.hasUploadLink || selbstauskunft.link?.url) && (
          <p className="cust-akte-unterlagen__link-badge">Link bereit</p>
        )}
      </button>
      <p className="cust-akte-unterlagen__privacy">
        Unterlagen sind nur für berechtigte Nutzer im Autohaus sichtbar.
      </p>
    </section>
  );
}
