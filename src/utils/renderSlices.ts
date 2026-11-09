import type { OutputFormat, ResizeConfig, SliceRect, SliceResult } from '../types';
import SliceWorker from '../workers/slice.worker?worker';

function extFor(format: OutputFormat): string {
  if (format === 'image/jpeg') return 'jpg';
  if (format === 'image/webp') return 'webp';
  return 'png';
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen del corte.'))),
      format,
      format === 'image/png' ? undefined : quality,
    );
  });
}

export function outputDims(rect: SliceRect, resize: (ResizeConfig & { dpi: number }) | null): { w: number; h: number } {
  if (!resize || resize.mode === 'original' || !resize.value || resize.value <= 0) {
    return { w: rect.width, h: rect.height };
  }
  const { mode, value, dpi } = resize;
  const px = mode === 'widthCm' || mode === 'heightCm' ? Math.round((value / 2.54) * dpi) : Math.round(value);
  if (mode === 'widthPx' || mode === 'widthCm') {
    const w = Math.max(1, px);
    return { w, h: Math.max(1, Math.round((w * rect.height) / rect.width)) };
  }
  const h = Math.max(1, px);
  return { w: Math.max(1, Math.round((h * rect.width) / rect.height)), h };
}

async function renderSlicesMainThread(
  sourceCanvas: HTMLCanvasElement,
  rects: SliceRect[],
  format: OutputFormat,
  quality: number,
  background: string | null,
  resize: (ResizeConfig & { dpi: number }) | null,
): Promise<SliceResult[]> {
  const ext = extFor(format);
  const pad = String(rects.length).length;
  const results: SliceResult[] = [];
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const { w, h } = outputDims(rect, resize);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el contexto de canvas.');
    ctx.imageSmoothingQuality = 'high';
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(sourceCanvas, rect.x, rect.y, rect.width, rect.height, 0, 0, w, h);
    const blob = await canvasToBlob(c, format, quality);
    const filename = `${String(i + 1).padStart(pad, '0')}.${ext}`;
    results.push({ ...rect, width: w, height: h, blob, url: URL.createObjectURL(blob), filename });
  }
  return results;
}

export async function renderSlices(
  sourceCanvas: HTMLCanvasElement,
  rects: SliceRect[],
  format: OutputFormat = 'image/png',
  quality = 0.92,
  background: string | null = null,
  resize: (ResizeConfig & { dpi: number }) | null = null,
): Promise<SliceResult[]> {
  // Intentar en un Web Worker para no congelar la UI con imágenes grandes.
  if (typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && rects.length > 0) {
    try {
      const bitmap = await createImageBitmap(sourceCanvas);
      const worker = new SliceWorker();
      const blobs: Blob[] = await new Promise<Blob[]>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent) => resolve(e.data.blobs as Blob[]);
        worker.onerror = (err) => reject(err);
        worker.postMessage({ source: bitmap, rects, format, quality, background, resize }, [bitmap]);
      });
      worker.terminate();

      const ext = extFor(format);
      const pad = String(rects.length).length;
      return blobs.map((blob, i) => {
        const rect = rects[i];
        const { w, h } = outputDims(rect, resize);
        return { ...rect, width: w, height: h, blob, url: URL.createObjectURL(blob), filename: `${String(i + 1).padStart(pad, '0')}.${ext}` };
      });
    } catch {
      // Fallback al hilo principal si el worker falla.
    }
  }
  return renderSlicesMainThread(sourceCanvas, rects, format, quality, background, resize);
}

export function revokeSliceResults(results: SliceResult[]) {
  for (const r of results) URL.revokeObjectURL(r.url);
}
