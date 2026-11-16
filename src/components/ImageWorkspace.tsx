import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { CutMode, GridConfig, Guides, SourceImage } from '../types';
import { applySpacing, computeSlicesFromGrid, computeSlicesFromGuides, gridLinePositions, ZERO_SPACING } from '../utils/slicing';
import type { CutSpacing } from '../utils/slicing';
import type { CropRect } from '../utils/imageTransform';

interface Props {
  source: SourceImage | null;
  mode: CutMode;
  grid: GridConfig;
  guides: Guides;
  onGuidesChange: (guides: Guides) => void;
  spacing?: CutSpacing;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  previewOpen?: boolean;
  slicesCount?: number;
  onTogglePreview?: () => void;
  cropMode?: boolean;
  cropRect?: CropRect;
  cropAspect?: number | null;
  targetDimensions?: { width: number; height: number };
  onCropChange?: (rect: CropRect) => void;
  onToggleCropMode?: () => void;
}

const toolBtn = 'inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type HandleId = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

export function ImageWorkspace({
  source,
  mode,
  grid,
  guides,
  onGuidesChange,
  spacing = ZERO_SPACING,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  previewOpen,
  slicesCount = 0,
  onTogglePreview,
  cropMode = false,
  cropRect,
  cropAspect = null,
  targetDimensions,
  onCropChange,
  onToggleCropMode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ w: 900, h: 620 });
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const panRef = useRef({ x: 0, y: 0, left: 0, top: 0, active: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setViewport({
          w: Math.max(200, e.contentRect.width),
          h: Math.max(200, e.contentRect.height),
        });
      }
    });
    ro.observe(el);
    setViewport({
      w: Math.max(200, el.clientWidth),
      h: Math.max(200, el.clientHeight),
    });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setZoom(1);
    setPanMode(false);
  }, [source]);

  const layout = useMemo(() => {
    if (!source) return null;
    const maxW = Math.max(160, viewport.w - 32);
    const maxH = Math.max(160, viewport.h - 32);
    const fit = Math.min(1, maxW / source.width, maxH / source.height);
    const scale = fit * zoom;
    return {
      fit,
      scale,
      w: Math.max(1, Math.floor(source.width * scale)),
      h: Math.max(1, Math.floor(source.height * scale)),
    };
  }, [source, viewport.w, viewport.h, zoom]);

  useEffect(() => {
    const display = canvasRef.current;
    const src = source?.canvas;
    if (!display || !src || !layout) return;
    display.width = layout.w;
    display.height = layout.h;
    const ctx = display.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, layout.w, layout.h);
    ctx.drawImage(src, 0, 0, layout.w, layout.h);
  }, [source, layout]);

  if (!source || !layout) {
    return (
      <section className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300">Tu lienzo aparecerá aquí</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Carga un PDF, PNG, JPG o WEBP para comenzar.</p>
        </div>
      </section>
    );
  }

  const { fit, scale: ds, w: dw, h: dh } = layout;
  const toDisplay = (px: number) => px * ds;
  const toSource = (px: number) => Math.round(px / ds);

  const gridLines = gridLinePositions(source.width, source.height, grid);
  const baseSlices = mode === 'grid' ? computeSlicesFromGrid(source.width, source.height, grid) : computeSlicesFromGuides(source.width, source.height, guides);
  const slices = applySpacing(baseSlices, source.width, source.height, spacing);

  const activeCrop: CropRect = cropRect ?? { x: 0, y: 0, width: source.width, height: source.height };

  function snap(value: number, total: number): number {
    const tol = Math.max(3, Math.round(6 / ds));
    for (const f of [0.25, 1 / 3, 0.5, 2 / 3, 0.75]) {
      const c = Math.round(total * f);
      if (Math.abs(value - c) <= tol) return c;
    }
    return value;
  }

  function dragVertical(index: number, e: KonvaEventObject<DragEvent>) {
    const raw = clamp(toSource(e.target.x()), 1, source!.width - 1);
    const x = clamp(snap(raw, source!.width), 1, source!.width - 1);
    const xs = Array.from(new Set([...guides.xs.slice(0, index), x, ...guides.xs.slice(index + 1)])).sort((a, b) => a - b);
    onGuidesChange({ ...guides, xs });
  }
  function dragHorizontal(index: number, e: KonvaEventObject<DragEvent>) {
    const raw = clamp(toSource(e.target.y()), 1, source!.height - 1);
    const y = clamp(snap(raw, source!.height), 1, source!.height - 1);
    const ys = Array.from(new Set([...guides.ys.slice(0, index), y, ...guides.ys.slice(index + 1)])).sort((a, b) => a - b);
    onGuidesChange({ ...guides, ys });
  }

  function moveVertical(index: number, delta: number) {
    const x = clamp(guides.xs[index] + delta, 1, source!.width - 1);
    const xs = Array.from(new Set([...guides.xs.slice(0, index), x, ...guides.xs.slice(index + 1)])).sort((a, b) => a - b);
    onGuidesChange({ ...guides, xs });
  }
  function moveHorizontal(index: number, delta: number) {
    const y = clamp(guides.ys[index] + delta, 1, source!.height - 1);
    const ys = Array.from(new Set([...guides.ys.slice(0, index), y, ...guides.ys.slice(index + 1)])).sort((a, b) => a - b);
    onGuidesChange({ ...guides, ys });
  }

  function addGuidesAt(dispX: number, dispY: number) {
    if (cropMode || mode !== 'guides' || panMode) return;
    const x = clamp(toSource(dispX), 1, source!.width - 1);
    const y = clamp(toSource(dispY), 1, source!.height - 1);
    const xs = Array.from(new Set([...guides.xs, x])).sort((a, b) => a - b);
    const ys = Array.from(new Set([...guides.ys, y])).sort((a, b) => a - b);
    onGuidesChange({ xs, ys });
  }
  function deleteVertical(i: number, e: KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true;
    onGuidesChange({ ...guides, xs: guides.xs.filter((_, idx) => idx !== i) });
  }
  function deleteHorizontal(i: number, e: KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true;
    onGuidesChange({ ...guides, ys: guides.ys.filter((_, idx) => idx !== i) });
  }

  function handleCropHandleDrag(handle: HandleId, dispX: number, dispY: number) {
    if (!onCropChange || !source) return;
    const sx = clamp(toSource(dispX), 0, source.width);
    const sy = clamp(toSource(dispY), 0, source.height);
    const minSize = 10;

    let left = activeCrop.x;
    let top = activeCrop.y;
    let right = activeCrop.x + activeCrop.width;
    let bottom = activeCrop.y + activeCrop.height;

    if (handle.includes('w')) left = clamp(sx, 0, right - minSize);
    if (handle.includes('e')) right = clamp(sx, left + minSize, source.width);
    if (handle.includes('n')) top = clamp(sy, 0, bottom - minSize);
    if (handle.includes('s')) bottom = clamp(sy, top + minSize, source.height);

    let width = Math.max(minSize, right - left);
    let height = Math.max(minSize, bottom - top);

    if (cropAspect && cropAspect > 0) {
      if (handle === 'n' || handle === 's') {
        width = clamp(Math.round(height * cropAspect), minSize, source.width - left);
        height = Math.max(minSize, Math.round(width / cropAspect));
      } else {
        height = clamp(Math.round(width / cropAspect), minSize, source.height - top);
        width = Math.max(minSize, Math.round(height * cropAspect));
      }
      if (handle.includes('w')) left = clamp(right - width, 0, source.width - width);
      if (handle.includes('n')) top = clamp(bottom - height, 0, source.height - height);
    }

    onCropChange({
      x: clamp(left, 0, source.width - width),
      y: clamp(top, 0, source.height - height),
      width,
      height,
    });
  }

  function onPanDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!panMode) return;
    const el = containerRef.current;
    if (!el) return;
    panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, active: true };
    el.setPointerCapture(e.pointerId);
  }
  function onPanMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = panRef.current;
    if (!p.active) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = p.left - (e.clientX - p.x);
    el.scrollTop = p.top - (e.clientY - p.y);
  }
  function onPanUp() {
    panRef.current.active = false;
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((z) => clamp(z * factor, 0.2, 8));
    }
  }

  const cx = toDisplay(activeCrop.x);
  const cy = toDisplay(activeCrop.y);
  const cw = toDisplay(activeCrop.width);
  const ch = toDisplay(activeCrop.height);
  const handleSize = 10;
  const halfH = handleSize / 2;

  const cropHandles: Array<{ id: HandleId; x: number; y: number }> = [
    { id: 'nw', x: cx, y: cy },
    { id: 'ne', x: cx + cw, y: cy },
    { id: 'sw', x: cx, y: cy + ch },
    { id: 'se', x: cx + cw, y: cy + ch },
    { id: 'n', x: cx + cw / 2, y: cy },
    { id: 's', x: cx + cw / 2, y: cy + ch },
    { id: 'w', x: cx, y: cy + ch / 2 },
    { id: 'e', x: cx + cw, y: cy + ch / 2 },
  ];

  return (
    <section className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/70 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Lienzo</span>
          <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {source.width} × {source.height} px{source.pdfDpi ? ` · ${source.pdfDpi} DPI` : ''}
          </span>
          {cropMode ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" aria-live="polite">
              Recorte: {activeCrop.width} × {activeCrop.height} px
              {targetDimensions && (targetDimensions.width !== activeCrop.width || targetDimensions.height !== activeCrop.height)
                ? ` → Resize: ${targetDimensions.width} × ${targetDimensions.height} px`
                : ''}
            </span>
          ) : (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" aria-live="polite">
              {slices.length} cortes previstos
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onToggleCropMode && (
            <button
              type="button"
              onClick={onToggleCropMode}
              className={`${toolBtn} gap-1 ${cropMode ? '!border-indigo-600 !bg-indigo-600 !text-white' : ''}`}
              title="Recortar o redimensionar la imagen sin perder calidad"
            >
              <span>✂ Recortar / Resize</span>
            </button>
          )}
          {(onUndo || onRedo) && (
            <div className="mr-1 flex items-center gap-1 border-r border-slate-200 pr-2 dark:border-slate-700">
              <button type="button" className={toolBtn} disabled={!canUndo} onClick={onUndo} title="Deshacer (Ctrl+Z)" aria-label="Deshacer">
                ↶
              </button>
              <button type="button" className={toolBtn} disabled={!canRedo} onClick={onRedo} title="Rehacer (Ctrl+Y)" aria-label="Rehacer">
                ↷
              </button>
            </div>
          )}
          <button type="button" className={toolBtn} onClick={() => setZoom((z) => clamp(z / 1.25, 0.2, 8))} aria-label="Alejar" title="Alejar">−</button>
          <span className="min-w-12 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">{Math.round(ds * 100)}%</span>
          <button type="button" className={toolBtn} onClick={() => setZoom((z) => clamp(z * 1.25, 0.2, 8))} aria-label="Acercar" title="Acercar">+</button>
          <button type="button" className={toolBtn} onClick={() => setZoom(1)} title="Ajustar a la pantalla">Ajustar</button>
          <button type="button" className={toolBtn} onClick={() => setZoom(clamp(1 / fit, 0.2, 8))} title="Tamaño real 100%">100%</button>
          <button
            type="button"
            className={`${toolBtn} ${panMode ? '!border-indigo-600 !bg-indigo-600 !text-white' : ''}`}
            onClick={() => setPanMode((p) => !p)}
            title="Arrastrar para desplazar el lienzo"
          >
            Mano
          </button>
          {onTogglePreview && (
            <button
              type="button"
              onClick={onTogglePreview}
              className={`${toolBtn} ml-1 gap-1.5 ${previewOpen ? '!border-indigo-600 !bg-indigo-50 !text-indigo-700 dark:!border-indigo-500 dark:!bg-indigo-500/20 dark:!text-indigo-200' : ''}`}
              title="Mostrar/ocultar panel de cortes generados"
            >
              <span>Cortes</span>
              {slicesCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {slicesCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerLeave={onPanUp}
        onWheel={onWheel}
        className={`flex flex-1 min-h-0 items-center justify-center overflow-auto bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-3 dark:bg-[linear-gradient(45deg,#0f172a_25%,transparent_25%),linear-gradient(-45deg,#0f172a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0f172a_75%),linear-gradient(-45deg,transparent_75%,#0f172a_75%)] ${panMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="relative m-auto shrink-0 shadow-md ring-1 ring-slate-900/10 dark:ring-white/10" style={{ width: dw, height: dh }}>
          <canvas ref={canvasRef} className="block rounded-sm bg-white" />
          <Stage
            width={dw}
            height={dh}
            className="absolute left-0 top-0"
            onDblClick={(e) => {
              const pos = e.target.getStage()?.getPointerPosition();
              if (pos) addGuidesAt(pos.x, pos.y);
            }}
          >
            <Layer>
              {!cropMode && slices.map((s, i) => (
                <Rect key={i} x={toDisplay(s.x)} y={toDisplay(s.y)} width={Math.max(0, toDisplay(s.width))} height={Math.max(0, toDisplay(s.height))} stroke="rgba(79,70,229,0.55)" strokeWidth={1} listening={false} />
              ))}
              {!cropMode && mode === 'grid' && gridLines.xs.map((x, i) => (
                <Line key={`gx${i}`} points={[toDisplay(x), 0, toDisplay(x), dh]} stroke="rgba(244,63,94,0.9)" strokeWidth={1.5} dash={[6, 4]} listening={false} />
              ))}
              {!cropMode && mode === 'grid' && gridLines.ys.map((y, i) => (
                <Line key={`gy${i}`} points={[0, toDisplay(y), dw, toDisplay(y)]} stroke="rgba(244,63,94,0.9)" strokeWidth={1.5} dash={[6, 4]} listening={false} />
              ))}
              {!cropMode && mode === 'guides' && guides.xs.map((x, i) => (
                <Line
                  key={`vx${x}-${i}`}
                  x={toDisplay(x)}
                  y={0}
                  points={[0, 0, 0, dh]}
                  stroke="#f43f5e"
                  strokeWidth={2}
                  draggable={!panMode}
                  tabIndex={0}
                  aria-label={`Guía vertical en ${x} px. Usa flechas para mover, Supr para eliminar.`}
                  dragBoundFunc={(pos) => ({ x: clamp(pos.x, toDisplay(1), toDisplay(source.width - 1)), y: 0 })}
                  onDragEnd={(e) => dragVertical(i, e)}
                  onDblClick={(e) => deleteVertical(i, e)}
                  onKeyDown={(e: KeyboardEvent) => {
                    const step = e.shiftKey ? 10 : 1;
                    if (e.key === 'ArrowLeft') { e.preventDefault(); moveVertical(i, -step); }
                    else if (e.key === 'ArrowRight') { e.preventDefault(); moveVertical(i, step); }
                    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteVertical(i, e as unknown as KonvaEventObject<MouseEvent>); }
                  }}
                  hitStrokeWidth={16}
                />
              ))}
              {!cropMode && mode === 'guides' && guides.ys.map((y, i) => (
                <Line
                  key={`hy${y}-${i}`}
                  x={0}
                  y={toDisplay(y)}
                  points={[0, 0, dw, 0]}
                  stroke="#f43f5e"
                  strokeWidth={2}
                  draggable={!panMode}
                  tabIndex={0}
                  aria-label={`Guía horizontal en ${y} px. Usa flechas para mover, Supr para eliminar.`}
                  dragBoundFunc={(pos) => ({ x: 0, y: clamp(pos.y, toDisplay(1), toDisplay(source.height - 1)) })}
                  onDragEnd={(e) => dragHorizontal(i, e)}
                  onDblClick={(e) => deleteHorizontal(i, e)}
                  onKeyDown={(e: KeyboardEvent) => {
                    const step = e.shiftKey ? 10 : 1;
                    if (e.key === 'ArrowUp') { e.preventDefault(); moveHorizontal(i, -step); }
                    else if (e.key === 'ArrowDown') { e.preventDefault(); moveHorizontal(i, step); }
                    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteHorizontal(i, e as unknown as KonvaEventObject<MouseEvent>); }
                  }}
                  hitStrokeWidth={16}
                />
              ))}

              {/* MODO RECORTAR / RESIZE INTERACTIVO */}
              {cropMode && (
                <>
                  {/* Máscara oscura exterior (4 zonas) */}
                  <Rect x={0} y={0} width={dw} height={Math.max(0, cy)} fill="rgba(15,23,42,0.58)" listening={false} />
                  <Rect x={0} y={cy + ch} width={dw} height={Math.max(0, dh - (cy + ch))} fill="rgba(15,23,42,0.58)" listening={false} />
                  <Rect x={0} y={cy} width={Math.max(0, cx)} height={Math.max(0, ch)} fill="rgba(15,23,42,0.58)" listening={false} />
                  <Rect x={cx + cw} y={cy} width={Math.max(0, dw - (cx + cw))} height={Math.max(0, ch)} fill="rgba(15,23,42,0.58)" listening={false} />

                  {/* Área arrastrable de recorte */}
                  <Rect
                    x={cx}
                    y={cy}
                    width={Math.max(1, cw)}
                    height={Math.max(1, ch)}
                    stroke="#6366f1"
                    strokeWidth={2}
                    draggable={!panMode && !!onCropChange}
                    dragBoundFunc={(pos) => ({
                      x: clamp(pos.x, 0, Math.max(0, dw - cw)),
                      y: clamp(pos.y, 0, Math.max(0, dh - ch)),
                    })}
                    onDragMove={(e) => {
                      if (!onCropChange) return;
                      const nx = clamp(toSource(e.target.x()), 0, source.width - activeCrop.width);
                      const ny = clamp(toSource(e.target.y()), 0, source.height - activeCrop.height);
                      onCropChange({ ...activeCrop, x: nx, y: ny });
                    }}
                    onDragEnd={(e) => {
                      if (!onCropChange) return;
                      const nx = clamp(toSource(e.target.x()), 0, source.width - activeCrop.width);
                      const ny = clamp(toSource(e.target.y()), 0, source.height - activeCrop.height);
                      onCropChange({ ...activeCrop, x: nx, y: ny });
                    }}
                  />

                  {/* Regla de los tercios dentro del recorte */}
                  <Line points={[cx + cw / 3, cy, cx + cw / 3, cy + ch]} stroke="rgba(255,255,255,0.5)" strokeWidth={1} dash={[4, 4]} listening={false} />
                  <Line points={[cx + (cw * 2) / 3, cy, cx + (cw * 2) / 3, cy + ch]} stroke="rgba(255,255,255,0.5)" strokeWidth={1} dash={[4, 4]} listening={false} />
                  <Line points={[cx, cy + ch / 3, cx + cw, cy + ch / 3]} stroke="rgba(255,255,255,0.5)" strokeWidth={1} dash={[4, 4]} listening={false} />
                  <Line points={[cx, cy + (ch * 2) / 3, cx + cw, cy + (ch * 2) / 3]} stroke="rgba(255,255,255,0.5)" strokeWidth={1} dash={[4, 4]} listening={false} />

                  {/* Tiradores de esquinas y bordes */}
                  {cropHandles.map((h) => (
                    <Rect
                      key={h.id}
                      x={h.x - halfH}
                      y={h.y - halfH}
                      width={handleSize}
                      height={handleSize}
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      cornerRadius={2}
                      draggable={!panMode && !!onCropChange}
                      dragBoundFunc={(pos) => ({
                        x: clamp(pos.x, -halfH, dw - halfH),
                        y: clamp(pos.y, -halfH, dh - halfH),
                      })}
                      onDragMove={(e) => {
                        handleCropHandleDrag(h.id, e.target.x() + halfH, e.target.y() + halfH);
                      }}
                      onDragEnd={(e) => {
                        handleCropHandleDrag(h.id, e.target.x() + halfH, e.target.y() + halfH);
                      }}
                    />
                  ))}
                </>
              )}
            </Layer>
          </Stage>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/70 px-3.5 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
        <span>
          {cropMode
            ? 'Arrastra las esquinas o el recuadro para recortar · Ajusta el tamaño en px, % o cm sin perder calidad'
            : mode === 'grid'
              ? 'Rojo = líneas de corte · Índigo = regiones'
              : 'Arrastra las líneas rojas (snap a 1/4, 1/3, 0.5, 2/3, 3/4) · Doble clic añade/elimina'}
        </span>
        <span className="hidden sm:inline">Ctrl + Rueda = Zoom · G/L = Modo</span>
      </div>
    </section>
  );
}
