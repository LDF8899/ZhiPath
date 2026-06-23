/* ──────────────────────────────────────────
   Hand-drawn SVG Icon Library
   Stroke-based, matching the paper/sketch aesthetic.
   All icons use 24x24 viewBox, accept size & className.
   ────────────────────────────────────────── */

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const defaultProps: IconProps = { size: 20 };

/* ─────────────── helpers ─────────────── */

function wrap(children: React.ReactNode, size = 20, className?: string, style?: React.CSSProperties) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/* ══════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════ */

/** House outline */
export function IconHome({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M3 10.5 L12 3 L21 10.5" />
      <path d="M5 9.5 V20 C5 20.5 5.5 21 6 21 H18 C18.5 21 19 20.5 19 20 V9.5" />
      <path d="M9 21 V15 C9 14.5 9.5 14 10 14 H14 C14.5 14 15 14.5 15 15 V21" />
    </>,
    size,
    className,
    style
  );
}

/** Open book */
export function IconBook({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M2 4 C2 4 5 3 12 3 C19 3 22 4 22 4 V19 C22 19 19 18 12 18 C5 18 2 19 2 19 Z" />
      <path d="M12 3 V18" />
    </>,
    size,
    className,
    style
  );
}

/** Briefcase / job */
export function IconBriefcase({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7 V5 C16 3.9 15.1 3 14 3 H10 C8.9 3 8 3.9 8 5 V7" />
      <path d="M2 12 H22" strokeWidth="1.5" />
      <circle cx="12" cy="14.5" r="1.5" fill="currentColor" strokeWidth="0" />
    </>,
    size,
    className,
    style
  );
}

/** Graduation cap */
export function IconGradCap({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 3 L2 8 L12 13 L22 8 Z" />
      <path d="M6 10.5 V17 C6 17 9 20 12 20 C15 20 18 17 18 17 V10.5" />
      <path d="M22 8 V16" />
    </>,
    size,
    className,
    style
  );
}

/** Newspaper */
export function IconNewspaper({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 7 H17" />
      <path d="M7 10 H13" strokeWidth="1.5" />
      <rect x="7" y="13" width="4" height="5" rx="0.5" strokeWidth="1.5" />
      <path d="M13 13 H17" strokeWidth="1.5" />
      <path d="M13 15.5 H17" strokeWidth="1.5" />
    </>,
    size,
    className,
    style
  );
}

/** Person silhouette */
export function IconUser({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21 C4 17 7.5 14 12 14 C16.5 14 20 17 20 21" />
    </>,
    size,
    className,
    style
  );
}

/** Gear / cog */
export function IconSettings({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1.5 L13.5 4.5 L16 3.5 L15.5 6.5 L18.5 7 L17 9.5 L20 10.5 L17.5 12 L20 13.5 L17 14.5 L18.5 17 L15.5 17.5 L16 20.5 L13.5 19.5 L12 22.5 L10.5 19.5 L8 20.5 L8.5 17.5 L5.5 17 L7 14.5 L4 13.5 L6.5 12 L4 10.5 L7 9.5 L5.5 7 L8.5 6.5 L8 3.5 L10.5 4.5 Z" />
    </>,
    size,
    className,
    style
  );
}

/** Robot face (simplified) */
export function IconRobot({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="4" y="8" width="16" height="12" rx="2.5" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" strokeWidth="0" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" strokeWidth="0" />
      <path d="M12 3 V8" />
      <circle cx="12" cy="2" r="1.2" fill="currentColor" strokeWidth="0" />
      <path d="M1 12.5 H4" />
      <path d="M20 12.5 H23" />
      <path d="M9 17.5 H15" strokeWidth="1.5" />
    </>,
    size,
    className,
    style
  );
}

