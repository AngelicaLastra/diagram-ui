# Sketch lab

A prototype that rebuilds the parts of `diagram-studio.html` that Excalidraw
does not ship, on top of Excalidraw itself. Nothing here touches the original
single-file app, which still lives at `../diagram-studio.html`.

```bash
npm install        # already done
npm run dev        # http://localhost:5199
npm run standalone # writes standalone/index.html, which you can just double-click
```

Note that `index.html` at the root is a Vite **source** file, not a page. Opening
it over `file://` gives a blank screen with no error, because the browser fetches
`/src/main.jsx` and has nothing to compile it with. Use the dev server while
editing, or `npm run standalone` to get one self-contained file (roughly 8 MB,
with every Excalidraw chunk and font inlined) that opens anywhere, the way
`../diagram-studio.html` does.

## What it adds on top of Excalidraw

- **The Play reveal** (`src/reveal.js`). Walks the bound arrows as a graph so the
  diagram unfolds in reading order, then steps element opacity from 0 back to
  its original value through `updateScene`. Every write is marked
  `CaptureUpdateAction.NEVER`, so playing a reveal never lands in the undo stack.
- **The six tones** (`src/tones.js`) as one-click styling for the selection, plus
  a mapping of our two shape styles onto Excalidraw's own controls: `wash` is
  `fillStyle: solid` at `roughness: 1`, and `inked` is `fillStyle: hachure` at
  `roughness: 2`.
- **Sheets** (`src/sheets.js`). Excalidraw has frames but no pages, so sheets are
  kept as separate element arrays in local storage and swapped in with
  `updateScene`.
- **Paper grain** (`.grain` in `src/lab.css`). Excalidraw draws to canvas, so the
  original `feTurbulence` filter cannot follow us. This is an SVG noise layer
  sitting over the canvas with `mix-blend-mode: multiply`.

## What it gets for free

Hand-drawn rendering, arrows that stay bound while you move shapes, elbow
arrows, labels inside shapes and on arrows, undo and redo, multi-select,
alignment, grouping, the shape library, PNG and SVG export, and dark mode.

## What would still need a fork

The three pieces that live inside their canvas renderer: the paper-grain filter
applied per shape rather than over the whole canvas, the wash fill with a single
heavy ink stroke down one edge, and a two-part title-and-caption label bound to
a shape. Everything above was reachable through the public package API.
