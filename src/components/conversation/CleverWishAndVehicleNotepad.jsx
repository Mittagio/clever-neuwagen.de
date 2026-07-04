import { useEffect, useRef } from 'react';
import { getNotepadHeading } from '../../services/consultation/consultationHappyPath.js';
import './clever-conversation.css';

function NotepadSection({ heading, labels = [], variant = 'wish' }) {
  const prevCountRef = useRef(0);

  useEffect(() => {
    prevCountRef.current = labels.length;
  }, [labels.length]);

  if (!labels.length) return null;

  const prevCount = prevCountRef.current;

  return (
    <div className={`cc-notepad-section cc-notepad-section--${variant}`}>
      <p className="cc-notepad-section__heading">{heading}</p>
      <ul className="cc-notepad__chips">
        {labels.map((label, index) => {
          const isNew = index >= prevCount;
          return (
            <li
              key={`${variant}-${label}`}
              className={`cc-notepad__chip${isNew ? ' cc-notepad__chip--new' : ''}`}
              style={isNew ? { animationDelay: `${(index - prevCount) * 120}ms` } : undefined}
            >
              <span className="cc-notepad__check" aria-hidden>✓</span>
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Getrennte Notizleisten: Wunschprofil (Welt 1) + EV3-Notizen (Welt 2).
 */
export default function CleverWishAndVehicleNotepad({
  wishLabels = [],
  vehicleLabels = [],
  chapterTitle = null,
}) {
  if (!wishLabels.length && !vehicleLabels.length && !chapterTitle) return null;

  const wishHeading = wishLabels.length
    ? (wishLabels.length < 5 ? 'Ihr Wunschprofil' : 'Ihr Wunschprofil')
    : null;

  return (
    <aside className="cc-dual-notepad" aria-label="Clever Notizen">
      {chapterTitle && (
        <p className="cc-dual-notepad__chapter">{chapterTitle}</p>
      )}
      {wishHeading && (
        <NotepadSection heading={wishHeading} labels={wishLabels} variant="wish" />
      )}
      {vehicleLabels.length > 0 && (
        <NotepadSection heading="Zum EV3 notiert" labels={vehicleLabels} variant="vehicle" />
      )}
    </aside>
  );
}
