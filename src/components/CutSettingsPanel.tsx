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
}

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const label = 'text-sm font-medium text-slate-700 dark:text-slate-300';
const hint = 'text-xs text-slate-500 dark:text-slate-400';
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30';
const chipBase = 'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition select-none';
const btn = 'inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSoft = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const btnPrimary = `${btn} bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus:ring-indigo-400`;
const btnDanger = `${btn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-300 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20`;

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function orientationOf(grid: GridConfig): Orientation | null {
  if (grid.rows === 1 && grid.cols > 1) return 'vertical';
  if (grid.cols === 1 && grid.rows > 1) return 'horizontal';
  return null;
}

export function CutSettingsPanel({ source, mode, grid, guides, dividing, onModeChange, onGridChange, onGuidesChange, onDivide, spacing, onSpacingChange }: Props) {
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
    <section className={card}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">2</span>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Plantilla y guías</h2>
      </div>

      <div>
        <span className={label}>Modo de corte</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            { id: 'grid', t: 'Grilla uniforme' },
            { id: 'guides', t: 'Guías arrastrables' },
          ] as const).map((m) => (
            <label key={m.id} className={`${chipBase} rounded-xl text-center ${mode === m.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'}`}>
              <input type="radio" name="cutmode" className="sr-only" checked={mode === m.id} onChange={() => switchMode(m.id)} />
              {m.t}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
        <span className={label}>Dividir en partes iguales</span>
        <div className="mt-2">
          <span className={hint}>Orientación del corte</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <label className={`${chipBase} rounded-xl text-center ${orientation === 'vertical' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'}`}>
              <input type="radio" name="orient" className="sr-only" checked={orientation === 'vertical'} onChange={() => applyParts(parts, 'vertical')} />
              Vertical
              <span className={`block text-[11px] font-normal ${orientation === 'vertical' ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>líneas verticales · columnas</span>
            </label>
            <label className={`${chipBase} rounded-xl text-center ${orientation === 'horizontal' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'}`}>
              <input type="radio" name="orient" className="sr-only" checked={orientation === 'horizontal'} onChange={() => applyParts(parts, 'horizontal')} />
              Horizontal
              <span className={`block text-[11px] font-normal ${orientation === 'horizontal' ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>líneas horizontales · filas</span>
            </label>
          </div>
        </div>
        <div className="mt-3">
          <span className={hint}>Cantidad de partes</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6].map((n) => {
              const active = parts === n && ((orientation === 'vertical' && grid.rows === 1 && grid.cols === n) || (orientation === 'horizontal' && grid.cols === 1 && grid.rows === n));
              return (
                <button key={n} type="button" className={`${chipBase} ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'}`} onClick={() => applyParts(n, orientation)}>
                  {n}
                </button>
              );
            })}
            <input type="number" min={2} max={50} value={parts} onChange={(e) => applyParts(Number(e.target.value) || 2, orientation)} className={`${input} !w-20`} aria-label="Partes personalizadas" />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <span className={label}>Grilla personalizada (filas × columnas)</span>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={hint}>Filas</span>
            <input type="number" min={1} max={50} value={grid.rows} onChange={(e) => applyGrid({ ...grid, rows: Number(e.target.value) || 1 })} className={`${input} mt-1`} />
          </label>
          <label className="block">
            <span className={hint}>Columnas</span>
            <input type="number" min={1} max={50} value={grid.cols} onChange={(e) => applyGrid({ ...grid, cols: Number(e.target.value) || 1 })} className={`${input} mt-1`} />
          </label>
        </div>
        <p className={`${hint} mt-2`}>
          Resultado: <strong className="text-slate-700 dark:text-slate-200">{grid.rows * grid.cols}</strong> cortes ({grid.rows}×{grid.cols}){currentOrient ? ` · ${currentOrient === 'vertical' ? 'líneas verticales' : 'líneas horizontales'}` : ''}.
        </p>
      </div>

      {mode === 'guides' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-500/10">
          <span className={label}>Guías precisas (px de la fuente {source.width}×{source.height})</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btnSoft} onClick={addVertical}>+ Línea vertical</button>
            <button type="button" className={btnSoft} onClick={addHorizontal}>+ Línea horizontal</button>
            <button type="button" className={btnDanger} onClick={() => onGuidesChange({ xs: [], ys: [] })}>Limpiar</button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={source.width - 1} value={xVal} placeholder="X px" onChange={(e) => setXVal(e.target.value)} className={input} />
              <button type="button" className={btnSoft} onClick={() => { addVerticalAt(Number(xVal)); setXVal(''); }}>+X</button>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={source.height - 1} value={yVal} placeholder="Y px" onChange={(e) => setYVal(e.target.value)} className={input} />
              <button type="button" className={btnSoft} onClick={() => { addHorizontalAt(Number(yVal)); setYVal(''); }}>+Y</button>
            </div>
          </div>

          {(guides.xs.length > 0 || guides.ys.length > 0) && (
            <div className="mt-3 space-y-1.5">
              {guides.xs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={hint}>X:</span>
                  {guides.xs.map((x, i) => (
                    <button key={`x${x}-${i}`} type="button" onClick={() => removeX(i)} title="Quitar guía" className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-red-300 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {x} ×
                    </button>
                  ))}
                </div>
              )}
              {guides.ys.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={hint}>Y:</span>
                  {guides.ys.map((y, i) => (
                    <button key={`y${y}-${i}`} type="button" onClick={() => removeY(i)} title="Quitar guía" className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-red-300 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {y} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className={`${hint} mt-2`}>Doble clic en la imagen añade una guía · doble clic en una línea la elimina · Ctrl+Z / Ctrl+Y para deshacer/rehacer.</p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
        <span className={label}>Márgenes y sangrado (px de la fuente)</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <label className="block">
            <span className={hint}>Margen</span>
            <input type="number" min={0} max={2000} value={spacing.margin} onChange={(e) => onSpacingChange({ ...spacing, margin: Math.max(0, Number(e.target.value) || 0) })} className={`${input} mt-1`} />
          </label>
          <label className="block">
            <span className={hint}>Separación</span>
            <input type="number" min={0} max={2000} value={spacing.gutter} onChange={(e) => onSpacingChange({ ...spacing, gutter: Math.max(0, Number(e.target.value) || 0) })} className={`${input} mt-1`} />
          </label>
          <label className="block">
            <span className={hint}>Sangrado</span>
            <input type="number" min={0} max={2000} value={spacing.bleed} onChange={(e) => onSpacingChange({ ...spacing, bleed: Math.max(0, Number(e.target.value) || 0) })} className={`${input} mt-1`} />
          </label>
        </div>
        <p className={`${hint} mt-2`}>Margen = borde exterior · Separación = hueco entre piezas · Sangrado = expansión para imprenta (solapa). Déjalos en 0 para cortes exactos.</p>
      </div>

      <button type="button" onClick={onDivide} disabled={dividing} className={`${btnPrimary} mt-5 w-full py-3 text-[15px]`}>
        {dividing ? 'Dividiendo…' : 'Dividir imagen'}
      </button>
    </section>
  );
}
