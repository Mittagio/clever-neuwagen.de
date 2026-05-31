import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import {
  ADVISOR_BODY_OPTIONS,
  ADVISOR_DEFAULTS,
  ADVISOR_FUEL_OPTIONS,
  ADVISOR_HOUSEHOLD_OPTIONS,
  ADVISOR_MILEAGE_OPTIONS,
  ADVISOR_WISHES,
} from '../data/advisorCatalog.js';
import { getAdvisorRecommendations, formatAdvisorRate } from '../services/advisorEngine.js';
import { recordAdvisorSession } from '../services/advisorAnalytics.js';
import {
  recordIntelligenceAdvisorSession,
  recordIntelligenceComparison,
  recordIntelligenceSearch,
} from '../services/intelligenceAnalytics.js';
import { parseAdvisorUrlProfile } from '../services/landingAdvisorBridge.js';
import { createOfferFromAdvisor, buildOfferUrl } from '../logic/offerService.js';
import { createOrLinkLeadForOffer } from '../logic/offerLeadService.js';
import AdvisorResultCard from '../components/advisor/AdvisorResultCard.jsx';
import AdvisorPodium from '../components/advisor/AdvisorPodium.jsx';
import AdvisorCompareView from '../components/advisor/AdvisorCompareView.jsx';
import AdvisorOfferStep from '../components/advisor/AdvisorOfferStep.jsx';
import AdvisorContactStep, { AdvisorSuccessStep } from '../components/advisor/AdvisorContactStep.jsx';
import CustomerFlowProgress from '../components/advisor/CustomerFlowProgress.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import './AdvisorPage.css';

const TOTAL_STEPS = 6;

const INITIAL_PROFILE = {
  mileage: '',
  household: '',
  desiredRate: ADVISOR_DEFAULTS.desiredRate,
  fuelPreference: '',
  bodyType: '',
  wishes: [],
};

function getMileagePerYear(profile) {
  const opt = ADVISOR_MILEAGE_OPTIONS.find((o) => o.id === profile.mileage);
  return opt?.value ?? ADVISOR_DEFAULTS.mileagePerYear;
}

function mergeLandingProfile(searchParams) {
  const partial = parseAdvisorUrlProfile(searchParams);
  return {
    ...INITIAL_PROFILE,
    ...partial,
    desiredRate: partial.desiredRate ?? INITIAL_PROFILE.desiredRate,
    wishes: partial.wishes ?? INITIAL_PROFILE.wishes,
  };
}

function firstIncompleteStep(profile) {
  if (!profile.mileage) return 1;
  if (!profile.household) return 2;
  if (profile.desiredRate < 150) return 3;
  if (!profile.fuelPreference) return 4;
  if (!profile.bodyType) return 5;
  return 6;
}

function isProfileCompleteForResults(profile) {
  return !!profile.mileage
    && !!profile.household
    && profile.desiredRate >= 150
    && !!profile.fuelPreference
    && !!profile.bodyType;
}

