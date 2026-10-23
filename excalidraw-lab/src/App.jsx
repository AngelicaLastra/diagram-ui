import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Excalidraw, MainMenu, Footer,
  CaptureUpdateAction, newElementWith, exportToSvg
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./lab.css";

import { TONES, toneProps } from "./tones";
import { createRevealPlayer } from "./reveal";
import { sampleElements } from "./sample";
import { loadSheets, saveSheets, blankSheet } from "./sheets";

const SPEEDS = [["1100", "Slow"], ["700", "Normal"], ["420", "Fast"]];

export default function App() {
  const apiRef = useRef(null);

  /* The scene lives in a ref, never in state. Excalidraw calls onChange for
     every pointer move, so re-rendering this component on each one would
     re-render the whole editor and loop. */
  const docRef = useRef({ sheets: [], active: 0 });
  const saveTimer = useRef(null);

  const [tabs, setTabs] = useState([]);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("700");
  const [grain, setGrain] = useState(true);
  const activeRef = useRef(0);
  activeRef.current = active;

  const player = useMemo(
    () => createRevealPlayer(() => apiRef.current, { CaptureUpdateAction, newElementWith }),
    []
  );

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSheets(docRef.current), 500);
  }, []);

  const syncTabs = useCallback(() => {
    setTabs(docRef.current.sheets.map((s) => ({ id: s.id, name: s.name })));
  }, []);

  const onApi = useCallback((api) => {
    if (apiRef.current) return;
    apiRef.current = api;

    const stored = loadSheets();
    const start = stored || { sheets: [{ id: "s1", name: "Pipeline", elements: sampleElements() }], active: 0 };
    const index = Math.min(start.active || 0, start.sheets.length - 1);
    docRef.current = { sheets: start.sheets, active: index };

    activeRef.current = index;
    setActive(index);
    syncTabs();

    /* excalidrawAPI fires while Excalidraw is still mounting, so the first
       scene write has to wait a tick or React drops it with a warning. */
    setTimeout(() => {
      api.updateScene({
        elements: start.sheets[index].elements,
        appState: {
          viewBackgroundColor: "#FFFFFF",
          currentItemRoughness: 1,
          currentItemFillStyle: "solid",
          currentItemStrokeWidth: 2,
          currentItemFontFamily: 1,
          currentItemBackgroundColor: TONES[0].fill,
          currentItemStrokeColor: TONES[0].accent
        },
        captureUpdate: CaptureUpdateAction.NEVER
      });
      api.scrollToContent(api.getSceneElements(), { fitToContent: true });
      if (typeof window !== "undefined") window.__lab = { api, player, doc: docRef };
    }, 0);
  }, [syncTabs, player]);

  const onChange = useCallback((elements) => {
    const d = docRef.current;
    if (!d.sheets.length || player.playing()) return;
    const sheet = d.sheets[activeRef.current];
    if (!sheet) return;
    sheet.elements = elements;
    d.active = activeRef.current;
    flush();
  }, [player, flush]);

  useEffect(() => () => { player.stop(); clearTimeout(saveTimer.current); }, [player]);

  const gotoSheet = useCallback((index) => {
    const api = apiRef.current;
    const d = docRef.current;
    if (!api || index === activeRef.current || !d.sheets[index]) return;
    player.stop(); setPlaying(false);
    d.sheets[activeRef.current].elements = api.getSceneElements();
    d.active = index;
    activeRef.current = index;
    setActive(index);
    api.updateScene({ elements: d.sheets[index].elements, captureUpdate: CaptureUpdateAction.NEVER });
    setTimeout(() => api.scrollToContent(api.getSceneElements(), { fitToContent: true }), 60);
    flush();
  }, [player, flush]);

  const addSheet = useCallback(() => {
    const api = apiRef.current;
    const d = docRef.current;
    if (!api) return;
    if (d.sheets[activeRef.current]) d.sheets[activeRef.current].elements = api.getSceneElements();
    d.sheets.push(blankSheet("Sheet " + (d.sheets.length + 1)));
    const index = d.sheets.length - 1;
    d.active = index;
    activeRef.current = index;
    setActive(index);
    syncTabs();
    api.updateScene({ elements: [], captureUpdate: CaptureUpdateAction.NEVER });
    flush();
  }, [syncTabs, flush]);

  const togglePlay = useCallback(() => {
    if (player.playing()) { player.stop(); setPlaying(false); return; }
    setPlaying(player.play(parseInt(speed, 10), () => setPlaying(false)));
  }, [player, speed]);

  const applyTone = useCallback((tone, style) => {
    const api = apiRef.current;
    if (!api) return;
    const props = toneProps(tone, style);
    const chosen = api.getAppState().selectedElementIds || {};
    const ids = Object.keys(chosen).filter((id) => chosen[id]);

    if (ids.length) {
      const wanted = new Set(ids);
      const next = api.getSceneElements().map((el) => {
        if (!wanted.has(el.id)) return el;
        if (el.type === "arrow" || el.type === "line") return newElementWith(el, { strokeColor: props.strokeColor });
        return newElementWith(el, props);
      });
      api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    }
    api.updateScene({
      appState: {
        currentItemBackgroundColor: props.backgroundColor,
        currentItemStrokeColor: props.strokeColor,
        currentItemFillStyle: props.fillStyle,
        currentItemRoughness: props.roughness
      },
      captureUpdate: CaptureUpdateAction.NEVER
    });
  }, []);

  const exportSheetSvg = useCallback(async () => {
    const api = apiRef.current;
    const svg = await exportToSvg({
      elements: api.getSceneElements(),
      appState: { ...api.getAppState(), exportBackground: true, exportPadding: 24 },
      files: api.getFiles()
    });
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (docRef.current.sheets[activeRef.current]?.name || "sheet") + ".svg";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, []);

  const loadTheSample = useCallback(() => {
    const api = apiRef.current;
    const els = sampleElements();
    api.updateScene({ elements: els, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    setTimeout(() => api.scrollToContent(api.getSceneElements(), { fitToContent: true }), 60);
  }, []);

  const topRight = useCallback(() => (
    <div className="strip">
      <button className="chip" data-on={grain} onClick={() => setGrain((g) => !g)} title="Paper grain over the canvas">
        Grain
      </button>
      <span className="chip" style={{ padding: "0 8px" }}>
        <select value={speed} onChange={(e) => setSpeed(e.target.value)} aria-label="Reveal speed">
          {SPEEDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </span>
      <button className="chip accent" onClick={togglePlay} data-testid="play">
        {playing ? "■ Stop" : "▶ Play"}
      </button>
    </div>
  ), [grain, speed, playing, togglePlay]);

  const initialData = useMemo(() => ({ appState: { viewBackgroundColor: "#FFFFFF" } }), []);

  return (
    <div className="lab">
      <Excalidraw
        excalidrawAPI={onApi}
        onChange={onChange}
        renderTopRightUI={topRight}
        initialData={initialData}
      >
        <MainMenu>
          <MainMenu.Item onSelect={loadTheSample}>Load the sample</MainMenu.Item>
          <MainMenu.Item onSelect={addSheet}>Add a sheet</MainMenu.Item>
          <MainMenu.Item onSelect={exportSheetSvg}>Export this sheet as SVG</MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>

        <Footer>
          <div className="tonebar">
            <span className="label">Tones</span>
            <span className="dots">
              {TONES.map((tone) => (
                <button
                  key={tone.name}
                  className="dot"
                  style={{ background: tone.fill, borderColor: tone.accent }}
                  title={tone.name + " wash"}
                  onClick={() => applyTone(tone, "wash")}
                />
              ))}
            </span>
            <span className="sep" />
            <button className="chip" onClick={() => applyTone(TONES[5], "inked")} title="Inked and hatched">
              Inked
            </button>
            <span className="sep" />
            <span className="sheets" data-testid="sheets">
              {tabs.map((t, i) => (
                <button key={t.id} data-on={i === active} onClick={() => gotoSheet(i)}>{t.name}</button>
              ))}
              <button onClick={addSheet} title="Add a sheet">+</button>
            </span>
          </div>
        </Footer>
      </Excalidraw>

      <div className={"grain" + (grain ? "" : " off")} />
    </div>
  );
}
