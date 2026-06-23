import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCleverAntwortEmailSubject,
  buildCleverAntwortenContext,
  CLEVER_ANTWORTEN_HISTORY,
  CLEVER_ANTWORTEN_TYPES,
  generateCleverAntwortText,
  getCleverAntwortTypeLabel,
  refineCleverAntwortText,
  suggestCleverAntwortType,
} from '../../services/cleverAntworten.js';
import {
  CLEVER_DIKTAT_HISTORY,
  createDiktatSpeechRecognizer,
  DIKTAT_CHANNELS,
  DIKTAT_TONES,
  formatDiktatDuration,
  generateCleverDiktatText,
  refineCleverDiktatText,
  supportsBrowserSpeechRecognition,
} from '../../services/cleverDiktat.js';
import { buildOfferMailtoHref, buildOfferWhatsappHref } from '../../services/vehicleOffer.js';
import './CleverAntwortenSheet.css';

const DIKTAT_TYPE_ID = 'diktat';

function TextPreviewEditor({
  label,
  draft,
  onDraftChange,
  phone,
  email,
  context,
  onSaveNote,
  onRefine,
  onTrackChannel,
  showToast,
  onAddHistory,
  historyCopied,
}) {
  const whatsappHref = useMemo(() => {
    if (!phone?.trim() || !draft.trim()) return null;
    return buildOfferWhatsappHref(phone, draft);
  }, [phone, draft]);

  const mailtoHref = useMemo(() => {
    if (!email?.trim() || !draft.trim()) return null;
    return buildOfferMailtoHref(email, buildCleverAntwortEmailSubject(context), draft);
  }, [email, draft, context]);

  async function handleCopy() {
    if (!draft.trim()) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draft);
      }
      showToast('Text kopiert');
      onAddHistory?.(historyCopied, 'note');
    } catch {
      showToast('Kopieren nicht möglich');
    }
  }

  return (
    <>
      <label className="dai-ca-editor__label" htmlFor="dai-ca-draft">
        {label}
      </label>
      <textarea
        id="dai-ca-draft"
        className="dai-ca-editor__field"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={8}
        aria-label="Textvorschlag bearbeiten"
      />

      <div className="dai-ca-actions">
        <button type="button" className="dai-ca-actions__btn dai-ca-actions__btn--primary" onClick={handleCopy}>
          Kopieren
        </button>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            className="dai-ca-actions__btn"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onTrackChannel('whatsapp')}
          >
            WhatsApp
          </a>
        ) : (
          <button type="button" className="dai-ca-actions__btn" disabled title="Telefon ergänzen">
            WhatsApp
          </button>
        )}
        {mailtoHref ? (
          <a href={mailtoHref} className="dai-ca-actions__btn" onClick={() => onTrackChannel('email')}>
            E-Mail
          </a>
        ) : (
          <button type="button" className="dai-ca-actions__btn" disabled title="E-Mail ergänzen">
            E-Mail
          </button>
        )}
      </div>

      {!phone?.trim() && (
        <p className="dai-ca-hint">Telefon ergänzen, um per WhatsApp zu senden.</p>
      )}
      {phone?.trim() && !email?.trim() && (
        <p className="dai-ca-hint">Mit E-Mail geht der Text direkt aus dem Postfach raus.</p>
      )}

      <div className="dai-ca-actions" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" className="dai-ca-actions__btn" onClick={onSaveNote}>
          Als Notiz speichern
        </button>
        <button type="button" className="dai-ca-actions__btn" onClick={() => onRefine('neu')}>
          Neu formulieren
        </button>
      </div>

      <div className="dai-ca-refine" aria-label="Text anpassen">
        <button type="button" className="dai-ca-refine__btn" onClick={() => onRefine('kuerzer')}>
          Kürzer
        </button>
        <button type="button" className="dai-ca-refine__btn" onClick={() => onRefine('freundlicher')}>
          Freundlicher
        </button>
        <button type="button" className="dai-ca-refine__btn" onClick={() => onRefine('verbindlicher')}>
          Verbindlicher
        </button>
        <button type="button" className="dai-ca-refine__btn" onClick={() => onRefine('lockerer')}>
          Lockerer
        </button>
      </div>
    </>
  );
}

