import { useState } from 'react';
import type { OutputFormat, SourceImage } from '../types';
import type { CropRect } from '../utils/imageTransform';

export type ResizeUnit = 'px' | 'percent' | 'cm';

interface Props {
  source: SourceImage;
  crop: CropRect;
  cropAspect: number | null;
  targetWidth: number;
  targetHeight: number;
  lockAspect: boolean;
  sharpen: boolean;
  format: OutputFormat;
  quality: number;
  dpi: number;
  busy: boolean;
  canRestoreOriginal: boolean;
  onCropChange: (next: CropRect) => void;
  onCropAspectChange: (aspect: number | null) => void;
  onTargetDimensionsChange: (width: number, height: number) => void;
  onLockAspectChange: (locked: boolean) => void;
  onSharpenChange: (sharpen: boolean) => void;
  onFormatChange: (format: OutputFormat) => void;
  onQualityChange: (quality: number) => void;
  onApplyToCanvas: () => void;
  onRestoreOriginal: () => void;
  onDownloadSingle: () => void;
  onCopySingle: () => void;
}

const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const hint = 'text-[11px] text-slate-500 dark:text-slate-400';
const input =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30';
const chipBase = 'cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium transition select-none text-center';
const chipActive = 'border-indigo-600 bg-indigo-600 text-white';
const chipInactive =
  'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500';
const btn =
  'inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
const btnSoft = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const btnPrimary = `${btn} bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 focus:ring-indigo-400`;

