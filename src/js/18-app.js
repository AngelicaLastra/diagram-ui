/* ================================================================
   25. Modals
   ================================================================ */
var scrim = $("scrim"), modal = $("modal");
function closeModal() {
  if (gifJob) { gifJob.cancelled = true; gifJob = null; }
  if (videoJob) { videoJob.cancelled = true; videoJob = null; }
  scrim.hidden = true; clear(modal);
}
scrim.addEventListener("pointerdown", function (e) { if (e.target === scrim) closeModal(); });

function openModal(build) { clear(modal); build(modal); scrim.hidden = false; }

function showShortcuts() {
  openModal(function (m) {
    m.appendChild(htmlEl("h2", null, "Keyboard shortcuts"));
    m.appendChild(htmlEl("p", "sub", "These all work while the sheet has focus."));
    var keys = htmlEl("div", "keys");
    [["V  H", "Select, pan"], ["B  D  S  E", "Box, diamond, inked, ellipse"], ["G", "Table"],
     ["Y", "Database"], ["T", "Text, or double click the sheet (drag to set its width)"], ["C  L", "Draw an arrow, draw a line"], ["P", "Pen: draw freehand"], ["K", "Code block"], ["I", "Import an image"], ["O", "Show or hide the reveal order"],
     [MOD + " + V", "Paste shapes, or a picture you copied"],
     ["Double click", "Type on a shape, arrow or label"], ["Enter", "Edit whatever is selected"],
     ["Tab", "Swap title and caption, or move to the next cell"], ["Esc", "Finish typing, or clear the selection"],
     [MOD + " + Z", "Undo"], [MOD + " + Shift + Z", "Redo"],
     [MOD + " + C  V  X", "Copy, paste, cut (table cells, when cells are picked)"], [MOD + " + D", "Duplicate"], [MOD + " + G", "Group the selection"], [MOD + " + Shift + G", "Ungroup"],
     [MOD + " + Alt + C  V", "Copy a style, paste it onto the selection"],
     [MOD + " + B  I  U  E", "While typing: bold, italic, underline or code for the selected words"],
     [MOD + " + A", "Select everything"], ["Delete", "Remove the selection"],
     ["Arrows", "Nudge by one"], ["Shift + arrows", "Nudge by ten"],
     ["Space + drag", "Move around the canvas"], ["Right drag", "Move around the canvas"], ["Scroll", "Move around the canvas"],
     [MOD + " + scroll", "Zoom at the pointer (or pinch)"],
     ["Shift + drag", "Keep a move on one axis"], ["Alt + place", "Keep the shape tool active"],
     ["Shift + click", "Add to the selection, or stretch a table cell pick"], ["?", "This list"]]
      .forEach(function (row) {
        var d = htmlEl("div");
        d.appendChild(htmlEl("kbd", null, row[0]));
        d.appendChild(htmlEl("span", null, row[1]));
        keys.appendChild(d);
      });
    m.appendChild(keys);
    var foot = htmlEl("div", "modal-foot");
    var ok = toolButton({ label: "Got it", onClick: closeModal });
    ok.classList.add("accent");
    foot.appendChild(ok);
    m.appendChild(foot);
  });
}
/* ================================================================
   26. Top bar wiring
   ================================================================ */
function pressToggle(button, on) { button.setAttribute("aria-pressed", String(on)); }

$("btnUndo").appendChild(icon("undo", 16));
$("btnRedo").appendChild(icon("redo", 16));
$("btnZoomIn").appendChild(icon("plus", 15));
$("btnZoomOut").appendChild(icon("minus", 15));
$("btnUndo").addEventListener("click", undo);
$("btnRedo").addEventListener("click", redo);
$("btnFile").addEventListener("click", function (e) { openMenuUnder(e.currentTarget, fileMenu()); });
$("btnEdit").addEventListener("click", function (e) { openMenuUnder(e.currentTarget, editMenu()); });
$("btnArrange").addEventListener("click", function (e) { openMenuUnder(e.currentTarget, arrangeMenu()); });

$("btnZoomIn").addEventListener("click", function () {
  zoomAround({ x: view.x + view.w / 2, y: view.y + view.h / 2 }, 1 / 1.2);
});
$("btnZoomOut").addEventListener("click", function () {
  zoomAround({ x: view.x + view.w / 2, y: view.y + view.h / 2 }, 1.2);
});
$("btnFit").addEventListener("click", fitView);
$("btnPlay").addEventListener("click", playReveal);

$("rough").addEventListener("change", function (e) {
  roughness = e.target.value;
  buildFilters(); render(); buildDrawer(); persistNow();
});
$("btnTexture").addEventListener("click", function (e) {
  textureOn = !textureOn; pressToggle(e.currentTarget, textureOn); render(); persistNow();
});
$("btnSnap").addEventListener("click", function (e) {
  snapOn = !snapOn; pressToggle(e.currentTarget, snapOn); persistNow();
});
$("btnGrid").addEventListener("click", function (e) {
  gridOn = !gridOn; pressToggle(e.currentTarget, gridOn); render(); persistNow();
});

