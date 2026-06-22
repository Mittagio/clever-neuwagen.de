import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import {
  applyDealerAiFields,
  suggestActionForPaymentType,
} from '../../services/dealerAiParser.js';
import { resolveDealerAiVehicleSuggestions } from '../../services/dealerAiVehicleSuggestions.js';
import { pipelineToLeadStatus } from '../../services/dealerAiLeadCrm.js';
import { executeDealerAiAction } from '../../services/dealerAiActions.js';
import DealerAiLeadFollowUp from '../../components/dealer-ai/DealerAiLeadFollowUp.jsx';
import CustomerOfferEditView from '../../components/dealer-ai/CustomerOfferEditView.jsx';
import { buildKundenaktePath, buildParsedFromLead } from '../../services/leadAkteEntry.js';
import { recordRecentCustomerOpen } from '../../services/crm/customerSearchService.js';
import { buildAddVehicleContextFromLead } from '../../services/customerAddVehicleFlow.js';
import { setActiveSalesChanceId } from '../../services/sales/activeSalesChanceStore.js';
import {
  attachPdfToOffer,
  createOnlineLinkForOffer,
  createVehicleOfferFromCard,
  getVehicleOffer,
  markOfferSent,
  mergeVehicleOffersPatch,
  recordOfferOpened,
  VEHICLE_OFFER_HISTORY,
  VEHICLE_OFFER_STATUS,
} from '../../services/vehicleOffer.js';
import { formatVehicleCardTitle } from '../../services/customerAkte.js';
import { phoneTelHref } from '../../services/dealerAiLeadCrm.js';
import '../DealerAIPage.css';
import './BackendLeadAktePage.css';

