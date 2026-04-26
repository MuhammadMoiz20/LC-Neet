import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'list'
  | 'play'
  | 'sparkle'
  | 'flame'
  | 'cmd'
  | 'search'
  | 'sun'
  | 'moon'
  | 'chevron-r'
  | 'chevron-l'
  | 'chevron-d'
  | 'arrow-r'
  | 'check'
  | 'x'
  | 'plus'
  | 'reset'
  | 'clock'
  | 'beaker'
  | 'note'
  | 'scratch'
  | 'split'
  | 'panel-r'
  | 'eye'
  | 'eye-off'
  | 'send'
  | 'spark'
  | 'target'
  | 'trend'
  | 'briefcase'
  | 'graph'
  | 'dots'
  | 'panel-l'
  | 'history'
  | 'diff'
  | 'lock'
  | 'tree';

export type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 16, className = '', strokeWidth = 1.6 }: IconProps) {
  const props: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case 'list':
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'play':
      return (
        <svg {...props}>
          <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...props}>
          <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 0 0 12 0c0-5-6-11-6-11z" />
        </svg>
      );
    case 'cmd':
      return (
        <svg {...props}>
          <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...props}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      );
    case 'chevron-r':
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'chevron-l':
      return (
        <svg {...props}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case 'chevron-d':
      return (
        <svg {...props}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case 'arrow-r':
      return (
        <svg {...props}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case 'x':
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'reset':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'beaker':
      return (
        <svg {...props}>
          <path d="M9 3h6M10 3v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-10V3" />
        </svg>
      );
    case 'note':
      return (
        <svg {...props}>
          <path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          <path d="M16 4v4h4" />
        </svg>
      );
    case 'scratch':
      return (
        <svg {...props}>
          <path d="M3 18l9-13 9 13M5.5 14h13" />
        </svg>
      );
    case 'split':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M12 4v16" />
        </svg>
      );
    case 'panel-r':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...props}>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'eye-off':
      return (
        <svg {...props}>
          <path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M9.9 5.1A10 10 0 0 1 22 12a17 17 0 0 1-3.2 3.9M6.6 6.6A18 18 0 0 0 2 12s4 7 10 7c1.7 0 3.3-.4 4.7-1" />
        </svg>
      );
    case 'send':
      return (
        <svg {...props}>
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...props}>
          <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
        </svg>
      );
    case 'target':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'trend':
      return (
        <svg {...props}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'graph':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
        </svg>
      );
    case 'dots':
      return (
        <svg {...props}>
          <circle cx="6" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="18" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'panel-l':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      );
    case 'history':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'diff':
      return (
        <svg {...props}>
          <path d="M12 4v6M12 14v6M9 7l3-3 3 3M9 17l3 3 3-3" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...props}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case 'tree':
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="2" />
          <circle cx="6" cy="13" r="2" />
          <circle cx="18" cy="13" r="2" />
          <circle cx="9" cy="20" r="1.6" />
          <circle cx="15" cy="20" r="1.6" />
          <path d="M12 7v3l-6 3M12 10l6 3M6 14.5l3 4M18 14.5l-3 4" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
