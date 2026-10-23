import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { TONES, toneProps } from "./tones";

const [BLUE, AMBER, SALMON, SAGE, , TEAL] = TONES;

/* The nightly pipeline sheet, rebuilt with Excalidraw's element schema so the
   arrows are genuinely bound to the boxes rather than drawn at coordinates. */
export function sampleElements() {
  const arrow = (from, to, x, y, width, height, extra) => ({
    type: "arrow", x, y, width, height,
    /* focus 0 aims the binding at the shape's centre, so arrows leave and
       arrive square instead of clipping a corner. */
    start: { id: from, focus: 0, gap: 6 }, end: { id: to, focus: 0, gap: 6 },
    strokeColor: "#A9A59A", roughness: 1, strokeWidth: 2,
    ...(extra || {})
  });

  const box = (id, x, y, text, tone, style) => ({
    type: "rectangle", id, x, y, width: 210, height: 78,
    ...toneProps(tone, style || "wash"),
    label: { text, fontSize: 16, fontFamily: 1 }
  });

  return convertToExcalidrawElements([
    { type: "text", x: 120, y: 60, text: "Nightly pipeline run", fontSize: 28, fontFamily: 1, strokeColor: "#23231F" },

    box("a", 120, 130, "Source systems", BLUE),
    box("b", 120, 280, "Airflow ingest", BLUE),
    box("c", 120, 430, "Snowflake raw", TEAL),
    box("d", 120, 580, "dbt build", SAGE, "inked"),

    { type: "diamond", id: "e", x: 420, y: 560, width: 230, height: 130,
      ...toneProps(SALMON, "wash"),
      label: { text: "Tests pass?", fontSize: 16, fontFamily: 1 } },

    box("f", 740, 580, "Dashboards", AMBER),
    { type: "rectangle", id: "g", x: 740, y: 370, width: 210, height: 78,
      backgroundColor: "transparent", strokeColor: "#DD4B44",
      fillStyle: "solid", roughness: 1, strokeWidth: 2, strokeStyle: "dashed",
      label: { text: "Alert on-call", fontSize: 16, fontFamily: 1, strokeColor: "#DD4B44" } },

    /* Bound arrows still need a span to route along; without width and height
       convertToExcalidrawElements leaves them as stubs. */
    arrow("a", "b", 225, 208, 0, 72),
    arrow("b", "c", 225, 358, 0, 72),
    arrow("c", "d", 225, 508, 0, 72),
    arrow("d", "e", 330, 619, 90, 6),
    arrow("e", "f", 650, 625, 90, 14, { strokeColor: "#86A86F", label: { text: "pass", fontSize: 14, fontFamily: 1, strokeColor: "#4C7040" } }),
    arrow("e", "g", 535, 560, 205, -151, { strokeColor: "#DD4B44", label: { text: "fail", fontSize: 14, fontFamily: 1, strokeColor: "#DD4B44" } }),
    arrow("g", "d", 740, 409, -410, 210, {
      strokeColor: "#DD4B44", strokeStyle: "dashed", elbowed: true,
      label: { text: "retry after fix", fontSize: 14, fontFamily: 1, strokeColor: "#DD4B44" }
    })
  ]);
}
