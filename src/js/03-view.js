/* ================================================================
   5. Stage handles and view
   ================================================================ */
var stage = $("stage"), defs = $("defs"), sheet = $("sheet");
var shapesLayer = $("shapes"), labelsLayer = $("labels");
var overlay = $("overlay"), hitsGroup = $("hits");
var bubble = $("bubble"), inlineInput = $("inlineEdit");

function setHint(msg) { $("hint").textContent = msg; }

var MIN_ZOOM = 0.1, MAX_ZOOM = 4;
function stageSize() {
  var r = stage.getBoundingClientRect();
  return { w: r.width || 900, h: r.height || 660 };
}
function viewScale() { return stageSize().w / view.w; }

function toStage(event) {
  var box = stage.getBoundingClientRect();
  var k = box.width / view.w;
  return { x: view.x + (event.clientX - box.left) / k, y: view.y + (event.clientY - box.top) / k };
}
function toScreen(x, y) {
  var k = viewScale();
  return { x: (x - view.x) * k, y: (y - view.y) * k, k: k };
}
/* The canvas has no edges. 100% means one unit to one screen pixel, and
   the paper and grid are stretched over whatever is in view. */
function applyView() {
  var px = stageSize();
  view.w = clamp(view.w, px.w / MAX_ZOOM, px.w / MIN_ZOOM);
  view.h = view.w * (px.h / px.w);
  stage.setAttribute("viewBox", [view.x, view.y, view.w, view.h].map(function (v) { return v.toFixed(1); }).join(" "));
  $("zoomLabel").textContent = Math.round((px.w / view.w) * 100) + "%";
  paintPaper();
  drawOverlay();
  placeBubble();
  layoutEditor();
}
function paintPaper() {
  var cover = { x: view.x - 2, y: view.y - 2, width: view.w + 4, height: view.h + 4 };
  setAttrs($("bg"), cover);
  setAttrs($("gridRect"), Object.assign({ fill: gridOn ? "url(#grid)" : "none" }, cover));
}
/* Everything drawn on the sheet, in canvas units, or null when empty. */
function contentBounds() {
  var boxes = [shapesLayer, labelsLayer].map(function (layer) {
    if (!layer.childNodes.length) return null;
    var b = layer.getBBox();
    return b.width || b.height ? b : null;
  }).filter(Boolean);
  if (!boxes.length) return null;
  var x0 = Math.min.apply(null, boxes.map(function (b) { return b.x; }));
  var y0 = Math.min.apply(null, boxes.map(function (b) { return b.y; }));
  var x1 = Math.max.apply(null, boxes.map(function (b) { return b.x + b.width; }));
  var y1 = Math.max.apply(null, boxes.map(function (b) { return b.y + b.height; }));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function zoomAround(focus, factor) {
  var px = stageSize();
  var next = clamp(view.w * factor, px.w / MAX_ZOOM, px.w / MIN_ZOOM);
  var scale = next / view.w;
  view.x = focus.x - (focus.x - view.x) * scale;
  view.y = focus.y - (focus.y - view.y) * scale;
  view.w = next;
  applyView();
}
/* Fit what is drawn, never zooming in past 100%. An empty sheet opens
   at 100% with the origin near the top left. */
function fitView() {
  var px = stageSize(), b = contentBounds(), pad = 60;
  if (!b) { view.w = px.w; view.x = -40; view.y = -40; applyView(); return; }
  var k = Math.min(1, px.w / (b.w + pad * 2), px.h / (b.h + pad * 2));
  view.w = px.w / k;
  view.h = px.h / k;
  view.x = b.x + b.w / 2 - view.w / 2;
  view.y = b.y + b.h / 2 - view.h / 2;
  applyView();
}
function snap(value) {
  if (!snapOn) return Math.round(value);
  return Math.round(value / GRID_STEP) * GRID_STEP;
}

