# Herramientas de Diseño Nodos

Aplicación web y de escritorio para cortar imágenes (PNG, JPG, WEBP) y PDF (incluye archivos de Illustrator) usando plantillas rápidas (1×2, 1×3, 1×4, personalizado) o guías precisas, con exportación en **PNG / JPG / WEBP** y empaquetado en **ZIP**.

## Descarga

- **Windows**: [Descargar instalador (.exe)](https://github.com/Darklencito/recortesimagenes/releases/latest)
- **macOS**: [Descargar (.dmg)](https://github.com/Darklencito/recortesimagenes/releases/latest)

### Instalación en Windows
1. Descarga `nodos-cortes-X.Y.Z-win-x64.exe`.
2. Haz doble clic. El instalador es **silencioso**: no muestra asistente, instala en `%LOCALAPPDATA%\Programs\` y crea accesos directos.
3. La app se abre automáticamente al terminar.

> Windows SmartScreen puede mostrar "Windows protegió tu PC". Haz clic en **Más información → Ejecutar de todas formas** (la app no está firmada con certificado).

### Instalación en macOS
1. Descarga `nodos-cortes-X.Y.Z-mac-arm64.dmg` (o `x64` según tu Mac).
2. Abre el `.dmg` y **arrastra la app** a la carpeta **Aplicaciones**.
3. La primera vez, macOS bloqueará la app (Gatekeeper). Para abrirla:
   - **Clic derecho → Abrir** y confirma, o
   - **Ajustes del Sistema → Privacidad y seguridad → "Abrir de todas formas"**, o
   - En Terminal: `xattr -cr "/Applications/Herramientas de Diseño Nodos.app"`

### Actualizaciones automáticas
La app de escritorio **se actualiza sola**: detecta nuevas versiones en GitHub, las descarga en segundo plano y te avisa para reiniciar. No necesitas reinstalar manualmente.

## Características

- Carga de **PDF (Illustrator), PNG, JPG/JPEG, WEBP** (arrastrar y soltar o pegar con Ctrl+V).
- **DPI seleccionable** para PDF (72–1200) con re-rasterizado bajo demanda y selector de página.
- **Plantillas rápidas** (1×2, 1×3, 1×4…) y **grilla personalizada** (filas × columnas).
- **Guías arrastrables** con snap a fracciones (1/4, 1/3, 1/2, 2/3, 3/4) y edición numérica.
- **Vista previa** con peso por corte, zoom/pan en el lienzo y vista ampliada.
- **Formato y calidad** ajustables; fondo para JPG (evita negros con transparencia).
- **Márgenes, separación (gutter) y sangrado (bleed)**.
- **Tamaño de salida exacto** (px o cm) con dimensiones físicas.
- **Deshacer/Rehacer** (Ctrl+Z / Ctrl+Y), **presets guardados**, **procesamiento por lotes**.
- **Atajos de teclado**: Ctrl+Enter dividir, Ctrl+D descargar, G/L cambiar modo, Esc cerrar modal.
- **Modo claro/oscuro** con persistencia; **PWA** instalable y offline.
- **Centro de notificaciones** con historial y toasts.
- Exportación en **ZIP** con nombres ordenados (`1.png`, `2.png`…) y correlativo (`nodos-cortes-00001.zip`).
- **Auto-actualización** silenciosa (sin reinstalar manualmente).

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

## Instalador de escritorio

```bash
npm run electron:build:win   # Windows (.exe)
npm run electron:build:mac   # macOS (.dmg, requiere Mac)
npm run release              # bump versión + push (dispara CI)
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
    PresetsPanel, ImageWorkspace, PreviewPanel, Toast, NotificationPanel
public/
  manifest.webmanifest, sw.js, icon-*.png, logo-nodos*.png, favicon.png, installer.html
build/
  icon-1024.png, dmg-background.png
electron/
  main.cjs, preload.cjs
installer/
  app branded (Electron) que instala silenciosamente
```

## Notas técnicas

- Los cortes se calculan siempre en **píxeles de la fuente a resolución completa** (redondeo acumulado para evitar huecos/solapes de 1 px).
- `pdf.js` se carga bajo demanda para mantener el bundle inicial pequeño.
- El recorte pesado corre en un **Web Worker** (con fallback al hilo principal si no hay `OffscreenCanvas`).
- El modo oscuro, DPI, formato, calidad, márgenes y presets se **persisten en `localStorage`**.
- La app de escritorio usa **auto-update silencioso** (sin reinstalar manualmente).

## Licencia

Uso interno — nodos.pe.