/** Bar chart */
export function IconChart({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M3 21 V3" />
      <path d="M3 21 H21" />
      <rect x="6" y="13" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.25" strokeWidth="0" />
      <rect x="11" y="8" width="3" height="13" rx="0.5" fill="currentColor" opacity="0.25" strokeWidth="0" />
      <rect x="16" y="5" width="3" height="16" rx="0.5" fill="currentColor" opacity="0.25" strokeWidth="0" />
      <path d="M6 13 H9 V21 H6 Z" />
      <path d="M11 8 H14 V21 H11 Z" />
      <path d="M16 5 H19 V21 H16 Z" />
    </>,
    size,
    className,
    style
  );
}

/** Network / graph nodes */
export function IconGraph({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M10 7 L6.5 15.5" />
      <path d="M14 7 L17.5 15.5" />
      <path d="M7.5 18 H16.5" />
    </>,
    size,
    className,
    style
  );
}

/* ══════════════════════════════════════════
   ACTIONS
   ══════════════════════════════════════════ */

/** Plus sign */
export function IconPlus({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 5 V19" />
      <path d="M5 12 H19" />
    </>,
    size,
    className,
    style
  );
}

/** Magnifying glass */
export function IconSearch({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 L21 21" />
    </>,
    size,
    className,
    style
  );
}

/** Paper plane / send */
export function IconSend({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M3 12 L21 3 L15 21 L12 13 Z" />
      <path d="M12 13 L21 3" />
    </>,
    size,
    className,
    style
  );
}

/** Download arrow */
export function IconDownload({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 3 V15" />
      <path d="M8 11 L12 15.5 L16 11" />
      <path d="M4 17 V20 C4 20.5 4.5 21 5 21 H19 C19.5 21 20 20.5 20 20 V17" />
    </>,
    size,
    className,
    style
  );
}

/** Pencil / edit */
export function IconEdit({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M16 3 L21 8 L8 21 L3 21 L3 16 Z" />
      <path d="M14 5 L19 10" />
    </>,
    size,
    className,
    style
  );
}

/** Trash can */
export function IconTrash({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M4 6 H20" />
      <path d="M7 6 V19 C7 20 7.8 21 9 21 H15 C16.2 21 17 20 17 19 V6" />
      <path d="M10 6 V4 C10 3 10.5 2 12 2 C13.5 2 14 3 14 4 V6" />
      <path d="M10 10 V17" strokeWidth="1.5" />
      <path d="M14 10 V17" strokeWidth="1.5" />
    </>,
    size,
    className,
    style
  );
}

/** Circular refresh arrows */
export function IconRefresh({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M20 8 A8 8 0 1 0 21 12" />
      <path d="M16 4 L20 8 L16 8" />
      <path d="M4 16 A8 8 0 1 0 3 12" />
      <path d="M8 20 L4 16 L8 16" />
    </>,
    size,
    className,
    style
  );
}

/** Funnel / filter */
export function IconFilter({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M2 4 H22 L15 12.5 V19 L9 21 V12.5 Z" />
    </>,
    size,
    className,
    style
  );
}

/* ══════════════════════════════════════════
   STATUS
   ══════════════════════════════════════════ */

/** Checkmark in circle */
export function IconCheck({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5 L11 15.5 L16.5 8.5" />
    </>,
    size,
    className,
    style
  );
}

/** X mark in circle */
export function IconX({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9 L15 15" />
      <path d="M15 9 L9 15" />
    </>,
    size,
    className,
    style
  );
}

/** Clock face */
export function IconClock({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5 V12 L16 15" />
    </>,
    size,
    className,
    style
  );
}

/** Star outline */
export function IconStar({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 2 L14.9 8.6 L22 9.3 L16.8 14 L18.2 21 L12 17.5 L5.8 21 L7.2 14 L2 9.3 L9.1 8.6 Z" />
    </>,
    size,
    className,
    style
  );
}

/** Flame */
export function IconFire({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 2 C12 2 8 7 8 11 C8 14 9.8 16 12 16 C14.2 16 16 14 16 11 C16 7 12 2 12 2 Z" />
      <path d="M12 16 C12 16 10 18 10 19.5 C10 21 10.8 22 12 22 C13.2 22 14 21 14 19.5 C14 18 12 16 12 16 Z" />
    </>,
    size,
    className,
    style
  );
}

