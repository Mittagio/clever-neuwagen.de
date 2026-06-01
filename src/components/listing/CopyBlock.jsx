import { useState } from 'react';
import './CopyBlock.css';

export default function CopyBlock({
  label,
  text,
  compact = false,
  onCopied,
  disabled = false,
  disabledReason = 'Kopieren nicht verfügbar',
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      onCopied?.();
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onCopied?.();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className={`copy-block${compact ? ' copy-block--compact' : ''}`}>
      <header className="copy-block__head">
        <h3 className="copy-block__label">{label}</h3>
        <button
          type="button"
          className={`copy-block__btn${copied ? ' copy-block__btn--done' : ''}${disabled ? ' copy-block__btn--disabled' : ''}`}
          onClick={handleCopy}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          {disabled ? 'Gesperrt' : (copied ? '✓ Kopiert' : 'Kopieren')}
        </button>
      </header>
      <pre className="copy-block__text">{text}</pre>
    </article>
  );
}
