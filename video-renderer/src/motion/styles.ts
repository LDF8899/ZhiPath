import type { CSSProperties } from 'react';
import type { VisualStyleId } from './types';

interface ShowcaseStyleTokens {
  bg: string;
  paper: string;
  paperTint: string;
  panel: string;
  ink: string;
  inkRgb: string;
  pencil: string;
  muted: string;
  line: string;
  grid: string;
  accent: string;
  accentRgb: string;
  accent2: string;
  highlight: string;
  highlightRgb: string;
  blue: string;
  green: string;
  red: string;
  fontBody: string;
  fontDisplay: string;
  fontMono: string;
}

export const SHOWCASE_STYLES: Record<VisualStyleId, ShowcaseStyleTokens> = {
  'editorial-paper': {
    bg: '#fbf6ec', paper: '#fbf6ec', paperTint: '#f5eedf', panel: '#fffdf6',
    ink: '#2b2620', inkRgb: '43, 38, 32', pencil: '#4d473d', muted: '#7a7163',
    line: '#c8bfa9', grid: '#e3d8b8', accent: '#d8482b', accentRgb: '216, 72, 43',
    accent2: '#f9d27c', highlight: '#f9d27c', highlightRgb: '249, 210, 124',
    blue: '#3b6e8e', green: '#4a9d4a', red: '#d8482b',
    fontBody: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    fontDisplay: 'Georgia, "Times New Roman", "Noto Serif SC", serif',
    fontMono: 'Consolas, "IBM Plex Mono", ui-monospace, monospace',
  },
  'precision-mono': {
    bg: '#f4f4f1', paper: '#fafaf8', paperTint: '#e9e9e5', panel: '#ffffff',
    ink: '#141414', inkRgb: '20, 20, 20', pencil: '#454545', muted: '#747474',
    line: '#b8b8b2', grid: '#d8d8d2', accent: '#5b4ff7', accentRgb: '91, 79, 247',
    accent2: '#c7ff4a', highlight: '#d9ff75', highlightRgb: '217, 255, 117',
    blue: '#1677ff', green: '#1f9d62', red: '#e5484d',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
    fontDisplay: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
    fontMono: '"JetBrains Mono", Consolas, ui-monospace, monospace',
  },
  'terminal-grid': {
    bg: '#080d0a', paper: '#0b120e', paperTint: '#101a14', panel: '#0d1711',
    ink: '#e8f5eb', inkRgb: '232, 245, 235', pencil: '#b1c4b6', muted: '#758a7b',
    line: '#2b4634', grid: '#183321', accent: '#70f28b', accentRgb: '112, 242, 139',
    accent2: '#ffd166', highlight: '#d7ff72', highlightRgb: '215, 255, 114',
    blue: '#50c8ff', green: '#70f28b', red: '#ff6b6b',
    fontBody: '"IBM Plex Sans", "Segoe UI", "PingFang SC", sans-serif',
    fontDisplay: '"JetBrains Mono", Consolas, ui-monospace, monospace',
    fontMono: '"JetBrains Mono", Consolas, ui-monospace, monospace',
  },
  'cinematic-product': {
    bg: '#0e1015', paper: '#151820', paperTint: '#1d222c', panel: '#171b23',
    ink: '#f5f6f8', inkRgb: '245, 246, 248', pencil: '#c4c8d0', muted: '#858b98',
    line: '#3a414f', grid: '#252c37', accent: '#ff4d3d', accentRgb: '255, 77, 61',
    accent2: '#f5c451', highlight: '#ffd76a', highlightRgb: '255, 215, 106',
    blue: '#4aa8ff', green: '#54d68b', red: '#ff4d3d',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
    fontDisplay: '"Arial Narrow", "Helvetica Neue", "PingFang SC", sans-serif',
    fontMono: '"JetBrains Mono", Consolas, ui-monospace, monospace',
  },
};

type ShowcaseCssVars = CSSProperties & Record<`--vv-${string}`, string>;

export function showcaseStyleVars(styleId: VisualStyleId): ShowcaseCssVars {
  const style = SHOWCASE_STYLES[styleId];
  return {
    '--vv-bg': style.bg,
    '--vv-paper': style.paper,
    '--vv-paper-tint': style.paperTint,
    '--vv-panel': style.panel,
    '--vv-ink': style.ink,
    '--vv-ink-rgb': style.inkRgb,
    '--vv-pencil': style.pencil,
    '--vv-muted': style.muted,
    '--vv-line': style.line,
    '--vv-grid': style.grid,
    '--vv-accent': style.accent,
    '--vv-accent-rgb': style.accentRgb,
    '--vv-accent-2': style.accent2,
    '--vv-highlight': style.highlight,
    '--vv-highlight-rgb': style.highlightRgb,
    '--vv-blue': style.blue,
    '--vv-green': style.green,
    '--vv-red': style.red,
    '--vv-font-body': style.fontBody,
    '--vv-font-display': style.fontDisplay,
    '--vv-font-mono': style.fontMono,
  };
}