export default function CleverAntwortenSheet({
  lead = null,
  customerName = '',
  phone = '',
  email = '',
  vehicleCards = [],
  kundenhelferNotes = '',
  sellerName = '',
  dealerName = '',
  wishPaymentType = 'unknown',
  initialTypeId = null,
  embedded = false,
  onAddHistory,
}) {
  const context = useMemo(() => buildCleverAntwortenContext({
    lead,
    customerName,
    phone,
    email,
    vehicleCards,
    kundenhelferNotes,
    sellerName,
    dealerName,
    wishPaymentType,
  }), [lead, customerName, phone, email, vehicleCards, kundenhelferNotes, sellerName, dealerName, wishPaymentType]);

  const speechAvailable = useMemo(() => supportsBrowserSpeechRecognition(), []);

  const defaultType = initialTypeId ?? suggestCleverAntwortType(context);
  const [phase, setPhase] = useState(initialTypeId ? 'edit' : 'pick');
  const [typeId, setTypeId] = useState(defaultType);
  const [draft, setDraft] = useState(() => (
    initialTypeId ? generateCleverAntwortText(initialTypeId, context) : ''
  ));
  const [toast, setToast] = useState('');

  const [diktatTranscript, setDiktatTranscript] = useState('');
  const [diktatInterim, setDiktatInterim] = useState('');
  const [diktatTone, setDiktatTone] = useState('freundlich');
  const [diktatChannel, setDiktatChannel] = useState('whatsapp');
  const [diktatRecording, setDiktatRecording] = useState('idle');
  const [diktatSeconds, setDiktatSeconds] = useState(0);

  const recognizerRef = useRef(null);
  const timerRef = useRef(null);
  const diktatTextRef = useRef('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    recognizerRef.current?.abort?.();
  }, []);

  const loadType = useCallback((nextType) => {
    setTypeId(nextType);
    const text = generateCleverAntwortText(nextType, context);
    setDraft(text);
    setPhase('edit');
    onAddHistory?.(
      `${CLEVER_ANTWORTEN_HISTORY.created}: ${getCleverAntwortTypeLabel(nextType)}`,
      'note',
    );
  }, [context, onAddHistory]);

  function openDiktat() {
    diktatTextRef.current = '';
    setDiktatTranscript('');
    setDiktatInterim('');
    setDiktatRecording('idle');
    setDiktatSeconds(0);
    setPhase('diktat');
  }

  function startDiktatRecording() {
    setDiktatRecording('recording');
    setDiktatSeconds(0);
    setDiktatInterim('');
    setDiktatTranscript('');

    timerRef.current = setInterval(() => {
      setDiktatSeconds((s) => s + 1);
    }, 1000);

    if (!speechAvailable) return;

    const rec = createDiktatSpeechRecognizer({
      onInterim: (text) => {
        diktatTextRef.current = text;
        setDiktatInterim(text);
      },
      onFinal: (text) => {
        diktatTextRef.current = text;
        setDiktatTranscript(text);
      },
      onError: () => {
        showToast('Spracheingabe unterbrochen – bitte Text eingeben');
      },
    });
    recognizerRef.current = rec;
    try {
      rec?.start();
    } catch {
      showToast('Spracheingabe nicht gestartet – bitte Text eingeben');
    }
  }

  function stopDiktatRecording() {
    clearInterval(timerRef.current);
    recognizerRef.current?.stop?.();
    setDiktatRecording('processing');

    setTimeout(() => {
      const spoken = (diktatTextRef.current || diktatTranscript || diktatInterim).trim();
      if (spoken) {
        diktatTextRef.current = spoken;
        setDiktatTranscript(spoken);
      }
      setDiktatRecording('idle');
    }, 500);
  }

  function discardDiktat() {
    clearInterval(timerRef.current);
    recognizerRef.current?.abort?.();
    diktatTextRef.current = '';
    setDiktatTranscript('');
    setDiktatInterim('');
    setDiktatRecording('idle');
    setDiktatSeconds(0);
  }

  function generateFromDiktat() {
    const raw = (diktatTextRef.current || diktatTranscript || diktatInterim).trim();
    if (!raw) {
      showToast('Bitte kurz sprechen oder eintippen');
      return;
    }

    setDiktatRecording('processing');
    setTimeout(() => {
      const text = generateCleverDiktatText(raw, context, {
        tone: diktatTone,
        channel: diktatChannel,
      });
      setDiktatTranscript(raw);
      setTypeId(DIKTAT_TYPE_ID);
      setDraft(text);
      setPhase('edit');
      setDiktatRecording('idle');
    }, 350);
  }

  function handleRefine(variant) {
    if (typeId === DIKTAT_TYPE_ID) {
      const next = refineCleverDiktatText(
        draft,
        variant,
        diktatTranscript,
        context,
        { tone: diktatTone, channel: diktatChannel },
      );
      setDraft(next);
      if (variant === 'neu' || variant === 'neu_formulieren') {
        onAddHistory?.(CLEVER_DIKTAT_HISTORY.refined, 'note');
      }
      return;
    }
    const next = refineCleverAntwortText(draft, variant, context, typeId);
    setDraft(next);
    if (variant === 'neu' || variant === 'neu_formulieren') {
      onAddHistory?.(CLEVER_ANTWORTEN_HISTORY.refined, 'note');
    }
  }

  function handleSaveNote() {
    if (!draft.trim()) return;
    const prefix = typeId === DIKTAT_TYPE_ID
      ? CLEVER_DIKTAT_HISTORY.note_saved
      : CLEVER_ANTWORTEN_HISTORY.note_saved;
    onAddHistory?.(`${prefix}\n\n${draft.trim()}`, 'note');
    showToast('Als Notiz gespeichert');
  }

  function trackChannel(channel) {
    if (typeId === DIKTAT_TYPE_ID) {
      onAddHistory?.(
        channel === 'whatsapp' ? CLEVER_DIKTAT_HISTORY.whatsapp : CLEVER_DIKTAT_HISTORY.email,
        'note',
      );
      return;
    }
    const label = getCleverAntwortTypeLabel(typeId);
    if (channel === 'whatsapp') {
      onAddHistory?.(`${CLEVER_ANTWORTEN_HISTORY.whatsapp}: ${label}`, 'note');
    } else if (channel === 'email') {
      onAddHistory?.(`${CLEVER_ANTWORTEN_HISTORY.email}: ${label}`, 'note');
    }
  }

  const previewLabel = typeId === DIKTAT_TYPE_ID
    ? 'Textvorschlag · Clever Diktat'
    : `Textvorschlag · ${getCleverAntwortTypeLabel(typeId)}`;

  const historyCopied = typeId === DIKTAT_TYPE_ID
    ? CLEVER_DIKTAT_HISTORY.copied
    : `${CLEVER_ANTWORTEN_HISTORY.copied}: ${getCleverAntwortTypeLabel(typeId)}`;

  const liveTranscript = diktatTranscript || diktatInterim;

  return (
    <div className={`dai-ca-sheet${embedded ? ' dai-ca-sheet--embedded' : ''}`}>
      {!embedded && (
        <p className="dai-ca-sheet__subline">Passenden Text für diesen Kunden erstellen.</p>
      )}

      {phase === 'pick' && (
        <>
          <button type="button" className="dai-ca-diktat-entry" onClick={openDiktat}>
            <span className="dai-ca-diktat-entry__icon" aria-hidden>🎙</span>
            <span className="dai-ca-diktat-entry__text">
              <strong>Antwort diktieren</strong>
              <small>Kurz sprechen – KI formuliert den Text</small>
            </span>
          </button>

          <div className="dai-ca-chips" role="listbox" aria-label="Texttyp wählen">
            {CLEVER_ANTWORTEN_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`dai-ca-chip${type.id === typeId ? ' is-active' : ''}`}
                onClick={() => loadType(type.id)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'diktat' && (
        <div className="dai-ca-diktat">
          <button type="button" className="dai-ca-back" onClick={() => setPhase('pick')}>
            ← Zurück zu Clever Antworten
          </button>

          <p className="dai-ca-diktat__title">Clever Diktat</p>

          <div className="dai-ca-diktat__groups">
            <div className="dai-ca-diktat__group">
              <span className="dai-ca-diktat__group-label">Ton</span>
              <div className="dai-ca-refine">
                {DIKTAT_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    className={`dai-ca-refine__btn${diktatTone === tone.id ? ' is-active' : ''}`}
                    onClick={() => setDiktatTone(tone.id)}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="dai-ca-diktat__group">
              <span className="dai-ca-diktat__group-label">Kanal</span>
              <div className="dai-ca-refine">
                {DIKTAT_CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`dai-ca-refine__btn${diktatChannel === ch.id ? ' is-active' : ''}`}
                    onClick={() => setDiktatChannel(ch.id)}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {diktatRecording === 'recording' && (
            <p className="dai-ca-diktat__status dai-ca-diktat__status--live" role="status">
              Ich höre zu … {formatDiktatDuration(diktatSeconds)}
            </p>
          )}
          {diktatRecording === 'processing' && (
            <p className="dai-ca-diktat__status" role="status">Text wird vorbereitet …</p>
          )}

          <div className="dai-ca-diktat__mic-wrap">
            <button
              type="button"
              className={`dai-ca-diktat__mic${diktatRecording === 'recording' ? ' is-recording' : ''}`}
              onClick={diktatRecording === 'recording' ? stopDiktatRecording : startDiktatRecording}
              aria-label={diktatRecording === 'recording' ? 'Aufnahme stoppen' : 'Aufnahme starten'}
              disabled={diktatRecording === 'processing'}
            >
              {diktatRecording === 'recording' ? '■' : '🎙'}
            </button>
            <p className="dai-ca-diktat__mic-label">
              {diktatRecording === 'recording' ? 'Aufnahme stoppen' : 'Aufnahme starten'}
            </p>
            {diktatRecording === 'recording' && (
              <p className="dai-ca-diktat__timer">{formatDiktatDuration(diktatSeconds)}</p>
            )}
          </div>

          {!speechAvailable && (
            <p className="dai-ca-hint">
              Spracherkennung im Browser nicht verfügbar – bitte kurz eintippen, was Sie sagen möchten.
            </p>
          )}

          <label className="dai-ca-editor__label" htmlFor="dai-ca-diktat-input">
            {speechAvailable ? 'Diktat (optional bearbeiten)' : 'Diktat eingeben'}
          </label>
          <textarea
            id="dai-ca-diktat-input"
            className="dai-ca-editor__field dai-ca-editor__field--diktat"
            value={liveTranscript}
            onChange={(e) => {
              diktatTextRef.current = e.target.value;
              setDiktatTranscript(e.target.value);
            }}
            placeholder="z. B. Frag ihn, ob Leasing oder Kauf und ob 10.000 km reichen."
            rows={4}
            disabled={diktatRecording === 'recording'}
          />

          <div className="dai-ca-actions" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button
              type="button"
              className="dai-ca-actions__btn"
              onClick={discardDiktat}
              disabled={diktatRecording === 'processing'}
            >
              Verwerfen
            </button>
            <button
              type="button"
              className="dai-ca-actions__btn dai-ca-actions__btn--primary"
              onClick={generateFromDiktat}
              disabled={diktatRecording === 'recording' || diktatRecording === 'processing'}
            >
              Text erzeugen
            </button>
          </div>
        </div>
      )}

      {phase === 'edit' && (
        <>
          <button
            type="button"
            className="dai-ca-back"
            onClick={() => (typeId === DIKTAT_TYPE_ID ? setPhase('diktat') : setPhase('pick'))}
          >
            {typeId === DIKTAT_TYPE_ID ? '← Zurück zum Diktat' : '← Anderen Texttyp wählen'}
          </button>

          <TextPreviewEditor
            label={previewLabel}
            draft={draft}
            onDraftChange={setDraft}
            phone={phone}
            email={email}
            context={context}
            onSaveNote={handleSaveNote}
            onRefine={handleRefine}
            onTrackChannel={trackChannel}
            showToast={showToast}
            onAddHistory={onAddHistory}
            historyCopied={historyCopied}
          />
        </>
      )}

      {toast && <p className="dai-ca-toast" role="status">{toast}</p>}
    </div>
  );
}
