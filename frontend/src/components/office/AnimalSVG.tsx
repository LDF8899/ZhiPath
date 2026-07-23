import type { AnimalType } from './types';

interface AnimalSVGProps {
  type: AnimalType | string;
  color: string;
  size?: number;
}

interface AvatarSpec {
  label: string;
  hair: 'neat' | 'wave' | 'visor' | 'bob' | 'cap' | 'side';
  eyes: 'calm' | 'focus' | 'smile' | 'scan';
  glyph: 'path' | 'code' | 'jobs' | 'video' | 'animation' | 'diagram' | 'avatar' | 'progress' | 'tasks' | 'resources' | 'target' | 'gap';
  accent: string;
}

const AVATAR_SPECS: Record<string, AvatarSpec> = {
  cat: { label: 'PATH', hair: 'wave', eyes: 'calm', glyph: 'path', accent: '#f4c95d' },
  dog: { label: 'CODE', hair: 'visor', eyes: 'focus', glyph: 'code', accent: '#63d297' },
  rabbit: { label: 'JOBS', hair: 'neat', eyes: 'scan', glyph: 'jobs', accent: '#83c5be' },
  panda: { label: 'VIDEO', hair: 'cap', eyes: 'smile', glyph: 'video', accent: '#8bd3ff' },
  fox: { label: 'MOTION', hair: 'side', eyes: 'focus', glyph: 'animation', accent: '#f2a65a' },
  deer: { label: 'GRAPH', hair: 'neat', eyes: 'calm', glyph: 'diagram', accent: '#b8a4ff' },
  penguin: { label: 'HOST', hair: 'bob', eyes: 'smile', glyph: 'avatar', accent: '#f6d365' },
  owl: { label: 'PROG', hair: 'visor', eyes: 'scan', glyph: 'progress', accent: '#7ec8e3' },
  parrot: { label: 'TASK', hair: 'cap', eyes: 'focus', glyph: 'tasks', accent: '#ffb56b' },
  duck: { label: 'GAP', hair: 'side', eyes: 'scan', glyph: 'gap', accent: '#a3e635' },
  hamster: { label: 'RES', hair: 'wave', eyes: 'smile', glyph: 'resources', accent: '#f7a8b8' },
  bear: { label: 'GOAL', hair: 'neat', eyes: 'calm', glyph: 'target', accent: '#d6b88d' },
  hedgehog: { label: 'QA', hair: 'visor', eyes: 'focus', glyph: 'gap', accent: '#c4b5fd' },
  raccoon: { label: 'OPS', hair: 'cap', eyes: 'scan', glyph: 'tasks', accent: '#a7f3d0' },
};

function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return hex;
  const next = [0, 2, 4].map((offset) => {
    const value = parseInt(clean.slice(offset, offset + 2), 16);
    return Math.max(0, Math.min(255, value + amount)).toString(16).padStart(2, '0');
  });
  return `#${next.join('')}`;
}

function hairMarkup(spec: AvatarSpec): string {
  switch (spec.hair) {
    case 'visor':
      return `
        <path d="M29 38q4-18 21-20 17 2 21 20-10-7-21-7t-21 7z" fill="#27231f" stroke="#1d1b18" stroke-width="2.2"/>
        <path d="M34 33h32" stroke="${spec.accent}" stroke-width="5" stroke-linecap="round"/>
      `;
    case 'wave':
      return `
        <path d="M27 39q5-21 22-22 18 0 24 19-8-5-17-5-9 0-17 6-6 4-12 2z" fill="#2f2924" stroke="#1d1b18" stroke-width="2.2"/>
        <path d="M34 30q8-8 20-6" fill="none" stroke="#54483d" stroke-width="3" stroke-linecap="round" opacity=".55"/>
      `;
    case 'bob':
      return `
        <path d="M28 42q1-25 22-25t22 25v8q-7-5-13-6-9-2-18 0-7 1-13 6z" fill="#2d2a33" stroke="#1d1b18" stroke-width="2.2"/>
      `;
    case 'cap':
      return `
        <path d="M28 37q5-17 22-17t22 17q-10-5-22-5t-22 5z" fill="${spec.accent}" stroke="#1d1b18" stroke-width="2.2"/>
        <path d="M43 22h14l5 9H38z" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/>
      `;
    case 'side':
      return `
        <path d="M28 39q4-20 22-21 17 1 21 18-14-1-27-6-6 6-16 9z" fill="#302822" stroke="#1d1b18" stroke-width="2.2"/>
      `;
    default:
      return `
        <path d="M29 38q4-19 21-20 17 1 21 20-9-7-21-7t-21 7z" fill="#2b2620" stroke="#1d1b18" stroke-width="2.2"/>
      `;
  }
}

