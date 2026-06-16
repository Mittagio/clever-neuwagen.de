import { useEffect, useState } from 'react';

function useIsMobilePanel() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return mobile;
}

/**
 * Detailbereich für Verkaufschance – Bottom Sheet (Mobile) oder Modal (Desktop).
 */
export default function LeadDetailPanel({
  open,
  onClose,
  title,
  children,
  footer = null,
}) {
  const isMobile = useIsMobilePanel();
  const titleId = 'dai-lead-panel-title';

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  if (isMobile) {
    return (
      <div className="dai-sheet-backdrop" role="presentation" onClick={onClose}>
        <div
          className="dai-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dai-sheet__head">
            <h2 id={titleId} className="dai-sheet__title">{title}</h2>
            <button type="button" className="dai-sheet__close" onClick={onClose} aria-label="Schließen">
              ×
            </button>
          </div>
          <div className="dai-sheet__body">{children}</div>
          {footer && <div className="dai-sheet__foot">{footer}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="dai-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dai-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dai-modal__head">
          <h2 id={titleId} className="dai-modal__title">{title}</h2>
          <button type="button" className="dai-modal__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="dai-modal__body">{children}</div>
        {footer && <div className="dai-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
