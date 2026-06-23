/**
 * AnimalSVG — 12种动物 SVG 头像生成器
 * 从原型 zhipath-agent-office-2.html 移植
 */

import type { AnimalType } from './types';

interface AnimalSVGProps {
  type: AnimalType | string;
  color: string;
  size?: number;
}

export function makeAnimalSVG(type: string, color: string): string {
  const c = color;
  const eo = 'class="eyes-open"';
  const ec = 'class="eyes-closed"';
  const id = c.replace('#', '');

  const generators: Record<string, () => string> = {
    cat: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <path d="M74 68 Q88 56 86 42 Q84 48 80 46 Q86 54 78 66" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="50" cy="66" rx="26" ry="22" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="70" rx="14" ry="12" fill="${c}" opacity="0.6"/>
      <polygon points="28,42 18,8 42,34" fill="${c}" stroke="#2b2620" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="72,42 82,8 58,34" fill="${c}" stroke="#2b2620" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="28,42 22,16 38,34" fill="#ffd5c9" opacity="0.8"/>
      <polygon points="72,42 78,16 62,34" fill="#ffd5c9" opacity="0.8"/>
      <ellipse cx="50" cy="48" rx="22" ry="18" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <g ${eo}><ellipse cx="40" cy="46" rx="5" ry="5.5" fill="#2b2620"/><ellipse cx="60" cy="46" rx="5" ry="5.5" fill="#2b2620"/><ellipse cx="41.5" cy="44.5" rx="2.2" ry="2.5" fill="#fff"/><ellipse cx="61.5" cy="44.5" rx="2.2" ry="2.5" fill="#fff"/></g>
      <g ${ec}><path d="M35 46 Q40 50 45 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M55 46 Q60 50 65 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <path d="M47 52 L50 55 L53 52 Z" fill="#ffd5c9" stroke="#2b2620" stroke-width="1.2"/>
      <path d="M47 55 Q50 58 53 55" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="32" y1="50" x2="14" y2="47" stroke="#2b2620" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="32" y1="54" x2="14" y2="55" stroke="#2b2620" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="68" y1="50" x2="86" y2="47" stroke="#2b2620" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="68" y1="54" x2="86" y2="55" stroke="#2b2620" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <ellipse cx="33" cy="54" rx="5" ry="3" fill="#ffd5c9" opacity="0.4"/>
      <ellipse cx="67" cy="54" rx="5" ry="3" fill="#ffd5c9" opacity="0.4"/>
      <ellipse cx="38" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="62" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    dog: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <path d="M76 62 Q86 48 82 36" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
      <path d="M76 62 Q86 48 82 36" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="50" cy="66" rx="24" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="70" rx="12" ry="10" fill="${c}" opacity="0.5"/>
      <ellipse cx="30" cy="40" rx="11" ry="16" fill="${c}" stroke="#2b2620" stroke-width="2.5" transform="rotate(-15 30 40)"/>
      <ellipse cx="70" cy="40" rx="11" ry="16" fill="${c}" stroke="#2b2620" stroke-width="2.5" transform="rotate(15 70 40)"/>
      <ellipse cx="30" cy="40" rx="6" ry="11" fill="#e8d5b8" transform="rotate(-15 30 40)"/>
      <ellipse cx="70" cy="40" rx="6" ry="11" fill="#e8d5b8" transform="rotate(15 70 40)"/>
      <ellipse cx="50" cy="46" rx="20" ry="16" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="54" rx="12" ry="9" fill="#e8d5b8" stroke="#2b2620" stroke-width="1.5"/>
      <g ${eo}><circle cx="40" cy="44" r="5" fill="#2b2620"/><circle cx="60" cy="44" r="5" fill="#2b2620"/><circle cx="41.5" cy="42.5" r="2.2" fill="#fff"/><circle cx="61.5" cy="42.5" r="2.2" fill="#fff"/></g>
      <g ${ec}><path d="M35 44 Q40 48 45 44" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M55 44 Q60 48 65 44" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="50" rx="5" ry="4" fill="#2b2620"/>
      <ellipse cx="49" cy="49" rx="2" ry="1.5" fill="#555" opacity="0.4"/>
      <path d="M47 54 Q50 57 53 54" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="34" cy="50" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.35"/>
      <ellipse cx="66" cy="50" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.35"/>
      <ellipse cx="36" cy="84" rx="8" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="64" cy="84" rx="8" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    rabbit: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <circle cx="74" cy="70" r="7" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <circle cx="74" cy="70" r="4" fill="#fff" opacity="0.3"/>
      <ellipse cx="50" cy="68" rx="22" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="38" cy="20" rx="8" ry="22" fill="${c}" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="62" cy="20" rx="8" ry="22" fill="${c}" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="38" cy="20" rx="4.5" ry="16" fill="#ffd5c9" opacity="0.8"/>
      <ellipse cx="62" cy="20" rx="4.5" ry="16" fill="#ffd5c9" opacity="0.8"/>
      <ellipse cx="50" cy="50" rx="20" ry="16" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <g ${eo}><circle cx="42" cy="48" r="4.5" fill="#2b2620"/><circle cx="58" cy="48" r="4.5" fill="#2b2620"/><circle cx="43" cy="46.5" r="2" fill="#fff"/><circle cx="59" cy="46.5" r="2" fill="#fff"/></g>
      <g ${ec}><path d="M37 48 Q42 52 47 48" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M53 48 Q58 52 63 48" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="54" rx="3" ry="2.5" fill="#ffd5c9"/>
      <path d="M48 56 Q50 59 52 56" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="35" cy="52" rx="5" ry="3" fill="#ffd5c9" opacity="0.5"/>
      <ellipse cx="65" cy="52" rx="5" ry="3" fill="#ffd5c9" opacity="0.5"/>
      <ellipse cx="38" cy="86" rx="8" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="62" cy="86" rx="8" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    panda: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="#f8f5f0"/><stop offset="100%" stop-color="#ece8e0"/></radialGradient></defs>
      <ellipse cx="50" cy="66" rx="26" ry="22" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="26" cy="68" rx="8" ry="12" fill="#2b2620" transform="rotate(-10 26 68)"/>
      <ellipse cx="74" cy="68" rx="8" ry="12" fill="#2b2620" transform="rotate(10 74 68)"/>
      <circle cx="30" cy="32" r="10" fill="#2b2620"/>
      <circle cx="70" cy="32" r="10" fill="#2b2620"/>
      <ellipse cx="50" cy="46" rx="22" ry="18" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="38" cy="46" rx="10" ry="8" fill="#2b2620" transform="rotate(-8 38 46)"/>
      <ellipse cx="62" cy="46" rx="10" ry="8" fill="#2b2620" transform="rotate(8 62 46)"/>
      <g ${eo}><circle cx="38" cy="46" r="4" fill="#fff"/><circle cx="62" cy="46" r="4" fill="#fff"/><circle cx="39" cy="45" r="2.5" fill="#2b2620"/><circle cx="63" cy="45" r="2.5" fill="#2b2620"/></g>
      <g ${ec}><path d="M33 46 Q38 50 43 46" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M57 46 Q62 50 67 46" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="53" rx="4" ry="3" fill="#2b2620"/>
      <path d="M47 56 Q50 59 53 56" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="32" cy="52" rx="5" ry="3" fill="${c}" opacity="0.5"/>
      <ellipse cx="68" cy="52" rx="5" ry="3" fill="${c}" opacity="0.5"/>
      <ellipse cx="36" cy="84" rx="8" ry="6" fill="#2b2620"/>
      <ellipse cx="64" cy="84" rx="8" ry="6" fill="#2b2620"/>
    </svg>`,

    fox: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <path d="M74 64 Q90 48 86 34 Q82 42 78 40 Q84 48 78 62" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <path d="M84 36 Q82 42 86 34" fill="#f5f2ed" stroke="#2b2620" stroke-width="1.5"/>
      <ellipse cx="50" cy="66" rx="24" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="70" rx="12" ry="10" fill="#f5f2ed" opacity="0.6"/>
      <polygon points="30,38 16,6 44,30" fill="${c}" stroke="#2b2620" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="70,38 84,6 56,30" fill="${c}" stroke="#2b2620" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="30,38 20,14 40,30" fill="#f5eedf"/>
      <polygon points="70,38 80,14 60,30" fill="#f5eedf"/>
      <ellipse cx="50" cy="48" rx="20" ry="16" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <path d="M34 48 Q50 72 66 48" fill="#f5f2ed" stroke="#2b2620" stroke-width="1.5"/>
      <g ${eo}><ellipse cx="40" cy="44" rx="4.5" ry="5" fill="#2b2620"/><ellipse cx="60" cy="44" rx="4.5" ry="5" fill="#2b2620"/><ellipse cx="41.5" cy="42.5" rx="2" ry="2.2" fill="#fff"/><ellipse cx="61.5" cy="42.5" rx="2" ry="2.2" fill="#fff"/></g>
      <g ${ec}><path d="M35 44 Q40 48 45 44" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M55 44 Q60 48 65 44" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="50" rx="3.5" ry="2.5" fill="#2b2620"/>
      <path d="M47 53 Q50 56 53 53" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="34" cy="50" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.35"/>
      <ellipse cx="66" cy="50" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.35"/>
      <ellipse cx="38" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="62" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    bear: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <ellipse cx="50" cy="66" rx="28" ry="24" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="72" rx="16" ry="12" fill="${c}" opacity="0.5"/>
      <circle cx="30" cy="28" r="10" fill="${c}" stroke="#2b2620" stroke-width="2.5"/>
      <circle cx="70" cy="28" r="10" fill="${c}" stroke="#2b2620" stroke-width="2.5"/>
      <circle cx="30" cy="28" r="6" fill="${c}" opacity="0.6"/>
      <circle cx="70" cy="28" r="6" fill="${c}" opacity="0.6"/>
      <ellipse cx="50" cy="46" rx="24" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <g ${eo}><circle cx="40" cy="44" r="4" fill="#2b2620"/><circle cx="60" cy="44" r="4" fill="#2b2620"/><circle cx="41" cy="43" r="1.8" fill="#fff"/><circle cx="61" cy="43" r="1.8" fill="#fff"/></g>
      <g ${ec}><path d="M36 44 Q40 48 44 44" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M56 44 Q60 48 64 44" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="52" rx="6" ry="4" fill="#2b2620"/>
      <ellipse cx="49" cy="51" rx="2.5" ry="1.5" fill="#555" opacity="0.3"/>
      <path d="M46 56 Q50 59 54 56" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="33" cy="52" rx="5" ry="3" fill="#ffd5c9" opacity="0.4"/>
      <ellipse cx="67" cy="52" rx="5" ry="3" fill="#ffd5c9" opacity="0.4"/>
      <ellipse cx="36" cy="86" rx="9" ry="6" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="64" cy="86" rx="9" ry="6" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    owl: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <ellipse cx="50" cy="68" rx="22" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="48" rx="24" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <polygon points="32,36 22,8 42,30" fill="${c}" stroke="#2b2620" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="68,36 78,8 58,30" fill="${c}" stroke="#2b2620" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="32,36 26,14 40,30" fill="${c}" opacity="0.6"/>
      <polygon points="68,36 74,14 60,30" fill="${c}" opacity="0.6"/>
      <circle cx="38" cy="46" r="12" fill="#fff" stroke="#2b2620" stroke-width="2"/>
      <circle cx="62" cy="46" r="12" fill="#fff" stroke="#2b2620" stroke-width="2"/>
      <g ${eo}><circle cx="38" cy="46" r="6" fill="#2b2620"/><circle cx="62" cy="46" r="6" fill="#2b2620"/><circle cx="40" cy="44" r="2.5" fill="#fff"/><circle cx="64" cy="44" r="2.5" fill="#fff"/></g>
      <g ${ec}><path d="M32 46 Q38 50 44 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M56 46 Q62 50 68 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <polygon points="47,54 50,60 53,54" fill="#f5c060" stroke="#2b2620" stroke-width="1.5"/>
      <ellipse cx="50" cy="70" rx="10" ry="8" fill="${c}" opacity="0.4"/>
      <path d="M36 68 Q38 74 36 80" fill="none" stroke="#2b2620" stroke-width="1.5"/>
      <path d="M64 68 Q62 74 64 80" fill="none" stroke="#2b2620" stroke-width="1.5"/>
      <ellipse cx="40" cy="86" rx="7" ry="4" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="60" cy="86" rx="7" ry="4" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    penguin: () => `<svg viewBox="0 0 100 100">
      <ellipse cx="50" cy="66" rx="24" ry="24" fill="#2b2620" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="68" rx="16" ry="18" fill="#f8f5f0"/>
      <ellipse cx="50" cy="46" rx="22" ry="18" fill="#2b2620" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="50" rx="14" ry="10" fill="#f8f5f0"/>
      <g ${eo}><circle cx="40" cy="44" r="4.5" fill="#fff"/><circle cx="60" cy="44" r="4.5" fill="#fff"/><circle cx="41" cy="43" r="2.5" fill="#2b2620"/><circle cx="61" cy="43" r="2.5" fill="#2b2620"/></g>
      <g ${ec}><path d="M36 44 Q40 48 44 44" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M56 44 Q60 48 64 44" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g>
      <polygon points="47,50 50,56 53,50" fill="${c}" stroke="#2b2620" stroke-width="1.5"/>
      <ellipse cx="26" cy="66" rx="8" ry="14" fill="#2b2620" stroke="#2b2620" stroke-width="1.5" transform="rotate(-10 26 66)"/>
      <ellipse cx="74" cy="66" rx="8" ry="14" fill="#2b2620" stroke="#2b2620" stroke-width="1.5" transform="rotate(10 74 66)"/>
      <ellipse cx="40" cy="88" rx="8" ry="4" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="60" cy="88" rx="8" ry="4" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="40" cy="44" rx="3" ry="3" fill="${c}" opacity="0.6"/>
      <ellipse cx="60" cy="44" rx="3" ry="3" fill="${c}" opacity="0.6"/>
    </svg>`,

    hamster: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <ellipse cx="50" cy="66" rx="24" ry="22" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="70" rx="14" ry="12" fill="#fff" opacity="0.4"/>
      <circle cx="28" cy="42" r="12" fill="${c}" stroke="#2b2620" stroke-width="2.5"/>
      <circle cx="72" cy="42" r="12" fill="${c}" stroke="#2b2620" stroke-width="2.5"/>
      <circle cx="28" cy="42" r="7" fill="#ffd5c9" opacity="0.7"/>
      <circle cx="72" cy="42" r="7" fill="#ffd5c9" opacity="0.7"/>
      <ellipse cx="50" cy="48" rx="22" ry="18" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <g ${eo}><circle cx="40" cy="46" r="4" fill="#2b2620"/><circle cx="60" cy="46" r="4" fill="#2b2620"/><circle cx="41" cy="45" r="1.8" fill="#fff"/><circle cx="61" cy="45" r="1.8" fill="#fff"/></g>
      <g ${ec}><path d="M36 46 Q40 50 44 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M56 46 Q60 50 64 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="52" rx="3" ry="2" fill="#2b2620"/>
      <path d="M47 54 Q50 57 53 54" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="35" cy="52" rx="5" ry="3" fill="#ffd5c9" opacity="0.5"/>
      <ellipse cx="65" cy="52" rx="5" ry="3" fill="#ffd5c9" opacity="0.5"/>
      <ellipse cx="38" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="62" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    hedgehog: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <ellipse cx="50" cy="66" rx="26" ry="22" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="70" rx="14" ry="12" fill="${c}" opacity="0.5"/>
      <line x1="50" y1="30" x2="50" y2="22" stroke="#2b2620" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="30" x2="40" y2="20" stroke="#2b2620" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="30" x2="60" y2="20" stroke="#2b2620" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="30" x2="35" y2="24" stroke="#2b2620" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="30" x2="65" y2="24" stroke="#2b2620" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="30" x2="30" y2="28" stroke="#5a5349" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="50" y1="30" x2="70" y2="28" stroke="#5a5349" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="50" cy="48" rx="22" ry="18" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <g ${eo}><circle cx="40" cy="46" r="4" fill="#2b2620"/><circle cx="60" cy="46" r="4" fill="#2b2620"/><circle cx="41" cy="45" r="1.8" fill="#fff"/><circle cx="61" cy="45" r="1.8" fill="#fff"/></g>
      <g ${ec}><path d="M36 46 Q40 50 44 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M56 46 Q60 50 64 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="52" rx="4" ry="3" fill="#2b2620"/>
      <path d="M47 55 Q50 58 53 55" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="34" cy="52" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.4"/>
      <ellipse cx="66" cy="52" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.4"/>
      <ellipse cx="38" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="62" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    raccoon: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <path d="M74 64 Q88 54 86 42 Q82 48 78 46 Q84 52 78 62" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <path d="M82 44 Q80 48 84 42" fill="#f5f2ed" stroke="#2b2620" stroke-width="1.5"/>
      <ellipse cx="50" cy="66" rx="24" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="70" rx="12" ry="10" fill="#f5f2ed" opacity="0.5"/>
      <ellipse cx="30" cy="36" rx="8" ry="10" fill="${c}" stroke="#2b2620" stroke-width="2" transform="rotate(-10 30 36)"/>
      <ellipse cx="70" cy="36" rx="8" ry="10" fill="${c}" stroke="#2b2620" stroke-width="2" transform="rotate(10 70 36)"/>
      <ellipse cx="50" cy="48" rx="20" ry="16" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="38" cy="46" rx="9" ry="7" fill="#2b2620" opacity="0.8" transform="rotate(-8 38 46)"/>
      <ellipse cx="62" cy="46" rx="9" ry="7" fill="#2b2620" opacity="0.8" transform="rotate(8 62 46)"/>
      <g ${eo}><circle cx="38" cy="46" r="4" fill="#fff"/><circle cx="62" cy="46" r="4" fill="#fff"/><circle cx="39" cy="45" r="2.5" fill="#2b2620"/><circle cx="63" cy="45" r="2.5" fill="#2b2620"/></g>
      <g ${ec}><path d="M34 46 Q38 50 42 46" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M58 46 Q62 50 66 46" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g>
      <path d="M38 52 L50 56 L62 52" fill="none" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="50" cy="53" rx="3" ry="2" fill="#2b2620"/>
      <path d="M47 55 Q50 58 53 55" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="38" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="62" cy="84" rx="7" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,

    deer: () => `<svg viewBox="0 0 100 100">
      <defs><radialGradient id="g-${id}" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="${c}dd"/></radialGradient></defs>
      <ellipse cx="50" cy="66" rx="22" ry="20" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="50" cy="70" rx="12" ry="10" fill="#f5f2ed" opacity="0.5"/>
      <path d="M30 34 L24 10 M24 10 L20 4 M24 10 L28 6" fill="none" stroke="#8b6b4a" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M70 34 L76 10 M76 10 L80 4 M76 10 L72 6" fill="none" stroke="#8b6b4a" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="50" cy="48" rx="20" ry="16" fill="url(#g-${id})" stroke="#2b2620" stroke-width="2.5"/>
      <ellipse cx="34" cy="40" rx="6" ry="8" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="66" cy="40" rx="6" ry="8" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <g ${eo}><circle cx="40" cy="46" r="5" fill="#2b2620"/><circle cx="60" cy="46" r="5" fill="#2b2620"/><circle cx="41.5" cy="44.5" r="2.2" fill="#fff"/><circle cx="61.5" cy="44.5" r="2.2" fill="#fff"/></g>
      <g ${ec}><path d="M35 46 Q40 50 45 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/><path d="M55 46 Q60 50 65 46" fill="none" stroke="#2b2620" stroke-width="2.5" stroke-linecap="round"/></g>
      <ellipse cx="50" cy="52" rx="4" ry="3" fill="#2b2620"/>
      <path d="M47 55 Q50 58 53 55" fill="none" stroke="#2b2620" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="34" cy="52" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.5"/>
      <ellipse cx="66" cy="52" rx="4" ry="2.5" fill="#ffd5c9" opacity="0.5"/>
      <ellipse cx="38" cy="84" rx="6" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
      <ellipse cx="62" cy="84" rx="6" ry="5" fill="${c}" stroke="#2b2620" stroke-width="2"/>
    </svg>`,
  };

  return (generators[type] || generators.cat)();
}

/** React 组件版本 */
export default function AnimalSVG({ type, color, size }: AnimalSVGProps) {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: makeAnimalSVG(type, color) }}
      style={{ display: 'inline-block', lineHeight: 0, width: size, height: size }}
    />
  );
}
