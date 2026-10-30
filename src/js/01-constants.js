/* ================================================================
   1. Constants  (palette and roughness kept from the original)
   ================================================================ */
var INK = "#23231F";
var INK_SOFT = "#8C8A80";
var LINE = "#A9A59A";
var RED = "#DD4B44";
var NS = "http://www.w3.org/2000/svg";

var PRESETS = [
  { name: "Blue",   fill: "#C3DDF4", accent: "#6FA9DB" },
  { name: "Amber",  fill: "#F8DFA3", accent: "#EFB13A" },
  { name: "Salmon", fill: "#F3CBC0", accent: "#DD4B44" },
  { name: "Sage",   fill: "#D7E4CD", accent: "#86A86F" },
  { name: "Lilac",  fill: "#DDD4EC", accent: "#8E7BB5" },
  { name: "Teal",   fill: "#AFCDCB", accent: "#2E7A7B" }
];
var SWATCHES = [
  "#FFFFFF", "#F5F2EA", "#E4E0D6", "#C3DDF4", "#6FA9DB", "#2E5E8C",
  "#F8DFA3", "#EFB13A", "#B97F12", "#F3CBC0", "#DD4B44", "#9E2F2A",
  "#D7E4CD", "#86A86F", "#4C7040", "#AFCDCB", "#2E7A7B", "#1C4F50",
  "#DDD4EC", "#8E7BB5", "#5B4A85", "#A9A59A", "#5F5D55", "#23231F"
];

var ROUGHNESS = {
  clean:  { jitter: 0,   scale: 0 },
  light:  { jitter: 1.5, scale: 3 },
  medium: { jitter: 3.2, scale: 5.5 },
  heavy:  { jitter: 6,   scale: 8.5 }
};

var FILTER_COUNT = 4;
var FILTER_MIX = [0.85, 1, 1.18, 0.95];
var SIDES = ["top", "right", "bottom", "left"];
var WASH = 0.72;
var WASH_EDGE = 0.88;
var MIN_W = 50;
var MIN_H = 34;
var GRID_STEP = 10;

var SHAPE_KINDS = [
  { type: "box",     style: "wash",   label: "Box" },
  { type: "box",     style: "sketch", label: "Inked" },
  { type: "diamond", style: "wash",   label: "Diamond" },
  { type: "ellipse", style: "wash",   label: "Ellipse" },
  { type: "pill",    style: "wash",   label: "Pill" },
  { type: "note",    style: "wash",   label: "Note" },
  { type: "database", style: "wash",  label: "Database" },
  { type: "table",   style: "wash",   label: "Table" },
  { type: "code",    style: "wash",   label: "Code" }
];
var MIN_CELL_W = 28;
var MIN_CELL_H = 22;

