import BrandLogoIcon from './BrandLogoIcon.jsx';

export const BRAND_TAGLINE = 'Dein smarter Weg zum passenden Auto';
export const BRAND_LOGO_ALT = 'Clever-Neuwagen – clever-neuwagen.de';

/**
 * @param {{ variant?: 'compact' | 'full', showTagline?: boolean, className?: string }} props
 */
export default function BrandLogo({
  variant = 'compact',
  showTagline,
  className = '',
}) {
  const withTagline = showTagline ?? variant === 'full';

  return (
    <div
      className={['brand-logo', `brand-logo--${variant}`, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={BRAND_LOGO_ALT}
    >
      <div className="brand-logo__icon">
        <BrandLogoIcon className="brand-logo__icon-svg" />
      </div>
      <div className="brand-logo__text">
        <div className="brand-logo__wordmark">
          <span className="brand-logo__clever">clever</span>
          <span className="brand-logo__domain">-neuwagen.de</span>
        </div>
        {withTagline && (
          <span className="brand-logo__tagline">{BRAND_TAGLINE}</span>
        )}
      </div>
    </div>
  );
}
