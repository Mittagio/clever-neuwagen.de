import { useMemo, useState } from 'react';
import {
  SHOWROOM_TABS,
  getShowroomGroupsForTab,
} from '../../data/showroom/showroomModeChipGroups.js';
import { hasShowroomCaptureContent } from '../../services/showroom/showroomQuickCaptureService.js';
import './showroom-mode.css';

function ChipSection({ groups, selectedIds, onToggle }) {
  return groups.map((group) => (
    <section key={group.id} className="showroom-chip-section">
      <h3 className="showroom-chip-section__title">{group.label}</h3>
      <div className="showroom-chip-grid">
        {group.chips.map((chip) => {
          const active = selectedIds.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              className={`showroom-chip${active ? ' showroom-chip--active' : ''}`}
              onClick={() => onToggle(chip.id)}
              aria-pressed={active}
            >
              {chip.emoji && <span className="showroom-chip__emoji" aria-hidden>{chip.emoji}</span>}
              <span className="showroom-chip__label">{chip.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  ));
}

export default function ShowroomModeCapture({
  initialCapture = null,
  existingLead = null,
  onSave,
  onBack,
  saving = false,
}) {
  const [activeTab, setActiveTab] = useState('auto');
  const [autoChipIds, setAutoChipIds] = useState(initialCapture?.autoChipIds ?? []);
  const [paymentChipIds, setPaymentChipIds] = useState(initialCapture?.paymentChipIds ?? []);
  const [customerChipIds, setCustomerChipIds] = useState(initialCapture?.customerChipIds ?? []);
  const [note, setNote] = useState(initialCapture?.note ?? '');

  const groups = useMemo(() => getShowroomGroupsForTab(activeTab), [activeTab]);

  const selectedForTab = useMemo(() => {
    if (activeTab === 'auto') return autoChipIds;
    if (activeTab === 'payment') return paymentChipIds;
    if (activeTab === 'customer') return customerChipIds;
    return [];
  }, [activeTab, autoChipIds, paymentChipIds, customerChipIds]);

  const captureDraft = useMemo(() => ({
    autoChipIds,
    paymentChipIds,
    customerChipIds,
    note,
  }), [autoChipIds, paymentChipIds, customerChipIds, note]);

  const canSave = hasShowroomCaptureContent(captureDraft);

  const tabCounts = useMemo(() => ({
    auto: autoChipIds.length,
    payment: paymentChipIds.length,
    customer: customerChipIds.length,
    note: note.trim() ? 1 : 0,
  }), [autoChipIds.length, paymentChipIds.length, customerChipIds.length, note]);

  function toggleChip(chipId) {
    if (activeTab === 'auto') {
      setAutoChipIds((prev) => (prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]));
      return;
    }
    if (activeTab === 'payment') {
      setPaymentChipIds((prev) => (prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]));
      return;
    }
    if (activeTab === 'customer') {
      setCustomerChipIds((prev) => (prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]));
    }
  }

  function handleSave() {
    if (!canSave) return;
    onSave?.({
      ...captureDraft,
      id: initialCapture?.id,
      createdAt: initialCapture?.createdAt,
    });
  }

  return (
    <div className="showroom-mode">
      <header className="showroom-mode__head">
        <button type="button" className="showroom-mode__back" onClick={onBack}>
          ← Zurück
        </button>
        <div>
          <p className="showroom-mode__kicker">Showroom Modus</p>
          <h1 className="showroom-mode__title">Schnell aufnehmen</h1>
          <p className="showroom-mode__lead">
            {existingLead?.contact?.name
              ? `Für ${existingLead.contact.name} – lose tippen, was im Gespräch fällt.`
              : 'Lose tippen, was im Gespräch fällt – ohne Pflichtfelder.'}
          </p>
        </div>
      </header>

      <nav className="showroom-mode__tabs" aria-label="Showroom Bereiche">
        {SHOWROOM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`showroom-mode__tab${activeTab === tab.id ? ' showroom-mode__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="showroom-mode__tab-icon" aria-hidden>{tab.icon}</span>
            <span className="showroom-mode__tab-label">{tab.label}</span>
            {tabCounts[tab.id] > 0 && (
              <span className="showroom-mode__tab-badge">{tabCounts[tab.id]}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="showroom-mode__panel">
        {activeTab === 'note' ? (
          <label className="showroom-note">
            <span className="showroom-note__label">Gesprächsnotiz</span>
            <textarea
              className="showroom-note__field"
              rows={6}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. Kunde am Fahrzeug gesprochen, fährt viel Fahrrad, Rückruf gewünscht."
            />
            <span className="showroom-note__hint">Alles, was nicht sauber in Chips passt.</span>
          </label>
        ) : (
          <ChipSection
            groups={groups}
            selectedIds={selectedForTab}
            onToggle={toggleChip}
          />
        )}
      </div>

      <footer className="showroom-mode__footer">
        <button
          type="button"
          className="showroom-mode__save"
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? 'Wird gespeichert …' : 'In Kundenakte übernehmen'}
        </button>
        <p className="showroom-mode__footer-hint">
          Handy = schnell aufnehmen · Kundenakte = sauber bearbeiten
        </p>
      </footer>
    </div>
  );
}
