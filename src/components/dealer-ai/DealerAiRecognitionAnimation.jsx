import { useEffect, useMemo, useState } from 'react';
import { buildRecognitionAnimationBuckets } from '../../services/dealerAiRecognitionInsight.js';
import './DealerAiRecognition.css';

const STEPS = [
  'Kundendaten werden erkannt …',
  'Wichtige Kundeninfos werden sortiert …',
  'Fahrzeugbedarf wird eingeordnet …',
  'Passende Modelle werden geprüft …',
];

const BUCKET_LABELS = {
  customer: 'Kunde',
  customerHelperNotes: 'Kundeninfos',
  vehicleWish: 'Fahrzeugwunsch',
  paymentWish: 'Konditionen',
  recommendation: 'Clever Empfehlung',
  board: 'Auf dem Tisch',
};

export default function DealerAiRecognitionAnimation({
  insight,
  onComplete,
  durationMs = 2400,
}) {
  const buckets = useMemo(() => buildRecognitionAnimationBuckets(insight), [insight]);
  const [stepIndex, setStepIndex] = useState(0);
  const [visibleChips, setVisibleChips] = useState([]);
  const [done, setDone] = useState(false);

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const allChips = useMemo(() => {
    const chips = [];
    for (const [bucket, items] of Object.entries(buckets)) {
      for (const label of items) {
        chips.push({ id: `${bucket}-${label}`, bucket, label });
      }
    }
    return chips;
  }, [buckets]);

  useEffect(() => {
    if (!insight) return undefined;

    if (reducedMotion) {
      const timer = setTimeout(() => onComplete?.(), 700);
      return () => clearTimeout(timer);
    }

    const stepTimer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % STEPS.length);
    }, 520);

    let chipIndex = 0;
    const chipTimer = setInterval(() => {
      if (chipIndex >= allChips.length) {
        clearInterval(chipTimer);
        return;
      }
      setVisibleChips((prev) => [...prev, allChips[chipIndex]]);
      chipIndex += 1;
    }, 180);

    const completeTimer = setTimeout(() => {
      setDone(true);
      onComplete?.();
    }, durationMs);

    return () => {
      clearInterval(stepTimer);
      clearInterval(chipTimer);
      clearTimeout(completeTimer);
    };
  }, [allChips, durationMs, insight, onComplete, reducedMotion]);

  if (!insight) return null;

  return (
    <section className="dai-recognition-anim" aria-live="polite" aria-busy={!done}>
      <div className="dai-recognition-anim__head">
        <span className="dai-recognition-anim__spark" aria-hidden>✦</span>
        <h2 className="dai-recognition-anim__title">Clever analysiert den Kundenwunsch …</h2>
        <p className="dai-recognition-anim__step">{STEPS[stepIndex]}</p>
        <div className="dai-recognition-anim__progress" aria-hidden>
          <span className="dai-recognition-anim__progress-bar" />
        </div>
      </div>

      {!reducedMotion && (
        <div className="dai-recognition-anim__stage">
          <div className="dai-recognition-anim__chips" aria-hidden>
            {visibleChips.map((chip) => (
              <span
                key={chip.id}
                className={`dai-recognition-anim__chip dai-recognition-anim__chip--${chip.bucket}`}
              >
                {chip.label}
              </span>
            ))}
          </div>

          <div className="dai-recognition-anim__buckets">
            {Object.entries(BUCKET_LABELS).map(([key, label]) => (
              <div key={key} className={`dai-recognition-anim__bucket dai-recognition-anim__bucket--${key}`}>
                <p className="dai-recognition-anim__bucket-label">{label}</p>
                <div className="dai-recognition-anim__bucket-slot" />
              </div>
            ))}
          </div>
        </div>
      )}

      {reducedMotion && (
        <ul className="dai-recognition-anim__reduced">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
