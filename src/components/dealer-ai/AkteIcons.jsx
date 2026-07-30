/**
 * Einheitliche Line-Icons für Kundenakte (kein Emoji).
 * Stroke 1.75 · ~20px · currentColor.
 */
const SIZE = 20;

function SvgIcon({ children, label, className = '' }) {
  return (
    <svg
      className={`cn-line-icon ${className}`.trim()}
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconUser(props) {
  return (
    <SvgIcon {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" {...stroke} />
      <circle cx="12" cy="7" r="4" {...stroke} />
    </SvgIcon>
  );
}

export function IconChat(props) {
  return (
    <SvgIcon {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" {...stroke} />
    </SvgIcon>
  );
}

export function IconSparkle(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3l1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3z" {...stroke} />
      <path d="M19 14l.6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6L19 14z" {...stroke} />
    </SvgIcon>
  );
}

export function IconCar(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3 14h18v4a1 1 0 0 1-1 1h-1" {...stroke} />
      <path d="M5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" {...stroke} />
      <path d="M19 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" {...stroke} />
      <path d="M5 14l1.5-5.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 14" {...stroke} />
    </SvgIcon>
  );
}

export function IconMore(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" {...stroke} />
    </SvgIcon>
  );
}

export function IconPhone(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M8.5 3.5h2.2l1.1 3.2-1.6 1.1a12 12 0 0 0 5.5 5.5l1.1-1.6 3.2 1.1v2.2a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2z"
        {...stroke}
      />
    </SvgIcon>
  );
}

export function IconSearch(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="11" cy="11" r="6.5" {...stroke} />
      <path d="M16.5 16.5L21 21" {...stroke} />
    </SvgIcon>
  );
}

export function IconMoreDots(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </SvgIcon>
  );
}

export function IconBack(props) {
  return (
    <SvgIcon {...props}>
      <path d="M15 6l-6 6 6 6" {...stroke} />
    </SvgIcon>
  );
}

export function IconSend(props) {
  return (
    <SvgIcon {...props}>
      <path d="M5 12h12M13 6l6 6-6 6" {...stroke} />
    </SvgIcon>
  );
}

export function IconSendUp(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" {...stroke} />
    </SvgIcon>
  );
}

export function IconMic(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" {...stroke} />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...stroke} />
    </SvgIcon>
  );
}

export function IconChevronDown(props) {
  return (
    <SvgIcon {...props}>
      <path d="M6 9l6 6 6-6" {...stroke} />
    </SvgIcon>
  );
}

export const AKTE_NAV_ICONS = {
  kunde: IconUser,
  chat: IconChat,
  clever: IconSparkle,
  angebote: IconCar,
  mehr: IconMore,
};
