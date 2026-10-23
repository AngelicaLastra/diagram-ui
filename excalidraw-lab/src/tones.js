/* The six tones from diagram-studio, expressed as Excalidraw element styling. */
export const TONES = [
  { name: "Blue",   fill: "#C3DDF4", accent: "#6FA9DB" },
  { name: "Amber",  fill: "#F8DFA3", accent: "#EFB13A" },
  { name: "Salmon", fill: "#F3CBC0", accent: "#DD4B44" },
  { name: "Sage",   fill: "#D7E4CD", accent: "#86A86F" },
  { name: "Lilac",  fill: "#DDD4EC", accent: "#8E7BB5" },
  { name: "Teal",   fill: "#AFCDCB", accent: "#2E7A7B" }
];

/* "Wash" and "inked" as Excalidraw understands them. Their fillStyle does the
   work our hatch loop used to do, and roughness stands in for our jitter. */
export const STYLES = {
  wash:  { fillStyle: "solid",  roughness: 1, strokeWidth: 2 },
  inked: { fillStyle: "hachure", roughness: 2, strokeWidth: 2 }
};

export function toneProps(tone, style) {
  return Object.assign({ backgroundColor: tone.fill, strokeColor: tone.accent }, STYLES[style] || STYLES.wash);
}
