import { useState } from 'react';
import {
  CONVERSATION_LINK_TYPES,
  createConversationNote,
  deleteConversationNote,
  normalizeConversationNotes,
  updateConversationNote,
} from '../../services/kundenhelferConversationNotes.js';
import './CustomerAkteConversationNotes.css';

function formatNoteWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NoteCard({
  note,
  vehicleCards = [],
  onChange,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);

  function saveText() {
    const text = draft.trim();
    if (!text) {
      onDelete?.(note.id);
      return;
    }
    onChange?.(note.id, { text });
    setEditing(false);
  }

  function handleLinkTypeChange(linkType) {
    if (!linkType) {
      onChange?.(note.id, { linkType: null, linkId: null, linkLabel: null });
      return;
    }
    onChange?.(note.id, { linkType, linkId: null, linkLabel: null });
  }

  function handleLinkTargetChange(linkId) {
    const card = vehicleCards.find((c) => c.id === linkId);
    onChange?.(note.id, {
      linkType: note.linkType === 'offer' ? 'offer' : 'vehicle',
      linkId,
      linkLabel: card ? `${card.brand ?? 'Kia'} ${card.model ?? ''}`.trim() : linkId,
    });
  }

  return (
    <article className={`cust-cn-note${note.important ? ' cust-cn-note--important' : ''}`}>
      <div className="cust-cn-note__head">
        <p className="cust-cn-note__meta">
          {formatNoteWhen(note.updatedAt)}
          {note.linkLabel && (
            <>
              {' · '}
              <span className="cust-cn-note__link">{note.linkLabel}</span>
            </>
          )}
        </p>
        <div className="cust-cn-note__flags">
          <button
            type="button"
            className={`cust-cn-note__flag${note.important ? ' is-active' : ''}`}
            onClick={() => onChange?.(note.id, { important: !note.important })}
            aria-pressed={note.important}
            title="Als wichtig markieren"
          >
            ★
          </button>
          <button
            type="button"
            className={`cust-cn-note__flag${note.includeInOffer ? ' is-active' : ''}`}
            onClick={() => onChange?.(note.id, { includeInOffer: !note.includeInOffer })}
            aria-pressed={note.includeInOffer}
            title="In Angebot übernehmen"
          >
            Angebot
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            className="cust-cn-note__textarea"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Gesprächsnotiz …"
            autoFocus
          />
          <div className="cust-cn-note__edit-actions">
            <button type="button" className="cust-cn-note__btn cust-cn-note__btn--primary" onClick={saveText}>
              Speichern
            </button>
            <button
              type="button"
              className="cust-cn-note__btn"
              onClick={() => {
                setDraft(note.text);
                setEditing(false);
              }}
            >
              Abbrechen
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="cust-cn-note__text">{note.text}</p>
          <button type="button" className="cust-cn-note__edit-link" onClick={() => setEditing(true)}>
            Bearbeiten
          </button>
        </>
      )}

      <div className="cust-cn-note__links">
        <label className="cust-cn-note__field-label">
          Verknüpfung
          <select
            className="cust-cn-note__select"
            value={note.linkType ?? ''}
            onChange={(e) => handleLinkTypeChange(e.target.value || null)}
          >
            <option value="">Keine</option>
            {CONVERSATION_LINK_TYPES.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </label>
        {(note.linkType === 'vehicle' || note.linkType === 'offer') && vehicleCards.length > 0 && (
          <label className="cust-cn-note__field-label">
            Fahrzeug / Angebot
            <select
              className="cust-cn-note__select"
              value={note.linkId ?? ''}
              onChange={(e) => handleLinkTargetChange(e.target.value)}
            >
              <option value="">Bitte wählen</option>
              {vehicleCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.brand ?? 'Kia'} {card.model ?? card.label ?? card.id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button type="button" className="cust-cn-note__delete" onClick={() => onDelete?.(note.id)}>
        Notiz löschen
      </button>
    </article>
  );
}

/**
 * Gesprächsnotizen – Fließtext unter den Kundenhelfer-Chips.
 */
export default function CustomerAkteConversationNotes({
  notes = [],
  onChange,
  vehicleCards = [],
  disabled = false,
}) {
  const [draft, setDraft] = useState('');
  const list = normalizeConversationNotes(notes);

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    onChange?.([createConversationNote(text), ...list]);
    setDraft('');
  }

  function handlePatch(id, patch) {
    onChange?.(updateConversationNote(list, id, patch));
  }

  function handleDelete(id) {
    onChange?.(deleteConversationNote(list, id));
  }

  return (
    <section className="cust-cn-notes" aria-labelledby="cust-cn-notes-title">
      <div className="cust-cn-notes__head">
        <h3 id="cust-cn-notes-title" className="cust-cn-notes__title">Gesprächsnotizen</h3>
        <p className="cust-cn-notes__hint">Längere Infos aus dem Gespräch – intern für Verkauf & Angebot.</p>
      </div>

      <div className="cust-cn-notes__composer">
        <textarea
          className="cust-cn-notes__textarea"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="z. B. DAT-Bewertung 34.356 €, Ablöse Bank11 bis 30.06.2026 …"
          disabled={disabled}
        />
        <button
          type="button"
          className="cust-cn-notes__add"
          onClick={handleAdd}
          disabled={disabled || !draft.trim()}
        >
          Notiz speichern
        </button>
      </div>

      {list.length > 0 ? (
        <div className="cust-cn-notes__list">
          {list.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              vehicleCards={vehicleCards}
              onChange={handlePatch}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <p className="cust-cn-notes__empty">Noch keine Gesprächsnotiz</p>
      )}
    </section>
  );
}
