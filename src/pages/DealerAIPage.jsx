import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePublishedDealerConditions, useDraftDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import {
  parseDealerAiInput,
  applyDealerAiFields,
  suggestActionForPaymentType,
} from '../services/dealerAiParser.js';
import { buildDealerAiTextFromWishes } from '../services/dealerAiFromWishes.js';
import { resolveDealerAiVehicleSuggestions } from '../services/dealerAiVehicleSuggestions.js';
import { pipelineToLeadStatus } from '../services/dealerAiLeadCrm.js';
import { mergeChipIds } from '../services/sales/conversationVoiceParser.js';
import { executeDealerAiAction, formatDealerAiVehicleCard } from '../services/dealerAiActions.js';
import SalesAssistantInput from '../components/sales-advisor/SalesAssistantInput.jsx';
import DealerAiAnalysisCard from '../components/dealer-ai/DealerAiAnalysisCard.jsx';
import DealerAiSuggestedModels from '../components/dealer-ai/DealerAiSuggestedModels.jsx';
import DealerAiReviewBar from '../components/dealer-ai/DealerAiReviewBar.jsx';
import DealerAiLeadFollowUp from '../components/dealer-ai/DealerAiLeadFollowUp.jsx';
import DealerAiResultPanel from '../components/dealer-ai/DealerAiResultPanel.jsx';
import './DealerAIPage.css';

