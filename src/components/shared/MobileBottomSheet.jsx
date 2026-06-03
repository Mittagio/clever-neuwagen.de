import { useEffect, useState } from 'react';

function useIsMobileSheet() {
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
 * Mobile Bottom Sheet – einheitlich für Preis, Wünsche, Händlervergleich
 */
export default function MobileBottomSheet({
  open,
  onClose,
  title,
  titleId,
  children,
  footer = null,
  className = '',
  priority = 'normal',
}) {
  const isMobile = useIsMobileSheet();

  useEffect(() => {
    if (!open || !isMobile) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  if (!open || !isMobile) return null;

  const headingId = titleId ?? 'vd-sheet-title';
  const priorityClass = priority === 'high' ? ' vd-sheet-backdrop--high' : '';

  return (
    <div className={`vd-sheet-backdrop${priorityClass}`} role="presentation" onClick={onClose}>
      <div
        className={`vd-sheet${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vd-sheet__head">
          <h2 id={headingId} className="vd-sheet__title">{title}</h2>
          <button type="button" className="vd-sheet__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="vd-sheet__body">{children}</div>
        {footer && <div className="vd-sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}
