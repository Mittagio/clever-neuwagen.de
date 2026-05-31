import { HEALTH_STATUS } from '../../data/vehicleDataService.js';
import './HealthIndicator.css';

export default function HealthIndicator({ health, showLabel = true, size = 'md' }) {
  const config = HEALTH_STATUS[health] ?? HEALTH_STATUS.review;

  return (
    <span className={`health-indicator health-indicator--${size} ${config.className}`}>
      <span className="health-indicator-emoji" aria-hidden="true">{config.emoji}</span>
      {showLabel && <span className="health-indicator-label">{config.label}</span>}
    </span>
  );
}
