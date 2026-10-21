# banana33

Web app statica per creare semplici ambienti 2D/3D e modellare oggetti. Ogni progetto ha un tipo,
scelto alla creazione e non più modificabile:

- **Spazio** — un contenitore in cui verificare se gli oggetti ci stanno: collisioni, disposizione
  automatica (con rotazioni, mobili con il retro al muro), gruppi, manipolatore stile Unity.
- **Planimetria** — muri, porte, finestre e scale, arredo, vista 3D con muri "alla The Sims".
- **Modello 3D** — modellazione per forme come in Womp: sfere, cubi, cilindri, coni, tori e capsule
  che si fondono (goop), scavano o si intersecano; arrotondamento, guscio, specchio, finiture,
  livelli e gruppi. Esportazione in STL (stampa 3D), OBJ e GLB; i modelli si possono poi usare
  come oggetti negli spazi e nelle planimetrie (Arredo › I miei modelli).

Progetti salvati automaticamente in IndexedDB; download/upload come file `.b33.json`.
Interfaccia in italiano e inglese, tema chiaro e scuro; `?` mostra le scorciatoie da tastiera.

## Stack

| Ambito | Scelta |
| --- | --- |
| Build | Vite + TypeScript (output statico, `base: './'` per GitHub Pages) |
| UI | React 19 |
| 3D/2D | three.js via @react-three/fiber + drei (2D = camera ortografica dall'alto sulla stessa scena) |
| Stato | zustand + immer (undo/redo con snapshot immutabili) |
| Persistenza | idb-keyval (IndexedDB) |
| Validazione file | zod (lo schema è anche la fonte dei tipi) |
| Modelli 3D | campi di distanza (SDF): ray marching in GLSL per il disegno, le stesse funzioni in TypeScript per selezione ed esportazione (surface nets in un Web Worker) |
| Test | Vitest |

## Sviluppo

```bash
npm install
npm run dev
```

```bash
npm test
```

## Deploy

Push su `main`: il workflow `.github/workflows/deploy.yml` esegue i test, builda e pubblica su GitHub Pages
(in *Settings → Pages* impostare *Source: GitHub Actions*).

## Struttura

- `src/model` – schema dati (zod) e factory/preset
- `src/geometry` – impronte, collisioni (SAT), disposizione automatica, segmentazione muri
- `src/store` – stato progetto (con cronologia) e stato UI
- `src/persistence` – IndexedDB e import/export file
- `src/sculpt` – motore dei modelli 3D: funzioni SDF, compilazione in GLSL, selezione, mesh ed esportazione
- `src/scene` – componenti three.js
- `src/ui` – pannelli e toolbar
- `docs/piano-modellazione-3d.md` – piano di sviluppo della modalità Modello 3D
