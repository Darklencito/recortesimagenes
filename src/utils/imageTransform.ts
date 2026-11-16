import type { OutputFormat } from '../types';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformOptions {
  crop?: CropRect | null;
  targetWidth: number;
  targetHeight: number;
  background?: string | null;
  sharpen?: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeCropRect(crop: CropRect, sourceWidth: number, sourceHeight: number): CropRect {
  const sw = Math.max(1, sourceWidth);
  const sh = Math.max(1, sourceHeight);
  const x = clamp(Math.round(crop.x), 0, sw - 1);
  const y = clamp(Math.round(crop.y), 0, sh - 1);
  const width = clamp(Math.round(crop.width), 1, sw - x);
  const height = clamp(Math.round(crop.height), 1, sh - y);
  return { x, y, width, height };
}

/**
 * Aplica un filtro de enfoque suave (Unsharp Mask 3x3) para recuperar micro-contraste
 * después de reducir imágenes con texto o gráficos.
 */
function applySubtleSharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.22) {
  if (typeof ctx.getImageData !== 'function' || typeof ctx.putImageData !== 'function') return;
  if (w < 3 || h < 3 || amount <= 0) return;

  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = imgData.data;
    const out = new Uint8ClampedArray(src);
    const stride = w * 4;

    for (let y = 1; y < h - 1; y++) {
      const rowOffset = y * stride;
      for (let x = 1; x < w - 1; x++) {
        const idx = rowOffset + x * 4;
        for (let c = 0; c < 3; c++) {
          const center = src[idx + c];
          const neighbors =
            (src[idx - stride + c] +
              src[idx + stride + c] +
              src[idx - 4 + c] +
              src[idx + 4 + c]) *
            0.25;
          const diff = center - neighbors;
          out[idx + c] = clamp(Math.round(center + diff * (amount * 2.5)), 0, 255);
        }
      }
    }

    imgData.data.set(out);
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Si falla por seguridad/CORS o entorno de test, continuamos con la imagen sin filtro extra.
  }
}

/**
 * Redimensiona usando reescalado progresivo (multi-step downscaling de 50% por paso)
 * con interpolación bicúbica de alta calidad para evitar pérdida de nitidez o dientes de sierra.
 */
export function drawHighQualityResized(
  source: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  destCanvas: HTMLCanvasElement,
  dw: number,
  dh: number,
  background: string | null = null,
): void {
  const ctx = destCanvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto de canvas.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let curSource: HTMLCanvasElement = source;
  let curX = sx;
  let curY = sy;
  let curW = sw;
  let curH = sh;

  // Reducción progresiva por mitades cuando se reduce más de 1.8x
  while (curW > dw * 1.8 || curH > dh * 1.8) {
    const nextW = Math.max(dw, Math.ceil(curW * 0.5));
    const nextH = Math.max(dh, Math.ceil(curH * 0.5));
    if (nextW === curW && nextH === curH) break;

    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
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
    ctx.fillRect(0, 0, dw, dh);
  }
  ctx.drawImage(curSource, curX, curY, curW, curH, 0, 0, dw, dh);
}

export function cropAndResizeCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: TransformOptions,
): HTMLCanvasElement {
  const rect = options.crop
    ? normalizeCropRect(options.crop, sourceCanvas.width, sourceCanvas.height)
    : { x: 0, y: 0, width: sourceCanvas.width, height: sourceCanvas.height };

  const dw = clamp(Math.round(options.targetWidth), 1, 16384);
  const dh = clamp(Math.round(options.targetHeight), 1, 16384);

  const out = document.createElement('canvas');
  out.width = dw;
  out.height = dh;

  drawHighQualityResized(
    sourceCanvas,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    out,
    dw,
    dh,
    options.background ?? null,
  );

  if (options.sharpen && (dw < rect.width || dh < rect.height)) {
    const ctx = out.getContext('2d');
    if (ctx) applySubtleSharpen(ctx, dw, dh, 0.22);
  }

  return out;
}

export function canvasToOutputBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality = 0.95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen.'))),
      format,
      format === 'image/png' ? undefined : quality,
    );
  });
}