export default function AdvisorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { leads, addLead, updateLead } = useLeads();
  const { offers, addOffer, linkLead } = useOffers();
  const {
    isLoggedIn,
    email: sessionEmail,
    customerData,
    registerOffer,
    saveComparison,
    saveProfile,
    registerTestDrive,
    loginWithEmail,
  } = useCustomerAuth();

  const autoStart = searchParams.get('start') === '1';
  const landingQuery = searchParams.get('q') ?? '';
  const landingProfile = useMemo(
    () => (autoStart ? mergeLandingProfile(searchParams) : INITIAL_PROFILE),
    [autoStart, searchParams],
  );

  const [phase, setPhase] = useState(autoStart ? 'wizard' : 'intro');
  const [flowStep, setFlowStep] = useState(autoStart ? 'beratung' : null);
  const [step, setStep] = useState(() => (autoStart ? firstIncompleteStep(landingProfile) : 1));
  const [profile, setProfile] = useState(landingProfile);
  const autoResultsRan = useRef(false);
  const [recommendations, setRecommendations] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [activeRecId, setActiveRecId] = useState(null);
  const [selectedRec, setSelectedRec] = useState(null);
  const [createdOffer, setCreatedOffer] = useState(null);
  const [wantTestDrive, setWantTestDrive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const dealerContact = conditions.contact ?? {};
  const termMonths = ADVISOR_DEFAULTS.termMonths;
  const mileagePerYear = getMileagePerYear(profile);

  const compareItems = useMemo(
    () => recommendations?.filter((r) => compareIds.includes(r.id)) ?? [],
    [recommendations, compareIds],
  );

  useEffect(() => {
    if (!autoStart || autoResultsRan.current) return;
    if (!isProfileCompleteForResults(landingProfile)) return;

    autoResultsRan.current = true;
    const results = getAdvisorRecommendations(landingProfile, conditions);
    const topThree = results.slice(0, 3).map((r) => r.id);
    setRecommendations(results);
    setCompareIds(topThree);
    setActiveRecId(results[0]?.id ?? null);
    recordAdvisorSession(landingProfile, results);
    recordIntelligenceAdvisorSession(landingProfile, results, {
      termMonths: ADVISOR_DEFAULTS.termMonths,
    });
    if (landingQuery) {
      recordIntelligenceSearch(landingQuery, { source: 'landing' });
    }
    setFlowStep('beratung');
    setPhase('results');
  }, [autoStart, landingProfile, conditions, landingQuery]);

  const initialContact = useMemo(() => ({
    name: customerData?.profile?.name ?? '',
    email: sessionEmail ?? '',
    phone: customerData?.profile?.phone ?? dealerContact.phone ?? '',
  }), [customerData, sessionEmail, dealerContact.phone]);

  function update(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  function toggleWish(id) {
    setProfile((prev) => ({
      ...prev,
      wishes: prev.wishes.includes(id)
        ? prev.wishes.filter((w) => w !== id)
        : [...prev.wishes, id],
    }));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  function canProceed() {
    if (step === 1) return !!profile.mileage;
    if (step === 2) return !!profile.household;
    if (step === 3) return profile.desiredRate >= 150;
    if (step === 4) return !!profile.fuelPreference;
    if (step === 5) return !!profile.bodyType;
    return true;
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      if (!flowStep) setFlowStep('beratung');
      return;
    }
    const results = getAdvisorRecommendations(profile, conditions);
    const topThree = results.slice(0, 3).map((r) => r.id);
    setRecommendations(results);
    setCompareIds(topThree);
    setActiveRecId(results[0]?.id ?? null);
    recordAdvisorSession(profile, results);
    recordIntelligenceAdvisorSession(profile, results, { termMonths: ADVISOR_DEFAULTS.termMonths });
    setFlowStep('beratung');
    setPhase('results');
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
    else {
      setPhase('intro');
      setFlowStep(null);
    }
  }

  function selectPodiumRec(id) {
    setActiveRecId(id);
    requestAnimationFrame(() => {
      document.getElementById(`adv-result-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function toggleCompare(id) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleCompareRemove(id) {
    setCompareIds((prev) => {
      const next = prev.filter((x) => x !== id);
      if (next.length < 2) {
        setFlowStep('beratung');
        setPhase('results');
      }
      return next;
    });
  }

  function startCompare() {
    const ids = compareIds.length < 2 && recommendations?.length >= 2
      ? recommendations.slice(0, 3).map((r) => r.id)
      : compareIds;
    if (compareIds.length < 2 && recommendations?.length >= 2) {
      setCompareIds(ids);
    }
    const items = recommendations?.filter((r) => ids.includes(r.id)) ?? [];
    if (items.length >= 2) {
      recordIntelligenceComparison(items, { source: 'advisor' });
    }
    setFlowStep('vergleich');
    setPhase('compare');
    if (isLoggedIn) {
      saveComparison(recommendations, profile);
    }
  }

  function selectForOffer(rec) {
    setSelectedRec(rec);
    setFlowStep('angebot');
    setPhase('offer');
  }

  function goToContact() {
    setFlowStep('kontakt');
    setPhase('contact');
  }

  function backFromOffer() {
    if (compareItems.length >= 2) {
      setFlowStep('vergleich');
      setPhase('compare');
    } else {
      setFlowStep('beratung');
      setPhase('results');
    }
  }

  function handleQuickOffer(rec) {
    selectForOffer(rec);
  }

  async function handleFinalize({ name, email, phone, wantTestDrive: testDrive }) {
    if (!selectedRec || isSubmitting) return;
    setIsSubmitting(true);
    setWantTestDrive(testDrive);

    const customerPayload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      termMonths,
      mileagePerYear,
      downPayment: ADVISOR_DEFAULTS.downPayment,
      desiredRate: profile.desiredRate,
    };

    if (!isLoggedIn && email) {
      loginWithEmail(email);
    }

    saveProfile({ name: customerPayload.name, phone: customerPayload.phone }, customerPayload.email);

    const offer = createOfferFromAdvisor(
      customerPayload,
      selectedRec,
      conditions,
      offers,
    );
    offer.status = 'versendet';

    addOffer(offer);

    const { lead, leadId, isNew } = createOrLinkLeadForOffer(offer, leads);
    if (isNew) addLead({ ...lead, source: 'advisor' });
    else updateLead(leadId, { ...lead, source: 'advisor' });
    linkLead(offer.code, leadId);

    registerOffer(offer, customerPayload.email);

    if (testDrive) {
      registerTestDrive(selectedRec, customerPayload, conditions.dealerName, customerPayload.email);
    }

    setCreatedOffer(offer);
    setFlowStep('kontakt');
    setPhase('success');
    setIsSubmitting(false);
    showToast(`Angebot ${offer.code} erstellt`);
  }

  const showFlowProgress = flowStep && phase !== 'intro';

  return (
    <div className="adv-page">
      <header className="adv-header">
        <Link to="/" className="adv-header__back">← Zurück</Link>
        <p className="adv-header__kicker">KI-Kaufberater</p>
        <h1 className="adv-header__title">Welches Auto passt zu mir?</h1>
        <p className="adv-header__sub">
          Von der Beratung bis zum Angebot – alles in einem Flow, ohne doppelte Eingaben.
        </p>
        {phase === 'intro' && (
          <button
            type="button"
            className="adv-intro-btn"
            onClick={() => { setPhase('wizard'); setFlowStep('beratung'); }}
          >
            KI-Beratung starten
          </button>
        )}
      </header>

      {showFlowProgress && (
        <CustomerFlowProgress currentStep={flowStep} completed={phase === 'success'} />
      )}

      <main className="adv-main">
        {phase === 'wizard' && (
          <>
            <div className="adv-progress" aria-hidden="true">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div
                  key={i}
                  className={`adv-progress__dot${i + 1 === step ? ' is-active' : ''}${i + 1 < step ? ' is-done' : ''}`}
                />
              ))}
            </div>

            <div className="adv-step">
              {step === 1 && (
                <>
                  <p className="adv-step__title">Schritt 1 · Fahrprofil</p>
                  <h2 className="adv-step__question">Wie viele Kilometer fahren Sie pro Jahr?</h2>
                  <div className="adv-options">
                    {ADVISOR_MILEAGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`adv-option${profile.mileage === opt.id ? ' is-active' : ''}`}
                        onClick={() => update('mileage', opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <p className="adv-step__title">Schritt 2 · Haushalt</p>
                  <h2 className="adv-step__question">Wer fährt das Fahrzeug?</h2>
                  <div className="adv-options adv-options--grid">
                    {ADVISOR_HOUSEHOLD_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`adv-option${profile.household === opt.id ? ' is-active' : ''}`}
                        onClick={() => update('household', opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <p className="adv-step__title">Schritt 3 · Budget</p>
                  <h2 className="adv-step__question">Monatliche Wunschrate</h2>
                  <div className="adv-budget">
                    <p className="adv-budget__value">{formatAdvisorRate(profile.desiredRate)}</p>
                    <div className="adv-budget__range-labels">
                      <span>150 €</span>
                      <span>1.000 €</span>
                    </div>
                    <input
                      type="range"
                      className="adv-budget__slider"
                      min={150}
                      max={1000}
                      step={10}
                      value={profile.desiredRate}
                      onChange={(e) => update('desiredRate', Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className="adv-budget__input"
                      min={150}
                      max={1000}
                      step={10}
                      value={profile.desiredRate}
                      onChange={(e) => update('desiredRate', Number(e.target.value) || 150)}
                      aria-label="Wunschrate frei eingeben"
                    />
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <p className="adv-step__title">Schritt 4 · Antrieb</p>
                  <h2 className="adv-step__question">Welcher Antrieb interessiert Sie?</h2>
                  <div className="adv-options adv-options--grid">
                    {ADVISOR_FUEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`adv-option${profile.fuelPreference === opt.id ? ' is-active' : ''}`}
                        onClick={() => update('fuelPreference', opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <p className="adv-step__title">Schritt 5 · Fahrzeugart</p>
                  <h2 className="adv-step__question">Welche Fahrzeugart suchen Sie?</h2>
                  <div className="adv-options adv-options--grid">
                    {ADVISOR_BODY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`adv-option${profile.bodyType === opt.id ? ' is-active' : ''}`}
                        onClick={() => update('bodyType', opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 6 && (
                <>
                  <p className="adv-step__title">Schritt 6 · Weitere Wünsche</p>
                  <h2 className="adv-step__question">Was ist Ihnen wichtig?</h2>
                  <div className="adv-wishes">
                    {ADVISOR_WISHES.map((wish) => {
                      const isOn = profile.wishes.includes(wish.id);
                      return (
                        <button
                          key={wish.id}
                          type="button"
                          className={`adv-wish${isOn ? ' is-active' : ''}`}
                          onClick={() => toggleWish(wish.id)}
                        >
                          <span className="adv-wish__box">{isOn ? '✓' : ''}</span>
                          {wish.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <nav className="adv-nav">
                <button type="button" className="adv-nav__btn adv-nav__btn--back" onClick={handleBack}>
                  Zurück
                </button>
                <button
                  type="button"
                  className="adv-nav__btn adv-nav__btn--next"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {step === TOTAL_STEPS ? 'Empfehlungen anzeigen' : 'Weiter'}
                </button>
              </nav>
            </div>
          </>
        )}

        {phase === 'results' && recommendations && (
          <section className="adv-results">
            <AdvisorPodium
              items={recommendations}
              dealerId={conditions.dealerId}
              activeId={activeRecId}
              onSelect={selectPodiumRec}
              onCompareAll={startCompare}
            />

            <header className="adv-results-head">
              <h2>Alle Empfehlungen im Detail</h2>
              <p>
                Basierend auf {formatAdvisorRate(profile.desiredRate)}/Monat · {conditions.dealerName}
              </p>
            </header>

            <div className="adv-results-list">
              {recommendations.map((rec) => (
                <AdvisorResultCard
                  key={rec.id}
                  rec={rec}
                  dealerId={conditions.dealerId}
                  dealerName={conditions.dealerName}
                  dealerEmail={dealerContact.email}
                  dealerPhone={dealerContact.phone}
                  inCompare={compareIds.includes(rec.id)}
                  onToggleCompare={toggleCompare}
                  onRequestOffer={handleQuickOffer}
                  onRequestTestDrive={handleQuickOffer}
                  flowMode
                />
              ))}
            </div>

            <LegalDisclaimer className="adv-disclaimer" />

            <button
              type="button"
              className="adv-nav__btn adv-nav__btn--back"
              style={{ marginTop: 'var(--space-lg)', width: '100%' }}
              onClick={() => { setPhase('wizard'); setStep(1); setFlowStep('beratung'); }}
            >
              Beratung wiederholen
            </button>
          </section>
        )}

        {phase === 'compare' && recommendations && compareItems.length >= 2 && (
          <>
            <AdvisorCompareView
              items={compareItems}
              dealerId={conditions.dealerId}
              dealerName={conditions.dealerName}
              dealerPhone={dealerContact.phone}
              onBack={() => { setFlowStep('beratung'); setPhase('results'); }}
              onRemove={handleCompareRemove}
              onSelectForOffer={selectForOffer}
            />
            <LegalDisclaimer className="adv-disclaimer" />
          </>
        )}

        {phase === 'offer' && selectedRec && (
          <AdvisorOfferStep
            rec={selectedRec}
            dealerId={conditions.dealerId}
            dealerName={conditions.dealerName}
            termMonths={termMonths}
            mileagePerYear={mileagePerYear}
            onBack={backFromOffer}
            onContinue={goToContact}
          />
        )}

        {phase === 'contact' && selectedRec && (
          <AdvisorContactStep
            rec={{ ...selectedRec, dealerName: conditions.dealerName }}
            initialContact={initialContact}
            onBack={() => { setFlowStep('angebot'); setPhase('offer'); }}
            onSubmit={handleFinalize}
            isSubmitting={isSubmitting}
          />
        )}

        {phase === 'success' && createdOffer && (
          <AdvisorSuccessStep
            offer={createdOffer}
            offerUrl={buildOfferUrl(createdOffer.code)}
            wantTestDrive={wantTestDrive}
            onGoOffer={() => navigate(`/offer/${createdOffer.code}`)}
            onGoAccount={() => navigate('/kunde')}
          />
        )}
      </main>

      {phase === 'results' && compareIds.length >= 2 && (
        <footer className="adv-compare-bar">
          <p>{compareIds.length} im Vergleich</p>
          <button type="button" onClick={startCompare}>
            Vergleich starten
          </button>
        </footer>
      )}

      {toast && <p className="adv-toast" role="status">{toast}</p>}
    </div>
  );
}
