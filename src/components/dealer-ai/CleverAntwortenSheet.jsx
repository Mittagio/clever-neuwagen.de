import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCleverAnswerContext } from '../../services/cleverAnswerContextBuilder.js';
import {
  ANSWER_INTENT_GROUPS,
  getIntentsForGroup,
  resolveAnswerIntent,
} from '../../services/cleverAnswerIntentCatalog.js';
import {
  buildRecommendedIntentCards,
  suggestAnswerIntents,
} from '../../services/cleverAnswerSuggestionService.js';
import {
  CLEVER_ANSWER_CHANNELS,
  buildCleverAnswerEmailSubject,
  generateCleverAnswerDraft,
  getCleverAnswerTypeLabel,
  refineCleverAnswerDraft,
} from '../../services/cleverAnswerDraftService.js';
import {
  buildRefineHintOptions,
  buildSelectableContextHints,
} from '../../services/selectableContextHints.js';
import { CLEVER_ANTWORTEN_HISTORY } from '../../services/cleverAntworten.js';
import {
  createDiktatSpeechRecognizer,
  formatDiktatDuration,
  supportsBrowserSpeechRecognition,
} from '../../services/cleverDiktat.js';
import { buildOfferMailtoHref, buildOfferWhatsappHref, buildSmsHref } from '../../services/vehicleOffer.js';
import './CleverAntwortenSheet.css';

const PRIMARY_TONES = [
  { id: 'kurz', label: 'Kurz' },
  { id: 'freundlich', label: 'Freundlich' },
  { id: 'verbindlich', label: 'Verbindlich' },
  { id: 'locker', label: 'Locker' },
  { id: 'professionell', label: 'Professionell' },
];

const EXTRA_TONES = [
  { id: 'nachfassen', label: 'Nachfassen' },
  { id: 'abschluss', label: 'Abschlussorientiert' },
];

const PRIMARY_REFINE = [
  { id: 'kuerzer', label: 'Kürzer' },
  { id: 'freundlicher', label: 'Freundlicher' },
  { id: 'verbindlicher', label: 'Verbindlicher' },
];

function countContextInfos(display) {
  if (!display?.groups?.length) return 0;
  const visible = display.groups.reduce((sum, group) => sum + group.items.length, 0);
  return visible + (display.hiddenCount ?? 0);
}

function shortenInlineItem(item = '') {
  return item
    .replace(/^Kia\s+/i, '')
    .replace(/-Auswahl mit \d+ Varianten/i, '-Auswahl')
    .replace(/(\d+) Monate · (\d[\d.]*)\s*km\/Jahr/i, (_, months, km) => {
      const kmShort = km.replace(/\./g, '').slice(0, 2);
      return `${months}/${kmShort.slice(0, 2)}k`;
    })
    .replace(/ · Budget offen/gi, '')
    .replace(/ · \d[\d.]* € Anzahlung/gi, '')
    .replace(/^Kunde: /i, '')
    .replace(/^(\d+) Unterlagen offen/i, '$1 Unterlagen')
    .replace(/Liefertermin Egal · /gi, '');
}

function buildInlineSummary(display) {
  if (!display?.groups?.length) return '';
  const parts = [];
  for (const group of display.groups) {
    for (const item of group.items) {
      const short = shortenInlineItem(item);
      if (short && !parts.includes(short)) parts.push(short);
    }
  }
  return parts.slice(0, 5).join(' · ');
}

