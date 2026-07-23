import { buildStructuredNotepadSummary } from '../../services/consultation/notepadChipBundling.js';
import { iconForNotepadLabel } from './CleverMemoryBar.jsx';
import './clever-conversation.css';

function SummarySection({ title, labels }) {
  if (!labels?.length) return null;
  return (
    <div className="cc-note-summary__section">
      <p className="cc-note-summary__section-title">{title}</p>
      <ul className="cc-note-summary__chips">
        {labels.map((label) => (
          <li key={label} className="cc-note-summary__chip">
            <span aria-hidden>{iconForNotepadLabel(label)}</span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Strukturierte Notizzettel-Zusammenfassung (Display-only). */
export function CleverNotepadSummary({
  labels = [],
  heading = 'Das habe ich für Sie notiert',
  className = '',
}) {
  const summary = buildStructuredNotepadSummary(labels);
  const hasAny = summary.vehicle.length
    || summary.conditions.length
    || summary.wishes.length
    || summary.timing.length;
  if (!hasAny) return null;

  return (
    <div className={`cc-note-summary ${className}`.trim()} aria-label={heading}>
      <p className="cc-note-summary__heading">{heading}</p>
      <SummarySection title="Fahrzeugwunsch" labels={summary.vehicle} />
      <SummarySection title="Ausstattung & Wünsche" labels={summary.wishes} />
      <SummarySection title="Konditionen" labels={summary.conditions} />
      <SummarySection title="Planung" labels={summary.timing} />
    </div>
  );
}

export default function CleverHandoffComplete({
  completeView,
  onContinueWishes = null,
}) {
  if (!completeView) return null;

  const wishLabels = completeView.wishLabels ?? [];

  return (
    <section className="cc-offer-complete cc-turn-enter" aria-labelledby="cc-offer-complete-title">
      <p className="cc-offer-complete__ready" aria-hidden>✓</p>
      <h2 id="cc-offer-complete-title" className="cc-offer-complete__title">
        {completeView.title}
      </h2>

      {completeView.headline && (
        <p className="cc-offer-complete__headline">{completeView.headline}</p>
      )}

      {completeView.intro && (
        <p className="cc-offer-complete__intro">{completeView.intro}</p>
      )}

      {wishLabels.length > 0 && (
        <CleverNotepadSummary
          labels={wishLabels}
          heading={completeView.wishesHeading || 'Das habe ich für Sie notiert'}
        />
      )}

      {(completeView.checklist?.length > 0) && (
        <ul className="cc-offer-complete__checklist">
          {completeView.checklist.map((item) => (
            <li key={item} className="cc-offer-complete__check-item">
              <span aria-hidden>✓</span>
              {item}
            </li>
          ))}
        </ul>
      )}

      {completeView.outro && (
        <p className="cc-offer-complete__outro">{completeView.outro}</p>
      )}

      {completeView.confirmationHint && (
        <p className="cc-offer-complete__confirm">{completeView.confirmationHint}</p>
      )}

      {(completeView.returnActions?.length > 0) && (
        <div className="cc-offer-complete__actions" role="group" aria-label="Weiter">
          {completeView.returnActions.map((action) => {
            if (action.id === 'continue_wishes') {
              return (
                <button
                  key={action.id}
                  type="button"
                  className="cc-offer-complete__action"
                  onClick={() => onContinueWishes?.()}
                >
                  {action.label}
                </button>
              );
            }
            if (action.href) {
              const isPrimary = action.id === 'return_model'
                || action.id === 'return_home';
              return (
                <a
                  key={action.id}
                  className={`cc-offer-complete__action${
                    isPrimary ? ' cc-offer-complete__action--primary' : ''
                  }`}
                  href={action.href}
                >
                  {action.label}
                </a>
              );
            }
            return null;
          })}
        </div>
      )}

      {completeView.reassurance && (
        <p className="cc-offer-complete__reassurance">{completeView.reassurance}</p>
      )}
    </section>
  );
}
