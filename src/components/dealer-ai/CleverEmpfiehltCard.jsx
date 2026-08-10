import {
  IconChevronRight,
  IconPaperPlane,
  IconSparkle,
} from './AkteIcons.jsx';
import './CleverEmpfiehltCard.css';

function StatusChip({ signal }) {
  if (!signal?.label) return null;
  return (
    <li>
      <span
        className={`clever-empfiehlt__signal clever-empfiehlt__signal--${signal.tone || 'neutral'}`}
      >
        {signal.label}
      </span>
    </li>
  );
}

function ActivityItem({ item, onOpen }) {
  if (!item) return null;
  const initials = item.avatarInitials || 'CL';
  const tone = item.avatarTone || 'slate';
  const content = (
    <>
      <span
        className={`clever-empfiehlt__activity-avatar clever-empfiehlt__activity-avatar--${tone}`}
        aria-hidden
      >
        {initials}
      </span>
      <span className="clever-empfiehlt__activity-body">
        <span className="clever-empfiehlt__activity-title">{item.headline}</span>
        {item.body ? (
          <span className="clever-empfiehlt__activity-sub">{item.body}</span>
        ) : null}
        {item.whenLabel || item.time ? (
          <span className="clever-empfiehlt__activity-when">
            {item.whenLabel || item.time}
          </span>
        ) : null}
      </span>
      <span className="clever-empfiehlt__activity-chevron" aria-hidden>
        <IconChevronRight />
      </span>
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
          title={item.headline || 'Aktivität öffnen'}
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

/** Headline redundant with primary CTA → hide headline (less text). */
function isHeadlineRedundantWithCta(headline, ctaLabel) {
  const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^\wäöüß]+/gi, ' ')
    .trim();
  const h = normalize(headline);
  const c = normalize(ctaLabel);
  if (!h || !c) return false;
  if (h === c) return true;
  if (h.includes(c) || c.includes(h)) return true;
  const hTokens = new Set(h.split(/\s+/).filter((t) => t.length > 2));
  const cTokens = c.split(/\s+/).filter((t) => t.length > 2);
  return cTokens.length > 0 && cTokens.every((t) => hTokens.has(t));
}

