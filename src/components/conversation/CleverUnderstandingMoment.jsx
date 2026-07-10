import { buildWishProfilePresentation } from '../../services/consultation/consultationOfferHandoff.js';
import CleverWishProfile from './CleverWishProfile.jsx';
import './clever-conversation.css';

export default function CleverUnderstandingMoment({ labels = [], needProfile = {} }) {
  const profile = buildWishProfilePresentation(needProfile, labels);
  if (!profile.lines.length) return null;

  return (
    <section className="cc-understanding-mirror cc-turn-enter" aria-labelledby="cc-understanding-mirror-title">
      <CleverWishProfile profile={profile} />
    </section>
  );
}
