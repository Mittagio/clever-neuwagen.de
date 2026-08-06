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

export function IconThumbUp(props) {
  return (
    <SvgIcon {...props}>
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3z" {...stroke} />
      <path d="M7 11l3.2-6.2A2 2 0 0 1 12 4h.3a2 2 0 0 1 1.9 2.5L13.5 11H19a2 2 0 0 1 2 2.3l-.8 5A2 2 0 0 1 18.2 20H7" {...stroke} />
    </SvgIcon>
  );
}

export function IconThumbDown(props) {
  return (
    <SvgIcon {...props}>
      <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3z" {...stroke} />
      <path d="M17 13l-3.2 6.2A2 2 0 0 1 12 20h-.3a2 2 0 0 1-1.9-2.5L10.5 13H5a2 2 0 0 1-2-2.3l.8-5A2 2 0 0 1 5.8 4H17" {...stroke} />
    </SvgIcon>
  );
}

export function IconCopy(props) {
  return (
    <SvgIcon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" {...stroke} />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" {...stroke} />
    </SvgIcon>
  );
}

export function IconBranch(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="6" cy="6" r="2" {...stroke} />
      <circle cx="6" cy="18" r="2" {...stroke} />
      <circle cx="18" cy="12" r="2" {...stroke} />
      <path d="M6 8v8M8 6h4a4 4 0 0 1 4 4M8 18h4a4 4 0 0 0 4-4" {...stroke} />
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

export function IconChevronRight(props) {
  return (
    <SvgIcon {...props}>
      <path d="M9 6l6 6-6 6" {...stroke} />
    </SvgIcon>
  );
}

export function IconUsers(props) {
  return (
    <SvgIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...stroke} />
      <circle cx="9" cy="7" r="3.5" {...stroke} />
      <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35" {...stroke} />
      <path d="M16.5 3.7a3.5 3.5 0 0 1 0 6.6" {...stroke} />
    </SvgIcon>
  );
}

export function IconEuro(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 10h8M4 14h8" {...stroke} />
      <path d="M18 5.5A7.5 7.5 0 1 0 18 18.5" {...stroke} />
    </SvgIcon>
  );
}

export function IconClock(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="M12 7.5V12l3 2" {...stroke} />
    </SvgIcon>
  );
}

export function IconSwap(props) {
  return (
    <SvgIcon {...props}>
      <path d="M7 7h11l-3-3M17 17H6l3 3" {...stroke} />
    </SvgIcon>
  );
}

export function IconInbox(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 6h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" {...stroke} />
      <path d="M4 10h4.2l1.3 2h5l1.3-2H20" {...stroke} />
    </SvgIcon>
  );
}

export function IconMegaphone(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 11v2a3 3 0 0 0 3 3h1" {...stroke} />
      <path d="M8 8l11-3v14L8 16V8z" {...stroke} />
      <path d="M8 12h3" {...stroke} />
    </SvgIcon>
  );
}

/** Ausstattungs-Picker: Komfort */
export function IconSeat(props) {
  return (
    <SvgIcon {...props}>
      <path d="M7 11v7M17 11v7" {...stroke} />
      <path d="M5 18h14" {...stroke} />
      <path d="M6 11c0-3 2.5-5 6-5s6 2 6 5" {...stroke} />
      <path d="M8 11h8v3H8z" {...stroke} />
    </SvgIcon>
  );
}

/** Ausstattungs-Picker: Technik */
export function IconCpu(props) {
  return (
    <SvgIcon {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" {...stroke} />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5" {...stroke} />
    </SvgIcon>
  );
}

/** Ausstattungs-Picker: Sicherheit */
export function IconShield(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" {...stroke} />
    </SvgIcon>
  );
}

/** Ausstattungs-Picker: Alltag / AHK */
export function IconHook(props) {
  return (
    <SvgIcon {...props}>
      <path d="M8 4v8a4 4 0 0 0 8 0V9" {...stroke} />
      <path d="M12 4V2" {...stroke} />
      <path d="M16 13c1.5 0 3 1 3 3s-1.5 3-3 3" {...stroke} />
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

export const EQUIPMENT_AREA_ICONS = {
  comfort: IconSeat,
  tech: IconCpu,
  safety: IconShield,
  daily: IconHook,
};
