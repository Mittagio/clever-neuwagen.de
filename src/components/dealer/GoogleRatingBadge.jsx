import { isLiveGoogleRating } from '../../services/dealer/googleReviewsService.js';
import './dealer-offer.css';

function renderStars(rating) {
  const full = Math.round(rating ?? 0);
  return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

export default function GoogleRatingBadge({
  rating,
  reviewCount = 0,
  googleMapsUri,
  ratingSource = 'fallback',
  size = 'md',
  showLink = true,
}) {
  if (rating == null) return null;

  const isGoogle = ratingSource === 'google';
  const label = isGoogle ? 'Google' : 'Bewertung';

  return (
    <div className={`google-rating google-rating--${size}${isGoogle ? ' google-rating--live' : ''}`}>
      <span className="google-rating__brand" aria-hidden="true">G</span>
      <div className="google-rating__body">
        <span className="google-rating__value">{Number(rating).toFixed(1)}</span>
        <span className="google-rating__stars" aria-label={`${rating} von 5 Sternen`}>
          {renderStars(rating)}
        </span>
        <span className="google-rating__meta">
          {reviewCount > 0 ? `${reviewCount} ${label}-Bewertungen` : `${label}`}
        </span>
      </div>
      {showLink && googleMapsUri && (
        <a
          href={googleMapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="google-rating__link"
        >
          Auf Google ansehen
        </a>
      )}
      {isGoogle && (
        <span className="google-rating__live" title="Live von Google Places">Live</span>
      )}
    </div>
  );
}

export function GoogleReviewSnippet({ reviews = [] }) {
  const top = reviews.find((r) => r.text?.length > 20);
  if (!top) return null;

  return (
    <blockquote className="google-review-snippet">
      <p>„{top.text.slice(0, 160)}{top.text.length > 160 ? '…' : ''}"</p>
      <footer>
        — {top.author}
        {top.relativeTime ? ` · ${top.relativeTime}` : ''}
      </footer>
    </blockquote>
  );
}

export function GoogleRatingFromData({ googleData, profile, size = 'md' }) {
  const rating = isLiveGoogleRating(googleData) ? googleData.rating : profile?.rating;
  const reviewCount = isLiveGoogleRating(googleData)
    ? googleData.reviewCount
    : profile?.reviewCount;
  const source = isLiveGoogleRating(googleData) ? 'google' : (profile?.ratingSource ?? 'fallback');
  const uri = googleData?.googleMapsUri ?? profile?.googleMapsUri;

  return (
    <GoogleRatingBadge
      rating={rating}
      reviewCount={reviewCount}
      googleMapsUri={uri}
      ratingSource={source}
      size={size}
    />
  );
}
