import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useCommunication } from '../context/CommunicationContext.jsx';
import SalesWishPicker from '../components/sales-advisor/SalesWishPicker.jsx';
import SalesLiveChips from '../components/sales-advisor/SalesLiveChips.jsx';
import SalesNeedsSummary from '../components/sales-advisor/SalesNeedsSummary.jsx';
import SalesResultsPodium from '../components/sales-advisor/SalesResultsPodium.jsx';
import SalesVehicleDetail from '../components/sales-advisor/SalesVehicleDetail.jsx';
import SalesQuickCompare from '../components/sales-advisor/SalesQuickCompare.jsx';
import SalesCommunicationCenter from '../components/sales-advisor/SalesCommunicationCenter.jsx';
import SalesAdvisorStatsBar from '../components/sales-advisor/SalesAdvisorStatsBar.jsx';
import SalesSelectedOffers, { getWishLabelsFromChipIds } from '../components/sales-advisor/SalesSelectedOffers.jsx';
import SalesCustomerRecordPanel from '../components/sales-advisor/SalesCustomerRecordPanel.jsx';
import { findSalesAdvisorMatches } from '../services/sales/salesAdvisorService.js';
import { createSalesShareSession } from '../services/sales/salesShareService.js';
import { recordSmartSalesAdvised, recordCompareOpened } from '../services/sales/salesAdvisorStats.js';
import {
  saveCustomerRecord,
  buildCustomerRecordPayload,
} from '../services/sales/customerRecordService.js';
import { mergeChipIds } from '../services/sales/conversationVoiceParser.js';
import '../components/sales-advisor/smartSales.css';

const STEPS = {
  WISHES: 'wishes',
  UNDERSTOOD: 'understood',
  RESULTS: 'results',
  DETAIL: 'detail',
  COMPARE: 'compare',
};

