import { useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import type { SliceResult } from '../types';
import { formatBytes } from '../utils/format';

interface Props {
  slices: SliceResult[];
  dpi: number;
  onDivide?: () => void;
  busy?: boolean;
  onClose?: () => void;
}

const miniBtn = 'flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600';
const modalBtn = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2';

export function PreviewPanel({ slices, dpi, onDivide, busy, onClose }: Props) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active === null) return;
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActive(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const totalBytes = slices.reduce((acc, s) => acc + s.blob.size, 0);
  const current = active !== null ? slices[active] : null;
  const toCm = (px: number) => ((px / dpi) * 2.54).toFixed(1);

  async function copySlice(s: SliceResult, i: number) {
    setCopyError(null);
    try {
      const bmp = await createImageBitmap(s.blob);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Sin contexto de canvas');
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      const png = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo convertir'))), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((cur) => (cur === i ? null : cur)), 1500);
    } catch {
      setCopyError('No se pudo copiar. Tu navegador puede requerir HTTPS/localhost y permiso de portapapeles.');
    }
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">Cortes generados</h2>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {slices.length > 0 ? `${slices.length} archivos · ${formatBytes(totalBytes)}` : 'Sin cortes generados aún'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Ocultar panel de cortes"
            aria-label="Ocultar panel de cortes"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {copyError && (
        <p className="mx-3 mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{copyError}</p>
      )}

      {slices.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Vista previa de recortes</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Divide la imagen para inspeccionar el peso de cada pieza, copiar al portapapeles o descargar cortes sueltos.
          </p>
          {onDivide && (
            <button
              type="button"
              onClick={onDivide}
              disabled={busy}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? 'Dividiendo…' : 'Dividir ahora (Ctrl+Enter)'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 grid-cols-2 content-start gap-2.5 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-2">
          {slices.map((s, i) => (
            <figure key={`${s.filename}-${i}`} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActive(i)}
                className="block w-full cursor-zoom-in bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0] dark:bg-[linear-gradient(45deg,#0f172a_25%,transparent_25%),linear-gradient(-45deg,#0f172a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0f172a_75%),linear-gradient(-45deg,transparent_75%,#0f172a_75%)]"
                title="Ampliar"
              >
                <img src={s.url} alt={s.filename} className="block h-24 w-full object-contain p-1" />
              </button>
              <figcaption className="flex flex-1 flex-col justify-between border-t border-slate-100 px-2 py-1.5 dark:border-slate-700">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-xs text-slate-800 dark:text-slate-200">#{i + 1}</strong>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">r{s.row}·c{s.col}</span>
                  </div>
                  <div className="truncate text-[10px] text-slate-500 dark:text-slate-400" title={`${s.width}×${s.height} px · ${toCm(s.width)}×${toCm(s.height)} cm`}>
                    {s.width}×{s.height} px
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <span className="truncate text-[10px] font-medium text-slate-600 dark:text-slate-300" title={s.filename}>{s.filename}</span>
                    <span className="shrink-0 rounded bg-indigo-50 px-1 py-0.2 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{formatBytes(s.blob.size)}</span>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1">
                  <button type="button" className={miniBtn} onClick={() => copySlice(s, i)}>
                    {copiedIdx === i ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <button type="button" className={miniBtn} onClick={() => saveAs(s.blob, s.filename)}>
                    Bajar
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {current && active !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Corte #{active + 1} · {current.filename}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{current.width}×{current.height} px · {toCm(current.width)}×{toCm(current.height)} cm · {formatBytes(current.blob.size)}</p>
              </div>
              <button ref={closeBtnRef} type="button" onClick={() => setActive(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-4">
              <img src={current.url} alt={current.filename} className="max-h-[65vh] max-w-full object-contain" />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <button type="button" className={`${modalBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`} onClick={() => copySlice(current, active)}>
                {copiedIdx === active ? '¡Copiado!' : 'Copiar imagen'}
              </button>
              <button type="button" className={`${modalBtn} bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-400`} onClick={() => saveAs(current.blob, current.filename)}>
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
