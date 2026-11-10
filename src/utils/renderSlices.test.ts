// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SliceRect } from '../types';
import { renderSlices, revokeSliceResults } from './renderSlices';

const rects: SliceRect[] = [
  { x: 0, y: 0, width: 100, height: 60, row: 1, col: 1 },
  { x: 100, y: 0, width: 100, height: 60, row: 1, col: 2 },
  { x: 0, y: 60, width: 100, height: 60, row: 2, col: 1 },
  { x: 100, y: 60, width: 100, height: 60, row: 2, col: 2 },
];

function makeSourceCanvas(w = 200, h = 120) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

describe('renderSlices', () => {
  beforeEach(() => {
    // Mock canvas 2D context + toBlob (jsdom no implementa toBlob real)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      imageSmoothingQuality: 'high',
    }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback, type?: string) {
      const blob = new Blob(['x'], { type: type || 'image/png' });
      cb(blob);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('genera un resultado por cada rect con nombre ordenado', async () => {
    const results = await renderSlices(makeSourceCanvas(), rects, 'image/png');
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.filename)).toEqual(['1.png', '2.png', '3.png', '4.png']);
  });

  it('aplica padding cuando hay 10+ cortes', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      x: 0, y: 0, width: 10, height: 10, row: 1, col: i + 1,
    }));
    const results = await renderSlices(makeSourceCanvas(), many, 'image/jpeg', 0.8);
    expect(results[0].filename).toBe('01.jpg');
    expect(results[9].filename).toBe('10.jpg');
    expect(results[11].filename).toBe('12.jpg');
  });

  it('extensión correcta por formato', async () => {
    const png = await renderSlices(makeSourceCanvas(), [rects[0]], 'image/png');
    const jpg = await renderSlices(makeSourceCanvas(), [rects[0]], 'image/jpeg');
    const webp = await renderSlices(makeSourceCanvas(), [rects[0]], 'image/webp');
    expect(png[0].filename).toBe('1.png');
    expect(jpg[0].filename).toBe('1.jpg');
    expect(webp[0].filename).toBe('1.webp');
  });

  it('cada resultado tiene blob, url y dimensiones', async () => {
    const results = await renderSlices(makeSourceCanvas(), rects, 'image/png');
    for (const r of results) {
      expect(r.blob).toBeInstanceOf(Blob);
      expect(r.url).toMatch(/^blob:/);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    }
  });

  it('redimensiona cuando se pasa resize (widthPx)', async () => {
    const results = await renderSlices(makeSourceCanvas(), [rects[0]], 'image/png', 0.92, null, {
      mode: 'widthPx',
      value: 50,
      dpi: 300,
    });
    expect(results[0].width).toBe(50);
    expect(results[0].height).toBe(30); // aspecto 100x60 → 50x30
  });

  it('redimensiona en cm usando el DPI de referencia', async () => {
    const results = await renderSlices(makeSourceCanvas(), [rects[0]], 'image/jpeg', 0.9, '#ffffff', {
      mode: 'widthCm',
      value: 2.54, // 2.54 cm = 1 inch → a 300 DPI = 300 px
      dpi: 300,
    });
    expect(results[0].width).toBe(300);
  });

  it('original (sin resize) mantiene dimensiones del rect', async () => {
    const results = await renderSlices(makeSourceCanvas(), [rects[0]], 'image/png', 0.92, null, {
      mode: 'original',
      value: 0,
      dpi: 300,
    });
    expect(results[0].width).toBe(rects[0].width);
    expect(results[0].height).toBe(rects[0].height);
  });
});

describe('revokeSliceResults', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      imageSmoothingQuality: 'high',
    }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback, type?: string) {
      cb(new Blob(['x'], { type: type || 'image/png' }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('revoca todas las URLs de los resultados', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const results = await renderSlices(document.createElement('canvas'), [rects[0]], 'image/png');
    revokeSliceResults(results);
    expect(revoke).toHaveBeenCalledTimes(results.length);
  });
});
