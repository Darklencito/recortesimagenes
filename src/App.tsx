import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ToastContainer, type ToastItem, type ToastType } from './components/Toast';
import { NotificationBell, NotificationPanel } from './components/NotificationPanel';
import type { NotificationItem } from './components/Toast';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { CutMode, GridConfig, Guides, OutputFormat, ResizeConfig, SliceRect, SliceResult, SourceImage } from './types';
import { UploadPanel } from './components/UploadPanel';
import { ResolutionPanel } from './components/ResolutionPanel';
import { CutSettingsPanel } from './components/CutSettingsPanel';
import { ExportPanel } from './components/ExportPanel';
import { PresetsPanel } from './components/PresetsPanel';
import type { Preset } from './components/PresetsPanel';
const ImageWorkspace = lazy(() => import('./components/ImageWorkspace').then((m) => ({ default: m.ImageWorkspace })));
import { PreviewPanel } from './components/PreviewPanel';
import { applySpacing, computeSlicesFromGrid, computeSlicesFromGuides, guidesFromGrid, ZERO_SPACING } from './utils/slicing';
import type { CutSpacing } from './utils/slicing';
import { renderSlices, revokeSliceResults } from './utils/renderSlices';
// pdfjs e loadImage se cargan bajo demanda (ver rasterizePdf / handlePaste).

const DEFAULT_GRID: GridConfig = { rows: 1, cols: 2 };
type Theme = 'light' | 'dark';

