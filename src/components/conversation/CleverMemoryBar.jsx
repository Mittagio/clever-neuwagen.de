import './clever-conversation.css';

function iconForLabel(label = '') {
  const t = String(label ?? '').toLowerCase();
  if (/^elektro$|plug-in|hybrid|benzin|diesel/.test(t)) return '⚡';
  if (/^ev\d|sportage|ceed|niro|picanto|sorento|carnival/.test(t)) return '🚗';
  if (/leasing|finanz|kauf/.test(t) || /budget/.test(t) || /€\/monat/.test(t)) return '💶';
  if (/monate|km/.test(t)) return '📅';
  if (/anhäng|anhaeng|ahk|kupplung|zuglast|anhängelast/.test(t)) return '🚛';
  if (/blau|rot|weiß|weiss|schwarz|grün|gruen|grau|silber|wolfsgrau/.test(t)) return '🎨';
  if (/familie|kinder/.test(t)) return '👨‍👩‍👧';
  if (/hauptfahrerin|frau fährt|partnerin/.test(t)) return '👩';
  if (/hund/.test(t)) return '🐶';
  if (/panorama|glasschiebe|schiebedach/.test(t)) return '☀';
  if (/wärmepumpe|waermepumpe/.test(t)) return '🌡';
  if (/\bv2l\b/.test(t)) return '🔌';
  if (/sitzheizung/.test(t)) return '🔥';
  if (/kofferraum/.test(t)) return '📦';
  if (/rückfahr|rueckfahr|kamera|360|hud|head-up/.test(t)) return '📷';
  if (/schnellladen|800v|800-v/.test(t)) return '⚡';
  if (/wallbox|zuhause|daheim/.test(t)) return '🏠';
  if (/winter/.test(t)) return '❄';
  if (/isofix/.test(t)) return '👶';
  if (/kinderwagen/.test(t)) return '🛒';
  if (/dachbox/.test(t)) return '🏕';
  if (/pferde/.test(t)) return '🐴';
  return '·';
}

export default function CleverMemoryBar({
  labels = [],
  onRemove,
  animating = false,
}) {
  if (!labels.length) return null;

  return (
    <div className="cc-memory" aria-label="Verstanden">
      <p className="cc-memory__label">✓ Verstanden</p>
      <div
        className={[
          'cc-memory__track',
          animating ? 'is-animating' : '',
        ].filter(Boolean).join(' ')}
        role="list"
      >
        {labels.map((label) => (
          <span key={label} className="cc-memory__chip" role="listitem">
            <span className="cc-memory__chip-icon" aria-hidden>{iconForLabel(label)}</span>
            <span className="cc-memory__chip-text">{label}</span>
            <button
              type="button"
              className="cc-memory__chip-x"
              onClick={() => onRemove?.(label)}
              aria-label={`${label} entfernen`}
              title={`${label} entfernen`}
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
