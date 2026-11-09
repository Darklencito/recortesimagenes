import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { SourceImage } from '../types';
// Carga diferida: evita meter pdfjs en el bundle inicial.

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';
const VALID_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const hint = 'text-xs text-slate-500 dark:text-slate-400';
const btnPrimary = 'inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

interface Props {
  onLoaded: (source: SourceImage) => void;
  variant?: 'hero' | 'sidebar';
  /** DPI used for the initial PDF rasterization (adjustable later in ResolutionPanel). */
  pdfDpi: number;
  onBatchLoaded?: (files: File[]) => void;
}

export function UploadPanel({ onLoaded, variant = 'sidebar', pdfDpi, onBatchLoaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  function handleBatchFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0 && onBatchLoaded) onBatchLoaded(files);
  }

  const isPdf = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');
  const isHero = variant === 'hero';

  function isValidFile(f: File) {
    const ext = f.name.toLowerCase().split('.').pop() ?? '';
    return VALID_EXT.includes(ext);
  }

  async function processFile(target: File) {
    if (!isValidFile(target)) {
      setError('Formato no válido. Usa PDF, PNG, JPG o WEBP.');
      return;
    }
    setFile(target);
    setLoading(true);
    setError(null);
    try {
      const pdf = target.type === 'application/pdf' || target.name.toLowerCase().endsWith('.pdf');
      let canvas: HTMLCanvasElement;
      let usedDpi: number | null = null;
      let numPages: number | null = null;
      if (pdf) {
        usedDpi = pdfDpi;
        const { renderPdf } = await import('../utils/loadPdf');
        const r = await renderPdf(target, pdfDpi, 1);
        canvas = r.canvas;
        numPages = r.numPages;
      } else {
        const { loadRasterImage } = await import('../utils/loadImage');
        canvas = await loadRasterImage(target);
      }
      onLoaded({ name: target.name, fileType: target.type || 'unknown', width: canvas.width, height: canvas.height, canvas, pdfDpi: usedDpi, file: target, pdfPage: pdf ? 1 : null, pdfNumPages: numPages });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const friendly = /password|encrypted|protected/i.test(raw)
        ? 'El PDF está protegido con contraseña y no se puede leer.'
        : /invalid|corrupt|missing/i.test(raw)
          ? 'El archivo parece dañado o no es un PDF válido.'
          : raw || 'No se pudo cargar el archivo. Verifica el formato e inténtalo de nuevo.';
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }

  const dropZone = (
    <div
      role="button"
      tabIndex={0}
      aria-label="Arrastra un archivo aquí o haz clic para seleccionar"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed transition ${
        dragActive ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100 dark:bg-indigo-500/10 dark:ring-indigo-500/20' : 'border-slate-300 bg-slate-50/60 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10'
      } ${isHero ? 'flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center' : 'p-4 text-center'}`}
    >
      <div className={`mx-auto flex items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 transition group-hover:scale-105 dark:bg-indigo-500/20 dark:text-indigo-300 ${isHero ? 'mb-4 h-16 w-16' : 'mb-2 h-11 w-11'}`}>
        {loading ? (
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        ) : (
          <svg width={isHero ? 30 : 22} height={isHero ? 30 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>
      <p className={`font-semibold text-slate-800 dark:text-slate-200 ${isHero ? 'text-lg' : 'text-sm'}`}>
        {loading ? 'Procesando…' : 'Arrastra y suelta tu archivo'}
      </p>
      <p className={`${hint} ${isHero ? 'mt-1.5 text-sm' : 'mt-1'}`}>
        o haz clic para seleccionar · PDF (Illustrator), PNG, JPG, WEBP
      </p>
      {isHero && (
        <p className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm">
          Suelta aquí para ver la vista previa
        </p>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFile} className="sr-only" tabIndex={-1} />
    </div>
  );

  if (isHero) {
    return (
      <div className="w-full">
        {dropZone}
        {onBatchLoaded && (
          <button type="button" onClick={() => batchInputRef.current?.click()} className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            Procesar por lotes (varios archivos)
          </button>
        )}
        <input ref={batchInputRef} type="file" accept={ACCEPT} multiple onChange={handleBatchFiles} className="sr-only" tabIndex={-1} />
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <section className={card}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">1</span>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Cargar archivo</h2>
      </div>
      {dropZone}

      {file && (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200" title={file.name}>{file.name}</p>
            <p className={hint}>{(file.size / 1024 / 1024).toFixed(2)} MB{isPdf ? ' · PDF' : ''}</p>
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className={`${btnPrimary} mt-4 w-full`}>
        {loading ? 'Procesando…' : file ? 'Cargar otro archivo' : 'Cargar archivo'}
      </button>
      {onBatchLoaded && (
        <>
          <button type="button" onClick={() => batchInputRef.current?.click()} disabled={loading} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            Procesar por lotes (varios archivos)
          </button>
          <input ref={batchInputRef} type="file" accept={ACCEPT} multiple onChange={handleBatchFiles} className="sr-only" tabIndex={-1} />
        </>
      )}
    </section>
  );
}