function eyeMarkup(eyes: AvatarSpec['eyes']): string {
  if (eyes === 'focus') {
    return `
      <path d="M35 42h10" stroke="#1d1b18" stroke-width="3" stroke-linecap="round"/>
      <path d="M55 42h10" stroke="#1d1b18" stroke-width="3" stroke-linecap="round"/>
      <circle class="eyes-open" cx="40" cy="47" r="3.1" fill="#1d1b18"/>
      <circle class="eyes-open" cx="60" cy="47" r="3.1" fill="#1d1b18"/>
      <g class="eyes-closed"><path d="M35 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/><path d="M55 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/></g>
    `;
  }
  if (eyes === 'smile') {
    return `
      <g class="eyes-open"><path d="M35 45q5 5 10 0" fill="none" stroke="#1d1b18" stroke-width="3" stroke-linecap="round"/><path d="M55 45q5 5 10 0" fill="none" stroke="#1d1b18" stroke-width="3" stroke-linecap="round"/></g>
      <g class="eyes-closed"><path d="M35 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/><path d="M55 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/></g>
    `;
  }
  if (eyes === 'scan') {
    return `
      <g class="eyes-open">
        <rect x="34" y="40" width="13" height="9" rx="4" fill="#fff" stroke="#1d1b18" stroke-width="2"/>
        <rect x="53" y="40" width="13" height="9" rx="4" fill="#fff" stroke="#1d1b18" stroke-width="2"/>
        <path d="M47 44h6" stroke="#1d1b18" stroke-width="2"/>
        <circle cx="41" cy="44.5" r="2.6" fill="#1d1b18"/>
        <circle cx="60" cy="44.5" r="2.6" fill="#1d1b18"/>
      </g>
      <g class="eyes-closed"><path d="M35 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/><path d="M55 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/></g>
    `;
  }
  return `
    <g class="eyes-open">
      <circle cx="40" cy="45" r="4.1" fill="#1d1b18"/>
      <circle cx="60" cy="45" r="4.1" fill="#1d1b18"/>
      <circle cx="41.5" cy="43.5" r="1.5" fill="#fff"/>
      <circle cx="61.5" cy="43.5" r="1.5" fill="#fff"/>
    </g>
    <g class="eyes-closed"><path d="M35 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/><path d="M55 46q5 4 10 0" fill="none" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/></g>
  `;
}

