import {
  IconChevronRight,
  IconPaperPlane,
  IconSparkle,
} from './AkteIcons.jsx';
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

/**
 * Clever-Stage der Kundenakte:
 * 1 Angebotskontext · 1 dynamischer Primär-CTA · max. 1 Sekundär · Timeline.
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

  const nextStep = view.nextStep || null;
  const stage = view.stage || {};
  const primaryAction = nextStep?.primary
    || view.actions?.find((a) => a.primary)
    || view.actions?.[0];
  const secondary = nextStep?.secondary || stage.secondaryAction || null;
  const snapshot = view.offerSnapshot || null;
  const canOpenOffer = Boolean(stage.canOpenOffer || snapshot?.cardId);
  const activities = Array.isArray(recentActivities) ? recentActivities.slice(0, 3) : [];
  const rate = splitRate(snapshot);
  const recommendLabel = stage.recommendLabel || nextStep?.recommendLabel || 'Clever empfiehlt';
  const primaryLabel = nextStep?.primary?.label
    || stage.primaryReviewLabel
    || primaryAction?.label
    || view.ctaLabel
    || 'Weiter';
  const reasonTitle = nextStep?.reasonSource?.detail || primaryLabel;

  function handlePrimaryClick() {
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
            {snapshot ? (
              <>
                <header className="clever-empfiehlt__offer-head">
                  <h3 className="clever-empfiehlt__offer-title">
                    {snapshot.title || 'Angebot'}
                  </h3>
                  {snapshot.subtitle ? (
                    <p className="clever-empfiehlt__offer-sub">{snapshot.subtitle}</p>
                  ) : null}
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

                {canOpenOffer && typeof onOpenOfferDetails === 'function' ? (
                  <button
                    type="button"
                    className="clever-empfiehlt__link clever-empfiehlt__link--quiet"
                    onClick={() => onOpenOfferDetails(view)}
                  >
                    <span>{stage.detailsLinkLabel || 'Angebotsdetails'}</span>
                    <IconChevronRight />
                  </button>
                ) : null}
              </>
            ) : (
              <div className="clever-empfiehlt__offer-empty">
                <h3 className="clever-empfiehlt__offer-title">Noch kein Angebot</h3>
              </div>
            )}

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
            </div>
          </div>
        </div>
      </div>

      {activities.length > 0 ? (
        <div
          className="clever-empfiehlt__activities clever-empfiehlt__activities--timeline"
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
