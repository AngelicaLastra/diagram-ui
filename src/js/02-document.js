/* ================================================================
   3. Document model
   ================================================================ */
function newPage(name) {
  return { id: uid("p"), name: name || "Sheet 1", w: 900, h: 660, nodes: [], edges: [], texts: [], reveal: null };
}

var doc = { title: "Untitled sketch", pages: [newPage("Sheet 1")], active: 0 };
/* Imported pictures, keyed by id. Image nodes point here instead of
   carrying the data themselves, so undo snapshots stay small. Nothing is
   removed while the page is open, which keeps undo safe. */
var assets = {};
var sel = new Set();
var tool = "select";
var connectFrom = null;
var snapOn = true, gridOn = true, textureOn = true, guidesOn = true;
var roughness = "medium";
var penStyle = { color: "#23231F", weight: 3 };   /* what the next stroke looks like */
var toneIndex = 0;
var textBounds = {};
var view = { x: 0, y: 0, w: 900, h: 660 };
var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function page() { return doc.pages[doc.active]; }
function nodes() { return page().nodes; }
function edges() { return page().edges; }
function texts() { return page().texts; }

function findNode(id) { return nodes().filter(function (n) { return n.id === id; })[0]; }
function findEdge(id) { return edges().filter(function (e) { return e.id === id; })[0]; }
function findText(id) { return texts().filter(function (t) { return t.id === id; })[0]; }
function findAny(id) {
  var n = findNode(id); if (n) return { kind: "node", item: n };
  var e = findEdge(id); if (e) return { kind: "edge", item: e };
  var t = findText(id); if (t) return { kind: "text", item: t };
  return null;
}
function selList() {
  var out = [];
  sel.forEach(function (id) { var f = findAny(id); if (f) out.push(f); });
  return out;
}
function selNodes() { return selList().filter(function (f) { return f.kind === "node"; }).map(function (f) { return f.item; }); }
function firstSel() { var l = selList(); return l.length ? l[0] : null; }

/* ================================================================
   4. History and local persistence
   ================================================================ */
var STORE = "diagram-studio/sketch/v1";
var past = [], future = [], snapshot = null;

function stateJSON() { return JSON.stringify({ title: doc.title, pages: doc.pages, active: doc.active }); }

function commit() {
  fitAllTables();
  if (snapshot) { past.push(snapshot); if (past.length > 150) past.shift(); }
  future.length = 0;
  snapshot = stateJSON();
  schedulePersist();
  refreshHistory();
}
function restoreState(json) {
  var o = JSON.parse(json);
  doc.title = o.title; doc.pages = o.pages;
  doc.active = clamp(o.active, 0, o.pages.length - 1);
  snapshot = json;
  $("docTitle").value = doc.title;
  sel = new Set(Array.from(sel).filter(function (id) { return findAny(id); }));
  closeEditor(true);
  resetDom();
  render();
  schedulePersist();
  refreshHistory();
}
function undo() { if (!past.length) return toast("Nothing to undo"); future.push(stateJSON()); restoreState(past.pop()); }
function redo() { if (!future.length) return toast("Nothing to redo"); past.push(stateJSON()); restoreState(future.pop()); }
function refreshHistory() {
  $("btnUndo").disabled = !past.length;
  $("btnRedo").disabled = !future.length;
}

var persistTimer = null;
function schedulePersist() { clearTimeout(persistTimer); persistTimer = setTimeout(persistNow, 600); }
function usedAssets() {
  var out = {};
  doc.pages.forEach(function (p) {
    p.nodes.forEach(function (n) { if (n.asset && assets[n.asset]) out[n.asset] = assets[n.asset]; });
  });
  return out;
}
var assetSig = null;
function persistAssets() {
  var used = usedAssets(), sig = Object.keys(used).sort().join(",");
  if (sig === assetSig) return true;
  try {
    localStorage.setItem(STORE + ":assets", JSON.stringify(used));
    assetSig = sig;
    return true;
  } catch (err) {
    toast("The images are too big to keep in this browser. Use File, Save a copy to keep them.");
    return false;
  }
}
function persistNow() {
  try {
    var picturesKept = persistAssets();
    localStorage.setItem(STORE, stateJSON());
    localStorage.setItem(STORE + ":prefs", JSON.stringify({ roughness: roughness, textureOn: textureOn, snapOn: snapOn, gridOn: gridOn, guidesOn: guidesOn, pen: penStyle }));
    $("saved").textContent = (picturesKept ? "Saved " : "Saved without images ") +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (err) { $("saved").textContent = "Not saved locally"; }
}
function loadPersisted() {
  try {
    var prefs = JSON.parse(localStorage.getItem(STORE + ":prefs") || "null");
    if (prefs) {
      roughness = prefs.roughness || roughness;
      textureOn = prefs.textureOn !== false;
      snapOn = prefs.snapOn !== false;
      gridOn = prefs.gridOn !== false;
      guidesOn = prefs.guidesOn !== false;
      if (prefs.pen && parseHex(prefs.pen.color)) penStyle = { color: parseHex(prefs.pen.color), weight: clamp(+prefs.pen.weight || 3, 0.5, 24) };
    }
    assets = JSON.parse(localStorage.getItem(STORE + ":assets") || "{}") || {};
    var raw = localStorage.getItem(STORE);
    if (!raw) return false;
    var o = JSON.parse(raw);
    if (!o || !Array.isArray(o.pages) || !o.pages.length) return false;
    doc.title = o.title || "Untitled sketch";
    doc.pages = o.pages.map(upgradePage);
    doc.active = clamp(o.active || 0, 0, doc.pages.length - 1);
    return true;
  } catch (err) { return false; }
}

