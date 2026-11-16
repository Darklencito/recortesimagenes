// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasToOutputBlob, cropAndResizeCanvas, normalizeCropRect } from './imageTransform';

function makeCanvas(w = 1000, h = 800) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

describe('normalizeCropRect', () => {
  it('restringe coordenadas fuera de los límites del lienzo', () => {
    const r = normalizeCropRect({ x: -20, y: -10, width: 2000, height: 1500 }, 800, 600);
    expect(r).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('respeta un recorte válido dentro del lienzo', () => {
    const r = normalizeCropRect({ x: 50, y: 100, width: 400, height: 300 }, 800, 600);
    expect(r).toEqual({ x: 50, y: 100, width: 400, height: 300 });
  });
});

describe('cropAndResizeCanvas', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback, type?: string) {
      cb(new Blob(['img'], { type: type || 'image/png' }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recorta y redimensiona a las dimensiones objetivo', () => {
    const src = makeCanvas(2000, 1000);
    const out = cropAndResizeCanvas(src, {
      crop: { x: 100, y: 50, width: 1000, height: 500 },
      targetWidth: 300,
      targetHeight: 150,
      sharpen: true,
    });
    expect(out.width).toBe(300);
    expect(out.height).toBe(150);
  });

  it('exporta a Blob en el formato indicado', async () => {
    const src = makeCanvas(400, 300);
    const blob = await canvasToOutputBlob(src, 'image/webp', 0.95);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/webp');
  });
});
