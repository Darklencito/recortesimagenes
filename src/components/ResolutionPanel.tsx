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
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const hint = 'text-xs text-slate-500 dark:text-slate-400';
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30';
const chipBase = 'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition select-none';
const inactive = 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500';
const active = 'border-indigo-600 bg-indigo-600 text-white';

export function ResolutionPanel({ currentDpi, width, height, busy, onApply, page = 1, numPages = 1, onPageChange }: Props) {
  const [selected, setSelected] = useState(currentDpi);
  const [custom, setCustom] = useState('');

  const effective = custom.trim() && Number(custom) >= 36 && Number(custom) <= 1200 ? Math.round(Number(custom)) : selected;
  const changed = effective !== currentDpi;

  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Resolución del PDF</h2>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{currentDpi} DPI</span>
      </div>

      {numPages > 1 && onPageChange && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <span className={hint}>Página del PDF</span>
          <div className="mt-1.5 flex items-center gap-2">
            <button type="button" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">‹</button>
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
              className={`${input} !w-20 text-center`}
            />
            <span className={hint}>de {numPages}</span>
            <button type="button" disabled={busy || page >= numPages} onClick={() => onPageChange(page + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">›</button>
          </div>
        </div>
      )}

      <p className={hint}>Actual: {width} × {height} px. Elige el DPI antes de cortar.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {DPI_PRESETS.map((p) => (
          <label key={p} className={`${chipBase} ${!custom && selected === p ? active : inactive}`}>
            <input type="radio" name="dpi-cut" className="sr-only" checked={!custom && selected === p} onChange={() => { setSelected(p); setCustom(''); }} />
            {p}
          </label>
        ))}
      </div>

      <label className="mt-3 block">
        <span className={hint}>DPI personalizado (36–1200)</span>
        <input type="number" min={36} max={1200} step={1} value={custom} placeholder="p. ej. 450" onChange={(e) => setCustom(e.target.value)} className={`${input} mt-1`} />
      </label>

      <button
        type="button"
        disabled={busy || !changed}
        onClick={() => onApply(effective)}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Aplicando…' : changed ? `Aplicar ${effective} DPI` : 'DPI aplicado'}
      </button>
      <p className={`${hint} mt-2`}>Al aplicar se vuelve a rasterizar el PDF y se reinician las guías/cortes. Mayor DPI = más precisión (y más memoria).</p>
    </section>
  );
}