/** Notification bell */
export function IconBell({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 2 C12 2 8 2 8 7 V13 L4 17 H20 L16 13 V7 C16 2 12 2 12 2 Z" />
      <path d="M10 17 C10 19 10.8 21 12 21 C13.2 21 14 19 14 17" />
    </>,
    size,
    className,
    style
  );
}

/** Triangle warning */
export function IconWarning({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 3 L21 20 H3 Z" />
      <path d="M12 9 V14" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" strokeWidth="0" />
    </>,
    size,
    className,
    style
  );
}

/* ══════════════════════════════════════════
   DATA
   ══════════════════════════════════════════ */

/** Calendar */
export function IconCalendar({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10 H21" />
      <path d="M8 2 V6" />
      <path d="M16 2 V6" />
      <circle cx="8" cy="14" r="0.8" fill="currentColor" strokeWidth="0" />
      <circle cx="12" cy="14" r="0.8" fill="currentColor" strokeWidth="0" />
      <circle cx="16" cy="14" r="0.8" fill="currentColor" strokeWidth="0" />
    </>,
    size,
    className,
    style
  );
}

/** Target / bullseye (simplified) */
export function IconTarget({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" strokeWidth="0" />
      <path d="M12 1 V4" />
      <path d="M12 20 V23" />
      <path d="M1 12 H4" />
      <path d="M20 12 H23" />
    </>,
    size,
    className,
    style
  );
}

/** Trophy cup */
export function IconTrophy({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M6 3 H18 V10 C18 13.5 15.5 16 12 16 C8.5 16 6 13.5 6 10 V3 Z" />
      <path d="M6 6 H3.5 C2.5 6 2 7 2 8 C2 10 3.5 11 5 11 H6" />
      <path d="M18 6 H20.5 C21.5 6 22 7 22 8 C22 10 20.5 11 19 11 H18" />
      <path d="M12 16 V19" />
      <path d="M8 21 H16 C16 19 14.5 18.5 12 18.5 C9.5 18.5 8 19 8 21 Z" />
    </>,
    size,
    className,
    style
  );
}

/** Idea lightbulb */
export function IconLightbulb({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M9 18 H15" />
      <path d="M10 21 H14" />
      <path d="M12 2 C8 2 5 5.5 5 9.5 C5 12.5 7 14.5 8.5 16 H15.5 C17 14.5 19 12.5 19 9.5 C19 5.5 16 2 12 2 Z" />
      <path d="M12 2 V6" strokeWidth="1.5" />
      <path d="M9.5 3.5 L11 6" strokeWidth="1.5" />
    </>,
    size,
    className,
    style
  );
}

/** Code brackets </> */
export function IconCode({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M7 8 L3 12 L7 16" />
      <path d="M17 8 L21 12 L17 16" />
      <path d="M14 4 L10 20" />
    </>,
    size,
    className,
    style
  );
}

/** Document with folded corner */
export function IconDocument({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M5 2 C5 1.5 5.5 1 6 1 H15 L20 6 V22 C20 22.5 19.5 23 19 23 H6 C5.5 23 5 22.5 5 22 Z" />
      <path d="M15 1 V6 H20" />
      <path d="M9 11 H16" strokeWidth="1.5" />
      <path d="M9 14.5 H16" strokeWidth="1.5" />
      <path d="M9 18 H13" strokeWidth="1.5" />
    </>,
    size,
    className,
    style
  );
}

/** Chain link */
export function IconLink({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M9 7 H7 C5 7 3 9 3 11 C3 13 5 15 7 15 H9" />
      <path d="M15 7 H17 C19 7 21 9 21 11 C21 13 19 15 17 15 H15" />
      <path d="M8 11 H16" />
    </>,
    size,
    className,
    style
  );
}

/* ══════════════════════════════════════════
   LAYOUT
   ══════════════════════════════════════════ */

/** Hamburger menu (3 lines) */
export function IconMenu({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M3 6 H21" />
      <path d="M3 12 H21" />
      <path d="M3 18 H21" />
    </>,
    size,
    className,
    style
  );
}

