import './clever-conversation.css';

export default function CleverHandoffComplete({
  completeView,
  onContinueWishes = null,
}) {
  if (!completeView) return null;

  return (
    <section className="cc-offer-complete cc-turn-enter" aria-labelledby="cc-offer-complete-title">
      <p className="cc-offer-complete__ready" aria-hidden>✓</p>
      <h2 id="cc-offer-complete-title" className="cc-offer-complete__title">
        {completeView.title}
      </h2>

      {completeView.headline && (
        <p className="cc-offer-complete__headline">{completeView.headline}</p>
      )}

      {(completeView.intro || (completeView.checklist?.length > 0)) && (
        <div className="cc-offer-complete__checklist-block">
          {completeView.intro && (
            <p className="cc-offer-complete__intro">{completeView.intro}</p>
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
        </div>
      )}

      {completeView.outro && (
        <p className="cc-offer-complete__outro">{completeView.outro}</p>
      )}

      {completeView.confirmationHint && (
        <p className="cc-offer-complete__confirm">{completeView.confirmationHint}</p>
      )}

      {completeView.publicReference && (
        <p className="cc-offer-complete__ref">
          {completeView.publicReference}
        </p>
      )}

      {completeView.trustSla && (
        <p className="cc-offer-complete__sla">{completeView.trustSla}</p>
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
                || action.id === 'return_home'
                || action.id === 'account';
              return (
                <a
                  key={action.id}
                  className={`cc-offer-complete__action${
                    isPrimary && action.id !== 'continue_wishes' ? ' cc-offer-complete__action--primary' : ''
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
