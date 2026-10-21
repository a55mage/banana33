# Piano di sviluppo — Modalità "Modello 3D" (stile Womp)

Stato: **approvato** · fasi 0–4 completate (21/10/2026)

## Obiettivo

Affiancare alle modalità **Spazio** e **Planimetria** una terza modalità, **Modello 3D**, per modellare oggetti semplici combinando forme primitive in modo "morbido", come fa Womp:

- forme primitive che si **fondono** tra loro con un raccordo regolabile ("goop");
- forme che **scavano** (sottrazione) o **intersecano** le altre;
- arrotondamento degli spigoli, simmetria, colori e materiali;
- esportazione della mesh (STL/OBJ/GLB) e riuso del modello come oggetto negli altri progetti.

La modalità di un progetto si sceglie alla creazione e **non si può più cambiare**.

---

## 1. Modalità fissa per progetto (prerequisito)

Oggi la modalità è implicita: un progetto è "spazio" se ha il contenitore, "planimetria" se no, e la checkbox *Spazio contenitore* passa dall'una all'altra.

**Modifiche**

- Nuovo campo `kind: 'space' | 'plan' | 'model'` nello schema del progetto.
  - Migrazione dei progetti salvati e dei file caricati: `kind = space ? 'space' : 'plan'`.
- Nuova finestra **Nuovo progetto** con tre schede (Spazio, Planimetria, Modello 3D) al posto delle voci attuali del menu *Progetto*.
- Spazio: il contenitore è sempre presente (le dimensioni restano modificabili, la checkbox sparisce).
- Planimetria: niente contenitore.
- L'elenco *Progetti nel browser* mostra un'icona per tipo.
- La UI si adatta al tipo: pannelli, schede di *Aggiungi* e scorciatoie diverse per Modello 3D.

**Da decidere** — vedi le domande in fondo: in un progetto Spazio si possono ancora disegnare muri?

---

## 2. Approccio tecnico: SDF + ray marching

Womp non lavora su mesh ma su **campi di distanza con segno (SDF)**: ogni forma è una funzione `d(p)` (distanza dal punto `p` alla superficie). Combinare forme è aritmetica sulle distanze:

| Operazione | Formula | Effetto |
| --- | --- | --- |
| Unione | `min(a, b)` | somma le forme |
| Unione morbida | `smin(a, b, k)` | fusione con raccordo di raggio `k` (il "goop") |
| Sottrazione (morbida) | `smax(a, -b, k)` | scava la forma `b` da `a` |
| Intersezione (morbida) | `smax(a, b, k)` | tiene solo la parte comune |
| Arrotondamento | `d - r` | spigoli arrotondati |
| Simmetria | `p.x = abs(p.x)` | specchia sul piano YZ |

