import './clever-conversation.css';

export default function CleverHandoffComplete({ completeView }) {
  if (!completeView) return null;

  return (
    <section className="cc-offer-complete cc-turn-enter" aria-labelledby="cc-offer-complete-title">
      <h2 id="cc-offer-complete-title" className="cc-offer-complete__title">
        {completeView.title}
      </h2>

      <p className="cc-offer-complete__headline">{completeView.headline}</p>

      <div className="cc-offer-complete__checklist-block">
        <p className="cc-offer-complete__intro">{completeView.intro}</p>
        <ul className="cc-offer-complete__checklist">
          {completeView.checklist.map((item) => (
            <li key={item} className="cc-offer-complete__check-item">
              <span aria-hidden>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="cc-offer-complete__outro">{completeView.outro}</p>

      <p className="cc-offer-complete__reassurance">{completeView.reassurance}</p>
    </section>
  );
}
