import type { Guides, GridConfig, SliceRect } from '../types';

/** Cumulative rounding: edges at round(i * total / n) so slices cover exactly [0,total] with no gaps/overlaps. */
function edges(total: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const out: number[] = [0];
  for (let i = 1; i < n; i++) out.push(Math.round((i * total) / n));
  out.push(total);
  return out;
}

function normalizeCuts(cuts: number[], total: number): number[] {
  const uniq = Array.from(new Set(cuts.map((v) => Math.round(v)).filter((v) => v > 0 && v < total)));
  uniq.sort((a, b) => a - b);
  return uniq;
}

export function guidesFromGrid(width: number, height: number, grid: GridConfig): Guides {
  return {
    xs: edges(width, grid.cols).slice(1, -1),
    ys: edges(height, grid.rows).slice(1, -1),
  };
}

export function computeSlicesFromGrid(width: number, height: number, grid: GridConfig): SliceRect[] {
  const xs = edges(width, grid.cols);
  const ys = edges(height, grid.rows);
  const rects: SliceRect[] = [];
  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      const x = xs[col];
      const y = ys[row];
      rects.push({
        x,
        y,
        width: xs[col + 1] - x,
        height: ys[row + 1] - y,
        row: row + 1,
        col: col + 1,
      });
    }
  }
  return rects;
}

export function computeSlicesFromGuides(width: number, height: number, guides: Guides): SliceRect[] {
  const xs = [0, ...normalizeCuts(guides.xs, width), width];
  const ys = [0, ...normalizeCuts(guides.ys, height), height];
  const rects: SliceRect[] = [];
  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      const x = xs[col];
      const y = ys[row];
      const w = xs[col + 1] - x;
      const h = ys[row + 1] - y;
      if (w <= 0 || h <= 0) continue;
      rects.push({ x, y, width: w, height: h, row: row + 1, col: col + 1 });
    }
  }
  return rects;
}

export function gridLinePositions(width: number, height: number, grid: GridConfig): { xs: number[]; ys: number[] } {
  return { xs: edges(width, grid.cols), ys: edges(height, grid.rows) };
}

export interface CutSpacing {
  /** Margen exterior (px) en los bordes de la fuente. */
  margin: number;
  /** Separación (px) entre piezas; se reparte gutter/2 por lado interno. */
  gutter: number;
  /** Sangrado (px): expande cada pieza hacia afuera (solapa con la vecina), limitado a la fuente. */
  bleed: number;
}

export const ZERO_SPACING: CutSpacing = { margin: 0, gutter: 0, bleed: 0 };

export function applySpacing(rects: SliceRect[], width: number, height: number, sp: CutSpacing): SliceRect[] {
  const margin = Math.max(0, sp.margin || 0);
  const gutter = Math.max(0, sp.gutter || 0);
  const bleed = Math.max(0, sp.bleed || 0);
  if (!margin && !gutter && !bleed) return rects;

  return rects.map((r) => {
    const right = r.x + r.width;
    const bottom = r.y + r.height;
    const onLeft = r.x === 0;
    const onTop = r.y === 0;
    const onRight = right === width;
    const onBottom = bottom === height;

    const il = onLeft ? margin : gutter / 2;
    const ir = onRight ? margin : gutter / 2;
    const it = onTop ? margin : gutter / 2;
    const ib = onBottom ? margin : gutter / 2;

    let nx = r.x + il - bleed;
    let ny = r.y + it - bleed;
    let nr = right - ir + bleed;
    let nb = bottom - ib + bleed;

    nx = Math.max(0, Math.min(nx, width - 1));
    ny = Math.max(0, Math.min(ny, height - 1));
    nr = Math.max(nx + 1, Math.min(nr, width));
    nb = Math.max(ny + 1, Math.min(nb, height));

    return { ...r, x: Math.round(nx), y: Math.round(ny), width: Math.round(nr - nx), height: Math.round(nb - ny) };
  });
}