$("docTitle").addEventListener("change", function (e) {
  doc.title = e.target.value.trim() || "Untitled sketch";
  e.target.value = doc.title;
  commit();
});
$("docTitle").addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") e.target.blur(); });

$("fileInput").addEventListener("change", function (e) {
  var f = e.target.files && e.target.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () { openJsonText(String(reader.result)); };
  reader.readAsText(f);
  e.target.value = "";
});

window.addEventListener("resize", function () { applyView(); });
window.addEventListener("beforeunload", persistNow);

/* ================================================================
   27. Keyboard
   ================================================================ */
document.addEventListener("keydown", function (event) {
  var tag = (event.target.tagName || "").toUpperCase();
  var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target.isContentEditable;
  var mod = event.metaKey || event.ctrlKey;

  if (event.key === " " && !typing) { spaceDown = true; updateCursor(); }
  if (typing) return;

  if (!scrim.hidden) { if (event.key === "Escape") closeModal(); return; }

  if (mod) {
    /* by key position, since Option changes the letter on a Mac */
    if (event.altKey && event.code === "KeyC") { event.preventDefault(); copyStyle(false); return; }
    if (event.altKey && event.code === "KeyV") { event.preventDefault(); pasteStyle(); return; }
    var k = event.key.toLowerCase();
    if (k === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (k === "y") { event.preventDefault(); redo(); return; }
    if (k === "c") { event.preventDefault(); if (currentCell()) copyCells(false); else copySelected(); return; }
    if (k === "x") { event.preventDefault(); if (currentCell()) copyCells(true); else { copySelected(); deleteSelected(); } return; }
    if (k === "v") return;   /* handled by the paste event, which can see pictures */
    if (k === "d") { event.preventDefault(); duplicateSelected(); return; }
    if (k === "g") { event.preventDefault(); if (event.shiftKey) ungroupSelected(); else groupSelected(); return; }
    if (k === "a") { event.preventDefault(); selectAll(); return; }
    if (k === "s") { event.preventDefault(); saveJson(); return; }
    if (k === "o") { event.preventDefault(); $("fileInput").click(); return; }
    if ((k === "b" || k === "i" || k === "u") && cellShortcut(k)) { event.preventDefault(); return; }
    if (k === "b") { event.preventDefault(); patchSelected({ bold: function (it) { return !it.bold; } }); return; }
    if (k === "i") { event.preventDefault(); patchSelected({ italic: function (it) { return !it.italic; } }); return; }
    if (k === "u") { event.preventDefault(); patchSelected({ underline: function (it) { return !it.underline; } }); return; }
    if (k === "0") { event.preventDefault(); fitView(); return; }
    return;
  }
  if (event.altKey) {
    var step = { ArrowLeft: ["c", -1], ArrowRight: ["c", 1], ArrowUp: ["r", -1], ArrowDown: ["r", 1] }[event.key];
    if (step && currentCell()) { event.preventDefault(); moveTablePick(step[0], step[1]); }
    return;
  }

  if (event.key === "Escape") {
    closeMenus(); stopReveal(); closeEditor(); clearSel(); setTool("select"); return;
  }
  if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); return; }
  if (event.key === "?") { showShortcuts(); return; }
  if (event.key === "Enter" && sel.size === 1) {
    event.preventDefault();
    var f = firstSel();
    if (f) openEditor(f.item.id, defaultField(f.item.id));
    return;
  }

  var nudges = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (nudges[event.key] && sel.size) {
    event.preventDefault();
    var step = event.shiftKey ? 10 : 1;
    var moved = false;
    selList().forEach(function (found) {
      if (found.kind === "edge") {
        ["p1", "p2"].forEach(function (k, i) {
          if ((i ? found.item.to : found.item.from) || !found.item[k]) return;
          found.item[k] = { x: found.item[k].x + nudges[event.key][0] * step, y: found.item[k].y + nudges[event.key][1] * step };
          moved = true;
        });
        return;
      }
      found.item.x += nudges[event.key][0] * step;
      found.item.y += nudges[event.key][1] * step;
      moved = true;
    });
    if (moved) { commit(); render(); }
    return;
  }

  if (event.key.toLowerCase() === "i") { openImagePicker(); return; }
  if (event.key.toLowerCase() === "o") { toggleOrderPanel(); return; }
  var shortcut = SHORTCUT_TOOLS[event.key.toLowerCase()];
  if (shortcut) setTool(shortcut);
});
document.addEventListener("keyup", function (e) { if (e.key === " ") { spaceDown = false; updateCursor(); } });
window.addEventListener("blur", function () { spaceDown = false; updateCursor(); });

/* ================================================================
   28. The sample sheet
   ================================================================ */