export default function SmartSalesPage() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { getCurrentSeller } = useCommunication();
  const seller = getCurrentSeller?.() ?? null;

  const [step, setStep] = useState(STEPS.WISHES);
  const [selectedChipIds, setSelectedChipIds] = useState([]);
  const [mileagePerYear, setMileagePerYear] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [compareSlugs, setCompareSlugs] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [shareSession, setShareSession] = useState(null);
  const [sentVia, setSentVia] = useState([]);
  const [savedRecord, setSavedRecord] = useState(null);

  const sellerName = seller?.name ?? conditions.contact?.name ?? 'Verkaufsberater';
  const dealerName = conditions.dealerName ?? 'Autohaus';
  const dealerPhone = conditions.contact?.phone ?? '';

  const wishLabels = useMemo(() => getWishLabelsFromChipIds(selectedChipIds), [selectedChipIds]);

  const compareMatches = useMemo(
    () => matches.filter((m) => compareSlugs.includes(m.slug)),
    [matches, compareSlugs],
  );

  const toggleChip = useCallback((chipId) => {
    setSelectedChipIds((prev) =>
      prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId],
    );
  }, []);

  const removeChip = useCallback((chipId) => {
    setSelectedChipIds((prev) => prev.filter((id) => id !== chipId));
  }, []);

  function handleVoiceParsed(parsed) {
    setVoiceTranscript(parsed.transcript ?? '');
    if (parsed.customerName) {
      setCustomer((c) => ({ ...c, name: parsed.customerName }));
    }
    if (parsed.mileagePerYear) setMileagePerYear(parsed.mileagePerYear);
    setSelectedChipIds((prev) => mergeChipIds(prev, parsed.chipIds));
  }

  function refreshShareSession(nextMatches, nextCompareSlugs) {
    const pool = nextCompareSlugs.length >= 2
      ? nextMatches.filter((m) => nextCompareSlugs.includes(m.slug))
      : nextMatches.slice(0, Math.max(3, nextCompareSlugs.length));
    if (!pool.length) {
      setShareSession(null);
      return;
    }
    setShareSession(createSalesShareSession({
      matches: pool,
      chipIds: selectedChipIds,
      customer,
      sellerName,
      dealerName,
    }));
  }

  function handleProceedToSummary() {
    if (selectedChipIds.length === 0) return;
    setStep(STEPS.UNDERSTOOD);
  }

  function handleFindVehicles() {
    const results = findSalesAdvisorMatches(selectedChipIds, {
      limit: 5,
      mileagePerYear,
    });
    const defaultCompare = results.slice(0, 3).map((m) => m.slug);
    setMatches(results);
    setCompareSlugs(defaultCompare);
    setActiveMatch(null);
    setStep(STEPS.RESULTS);
    recordSmartSalesAdvised();
    refreshShareSession(results, defaultCompare);
  }

  function handleSelectMatch(match) {
    setActiveMatch(match);
    setStep(STEPS.DETAIL);
  }

  function handleToggleCompare(slug) {
    setCompareSlugs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      refreshShareSession(matches, next);
      return next;
    });
  }

  function handleOpenCompare() {
    if (compareSlugs.length >= 2) {
      setStep(STEPS.COMPARE);
      recordCompareOpened();
    }
  }

  function handleShowCustomer(match) {
    setActiveMatch(match);
    setStep(STEPS.DETAIL);
  }

  function handleSentVia(channel) {
    setSentVia((prev) => (prev.includes(channel) ? prev : [...prev, channel]));
  }

  function handleSaveRecord() {
    const record = saveCustomerRecord(buildCustomerRecordPayload({
      customer,
      chipIds: selectedChipIds,
      wishLabels,
      selectedMatches: compareMatches.length ? compareMatches : matches.slice(0, 3),
      sentVia,
      shareUrl: shareSession?.url ?? '',
      sellerName,
      dealerName,
      nextStep: sentVia.length ? 'Rückmeldung abwarten' : 'Angebot versenden',
    }));
    setSavedRecord(record);
  }

  const showComm = shareSession && (step === STEPS.RESULTS || step === STEPS.COMPARE || step === STEPS.DETAIL);
  const showCustomerBar = step !== STEPS.WISHES;

  return (
    <div className="ss-page ss-page--conversation">
      <header className="ss-page__header">
        <Link to="/backend" className="ss-page__back" aria-label="Zurück zum Backend">←</Link>
        <div className="ss-page__header-text">
          <p className="ss-page__kicker">Gesprächsmodus</p>
          <h1 className="ss-page__title">Kundenberatung</h1>
          <p className="ss-page__dealer">{dealerName}</p>
        </div>
        <Link to="/sales" className="ss-page__alt-link">Klassisch</Link>
      </header>

      <SalesAdvisorStatsBar />

      <SalesLiveChips
        chipIds={selectedChipIds}
        onRemove={removeChip}
        transcript={voiceTranscript}
      />

      {showCustomerBar && (
        <section className="ss-customer-bar">
          <label className="ss-customer-field">
            <span>Kundenname</span>
            <input
              type="text"
              value={customer.name}
              onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
              placeholder="z. B. Herr Müller"
            />
          </label>
          <label className="ss-customer-field">
            <span>Telefon</span>
            <input
              type="tel"
              value={customer.phone}
              onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
              placeholder="WhatsApp"
            />
          </label>
          <label className="ss-customer-field">
            <span>E-Mail</span>
            <input
              type="email"
              value={customer.email}
              onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
              placeholder="optional"
            />
          </label>
        </section>
      )}

      <div className="ss-conversation-layout">
        <div className="ss-conversation-layout__main">
          {step === STEPS.WISHES && (
            <SalesWishPicker
              selectedIds={selectedChipIds}
              onToggle={toggleChip}
              onFind={handleProceedToSummary}
              onVoiceParsed={handleVoiceParsed}
            />
          )}

          {step === STEPS.UNDERSTOOD && (
            <SalesNeedsSummary
              chipIds={selectedChipIds}
              customer={customer}
              mileagePerYear={mileagePerYear}
              onConfirm={handleFindVehicles}
              onBack={() => setStep(STEPS.WISHES)}
            />
          )}

          {step === STEPS.RESULTS && (
            <>
              <button type="button" className="ss-page__step-back" onClick={() => setStep(STEPS.UNDERSTOOD)}>
                ← Bedarfsanalyse
              </button>
              <SalesResultsPodium
                matches={matches}
                customerName={customer.name}
                onSelect={handleSelectMatch}
                onToggleCompare={handleToggleCompare}
                onOpenCompare={handleOpenCompare}
                onShowCustomer={handleShowCustomer}
                compareSlugs={compareSlugs}
              />
            </>
          )}

          {step === STEPS.DETAIL && activeMatch && (
            <SalesVehicleDetail
              match={activeMatch}
              dealerName={dealerName}
              onBack={() => setStep(STEPS.RESULTS)}
            />
          )}

          {step === STEPS.COMPARE && (
            <>
              <button type="button" className="ss-page__step-back" onClick={() => setStep(STEPS.RESULTS)}>
                ← Zurück zu den Ergebnissen
              </button>
              <SalesQuickCompare matches={compareMatches} />
              <button type="button" className="ss-btn ss-btn--primary ss-btn--block ss-compare-create" onClick={handleSaveRecord}>
                Beratung speichern
              </button>
            </>
          )}
        </div>

        <aside className="ss-conversation-layout__side">
          <SalesSelectedOffers
            matches={matches}
            compareSlugs={compareSlugs}
            onRemove={handleToggleCompare}
          />
          {showComm && (
            <SalesCommunicationCenter
              matches={compareMatches.length >= 2 ? compareMatches : matches.slice(0, 4)}
              shareUrl={shareSession.url}
              customer={customer}
              sellerName={sellerName}
              dealerName={dealerName}
              dealerPhone={dealerPhone}
              wishLabels={wishLabels}
              onSent={handleSentVia}
            />
          )}
          {savedRecord && <SalesCustomerRecordPanel record={savedRecord} onClose={() => setSavedRecord(null)} />}
          {(step === STEPS.RESULTS || step === STEPS.DETAIL) && !savedRecord && (
            <button type="button" className="ss-btn ss-btn--secondary ss-btn--block" onClick={handleSaveRecord}>
              Kundenakte speichern
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
