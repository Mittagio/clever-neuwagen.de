import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  IconChevronRight,
  IconPaperPlane,
  IconSparkle,
} from './AkteIcons.jsx';
import { presentCleverStageHero } from '../../services/crm/presentCleverStageHero.js';
import './CleverEmpfiehltCard.css';

function ActivityItem({ item, onOpen }) {
  if (!item) return null;
  const content = (
    <>
      <span className="clever-empfiehlt__activity-dot" aria-hidden />
      <span className="clever-empfiehlt__activity-body">
        <span className="clever-empfiehlt__activity-title">{item.headline}</span>
        {item.body ? (
          <span className="clever-empfiehlt__activity-sub">{item.body}</span>
        ) : null}
      </span>
      {item.whenLabel || item.time ? (
        <span className="clever-empfiehlt__activity-when">
          {item.whenLabel || item.time}
        </span>
      ) : null}
    </>
  );

  if (typeof onOpen === 'function') {
    return (
      <li>
        <button
          type="button"
          className="clever-empfiehlt__activity"
          onClick={() => onOpen(item)}
          aria-label={item.headline || 'Aktivität öffnen'}
        >
          {content}
        </button>
      </li>
    );
  }

  return <li className="clever-empfiehlt__activity">{content}</li>;
}

function splitRate(snapshot) {
  if (snapshot?.rateValue) {
    return {
      value: snapshot.rateValue,
      unit: snapshot.rateUnit || null,
    };
  }
  const raw = String(snapshot?.rateLabel || '').trim();
  const match = raw.match(/^(.*?)\s*(\/\s*Monat.*)$/i);
  if (match) {
    return { value: match[1].trim(), unit: match[2].replace(/\s+/g, '') };
  }
  return { value: raw || null, unit: null };
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const sync = () => setMatches(Boolean(mq.matches));
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, [query]);
  return matches;
}

/**
 * Hover = Preview (nur Desktop), Klick/Tap = bleibt offen. Keine Hover-only Funktion.
 * Popover ist position:fixed, damit overflow:hidden der Stage es nicht abschneidet.
 */
