import './clever-conversation.css';

/**
 * Kurzer Toast (max. ~1,5 s) – blockiert keine Inhalte.
 */
export default function CleverNotingFlash({ labels = [] }) {
  if (!labels.length) return null;

  const preview = labels.slice(0, 2).join(' · ');

  return (
    <div className="cc-note-toast cc-note-toast--enter" role="status" aria-live="polite">
      Notiert: {preview}
    </div>
  );
}
