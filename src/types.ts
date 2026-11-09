export type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp';
export type CutMode = 'grid' | 'guides';
export type ResizeMode = 'original' | 'widthPx' | 'heightPx' | 'widthCm' | 'heightCm';

export interface ResizeConfig {
  mode: ResizeMode;
  value: number;
}

export interface SourceImage {
  name: string;
  /** Original file type as uploaded. */
  fileType: string;
  width: number;
  height: number;
  /** Canvas holding the rasterized source at working resolution. */
  canvas: HTMLCanvasElement;
  /** DPI used when rasterizing a PDF; null for regular images. */
  pdfDpi: number | null;
  /** Original file (kept to re-rasterize PDFs at a different DPI). */
  file: File;
  /** Current PDF page (1-based); null/undefined for regular images. */
  pdfPage?: number | null;
  /** Total pages in the PDF; null/undefined for regular images. */
  pdfNumPages?: number | null;
}

export interface GridConfig {
  rows: number;
  cols: number;
}

export interface Guides {
  /** Vertical cut lines at source X pixels (0 < x < width), sorted. */
  xs: number[];
  /** Horizontal cut lines at source Y pixels (0 < y < height), sorted. */
  ys: number[];
}

export interface SliceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

export interface SliceResult extends SliceRect {
  blob: Blob;
  url: string;
  filename: string;
}