function StageDisclosure({
  id,
  trigger,
  title,
  children,
  footer = null,
  align = 'start',
  testId = null,
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const fineHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const isNarrow = useMediaQuery('(max-width: 720px)');
  const open = pinned || hovered;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const hoverTimer = useRef(null);

  function openHover() {
    if (!fineHover) return;
    clearTimeout(hoverTimer.current);
    setHovered(true);
  }

  function closeHoverSoon() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(false), 160);
  }

  useLayoutEffect(() => {
    if (!open || isNarrow) {
      setAnchor(null);
      return undefined;
    }
    function updateAnchor() {
      const btn = triggerRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const width = align === 'stretch'
        ? Math.max(220, Math.round(rect.width))
        : 280;
      const centerX = rect.left + (rect.width / 2);
      const left = Math.max(
        12,
        Math.min(Math.round(centerX - width / 2), window.innerWidth - width - 12),
      );
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = align !== 'stretch' || spaceBelow < 220;
      setAnchor({
        position: 'fixed',
        top: openUp ? 'auto' : `${Math.round(rect.bottom + 8)}px`,
        bottom: openUp ? `${Math.round(window.innerHeight - rect.top + 8)}px` : 'auto',
        left: `${Math.round(left)}px`,
        width: `${width}px`,
        zIndex: 40,
      });
    }
    updateAnchor();
    window.addEventListener('scroll', updateAnchor, true);
    window.addEventListener('resize', updateAnchor);
    return () => {
      window.removeEventListener('scroll', updateAnchor, true);
      window.removeEventListener('resize', updateAnchor);
    };
  }, [open, isNarrow, align]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(event) {
      if (!rootRef.current?.contains(event.target)) {
        setPinned(false);
        setHovered(false);
      }
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    }
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className={`clever-empfiehlt__disclosure clever-empfiehlt__disclosure--${align}`}
      ref={rootRef}
      onMouseEnter={openHover}
      onMouseLeave={closeHoverSoon}
    >
      <button
        ref={triggerRef}
        type="button"
        className="clever-empfiehlt__disclosure-trigger"
        aria-expanded={open}
        aria-controls={id}
        data-testid={testId || undefined}
        onClick={() => {
          setHovered(false);
          setPinned((value) => !value);
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={id}
          role="dialog"
          className={`clever-empfiehlt__popover${anchor ? ' clever-empfiehlt__popover--anchored' : ''}`}
          style={anchor || undefined}
        >
          {title ? (
            <p className="clever-empfiehlt__popover-title">{title}</p>
          ) : null}
          {children}
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Clever-Stage der Kundenakte:
 * Offer: Fahrzeug · Konditionen · 1 lokaler Offenpunkt · CTA.
 * Details und Historie hinter Progressive Disclosure.
 */
export default function CleverEmpfiehltCard({
  view,
  telHref,
  onPrimaryAction,
  onMarkDone: _onMarkDone,
  onOpenOffer,
  onOpenOfferDetails,
  onSendToCustomer,
  onCopyMessage: _onCopyMessage,
  onPrepareMessage,
  onOpenDetails = null,
  recentActivities = [],
  onOpenAllActivities = null,
  loading = false,
}) {
  const detailsId = useId();
  const historyId = useId();
  const contextId = useId();

  if (!view && !loading) return null;

  if (loading) {
    return (
      <section className="clever-empfiehlt clever-empfiehlt--stage" aria-busy="true">
        <div className="clever-empfiehlt__stage">
          <p className="clever-empfiehlt__loading">Clever berechnet …</p>
        </div>
      </section>
    );
  }

  const nextStep = view.nextStep || null;
  const stage = view.stage || {};
  const primaryAction = nextStep?.primary
    || view.actions?.find((a) => a.primary)
    || view.actions?.[0];
  const secondary = nextStep?.secondary || stage.secondaryAction || null;
  const snapshot = view.offerSnapshot || null;
  const canOpenOffer = Boolean(stage.canOpenOffer || snapshot?.cardId);
  const activities = Array.isArray(recentActivities) ? recentActivities.slice(0, 5) : [];
  const rate = splitRate(snapshot);
  const recommendLabel = stage.recommendLabel || nextStep?.recommendLabel || 'Clever empfiehlt';
  const primaryLabel = nextStep?.primary?.label
    || stage.primaryReviewLabel
    || primaryAction?.label
    || view.ctaLabel
    || 'Weiter';
  const reasonTitle = nextStep?.reasonSource?.detail || primaryLabel;
  const briefingSections = view.workBriefing?.sections || null;
  const hero = presentCleverStageHero({
    snapshot,
    workBriefing: view.workBriefing,
    activities,
    customerSnapshot: view.customerSnapshot || null,
    existingVehicle: view.existingVehicle || null,
  });
  const customerContext = hero.customerContext?.hasData ? hero.customerContext : null;
  const briefingRows = (!hero.offerMode && briefingSections)
    ? [
      { key: 'customerPicture', title: 'Kundenbild', value: briefingSections.customerPicture },
      { key: 'sought', title: 'Gesucht', value: briefingSections.sought },
      { key: 'customerWants', title: 'Kunde möchte', value: briefingSections.customerWants },
      { key: 'leasingWish', title: 'Leasing', value: briefingSections.leasingWish },
      { key: 'important', title: 'Wichtig', value: briefingSections.important },
      { key: 'currentVehicle', title: 'Aktuell', value: briefingSections.currentVehicle },
      { key: 'planned', title: 'Geplant', value: briefingSections.planned },
      { key: 'toClarify', title: 'Noch zu klären', value: briefingSections.toClarify },
    ].filter((row) => Boolean(row.value))
    : [];
  const detailsCount = hero.packages.length
    + (hero.listPriceLabel ? 1 : 0)
    + (hero.powertrainLabel ? 1 : 0);
  const detailsTrigger = detailsCount > 0
    ? (hero.packages.length ? `${hero.packages.length} Details` : 'Details')
    : null;

  function handlePrimaryClick() {
    const handler = primaryAction?.handlerType
      || view.nextBestAction?.handler
      || null;
    if (handler && [
      'consultation',
      'prepare_offer',
      'modify_offer',
      'intend_send',
      'propose_appointment',
      'request_documents',
      'create_follow_up',
    ].includes(handler)) {
      onPrimaryAction?.(view, {
        ...primaryAction,
        handlerType: handler,
        contextPayload: primaryAction?.contextPayload
          || view.nextBestAction?.contextPayload
          || {},
      });
      return;
    }
    if (primaryAction?.type === 'call' && (primaryAction.href || telHref)) {
      onPrimaryAction?.(view, primaryAction);
      return;
    }
    if (canOpenOffer && (
      primaryAction?.type === 'offer'
      || stage.primaryReviewLabel
      || /angebot/i.test(primaryLabel)
    )) {
      onOpenOffer?.(view);
      return;
    }
    onPrimaryAction?.(view, primaryAction);
  }

  function handleSecondary() {
    if (!secondary) return;
    if (secondary.type === 'call') {
      onPrimaryAction?.(view, {
        ...secondary,
        href: secondary.href || telHref,
        type: 'call',
        label: secondary.label,
      });
      return;
    }
    if (secondary.type === 'send') {
      if (typeof onSendToCustomer === 'function') {
        onSendToCustomer(view);
        return;
      }
      if (view.messageSuggestion) onPrepareMessage?.(view.messageSuggestion);
    }
  }

  return (
    <section
      className="clever-empfiehlt clever-empfiehlt--stage clever-empfiehlt--hierarchy"
      aria-label={primaryLabel}
    >
      <div className="clever-empfiehlt__stage">
        <div className={`clever-empfiehlt__work${snapshot?.imageUrl ? '' : ' clever-empfiehlt__work--no-media'}`}>
          {snapshot?.imageUrl ? (
            <div className="clever-empfiehlt__media" data-testid="clever-empfiehlt-media">
              <img
                src={snapshot.imageUrl}
                alt={snapshot.title ? `${snapshot.title}` : ''}
                className="clever-empfiehlt__media-img"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="clever-empfiehlt__work-main">
            {briefingRows.length > 0 ? (
              <dl className="clever-empfiehlt__briefing" data-testid="clever-work-briefing">
                {briefingRows.map((row) => (
                  <div key={row.key} className="clever-empfiehlt__briefing-row">
                    <dt>{row.title}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {snapshot ? (
              <>
                <header className="clever-empfiehlt__offer-head">
                  <h3 className="clever-empfiehlt__offer-title">
                    {hero.title || snapshot.title || 'Angebot'}
                  </h3>
                  {hero.colorLabel ? (
                    <p className="clever-empfiehlt__offer-color">{hero.colorLabel}</p>
                  ) : snapshot.subtitle ? (
                    <p className="clever-empfiehlt__offer-sub">{snapshot.subtitle}</p>
                  ) : null}
                </header>

                <dl className={`clever-empfiehlt__terms${hero.downPaymentLabel ? ' clever-empfiehlt__terms--four' : ''}`}>
                  {hero.termLabel || snapshot.termLabel ? (
                    <div>
                      <dt>Laufzeit</dt>
                      <dd>{hero.termLabel || snapshot.termLabel}</dd>
                    </div>
                  ) : null}
                  {hero.mileageLabel || snapshot.mileageLabel ? (
                    <div>
                      <dt>km</dt>
                      <dd>{hero.mileageLabel || snapshot.mileageLabel}</dd>
                    </div>
                  ) : null}
                  {hero.downPaymentLabel ? (
                    <div>
                      <dt>Anzahlung</dt>
                      <dd>{hero.downPaymentLabel}</dd>
                    </div>
                  ) : null}
                  {rate.value ? (
                    <div className="clever-empfiehlt__terms-rate">
                      <dt>Rate</dt>
                      <dd>{rate.value}</dd>
                      {rate.unit ? (
                        <span className="clever-empfiehlt__terms-hint">{rate.unit}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="clever-empfiehlt__terms-rate">
                      <dt>Rate</dt>
                      <dd className="is-missing">offen</dd>
                    </div>
                  )}
                </dl>

                {hero.openPoints[0] ? (
                  <p className="clever-empfiehlt__open-point" data-testid="clever-open-point">
                    {hero.openPoints[0].compact}
                  </p>
                ) : null}

                {customerContext ? (
                  <StageDisclosure
                    id={contextId}
                    testId="clever-stage-kundenbild"
                    trigger={(
                      <span className="clever-empfiehlt__kundenbild-trigger">
                        <span className="clever-empfiehlt__kundenbild-kicker">Kundenbild</span>
                        <span className="clever-empfiehlt__kundenbild-line">{customerContext.trigger}</span>
                      </span>
                    )}
                    title="Kundenbild"
                    footer={typeof onOpenDetails === 'function' ? (
                      <button
                        type="button"
                        className="clever-empfiehlt__link clever-empfiehlt__link--quiet"
                        onClick={() => onOpenDetails()}
                      >
                        Alle Kundennotizen
                      </button>
                    ) : null}
                  >
                    {customerContext.groups.bedarf.length ? (
                      <>
                        <p className="clever-empfiehlt__popover-title">Bedarf</p>
                        <ul className="clever-empfiehlt__popover-list">
                          {customerContext.groups.bedarf.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {customerContext.groups.rahmen.length ? (
                      <>
                        <p className="clever-empfiehlt__popover-title">Rahmen</p>
                        <ul className="clever-empfiehlt__popover-list">
                          {customerContext.groups.rahmen.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {customerContext.groups.persoenlich.length ? (
                      <>
                        <p className="clever-empfiehlt__popover-title">Persönlich</p>
                        <ul className="clever-empfiehlt__popover-list">
                          {customerContext.groups.persoenlich.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </StageDisclosure>
                ) : null}
              </>
            ) : briefingRows.length === 0 ? (
              <div className="clever-empfiehlt__offer-empty">
                <h3 className="clever-empfiehlt__offer-title">Noch kein Angebot</h3>
              </div>
            ) : null}

            <div className="clever-empfiehlt__next">
              <p className="clever-empfiehlt__recommend-label">{recommendLabel}</p>

              {primaryAction?.type === 'call' && (primaryAction.href || telHref) ? (
                <a
                  href={primaryAction.href || telHref}
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--primary"
                  onClick={() => onPrimaryAction?.(view, primaryAction)}
                  title={reasonTitle}
                >
                  <IconSparkle />
                  <span>{primaryLabel}</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--primary"
                  onClick={handlePrimaryClick}
                  title={reasonTitle}
                  data-testid="clever-primary-cta"
                >
                  <IconSparkle />
                  <span>{primaryLabel}</span>
                </button>
              )}

              {secondary ? (
                secondary.type === 'call' && (secondary.href || telHref) ? (
                  <a
                    href={secondary.href || telHref}
                    className="clever-empfiehlt__secondary-link"
                    onClick={() => handleSecondary()}
                  >
                    {secondary.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="clever-empfiehlt__secondary-link"
                    onClick={handleSecondary}
                  >
                    {secondary.type === 'send' ? <IconPaperPlane /> : null}
                    <span>{secondary.label}</span>
                  </button>
                )
              ) : null}

              {detailsTrigger ? (
                <StageDisclosure
                  id={detailsId}
                  testId="clever-stage-details"
                  trigger={detailsTrigger}
                  title="Ausstattung"
                  footer={canOpenOffer && typeof onOpenOfferDetails === 'function' ? (
                    <button
                      type="button"
                      className="clever-empfiehlt__link clever-empfiehlt__link--quiet"
                      onClick={() => onOpenOfferDetails(view)}
                    >
                      <span>{stage.detailsLinkLabel || 'Angebotsdetails'}</span>
                      <IconChevronRight />
                    </button>
                  ) : typeof onOpenDetails === 'function' ? (
                    <button
                      type="button"
                      className="clever-empfiehlt__details-link"
                      onClick={() => onOpenDetails()}
                      data-testid="clever-empfiehlt-details"
                    >
                      Details
                    </button>
                  ) : null}
                >
                  {hero.packages.length ? (
                    <ul className="clever-empfiehlt__popover-list">
                      {hero.packages.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {hero.powertrainLabel || hero.listPriceLabel ? (
                    <dl className="clever-empfiehlt__popover-meta">
                      {hero.powertrainLabel ? (
                        <div>
                          <dt>Antrieb</dt>
                          <dd>{hero.powertrainLabel}</dd>
                        </div>
                      ) : null}
                      {hero.listPriceLabel ? (
                        <div>
                          <dt>Listenpreis</dt>
                          <dd>{hero.listPriceLabel}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </StageDisclosure>
              ) : canOpenOffer && typeof onOpenOfferDetails === 'function' ? (
                <button
                  type="button"
                  className="clever-empfiehlt__link clever-empfiehlt__link--quiet"
                  onClick={() => onOpenOfferDetails(view)}
                >
                  <span>{stage.detailsLinkLabel || 'Angebotsdetails'}</span>
                  <IconChevronRight />
                </button>
              ) : typeof onOpenDetails === 'function' ? (
                <button
                  type="button"
                  className="clever-empfiehlt__details-link"
                  onClick={() => onOpenDetails()}
                  data-testid="clever-empfiehlt-details"
                >
                  Details
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {activities.length > 0 ? (
        <div
          className="clever-empfiehlt__activities clever-empfiehlt__activities--timeline clever-empfiehlt__activities--compact"
          aria-label="Letzte Aktivitäten"
          data-testid="clever-empfiehlt-activities"
        >
          <StageDisclosure
            id={historyId}
            testId="clever-stage-history"
            trigger={hero.activityTrigger || 'Letzte Aktivität'}
            title="Letzte Aktivitäten"
            align="stretch"
            footer={typeof onOpenAllActivities === 'function' ? (
              <button
                type="button"
                className="clever-empfiehlt__activities-all"
                onClick={onOpenAllActivities}
              >
                Alle Aktivitäten
              </button>
            ) : null}
          >
            <ul className="clever-empfiehlt__activities-list">
              {hero.activities.map((item) => (
                <ActivityItem
                  key={item.id || `${item.headline}-${item.time}`}
                  item={item}
                  onOpen={typeof onOpenAllActivities === 'function' ? onOpenAllActivities : null}
                />
              ))}
            </ul>
          </StageDisclosure>
        </div>
      ) : null}
    </section>
  );
}
