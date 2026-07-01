import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DealerAiInlineMic from '../dealer-ai/DealerAiInlineMic.jsx';
import './BackendHome.css';

export default function BackendAdvisorHero() {
  const navigate = useNavigate();
  const [text, setText] = useState('');

  function appendTranscript(spoken) {
    setText((current) => (current.trim() ? `${current.trim()} ${spoken}` : spoken));
  }

  function handleStart() {
    const trimmed = text.trim();
    if (!trimmed) {
      navigate('/verkaufsassistent');
      return;
    }
    navigate('/verkaufsassistent', { state: { wishText: trimmed } });
  }

  return (
    <section className="backend-home__advisor-hero" aria-labelledby="backend-advisor-hero-title">
      <div className="backend-home__advisor-hero-inner">
        <h2 id="backend-advisor-hero-title" className="backend-home__advisor-title">
          Clever Beratung
        </h2>
        <p className="backend-home__advisor-subline">
          Schreib oder sprich einfach, was der Kunde sagt.
          {' '}
          Clever erkennt daraus Auto, Bezahlung, Kunde und Notiz.
        </p>

        <div className="backend-home__capture">
          <div className="backend-home__capture-field-wrap">
            <textarea
              id="backend-advisor-capture"
              className="backend-home__capture-field"
              rows={5}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Kundenwunsch eingeben, einfügen oder diktieren …"
              aria-label="Kundenwunsch für Clever Beratung"
            />
          </div>
          <DealerAiInlineMic
            variant="fab"
            onTranscript={appendTranscript}
          />
        </div>

        <button
          type="button"
          className="backend-home__advisor-start"
          onClick={handleStart}
        >
          Clever starten
        </button>
      </div>
    </section>
  );
}
