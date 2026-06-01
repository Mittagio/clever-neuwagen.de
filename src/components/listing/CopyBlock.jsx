import { useState } from 'react';
import './CopyBlock.css';

export default function CopyBlock({ label, text, compact = false, onCopied }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
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
          className={`copy-block__btn${copied ? ' copy-block__btn--done' : ''}`}
          onClick={handleCopy}
        >
          {copied ? '✓ Kopiert' : 'Kopieren'}
        </button>
      </header>
      <pre className="copy-block__text">{text}</pre>
    </article>
  );
}
