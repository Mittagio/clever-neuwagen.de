import { useState } from 'react';
import { LEXICON_TRANSFER_MODES } from '../../services/clever/intelligence/lexiconTransferService.js';
import { requestLexiconTransfer } from '../../services/clever/intelligence/cleverSharedIntelligenceClient.js';
import './LexiconTransferSheet.css';

const MODE_OPTIONS = [
  { id: LEXICON_TRANSFER_MODES.DISCUSSED_INFO, label: 'Als besprochene Information speichern' },
  { id: LEXICON_TRANSFER_MODES.CUSTOMER_INTEREST, label: 'Als Kundeninteresse speichern' },
  { id: LEXICON_TRANSFER_MODES.HARD_REQUIREMENT, label: 'Als zwingenden Kundenwunsch speichern' },
  { id: LEXICON_TRANSFER_MODES.VEHICLE_DIRECTION, label: 'Mit Fahrzeugrichtung verknüpfen' },
  { id: LEXICON_TRANSFER_MODES.NOTE_ONLY, label: 'Nur als Gesprächsnotiz speichern' },
];

/**
 * Bestätigungs-Sheet: Lexikon → Kundenakte (keine Auto-Speicherung).
 */
export default function LexiconTransferSheet({
  open,
  onClose,
  lexiconResult,
  query = '',
  lead = null,
  onApplied = null,
}) {
  const [mode, setMode] = useState(LEXICON_TRANSFER_MODES.DISCUSSED_INFO);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  async function loadPreview() {
    setBusy(true);
    setError(null);
    try {
      const data = await requestLexiconTransfer({
        lexiconResult,
        mode,
        query,
        previewOnly: true,
        sellerId: 'local-seller',
      });
      if (!data.ok) throw new Error(data.error ?? 'preview_failed');
      setPreview(data.preview);
    } catch (err) {
      setError(err?.message ?? 'Vorschau fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function confirmTransfer() {
    setBusy(true);
    setError(null);
    try {
      const data = await requestLexiconTransfer({
        lexiconResult,
        mode,
        query,
        lead,
        confirmed: true,
        sellerId: 'local-seller',
      });
      if (!data.ok || !data.applied) {
        throw new Error(data.error ?? 'confirmation_required');
      }
      onApplied?.(data.lead, data.preview);
      onClose?.();
    } catch (err) {
      setError(err?.message ?? 'Übernahme fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lex-transfer" role="dialog" aria-modal="true" aria-labelledby="lex-transfer-title">
      <div className="lex-transfer__panel">
        <header className="lex-transfer__head">
          <h3 id="lex-transfer-title">Für Kundenakte übernehmen</h3>
          <p>Eine Lexikonfrage ist kein automatischer Kundenwunsch. Bitte Speicherart wählen.</p>
        </header>

        <div className="lex-transfer__modes">
          {MODE_OPTIONS.map((opt) => (
            <label key={opt.id} className="lex-transfer__mode">
              <input
                type="radio"
                name="lex-transfer-mode"
                checked={mode === opt.id}
                onChange={() => {
                  setMode(opt.id);
                  setPreview(null);
                }}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="lex-transfer__actions">
          <button type="button" onClick={loadPreview} disabled={busy}>
            Vorschau anzeigen
          </button>
          <button type="button" onClick={confirmTransfer} disabled={busy || !preview}>
            Bestätigen und speichern
          </button>
          <button type="button" className="lex-transfer__ghost" onClick={onClose}>
            Abbrechen
          </button>
        </div>

        {preview && (
          <div className="lex-transfer__preview">
            <p><strong>Vorschau</strong></p>
            {preview.sellerInsightText && <p>{preview.sellerInsightText}</p>}
            {preview.noteText && <p>Notiz: {preview.noteText}</p>}
            {preview.linkModels?.length > 0 && (
              <p>Modelle: {preview.linkModels.join(', ')}</p>
            )}
          </div>
        )}

        {error && <p className="lex-transfer__error">{error}</p>}
      </div>
    </div>
  );
}
