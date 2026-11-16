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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let curSource: ImageBitmap | OffscreenCanvas = source;
    let curX = rect.x;
    let curY = rect.y;
    let curW = rect.width;
    let curH = rect.height;

    while (curW > w * 1.8 || curH > h * 1.8) {
      const nextW = Math.max(w, Math.ceil(curW * 0.5));
      const nextH = Math.max(h, Math.ceil(curH * 0.5));
      if (nextW === curW && nextH === curH) break;
      const stepCanvas = new OffscreenCanvas(nextW, nextH);
      const stepCtx = stepCanvas.getContext('2d');
      if (!stepCtx) break;
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(curSource, curX, curY, curW, curH, 0, 0, nextW, nextH);
      curSource = stepCanvas;
      curX = 0;
      curY = 0;
      curW = nextW;
      curH = nextH;
    }

    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(curSource, curX, curY, curW, curH, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: format, quality: format === 'image/png' ? undefined : quality });
    blobs.push(blob);
  }
  source.close();
  self.postMessage({ blobs });
};