function CompactContextPreview({ display }) {
  const [expanded, setExpanded] = useState(false);
  if (!display?.groups?.length) return null;

  const infoCount = countContextInfos(display);
  const inlineSummary = buildInlineSummary(display);

  return (
    <div className="dai-ca-context-compact" aria-label="Clever nutzt Infos aus der Kundenakte">
      <div className="dai-ca-context-compact__head">
        <p className="dai-ca-context-compact__title">
          Clever nutzt {infoCount} Info{infoCount === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          className="dai-ca-context-compact__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? 'Details ausblenden' : 'Details anzeigen'}
        </button>
      </div>
      {!expanded && inlineSummary && (
        <p className="dai-ca-context-compact__inline">{inlineSummary}</p>
      )}
      {expanded && (
        <div className="dai-ca-context-compact__details">
          {display.groups.map((group) => (
            <div key={group.id} className="dai-ca-context-compact__group">
              <p className="dai-ca-context-compact__group-label">{group.label}:</p>
              <ul className="dai-ca-context-compact__list">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendedCards({ cards = [], intentId, onSelect }) {
  if (!cards.length) return null;

  return (
    <section className="dai-ca-recommend" aria-label="Clever empfiehlt">
      <p className="dai-ca-recommend__title">Clever empfiehlt</p>
      <div className="dai-ca-recommend__grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`dai-ca-magic-card${intentId === card.id ? ' is-active' : ''}${card.magic ? ' is-magic' : ''}`}
            onClick={() => onSelect(card.id)}
          >
            <span className="dai-ca-magic-card__label">{card.label}</span>
            {intentId === card.id && (
              <span className="dai-ca-magic-card__tick" aria-hidden>✓</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function IntentPicker({
  intentId,
  activeGroup,
  showAll,
  onGroupChange,
  onIntentSelect,
  onToggleAll,
}) {
  const visibleGroups = showAll
    ? ANSWER_INTENT_GROUPS
    : ANSWER_INTENT_GROUPS.filter((group) => group.id === activeGroup);

  return (
    <section className="dai-ca-intents" aria-label="Was möchten Sie schreiben?">
      <div className="dai-ca-intents__head">
        <p className="dai-ca-intents__title">Was möchten Sie schreiben?</p>
        <button type="button" className="dai-ca-intents__toggle" onClick={onToggleAll}>
          {showAll ? 'Weniger anzeigen' : 'Alle Texte anzeigen'}
        </button>
      </div>

      {!showAll && (
        <div className="dai-ca-intents__tabs" role="tablist" aria-label="Textgruppen">
          {ANSWER_INTENT_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeGroup === group.id}
              className={`dai-ca-intents__tab${activeGroup === group.id ? ' is-active' : ''}`}
              onClick={() => onGroupChange(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      {visibleGroups.map((group) => (
        <div key={group.id} className="dai-ca-intents__group">
          {showAll && <p className="dai-ca-intents__group-label">{group.label}</p>}
          <div className="dai-ca-intents__chips">
            {getIntentsForGroup(group.id).map((intent) => (
              <button
                key={intent.id}
                type="button"
                className={`dai-ca-intent-chip${intentId === intent.id ? ' is-active' : ''}`}
                onClick={() => onIntentSelect(intent.id)}
              >
                {intent.shortLabel ?? intent.label}
                {intentId === intent.id && <span className="dai-ca-intent-chip__tick" aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function HintToggles({ hints = [], selected = [], onToggle, compact = false }) {
  if (!hints.length) return null;

  return (
    <section className={`dai-ca-hints${compact ? ' dai-ca-hints--compact' : ''}`} aria-label="Optionen">
      <p className="dai-ca-hints__title">{compact ? 'Optionen' : 'Was soll Clever einbauen?'}</p>
      <div className="dai-ca-hints__grid">
        {hints.map((hint) => {
          const active = selected.includes(hint.id);
          return (
            <button
              key={hint.id}
              type="button"
              className={`dai-ca-hint-chip${active ? ' is-active' : ''}`}
              onClick={() => onToggle(hint.id)}
              aria-pressed={active}
            >
              {hint.label.replace(' erwähnen', '').replace(' vorsichtig erwähnen', '')}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EmbeddedBadges({ hints = [], selected = [] }) {
  const active = hints.filter((hint) => selected.includes(hint.id));
  if (!active.length) return null;

  return (
    <div className="dai-ca-embedded" aria-label="Eingebaut">
      <span className="dai-ca-embedded__label">Eingebaut:</span>
      <div className="dai-ca-embedded__chips">
        {active.map((hint) => (
          <span key={hint.id} className="dai-ca-embedded__chip">
            {hint.label.replace(' erwähnen', '').replace(' vorsichtig erwähnen', '')}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompactSettings({ tone, channel, showFineTune, onToneChange, onChannelChange, onToggleFineTune }) {
  return (
    <section className="dai-ca-settings">
      <div className="dai-ca-settings__row">
        <span className="dai-ca-settings__label">Kanal wählen</span>
        <div className="dai-ca-settings__chips">
          {CLEVER_ANSWER_CHANNELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`dai-ca-settings__chip${channel === entry.id ? ' is-active' : ''}`}
              onClick={() => onChannelChange(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dai-ca-settings__row">
        <span className="dai-ca-settings__label">Ton</span>
        <div className="dai-ca-settings__chips">
          {PRIMARY_TONES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`dai-ca-settings__chip${tone === entry.id ? ' is-active' : ''}`}
              onClick={() => onToneChange(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="dai-ca-settings__fine" onClick={onToggleFineTune}>
        {showFineTune ? 'Mehr Optionen ausblenden' : 'Mehr Optionen'}
      </button>

      {showFineTune && (
        <div className="dai-ca-settings__chips dai-ca-settings__chips--extra">
          {EXTRA_TONES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`dai-ca-settings__chip${tone === entry.id ? ' is-active' : ''}`}
              onClick={() => onToneChange(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function resolveInitialChannel(phone = '', email = '') {
  if (phone?.trim()) return 'whatsapp';
  if (email?.trim()) return 'email';
  return 'whatsapp';
}

function resolveToneLabel(toneId) {
  return [...PRIMARY_TONES, ...EXTRA_TONES].find((entry) => entry.id === toneId)?.label ?? toneId;
}

function resolveChannelLabel(channelId) {
  return CLEVER_ANSWER_CHANNELS.find((entry) => entry.id === channelId)?.label ?? channelId;
}

function ResultEditor({
  draft,
  onDraftChange,
  phone,
  email,
  context,
  intentId,
  tone,
  channel,
  selectedHints,
  selectableHints,
  refineOptions,
  onSaveNote,
  onRegenerate,
  onRefine,
  onTrackChannel,
  showToast,
  onAddHistory,
  onInboxItemHandled,
}) {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showMoreRefine, setShowMoreRefine] = useState(false);

  const whatsappHref = useMemo(() => {
    if (!phone?.trim() || !draft.trim()) return null;
    return buildOfferWhatsappHref(phone, draft);
  }, [phone, draft]);

  const mailtoHref = useMemo(() => {
    if (!email?.trim() || !draft.trim()) return null;
    return buildOfferMailtoHref(
      email,
      buildCleverAnswerEmailSubject(context, intentId),
      draft,
    );
  }, [email, draft, context, intentId]);

  const smsHref = useMemo(() => {
    if (!phone?.trim() || !draft.trim()) return null;
    return buildSmsHref(phone, draft);
  }, [phone, draft]);

  const metaLine = [
    resolveChannelLabel(channel),
    resolveToneLabel(tone),
    getCleverAnswerTypeLabel(intentId),
  ].join(' · ');

  const extraRefine = [
    { id: 'lockerer', label: 'Lockerer' },
    { id: 'mehr_beratung', label: 'Mehr Beratung' },
    { id: 'preis_hervorheben', label: 'Preis hervorheben' },
    ...refineOptions,
  ];

  async function handleCopy() {
    if (!draft.trim()) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draft);
      }
      showToast('Text kopiert');
      onAddHistory?.(`${CLEVER_ANTWORTEN_HISTORY.copied}: ${getCleverAnswerTypeLabel(intentId)}`, 'note');
      onInboxItemHandled?.();
    } catch {
      showToast('Kopieren nicht möglich');
    }
  }

  function renderChannelAction() {
    if (channel === 'whatsapp') {
      if (whatsappHref) {
        return (
          <a
            href={whatsappHref}
            className="dai-ca-result__link"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onTrackChannel('whatsapp')}
          >
            Als WhatsApp öffnen
          </a>
        );
      }
      return (
        <span className="dai-ca-result__link dai-ca-result__link--disabled" title="Telefonnummer fehlt">
          Telefonnummer fehlt
        </span>
      );
    }

    if (channel === 'email') {
      if (mailtoHref) {
        return (
          <a href={mailtoHref} className="dai-ca-result__link" onClick={() => onTrackChannel('email')}>
            Als E-Mail öffnen
          </a>
        );
      }
      return (
        <span className="dai-ca-result__link dai-ca-result__link--disabled" title="E-Mail fehlt">
          E-Mail fehlt
        </span>
      );
    }

    if (smsHref) {
      return (
        <a href={smsHref} className="dai-ca-result__link" onClick={() => onTrackChannel('sms')}>
          Als SMS öffnen
        </a>
      );
    }
    return (
      <span className="dai-ca-result__link dai-ca-result__link--disabled" title="Telefonnummer fehlt">
        Telefonnummer fehlt
      </span>
    );
  }

  return (
    <div className="dai-ca-result">
      <div className="dai-ca-result__head">
        <p className="dai-ca-result__title">Clever Textvorschlag</p>
        <p className="dai-ca-result__meta">{metaLine}</p>
      </div>

      <EmbeddedBadges hints={selectableHints} selected={selectedHints} />

      <div className="dai-ca-result__paper">
        <textarea
          id="dai-ca-draft"
          className="dai-ca-result__field"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={6}
          aria-label="Clever Textvorschlag bearbeiten"
        />
      </div>

      <div className="dai-ca-result__actions">
        <button type="button" className="dai-ca-generate dai-ca-generate--copy" onClick={handleCopy}>
          Kopieren
        </button>

        <div className="dai-ca-result__secondary">
          {renderChannelAction()}
        </div>

        <button
          type="button"
          className="dai-ca-result__more-toggle"
          onClick={() => setShowMoreActions((value) => !value)}
          aria-expanded={showMoreActions}
        >
          {showMoreActions ? 'Weniger' : 'Mehr'}
        </button>

        {showMoreActions && (
          <div className="dai-ca-result__more">
            <button type="button" className="dai-ca-result__more-link" onClick={onSaveNote}>
              In Aktivitäten speichern
            </button>
            <button type="button" className="dai-ca-result__more-link" onClick={onRegenerate}>
              Neu erzeugen
            </button>
          </div>
        )}
      </div>

      <div className="dai-ca-refine-block">
        <div className="dai-ca-refine-block__head">
          <span className="dai-ca-refine-block__label">Text verbessern</span>
          <button
            type="button"
            className="dai-ca-refine-block__more"
            onClick={() => setShowMoreRefine((value) => !value)}
            aria-expanded={showMoreRefine}
          >
            {showMoreRefine ? 'Weniger' : '+ Mehr'}
          </button>
        </div>
        <div className="dai-ca-refine dai-ca-refine--primary">
          {PRIMARY_REFINE.map((option) => (
            <button
              key={option.id}
              type="button"
              className="dai-ca-refine__btn"
              onClick={() => onRefine(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {showMoreRefine && (
          <div className="dai-ca-refine dai-ca-refine--extra">
            {extraRefine.map((option) => (
              <button
                key={option.id}
                type="button"
                className="dai-ca-refine__btn dai-ca-refine__btn--accent"
                onClick={() => onRefine(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CleverAntwortenSheet({
  lead = null,
  customerName = '',
  phone = '',
  email = '',
  vehicleCards = [],
  offerSelectionGroups = [],
  kundenhelferNotes = '',
  sellerName = '',
  dealerName = '',
  wishPaymentType = 'unknown',
  initialTypeId = null,
  inboxItemId = null,
  onInboxItemHandled = null,
  embedded = false,
  onAddHistory,
}) {
  const mappedInitialIntent = resolveAnswerIntent(initialTypeId);
  const initialChannel = resolveInitialChannel(phone, email);

  const context = useMemo(() => buildCleverAnswerContext({
    lead,
    customerName,
    phone,
    email,
    vehicleCards,
    offerSelectionGroups,
    kundenhelferNotes,
    sellerName,
    dealerName,
    wishPaymentType,
  }), [
    lead,
    customerName,
    phone,
    email,
    vehicleCards,
    offerSelectionGroups,
    kundenhelferNotes,
    sellerName,
    dealerName,
    wishPaymentType,
  ]);

  const suggestions = useMemo(() => suggestAnswerIntents(context), [context]);
  const recommendedCards = useMemo(
    () => buildRecommendedIntentCards(context, suggestions.recommended),
    [context, suggestions.recommended],
  );
  const selectableHints = useMemo(() => buildSelectableContextHints(context), [context]);
  const refineOptions = useMemo(() => buildRefineHintOptions(context), [context]);
  const speechAvailable = useMemo(() => supportsBrowserSpeechRecognition(), []);

  const [phase, setPhase] = useState(mappedInitialIntent ? 'result' : 'compose');
  const [intentId, setIntentId] = useState(mappedInitialIntent ?? suggestions.defaultIntent);
  const [activeGroup, setActiveGroup] = useState('angebot');
  const [showAllIntents, setShowAllIntents] = useState(false);
  const [selectedHints, setSelectedHints] = useState([]);
  const [tone, setTone] = useState('freundlich');
  const [channel, setChannel] = useState(initialChannel);
  const [showFineTune, setShowFineTune] = useState(false);
  const [dictation, setDictation] = useState('');
  const [draft, setDraft] = useState(() => (
    mappedInitialIntent
      ? generateCleverAnswerDraft({
        intentId: mappedInitialIntent,
        context,
        tone: 'freundlich',
        channel: initialChannel,
      })
      : ''
  ));
  const [toast, setToast] = useState('');
  const [diktatRecording, setDiktatRecording] = useState('idle');
  const [diktatSeconds, setDiktatSeconds] = useState(0);

  const recognizerRef = useRef(null);
  const timerRef = useRef(null);
  const dictationRef = useRef('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    recognizerRef.current?.abort?.();
  }, []);

  const generateDraft = useCallback((
    nextIntent = intentId,
    nextTone = tone,
    nextChannel = channel,
    nextDictation = dictation,
    nextHints = selectedHints,
  ) => {
    const text = generateCleverAnswerDraft({
      intentId: nextIntent,
      context,
      tone: nextTone,
      channel: nextChannel,
      dictation: nextDictation,
      selectedHints: nextHints,
    });
    setDraft(text);
    setPhase('result');
    onAddHistory?.(
      `${CLEVER_ANTWORTEN_HISTORY.created}: ${getCleverAnswerTypeLabel(nextIntent)}`,
      'note',
    );
  }, [intentId, tone, channel, dictation, selectedHints, context, onAddHistory]);

  function toggleHint(hintId) {
    setSelectedHints((prev) => (
      prev.includes(hintId) ? prev.filter((id) => id !== hintId) : [...prev, hintId]
    ));
  }

  function startDictation() {
    setDiktatRecording('recording');
    setDiktatSeconds(0);
    dictationRef.current = dictation;

    timerRef.current = setInterval(() => {
      setDiktatSeconds((seconds) => seconds + 1);
    }, 1000);

    if (!speechAvailable) return;

    const rec = createDiktatSpeechRecognizer({
      onInterim: (text) => {
        dictationRef.current = text;
        setDictation(text);
      },
      onFinal: (text) => {
        dictationRef.current = text;
        setDictation(text);
      },
      onError: () => showToast('Spracheingabe unterbrochen'),
    });
    recognizerRef.current = rec;
    try {
      rec?.start();
    } catch {
      showToast('Spracheingabe nicht gestartet');
    }
  }

  function stopDictation() {
    clearInterval(timerRef.current);
    recognizerRef.current?.stop?.();
    setDiktatRecording('idle');
    const spoken = (dictationRef.current || dictation).trim();
    if (spoken) setDictation(spoken);
  }

  function handleRefine(variant) {
    const next = refineCleverAnswerDraft(draft, variant, context, {
      intentId,
      tone,
      channel,
      dictation,
      selectedHints,
    });
    setDraft(next);
  }

  function handleSaveNote() {
    if (!draft.trim()) return;
    onAddHistory?.(`${CLEVER_ANTWORTEN_HISTORY.note_saved}\n\n${draft.trim()}`, 'note');
    showToast('In Aktivitäten gespeichert');
    if (inboxItemId) onInboxItemHandled?.(inboxItemId);
  }

  function handleInboxHandledFromResult() {
    if (inboxItemId) onInboxItemHandled?.(inboxItemId);
  }

  function trackChannel(channelId) {
    const label = getCleverAnswerTypeLabel(intentId);
    if (channelId === 'whatsapp') {
      onAddHistory?.(`${CLEVER_ANTWORTEN_HISTORY.whatsapp}: ${label}`, 'note');
    } else if (channelId === 'email') {
      onAddHistory?.(`${CLEVER_ANTWORTEN_HISTORY.email}: ${label}`, 'note');
    } else if (channelId === 'sms') {
      onAddHistory?.(`SMS vorbereitet: ${label}`, 'note');
    }
  }

  return (
    <div className={`dai-ca-sheet${embedded ? ' dai-ca-sheet--embedded' : ''}${phase === 'result' ? ' dai-ca-sheet--result' : ''}`}>
      {phase === 'compose' && (
        <>
          <header className="dai-ca-sheet-intro">
            <p className="dai-ca-sheet-intro__sub">
              Clever erstellt Nachrichten aus Kundenakte, Angeboten und offenen Fragen.
            </p>
          </header>

          <CompactContextPreview display={context.contextDisplay} />

          <RecommendedCards
            cards={recommendedCards}
            intentId={intentId}
            onSelect={setIntentId}
          />

          <IntentPicker
            intentId={intentId}
            activeGroup={activeGroup}
            showAll={showAllIntents}
            onGroupChange={setActiveGroup}
            onIntentSelect={setIntentId}
            onToggleAll={() => setShowAllIntents((value) => !value)}
          />

          <HintToggles hints={selectableHints} selected={selectedHints} onToggle={toggleHint} compact />

          <CompactSettings
            tone={tone}
            channel={channel}
            showFineTune={showFineTune}
            onToneChange={setTone}
            onChannelChange={setChannel}
            onToggleFineTune={() => setShowFineTune((value) => !value)}
          />

          <div className="dai-ca-diktat-optional">
            <div className="dai-ca-diktat-optional__head">
              <label className="dai-ca-editor__label" htmlFor="dai-ca-diktat-optional">
                Zusatzwunsch an Clever
              </label>
              <button
                type="button"
                className={`dai-ca-diktat-optional__mic${diktatRecording === 'recording' ? ' is-recording' : ''}`}
                onClick={diktatRecording === 'recording' ? stopDictation : startDictation}
                aria-label={diktatRecording === 'recording' ? 'Diktat stoppen' : 'Diktat starten'}
              >
                {diktatRecording === 'recording' ? '■' : '🎙'}
              </button>
            </div>
            {diktatRecording === 'recording' && (
              <p className="dai-ca-diktat__status dai-ca-diktat__status--live" role="status">
                Ich höre zu … {formatDiktatDuration(diktatSeconds)}
              </p>
            )}
            <textarea
              id="dai-ca-diktat-optional"
              className="dai-ca-editor__field dai-ca-editor__field--diktat"
              value={dictation}
              onChange={(e) => {
                dictationRef.current = e.target.value;
                setDictation(e.target.value);
              }}
              placeholder="z. B. kurz halten, Winterreifen erwähnen …"
              rows={2}
              disabled={diktatRecording === 'recording'}
            />
          </div>

          <button
            type="button"
            className="dai-ca-generate"
            onClick={() => generateDraft(intentId, tone, channel, dictation, selectedHints)}
          >
            Text erzeugen
          </button>
        </>
      )}

      {phase === 'result' && (
        <>
          <button type="button" className="dai-ca-back" onClick={() => setPhase('compose')}>
            ← Zurück
          </button>

          <CompactContextPreview display={context.contextDisplay} />

          <ResultEditor
            draft={draft}
            onDraftChange={setDraft}
            phone={phone}
            email={email}
            context={context}
            intentId={intentId}
            tone={tone}
            channel={channel}
            selectedHints={selectedHints}
            selectableHints={selectableHints}
            refineOptions={refineOptions}
            onSaveNote={handleSaveNote}
            onRegenerate={() => generateDraft(intentId, tone, channel, dictation, selectedHints)}
            onRefine={handleRefine}
            onTrackChannel={trackChannel}
            showToast={showToast}
            onAddHistory={onAddHistory}
            onInboxItemHandled={handleInboxHandledFromResult}
          />
        </>
      )}

      {toast && <p className="dai-ca-toast" role="status">{toast}</p>}
    </div>
  );
}