function nextZipName(): string {
  let n = 1;
  try {
    n = (Number(localStorage.getItem('nodos-zip-counter')) || 0) + 1;
    localStorage.setItem('nodos-zip-counter', String(n));
  } catch {
    /* storage no disponible */
  }
  return `nodos-cortes-${String(n).padStart(5, '0')}.zip`;
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('nodos-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [dpi, setDpi] = useState(() => {
    try {
      const n = Number(localStorage.getItem('nodos-dpi'));
      return Number.isFinite(n) && n >= 36 && n <= 1200 ? Math.round(n) : 300;
    } catch {
      return 300;
    }
  });
  const [source, setSource] = useState<SourceImage | null>(null);
  const [mode, setMode] = useState<CutMode>('grid');
  const [grid, setGrid] = useState<GridConfig>(DEFAULT_GRID);
  const [guides, setGuides] = useState<Guides>({ xs: [], ys: [] });
  const [spacing, setSpacing] = useState<CutSpacing>(() => {
    try {
      const raw = localStorage.getItem('nodos-spacing');
      if (raw) {
        const p = JSON.parse(raw);
        return { margin: Number(p.margin) || 0, gutter: Number(p.gutter) || 0, bleed: Number(p.bleed) || 0 };
      }
    } catch {
      /* ignore */
    }
    return ZERO_SPACING;
  });
  const [format, setFormat] = useState<OutputFormat>(() => {
    try {
      const f = localStorage.getItem('nodos-format');
      return f === 'image/jpeg' || f === 'image/webp' || f === 'image/png' ? f : 'image/png';
    } catch {
      return 'image/png';
    }
  });
  const [quality, setQuality] = useState(() => {
    try {
      const q = Number(localStorage.getItem('nodos-quality'));
      return Number.isFinite(q) && q >= 0.01 && q <= 1 ? q : 0.92;
    } catch {
      return 0.92;
    }
  });
  const [bgColor, setBgColor] = useState(() => {
    try {
      return localStorage.getItem('nodos-bg') || '#ffffff';
    } catch {
      return '#ffffff';
    }
  });
  const [resize, setResize] = useState<ResizeConfig>(() => {
    try {
      const raw = localStorage.getItem('nodos-resize');
      if (raw) {
        const p = JSON.parse(raw);
        return { mode: p.mode ?? 'original', value: Number(p.value) || 0 };
      }
    } catch {
      /* ignore */
    }
    return { mode: 'original', value: 0 };
  });
  const [history, setHistory] = useState<{ past: Array<{ grid: GridConfig; guides: Guides }>; future: Array<{ grid: GridConfig; guides: Guides }> }>({ past: [], future: [] });
  const [slices, setSlices] = useState<SliceResult[]>([]);
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const raw = localStorage.getItem('nodos-presets');
      return raw ? (JSON.parse(raw) as Preset[]) : [];
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const toastId = useRef(0);
  const notifId = useRef(0);
  const updateToastId = useRef<number | null>(null);

  function addNotification(type: ToastType, message: string, action?: { label: string; onClick: () => void }) {
    const id = ++notifId.current;
    setNotifications((prev) => [{ id, type, message, timestamp: Date.now(), read: false, action }, ...prev].slice(0, 50));
  }

  function addToast(type: ToastType, message: string, opts?: { action?: { label: string; onClick: () => void }; duration?: number; record?: boolean }) {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message, action: opts?.action, duration: opts?.duration ?? (type === 'loading' ? 0 : 4000) }]);
    if (opts?.record !== false && type !== 'loading') addNotification(type, message, opts?.action);
    return id;
  }
  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }
  function updateToast(id: number, patch: Partial<ToastItem>) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  const unreadCount = notifications.filter((n) => !n.read).length;
  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  function clearNotifications() {
    setNotifications([]);
  }

  const [draggingFile, setDraggingFile] = useState(false);
  const dragDepth = useRef(0);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notifOpen]);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    function onInstalled() {
      setInstallPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('nodos-theme', theme);
    } catch {
      /* storage no disponible */
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      revokeSliceResults(slices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function hasFiles(e: globalThis.DragEvent) {
      return Array.from(e.dataTransfer?.types ?? []).includes('Files');
    }
    function onDragEnter(e: globalThis.DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDraggingFile(true);
    }
    function onDragOver(e: globalThis.DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
    }
    function onDragLeave(e: globalThis.DragEvent) {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDraggingFile(false);
    }
    function onDrop(e: globalThis.DragEvent) {
      e.preventDefault();
      dragDepth.current = 0;
      setDraggingFile(false);
    }
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // Persistir formato/calidad y auto-actualizar la vista previa al cambiarlos
  const firstFmtQuality = useRef(true);
  useEffect(() => {
    try {
      localStorage.setItem('nodos-format', format);
      localStorage.setItem('nodos-quality', String(quality));
      localStorage.setItem('nodos-bg', bgColor);
      localStorage.setItem('nodos-spacing', JSON.stringify(spacing));
      localStorage.setItem('nodos-resize', JSON.stringify(resize));
    } catch {
      /* storage no disponible */
    }
    if (firstFmtQuality.current) {
      firstFmtQuality.current = false;
      return;
    }
    if (!source || slices.length === 0) return;
    const t = setTimeout(() => {
      void handleDivide();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, quality, bgColor, spacing, resize]);

  // Pegar imagen desde el portapapeles (Ctrl+V)
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []);
      const img = files.find((f) => f.type.startsWith('image/'));
      if (!img) return;
      e.preventDefault();
      setError(null);
      setNotice('Cargando imagen pegada…');
      try {
        const { loadRasterImage } = await import('./utils/loadImage');
        const canvas = await loadRasterImage(img);
        handleLoaded({ name: img.name || 'imagen-pegar.png', fileType: img.type || 'image/png', width: canvas.width, height: canvas.height, canvas, pdfDpi: null, file: img });
        setNotice('Imagen pegada correctamente.');
      } catch (err) {
        setNotice(null);
        setError(err instanceof Error ? err.message : 'No se pudo cargar la imagen pegada.');
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushHistory() {
    setHistory((h) => ({ past: [...h.past.slice(-49), { grid, guides }], future: [] }));
  }
  function updateGrid(g: GridConfig) {
    pushHistory();
    setGrid(g);
  }
  function updateGuides(g: Guides) {
    pushHistory();
    setGuides(g);
  }
  function undo() {
    if (history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    setHistory({ past: history.past.slice(0, -1), future: [...history.future, { grid, guides }] });
    setGrid(prev.grid);
    setGuides(prev.guides);
  }
  function redo() {
    if (history.future.length === 0) return;
    const next = history.future[history.future.length - 1];
    setHistory({ past: [...history.past, { grid, guides }], future: history.future.slice(0, -1) });
    setGrid(next.grid);
    setGuides(next.guides);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          if (!typing) { e.preventDefault(); undo(); }
          return;
        }
        if (k === 'y' || (k === 'z' && e.shiftKey)) {
          if (!typing) { e.preventDefault(); redo(); }
          return;
        }
        if (k === 'enter' && source && !busy) {
          e.preventDefault();
          void handleDivide();
          return;
        }
        if (k === 'd' && source && !busy) {
          e.preventDefault();
          void handleDownloadZip();
          return;
        }
        return;
      }

      if (typing || !source) return;
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setMode('grid');
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setMode('guides');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Eventos de actualización de la app de escritorio (Electron)
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    const unsubscribe = api.onUpdateStatus((data: any) => {
      switch (data?.status) {
        case 'checking':
          // silencioso
          break;
        case 'available': {
          const id = addToast('info', `Nueva versión ${data.version ?? ''} disponible. Descargando…`, { duration: 0, record: true });
          updateToastId.current = id;
          break;
        }
        case 'downloading': {
          const id = updateToastId.current;
          const msg = `Descargando actualización… ${data.percent ?? 0}%`;
          if (id) updateToast(id, { type: 'loading', message: msg, duration: 0 });
          else {
            const newId = addToast('loading', msg, { duration: 0 });
            updateToastId.current = newId;
          }
          break;
        }
        case 'downloaded': {
          const id = updateToastId.current;
          updateToastId.current = null;
          if (id) removeToast(id);
          addToast('success', `Actualización ${data.version ?? ''} lista.`, {
            action: { label: 'Reiniciar ahora', onClick: () => api.installUpdate() },
            duration: 0,
            record: true,
          });
          break;
        }
        case 'up-to-date':
          addToast('success', 'Ya tienes la última versión.', { duration: 3000 });
          break;
        case 'error':
          console.warn('Auto-update error:', data?.message);
          addToast('error', data?.message ? `Actualización: ${data.message}` : 'No se pudo verificar actualizaciones.', { duration: 6000 });
          break;
      }
    });
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearSlices(next: SliceResult[]) {
    setSlices((prev) => {
      revokeSliceResults(prev);
      return next;
    });
  }

  function handleLoaded(next: SourceImage) {
    clearSlices([]);
    setError(null);
    setSource(next);
    setMode('grid');
    setGrid(DEFAULT_GRID);
    setGuides(guidesFromGrid(next.width, next.height, DEFAULT_GRID));
    setHistory({ past: [], future: [] });
  }

  async function rasterizePdf(nextDpi: number, page: number) {
    if (!source || source.pdfDpi == null) return;
    setBusy(true);
    setError(null);
    try {
      const { renderPdf } = await import('./utils/loadPdf');
      const { canvas, numPages } = await renderPdf(source.file, nextDpi, page);
      clearSlices([]);
      setDpi(nextDpi);
      try {
        localStorage.setItem('nodos-dpi', String(nextDpi));
      } catch {
        /* storage no disponible */
      }
      setSource({ ...source, canvas, width: canvas.width, height: canvas.height, pdfDpi: nextDpi, pdfPage: page, pdfNumPages: numPages });
      setGuides(guidesFromGrid(canvas.width, canvas.height, grid));
      setHistory({ past: [], future: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el PDF. Verifica el DPI o la página e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyDpi(nextDpi: number) {
    if (!source || source.pdfDpi == null || nextDpi === source.pdfDpi) return;
    await rasterizePdf(nextDpi, source.pdfPage ?? 1);
  }

  async function handlePdfPageChange(page: number) {
    if (!source || source.pdfDpi == null || page === source.pdfPage) return;
    await rasterizePdf(source.pdfDpi, page);
  }

  function currentRects(src: SourceImage): SliceRect[] {
    const base = mode === 'grid'
      ? computeSlicesFromGrid(src.width, src.height, grid)
      : computeSlicesFromGuides(src.width, src.height, guides);
    return applySpacing(base, src.width, src.height, spacing);
  }

  async function generateSlices(src: SourceImage): Promise<SliceResult[]> {
    const rects = currentRects(src);
    if (rects.length === 0) throw new Error('No hay cortes para generar.');
    const rc = resize.mode === 'original' ? null : { ...resize, dpi: src.pdfDpi ?? 300 };
    return renderSlices(src.canvas, rects, format, quality, format === 'image/jpeg' ? bgColor : null, rc);
  }

  async function handleDivide() {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const results = await generateSlices(source);
      clearSlices(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dividir la imagen. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function nextBatchZipName(): string {
    let n = 1;
    try {
      n = (Number(localStorage.getItem('nodos-batch-counter')) || 0) + 1;
      localStorage.setItem('nodos-batch-counter', String(n));
    } catch {
      /* storage no disponible */
    }
    return `nodos-lote-${String(n).padStart(5, '0')}.zip`;
  }

  async function handleBatch(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setNotice(`Procesando ${i + 1}/${files.length}: ${f.name}`);
        const pdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        let canvas: HTMLCanvasElement;
        let usedDpi: number | null = null;
        if (pdf) {
          usedDpi = dpi;
          const { renderPdf } = await import('./utils/loadPdf');
          const r = await renderPdf(f, dpi, 1);
          canvas = r.canvas;
        } else {
          const { loadRasterImage } = await import('./utils/loadImage');
          canvas = await loadRasterImage(f);
        }
        const w = canvas.width;
        const h = canvas.height;
        const base = mode === 'grid' ? computeSlicesFromGrid(w, h, grid) : computeSlicesFromGuides(w, h, guides);
        const rects = applySpacing(base, w, h, spacing);
        const rc = resize.mode === 'original' ? null : { ...resize, dpi: usedDpi ?? 300 };
        const slices = await renderSlices(canvas, rects, format, quality, format === 'image/jpeg' ? bgColor : null, rc);
        const folderName = (f.name.replace(/\.[^.]+$/, '') || 'archivo').replace(/[\\\\/:*?"<>|]/g, '_');
        const folder = zip.folder(folderName);
        for (const s of slices) folder?.file(s.filename, s.blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const name = nextBatchZipName();
      const api = window.electronAPI;
      if (api?.saveToDownloads) {
        const buf = await blob.arrayBuffer();
        const r = await api.saveToDownloads(name, buf);
        setNotice(`Lote guardado en Descargas: ${r.filename} (${files.length} archivos).`);
        addToast('success', `Guardado en Descargas: ${r.filename} (${files.length} archivos).`, { duration: 4000 });
      } else {
        saveAs(blob, name);
        setNotice(`Lote exportado: ${name} (${files.length} archivos).`);
        addToast('success', `Lote exportado: ${name} (${files.length} archivos).`, { duration: 4000 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el lote. Revisa los archivos e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function handleSavePreset(name: string) {
    const preset: Preset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      mode,
      grid,
      guides,
      format,
      quality,
      spacing,
      resize,
      background: bgColor,
    };
    setPresets((prev) => {
      const next = [preset, ...prev].slice(0, 20);
      try {
        localStorage.setItem('nodos-presets', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setNotice(`Preset “${name}” guardado.`);
  }

  function handleApplyPreset(p: Preset) {
    setMode(p.mode);
    setGrid(p.grid);
    setGuides(p.guides);
    setFormat(p.format);
    setQuality(p.quality);
    setSpacing(p.spacing);
    setResize(p.resize);
    setBgColor(p.background);
    clearSlices([]);
    setHistory({ past: [], future: [] });
    setError(null);
    setNotice(`Preset “${p.name}” aplicado.`);
  }

  function handleDeletePreset(id: string) {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('nodos-presets', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function buildZip(): Promise<{ blob: Blob; name: string }> {
    const src = source!;
    const results = await generateSlices(src);
    clearSlices(results);
    const zip = new JSZip();
    for (const r of results) zip.file(r.filename, r.blob);
    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, name: nextZipName() };
  }

  async function handleDownloadZip() {
    if (!source) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { blob, name } = await buildZip();
      const api = window.electronAPI;
      if (api?.saveToDownloads) {
        const buf = await blob.arrayBuffer();
        const r = await api.saveToDownloads(name, buf);
        setNotice(`ZIP guardado en Descargas: ${r.filename}`);
        addToast('success', `Guardado en Descargas: ${r.filename}`, { duration: 4000 });
      } else {
        saveAs(blob, name);
        setNotice(`ZIP descargado: ${name}`);
        addToast('success', `Descargado ${name} con éxito.`, { duration: 3500 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el ZIP. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200/70 bg-slate-950 text-white dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
          <img src="./logo-nodos-white.png" alt="nodos.pe" className="h-12 w-auto sm:h-14" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Herramientas de Diseño Nodos</h1>
            <p className="text-sm text-slate-300">Sube, define cortes precisos y exporta en PNG, JPG o WEBP. Atajos: Ctrl+Enter dividir · Ctrl+D descargar · G/L cambiar modo.</p>
          </div>
          <div ref={notifRef} className="relative">
            <NotificationBell unread={unreadCount} onClick={() => setNotifOpen((o) => !o)} />
            <NotificationPanel
              notifications={notifications}
              unread={unreadCount}
              open={notifOpen}
              onMarkAllRead={markAllRead}
              onClear={clearNotifications}
              onToggle={() => setNotifOpen((o) => !o)}
              onCheckUpdates={window.electronAPI ? () => window.electronAPI!.checkForUpdates() : undefined}
            />
          </div>
          {installPrompt && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await installPrompt.prompt();
                  await installPrompt.userChoice;
                } catch {
                  /* ignore */
                }
                setInstallPrompt(null);
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              Instalar app
            </button>
          )}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {!source ? (
          <section className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center text-center">
            <div className="mb-6">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">Rápido y preciso</span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Corta imágenes y PDF en segundos</h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400">Arrastra tu archivo al centro o pega una imagen con Ctrl+V. Verás la vista previa y las opciones de corte a la izquierda.</p>
            </div>
            <UploadPanel onLoaded={handleLoaded} variant="hero" pdfDpi={dpi} onBatchLoaded={handleBatch} />
            <ul className="mt-6 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
              {[
                ['Plantillas', '1×2, 1×3, 1×4 y grilla personalizada.'],
                ['Guías precisas', 'Arrastra líneas y ajusta al píxel.'],
                ['Exporta', 'PNG, JPG o WEBP con calidad, en ZIP.'],
              ].map(([t, d]) => (
                <li key={t} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{d}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-6">
              <UploadPanel onLoaded={handleLoaded} variant="sidebar" pdfDpi={dpi} onBatchLoaded={handleBatch} />
              {source.pdfDpi != null && (
                <ResolutionPanel
                  currentDpi={source.pdfDpi}
                  width={source.width}
                  height={source.height}
                  busy={busy}
                  onApply={handleApplyDpi}
                  page={source.pdfPage ?? 1}
                  numPages={source.pdfNumPages ?? 1}
                  onPageChange={handlePdfPageChange}
                />
              )}
              <CutSettingsPanel
                source={source}
                mode={mode}
                grid={grid}
                guides={guides}
                dividing={busy}
                onModeChange={setMode}
                onGridChange={updateGrid}
                onGuidesChange={updateGuides}
                onDivide={handleDivide}
                spacing={spacing}
                onSpacingChange={setSpacing}
              />
              <ExportPanel
                format={format}
                quality={quality}
                background={bgColor}
                hasSlices={slices.length > 0}
                busy={busy}
                onFormatChange={setFormat}
                onQualityChange={setQuality}
                onBackgroundChange={setBgColor}
                resize={resize}
                onResizeChange={setResize}
                referenceDpi={source.pdfDpi ?? 300}
                onApply={handleDivide}
                onDownloadZip={handleDownloadZip}
              />
              <PresetsPanel
                presets={presets}
                onSave={handleSavePreset}
                onApply={handleApplyPreset}
                onDelete={handleDeletePreset}
              />
              {notice && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200">{notice}</div>
              )}
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300">{error}</div>
              )}
            </div>
            <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Cargando lienzo…</div>}>
              <ImageWorkspace source={source} mode={mode} grid={grid} guides={guides} onGuidesChange={updateGuides} spacing={spacing} />
            </Suspense>
          </div>
        )}
        <PreviewPanel slices={slices} dpi={source?.pdfDpi ?? 300} />
      </main>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {draggingFile && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px]">
          <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-indigo-300 bg-white/95 px-10 py-8 text-center shadow-2xl dark:border-indigo-500 dark:bg-slate-900/95">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">Suelta tu archivo aquí</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">PDF (Illustrator), PNG, JPG o WEBP</p>
          </div>
        </div>
      )}
    </div>
  );
}
