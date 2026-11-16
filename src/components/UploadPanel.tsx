import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { SourceImage } from '../types';
// Carga diferida: evita meter pdfjs en el bundle inicial.

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';
const VALID_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

const hint = 'text-xs text-slate-500 dark:text-slate-400';

interface Props {
  onLoaded: (source: SourceImage) => void;
  variant?: 'hero' | 'sidebar';
  /** DPI used for the initial PDF rasterization (adjustable later in ResolutionPanel). */
  pdfDpi: number;
  onBatchLoaded?: (files: File[]) => void;
  currentName?: string;
}

export function UploadPanel({ onLoaded, variant = 'sidebar', pdfDpi, onBatchLoaded, currentName }: Props) {
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

  const isHero = variant === 'hero';
  const activeName = currentName ?? file?.name;

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
      } ${isHero ? 'flex min-h-[220px] flex-col items-center justify-center px-6 py-8 text-center' : 'p-3 text-center'}`}
    >
      <div className={`mx-auto flex items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 transition group-hover:scale-105 dark:bg-indigo-500/20 dark:text-indigo-300 ${isHero ? 'mb-3 h-14 w-14' : 'mb-1.5 h-9 w-9'}`}>
        {loading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        ) : (
          <svg width={isHero ? 26 : 18} height={isHero ? 26 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>
      <p className={`font-semibold text-slate-800 dark:text-slate-200 ${isHero ? 'text-base sm:text-lg' : 'text-xs'}`}>
        {loading ? 'Procesando…' : 'Arrastra y suelta tu archivo'}
      </p>
      <p className={`${hint} ${isHero ? 'mt-1 text-xs sm:text-sm' : 'mt-0.5'}`}>
        o haz clic para seleccionar · PDF (Illustrator), PNG, JPG, WEBP
      </p>
      {isHero && (
        <p className="mt-3 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm dark:bg-indigo-600">
          Suelta aquí o pega con Ctrl+V
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
          <button type="button" onClick={() => batchInputRef.current?.click()} className="mt-2.5 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            Procesar por lotes (varios archivos a ZIP)
          </button>
        )}
        <input ref={batchInputRef} type="file" accept={ACCEPT} multiple onChange={handleBatchFiles} className="sr-only" tabIndex={-1} />
        {error && <p className="mt-2.5 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-xl border transition ${
        dragActive
          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/10'
          : 'border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-800/50'
      } p-2.5`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200" title={activeName || 'Archivo activo'}>
            {loading ? 'Cargando archivo…' : activeName || 'Archivo listo'}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Arrastra otro o usa Ctrl+V para reemplazar
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? '…' : 'Cambiar'}
          </button>
          {onBatchLoaded && (
            <button
              type="button"
              onClick={() => batchInputRef.current?.click()}
              disabled={loading}
              title="Procesar varios archivos con la configuración actual"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Lotes
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFile} className="sr-only" tabIndex={-1} />
      {onBatchLoaded && (
        <input ref={batchInputRef} type="file" accept={ACCEPT} multiple onChange={handleBatchFiles} className="sr-only" tabIndex={-1} />
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </div>
  );
}
