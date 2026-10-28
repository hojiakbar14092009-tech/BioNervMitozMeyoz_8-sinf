import type { Chromatid, Frame } from './stages';

function ChromatidShape({ c }: { c: Chromatid }) {
  const w = 0.07 * Math.max(c.scale, 0.35);
  const half = (c.len * (0.5 + c.scale * 0.5)) / 2;
  const deg = (c.rot * 180) / Math.PI;
  return (
    <g transform={`translate(${c.x} ${-c.y}) rotate(${-deg})`} opacity={c.scale < 0.4 ? 0.55 : 1}>
      <rect x={-half} y={-w / 2} width={half * 2} height={w} rx={w / 2} fill={`var(--chr-${c.color})`} />
      {c.tip && <rect x={half * 0.25} y={-w / 2} width={half * 0.75} height={w} rx={w / 2} fill={`var(--chr-${c.tip})`} />}
    </g>
  );
}

/** Schematic cell-division frame; y axis points up like the 3D scene. */
export default function DivisionSVG({ frame, label, compact = false }: { frame: Frame; label?: string; compact?: boolean }) {
  const wide = frame.cells.some((c) => Math.abs(c.x) > 0.8);
  const vb = wide ? '-2 -1.25 4 2.5' : '-1.25 -1.25 2.5 2.5';
  return (
    <svg viewBox={vb} className="division-svg" role="img" aria-label={label ?? `${frame.name}: ${frame.formula}`}>
      {frame.cells.map((cell, i) => (
        <g key={i}>
          <circle cx={cell.x} cy={-cell.y} r={cell.r} className="svg-cell" />
          {cell.nucleus > 0 && <circle cx={cell.x} cy={-cell.y} r={cell.r * 0.5} className="svg-nucleus" opacity={cell.nucleus} />}
          {cell.poles?.map(([px, py], k) => (
            <g key={k}>
              <circle cx={px} cy={-py} r={0.035} className="svg-pole" />
              {frame.chromatids
                .filter((c) => Math.hypot(c.x - cell.x, c.y - cell.y) < cell.r && c.scale > 0.6)
                .filter((c) => {
                  const [ox, oy] = cell.poles![1 - k];
                  return Math.hypot(c.x - px, c.y - py) <= Math.hypot(c.x - ox, c.y - oy) + 0.02;
                })
                .map((c) => (
                  <line key={c.id} x1={px} y1={-py} x2={c.x} y2={-c.y} className="svg-spindle" />
                ))}
            </g>
          ))}
        </g>
      ))}
      {frame.chromatids.map((c) => (
        <ChromatidShape key={c.id} c={c} />
      ))}
      {!compact && (
        <text x={wide ? -1.9 : -1.15} y={wide ? 1.15 : 1.17} className="svg-formula">
          {frame.formula}
        </text>
      )}
    </svg>
  );
}
