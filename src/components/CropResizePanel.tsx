import { useState } from 'react';
import type { OutputFormat, SourceImage } from '../types';

export type ResizeUnit = 'px' | 'percent' | 'cm';

interface Props {
  source: SourceImage;
  targetWidth: number;
  targetHeight: number;
  lockAspect: boolean;
  sharpen: boolean;
  format: OutputFormat;
  quality: number;
  background: string;
  dpi: number;
  onTargetDimensionsChange: (width: number, height: number) => void;
  onLockAspectChange: (locked: boolean) => void;
  onSharpenChange: (sharpen: boolean) => void;
  onFormatChange: (format: OutputFormat) => void;
  onQualityChange: (quality: number) => void;
  onBackgroundChange: (color: string) => void;
}

const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const hint = 'text-[11px] text-slate-500 dark:text-slate-400';
const input =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30';
const chipBase = 'cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium transition select-none text-center';
const chipActive = 'border-indigo-600 bg-indigo-600 text-white';
const chipInactive =
  'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500';

const SCALE_PRESETS = [25, 50, 75, 100];
const WIDTH_PRESETS = [
  { label: '600 px (Mail)', w: 600 },
  { label: '800 px (Mail HD)', w: 800 },
  { label: '1080 px (Redes)', w: 1080 },
  { label: '1200 px (Web)', w: 1200 },
  { label: '1920 px (FHD)', w: 1920 },
];