export default function BackendLeadAktePage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { leads, updateLead, addHistory } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const lead = leads.find((l) => l.id === leadId) ?? null;
  const [parsed, setParsed] = useState(null);
  const [phase, setPhase] = useState('followup');
  const [offerEditCard, setOfferEditCard] = useState(null);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  function navigateToAddVehicle(sourceLead = lead) {
    if (!sourceLead) return;
    navigate('/verkaufsassistent', {
      state: {
        addVehicleContext: buildAddVehicleContextFromLead(sourceLead, {
          returnPath: buildKundenaktePath(sourceLead.id),
        }),
      },
    });
  }

  useEffect(() => {
    const msg = location.state?.toast;
    if (!msg) return;
    showToast(msg);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.toast, location.pathname, navigate, showToast]);

  const enrichWithSuggestions = useCallback((nextParsed) => {
    if (!nextParsed?.ok) return nextParsed;
    return {
      ...nextParsed,
      suggestedModels: resolveDealerAiVehicleSuggestions(nextParsed.fields, conditions, []),
    };
  }, [conditions]);

  useEffect(() => {
    if (!lead) {
      setParsed(null);
      return;
    }
    setActiveSalesChanceId(lead.id);
    recordRecentCustomerOpen(lead);
    setParsed(buildParsedFromLead(lead, enrichWithSuggestions));
  }, [lead, enrichWithSuggestions]);

  function handleLeadSave(patch, meta = {}) {
    if (!leadId) return;
    setIsSavingLead(true);
    updateLead(leadId, patch);
    if (!meta.silent && meta.historyText) {
      addHistory(leadId, meta.historyText, meta.historyType ?? 'note');
    }
    if (meta.addFollowupHistory !== false && patch.crm?.nextStepLabel) {
      addHistory(leadId, `Nachfassen geplant: ${patch.crm.nextStepLabel}`, 'followup');
    }
    setIsSavingLead(false);
    if (!meta.silent) showToast('Gespeichert');
  }

  function handleLeadHistory(text, type = 'note', options = {}) {
    if (!leadId) return;
    addHistory(leadId, text, type);
    if (options.pipelineStatusId) {
      updateLead(leadId, {
        status: pipelineToLeadStatus(options.pipelineStatusId),
        crm: {
          ...(lead?.crm ?? {}),
          pipelineStatusId: options.pipelineStatusId,
        },
      });
    }
    if (!options.silent) showToast('Eintrag in Historie gespeichert');
  }

  function handlePrepareOffer(reservedModel) {
    if (!parsed?.ok || !leadId) return;
    let nextParsed = parsed;
    if (reservedModel) {
      nextParsed = enrichWithSuggestions(applyDealerAiFields(parsed, {
        model: reservedModel.name?.replace(/^Kia\s+/i, '') ?? parsed.fields?.model,
        brand: 'Kia',
        modelId: reservedModel.modelKey ?? reservedModel.id,
        trimLabel: reservedModel.trimLabel ?? parsed.fields?.trimLabel,
      }));
      setParsed(nextParsed);
    }
    const actionId = suggestActionForPaymentType(nextParsed.fields.paymentType ?? 'unknown');
    try {
      executeDealerAiAction(actionId === 'create_sales_opportunity' ? 'create_offer' : actionId, nextParsed, {
        conditions,
        addOffer,
        getExistingCodes,
        leads,
        addLead: () => {},
        updateLead,
        linkLead,
        selectedModelIds: [],
        carryCustomer: null,
      });
      showToast('Angebot vorbereitet');
    } catch (err) {
      showToast(err.message ?? 'Angebot konnte nicht erstellt werden');
    }
  }

  function handleBack() {
    navigate('/backend/neue-anfragen');
  }

  function handleOpenOfferEdit(card) {
    setOfferEditCard(card);
    setPhase('offer-edit');
  }

  function handleBackFromOffer() {
    setOfferEditCard(null);
    setPhase('followup');
  }

  function persistVehicleOffer(cardId, nextOffer, historyMeta = null) {
    if (!leadId || !cardId) return;
    const vehicleOffers = mergeVehicleOffersPatch(lead ?? {}, cardId, nextOffer);
    updateLead(leadId, {
      crm: {
        ...(lead?.crm ?? {}),
        vehicleOffers,
      },
    });
    if (historyMeta?.text) {
      addHistory(leadId, historyMeta.text, historyMeta.type ?? 'note');
    }
  }

  async function handleOfferUploadPdf(file) {
    if (!offerEditCard) return;
    const base = getVehicleOffer(lead ?? {}, offerEditCard);
    const next = await attachPdfToOffer(base, file);
    persistVehicleOffer(offerEditCard.id, next, {
      text: VEHICLE_OFFER_HISTORY.pdf_uploaded,
      type: 'offer_pdf',
    });
    showToast('Angebot hinterlegt');
  }

  function handleOfferCreateLink() {
    if (!offerEditCard) return;
    const base = getVehicleOffer(lead ?? {}, offerEditCard);
    const title = formatVehicleCardTitle(offerEditCard);
    const next = createOnlineLinkForOffer(base, {
      modelName: title,
      customerName: lead?.contact?.name ?? '',
    });
    persistVehicleOffer(offerEditCard.id, next, {
      text: VEHICLE_OFFER_HISTORY.link_created,
      type: 'offer_link',
    });
    showToast('Link bereit');
  }

  function handleOfferDeletePdf() {
    if (!offerEditCard) return;
    const base = getVehicleOffer(lead ?? {}, offerEditCard);
    persistVehicleOffer(offerEditCard.id, {
      ...base,
      status: VEHICLE_OFFER_STATUS.DRAFT,
      pdf: null,
      onlineLink: null,
      sentVia: null,
      sentAt: null,
    });
    showToast('PDF entfernt');
  }

  function handleOfferMarkSent(via) {
    if (!offerEditCard) return;
    const base = getVehicleOffer(lead ?? {}, offerEditCard);
    if (!base.onlineLink?.url) return;
    const next = markOfferSent(base, via);
    const historyMap = {
      email: { text: VEHICLE_OFFER_HISTORY.sent_email, type: 'offer_sent_email' },
      whatsapp: { text: VEHICLE_OFFER_HISTORY.sent_whatsapp, type: 'offer_sent_whatsapp' },
      copy: { text: 'Link kopiert – bereit zum Teilen', type: 'offer_sent' },
    };
    persistVehicleOffer(offerEditCard.id, next, historyMap[via] ?? null);
    if (via !== 'copy') showToast('Angebot gesendet');
  }

  function handleOfferStatusChange(statusId) {
    if (!offerEditCard) return;
    const base = getVehicleOffer(lead ?? {}, offerEditCard);
    let next = { ...base, status: statusId };
    if (statusId === VEHICLE_OFFER_STATUS.OPENED) {
      next = recordOfferOpened(base);
    }
    const historyMap = {
      [VEHICLE_OFFER_STATUS.ACCEPTED]: { text: VEHICLE_OFFER_HISTORY.accepted, type: 'offer_accepted' },
      [VEHICLE_OFFER_STATUS.REJECTED]: { text: VEHICLE_OFFER_HISTORY.rejected, type: 'offer_rejected' },
      [VEHICLE_OFFER_STATUS.OPENED]: { text: VEHICLE_OFFER_HISTORY.opened, type: 'offer_opened' },
    };
    persistVehicleOffer(offerEditCard.id, next, historyMap[statusId] ?? null);
    showToast('Status aktualisiert');
  }

  function handleOfferSave() {
    if (!offerEditCard) return;
    persistVehicleOffer(offerEditCard.id, getVehicleOffer(lead ?? {}, offerEditCard));
    showToast('Gespeichert');
  }

  function handleUnterlagenSave(unterlagen, historyText, historyType = 'unterlagen') {
    if (!leadId) return;
    updateLead(leadId, {
      crm: {
        ...(lead?.crm ?? {}),
        cleverUnterlagen: unterlagen,
      },
    });
    if (historyText) {
      addHistory(leadId, historyText, historyType);
    }
  }

  const activeOfferEdit = offerEditCard
    ? getVehicleOffer(lead ?? {}, offerEditCard)
    : null;

  if (!lead) {
    return (
      <div className="backend-lead-akte backend-lead-akte--empty">
        <p>Verkaufschance nicht gefunden.</p>
        <Link to="/backend/neue-anfragen">Zurück zu neuen Anfragen</Link>
      </div>
    );
  }

  return (
    <div className="backend-lead-akte dealer-ai-page">
      <main className={`dealer-ai-main${phase === 'offer-edit' ? ' dealer-ai-main--configure' : ' dealer-ai-main--akte'}`}>
        {phase === 'followup' && parsed && (
          <DealerAiLeadFollowUp
            result={{ type: 'lead', leadId }}
            parsed={parsed}
            lead={lead}
            leads={leads}
            isFresh={false}
            onEnterDetail={() => navigate(`/backend/verkaufschancen?leadId=${encodeURIComponent(leadId)}`)}
            onNewWish={() => navigateToAddVehicle(lead)}
            onStartNewWish={() => navigateToAddVehicle(lead)}
            onSave={handleLeadSave}
            onPrepareOffer={handlePrepareOffer}
            onOpenOfferEdit={handleOpenOfferEdit}
            onReturnToReview={() => navigate('/verkaufsassistent')}
            onDiscard={handleBack}
            onAddHistory={handleLeadHistory}
            isSaving={isSavingLead}
          />
        )}

        {phase === 'offer-edit' && offerEditCard && (
          <CustomerOfferEditView
            card={offerEditCard}
            customerName={lead?.contact?.name ?? ''}
            phone={lead?.contact?.phone ?? ''}
            email={lead?.contact?.email ?? ''}
            referenceCode={lead?.referenceCode ?? lead?.offerCode ?? null}
            deliveryNote={lead?.deliveryTime ?? lead?.wish?.desiredDeliveryDate ?? ''}
            offer={activeOfferEdit ?? createVehicleOfferFromCard(offerEditCard)}
            history={lead?.history ?? []}
            lead={lead}
            telHref={phoneTelHref(lead?.contact?.phone ?? '')}
            onBack={handleBackFromOffer}
            onSave={handleOfferSave}
            onSaveUnterlagen={handleUnterlagenSave}
            onUploadPdf={handleOfferUploadPdf}
            onCreateLink={handleOfferCreateLink}
            onDeletePdf={handleOfferDeletePdf}
            onMarkSent={handleOfferMarkSent}
            onStatusChange={handleOfferStatusChange}
            isSaving={isSavingLead}
          />
        )}
      </main>
      {toast && <p className="dealer-ai-toast" role="status">{toast}</p>}
    </div>
  );
}