export default function CleverEmpfiehltCard({
  view,
  telHref,
  onPrimaryAction,
  onMarkDone,
  onOpenOffer,
  onOpenOfferDetails,
  onSendToCustomer,
  onCopyMessage,
  onPrepareMessage,
  recentActivities = [],
  onOpenAllActivities = null,
  loading = false,
}) {
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

  const primaryAction = view.actions?.find((a) => a.primary)
    ?? view.actions?.[0];
  const snapshot = view.offerSnapshot || null;
  const signals = Array.isArray(view.statusSignals) ? view.statusSignals : [];
  const stage = view.stage || {};
  const canOpenOffer = Boolean(stage.canOpenOffer || snapshot?.cardId);
  const canSend = stage.canSend !== false;
  const activities = Array.isArray(recentActivities) ? recentActivities.slice(0, 3) : [];
  const rate = splitRate(snapshot);

  function handlePrimaryClick() {
    if (primaryAction?.type === 'call' && primaryAction.href) {
      onPrimaryAction?.(view, primaryAction);
      return;
    }
    if (canOpenOffer && (primaryAction?.type === 'offer' || stage.primaryReviewLabel)) {
      onOpenOffer?.(view);
      return;
    }
    onPrimaryAction?.(view, primaryAction);
  }

  function handleOpenDetails() {
    if (typeof onOpenOfferDetails === 'function') {
      onOpenOfferDetails(view);
      return;
    }
    onOpenOffer?.(view);
  }

  function handleSend() {
    if (typeof onSendToCustomer === 'function') {
      onSendToCustomer(view);
      return;
    }
    if (view.messageSuggestion) {
      onPrepareMessage?.(view.messageSuggestion);
    }
  }

  const primaryLabel = stage.primaryReviewLabel
    || primaryAction?.label
    || view.ctaLabel
    || 'Weiter';
  const sendLabel = stage.sendLabel || 'An Kunden senden';
  const detailsLabel = stage.detailsLinkLabel || 'Angebotsdetails anzeigen';
  const helpText = String(view.subline || view.reminderLine || '').trim();
  const showHeadline = Boolean(view.headline)
    && !isHeadlineRedundantWithCta(view.headline, primaryLabel);
  const sectionLabel = view.headline || primaryLabel || 'Empfehlung';
  const primaryHelp = helpText || primaryLabel;
  const sendHelp = helpText || sendLabel;
  const doneLabel = view.doneOption?.label?.replace(/^✓\s*/, '') || 'Erledigt';

  return (
    <section
      className="clever-empfiehlt clever-empfiehlt--stage"
      aria-label={sectionLabel}
    >
      <div className="clever-empfiehlt__stage">
        <div className="clever-empfiehlt__stage-grid">
          <div className="clever-empfiehlt__col clever-empfiehlt__col--recommend">
            {showHeadline ? (
              <h2 id="clever-empfiehlt-title" className="clever-empfiehlt__headline">
                {view.headline}
              </h2>
            ) : null}

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

            {signals.length > 0 ? (
              <ul className="clever-empfiehlt__signals" aria-label="Signale">
                {signals.map((signal) => (
                  <StatusChip key={signal.id || signal.label} signal={signal} />
                ))}
              </ul>
            ) : null}
          </div>

          <div className="clever-empfiehlt__col clever-empfiehlt__col--offer">
            {snapshot ? (
              <>
                <header className="clever-empfiehlt__offer-head">
                  <div className="clever-empfiehlt__offer-titles">
                    <div className="clever-empfiehlt__offer-title-row">
                      <h3 className="clever-empfiehlt__offer-title">
                        {snapshot.title || 'Angebot'}
                      </h3>
                      {snapshot.availabilityLabel ? (
                        <span
                          className="clever-empfiehlt__badge"
                          data-testid="clever-empfiehlt-availability"
                        >
                          {snapshot.availabilityLabel}
                        </span>
                      ) : null}
                    </div>
                    {snapshot.subtitle ? (
                      <p className="clever-empfiehlt__offer-sub">{snapshot.subtitle}</p>
                    ) : null}
                  </div>
                </header>

                <dl className="clever-empfiehlt__terms">
                  {snapshot.termLabel ? (
                    <div>
                      <dt>Laufzeit</dt>
                      <dd>{snapshot.termLabel}</dd>
                    </div>
                  ) : null}
                  {snapshot.mileageLabel ? (
                    <div>
                      <dt>km</dt>
                      <dd>{snapshot.mileageLabel}</dd>
                      {snapshot.mileageHint ? (
                        <span className="clever-empfiehlt__terms-hint">{snapshot.mileageHint}</span>
                      ) : null}
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
                  ) : null}
                </dl>

                {canOpenOffer ? (
                  <button
                    type="button"
                    className="clever-empfiehlt__link"
                    onClick={handleOpenDetails}
                    aria-label={detailsLabel}
                    title={detailsLabel}
                  >
                    <span>{detailsLabel}</span>
                    <IconChevronRight />
                  </button>
                ) : null}
              </>
            ) : (
              <div className="clever-empfiehlt__offer-empty">
                <h3 className="clever-empfiehlt__offer-title">Noch kein Angebot</h3>
              </div>
            )}
          </div>

          <div className="clever-empfiehlt__col clever-empfiehlt__col--next">
            <div className="clever-empfiehlt__next-actions">
              {primaryAction?.type === 'call' && (primaryAction.href || telHref) ? (
                <a
                  href={primaryAction.href || telHref}
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--primary"
                  onClick={() => onPrimaryAction?.(view, primaryAction)}
                  aria-label={primaryAction.label}
                  title={primaryHelp}
                >
                  <IconSparkle />
                  <span>{primaryAction.label}</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--primary"
                  onClick={handlePrimaryClick}
                  aria-label={primaryLabel}
                  title={primaryHelp}
                >
                  <IconSparkle />
                  <span>{primaryLabel}</span>
                </button>
              )}

              {canSend ? (
                <button
                  type="button"
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--secondary"
                  onClick={handleSend}
                  aria-label={sendLabel}
                  title={sendHelp}
                >
                  <IconPaperPlane />
                  <span>{sendLabel}</span>
                </button>
              ) : null}
            </div>

            {view.doneOption ? (
              <div className="clever-empfiehlt__meta-row">
                <button
                  type="button"
                  className="clever-empfiehlt__done-btn clever-empfiehlt__done-btn--quiet"
                  onClick={() => onMarkDone?.(view)}
                  aria-label={doneLabel}
                  title={doneLabel}
                >
                  {doneLabel}
                </button>
              </div>
            ) : null}

            {view.messageSuggestion?.text && !canSend ? (
              <div className="clever-empfiehlt__message-actions">
                <button
                  type="button"
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--secondary clever-empfiehlt__btn--compact"
                  onClick={() => onPrepareMessage?.(view.messageSuggestion)}
                  aria-label="Nachricht vorbereiten"
                  title="Nachricht vorbereiten"
                >
                  Nachricht vorbereiten
                </button>
                <button
                  type="button"
                  className="clever-empfiehlt__btn clever-empfiehlt__btn--secondary clever-empfiehlt__btn--compact"
                  onClick={() => onCopyMessage?.(view.messageSuggestion)}
                  aria-label="Kopieren"
                  title="Kopieren"
                >
                  Kopieren
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {activities.length > 0 ? (
        <div
          className="clever-empfiehlt__activities"
          aria-label="Letzte Aktivitäten"
          data-testid="clever-empfiehlt-activities"
        >
          <div className="clever-empfiehlt__activities-head">
            <h3 className="clever-empfiehlt__activities-title">Letzte Aktivitäten</h3>
            {typeof onOpenAllActivities === 'function' ? (
              <button
                type="button"
                className="clever-empfiehlt__activities-all"
                onClick={onOpenAllActivities}
                aria-label="Alle Aktivitäten"
                title="Alle Aktivitäten"
              >
                Alle Aktivitäten
              </button>
            ) : null}
          </div>
          <ul className="clever-empfiehlt__activities-list">
            {activities.map((item) => (
              <ActivityItem
                key={item.id || `${item.headline}-${item.time}`}
                item={item}
                onOpen={typeof onOpenAllActivities === 'function' ? onOpenAllActivities : null}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
