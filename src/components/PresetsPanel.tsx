import { useState } from 'react';
import type { CutMode, GridConfig, Guides } from '../types';
import type { CutSpacing } from '../utils/slicing';
import type { OutputFormat, ResizeConfig } from '../types';

export interface Preset {
  id: string;
  name: string;
  mode: CutMode;
  grid: GridConfig;
  guides: Guides;
  format: OutputFormat;
  quality: number;
  spacing: CutSpacing;
  resize: ResizeConfig;
  background: string;
}

interface Props {
  presets: Preset[];
  onSave: (name: string) => void;
  onApply: (p: Preset) => void;
  onDelete: (id: string) => void;
}

const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const hint = 'text-[11px] text-slate-500 dark:text-slate-400';
const btn = 'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
const btnSoft = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;

export function PresetsPanel({ presets, onSave, onApply, onDelete }: Props) {
  const [name, setName] = useState('');

  function handleSave() {
    const n = name.trim();
    if (!n) return;
    onSave(n);
    setName('');
  }

  return (
    <div className="space-y-3">
      <div>
        <span className={label}>Guardar configuración actual</span>
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder="Nombre del preset (ej. Mailing 1×3)"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button type="button" onClick={handleSave} disabled={!name.trim()} className={`${btn} bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 focus:ring-indigo-400`}>
            Guardar
          </button>
        </div>
        <p className={`${hint} mt-1`}>Guarda modo, grilla/guías, formato, calidad, márgenes y tamaño.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
        <span className={label}>Mis presets ({presets.length})</span>
        {presets.length === 0 ? (
          <p className={`${hint} mt-2`}>Aún no tienes presets guardados.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200" title={p.name}>{p.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {p.mode === 'grid' ? `${p.grid.rows}×${p.grid.cols}` : `${p.guides.xs.length}X·${p.guides.ys.length}Y`} · {p.format.replace('image/', '').toUpperCase()}
                  </p>
                </div>
                <button type="button" onClick={() => onApply(p)} className={`${btnSoft} !px-2.5 !py-1 text-[11px]`}>Aplicar</button>
                <button type="button" onClick={() => onDelete(p.id)} className="rounded-md px-1.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" aria-label="Eliminar preset">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
