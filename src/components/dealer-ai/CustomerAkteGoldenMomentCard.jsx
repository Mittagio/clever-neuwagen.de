import { IconSparkle } from './AkteIcons.jsx';
import './CustomerAkteGoldenMomentCard.css';

/**
 * Eine zentrale Clever-Karte – Mockup-treu (lavender soft, navy CTA, keine %-Scores).
 */
export default function CustomerAkteGoldenMomentCard({
  moment = null,
  onPrimary = null,
  onSecondary = null,
}) {
  if (!moment) return null;

  const lines = Array.isArray(moment.bodyLines) && moment.bodyLines.length
    ? moment.bodyLines
    : [moment.headline, moment.body].filter(Boolean);

  return (
    <section className="gm-card" aria-labelledby="gm-card-title">
      <p className="gm-card__eyebrow">
        <IconSparkle />
        <span>Clever</span>
      </p>
      <h2 id="gm-card-title" className="gm-card__title">
        {lines[0]}
      </h2>
      {lines.slice(1).map((line) => (
        <p key={line} className="gm-card__body">{line}</p>
      ))}
      {moment.primaryLabel ? (
        <button
          type="button"
          className="gm-card__btn gm-card__btn--primary"
          onClick={() => onPrimary?.(moment)}
        >
          {moment.primaryLabel}
        </button>
      ) : null}
      {moment.secondaryLabel ? (
        <button
          type="button"
          className="gm-card__link"
          onClick={() => onSecondary?.(moment)}
        >
          {moment.secondaryLabel}
        </button>
      ) : null}
    </section>
  );
}
