import { useState } from 'react';

interface Props {
  currentDpi: number;
  width: number;
  height: number;
  busy: boolean;
  onApply: (dpi: number) => void;
  page?: number;
  numPages?: number;
  onPageChange?: (page: number) => void;
}

const DPI_PRESETS = [72, 96, 150, 200, 300, 600];
const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const hint = 'text-[11px] text-slate-500 dark:text-slate-400';
const input = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30';
const chipBase = 'cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium transition select-none';
const inactive = 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500';
const active = 'border-indigo-600 bg-indigo-600 text-white';

export function ResolutionPanel({ currentDpi, width, height, busy, onApply, page = 1, numPages = 1, onPageChange }: Props) {
  const [selected, setSelected] = useState(currentDpi);
  const [custom, setCustom] = useState('');

  const effective = custom.trim() && Number(custom) >= 36 && Number(custom) <= 1200 ? Math.round(Number(custom)) : selected;
  const changed = effective !== currentDpi;

  return (
    <div className="space-y-2.5 rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-500/5">
      <div className="flex items-center justify-between gap-2">
        <span className={label}>Resolución PDF ({width}×{height} px)</span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{currentDpi} DPI</span>
      </div>

      {numPages > 1 && onPageChange && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
          <span className={hint}>Página</span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">‹</button>
            <input
              type="number"
              min={1}
              max={numPages}
              value={page}
              disabled={busy}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n) && n >= 1 && n <= numPages) onPageChange(n);
              }}
              className={`${input} !w-14 text-center`}
            />
            <span className={hint}>de {numPages}</span>
            <button type="button" disabled={busy || page >= numPages} onClick={() => onPageChange(page + 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">›</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {DPI_PRESETS.map((p) => (
          <label key={p} className={`${chipBase} flex-1 text-center ${!custom && selected === p ? active : inactive}`}>
            <input type="radio" name="dpi-cut" className="sr-only" checked={!custom && selected === p} onChange={() => { setSelected(p); setCustom(''); }} />
            {p}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <input type="number" min={36} max={1200} step={1} value={custom} placeholder="DPI manual (36–1200)" onChange={(e) => setCustom(e.target.value)} className={input} />
        <button
          type="button"
          disabled={busy || !changed}
          onClick={() => onApply(effective)}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? '…' : changed ? `Aplicar ${effective}` : 'Aplicado'}
        </button>
      </div>
    </div>
  );
}
