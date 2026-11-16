import { useState } from 'react';
import type { CutMode, GridConfig, Guides, SourceImage } from '../types';
import { guidesFromGrid } from '../utils/slicing';
import type { CutSpacing } from '../utils/slicing';

type Orientation = 'vertical' | 'horizontal';

interface Props {
  source: SourceImage;
  mode: CutMode;
  grid: GridConfig;
  guides: Guides;
  dividing: boolean;
  onModeChange: (mode: CutMode) => void;
  onGridChange: (grid: GridConfig) => void;
  onGuidesChange: (guides: Guides) => void;
  onDivide: () => void;
  spacing: CutSpacing;
  onSpacingChange: (sp: CutSpacing) => void;
  hideAction?: boolean;
}

const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const hint = 'text-[11px] text-slate-500 dark:text-slate-400';
const input = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30';
const chipBase = 'cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition select-none';
const btn = 'inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
const btnSoft = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const btnPrimary = `${btn} bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 focus:ring-indigo-400`;
const btnDanger = `${btn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-300 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20`;

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function orientationOf(grid: GridConfig): Orientation | null {
  if (grid.rows === 1 && grid.cols > 1) return 'vertical';
  if (grid.cols === 1 && grid.rows > 1) return 'horizontal';
  return null;
}

export function CutSettingsPanel({ source, mode, grid, guides, dividing, onModeChange, onGridChange, onGuidesChange, onDivide, spacing, onSpacingChange, hideAction = false }: Props) {
  const [parts, setParts] = useState(3);
  const [orientation, setOrientation] = useState<Orientation>('vertical');
  const [xVal, setXVal] = useState('');
  const [yVal, setYVal] = useState('');
  const currentOrient = orientationOf(grid);

  function addVerticalAt(x: number) {
    if (!(x > 0 && x < source.width)) return;
    const xs = Array.from(new Set([...guides.xs, Math.round(x)])).sort((a, b) => a - b);
    onGuidesChange({ ...guides, xs });
  }
  function addHorizontalAt(y: number) {
    if (!(y > 0 && y < source.height)) return;
    const ys = Array.from(new Set([...guides.ys, Math.round(y)])).sort((a, b) => a - b);
    onGuidesChange({ ...guides, ys });
  }
  function removeX(i: number) {
    onGuidesChange({ ...guides, xs: guides.xs.filter((_, idx) => idx !== i) });
  }
  function removeY(i: number) {
    onGuidesChange({ ...guides, ys: guides.ys.filter((_, idx) => idx !== i) });
  }

  function applyGrid(next: GridConfig) {
    const g = { rows: clampInt(next.rows, 1, 50), cols: clampInt(next.cols, 1, 50) };
    onGridChange(g);
    if (mode === 'guides') onGuidesChange(guidesFromGrid(source.width, source.height, g));
  }

  function applyParts(n: number, o: Orientation) {
    const p = clampInt(n, 2, 50);
    setParts(p);
    setOrientation(o);
    applyGrid(o === 'vertical' ? { rows: 1, cols: p } : { rows: p, cols: 1 });
  }

  function switchMode(next: CutMode) {
    if (next === 'guides' && mode === 'grid') onGuidesChange(guidesFromGrid(source.width, source.height, grid));
    onModeChange(next);
  }

  function addVertical() {
    const xs = Array.from(new Set([...guides.xs, Math.round(source.width / 2)])).filter((x) => x > 0 && x < source.width).sort((a, b) => a - b);
    onGuidesChange({ ...guides, xs });
  }
  function addHorizontal() {
    const ys = Array.from(new Set([...guides.ys, Math.round(source.height / 2)])).filter((y) => y > 0 && y < source.height).sort((a, b) => a - b);
    onGuidesChange({ ...guides, ys });
  }

  return (
    <div className="space-y-3.5">
      <div>
        <span className={label}>Modo de corte</span>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {([
            { id: 'grid', t: 'Grilla uniforme' },
            { id: 'guides', t: 'Guías arrastrables' },
          ] as const).map((m) => (
            <label key={m.id} className={`${chipBase} py-1.5 text-center ${mode === m.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'}`}>
              <input type="radio" name="cutmode" className="sr-only" checked={mode === m.id} onChange={() => switchMode(m.id)} />
              {m.t}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center justify-between">
          <span className={label}>Partes iguales</span>
          <div className="flex gap-1">
            {(['vertical', 'horizontal'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => applyParts(parts, o)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${orientation === o ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                {o === 'vertical' ? 'Vertical (cols)' : 'Horizontal (filas)'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {[2, 3, 4, 5, 6].map((n) => {
            const active = parts === n && ((orientation === 'vertical' && grid.rows === 1 && grid.cols === n) || (orientation === 'horizontal' && grid.cols === 1 && grid.rows === n));
            return (
              <button key={n} type="button" className={`${chipBase} flex-1 text-center ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`} onClick={() => applyParts(n, orientation)}>
                {n}
              </button>
            );
          })}
          <input type="number" min={2} max={50} value={parts} onChange={(e) => applyParts(Number(e.target.value) || 2, orientation)} className={`${input} !w-14 text-center`} aria-label="Partes personalizadas" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center justify-between">
          <span className={label}>Grilla (Filas × Columnas)</span>
          <span className={hint}>
            <strong className="text-slate-700 dark:text-slate-200">{grid.rows * grid.cols}</strong> cortes{currentOrient ? ` · ${currentOrient}` : ''}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2">
            <span className={`${hint} w-12 shrink-0`}>Filas</span>
            <input type="number" min={1} max={50} value={grid.rows} onChange={(e) => applyGrid({ ...grid, rows: Number(e.target.value) || 1 })} className={input} />
          </label>
          <label className="flex items-center gap-2">
            <span className={`${hint} w-12 shrink-0`}>Cols</span>
            <input type="number" min={1} max={50} value={grid.cols} onChange={(e) => applyGrid({ ...grid, cols: Number(e.target.value) || 1 })} className={input} />
          </label>
        </div>
      </div>

      {mode === 'guides' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-900/70 dark:bg-amber-500/10">
          <span className={label}>Guías precisas ({source.width}×{source.height} px)</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button type="button" className={btnSoft} onClick={addVertical}>+ Vertical</button>
            <button type="button" className={btnSoft} onClick={addHorizontal}>+ Horizontal</button>
            <button type="button" className={btnDanger} onClick={() => onGuidesChange({ xs: [], ys: [] })}>Limpiar</button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1">
              <input type="number" min={1} max={source.width - 1} value={xVal} placeholder="X px" onChange={(e) => setXVal(e.target.value)} className={input} />
              <button type="button" className={btnSoft} onClick={() => { addVerticalAt(Number(xVal)); setXVal(''); }}>+X</button>
            </div>
            <div className="flex items-center gap-1">
              <input type="number" min={1} max={source.height - 1} value={yVal} placeholder="Y px" onChange={(e) => setYVal(e.target.value)} className={input} />
              <button type="button" className={btnSoft} onClick={() => { addHorizontalAt(Number(yVal)); setYVal(''); }}>+Y</button>
            </div>
          </div>

          {(guides.xs.length > 0 || guides.ys.length > 0) && (
            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto">
              {guides.xs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className={hint}>X:</span>
                  {guides.xs.map((x, i) => (
                    <button key={`x${x}-${i}`} type="button" onClick={() => removeX(i)} title="Quitar guía" className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:border-red-300 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {x} ×
                    </button>
                  ))}
                </div>
              )}
              {guides.ys.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className={hint}>Y:</span>
                  {guides.ys.map((y, i) => (
                    <button key={`y${y}-${i}`} type="button" onClick={() => removeY(i)} title="Quitar guía" className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:border-red-300 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {y} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <span className={label}>Márgenes y sangrado (px)</span>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          <label className="block">
            <span className={hint}>Margen</span>
            <input type="number" min={0} max={2000} value={spacing.margin} onChange={(e) => onSpacingChange({ ...spacing, margin: Math.max(0, Number(e.target.value) || 0) })} className={`${input} mt-0.5`} />
          </label>
          <label className="block">
            <span className={hint}>Separación</span>
            <input type="number" min={0} max={2000} value={spacing.gutter} onChange={(e) => onSpacingChange({ ...spacing, gutter: Math.max(0, Number(e.target.value) || 0) })} className={`${input} mt-0.5`} />
          </label>
          <label className="block">
            <span className={hint}>Sangrado</span>
            <input type="number" min={0} max={2000} value={spacing.bleed} onChange={(e) => onSpacingChange({ ...spacing, bleed: Math.max(0, Number(e.target.value) || 0) })} className={`${input} mt-0.5`} />
          </label>
        </div>
      </div>

      {!hideAction && (
        <button type="button" onClick={onDivide} disabled={dividing} className={`${btnPrimary} w-full py-2.5 text-sm`}>
          {dividing ? 'Dividiendo…' : 'Dividir imagen'}
        </button>
      )}
    </div>
  );
}