Vantaggi rispetto alle mesh: fusioni e sottrazioni sempre "pulite", nessuna geometria da ricalcolare mentre si trascina, file piccolissimi (il progetto salva solo l'albero delle forme).

**Rendering**: uno shader GLSL di ray marching disegnato dentro la scena di react-three-fiber. Il codice dello shader viene **generato dall'albero delle forme**:

- la struttura (quali forme e operazioni) cambia il codice dello shader, quindi va ricompilato;
- trasformazioni, dimensioni, raccordi e colori sono **uniform**: trascinare non ricompila niente.

Lo shader scrive `gl_FragDepth`, così griglia, manipolatore e contorni di selezione si compongono correttamente con il modello. Luce, ombre morbide e occlusione ambientale sono calcolate nello shader.

**Selezione**: le stesse funzioni SDF esistono anche in TypeScript. Al clic si fa ray marching in JavaScript lungo il raggio del mouse; la forma selezionata è quella con distanza minima nel punto colpito.

**Esportazione**: estrazione della superficie (*marching cubes* o *surface nets*) campionando l'SDF su una griglia 3D, in un **Web Worker** per non bloccare l'interfaccia. Risoluzione a scelta (bozza / media / alta).

---

## 3. Modello dati

```ts
// nel progetto, solo quando kind === 'model'
interface SculptDoc {
  nodes: SculptNode[]        // albero piatto con parentId
  material: { preset: 'matte' | 'glossy' | 'metal' | 'clay'; background: string }
  symmetry: { x: boolean; y: boolean; z: boolean }
}

interface SculptNode {
  id: string
  parentId: string | null    // gruppi annidati
  kind: 'group' | 'sphere' | 'box' | 'cylinder' | 'cone' | 'torus' | 'capsule' | 'ellipsoid'
  name: string
  op: 'add' | 'subtract' | 'intersect'
  blend: number              // raggio di fusione "goop", in metri
  round: number              // arrotondamento degli spigoli
  position: [x, y, z]; rotation: [x, y, z]; size: [x, y, z]
  color: string
  hidden: boolean; locked: boolean
}
```

L'ordine dei nodi conta: ogni nodo si combina con il risultato dei precedenti dello stesso gruppo, come i livelli in Womp. Lo schema zod valida tutto, come per gli altri progetti, e annulla/ripeti funziona senza modifiche perché lo stato resta immutabile.

---

## 4. Interfaccia della modalità Modello 3D

- **Barra sinistra**: palette delle forme (sfera, cubo, cilindro, cono, toro, capsula) con icona, e albero dei **livelli** trascinabile (riordino, gruppi, occhio per nascondere, lucchetto).
- **Centro**: vista 3D con griglia, piano d'appoggio e manipolatore Q/W/E/R già esistente.
- **Barra destra**: inspector della forma — operazione (Aggiungi / Scava / Interseca), **Goop**, **Arrotondamento**, dimensioni con blocco proporzioni, posizione, rotazione, colore. Poi le impostazioni globali: materiale, simmetria X/Y/Z, sfondo.
- **Barra in alto**: menu Progetto, annulla/ripeti, modalità del manipolatore, **Esporta** (STL, OBJ, GLB).
- **Scorciatoie**: le stesse di oggi, più `A` aggiungi / `S` scava / `I` interseca sulla forma selezionata, `Ctrl+D` duplica, `M` simmetria.

---

## 5. Fasi di sviluppo

| # | Fase | Contenuto | Risultato verificabile |
| --- | --- | --- | --- |
| 0 | **Modalità fissa** | campo `kind`, migrazione, finestra Nuovo progetto, UI per tipo | spazio e planimetria non si scambiano più; progetti vecchi caricati correttamente |
| 1 | **Dati e stato** | schema `SculptDoc`, azioni (aggiungi, modifica, riordina, raggruppa), progetto di esempio | si salva, si ricarica, annulla/ripeti funziona |
| 2 | **Motore SDF** | funzioni SDF in GLSL e in TS, generatore di shader, ray marching, luce, `gl_FragDepth` | il modello di esempio si vede correttamente e a 60 fps |
| 3 | **Interazione** | selezione al clic, manipolatore, inspector, livelli, scorciatoie | si modella un oggetto semplice senza toccare il codice |
| 4 | **Funzioni Womp** | goop, scava/interseca morbidi, arrotondamento, simmetria, materiali, gruppi con operazione propria; poi specchio e finitura per forma, guscio, selezione multipla, forme che scavano sempre visibili | si ottengono forme "organiche" come in Womp |
| 5 | **Esportazione** | marching cubes in Web Worker, STL/OBJ/GLB, scelta risoluzione | il file si apre in un programma esterno (Blender, slicer) |
| 6 | **Integrazione** | "Salva come oggetto": il modello entra nel catalogo di Spazio e Planimetria come oggetto personalizzato (ingombro = bounding box, mesh rigenerata dall'SDF) | un modello creato si posiziona e collide come gli altri oggetti |
| 7 | **Rifinitura** | limiti e prestazioni, mobile, traduzioni, test | build pulita, test verdi |

Ogni fase si chiude con build, verifica nel browser e un commit separato.

**Test**: si aggiunge Vitest per le parti pure — funzioni SDF (TS e GLSL devono dare gli stessi valori), generatore di shader, meshing (mesh chiusa, nessun triangolo degenere), migrazione dei progetti.

---

## 6. Rischi e mitigazioni

- **Tempo di compilazione dello shader** con molte forme: si ricompila solo quando cambia la struttura; limite iniziale di ~64 forme (gli uniform vengono impacchettati in texture se servisse di più).
- **Prestazioni del ray marching** su GPU deboli: risoluzione ridotta durante il movimento della camera e qualità piena da fermi; numero di passi limitato; bounding box per saltare lo spazio vuoto.
- **Coerenza tra GLSL e TypeScript** (selezione ed esportazione devono vedere la stessa forma): stesse formule generate da una sola definizione e test che le confrontano.
- **Mesh pesanti all'esportazione**: risoluzione selezionabile e semplificazione opzionale.
- **WebGL2** necessario: già richiesto da three.js r180, nessun cambiamento.

Nessuna nuova dipendenza obbligatoria: three.js e react-three-fiber bastano per il rendering, il meshing si scrive in casa (circa 200 righe). Opzionale `three-mesh-bvh` solo se servisse una selezione più veloce.

---

## 7. Domande aperte

1. **Spazio e muri**: in un progetto Spazio la scheda *Edificio* (muri, porte, finestre) resta disponibile o si nasconde? *(proposta: si nasconde; lo Spazio è il contenitore)*
2. **Primo rilascio**: fasi 0–5 (modellazione ed esportazione), lasciando l'integrazione (fase 6) a dopo? *(proposta: sì)*
3. **Forme iniziali**: sfera, cubo, cilindro, cono, toro, capsula bastano per partire? Testo 3D e curve/tubi verrebbero dopo.