export default function DealerAIPage() {
  const location = useLocation();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { addInventoryItem, publishChanges } = useDraftDealerConditions();
  const { addLead, leads, updateLead, addHistory } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const inputRef = useRef(null);
  const [input, setInput] = useState('');
  const [selectedChipIds, setSelectedChipIds] = useState([]);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [parsed, setParsed] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('input');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  const enrichWithSuggestions = useCallback((nextParsed, chipIds = selectedChipIds) => {
    if (!nextParsed?.ok) return nextParsed;
    return {
      ...nextParsed,
      suggestedModels: resolveDealerAiVehicleSuggestions(nextParsed.fields, conditions, chipIds),
    };
  }, [conditions, selectedChipIds]);

  const toggleChip = useCallback((chipId) => {
    setSelectedChipIds((prev) =>
      prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId],
    );
  }, []);

  const buildCombinedText = useCallback(() => {
    const textParts = [];
    if (voiceTranscript?.trim()) textParts.push(voiceTranscript.trim());
    if (input?.trim() && input.trim() !== voiceTranscript?.trim()) {
      textParts.push(input.trim());
    }
    return buildDealerAiTextFromWishes({
      chipIds: selectedChipIds,
      transcript: textParts.join('. '),
    });
  }, [selectedChipIds, voiceTranscript, input]);

  function runAnalysis() {
    const combined = buildCombinedText();
    setIsAnalyzing(true);
    setResult(null);
    const next = parseDealerAiInput(combined);
    setIsAnalyzing(false);

    if (!next.ok) {
      showToast(next.error);
      return;
    }

    setParsed(enrichWithSuggestions(next));
    setSelectedModelId(null);
    setPhase('review');
  }

  function handleVoiceParsed(parsedVoice) {
    if (parsedVoice?.transcript) {
      setVoiceTranscript((prev) => {
        const next = prev ? `${prev} ${parsedVoice.transcript}` : parsedVoice.transcript;
        return next.trim();
      });
      if (!input.trim()) {
        setInput((prev) => prev || parsedVoice.transcript);
      }
    }
    if (parsedVoice?.chipIds?.length) {
      setSelectedChipIds((prev) => mergeChipIds(prev, parsedVoice.chipIds));
    }
  }

  function handleEdit() {
    setPhase('input');
    setParsed(null);
    setSelectedModelId(null);
    setResult(null);
    inputRef.current?.focus();
  }

  function handleDiscard() {
    setInput('');
    setSelectedChipIds([]);
    setVoiceTranscript('');
    setParsed(null);
    setSelectedModelId(null);
    setResult(null);
    setPhase('input');
  }

  function handleFieldsChange(patch) {
    setParsed((prev) => enrichWithSuggestions(applyDealerAiFields(prev, patch)));
  }

  function handleReserveModel(model) {
    setSelectedModelId(model.id);
    const vehicle = model.primaryMatch?.vehicle;
    setParsed((prev) => enrichWithSuggestions(applyDealerAiFields(prev, {
      model: vehicle?.model ?? model.name.replace(/^Kia\s+/i, ''),
      brand: vehicle?.brand ?? 'Kia',
      modelId: model.modelKey ?? model.id,
      trimLabel: vehicle?.trim ?? prev?.fields?.trimLabel,
      trimId: vehicle?.trimId ?? prev?.fields?.trimId,
    })));
  }

  useEffect(() => {
    const wishText = location.state?.wishText;
    if (!wishText) return;
    setInput(wishText);
    const next = parseDealerAiInput(wishText);
    if (next.ok) {
      setParsed(enrichWithSuggestions(next));
      setSelectedModelId(null);
      setPhase('review');
    }
  }, [location.state]);

  useEffect(() => {
    if (!location.state?.focusText || phase !== 'input') return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [location.state, phase]);

  function runAction(actionId) {
    if (!parsed?.ok) return;
    setIsExecuting(true);

    try {
      const actionResult = executeDealerAiAction(actionId, parsed, {
        conditions,
        addOffer,
        getExistingCodes,
        leads,
        addLead,
        updateLead,
        linkLead,
        addInventoryItem,
        publishChanges,
        selectedModelId,
      });

      setResult(actionResult);
      setPhase(actionResult.type === 'lead' ? 'followup' : 'done');
      showToast(actionResult.message);
    } catch (err) {
      showToast(err.message ?? 'Aktion fehlgeschlagen');
    } finally {
      setIsExecuting(false);
    }
  }

  function handleCreateLead() {
    runAction('create_sales_opportunity');
  }

  function handlePrepareOffer() {
    if (!parsed?.ok) return;
    const actionId = suggestActionForPaymentType(parsed.fields.paymentType ?? 'unknown');
    if (actionId === 'create_sales_opportunity') {
      runAction('create_offer');
      return;
    }
    runAction(actionId);
  }

  function handleDraftReply() {
    runAction('draft_reply');
  }

  const activeLead = result?.leadId
    ? leads.find((l) => l.id === result.leadId) ?? null
    : null;

  function handleLeadSave(patch, meta = {}) {
    if (!result?.leadId) return;
    setIsSavingLead(true);
    updateLead(result.leadId, patch);
    if (!meta.silent && meta.historyText) {
      addHistory(result.leadId, meta.historyText, meta.historyType ?? 'note');
    }
    if (meta.addFollowupHistory !== false && patch.crm?.nextStepLabel) {
      addHistory(
        result.leadId,
        `Nachfassen geplant: ${patch.crm.nextStepLabel}`,
        'followup',
      );
    }
    setIsSavingLead(false);
    showToast('Gespeichert');
  }

  function handleLeadHistory(text, type = 'note', options = {}) {
    if (!result?.leadId) return;
    addHistory(result.leadId, text, type);
    if (options.pipelineStatusId) {
      const leadStatus = pipelineToLeadStatus(options.pipelineStatusId);
      updateLead(result.leadId, {
        status: leadStatus,
        crm: {
          ...(activeLead?.crm ?? {}),
          pipelineStatusId: options.pipelineStatusId,
        },
      });
    }
    showToast('Eintrag in Historie gespeichert');
  }

  const pageKicker = 'Digitaler Verkaufsassistent';
  const pageTitle = phase === 'followup' || (phase === 'done' && result?.type === 'lead')
    ? 'Verkaufschance angelegt'
    : phase === 'review' || (phase === 'done' && result?.type !== 'lead')
      ? 'Ich habe erkannt'
      : 'Was sucht Ihr Kunde?';
  const pageTagline = phase === 'followup' || (phase === 'done' && result?.type === 'lead')
    ? 'Ergänzen Sie Kundendaten und planen Sie den nächsten Schritt.'
    : phase === 'review'
      ? `${Math.round((parsed?.confidence ?? 0) * 100)} % sicher · bitte kurz prüfen`
      : phase === 'input'
        ? 'Sprechen, schreiben oder anklicken – aus jedem Kundenwunsch wird eine Verkaufschance.'
        : 'Bitte kurz prüfen.';

  const vehicleCard = parsed?.ok && result
    ? formatDealerAiVehicleCard(parsed.fields, conditions)
    : null;

  const hasVoiceTranscript = Boolean(voiceTranscript?.trim());

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

      <main className={`dealer-ai-main${phase === 'review' ? ' dealer-ai-main--review' : ''}`}>
        {phase !== 'followup' && (
          <div className={`dealer-ai-hero${phase === 'review' ? ' dealer-ai-hero--review' : ''}`}>
            {phase !== 'review' && (
              <p className="dealer-ai-kicker">{pageKicker}</p>
            )}
            <h1 className="dealer-ai-title">{pageTitle}</h1>
            <p className="dealer-ai-tagline">{pageTagline}</p>
          </div>
        )}

        {phase === 'input' && (
          <SalesAssistantInput
            text={input}
            onTextChange={setInput}
            selectedChipIds={selectedChipIds}
            onToggleChip={toggleChip}
            onVoiceParsed={handleVoiceParsed}
            onEvaluate={runAnalysis}
            isAnalyzing={isAnalyzing}
            inputRef={inputRef}
            hasVoiceTranscript={hasVoiceTranscript}
          />
        )}

        {phase === 'review' && parsed?.ok && (
          <>
            <DealerAiAnalysisCard
              parsed={parsed}
              onFieldsChange={handleFieldsChange}
            />
            <DealerAiSuggestedModels
              models={parsed.suggestedModels}
              selectedModelId={selectedModelId}
              onReserve={handleReserveModel}
            />
            <DealerAiReviewBar
              reservedModel={parsed.suggestedModels?.find((m) => m.id === selectedModelId)}
              onCreateLead={handleCreateLead}
              onPrepareOffer={handlePrepareOffer}
              onDraftReply={handleDraftReply}
              onEdit={handleEdit}
              onDiscard={handleDiscard}
              isExecuting={isExecuting}
            />
          </>
        )}

        {phase === 'followup' && result?.type === 'lead' && (
          <DealerAiLeadFollowUp
            result={result}
            parsed={parsed}
            lead={activeLead}
            onSave={handleLeadSave}
            onPrepareOffer={handlePrepareOffer}
            onDiscard={handleDiscard}
            onAddHistory={handleLeadHistory}
            isSaving={isSavingLead}
          />
        )}

        {phase === 'done' && result && result.type !== 'lead' && (
          <>
            <DealerAiResultPanel result={result} vehicleCard={vehicleCard} />
            <button type="button" className="dai-btn dai-btn--primary" onClick={handleDiscard}>
              Neuen Kundenwunsch erfassen
            </button>
          </>
        )}
      </main>

      {toast && <p className="dealer-ai-toast" role="status">{toast}</p>}
    </div>
  );
}
