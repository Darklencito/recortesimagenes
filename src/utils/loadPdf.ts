import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export interface PdfRender {
  canvas: HTMLCanvasElement;
  numPages: number;
}

export async function renderPdf(file: File, dpi: number, pageNumber = 1): Promise<PdfRender> {
  if (dpi < 36 || dpi > 1200) {
    throw new Error('DPI fuera de rango (36–1200).');
  }
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`La página ${pageNumber} no existe (total: ${pdf.numPages}).`);
  }
  const page = await pdf.getPage(pageNumber);
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto de canvas.');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { canvas, numPages: pdf.numPages };
}

export async function loadPdfPage(file: File, dpi: number, pageNumber = 1): Promise<HTMLCanvasElement> {
  const r = await renderPdf(file, dpi, pageNumber);
  return r.canvas;
}
