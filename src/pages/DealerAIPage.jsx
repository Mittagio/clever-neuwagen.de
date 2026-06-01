import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublishedDealerConditions, useDraftDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import { parseDealerAiInput } from '../services/dealerAiParser.js';
import { executeDealerAiAction, formatDealerAiVehicleCard } from '../services/dealerAiActions.js';
import DealerAiInput from '../components/dealer-ai/DealerAiInput.jsx';
import DealerAiAnalysisCard from '../components/dealer-ai/DealerAiAnalysisCard.jsx';
import DealerAiActionCard from '../components/dealer-ai/DealerAiActionCard.jsx';
import DealerAiResultPanel from '../components/dealer-ai/DealerAiResultPanel.jsx';
import './DealerAIPage.css';

export default function DealerAIPage() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { addInventoryItem, publishChanges } = useDraftDealerConditions();
  const { addLead, leads, updateLead } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const inputRef = useRef(null);
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState(null);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('input');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [speechHint, setSpeechHint] = useState('');
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  function runAnalysis(text = input) {
    setIsAnalyzing(true);
    setResult(null);
    const next = parseDealerAiInput(text);
    setIsAnalyzing(false);

    if (!next.ok) {
      showToast(next.error);
      return;
    }

    setParsed(next);
    setPhase('review');
  }

  function handleExampleSelect(text) {
    setInput(text);
    runAnalysis(text);
  }

  function handleSpeechStart() {
    setSpeechHint('Spracheingabe wird vorbereitet. Aktuell bitte Text eingeben.');
    setTimeout(() => setSpeechHint(''), 4000);

    if (typeof window !== 'undefined' && window.SpeechRecognition) {
      /* Hook für später: Web Speech API */
    }
  }

  function handleEdit() {
    setPhase('input');
    setParsed(null);
    setResult(null);
    inputRef.current?.focus();
  }

  function handleDiscard() {
    setInput('');
    setParsed(null);
    setResult(null);
    setPhase('input');
  }

  function handleConfirm() {
    if (!parsed?.ok) return;
    setIsExecuting(true);

    try {
      const actionResult = executeDealerAiAction(parsed.action, parsed, {
        conditions,
        addOffer,
        getExistingCodes,
        leads,
        addLead,
        updateLead,
        linkLead,
        addInventoryItem,
        publishChanges,
      });

      setResult(actionResult);
      setPhase('done');
      showToast(actionResult.message);
    } catch (err) {
      showToast(err.message ?? 'Aktion fehlgeschlagen');
    } finally {
      setIsExecuting(false);
    }
  }

  const vehicleCard = parsed?.ok && result
    ? formatDealerAiVehicleCard(parsed.fields, conditions)
    : null;

  return (
    <div className="dealer-ai-page">
      <header className="dealer-ai-header">
        <div className="dealer-ai-header__row">
          <Link to="/backend" className="dealer-ai-back">← Backend</Link>
          <div className="dealer-ai-header__links">
            <Link to="/offers">Angebote</Link>
            <Link to="/communication">Verkaufschancen</Link>
          </div>
        </div>
      </header>

      <main className="dealer-ai-main">
        <div className="dealer-ai-hero">
          <p className="dealer-ai-kicker">Dealer AI</p>
          <h1 className="dealer-ai-title">KI-Verkaufsassistent</h1>
          <p className="dealer-ai-tagline">
            Clever-Neuwagen ist nicht nur KI-Kaufberater für Kunden, sondern auch
            KI-Verkaufsassistent für Händler – per Text oder später Sprache.
          </p>
        </div>

        {(phase === 'input' || phase === 'review') && (
          <DealerAiInput
            value={input}
            onChange={setInput}
            onAnalyze={() => runAnalysis()}
            onExampleSelect={handleExampleSelect}
            onSpeechStart={handleSpeechStart}
            speechHint={speechHint}
            isAnalyzing={isAnalyzing}
            inputRef={inputRef}
          />
        )}

        {phase === 'review' && parsed?.ok && (
          <>
            <DealerAiAnalysisCard parsed={parsed} onFieldEdit={handleEdit} />
            <DealerAiActionCard
              parsed={parsed}
              onConfirm={handleConfirm}
              onEdit={handleEdit}
              onDiscard={handleDiscard}
              isExecuting={isExecuting}
            />
          </>
        )}

        {phase === 'done' && result && (
          <>
            <DealerAiResultPanel result={result} vehicleCard={vehicleCard} />
            <button type="button" className="dai-btn dai-btn--primary" onClick={handleDiscard}>
              Neues Fahrzeug / Angebot
            </button>
          </>
        )}
      </main>

      {toast && <p className="dealer-ai-toast" role="status">{toast}</p>}
    </div>
  );
}