const FORMATS: Array<{ value: OutputFormat; label: string; sub: string }> = [
  { value: 'image/png', label: 'PNG', sub: 'sin pérdida' },
  { value: 'image/jpeg', label: 'JPG', sub: 'ligero' },
  { value: 'image/webp', label: 'WEBP', sub: 'óptimo' },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function CropResizePanel({
  source,
  targetWidth,
  targetHeight,
  lockAspect,
  sharpen,
  format,
  quality,
  background,
  dpi,
  onTargetDimensionsChange,
  onLockAspectChange,
  onSharpenChange,
  onFormatChange,
  onQualityChange,
  onBackgroundChange,
}: Props) {
  const [unit, setUnit] = useState<ResizeUnit>('px');

  const isResized = targetWidth !== source.width || targetHeight !== source.height;
  const isDownscaling = targetWidth < source.width || targetHeight < source.height;
  const currentPercent = Math.round((targetWidth / Math.max(1, source.width)) * 100);
  const qualityPct = Math.round(quality * 100);
  const lossy = format !== 'image/png';

  function handleWidthPx(wRaw: number) {
    const w = clamp(Math.round(wRaw) || 1, 1, 16384);
    if (lockAspect) {
      const ratio = source.width / Math.max(1, source.height);
      const h = clamp(Math.round(w / ratio), 1, 16384);
      onTargetDimensionsChange(w, h);
    } else {
      onTargetDimensionsChange(w, targetHeight);
    }
  }

  function handleHeightPx(hRaw: number) {
    const h = clamp(Math.round(hRaw) || 1, 1, 16384);
    if (lockAspect) {
      const ratio = source.width / Math.max(1, source.height);
      const w = clamp(Math.round(h * ratio), 1, 16384);
      onTargetDimensionsChange(w, h);
    } else {
      onTargetDimensionsChange(targetWidth, h);
    }
  }

  function handlePercentChange(pctRaw: number) {
    const pct = clamp(pctRaw || 100, 1, 800);
    const w = clamp(Math.round((source.width * pct) / 100), 1, 16384);
    const h = clamp(Math.round((source.height * pct) / 100), 1, 16384);
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
      {/* DIMENSIONES DE REDIMENSIONADO */}
      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-2.5 dark:border-indigo-900/60 dark:bg-indigo-500/5">
        <div className="flex items-center justify-between gap-2">
          <span className={label}>Nuevo tamaño de imagen</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
            Sin perder calidad
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Tamaño original:</span>
          <strong className="text-slate-700 dark:text-slate-200">
            {source.width} × {source.height} px
          </strong>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-1.5">
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
              <span className={hint}>Ancho nuevo (px)</span>
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
              <span className={hint}>Alto nuevo (px)</span>
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
                min={5}
                max={100}
                value={clamp(currentPercent, 5, 100)}
                onChange={(e) => handlePercentChange(Number(e.target.value))}
                className="h-2 w-full accent-indigo-600"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={400}
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
              <span className={hint}>Ancho nuevo (cm)</span>
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
              <span className={hint}>Alto nuevo (cm)</span>
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

        <div className="mt-2.5">
          <span className={hint}>Tamaños rápidos (ancho):</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {WIDTH_PRESETS.map((p) => (
              <button
                key={p.w}
                type="button"
                onClick={() => {
                  onLockAspectChange(true);
                  const ratio = source.width / Math.max(1, source.height);
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
                onClick={() => onTargetDimensionsChange(source.width, source.height)}
                className={`${chipBase} text-[11px] ${chipInactive}`}
                title="Restablecer al tamaño original"
              >
                Original ({source.width}×{source.height})
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
              Reescalado progresivo + nitidez para textos y detalles
            </span>
          </div>
          <input
            type="checkbox"
            checked={sharpen}
            onChange={(e) => onSharpenChange(e.target.checked)}
            className="h-4 w-4 rounded accent-indigo-600"
          />
        </label>

        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-indigo-100/80 px-2.5 py-2 text-xs text-indigo-950 dark:bg-indigo-500/20 dark:text-indigo-200">
          <span>Tamaño de exportación:</span>
          <strong>
            {targetWidth} × {targetHeight} px {isDownscaling ? `(${currentPercent}%)` : ''}
          </strong>
        </div>
      </div>

      {/* FORMATO Y CALIDAD DE EXPORTACIÓN DE LA IMAGEN REDIMENSIONADA */}
      <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <span className={label}>Formato de exportación</span>
        <div className="grid grid-cols-3 gap-1.5">
          {FORMATS.map((f) => (
            <label
              key={f.value}
              className={`cursor-pointer rounded-xl border px-2.5 py-1.5 text-center text-xs font-medium transition select-none ${
                format === f.value
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500'
              }`}
            >
              <input
                type="radio"
                name="resize-fmt"
                className="sr-only"
                checked={format === f.value}
                onChange={() => onFormatChange(f.value)}
              />
              <span className="block font-semibold">{f.label}</span>
              <span
                className={`block text-[10px] font-normal ${
                  format === f.value ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {f.sub}
              </span>
            </label>
          ))}
        </div>

        <div>
          <label htmlFor="resize-quality" className={label}>
            Calidad{' '}
            {lossy ? (
              <span className="text-indigo-600 dark:text-indigo-400">{qualityPct}%</span>
            ) : (
              <span className="font-normal normal-case text-slate-500 dark:text-slate-400">(PNG sin pérdida)</span>
            )}
          </label>
          <div className="mt-1 flex items-center gap-2.5">
            <input
              id="resize-quality"
              type="range"
              min={1}
              max={100}
              value={qualityPct}
              disabled={!lossy}
              onChange={(e) => onQualityChange(Number(e.target.value) / 100)}
              className="h-2 w-full accent-indigo-600 disabled:opacity-40"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={qualityPct}
              disabled={!lossy}
              onChange={(e) => onQualityChange(Math.min(100, Math.max(1, Number(e.target.value) || 92)) / 100)}
              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-xs shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800"
            />
          </div>
        </div>

        {format === 'image/jpeg' && (
          <div>
            <label htmlFor="resize-bgcolor" className={label}>
              Fondo para transparencias (JPG)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="resize-bgcolor"
                type="color"
                value={background}
                onChange={(e) => onBackgroundChange(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800"
              />
              <input
                type="text"
                value={background}
                onChange={(e) => onBackgroundChange(e.target.value)}
                className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs uppercase shadow-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