function loadSample() {
  stopReveal();
  var P = newPage("Pipeline");
  P.nodes = [
    { id: "a", type: "box", style: "wash", x: 60, y: 90, w: 170, h: 54,
      fill: "#C3DDF4", accent: "#6FA9DB", filled: true,
      title: "Source systems", sub: "web, mobile, billing", titleSize: 11.5, titleColor: INK },
    { id: "b", type: "box", style: "wash", x: 60, y: 210, w: 170, h: 54,
      fill: "#C3DDF4", accent: "#6FA9DB", filled: true,
      title: "Airflow ingest", sub: "one task per source", titleSize: 11.5, titleColor: INK },
    { id: "c", type: "box", style: "wash", x: 60, y: 330, w: 170, h: 54,
      fill: "#C3DDF4", accent: "#6FA9DB", filled: true,
      title: "Snowflake raw", sub: "loaded with copy into", titleSize: 11.5, titleColor: INK },
    { id: "d", type: "box", style: "sketch", x: 60, y: 450, w: 170, h: 54,
      fill: "#AFCDCB", accent: "#2E7A7B", filled: true,
      title: "dbt build", sub: "staging to marts", titleSize: 11.5, titleColor: INK },
    { id: "e", type: "diamond", style: "wash", x: 330, y: 435, w: 160, h: 88,
      fill: "#F3CBC0", accent: "#DD4B44", filled: true,
      title: "Tests pass?", sub: "", titleSize: 11.5, titleColor: INK },
    { id: "f", type: "box", style: "wash", x: 580, y: 450, w: 170, h: 54,
      fill: "#F8DFA3", accent: "#EFB13A", filled: true,
      title: "Dashboards", sub: "shared with every team", titleSize: 11.5, titleColor: INK },
    { id: "g", type: "box", style: "wash", x: 570, y: 290, w: 170, h: 54,
      fill: "#FFFFFF", accent: "#DD4B44", filled: false,
      title: "Alert on-call", sub: "halt the DAG", titleSize: 11.5, titleColor: RED }
  ].map(upgradeNode);

  P.edges = [
    { id: "e1", from: "a", to: "b", fromSide: "bottom", toSide: "top", color: LINE, weight: 1.6, shape: "curve" },
    { id: "e2", from: "b", to: "c", fromSide: "bottom", toSide: "top", color: LINE, weight: 1.6, shape: "curve" },
    { id: "e3", from: "c", to: "d", fromSide: "bottom", toSide: "top", color: LINE, weight: 1.6, shape: "curve" },
    { id: "e4", from: "d", to: "e", fromSide: "right", toSide: "left", color: LINE, weight: 1.6, shape: "curve" },
    { id: "e5", from: "e", to: "f", fromSide: "right", toSide: "left", color: LINE, weight: 1.6, shape: "curve", label: "pass" },
    { id: "e6", from: "e", to: "g", fromSide: "top", toSide: "left", color: RED, weight: 1.6, shape: "curve", label: "fail" },
    { id: "e7", from: "g", to: "d", fromSide: "left", toSide: "right", color: RED, weight: 1.6,
      shape: "elbow", detour: -120, dashed: true, label: "retry after fix" }
  ].map(upgradeEdge);

  P.texts = [
    { id: "t1", x: 145, y: 52, text: "Nightly pipeline run", size: 16, weight: 600,
      color: INK, anchor: "middle", bold: true }
  ].map(upgradeText);

  doc = { title: "Nightly pipeline", pages: [P], active: 0 };
  sel.clear(); past = []; future = []; snapshot = null;
  $("docTitle").value = doc.title;
  resetDom(); commit(); render(); fitView();
  setHint("Double click a shape to type. Drag from an edge dot to draw an arrow.");
}

/* ================================================================
   29. Boot
   ================================================================ */
/* Wrapped text is measured with Poppins; once it has loaded, redraw so
   lines break where the real font says. */
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
  fitAllTables();
  if (!editing) snapshot = stateJSON();   /* the refit is where undo starts, not a change */
  resetDom(); render();
});

var loaded = loadPersisted();
loadColorBook();

$("rough").value = roughness;
pressToggle($("btnTexture"), textureOn);
pressToggle($("btnSnap"), snapOn);
pressToggle($("btnGrid"), gridOn);

buildRail();
buildDrawer();
buildFilters();
setPlayButton();
setTool("select");

if (loaded) {
  $("docTitle").value = doc.title;
  snapshot = stateJSON();
  render();
  fitView();
} else {
  loadSample();
}
persistNow();

/* Read-only hook so the console (and automated checks) can look inside. */
window.__ds = {
  get doc() { return doc; }, get page() { return page(); },
  get sel() { return Array.from(sel); }, get drag() { return drag; },
  get view() { return view; }, get tool() { return tool; }, get editing() { return editing; },
  findAny: findAny, edgeGeometry: edgeGeometry, buildSvgString: buildSvgString, loadSample: loadSample
};

