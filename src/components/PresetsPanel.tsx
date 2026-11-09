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

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const hint = 'text-xs text-slate-500 dark:text-slate-400';
const btn = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
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
    <section className={card}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">★</span>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Presets guardados</h2>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="Nombre del preset"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button type="button" onClick={handleSave} disabled={!name.trim()} className={`${btn} bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus:ring-indigo-400`}>
          Guardar
        </button>
      </div>
      <p className={`${hint} mt-2`}>Guarda la configuración actual (modo, grilla/guías, formato, calidad, márgenes, tamaño, fondo).</p>

      {presets.length === 0 ? (
        <p className={`${hint} mt-4`}>Aún no hay presets. Guarda uno para reutilizarlo después.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200" title={p.name}>{p.name}</span>
              <button type="button" onClick={() => onApply(p)} className={`${btnSoft} !px-3 !py-1.5 text-xs`}>Aplicar</button>
              <button type="button" onClick={() => onDelete(p.id)} className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" aria-label="Eliminar preset">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
