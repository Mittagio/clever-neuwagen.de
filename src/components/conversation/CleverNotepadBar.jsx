import { useEffect, useRef } from 'react';
import { getNotepadHeading } from '../../services/consultation/consultationHappyPath.js';
import './clever-conversation.css';

/**
 * Sticky Notizleiste – nur neue Einträge erscheinen sanft.
 */
export default function CleverNotepadBar({ labels = [] }) {
  const prevCountRef = useRef(0);

  useEffect(() => {
    prevCountRef.current = labels.length;
  }, [labels.length]);

  if (!labels.length) return null;

  const prevCount = prevCountRef.current;

  return (
    <aside className="cc-notepad" aria-label="Was Clever über Sie weiß">
      <p className="cc-notepad__heading">{getNotepadHeading(labels.length)}</p>
      <ul className="cc-notepad__chips">
        {labels.map((label, index) => {
          const isNew = index >= prevCount;
          return (
            <li
              key={label}
              className={`cc-notepad__chip${isNew ? ' cc-notepad__chip--new' : ''}`}
              style={isNew ? { animationDelay: `${(index - prevCount) * 120}ms` } : undefined}
            >
              <span className="cc-notepad__check" aria-hidden>✓</span>
              {label}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
