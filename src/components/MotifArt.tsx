import type { TopicTheme } from '../types';

/** Static, low-contrast header motif per lesson (no animation behind text). */
export default function MotifArt({ motif }: { motif: TopicTheme['motif'] }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const };
  const shapes: Record<TopicTheme['motif'], React.ReactNode> = {
    branch: <path {...p} d="M10 70 C40 60 50 30 80 28 M50 50 C70 60 80 80 110 84 M80 28 C95 20 105 10 120 8 M80 28 C100 34 115 40 130 52 M110 84 C130 86 140 96 150 110" />,
    signal: <path {...p} d="M0 60 H40 L50 30 L62 90 L74 45 L82 60 H160" />,
    spine: <g {...p}>{[10, 30, 50, 70, 90].map((y) => <rect key={y} x="60" y={y} width="40" height="14" rx="6" />)}<path d="M80 0 V120" /></g>,
    brain: <path {...p} d="M30 80 C10 60 25 25 60 22 C75 5 110 8 120 25 C150 28 155 65 135 80 C130 100 90 105 75 95 C60 105 35 100 30 80 Z M60 22 C65 45 55 60 75 95 M120 25 C105 45 115 60 95 70" />,
    hemi: <g {...p}><path d="M78 20 C40 20 20 50 30 80 C40 100 70 104 78 96 Z" /><path d="M82 20 C120 20 140 50 130 80 C120 100 90 104 82 96 Z" /></g>,
    health: <g {...p}><path d="M80 30 V90 M50 60 H110" /><circle cx="80" cy="60" r="44" /></g>,
    chain: <g {...p}>{[20, 55, 90, 125].map((x) => <circle key={x} cx={x} cy="60" r="13" />)}<path d="M33 60 H42 M68 60 H77 M103 60 H112" /></g>,
    assoc: <g {...p}><circle cx="45" cy="60" r="20" /><circle cx="115" cy="60" r="20" /><path d="M65 60 C80 40 85 40 95 60" strokeDasharray="4 5" /></g>,
    mind: <g {...p}><circle cx="80" cy="60" r="10" />{[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d={`M80 60 L${80 + Math.cos((a * Math.PI) / 180) * 45} ${60 + Math.sin((a * Math.PI) / 180) * 45}`} />)}</g>,
    emotion: <path {...p} d="M10 60 C30 20 50 100 70 60 S110 20 130 60 S150 90 160 70" />,
    memory: <g {...p}>{[[30, 40], [70, 25], [110, 45], [50, 85], [100, 90], [140, 70]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6" />)}<path d="M30 40 L70 25 L110 45 L140 70 L100 90 L50 85 L30 40 M70 25 L50 85 M110 45 L100 90" /></g>,
    sleep: <g {...p}><path d="M95 20 A40 40 0 1 0 120 80 A32 32 0 1 1 95 20 Z" /><path d="M20 100 Q40 90 60 100 T100 100 T140 100" /></g>,
    balance: <g {...p}><path d="M80 20 V100 M40 40 H120" /><path d="M40 40 L25 70 H55 Z M120 40 L105 70 H135 Z" /></g>,
    flow: <g {...p}><path d="M10 60 C40 30 60 90 90 60 S140 30 160 60" /><circle cx="90" cy="60" r="6" /><circle cx="140" cy="45" r="4" /></g>,
    calc: <g {...p}><rect x="40" y="20" width="80" height="80" rx="10" /><path d="M55 45 H75 M65 35 V55 M90 45 H105 M55 80 H75 M90 75 H105 M90 85 H105" /></g>,
    helix: <g {...p}><path d="M50 0 C110 30 50 60 110 90 S50 120 50 120" /><path d="M110 0 C50 30 110 60 50 90 S110 120 110 120" />{[15, 45, 75, 105].map((y) => <path key={y} d={`M62 ${y} H98`} />)}</g>,
    codon: <g {...p}>{[10, 45, 80, 115].map((x) => <rect key={x} x={x} y="70" width="30" height="16" rx="4" />)}<path d="M60 70 V45 C60 30 100 30 100 45 V70" /></g>,
    split: <g {...p}><circle cx="55" cy="60" r="34" /><circle cx="105" cy="60" r="34" /></g>,
    meiosis: <g {...p}>{[[45, 35], [115, 35], [45, 85], [115, 85]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="20" />)}</g>,
    lens: <g {...p}><circle cx="80" cy="60" r="42" /><circle cx="80" cy="60" r="28" strokeDasharray="3 4" /><path d="M110 90 L140 115" /></g>,
    compare: <g {...p}><circle cx="45" cy="60" r="30" /><path d="M80 15 V105" strokeDasharray="4 4" /><circle cx="115" cy="45" r="15" /><circle cx="115" cy="80" r="15" /></g>,
  };
  return (
    <svg viewBox="0 0 160 120" className="motif" aria-hidden="true">
      {shapes[motif]}
    </svg>
  );
}
