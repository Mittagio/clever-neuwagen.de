import {
  computeUnterlagenSummary,
  UNTERLAGEN_STATUS,
} from '../../services/cleverUnterlagen.js';
import {
  formatSelbstauskunftSummary,
  getSelbstauskunft,
  needsSelbstauskunft,
} from '../../services/cleverSelbstauskunft.js';
import './CustomerAkte.css';

const SLOT_ICONS = {
  selbstauskunft: '📄',
  ausweis: '📷',
  gehaltsnachweis: '💰',
  bankverbindung: '🏦',
  finanzierung: '📋',
  zulassungsvollmacht: '✍️',
};

function formatSlotLine(slotId, item, selbstauskunft, showSa) {
  if (slotId === 'selbstauskunft' && showSa && selbstauskunft) {
    return formatSelbstauskunftSummary(selbstauskunft, selbstauskunft.uploadCount ?? 0);
  }
  const statusId = item?.status ?? 'open';
  if (statusId === 'open') return 'Nicht gestartet';
  const status = UNTERLAGEN_STATUS[statusId];
  if (statusId === 'uploaded') return 'Vorhanden';
  if (statusId === 'checked') return 'Geprüft';
  return status?.label ?? 'Offen';
}

export default function CustomerAkteUnterlagen({
  lead,
  paymentType,
  onOpen,
}) {
  const pt = paymentType ?? lead?.paymentType ?? 'leasing';
  const summary = computeUnterlagenSummary(lead, pt);
  const showSa = needsSelbstauskunft(pt);
  const selbstauskunft = getSelbstauskunft(summary.data);
  const previewSlots = summary.slots.filter((slot) => (
    ['selbstauskunft', 'ausweis', 'gehaltsnachweis'].includes(slot.id)
    || (!showSa && slot.id === 'ausweis')
  )).slice(0, 4);

  const rows = previewSlots.length > 0
    ? previewSlots
    : summary.slots.slice(0, 3);

  return (
    <section className="cust-akte-unterlagen" aria-labelledby="cust-akte-unterlagen-title">
      <div className="cust-akte-section__head">
        <h2 id="cust-akte-unterlagen-title" className="cust-akte-section__title">Clever Unterlagen</h2>
        <button type="button" className="cust-akte-section__link" onClick={onOpen}>
          Öffnen
        </button>
      </div>

      <button type="button" className="cust-akte-unterlagen__list" onClick={onOpen}>
        {rows.map((slot) => {
          const item = summary.items[slot.id];
          const line = formatSlotLine(slot.id, item, selbstauskunft, showSa);
          return (
            <div key={slot.id} className="cust-akte-unterlagen__row">
              <span className="cust-akte-unterlagen__icon" aria-hidden>
                {SLOT_ICONS[slot.id] ?? '📎'}
              </span>
              <span className="cust-akte-unterlagen__name">{slot.label}</span>
              <span className="cust-akte-unterlagen__state">{line}</span>
            </div>
          );
        })}
      </button>
    </section>
  );
}
