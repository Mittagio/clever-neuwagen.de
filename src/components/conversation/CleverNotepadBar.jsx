import { useEffect, useMemo, useRef } from 'react';
import { buildWishProfilePresentation } from '../../services/consultation/consultationOfferHandoff.js';
import CleverWishProfile from './CleverWishProfile.jsx';
import './clever-conversation.css';

/**
 * Sticky Notizleiste – kompaktes Wunschprofil statt Chip-Checkliste.
 */
export default function CleverNotepadBar({ labels = [], needProfile = {} }) {
  const prevCountRef = useRef(0);
  const profile = useMemo(
    () => buildWishProfilePresentation(needProfile, labels),
    [needProfile, labels],
  );

  useEffect(() => {
    prevCountRef.current = labels.length;
  }, [labels.length]);

  if (!profile.lines.length) return null;

  const isNew = labels.length > prevCountRef.current;

  return (
    <aside
      className={`cc-notepad${isNew ? ' cc-notepad--updated' : ''}`}
      aria-label="Ihr Wunschprofil"
    >
      <CleverWishProfile profile={profile} compact />
    </aside>
  );
}