/* Icons are literal strings. Nothing the user types ever reaches innerHTML. */
var ICONS = {
  select: '<path d="M4 2.5 L13 9.5 L9.2 10.2 L11 14.2 L9.2 15 L7.4 11 L4.6 13.4 Z"/>',
  box: '<rect x="2.5" y="4.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  diamond: '<path d="M9 3 L15 9 L9 15 L3 9 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  ellipse: '<ellipse cx="9" cy="9" rx="6.4" ry="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  pill: '<rect x="2.2" y="5.4" width="13.6" height="7.2" rx="3.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  note: '<path d="M3.4 3.6 h9.2 l3 3 v7.8 h-12.2 z M12.6 3.6 v3 h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  database: '<g fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="9" cy="4.6" rx="5.6" ry="2.1"/><path d="M3.4 4.6 V13.4 C3.4 14.6 5.9 15.5 9 15.5 C12.1 15.5 14.6 14.6 14.6 13.4 V4.6"/></g>',
  line: '<path d="M3 14.5 L15 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  table: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="3.5" width="13" height="11" rx="1.5"/><path d="M2.5 7.2 H15.5 M2.5 10.9 H15.5 M7 3.5 V14.5 M11.2 3.5 V14.5" stroke-width="1.1"/></g>',
  merge: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="13" height="10" rx="1.5"/><path d="M5.5 9 H12.5 M10.5 7 L12.5 9 L10.5 11 M7.5 7 L5.5 9 L7.5 11"/></g>',
  unmerge: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="13" height="10" rx="1.5"/><path d="M9 4 V14" stroke-dasharray="1.6 1.8"/><path d="M7 9 H4.5 M5.8 7.6 L4.4 9 L5.8 10.4 M11 9 H13.5 M12.2 7.6 L13.6 9 L12.2 10.4"/></g>',
  wrap: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5 H15"/><path d="M3 9 H12.5 a2.25 2.25 0 0 1 0 4.5 H9"/><path d="M10.6 11.9 L9 13.5 L10.6 15.1"/><path d="M3 13.5 H6"/></g>',
  flow: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 9 H15.5" opacity=".45" stroke-width="3.6"/></g><g fill="currentColor"><circle cx="5" cy="9" r="1.5"/><circle cx="9.5" cy="9" r="1.9"/><circle cx="14" cy="9" r="1.5"/></g>',
  palette: '<g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 2.8 C4.9 2.8 2.6 5.8 2.6 9 c0 3.4 2.7 6.2 6 6.2 1.2 0 1.6-.8 1.3-1.7 -.4-1 .2-1.9 1.2-1.9 h1.6 c1.9 0 2.7-1.3 2.7-3.1 C15.4 5.2 12.6 2.8 9 2.8 Z"/></g><g fill="currentColor"><circle cx="6" cy="7.6" r="1"/><circle cx="9" cy="5.6" r="1"/><circle cx="12" cy="7.6" r="1"/></g>',
  move: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5 V15.5 M2.5 9 H15.5"/><path d="M7 4.5 L9 2.5 L11 4.5 M7 13.5 L9 15.5 L11 13.5 M4.5 7 L2.5 9 L4.5 11 M13.5 7 L15.5 9 L13.5 11"/></g>',
  left: '<path d="M11 5 L7 9 L11 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  right: '<path d="M7 5 L11 9 L7 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  group: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke-dasharray="2.2 1.8"/><rect x="5" y="5" width="5" height="4.5" rx="1"/><rect x="8.5" y="9" width="4.5" height="4" rx="1"/></g>',
  ungroup: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="2.5" y="3" width="6" height="5.5" rx="1"/><rect x="9.5" y="9.5" width="6" height="5.5" rx="1"/><path d="M11 3.5 L15 3.5 L15 7 M3 11 L3 15 L7 15" stroke-dasharray="1.8 1.6"/></g>',
  vTop: '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"><path d="M3 3.5 H15"/><path d="M6 7 H12 M6 10 H12"/></g>',
  vMid: '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"><path d="M3 9 H4.5 M13.5 9 H15" opacity=".5"/><path d="M6 7.5 H12 M6 10.5 H12"/></g>',
  vBot: '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"><path d="M3 14.5 H15"/><path d="M6 8 H12 M6 11 H12"/></g>',
  rowAdd: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="3" width="13" height="6" rx="1.2"/><path d="M9 11.2 V16 M6.6 13.6 H11.4"/></g>',
  rowDel: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="3" width="13" height="6" rx="1.2"/><path d="M6.6 13.6 H11.4"/></g>',
  colAdd: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="6" height="13" rx="1.2"/><path d="M11.2 9 H16 M13.6 6.6 V11.4"/></g>',
  colDel: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="6" height="13" rx="1.2"/><path d="M11.2 9 H16"/></g>',
  sketch: '<g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.6 5 L15.4 4.4 L15.2 13.2 L2.8 13.6 Z"/></g><g stroke="currentColor" stroke-width="0.9" opacity="0.55"><path d="M4 12.5 L7 6"/><path d="M7 12.5 L10 6"/><path d="M10 12.5 L13 6"/></g>',
  brush: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M15.2 2.8 L9.4 9.6 L8.4 8.6 Z" stroke-linecap="round"/><path d="M8.2 9 C6.2 8.6 4.6 9.8 4.4 11.8 C4.2 13.6 3.4 14.6 2.6 15.2 C5.6 15.6 8.6 14.6 9.2 12 C9.4 11 9.2 10 8.2 9 Z"/></g>',
  pen: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11.8 3.2 L14.8 6.2 L6.6 14.4 L3 15 L3.6 11.4 Z"/><path d="M10.4 4.6 L13.4 7.6"/></g>',
  text: '<path d="M3.5 4 H14.5 M9 4 V14.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  connect: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 13 C5 5.5, 10 4, 14.5 5.5"/><path d="M11.5 4.2 L14.8 5.4 L13.4 8.6"/></g>',
  hand: '<g fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"><path d="M6.2 8.6V4.9a1 1 0 1 1 2 0v3.3M8.2 8.2V3.9a1 1 0 1 1 2 0v4.2M10.2 8.4V5a1 1 0 1 1 2 0v4.5M12.2 8.8c0-.9.4-1.4 1.1-1.4.6 0 1 .5 1 1.2v2.4c0 2.5-1.7 4.2-4.1 4.2-2.5 0-3.9-1.2-4.6-2.9L4 10.1c-.4-.8 0-1.4.7-1.7.6-.2 1.1.1 1.4.7l.5 1.1"/></g>',
  trash: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3.5 5 H14.5"/><path d="M7.3 5 V3.6 H10.7 V5"/><path d="M4.8 5 L5.6 14.4 H12.4 L13.2 5"/></g>',
  copy: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.8" y="2.8" width="9" height="9" rx="1.4"/><rect x="6.2" y="6.2" width="9" height="9" rx="1.4"/></g>',
  undo: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.4 5 L3.4 8 L6.4 11"/><path d="M3.6 8 H10.8 a3.6 3.6 0 0 1 0 7.2 H8.4"/></g>',
  redo: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.6 5 L14.6 8 L11.6 11"/><path d="M14.4 8 H7.2 a3.6 3.6 0 0 0 0 7.2 H9.6"/></g>',
  plus: '<path d="M9 4 V14 M4 9 H14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  minus: '<path d="M4 9 H14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  play: '<path d="M5.4 3.6 L14 9 L5.4 14.4 Z" fill="currentColor"/>',
  stop: '<rect x="4.6" y="4.6" width="8.8" height="8.8" rx="1.4" fill="currentColor"/>',
  alignLeft: '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 5 H15"/><path d="M3 9 H10"/><path d="M3 13 H13"/></g>',
  alignCenter: '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 5 H15"/><path d="M5.5 9 H12.5"/><path d="M4 13 H14"/></g>',
  alignRight: '<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 5 H15"/><path d="M8 9 H15"/><path d="M5 13 H15"/></g>',
  routeCurve: '<path d="M2.5 13.5 C3 6, 9 4.5, 15.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  routeElbow: '<path d="M2.5 13.5 H9 V4.5 H15.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  routeStraight: '<path d="M2.5 13.5 L15.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  solid: '<path d="M2.5 9 H15.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  dashed: '<path d="M2.5 9 H15.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3.4 3"/>',
  dotted: '<path d="M3 9 H15.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 3.6"/>',
  labelPath: '<g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 12 C5 6.5, 11 5.5, 15.5 8"/></g><text x="9" y="6" font-size="6" fill="currentColor" text-anchor="middle" font-family="sans-serif">abc</text>',
  labelFlat: '<g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 12 C5 6.5, 11 5.5, 15.5 8"/></g><text x="9" y="5.6" font-size="6" fill="currentColor" text-anchor="middle" font-family="sans-serif">abc</text>',
  front: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="6" y="6" width="7" height="7" rx="1.2" fill="currentColor" stroke="none"/><path d="M3 6.4V4.4a1.2 1.2 0 0 1 1.2-1.2h2"/><path d="M12.8 3.2h2A1.2 1.2 0 0 1 16 4.4v2"/><path d="M16 12.6v2a1.2 1.2 0 0 1-1.2 1.2h-2"/><path d="M6.2 15.8h-2A1.2 1.2 0 0 1 3 14.6v-2"/></g>',
  back: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="6" y="6" width="7" height="7" rx="1.2"/><path d="M3 6.4V4.4a1.2 1.2 0 0 1 1.2-1.2h2"/><path d="M12.8 3.2h2A1.2 1.2 0 0 1 16 4.4v2"/><path d="M16 12.6v2a1.2 1.2 0 0 1-1.2 1.2h-2"/><path d="M6.2 15.8h-2A1.2 1.2 0 0 1 3 14.6v-2"/></g>',
  alnL: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M3 2.8v12.4" stroke-linecap="round"/><rect x="5.4" y="4.4" width="9" height="3.2" rx="1"/><rect x="5.4" y="10.4" width="5.6" height="3.2" rx="1"/></g>',
  alnCH: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M9 2.8v12.4" stroke-linecap="round"/><rect x="3.6" y="4.4" width="10.8" height="3.2" rx="1"/><rect x="6" y="10.4" width="6" height="3.2" rx="1"/></g>',
  alnR: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M15 2.8v12.4" stroke-linecap="round"/><rect x="3.6" y="4.4" width="9" height="3.2" rx="1"/><rect x="7" y="10.4" width="5.6" height="3.2" rx="1"/></g>',
  alnT: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M2.8 3h12.4" stroke-linecap="round"/><rect x="4.4" y="5.4" width="3.2" height="9" rx="1"/><rect x="10.4" y="5.4" width="3.2" height="5.6" rx="1"/></g>',
  alnCV: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M2.8 9h12.4" stroke-linecap="round"/><rect x="4.4" y="3.6" width="3.2" height="10.8" rx="1"/><rect x="10.4" y="6" width="3.2" height="6" rx="1"/></g>',
  alnB: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M2.8 15h12.4" stroke-linecap="round"/><rect x="4.4" y="3.6" width="3.2" height="9" rx="1"/><rect x="10.4" y="7" width="3.2" height="5.6" rx="1"/></g>',
  distH: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M3 2.8v12.4M15 2.8v12.4" stroke-linecap="round"/><rect x="7" y="5" width="4" height="8" rx="1"/></g>',
  distV: '<g stroke="currentColor" stroke-width="1.4" fill="none"><path d="M2.8 3h12.4M2.8 15h12.4" stroke-linecap="round"/><rect x="5" y="7" width="8" height="4" rx="1"/></g>',
  help: '<g fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="9" cy="9" r="6.3"/><path d="M7.3 7.3c.1-1 .9-1.7 1.9-1.7 1.1 0 1.9.7 1.9 1.8 0 1.5-1.9 1.4-1.9 2.9" stroke-linecap="round"/></g><circle cx="9.2" cy="12.5" r=".85" fill="currentColor"/>',
  panel: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.6" y="3.6" width="12.8" height="10.8" rx="1.6"/><path d="M7 3.6v10.8"/></g>',
  file: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M10.2 2.8H5.2A1.3 1.3 0 0 0 3.9 4.1v9.8a1.3 1.3 0 0 0 1.3 1.3h7.6a1.3 1.3 0 0 0 1.3-1.3V6.4z"/><path d="M10.2 2.8v3.6h3.9"/></g>',
  folder: '<path d="M3 5.6a1.3 1.3 0 0 1 1.3-1.3h2.6l1.4 1.8h4.8a1.3 1.3 0 0 1 1.3 1.3v5.6a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 13v-7.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  save: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3.9 3.9h7.9L14.1 6v8a1 1 0 0 1-1 1H4.9a1 1 0 0 1-1-1z"/><path d="M6.3 3.9v3.6h5.4V3.9M6.3 15v-4.3h5.4V15"/></g>',
  image: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.8" y="3.9" width="12.4" height="10.2" rx="1.5"/><circle cx="6.6" cy="7.5" r="1.1"/><path d="M3.2 12.3 L7 9 L9.9 11.4 L12 9.6 L14.9 12.1"/></g>',
  code: '<path d="M6.4 5.8 L3 9 L6.4 12.2 M11.6 5.8 L15 9 L11.6 12.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="4" y="7.8" width="10" height="7.2" rx="1.6"/><path d="M6.2 7.8V5.8a2.8 2.8 0 0 1 5.6 0v2"/></g>',
  eyeOff: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M1.6 9S4.3 4.2 9 4.2c1.5 0 2.8.5 3.9 1.1M16.4 9s-1 1.8-2.8 3.2M10.6 13.6c-.5.1-1 .2-1.6.2C4.3 13.8 1.6 9 1.6 9"/><path d="M3 15 L15 3"/></g>',
  pause: '<g fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="9" cy="9" r="6.3"/><path d="M7.4 6.6 V11.4 M10.6 6.6 V11.4" stroke-linecap="round"/></g>',
  more: '<g fill="currentColor"><circle cx="4.5" cy="9" r="1.4"/><circle cx="9" cy="9" r="1.4"/><circle cx="13.5" cy="9" r="1.4"/></g>',
  close: '<path d="M5 5 L13 13 M13 5 L5 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  eye: '<g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.6 9S4.3 4.2 9 4.2 16.4 9 16.4 9 13.7 13.8 9 13.8 1.6 9 1.6 9z"/><circle cx="9" cy="9" r="2.3"/></g>',
  order: '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M7.5 4.5 H15 M7.5 9 H15 M7.5 13.5 H15"/></g><g fill="currentColor"><circle cx="3.8" cy="4.5" r="1.3"/><circle cx="3.8" cy="9" r="1.3"/><circle cx="3.8" cy="13.5" r="1.3"/></g>',
  up: '<path d="M5 11 L9 7 L13 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  down: '<path d="M5 7 L9 11 L13 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  page: '<g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.6" y="2.8" width="10.8" height="12.4" rx="1.4"/><path d="M6.2 6.4h5.6M6.2 9h5.6M6.2 11.6h3.4"/></g>'
};

/* ================================================================
   2. Tiny helpers
   ================================================================ */
var $ = function (id) { return document.getElementById(id); };

function makeEl(tag, attrs) {
  var node = document.createElementNS(NS, tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    if (attrs[k] != null) node.setAttribute(k, attrs[k]);
  });
  return node;
}
function setAttrs(node, attrs) {
  Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v == null || v === false) node.removeAttribute(k);
    else if (node.getAttribute(k) !== String(v)) node.setAttribute(k, v);
  });
}
function htmlEl(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }

var idSeed = Date.now() % 1e7;
function uid(prefix) { idSeed += 1; return prefix + idSeed.toString(36); }

function icon(name, size) {
  var s = size || 17;
  var g = makeEl("svg", { width: s, height: s, viewBox: "0 0 18 18", fill: "currentColor", "aria-hidden": "true" });
  g.innerHTML = ICONS[name] || "";
  return g;
}

var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
var MOD = isMac ? "⌘" : "Ctrl";