function glyphMarkup(glyph: AvatarSpec['glyph'], accent: string): string {
  switch (glyph) {
    case 'code':
      return `<rect x="64" y="59" width="25" height="18" rx="3" fill="#1d1b18"/><path d="M70 66l4 3-4 3M77 72h6" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'jobs':
      return `<rect x="64" y="61" width="23" height="17" rx="3" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><path d="M70 61v-4h11v4M72 69h7" fill="none" stroke="#1d1b18" stroke-width="2" stroke-linecap="round"/><path d="M79 76l7 6 7-11" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'video':
      return `<rect x="63" y="61" width="20" height="16" rx="3" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><path d="M83 66l9-5v16l-9-5z" fill="${accent}" stroke="#1d1b18" stroke-width="2"/><circle cx="69" cy="57" r="4" fill="${accent}" stroke="#1d1b18" stroke-width="1.8"/>`;
    case 'animation':
      return `<path d="M67 77l16-16" stroke="#1d1b18" stroke-width="2.6" stroke-linecap="round"/><path d="M82 58l4-5 2 6 6 2-6 2-2 6-4-5-6-3z" fill="${accent}" stroke="#1d1b18" stroke-width="1.8" stroke-linejoin="round"/>`;
    case 'diagram':
      return `<rect x="64" y="57" width="9" height="9" rx="2" fill="${accent}" stroke="#1d1b18" stroke-width="2"/><rect x="79" y="68" width="9" height="9" rx="2" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><path d="M73 62l7 8M68 66v10h10" fill="none" stroke="#1d1b18" stroke-width="2" stroke-linecap="round"/>`;
    case 'avatar':
      return `<circle cx="77" cy="66" r="12" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><path d="M70 70q7 5 14 0" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><circle cx="73" cy="64" r="2" fill="#1d1b18"/><circle cx="81" cy="64" r="2" fill="#1d1b18"/>`;
    case 'progress':
      return `<rect x="64" y="58" width="22" height="22" rx="4" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><path d="M70 73V66M76 73V62M82 73V69" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
    case 'tasks':
      return `<rect x="64" y="58" width="22" height="26" rx="4" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><path d="M70 66h10M70 72h8M70 78h11" stroke="#1d1b18" stroke-width="2" stroke-linecap="round"/><circle cx="82" cy="58" r="5" fill="${accent}" stroke="#1d1b18" stroke-width="2"/>`;
    case 'resources':
      return `<path d="M65 60h21v20H65z" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><path d="M65 60l10 8 11-8M69 74h12" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>`;
    case 'target':
      return `<circle cx="77" cy="69" r="12" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/><circle cx="77" cy="69" r="7" fill="none" stroke="${accent}" stroke-width="2.5"/><circle cx="77" cy="69" r="2.5" fill="#1d1b18"/>`;
    case 'gap':
      return `<path d="M65 78l8-14 7 8 8-16" fill="none" stroke="#1d1b18" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="73" cy="64" r="3" fill="${accent}"/><circle cx="80" cy="72" r="3" fill="${accent}"/><circle cx="88" cy="56" r="3" fill="${accent}"/>`;
    default:
      return `<path d="M66 76q7-18 21-20M71 63h15M70 72h10" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
}

export function makeAnimalSVG(type: string, color: string): string {
  const spec = AVATAR_SPECS[type] || AVATAR_SPECS.cat;
  const base = color || '#2f6f73';
  const dark = shade(base, -48);
  const light = shade(base, 34);
  const id = `${type}-${base}`.replace(/[^a-zA-Z0-9_-]/g, '');

  return `<svg class="agent-staff-svg" viewBox="0 0 100 100" role="img" aria-label="${spec.label}">
    <defs>
      <linearGradient id="jacket-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${light}"/>
        <stop offset="100%" stop-color="${dark}"/>
      </linearGradient>
      <radialGradient id="face-${id}" cx="43%" cy="34%" r="62%">
        <stop offset="0%" stop-color="#ffe2c8"/>
        <stop offset="100%" stop-color="#efbf9d"/>
      </radialGradient>
    </defs>
    <g class="agent-work-ring">
      <circle cx="50" cy="50" r="42" fill="none" stroke="${spec.accent}" stroke-width="3" stroke-dasharray="9 7" opacity=".78"/>
      <path d="M76 20l6 6-6 6" fill="none" stroke="${spec.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <ellipse cx="50" cy="90" rx="31" ry="6" fill="#1d1b18" opacity=".12"/>
    <path d="M24 79q4-22 26-22t26 22v9H24z" fill="url(#jacket-${id})" stroke="#1d1b18" stroke-width="2.6"/>
    <path d="M39 62l11 14 11-14" fill="#fff7df" stroke="#1d1b18" stroke-width="2" stroke-linejoin="round"/>
    <path d="M47 63h6l2 14-5 5-5-5z" fill="${spec.accent}" stroke="#1d1b18" stroke-width="1.7" stroke-linejoin="round"/>
    <circle cx="50" cy="42" r="22" fill="url(#face-${id})" stroke="#1d1b18" stroke-width="2.8"/>
    ${hairMarkup(spec)}
    ${eyeMarkup(spec.eyes)}
    <path d="M46 54q4 4 8 0" fill="none" stroke="#1d1b18" stroke-width="2.3" stroke-linecap="round"/>
    <circle cx="33" cy="51" r="4" fill="#ef8d8d" opacity=".35"/>
    <circle cx="67" cy="51" r="4" fill="#ef8d8d" opacity=".35"/>
    <g class="agent-tool">${glyphMarkup(spec.glyph, spec.accent)}</g>
    <g class="agent-work-lines">
      <path d="M14 28h8M11 39h7M78 15h8" stroke="${spec.accent}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M17 64h7M80 45h7M75 86h8" stroke="#1d1b18" stroke-width="2" stroke-linecap="round" opacity=".35"/>
    </g>
    <g class="agent-complete-mark">
      <circle cx="82" cy="22" r="11" fill="#63d297" stroke="#1d1b18" stroke-width="2.4"/>
      <path d="M76 22l4 4 8-9" fill="none" stroke="#1d1b18" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <rect x="33" y="80" width="33" height="10" rx="4" fill="#fff7df" stroke="#1d1b18" stroke-width="2"/>
    <circle cx="40" cy="85" r="2.5" fill="${spec.accent}"/>
    <text x="54" y="88" text-anchor="middle" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="6.5" font-weight="700" fill="#1d1b18">${spec.label}</text>
  </svg>`;
}

export default function AnimalSVG({ type, color, size }: AnimalSVGProps) {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: makeAnimalSVG(type, color) }}
      style={{ display: 'inline-block', lineHeight: 0, width: size, height: size }}
    />
  );
}
