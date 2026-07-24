import type React from 'react';
import {
  IconBook,
  IconBriefcase,
  IconBuilding,
  IconChart,
  IconChat,
  IconCheck,
  IconClock,
  IconCode,
  IconDocument,
  IconEdit,
  IconFilm,
  IconFire,
  IconGradCap,
  IconGraph,
  IconHome,
  IconImage,
  IconLightbulb,
  IconLink,
  IconMapPin,
  IconRefresh,
  IconRobot,
  IconSettings,
  IconTarget,
  IconWarning,
  IconX,
} from './HandIcons';

export type ProfessionalIconName =
  | 'book'
  | 'briefcase'
  | 'building'
  | 'camera'
  | 'chart'
  | 'chat'
  | 'check'
  | 'clock'
  | 'code'
  | 'coffee'
  | 'document'
  | 'edit'
  | 'film'
  | 'fire'
  | 'grad'
  | 'graph'
  | 'home'
  | 'link'
  | 'map'
  | 'package'
  | 'pin'
  | 'refresh'
  | 'robot'
  | 'settings'
  | 'sleep'
  | 'spark'
  | 'target'
  | 'warning'
  | 'x'
  | 'zap';

interface Props {
  name: ProfessionalIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

function customWrap(
  children: React.ReactNode,
  size = 18,
  className?: string,
  style?: React.CSSProperties,
  title?: string
) {
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
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function IconZapShape({ size, className, style, title }: Omit<Props, 'name'>) {
  return customWrap(<path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z" />, size, className, style, title);
}

function IconPackageShape({ size, className, style, title }: Omit<Props, 'name'>) {
  return customWrap(
    <>
      <path d="M3 7 L12 2 L21 7 L12 12 Z" />
      <path d="M3 7 V17 L12 22 V12" />
      <path d="M21 7 V17 L12 22" />
      <path d="M7.5 4.5 L16.5 9.5" />
    </>,
    size,
    className,
    style,
    title
  );
}

function IconSleepShape({ size, className, style, title }: Omit<Props, 'name'>) {
  return customWrap(
    <>
      <path d="M5 8 H12 L5 16 H12" />
      <path d="M14 5 H20 L14 12 H20" strokeWidth="1.7" />
      <path d="M15 18 H19 L15 22 H19" strokeWidth="1.5" />
    </>,
    size,
    className,
    style,
    title
  );
}

function IconCoffeeShape({ size, className, style, title }: Omit<Props, 'name'>) {
  return customWrap(
    <>
      <path d="M5 8 H16 V14 C16 17 13.8 19 10.5 19 C7.2 19 5 17 5 14 Z" />
      <path d="M16 10 H18 C20 10 21 11 21 12.5 C21 14 20 15 18 15 H16" />
      <path d="M4 21 H18" />
      <path d="M8 3 C7 4 7 5 8 6" strokeWidth="1.5" />
      <path d="M12 3 C11 4 11 5 12 6" strokeWidth="1.5" />
    </>,
    size,
    className,
    style,
    title
  );
}

function IconSparkShape({ size, className, style, title }: Omit<Props, 'name'>) {
  return customWrap(
    <>
      <path d="M12 3 L13.6 9.4 L20 11 L13.6 12.6 L12 19 L10.4 12.6 L4 11 L10.4 9.4 Z" />
      <path d="M5 4 L5.7 6.3 L8 7 L5.7 7.7 L5 10 L4.3 7.7 L2 7 L4.3 6.3 Z" strokeWidth="1.5" />
      <path d="M19 16 L19.5 17.5 L21 18 L19.5 18.5 L19 20 L18.5 18.5 L17 18 L18.5 17.5 Z" strokeWidth="1.5" />
    </>,
    size,
    className,
    style,
    title
  );
}

const iconMap: Record<ProfessionalIconName, React.ComponentType<Omit<Props, 'name'>>> = {
  book: IconBook,
  briefcase: IconBriefcase,
  building: IconBuilding,
  camera: IconImage,
  chart: IconChart,
  chat: IconChat,
  check: IconCheck,
  clock: IconClock,
  code: IconCode,
  coffee: IconCoffeeShape,
  document: IconDocument,
  edit: IconEdit,
  film: IconFilm,
  fire: IconFire,
  grad: IconGradCap,
  graph: IconGraph,
  home: IconHome,
  link: IconLink,
  map: IconMapPin,
  package: IconPackageShape,
  pin: IconMapPin,
  refresh: IconRefresh,
  robot: IconRobot,
  settings: IconSettings,
  sleep: IconSleepShape,
  spark: IconSparkShape,
  target: IconTarget,
  warning: IconWarning,
  x: IconX,
  zap: IconZapShape,
};

export default function ProfessionalIcon({ name, size = 18, className, style, title }: Props) {
  const Icon = iconMap[name];
  return <Icon size={size} className={className} style={style} title={title} />;
}
