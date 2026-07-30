import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceChatItem } from './WorkspaceChatCards.jsx';
import {
  WORKSPACE_FEED_FILTERS,
  countWorkspaceFeedFilters,
  filterWorkspaceFeedItems,
} from '../../services/crm/workspaceFeedFilter.js';
import { IconChevronDown, IconSendUp, IconSparkle } from '../dealer-ai/AkteIcons.jsx';
import './SharedWorkspaceChat.css';

/**
 * Gemeinsamer Clever-Arbeitsraum – Chat als Vorgang (Kunde & Verkäufer).
 * Composer wie Cursor: Karte mit Textarea + Toolbar (+ · Ton ▼ · Mic · Senden).
 */
export default function SharedWorkspaceChat({
  role = 'customer',
  items = [],
  draft = '',
  onDraftChange,
  onSend,
  sending = false,
  sendFeedback = '',
  placeholder = '',
  composerLabel = '',
  sendAriaLabel = 'Senden',
  /** customer_message_edit: größere Textarea + Edit-Aktionen */
  composerEditMode = false,
  onCancelEdit = null,
  onImproveWithClever = null,
  outboundTones = null,
  outboundTone = 'freundlich',
  onOutboundToneChange = null,
  magicBusy = false,
  magicUiHint = null,
  onMagicWriteWithoutDetails = null,
  onMagicReviewData = null,
  onRestoreMagicSeed = null,
  onOpenOffer,
  onUploadDocument,
  onStartSelfDisclosure,
  onConfirmAppointment = null,
  onChangeAppointment = null,
  onCleverAction = null,
  onPlusAction,
  plusSheetOpen = false,
  plusActions = [],
  onClosePlus,
  onAttachFile = null,
  micSlot = null,
  reviewSlot = null,
  feedTopSlot = null,
  /** Ersetzt den Feed (z. B. geöffnetes Angebot) – Composer bleibt sichtbar */
  workspaceSlot = null,
  /** Cursor-artige Anhänge über dem Composer */
  contextPills = [],
  onRemoveContextPill = null,
  suggestionChips = [],
  moreSuggestionChips = [],
  onSuggestionChip = null,
  /** Nach Suche: Message im Feed anspringen */
  scrollToMessageId = null,
  scrollToMessageToken = 0,
  emptyHint = 'Noch kein Verlauf.\nSchreiben oder sprechen Sie einfach los.',
}) {
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const focusingMessageRef = useRef(false);
  const highlightIdRef = useRef(null);
  const highlightClearRef = useRef(null);
  const highlightGenRef = useRef(0);
  const [localPlus, setLocalPlus] = useState(false);
  const [moreChipsOpen, setMoreChipsOpen] = useState(false);
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [feedFilter, setFeedFilter] = useState('all');
  const [highlightEpoch, setHighlightEpoch] = useState(0);
  const showPlus = plusSheetOpen || localPlus;

  const count = items.length;
  useEffect(() => {
    if (!count) return;
    // Während Such-Fokus kein End-Scroll (Desktop-Split / Filterwechsel)
    if (focusingMessageRef.current) return;
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [count, sendFeedback, feedFilter]);

  useLayoutEffect(() => {
    if (!scrollToMessageId || !scrollToMessageToken) return undefined;
    focusingMessageRef.current = true;
    if (feedFilter !== 'all') setFeedFilter('all');

    const gen = highlightGenRef.current + 1;
    highlightGenRef.current = gen;
    highlightIdRef.current = scrollToMessageId;
    setHighlightEpoch((n) => n + 1);

    let cancelled = false;
    const isFeedVisible = (el) => {
      const main = el.closest('.sw-chat__feed-main');
      if (!main) return true;
      const style = window.getComputedStyle(main);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };

    const applyHighlightClass = () => {
      if (highlightGenRef.current !== gen) return false;
      const el = document.getElementById(`sw-msg-${scrollToMessageId}`);
      if (!el) return false;
      el.classList.remove('is-highlighted');
      void el.offsetWidth;
      el.classList.add('is-highlighted');
      return true;
    };

    const tryScroll = () => {
      if (cancelled || highlightGenRef.current !== gen) return true;
      const el = document.getElementById(`sw-msg-${scrollToMessageId}`);
      if (!el || !isFeedVisible(el)) return false;
      applyHighlightClass();
      const scroller = el.closest('.sw-chat__feed-main');
      if (scroller) {
        const elRect = el.getBoundingClientRect();
        const scRect = scroller.getBoundingClientRect();
        const offset = (elRect.top - scRect.top) - (scRect.height / 2) + (elRect.height / 2);
        scroller.scrollBy({ top: offset, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    };

    const timers = [];
    const rafIds = [];
    const schedule = (fn) => {
      rafIds.push(window.requestAnimationFrame(fn));
    };

    schedule(() => {
      if (tryScroll()) return;
      schedule(() => {
        if (tryScroll()) return;
        [32, 96, 200].forEach((ms) => {
          timers.push(window.setTimeout(tryScroll, ms));
        });
      });
    });

    if (highlightClearRef.current) {
      window.clearTimeout(highlightClearRef.current);
    }
    highlightClearRef.current = window.setTimeout(() => {
      if (highlightGenRef.current !== gen) return;
      if (highlightIdRef.current === scrollToMessageId) {
        highlightIdRef.current = null;
        focusingMessageRef.current = false;
        document.getElementById(`sw-msg-${scrollToMessageId}`)
          ?.classList.remove('is-highlighted');
        setHighlightEpoch((n) => n + 1);
      }
    }, 2300);

    return () => {
      cancelled = true;
      rafIds.forEach((id) => window.cancelAnimationFrame(id));
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [scrollToMessageId, scrollToMessageToken]);

  // Highlight-Klasse nach Re-Renders wieder ansetzen (React überschreibt className)
  useLayoutEffect(() => {
    const id = highlightIdRef.current;
    if (!id) return;
    const el = document.getElementById(`sw-msg-${id}`);
    if (el && !el.classList.contains('is-highlighted')) {
      el.classList.add('is-highlighted');
    }
  }, [highlightEpoch, items, feedFilter, workspaceSlot]);

  const resolvedPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    return role === 'seller'
      ? 'Alles reinwerfen – tippen, sprechen oder PDF …'
      : 'Nachricht an Ihr Autohaus …';
  }, [placeholder, role]);

  const showFeedFilters = role === 'seller' && Array.isArray(items) && items.length > 0;
  const filterCounts = useMemo(() => countWorkspaceFeedFilters(items), [items]);
  const visibleItems = useMemo(
    () => (showFeedFilters ? filterWorkspaceFeedItems(items, feedFilter) : items),
    [items, feedFilter, showFeedFilters],
  );
  const emptyFilterHint = showFeedFilters && feedFilter !== 'all' && visibleItems.length === 0
    ? 'Keine Einträge in diesem Filter.'
    : emptyHint;

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    onSend?.(draft.trim());
  }

  function openPlus() {
    if (onPlusAction) {
      onPlusAction('open');
      return;
    }
    setLocalPlus(true);
  }

  function closePlus() {
    onClosePlus?.();
    setLocalPlus(false);
  }

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file || !onAttachFile) return;
    onAttachFile(file);
  }

  const resolvedPlusActions = useMemo(() => {
    const list = [...(plusActions ?? [])];
    if (onAttachFile && !list.some((a) => a.id === 'pdf_dump')) {
      list.unshift({
        id: 'pdf_dump',
        icon: '📥',
        label: 'PDF reinwerfen',
        onClick: () => fileInputRef.current?.click(),
      });
    }
    return list;
  }, [plusActions, onAttachFile]);

  const showSuggestionChips = role === 'seller'
    && !composerEditMode
    && Array.isArray(suggestionChips)
    && suggestionChips.length > 0
    && typeof onSuggestionChip === 'function';
  const hasMoreChips = Array.isArray(moreSuggestionChips) && moreSuggestionChips.length > 0;
  const showContextPills = Array.isArray(contextPills) && contextPills.length > 0;
  const showToneMenu = Array.isArray(outboundTones) && outboundTones.length > 0
    && typeof onOutboundToneChange === 'function';
  const activeToneLabel = outboundTones?.find((t) => t.id === outboundTone)?.label
    || 'Ton';

  useEffect(() => {
    if (!toneMenuOpen) return undefined;
    const onDoc = (event) => {
      if (event.target?.closest?.('.sw-composer__tone-dd')) return;
      setToneMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [toneMenuOpen]);

  const feedMain = (
    <>
      {feedTopSlot ? (
        <div className="sw-chat__feed-top">{feedTopSlot}</div>
      ) : null}
      {showFeedFilters ? (
        <div className="sw-feed-filters" role="tablist" aria-label="Verlauf filtern">
          {WORKSPACE_FEED_FILTERS.map((filter) => {
            const active = feedFilter === filter.id;
            const n = filterCounts[filter.id] ?? 0;
            const disabled = filter.id !== 'all' && n === 0;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`sw-feed-filters__btn${active ? ' is-active' : ''}`}
                disabled={disabled}
                onClick={() => setFeedFilter(filter.id)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {!visibleItems.length ? (
        <p className="sw-chat__empty">{emptyFilterHint}</p>
      ) : (
        <ul className="sw-chat__list">
          {visibleItems.map((item) => (
            <li
              key={item.id}
              id={`sw-msg-${item.id}`}
              className={`sw-chat__item${highlightIdRef.current === item.id ? ' is-highlighted' : ''}`}
            >
              <WorkspaceChatItem
                item={item}
                onOpenOffer={onOpenOffer}
                onUploadDocument={onUploadDocument}
                onStartSelfDisclosure={onStartSelfDisclosure}
                onConfirmAppointment={onConfirmAppointment}
                onChangeAppointment={onChangeAppointment}
                onCleverAction={onCleverAction}
              />
            </li>
          ))}
        </ul>
      )}
      <div ref={endRef} aria-hidden="true" />
    </>
  );

  return (
    <section
      className={`sw-chat sw-chat--${role}${dragOver ? ' is-dragover' : ''}${workspaceSlot ? ' has-workspace' : ''}`}
      aria-label="Gemeinsamer Arbeitsraum"
      onDragOver={(event) => {
        if (!onAttachFile) return;
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (!onAttachFile) return;
        event.preventDefault();
        setDragOver(false);
        handleFiles(event.dataTransfer?.files);
      }}
    >
      <div className="sw-chat__feed">
        <div className="sw-chat__feed-main">
          {feedMain}
        </div>
        {workspaceSlot ? (
          <aside className="sw-chat__workspace" aria-label="Angebot Workspace">
            {workspaceSlot}
          </aside>
        ) : null}
      </div>

      <div className="sw-chat__desk">
        {reviewSlot}

        {showContextPills ? (
          <div className="sw-composer__context" role="group" aria-label="Arbeitskontext">
            {contextPills.map((pill) => (
              <div key={pill.id} className="sw-composer__context-pill">
                <span className="sw-composer__context-icon" aria-hidden>📎</span>
                <span className="sw-composer__context-label">
                  {pill.shortLabel || pill.label}
                </span>
                {typeof onRemoveContextPill === 'function' ? (
                  <button
                    type="button"
                    className="sw-composer__context-remove"
                    aria-label={`${pill.label || 'Kontext'} entfernen`}
                    onClick={() => onRemoveContextPill(pill.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {showPlus && resolvedPlusActions.length > 0 ? (
          <div className="sw-plus-sheet" role="dialog" aria-label="Aktionen">
            <div className="sw-plus-sheet__grid">
              {resolvedPlusActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="sw-plus-sheet__btn"
                  onClick={() => {
                    action.onClick?.();
                    closePlus();
                  }}
                >
                  <span className="sw-plus-sheet__icon" aria-hidden>{action.icon || '•'}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="sw-plus-sheet__close" onClick={closePlus}>
              Schließen
            </button>
          </div>
        ) : null}

        <form
          className={`sw-composer${composerEditMode ? ' sw-composer--message-edit' : ''}`}
          onSubmit={handleSubmit}
        >
          {composerLabel ? (
            <label className="sw-composer__label" htmlFor={`sw-composer-${role}`}>
              {composerLabel}
            </label>
          ) : null}

          {showSuggestionChips ? (
            <div className="sw-composer__chips" role="group" aria-label="Schnelle Schritte">
              <div className="sw-composer__chips-scroll">
                {suggestionChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="sw-composer__chip"
                    disabled={sending}
                    onClick={() => {
                      setMoreChipsOpen(false);
                      onSuggestionChip?.(chip);
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              {hasMoreChips ? (
                <div className="sw-composer__chips-more">
                  <button
                    type="button"
                    className={`sw-composer__chip sw-composer__chip--more${moreChipsOpen ? ' is-open' : ''}`}
                    disabled={sending}
                    aria-expanded={moreChipsOpen}
                    aria-label="Weitere Schritte"
                    onClick={() => setMoreChipsOpen((open) => !open)}
                  >
                    +
                  </button>
                  {moreChipsOpen ? (
                    <div className="sw-composer__chips-pop" role="menu" aria-label="Weitere Schritte">
                      {moreSuggestionChips.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          role="menuitem"
                          className="sw-composer__chip sw-composer__chip--pop"
                          disabled={sending}
                          onClick={() => {
                            setMoreChipsOpen(false);
                            onSuggestionChip?.(chip);
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={`sw-composer__card${composerEditMode ? ' sw-composer__card--edit' : ''}`}>
            <textarea
              id={`sw-composer-${role}`}
              className={`sw-composer__input${composerEditMode ? ' sw-composer__input--grow' : ''}`}
              rows={composerEditMode ? 6 : 2}
              value={draft}
              onChange={(e) => onDraftChange?.(e.target.value)}
              placeholder={resolvedPlaceholder}
              disabled={sending}
            />
            <div className="sw-composer__toolbar">
              {!composerEditMode ? (
                <button
                  type="button"
                  className="sw-composer__tool sw-composer__plus"
                  aria-label="Mehr Aktionen"
                  onClick={openPlus}
                >
                  +
                </button>
              ) : (
                <button
                  type="button"
                  className="sw-composer__tool sw-composer__tool--ghost"
                  disabled={sending}
                  onClick={() => onCancelEdit?.()}
                >
                  Abbrechen
                </button>
              )}

              {showToneMenu ? (
                <div className={`sw-composer__tone-dd${toneMenuOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="sw-composer__tone-trigger"
                    disabled={sending}
                    aria-haspopup="listbox"
                    aria-expanded={toneMenuOpen}
                    aria-label="Tonalität wählen"
                    onClick={() => setToneMenuOpen((open) => !open)}
                  >
                    <span>{activeToneLabel}</span>
                    <IconChevronDown />
                  </button>
                  {toneMenuOpen ? (
                    <div className="sw-composer__tone-menu" role="listbox" aria-label="Tonalität">
                      {outboundTones.map((tone) => (
                        <button
                          key={tone.id}
                          type="button"
                          role="option"
                          aria-selected={tone.id === outboundTone}
                          className={`sw-composer__tone-option${tone.id === outboundTone ? ' is-active' : ''}`}
                          onClick={() => {
                            onOutboundToneChange?.(tone.id);
                            setToneMenuOpen(false);
                          }}
                        >
                          {tone.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="sw-composer__toolbar-spacer" />

              {composerEditMode && typeof onImproveWithClever === 'function' ? (
                <button
                  type="button"
                  className="sw-composer__tool sw-composer__tool--magic"
                  disabled={sending || magicBusy || !draft.trim()}
                  onClick={() => onImproveWithClever?.(draft)}
                  aria-label="Magic – Clever schreibt die Nachricht"
                  title="Magic – Clever schreibt die Nachricht"
                >
                  <IconSparkle />
                  <span className="sw-composer__edit-btn-label">{magicBusy ? '…' : 'Magic'}</span>
                </button>
              ) : null}

              {composerEditMode && typeof onRestoreMagicSeed === 'function' ? (
                <button
                  type="button"
                  className="sw-composer__tool sw-composer__tool--ghost"
                  disabled={sending || magicBusy}
                  onClick={() => onRestoreMagicSeed?.()}
                >
                  Original
                </button>
              ) : null}

              {!composerEditMode ? micSlot : null}

              <button
                type="submit"
                className="sw-composer__send"
                disabled={sending || magicBusy || !draft.trim()}
                aria-label={sendAriaLabel || 'Senden'}
                title={sendAriaLabel || 'Senden'}
              >
                <IconSendUp />
              </button>
            </div>
          </div>

          {magicUiHint?.message ? (
            <div className="sw-composer__magic-hint" role="status">
              <p>{magicUiHint.message}</p>
              <div className="sw-composer__magic-hint-actions">
                {typeof onMagicWriteWithoutDetails === 'function' ? (
                  <button
                    type="button"
                    className="sw-composer__tool sw-composer__tool--ghost"
                    disabled={sending || magicBusy}
                    onClick={() => onMagicWriteWithoutDetails?.()}
                  >
                    Ohne Paketdetails schreiben
                  </button>
                ) : null}
                {typeof onMagicReviewData === 'function' ? (
                  <button
                    type="button"
                    className="sw-composer__tool sw-composer__tool--ghost"
                    disabled={sending || magicBusy}
                    onClick={() => onMagicReviewData?.()}
                    title="Daten in Clever prüfen"
                  >
                    Daten prüfen
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {sendFeedback ? (
            <p className="sw-composer__feedback" role="status">{sendFeedback}</p>
          ) : null}
          {onAttachFile ? (
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="sw-composer__file"
              aria-hidden
              tabIndex={-1}
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
          ) : null}
        </form>
      </div>
    </section>
  );
}