/** Left chevron */
export function IconChevronLeft({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <path d="M15 5 L8 12 L15 19" />,
    size,
    className,
    style
  );
}

/** Right chevron */
export function IconChevronRight({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <path d="M9 5 L16 12 L9 19" />,
    size,
    className,
    style
  );
}

/** Down chevron */
export function IconChevronDown({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <path d="M6 9 L12 16 L18 9" />,
    size,
    className,
    style
  );
}

/** Left arrow */
export function IconArrowLeft({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M19 12 H5" />
      <path d="M10 7 L5 12 L10 17" />
    </>,
    size,
    className,
    style
  );
}

/** Right arrow */
export function IconArrowRight({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M5 12 H19" />
      <path d="M14 7 L19 12 L14 17" />
    </>,
    size,
    className,
    style
  );
}

/** External link arrow */
export function IconExternalLink({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M10 5 H5 V19 H19 V14" />
      <path d="M13 3 H21 V11" />
      <path d="M21 3 L10 14" />
    </>,
    size,
    className,
    style
  );
}

/* ══════════════════════════════════════════
   CHAT
   ══════════════════════════════════════════ */

/** Speech bubble */
export function IconChat({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M4 4 H20 C20.5 4 21 4.5 21 5 V16 C21 16.5 20.5 17 20 17 H8 L3 21 V5 C3 4.5 3.5 4 4 4 Z" />
      <path d="M8 9 H16" strokeWidth="1.5" />
      <path d="M8 12.5 H13" strokeWidth="1.5" />
    </>,
    size,
    className,
    style
  );
}

/** Microphone */
export function IconMic({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="8" y="2" width="8" height="12" rx="4" />
      <path d="M5 11 C5 15 8 18 12 18 C16 18 19 15 19 11" />
      <path d="M12 18 V22" />
      <path d="M8 22 H16" />
    </>,
    size,
    className,
    style
  );
}

/** Image / photo */
export function IconImage({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <circle cx="8" cy="9" r="2" />
      <path d="M21 16 L16 11 L10 17 L7 14 L2 19" />
    </>,
    size,
    className,
    style
  );
}

/* ══════════════════════════════════════════
   EXTRA — job / location / money
   ══════════════════════════════════════════ */

/** Map pin drop */
export function IconMapPin({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <path d="M12 2 C8.13 2 5 5.13 5 9 C5 14.25 12 22 12 22 C12 22 19 14.25 19 9 C19 5.13 15.87 2 12 2 Z" />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" strokeWidth="0" />
    </>,
    size,
    className,
    style
  );
}

/** Building / office */
export function IconBuilding({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="3" y="3" width="18" height="19" rx="1.5" />
      <path d="M7 7 H10" strokeWidth="1.5" />
      <path d="M14 7 H17" strokeWidth="1.5" />
      <path d="M7 11 H10" strokeWidth="1.5" />
      <path d="M14 11 H17" strokeWidth="1.5" />
      <path d="M7 15 H10" strokeWidth="1.5" />
      <path d="M14 15 H17" strokeWidth="1.5" />
      <path d="M10 22 V18 H14 V22" />
    </>,
    size,
    className,
    style
  );
}

/** Wallet / money */
export function IconWallet({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="2" y="6" width="20" height="15" rx="2" />
      <path d="M2 6 V5 C2 3.9 2.9 3 4 3 H18 C19.1 3 20 3.9 20 5 V6" />
      <path d="M16 12 H18.5" strokeWidth="2" />
      <circle cx="16" cy="12" r="1" fill="currentColor" strokeWidth="0" />
    </>,
    size,
    className,
    style
  );
}

/** Film / video */
export function IconFilm({ size = 20, className, style }: IconProps = defaultProps) {
  return wrap(
    <>
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M7 2 V22" />
      <path d="M17 2 V22" />
      <path d="M2 7 H7" />
      <path d="M2 12 H7" />
      <path d="M2 17 H7" />
      <path d="M17 7 H22" />
      <path d="M17 12 H22" />
      <path d="M17 17 H22" />
    </>,
    size,
    className,
    style
  );
}
