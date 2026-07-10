import './clever-conversation.css';

export default function CleverWishProfile({ profile, compact = false }) {
  if (!profile?.lines?.length) return null;

  return (
    <div className={`cc-wish-profile${compact ? ' cc-wish-profile--compact' : ''}`}>
      <p className="cc-wish-profile__title">{profile.title}</p>
      <ul className="cc-wish-profile__lines">
        {profile.lines.map((line) => (
          <li key={line.text} className="cc-wish-profile__line">
            <span className="cc-wish-profile__icon" aria-hidden>{line.icon}</span>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      {profile.footer && (
        <p className="cc-wish-profile__footer">{profile.footer}</p>
      )}
    </div>
  );
}
