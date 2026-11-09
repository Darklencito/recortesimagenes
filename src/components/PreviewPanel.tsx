import { useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import type { SliceResult } from '../types';
import { formatBytes } from '../utils/format';

interface Props {
  slices: SliceResult[];
  dpi: number;
}

const miniBtn = 'flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600';
const modalBtn = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2';

export function PreviewPanel({ slices, dpi }: Props) {
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

  if (slices.length === 0) return null;
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
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Vista previa de cortes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Clic en una miniatura para ampliar. Copia un corte o descárgalo suelto; el ZIP está arriba.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{slices.length} archivos · {formatBytes(totalBytes)}</span>
      </div>
      {copyError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{copyError}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {slices.map((s, i) => (
          <figure key={`${s.filename}-${i}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <button type="button" onClick={() => setActive(i)} className="block w-full cursor-zoom-in bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0]" title="Ampliar">
              <img src={s.url} alt={s.filename} className="block h-32 w-full object-contain" />
            </button>
            <figcaption className="border-t border-slate-100 px-2.5 py-2 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-slate-800 dark:text-slate-200">#{i + 1}</strong>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">r{s.row}·c{s.col}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{s.width}×{s.height} px · {toCm(s.width)}×{toCm(s.height)} cm</div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-300" title={s.filename}>{s.filename}</span>
                <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{formatBytes(s.blob.size)}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button type="button" className={miniBtn} onClick={() => copySlice(s, i)}>
                  {copiedIdx === i ? '¡Copiado!' : 'Copiar'}
                </button>
                <button type="button" className={miniBtn} onClick={() => saveAs(s.blob, s.filename)}>
                  Descargar
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

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
    </section>
  );
}
