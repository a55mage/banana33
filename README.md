# banana33

Web app statica per creare semplici ambienti 2D/3D:

- **Verifica ingombri**: uno spazio contenitore, oggetti primitivi o preset, rilevamento collisioni e disposizione automatica.
- **Planimetrie**: disegno muri, porte e finestre, arredo.

Progetti salvati automaticamente in IndexedDB; download/upload come file `.b33.json`.

## Stack

| Ambito | Scelta |
| --- | --- |
| Build | Vite + TypeScript (output statico, `base: './'` per GitHub Pages) |
| UI | React 19 |
| 3D/2D | three.js via @react-three/fiber + drei (2D = camera ortografica dall'alto sulla stessa scena) |
| Stato | zustand + immer (undo/redo con snapshot immutabili) |
| Persistenza | idb-keyval (IndexedDB) |
| Validazione file | zod (lo schema è anche la fonte dei tipi) |

## Sviluppo

```bash
npm install
npm run dev
```

## Deploy

Push su `main`: il workflow `.github/workflows/deploy.yml` builda e pubblica su GitHub Pages
(in *Settings → Pages* impostare *Source: GitHub Actions*).

## Struttura

- `src/model` – schema dati (zod) e factory/preset
- `src/geometry` – impronte, collisioni (SAT), disposizione automatica, segmentazione muri
- `src/store` – stato progetto (con cronologia) e stato UI
- `src/persistence` – IndexedDB e import/export file
- `src/scene` – componenti three.js
- `src/ui` – pannelli e toolbar
