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
}

const FORMATS: Array<{ value: OutputFormat; label: string; sub: string }> = [
  { value: 'image/png', label: 'PNG', sub: 'sin pérdida' },
  { value: 'image/jpeg', label: 'JPG', sub: 'compatible' },
  { value: 'image/webp', label: 'WEBP', sub: 'ligero' },
];

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const label = 'text-sm font-medium text-slate-700 dark:text-slate-300';
const hint = 'text-xs text-slate-500 dark:text-slate-400';
const chipBase = 'cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-medium transition select-none';
const btn = 'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ExportPanel({ format, quality, background, resize, referenceDpi, hasSlices, busy, onFormatChange, onQualityChange, onBackgroundChange, onResizeChange, onApply, onDownloadZip }: Props) {
  const qualityPct = Math.round(quality * 100);
  const lossy = format !== 'image/png';

  return (
    <section className={card}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">3</span>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Formato y descarga</h2>
      </div>

      <div>
        <span className={label}>Formato de salida</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <label key={f.value} className={`${chipBase} ${format === f.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'}`}>
              <input type="radio" name="fmt" className="sr-only" checked={format === f.value} onChange={() => onFormatChange(f.value)} />
              <span className="block">{f.label}</span>
              <span className={`block text-[11px] font-normal ${format === f.value ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>{f.sub}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="quality" className={label}>
          Calidad {lossy ? <span className="text-indigo-600 dark:text-indigo-400">{qualityPct}%</span> : <span className="font-normal text-slate-500 dark:text-slate-400">(PNG sin pérdida)</span>}
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input id="quality" type="range" min={1} max={100} value={qualityPct} disabled={!lossy} onChange={(e) => onQualityChange(Number(e.target.value) / 100)} className="h-2 w-full accent-indigo-600 disabled:opacity-40" />
          <input type="number" min={1} max={100} value={qualityPct} disabled={!lossy} onChange={(e) => onQualityChange(Math.min(100, Math.max(1, Number(e.target.value) || 92)) / 100)} className="w-20 rounded-xl border border-slate-300 px-2 py-1.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30 dark:disabled:bg-slate-800" />
        </div>
        {!lossy && <p className={`${hint} mt-1.5`}>Cambia a JPG o WEBP para ajustar calidad y reducir tamaño.</p>}
        {lossy && <p className={`${hint} mt-1.5`}>Al mover la calidad la vista previa y el peso se actualizan solos.</p>}
      </div>

      {format === 'image/jpeg' && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <label htmlFor="bgcolor" className={label}>Color de fondo (JPG)</label>
          <div className="mt-2 flex items-center gap-3">
            <input id="bgcolor" type="color" value={background} onChange={(e) => onBackgroundChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800" />
            <input type="text" value={background} onChange={(e) => onBackgroundChange(e.target.value)} className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            <div className="flex gap-1.5">
              {['#ffffff', '#000000', '#f1f5f9'].map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => onBackgroundChange(c)} className="h-7 w-7 rounded-full border border-slate-300 dark:border-slate-600" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <p className={`${hint} mt-2`}>JPG no soporta transparencia: las zonas transparentes se rellenan con este color (evita fondos negros).</p>
        </div>
      )}

      <div className="mt-4">
        <span className={label}>Tamaño de salida (por corte)</span>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={resize.mode}
            onChange={(e) => onResizeChange({ ...resize, mode: e.target.value as ResizeMode })}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
            className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800"
          />
        </div>
        {resize.mode !== 'original' && (
          <p className={`${hint} mt-1.5`}>
            Se mantiene la proporción. {(resize.mode === 'widthCm' || resize.mode === 'heightCm') ? `Conversión con ${referenceDpi} DPI de referencia.` : 'Cada corte se redimensiona a ese valor.'}
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`} onClick={onApply} disabled={busy}>
          {busy ? 'Procesando…' : 'Actualizar vista previa'}
        </button>
        <button type="button" className={`${btn} bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus:ring-indigo-400`} onClick={onDownloadZip} disabled={busy}>
          {busy ? 'Procesando…' : 'Descargar ZIP'}
        </button>
      </div>
      {!hasSlices && <p className={`${hint} mt-3`}>Puedes dividir primero o pulsar “Descargar ZIP” para generar con el formato elegido.</p>}
      <p className={`${hint} mt-2`}>Para enviarlo por WhatsApp o correo, descarga el ZIP y adjúntalo manualmente.</p>
    </section>
  );
}
