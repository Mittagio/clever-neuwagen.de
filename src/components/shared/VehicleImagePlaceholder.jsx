export default function VehicleImagePlaceholder({ variant = 'suv' }) {
  const gradients = {
    niro: 'linear-gradient(145deg, #dbeafe 0%, #e0e7ff 50%, #f8fafc 100%)',
    ev3: 'linear-gradient(145deg, #ede9fe 0%, #ddd6fe 50%, #f8fafc 100%)',
    sportage: 'linear-gradient(145deg, #fce7f3 0%, #e0e7ff 50%, #f8fafc 100%)',
    suv: 'linear-gradient(145deg, #fce7f3 0%, #e0e7ff 50%, #f8fafc 100%)',
    ceed: 'linear-gradient(145deg, #d1fae5 0%, #e0e7ff 50%, #f8fafc 100%)',
    kombi: 'linear-gradient(145deg, #d1fae5 0%, #e0e7ff 50%, #f8fafc 100%)',
    kompakt: 'linear-gradient(145deg, #ede9fe 0%, #e0e7ff 50%, #f8fafc 100%)',
    default: 'linear-gradient(145deg, #f1f5f9 0%, #e2e8f0 50%, #f8fafc 100%)',
    hero: 'linear-gradient(165deg, #fafbfc 0%, #f1f5f9 55%, #e8edf3 100%)',
  };

  const isHero = variant === 'hero';

  return (
    <div
      className={`vehicle-image__placeholder${isHero ? ' vehicle-image__placeholder--hero' : ''}`}
      style={{ background: gradients[variant] ?? gradients.default }}
      aria-hidden
    >
      <svg viewBox="0 0 200 80" className="vehicle-image__placeholder-svg">
        <ellipse cx="100" cy="68" rx="70" ry="5" fill={isHero ? 'rgba(15,23,42,0.06)' : 'rgba(99,102,241,0.12)'} />
        <path
          d="M30 52c8-18 32-26 70-26s62 8 70 26l-4 10H34L30 52z"
          fill="#fff"
          stroke={isHero ? '#e2e8f0' : '#e2e8f0'}
          strokeWidth="1"
        />
        <circle cx="55" cy="58" r="10" fill={isHero ? '#475569' : '#334155'} />
        <circle cx="145" cy="58" r="10" fill={isHero ? '#475569' : '#334155'} />
      </svg>
    </div>
  );
}
