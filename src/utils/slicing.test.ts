import { describe, expect, it } from 'vitest';
import {
  ZERO_SPACING,
  applySpacing,
  computeSlicesFromGrid,
  computeSlicesFromGuides,
  guidesFromGrid,
} from './slicing';

const W = 1000;
const H = 600;

describe('computeSlicesFromGrid', () => {
  it('1x2 produce 2 cortes que cubren exactamente el ancho', () => {
    const slices = computeSlicesFromGrid(W, H, { rows: 1, cols: 2 });
    expect(slices).toHaveLength(2);
    expect(slices.map((s) => s.width)).toEqual([500, 500]);
    expect(slices.reduce((a, s) => a + s.width, 0)).toBe(W);
    expect(slices[0].x).toBe(0);
    expect(slices[1].x).toBe(500);
  });

  it('1x3 produce 3 cortes sin huecos ni solapes', () => {
    const slices = computeSlicesFromGrid(W, H, { rows: 1, cols: 3 });
    expect(slices).toHaveLength(3);
    let x = 0;
    for (const s of slices) {
      expect(s.x).toBe(x);
      x += s.width;
    }
    expect(x).toBe(W);
  });

  it('2x2 cubre exactamente ancho y alto (redondeo acumulado)', () => {
    // ancho impar para forzar redondeo
    const slices = computeSlicesFromGrid(1001, 601, { rows: 2, cols: 2 });
    expect(slices).toHaveLength(4);
    const xs = new Set(slices.map((s) => s.x + s.width));
    expect(xs.has(1001)).toBe(true);
    const ys = new Set(slices.map((s) => s.y + s.height));
    expect(ys.has(601)).toBe(true);
    // suma de anchos de la primera fila = total
    const firstRow = slices.filter((s) => s.row === 1);
    expect(firstRow.reduce((a, s) => a + s.width, 0)).toBe(1001);
  });

  it('no produce anchos/altos negativos o cero con 1 parte', () => {
    const slices = computeSlicesFromGrid(W, H, { rows: 1, cols: 1 });
    expect(slices).toHaveLength(1);
    expect(slices[0].width).toBe(W);
    expect(slices[0].height).toBe(H);
  });
});

describe('guidesFromGrid / computeSlicesFromGuides', () => {
  it('convierte una grilla 1x4 en 3 guías verticales internas', () => {
    const g = guidesFromGrid(W, H, { rows: 1, cols: 4 });
    expect(g.xs).toHaveLength(3);
    expect(g.ys).toHaveLength(0);
    // guías internas: no incluyen 0 ni W
    for (const x of g.xs) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(W);
    }
  });

  it('las guías producen los mismos cortes que la grilla', () => {
    const grid = { rows: 2, cols: 3 };
    const a = computeSlicesFromGrid(W, H, grid);
    const guides = guidesFromGrid(W, H, grid);
    const b = computeSlicesFromGuides(W, H, guides);
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i].x).toBe(a[i].x);
      expect(b[i].y).toBe(a[i].y);
      expect(b[i].width).toBe(a[i].width);
      expect(b[i].height).toBe(a[i].height);
    }
  });

  it('normaliza guías fuera de rango y duplicadas', () => {
    const slices = computeSlicesFromGuides(W, H, { xs: [-5, 0, 500, 500, 1200], ys: [300] });
    // solo 500 queda como corte vertical interno; ys 300
    expect(slices).toHaveLength(4); // 2 cols x 2 rows
    const xs = new Set(slices.map((s) => s.x));
    expect(xs).toEqual(new Set([0, 500]));
  });
});

describe('applySpacing', () => {
  it('con ZERO_SPACING devuelve los mismos rects', () => {
    const base = computeSlicesFromGrid(W, H, { rows: 1, cols: 2 });
    const out = applySpacing(base, W, H, ZERO_SPACING);
    expect(out).toEqual(base);
  });

  it('margen exterior encoge las piezas del borde', () => {
    const base = computeSlicesFromGrid(W, H, { rows: 1, cols: 1 });
    const out = applySpacing(base, W, H, { margin: 10, gutter: 0, bleed: 0 });
    expect(out[0].x).toBe(10);
    expect(out[0].y).toBe(10);
    expect(out[0].width).toBe(W - 20);
    expect(out[0].height).toBe(H - 20);
  });

  it('separación reparte gutter/2 entre piezas internas', () => {
    const base = computeSlicesFromGrid(W, H, { rows: 1, cols: 2 });
    const out = applySpacing(base, W, H, { margin: 0, gutter: 20, bleed: 0 });
    // primera pieza: derecha inset 10; segunda: izquierda inset 10
    expect(out[0].width).toBe(500 - 10);
    expect(out[1].x).toBe(500 + 10);
    expect(out[1].width).toBe(500 - 10);
  });

  it('sangrado expande las piezas sin salirse de la fuente', () => {
    const base = computeSlicesFromGrid(W, H, { rows: 1, cols: 2 });
    const out = applySpacing(base, W, H, { margin: 0, gutter: 0, bleed: 5 });
    // primera pieza se expande 5 a la derecha (solapa), segunda 5 a la izquierda
    expect(out[0].width).toBe(500 + 5);
    expect(out[1].x).toBe(495);
    expect(out[1].width).toBe(505);
    // clamped a la fuente
    const single = applySpacing(computeSlicesFromGrid(W, H, { rows: 1, cols: 1 }), W, H, { margin: 0, gutter: 0, bleed: 1000 });
    expect(single[0].x).toBe(0);
    expect(single[0].width).toBe(W);
  });

  it('nunca produce ancho/alto <= 0', () => {
    const base = computeSlicesFromGrid(10, 10, { rows: 1, cols: 2 });
    const out = applySpacing(base, 10, 10, { margin: 100, gutter: 100, bleed: 0 });
    for (const s of out) {
      expect(s.width).toBeGreaterThanOrEqual(1);
      expect(s.height).toBeGreaterThanOrEqual(1);
    }
  });
});
