import { buildSoftHandoffPromptCopy } from '../../services/consultation/customerIntakeExits.js';
import './clever-conversation.css';

export default function CleverSoftHandoffPrompt({ onHandoff, onContinue }) {
  const copy = buildSoftHandoffPromptCopy();

  return (
    <aside className="cc-soft-handoff cc-turn-enter" aria-label="Wünsche übergeben">
      <p className="cc-soft-handoff__text">{copy.text}</p>
      <div className="cc-soft-handoff__actions">
        <button
          type="button"
          className="cc-soft-handoff__btn cc-soft-handoff__btn--primary"
          onClick={onHandoff}
        >
          {copy.handoffLabel}
        </button>
        <button
          type="button"
          className="cc-soft-handoff__btn"
          onClick={onContinue}
        >
          {copy.continueLabel}
        </button>
      </div>
    </aside>
  );
}
