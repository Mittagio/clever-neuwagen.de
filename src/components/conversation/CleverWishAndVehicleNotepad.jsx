import { useEffect, useRef } from 'react';
import './clever-conversation.css';

function NotepadSection({ heading = null, labels = [], variant = 'wish' }) {
  const prevCountRef = useRef(0);

  useEffect(() => {
    prevCountRef.current = labels.length;
  }, [labels.length]);

  if (!labels.length) return null;

  const prevCount = prevCountRef.current;

  return (
    <div className={`cc-notepad-section cc-notepad-section--${variant}`}>
      {heading && <p className="cc-notepad-section__heading">{heading}</p>}
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

  const wishHeading = null;

  return (
    <aside className="cc-dual-notepad" aria-label="Ihr Wunsch">
      {chapterTitle && (
        <p className="cc-dual-notepad__chapter">{chapterTitle}</p>
      )}
      {wishLabels.length > 0 && (
        <NotepadSection heading={wishHeading} labels={wishLabels} variant="wish" />
      )}
      {vehicleLabels.length > 0 && (
        <NotepadSection heading="Zum EV3 notiert" labels={vehicleLabels} variant="vehicle" />
      )}
    </aside>
  );
}
