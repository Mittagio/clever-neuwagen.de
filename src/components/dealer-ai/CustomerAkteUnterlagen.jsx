import { useState } from 'react';
import {
  countUnterlagenOpenTasks,
  formatUnterlagenOpenLabel,
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
  const [expanded, setExpanded] = useState(false);
  const pt = paymentType ?? lead?.paymentType ?? 'leasing';
  const { openCount, summary, saComplete } = countUnterlagenOpenTasks(lead, pt);
  const showSaSlot = needsSelbstauskunft(pt);
  const selbstauskunft = getSelbstauskunft(summary.data);
  const statusLabel = formatUnterlagenOpenLabel(openCount, { showSa: showSaSlot, saComplete });

  function toggleExpanded() {
    setExpanded((v) => !v);
  }

  return (
    <section className="cust-akte-unterlagen cust-akte-unterlagen--compact" aria-labelledby="cust-akte-unterlagen-title">
      <button
        type="button"
        className="cust-akte-unterlagen__toggle"
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <span id="cust-akte-unterlagen-title" className="cust-akte-unterlagen__toggle-title">
          <span aria-hidden>📂</span> Abschluss & Unterlagen
        </span>
        <span className={`cust-akte-unterlagen__toggle-meta${openCount > 0 ? ' cust-akte-unterlagen__toggle-meta--open' : ''}`}>
          {statusLabel}
        </span>
        <span className="cust-akte-unterlagen__chevron" aria-hidden>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="cust-akte-unterlagen__panel">
          <ul className="cust-akte-unterlagen__list">
            {summary.slots.map((slot) => {
              const item = summary.items[slot.id];
              const line = formatSlotLine(slot.id, item, selbstauskunft, showSaSlot);
              return (
                <li key={slot.id} className="cust-akte-unterlagen__row">
                  <span className="cust-akte-unterlagen__icon" aria-hidden>
                    {SLOT_ICONS[slot.id] ?? '📎'}
                  </span>
                  <span className="cust-akte-unterlagen__name">{slot.label}</span>
                  <span className="cust-akte-unterlagen__state">{line}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="cust-akte-unterlagen__open" onClick={onOpen}>
            Unterlagen verwalten
          </button>
        </div>
      )}
    </section>
  );
}