const ASPECT_PRESETS: Array<{ id: string; label: string; ratio: number | null | 'original' }> = [
  { id: 'free', label: 'Libre', ratio: null },
  { id: 'orig', label: 'Original', ratio: 'original' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
];

const SCALE_PRESETS = [25, 50, 75, 100, 150, 200];
const WIDTH_PRESETS = [
  { label: '600px Mail', w: 600 },
  { label: '800px Mail HD', w: 800 },
  { label: '1080px IG', w: 1080 },
  { label: '1200px Web', w: 1200 },
  { label: '1920px FHD', w: 1920 },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function CropResizePanel({
  source,
  crop,
  cropAspect,
  targetWidth,
  targetHeight,
  lockAspect,
  sharpen,
  format,
  quality,
  dpi,
  busy,
  canRestoreOriginal,
  onCropChange,
  onCropAspectChange,
  onTargetDimensionsChange,
  onLockAspectChange,
  onSharpenChange,
  onFormatChange,
  onQualityChange,
  onApplyToCanvas,
  onRestoreOriginal,
  onDownloadSingle,
  onCopySingle,
}: Props) {
  const [unit, setUnit] = useState<ResizeUnit>('px');

  const isFullCrop =
    crop.x === 0 && crop.y === 0 && crop.width === source.width && crop.height === source.height;
  const isResized = targetWidth !== crop.width || targetHeight !== crop.height;
  const isDownscaling = targetWidth < crop.width || targetHeight < crop.height;
  const currentPercent = Math.round((targetWidth / Math.max(1, crop.width)) * 100);

  function applyAspectPreset(ratio: number | null | 'original') {
    const numRatio = ratio === 'original' ? source.width / source.height : ratio;
    onCropAspectChange(numRatio);
    if (numRatio == null) return;

    // Ajustar el rectángulo de recorte actual centrado con la nueva proporción
    const maxW = source.width;
    const maxH = source.height;
    let w = crop.width;
    let h = Math.round(w / numRatio);
    if (h > maxH) {
      h = maxH;
      w = Math.round(h * numRatio);
    }
    if (w > maxW) {
      w = maxW;
      h = Math.round(w / numRatio);
    }
    w = Math.max(1, w);
    h = Math.max(1, h);
    const cx = crop.x + crop.width / 2;
    const cy = crop.y + crop.height / 2;
    const x = clamp(Math.round(cx - w / 2), 0, maxW - w);
    const y = clamp(Math.round(cy - h / 2), 0, maxH - h);
    const nextCrop = { x, y, width: w, height: h };
    onCropChange(nextCrop);
    if (!isResized) {
      onTargetDimensionsChange(w, h);
    } else if (lockAspect) {
      onTargetDimensionsChange(targetWidth, Math.max(1, Math.round(targetWidth / numRatio)));
    }
  }

  function updateCropField(field: keyof CropRect, rawVal: number) {
    const val = Math.round(rawVal) || 0;
    let { x, y, width, height } = crop;
    if (field === 'x') {
      x = clamp(val, 0, source.width - 1);
      width = clamp(width, 1, source.width - x);
    } else if (field === 'y') {
      y = clamp(val, 0, source.height - 1);
      height = clamp(height, 1, source.height - y);
    } else if (field === 'width') {
      width = clamp(val, 1, source.width - x);
      if (cropAspect) {
        height = clamp(Math.round(width / cropAspect), 1, source.height - y);
      }
    } else if (field === 'height') {
      height = clamp(val, 1, source.height - y);
      if (cropAspect) {
        width = clamp(Math.round(height * cropAspect), 1, source.width - x);
      }
    }
    const next = { x, y, width, height };
    onCropChange(next);
    if (!isResized) {
      onTargetDimensionsChange(next.width, next.height);
    } else if (lockAspect) {
      const ratio = next.width / Math.max(1, next.height);
      onTargetDimensionsChange(targetWidth, Math.max(1, Math.round(targetWidth / ratio)));
    }
  }

  function centerCrop() {
    const x = Math.max(0, Math.round((source.width - crop.width) / 2));
    const y = Math.max(0, Math.round((source.height - crop.height) / 2));
    onCropChange({ ...crop, x, y });
  }

  function resetCrop() {
    onCropAspectChange(null);
    const full = { x: 0, y: 0, width: source.width, height: source.height };
    onCropChange(full);
    onTargetDimensionsChange(source.width, source.height);
  }

  function handleWidthPx(wRaw: number) {
    const w = clamp(Math.round(wRaw) || 1, 1, 16384);
    if (lockAspect) {
      const ratio = crop.width / Math.max(1, crop.height);
      const h = clamp(Math.round(w / ratio), 1, 16384);
      onTargetDimensionsChange(w, h);
    } else {
      onTargetDimensionsChange(w, targetHeight);
    }
  }

  function handleHeightPx(hRaw: number) {
    const h = clamp(Math.round(hRaw) || 1, 1, 16384);
    if (lockAspect) {
      const ratio = crop.width / Math.max(1, crop.height);
      const w = clamp(Math.round(h * ratio), 1, 16384);
      onTargetDimensionsChange(w, h);
    } else {
      onTargetDimensionsChange(targetWidth, h);
    }
  }

  function handlePercentChange(pctRaw: number) {
    const pct = clamp(pctRaw || 100, 1, 800);
    const w = clamp(Math.round((crop.width * pct) / 100), 1, 16384);
    const h = clamp(Math.round((crop.height * pct) / 100), 1, 16384);
    onTargetDimensionsChange(w, h);
  }

  const widthCm = Number(((targetWidth / dpi) * 2.54).toFixed(2));
  const heightCm = Number(((targetHeight / dpi) * 2.54).toFixed(2));

  function handleWidthCm(cm: number) {
    const px = Math.round(((cm || 0.1) / 2.54) * dpi);
    handleWidthPx(px);
  }

  function handleHeightCm(cm: number) {
    const px = Math.round(((cm || 0.1) / 2.54) * dpi);
    handleHeightPx(px);
  }

  return (
    <div className="space-y-3.5">
      {/* RECORTAR (CROP) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center justify-between gap-2">
          <span className={label}>1. Recortar área (Crop)</span>
          <span className={hint}>
            {crop.width} × {crop.height} px
          </span>
        </div>

        <p className={`${hint} mt-1`}>
          Arrastra las esquinas o bordes en el lienzo, o elige una proporción fija:
        </p>

        <div className="mt-2 grid grid-cols-4 gap-1">
          {ASPECT_PRESETS.map((p) => {
            const targetRatio = p.ratio === 'original' ? source.width / source.height : p.ratio;
            const isSelected =
              (targetRatio === null && cropAspect === null) ||
              (targetRatio !== null && cropAspect !== null && Math.abs(cropAspect - targetRatio) < 0.005);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyAspectPreset(p.ratio)}
                className={`${chipBase} ${isSelected ? chipActive : chipInactive}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <label className="block">
            <span className={hint}>Posición X (px)</span>
            <input
              type="number"
              min={0}
              max={source.width - 1}
              value={crop.x}
              onChange={(e) => updateCropField('x', Number(e.target.value))}
              className={`${input} mt-0.5`}
            />
          </label>
          <label className="block">
            <span className={hint}>Posición Y (px)</span>
            <input
              type="number"
              min={0}
              max={source.height - 1}
              value={crop.y}
              onChange={(e) => updateCropField('y', Number(e.target.value))}
              className={`${input} mt-0.5`}
            />
          </label>
          <label className="block">
            <span className={hint}>Ancho recorte (px)</span>
            <input
              type="number"
              min={1}
              max={source.width - crop.x}
              value={crop.width}
              onChange={(e) => updateCropField('width', Number(e.target.value))}
              className={`${input} mt-0.5`}
            />
          </label>
          <label className="block">
            <span className={hint}>Alto recorte (px)</span>
            <input
              type="number"
              min={1}
              max={source.height - crop.y}
              value={crop.height}
              onChange={(e) => updateCropField('height', Number(e.target.value))}
              className={`${input} mt-0.5`}
            />
          </label>
        </div>

        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={centerCrop}
            disabled={isFullCrop}
            className={`${btnSoft} flex-1 !py-1.5`}
          >
            Centrar área
          </button>
          <button
            type="button"
            onClick={resetCrop}
            disabled={isFullCrop && cropAspect === null}
            className={`${btnSoft} flex-1 !py-1.5`}
          >
            Todo el lienzo
          </button>
        </div>
      </div>

      {/* REDIMENSIONAR (RESIZE SIN PERDER CALIDAD) */}
      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-500/5">
        <div className="flex items-center justify-between gap-2">
          <span className={label}>2. Redimensionar (Resize)</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
            Sin pérdida de nitidez
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-1.5">
          <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
            {([
              { id: 'px', label: 'Píxeles (px)' },
              { id: 'percent', label: 'Escala (%)' },
              { id: 'cm', label: `Cm (${dpi} DPI)` },
            ] as const).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setUnit(u.id)}
                className={`rounded-md py-1 text-[11px] font-semibold transition ${
                  unit === u.id
                    ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onLockAspectChange(!lockAspect)}
            title={lockAspect ? 'Proporción bloqueada (no deforma)' : 'Proporción libre'}
            className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition ${
              lockAspect
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>{lockAspect ? '🔒' : '🔓'}</span>
            <span>Proporción</span>
          </button>
        </div>

        {unit === 'px' && (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <label className="block">
              <span className={hint}>Ancho final (px)</span>
              <input
                type="number"
                min={1}
                max={16384}
                value={targetWidth}
                onChange={(e) => handleWidthPx(Number(e.target.value))}
                className={`${input} mt-0.5`}
              />
            </label>
            <label className="block">
              <span className={hint}>Alto final (px)</span>
              <input
                type="number"
                min={1}
                max={16384}
                value={targetHeight}
                onChange={(e) => handleHeightPx(Number(e.target.value))}
                className={`${input} mt-0.5`}
              />
            </label>
          </div>
        )}

        {unit === 'percent' && (
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min={10}
                max={200}
                value={clamp(currentPercent, 10, 200)}
                onChange={(e) => handlePercentChange(Number(e.target.value))}
                className="h-2 w-full accent-indigo-600"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={800}
                  value={currentPercent}
                  onChange={(e) => handlePercentChange(Number(e.target.value))}
                  className={`${input} !w-16 text-center`}
                />
                <span className={hint}>%</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {SCALE_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentChange(pct)}
                  className={`${chipBase} flex-1 ${currentPercent === pct ? chipActive : chipInactive}`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {unit === 'cm' && (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <label className="block">
              <span className={hint}>Ancho final (cm)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={widthCm}
                onChange={(e) => handleWidthCm(Number(e.target.value))}
                className={`${input} mt-0.5`}
              />
            </label>
            <label className="block">
              <span className={hint}>Alto final (cm)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={heightCm}
                onChange={(e) => handleHeightCm(Number(e.target.value))}
                className={`${input} mt-0.5`}
              />
            </label>
          </div>
        )}

        <div className="mt-2">
          <span className={hint}>Tamaños rápidos (ancho):</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {WIDTH_PRESETS.map((p) => (
              <button
                key={p.w}
                type="button"
                onClick={() => {
                  onLockAspectChange(true);
                  const ratio = crop.width / Math.max(1, crop.height);
                  onTargetDimensionsChange(p.w, Math.max(1, Math.round(p.w / ratio)));
                }}
                className={`${chipBase} text-[11px] ${targetWidth === p.w ? chipActive : chipInactive}`}
              >
                {p.label}
              </button>
            ))}
            {isResized && (
              <button
                type="button"
                onClick={() => onTargetDimensionsChange(crop.width, crop.height)}
                className={`${chipBase} text-[11px] ${chipInactive}`}
                title="Volver al tamaño 100% del recorte"
              >
                100% ({crop.width}×{crop.height})
              </button>
            )}
          </div>
        </div>

        <label className="mt-2.5 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/80">
          <div>
            <span className="block text-xs font-medium text-slate-800 dark:text-slate-200">
              Enfoque inteligente al reducir
            </span>
            <span className="block text-[10px] text-slate-500 dark:text-slate-400">
              Reescalado progresivo + micro-contraste para textos y bordes nítidos
            </span>
          </div>
          <input
            type="checkbox"
            checked={sharpen}
            onChange={(e) => onSharpenChange(e.target.checked)}
            className="h-4 w-4 rounded accent-indigo-600"
          />
        </label>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-indigo-100/70 px-2.5 py-1.5 text-[11px] text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-200">
          <span>Resultado final:</span>
          <strong>
            {targetWidth} × {targetHeight} px ({widthCm} × {heightCm} cm)
            {isDownscaling ? ` · ${currentPercent}%` : ''}
          </strong>
        </div>
      </div>

      {/* APLICAR AL LIENZO O DESCARGAR IMAGEN DIRECTA */}
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <span className={label}>3. Aplicar o exportar imagen</span>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onApplyToCanvas}
            disabled={busy || (isFullCrop && !isResized)}
            className={`${btnPrimary} w-full`}
          >
            {busy ? 'Procesando…' : 'Aplicar recorte / resize al lienzo'}
          </button>

          {canRestoreOriginal && (
            <button
              type="button"
              onClick={onRestoreOriginal}
              disabled={busy}
              className={`${btnSoft} w-full !border-amber-300 !bg-amber-50 !text-amber-800 hover:!bg-amber-100 dark:!border-amber-700 dark:!bg-amber-500/10 dark:!text-amber-200`}
            >
              ↺ Restaurar imagen original sin cambios
            </button>
          )}
        </div>

        <div className="border-t border-slate-200/80 pt-2 dark:border-slate-700">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className={hint}>Exportar imagen directa (sin dividir):</span>
            <select
              value={format}
              onChange={(e) => onFormatChange(e.target.value as OutputFormat)}
              className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="image/png">PNG (Sin pérdida)</option>
              <option value="image/jpeg">JPG ({Math.round(quality * 100)}%)</option>
              <option value="image/webp">WEBP ({Math.round(quality * 100)}%)</option>
            </select>
          </div>

          {format !== 'image/png' && (
            <div className="mb-2 flex items-center gap-2">
              <span className={hint}>Calidad:</span>
              <input
                type="range"
                min={50}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(e) => onQualityChange(Number(e.target.value) / 100)}
                className="h-1.5 flex-1 accent-indigo-600"
              />
              <span className="w-9 text-right text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {Math.round(quality * 100)}%
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={onCopySingle} disabled={busy} className={btnSoft}>
              Copiar imagen
            </button>
            <button type="button" onClick={onDownloadSingle} disabled={busy} className={btnSoft}>
              Descargar imagen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
