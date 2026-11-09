import type { OutputFormat, ResizeConfig, SliceRect } from '../types';

function outputDims(rect: SliceRect, resize: (ResizeConfig & { dpi: number }) | null): { w: number; h: number } {
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

self.onmessage = async (e: MessageEvent) => {
  const { source, rects, format, quality, background, resize } = e.data as {
    source: ImageBitmap;
    rects: SliceRect[];
    format: OutputFormat;
    quality: number;
    background: string | null;
    resize: (ResizeConfig & { dpi: number }) | null;
  };

  const blobs: Blob[] = [];
  for (const rect of rects) {
    const { w, h } = outputDims(rect, resize);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el contexto de canvas.');
    ctx.imageSmoothingQuality = 'high';
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: format, quality: format === 'image/png' ? undefined : quality });
    blobs.push(blob);
  }
  source.close();
  self.postMessage({ blobs });
};
