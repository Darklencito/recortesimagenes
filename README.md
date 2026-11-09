# Herramientas de Diseño Nodos

Aplicación web para cortar imágenes (PNG, JPG, WEBP) y PDF (incluye archivos de Illustrator) usando plantillas rápidas (1×2, 1×3, 1×4, personalizado) o guías precisas, con exportación en **PNG / JPG / WEBP** y empaquetado en **ZIP**.

## Características

- Carga de **PDF (Illustrator), PNG, JPG/JPEG, WEBP** (arrastrar y soltar o pegar con Ctrl+V).
- **DPI seleccionable** para PDF (72–1200) con re-rasterizado bajo demanda.
- **Plantillas rápidas** (1×2, 1×3, 1×4…) y **grilla personalizada** (filas × columnas).
- **Guías arrastrables** con snap a fracciones (1/4, 1/3, 1/2, 2/3, 3/4) y edición numérica.
- **Vista previa** con peso por corte, zoom/pan en el lienzo y vista ampliada.
- **Formato y calidad** ajustables; fondo para JPG (evita negros con transparencia).
- **Márgenes, separación (gutter) y sangrado (bleed)**.
- **Tamaño de salida exacto** (px o cm) con dimensiones físicas.
- **Deshacer/Rehacer** (Ctrl+Z / Ctrl+Y), **presets guardados**, **procesamiento por lotes**.
- **Atajos de teclado**: Ctrl+Enter dividir, Ctrl+D descargar, G/L cambiar modo, Esc cerrar modal.
- **Modo claro/oscuro** con persistencia; **PWA** instalable y offline.
- Exportación en **ZIP** con nombres ordenados (`1.png`, `2.png`…) y correlativo (`nodos-cortes-00001.zip`).

## Requisitos

- Node.js 20+ (probado con v22)
- En Windows, si `npm` está bloqueado por la política de ejecución, usa `npm.cmd`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build y vista previa

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/
```

## Tests

```bash
npm run test       # vitest run
npm run test:watch # vitest
```

## Lint

```bash
npm run lint
```

## Estructura

```
src/
  App.tsx                 # orquestación de estado
  types.ts                # tipos compartidos
  utils/
    slicing.ts            # motor de cortes (grid/guías/espaciado) + tests
    renderSlices.ts       # recorte real + ZIP blobs (worker + fallback)
    loadImage.ts           # raster → canvas
    loadPdf.ts            # PDF → canvas con DPI (pdf.js)
    format.ts             # formateo de bytes
  workers/
    slice.worker.ts       # Web Worker de recorte
  components/
    UploadPanel, ResolutionPanel, CutSettingsPanel, ExportPanel,
    PresetsPanel, ImageWorkspace, PreviewPanel
public/
  manifest.webmanifest, sw.js, icon-*.png, logo-nodos*.png, favicon.png
```

## Notas técnicas

- Los cortes se calculan siempre en **píxeles de la fuente a resolución completa** (redondeo acumulado para evitar huecos/solapes de 1 px).
- `pdf.js` se carga bajo demanda para mantener el bundle inicial pequeño.
- El recorte pesado corre en un **Web Worker** (con fallback al hilo principal si no hay `OffscreenCanvas`).
- El modo oscuro, DPI, formato, calidad, márgenes y presets se **persisten en `localStorage`**.

## Licencia

Uso interno — nodos.pe.
