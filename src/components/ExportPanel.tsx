import type { OutputFormat, ResizeConfig, ResizeMode } from '../types';

interface Props {
  format: OutputFormat;
  quality: number; // 0..1
  background: string;
  resize: ResizeConfig;
  referenceDpi: number;
  hasSlices: boolean;
  busy: boolean;
  onFormatChange: (f: OutputFormat) => void;
  onQualityChange: (q: number) => void;
  onBackgroundChange: (color: string) => void;
  onResizeChange: (r: ResizeConfig) => void;
  onApply: () => void;
  onDownloadZip: () => void;
  hideActions?: boolean;
}

const FORMATS: Array<{ value: OutputFormat; label: string; sub: string }> = [
  { value: 'image/png', label: 'PNG', sub: 'sin pérdida' },
  { value: 'image/jpeg', label: 'JPG', sub: 'compatible' },
  { value: 'image/webp', label: 'WEBP', sub: 'ligero' },
];

const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const hint = 'text-[11px] text-slate-500 dark:text-slate-400';
const chipBase = 'cursor-pointer rounded-xl border px-2.5 py-1.5 text-center text-xs font-medium transition select-none';
const btn = 'inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

export function ExportPanel({ format, quality, background, resize, referenceDpi, hasSlices, busy, onFormatChange, onQualityChange, onBackgroundChange, onResizeChange, onApply, onDownloadZip, hideActions = false }: Props) {
  const qualityPct = Math.round(quality * 100);
  const lossy = format !== 'image/png';

  return (
    <div className="space-y-3.5">
      <div>
        <span className={label}>Formato de salida</span>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {FORMATS.map((f) => (
            <label key={f.value} className={`${chipBase} ${format === f.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'}`}>
              <input type="radio" name="fmt" className="sr-only" checked={format === f.value} onChange={() => onFormatChange(f.value)} />
              <span className="block font-semibold">{f.label}</span>
              <span className={`block text-[10px] font-normal ${format === f.value ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>{f.sub}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <label htmlFor="quality" className={label}>
          Calidad {lossy ? <span className="text-indigo-600 dark:text-indigo-400">{qualityPct}%</span> : <span className="font-normal normal-case text-slate-500 dark:text-slate-400">(PNG sin pérdida)</span>}
        </label>
        <div className="mt-1.5 flex items-center gap-2.5">
          <input id="quality" type="range" min={1} max={100} value={qualityPct} disabled={!lossy} onChange={(e) => onQualityChange(Number(e.target.value) / 100)} className="h-2 w-full accent-indigo-600 disabled:opacity-40" />
          <input type="number" min={1} max={100} value={qualityPct} disabled={!lossy} onChange={(e) => onQualityChange(Math.min(100, Math.max(1, Number(e.target.value) || 92)) / 100)} className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-xs shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800" />
        </div>
        <p className={`${hint} mt-1`}>
          {lossy ? 'La vista previa y el peso se actualizan automáticamente.' : 'Cambia a JPG o WEBP para comprimir tamaño.'}
        </p>
      </div>

      {format === 'image/jpeg' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
          <label htmlFor="bgcolor" className={label}>Fondo para transparencias (JPG)</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input id="bgcolor" type="color" value={background} onChange={(e) => onBackgroundChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" />
            <input type="text" value={background} onChange={(e) => onBackgroundChange(e.target.value)} className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs uppercase shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            <div className="flex gap-1.5">
              {['#ffffff', '#000000', '#f1f5f9'].map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => onBackgroundChange(c)} className="h-6 w-6 rounded-full border border-slate-300 dark:border-slate-600" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <span className={label}>Tamaño de salida (por corte)</span>
        <div className="mt-1.5 flex items-center gap-2">
          <select
            value={resize.mode}
            onChange={(e) => onResizeChange({ ...resize, mode: e.target.value as ResizeMode })}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="original">Original</option>
            <option value="widthPx">Ancho (px)</option>
            <option value="heightPx">Alto (px)</option>
            <option value="widthCm">Ancho (cm)</option>
            <option value="heightCm">Alto (cm)</option>
          </select>
          <input
            type="number"
            min={0}
            step={resize.mode === 'widthCm' || resize.mode === 'heightCm' ? 0.1 : 1}
            value={resize.value || ''}
            disabled={resize.mode === 'original'}
            placeholder="valor"
            onChange={(e) => onResizeChange({ ...resize, value: Number(e.target.value) || 0 })}
            className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800"
          />
        </div>
        {resize.mode !== 'original' && (
          <p className={`${hint} mt-1`}>
            Mantiene proporción. {(resize.mode === 'widthCm' || resize.mode === 'heightCm') ? `Base ${referenceDpi} DPI.` : 'Redimensiona cada pieza.'}
          </p>
        )}
      </div>

      {!hideActions && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`} onClick={onApply} disabled={busy}>
              {busy ? 'Procesando…' : 'Actualizar vista'}
            </button>
            <button type="button" className={`${btn} bg-indigo-600 text-white shadow-xs hover:bg-indigo-500`} onClick={onDownloadZip} disabled={busy}>
              {busy ? 'Procesando…' : 'Descargar ZIP'}
            </button>
          </div>
          {!hasSlices && <p className={hint}>Divide primero o descarga directo en ZIP.</p>}
        </>
      )}
    </div>
  );
}
