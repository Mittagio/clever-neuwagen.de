/** Modernes KI-Icon (Sparkle-Cluster, kein Suchsymbol) */
export default function AiAssistantIcon({ size = 20, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2.5L13.2 7.1L17.5 8.3L13.2 9.5L12 14.1L10.8 9.5L6.5 8.3L10.8 7.1L12 2.5Z"
        fill="#8b5cf6"
      />
      <path
        d="M18.5 13L19.3 15.6L21.8 16.4L19.3 17.2L18.5 19.8L17.7 17.2L15.2 16.4L17.7 15.6L18.5 13Z"
        fill="#6366f1"
        opacity="0.9"
      />
      <path
        d="M5.5 14.5L6.1 16.4L8 17L6.1 17.6L5.5 19.5L4.9 17.6L3 17L4.9 16.4L5.5 14.5Z"
        fill="#06b6d4"
        opacity="0.85"
      />
    </svg>
  );
}
