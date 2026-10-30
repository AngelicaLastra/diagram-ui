/* ================================================================
   13. Creating things
   ================================================================ */
function toneFor(index) { return PRESETS[index % PRESETS.length]; }

function makeNode(type, style, at, tone) {
  var preset = tone || toneFor(toneIndex);
  var wide = type === "diamond" ? 160 : type === "ellipse" ? 150 : type === "table" ? 270 : type === "database" ? 120 : 170;
  var tall = type === "diamond" ? 88 : type === "ellipse" ? 84 : type === "pill" ? 48 : type === "table" ? 96 : type === "database" ? 92 : 54;
  var node = {
    id: uid("n"), type: type, style: style,
    x: snap(at.x - wide / 2), y: snap(at.y - tall / 2), w: wide, h: tall,
    fill: preset.fill, accent: preset.accent, filled: true,
    title: "", sub: "", titleSize: 11.5, titleColor: INK,
    bold: false, italic: false, strike: false, underline: false
  };
  if (type === "table") { node.cells = blankCells(3, 3); node.header = true; syncFills(node); }
  if (type === "code") {
    node.lang = "sql"; node.code = "select *\nfrom orders\nwhere paid"; node.lineNumbers = true;
    node.fill = CODE_PAPER.fill; node.accent = CODE_PAPER.accent; node.titleSize = 11;
    fitCode(node);
    node.x = snap(at.x - node.w / 2); node.y = snap(at.y - node.h / 2);
  }
  return node;
}

/* Rows and columns keep their size, so the table grows or shrinks
   around them instead of squashing what is already there. */
/* An inserted row or column pushes merged regions after it along, and
   widens any it lands inside. */
function makeRoomInMerges(node, axis, at) {
  tableMerges(node).forEach(function (m) {
    var start = axis === "r" ? m.r : m.c, len = axis === "r" ? m.rs : m.cs;
    if (start >= at) { if (axis === "r") m.r++; else m.c++; }
    else if (at < start + len) { if (axis === "r") m.rs++; else m.cs++; }
  });
}
function addTableRow(node, at) {
  if (!node.aligns || !node.inks || !node.fmts) syncFills(node);
  var t = tableSize(node);
  var r = at == null ? t.rows : at;
  if (r < t.rows) {
    shiftEdgeRows(node.id, function (row) { return row >= r ? row + 1 : row; });
    makeRoomInMerges(node, "r", r);
  }
  node.cells.splice(r, 0, node.cells[0].map(function () { return ""; }));
  node.fills.splice(r, 0, node.cells[0].map(function () { return null; }));
  node.aligns.splice(r, 0, node.cells[0].map(function () { return null; }));
  node.inks.splice(r, 0, node.cells[0].map(function () { return null; }));
  node.fmts.splice(r, 0, node.cells[0].map(function () { return null; }));
  var fresh = node.rowBase || node.h / t.rows;
  if (node.rowH) { var hs = rowHeights(node); hs.splice(r, 0, fresh); node.rowH = hs.map(Math.round); }
  node.h = Math.round(node.h + fresh);
}
function addTableCol(node, at) {
  if (!node.aligns || !node.inks || !node.fmts) syncFills(node);
  var t = tableSize(node), ws = colWidths(node);
  var c = at == null ? t.cols : at, fresh = node.w / t.cols;
  if (c < t.cols) makeRoomInMerges(node, "c", c);
  node.cells.forEach(function (row) { row.splice(c, 0, ""); });
  node.fills.forEach(function (row) { row.splice(c, 0, null); });
  node.aligns.forEach(function (row) { row.splice(c, 0, null); });
  node.inks.forEach(function (row) { row.splice(c, 0, null); });
  node.fmts.forEach(function (row) { row.splice(c, 0, null); });
  ws.splice(c, 0, fresh);
  node.colW = ws.map(function (w) { return Math.round(w); });
  node.w = Math.round(node.w + fresh);
}
/* Keeps arrows on the same row when rows come or go above it; fix maps
   an old row to its new one, or null when the row itself is gone. */
function shiftEdgeRows(tableId, fix) {
  edges().forEach(function (e) {
    ["from", "to"].forEach(function (end) {
      var key = end + "Row";
      if (e[end] !== tableId || e[key] == null) return;
      var v = fix(e[key]);
      if (v == null) delete e[key]; else e[key] = v;
    });
  });
}
/* Deletes rows (axis "r") or columns ("c") a0 to a1. The others keep
   their size, so the table shrinks around the gap. A merged region that
   loses its top-left cell hands its text, colour and alignment to the
   first of its cells that stays. Returns false if nothing would be left. */
function deleteTableSpan(n, axis, a0, a1) {
  var t = tableSize(n), count = a1 - a0 + 1;
  if (count >= (axis === "r" ? t.rows : t.cols)) return false;
  var merges = tableMerges(n);
  merges.forEach(function (m) {
    var start = axis === "r" ? m.r : m.c, end = start + (axis === "r" ? m.rs : m.cs) - 1;
    if (start < a0 || start > a1 || a1 + 1 > end) return;
    var r = axis === "r" ? a1 + 1 : m.r, c = axis === "r" ? m.c : a1 + 1;
    n.cells[r][c] = n.cells[m.r][m.c]; n.fills[r][c] = n.fills[m.r][m.c]; n.aligns[r][c] = n.aligns[m.r][m.c]; n.inks[r][c] = n.inks[m.r][m.c]; n.fmts[r][c] = n.fmts[m.r][m.c];
  });
  n.merges = merges.map(function (m) {
    var start = axis === "r" ? m.r : m.c, len = axis === "r" ? m.rs : m.cs, end = start + len - 1;
    var cut = Math.max(0, Math.min(end, a1) - Math.max(start, a0) + 1);
    var moved = start > a1 ? start - count : start >= a0 ? a0 : start;
    return axis === "r" ? { r: moved, c: m.c, rs: len - cut, cs: m.cs } : { r: m.r, c: moved, rs: m.rs, cs: len - cut };
  });
  if (axis === "r") {
    shiftEdgeRows(n.id, function (r) { return r < a0 ? r : r > a1 ? r - count : null; });
    var hs = rowHeights(n), lost = hs.splice(a0, count).reduce(function (a, b) { return a + b; }, 0);
    n.cells.splice(a0, count); n.fills.splice(a0, count); n.aligns.splice(a0, count); n.inks.splice(a0, count); n.fmts.splice(a0, count);
    if (n.rowH) n.rowH = hs.map(Math.round);
    n.h = Math.max(MIN_H, Math.round(n.h - lost));
  } else {
    var ws = colWidths(n), gone = ws.splice(a0, count).reduce(function (a, b) { return a + b; }, 0);
    [n.cells, n.fills, n.aligns, n.inks, n.fmts].forEach(function (grid) { grid.forEach(function (row) { row.splice(a0, count); }); });
    n.colW = ws.map(function (w) { return Math.round(w); });
    n.w = Math.max(MIN_W, Math.round(n.w - gone));
  }
  trimMerges(n);
  return true;
}
/* The remove buttons take away the picked rows or columns, or the last
   one when no cell is picked. */
function editTables(change) {
  var list = selNodes().filter(function (n) { return n.type === "table"; });
  if (!list.length) return;
  var pick = currentCell(), before = stateJSON();
  list.forEach(function (n) {
    if (!n.aligns || !n.inks || !n.fmts) syncFills(n);
    var t = tableSize(n), mine = pick && pick.node === n;
    if (change === "addRow") addTableRow(n);
    if (change === "addCol") addTableCol(n);
    if (mine && (change === "rowAbove" || change === "rowBelow")) {
      addTableRow(n, change === "rowAbove" ? pick.r0 : pick.r1 + 1);
      if (change === "rowAbove") { activeCell.r++; activeCell.r2++; }
    }
    if (mine && (change === "colLeft" || change === "colRight")) {
      addTableCol(n, change === "colLeft" ? pick.c0 : pick.c1 + 1);
      if (change === "colLeft") { activeCell.c++; activeCell.c2++; }
    }
    if (change === "dropRow" && !deleteTableSpan(n, "r", mine ? pick.r0 : t.rows - 1, mine ? pick.r1 : t.rows - 1)) {
      toast("A table needs at least one row");
    }
    if (change === "dropCol" && !deleteTableSpan(n, "c", mine ? pick.c0 : t.cols - 1, mine ? pick.c1 : t.cols - 1)) {
      toast("A table needs at least one column");
    }
    if (change === "evenCols") n.colW = null;
    trimMerges(n);
    /* keep a cell picked where the deleted ones were */
    if (mine && (change === "dropRow" || change === "dropCol")) {
      var left = tableSize(n), r = clamp(pick.r0, 0, left.rows - 1), c = clamp(pick.c0, 0, left.cols - 1);
      var m = mergeAt(n, r, c);
      pickCell(n.id, m ? m.r : r, m ? m.c : c);
    }
  });
  if (stateJSON() !== before) commit();   /* a refused delete is not an undo step */
  render();
}
function addNode(type, style, at, tone) {
  var node = makeNode(type, style, at, tone);
  nodes().push(node);
  toneIndex += 1;
  commit(); render(); selectOnly(node.id);
  openEditorSoon(node.id, defaultField(node.id));
  return node;
}
/* New text starts empty and reads from where it was put: the first line
   sits on `at` (its middle on a click, its top when a box was dragged
   out), and a `width` makes it wrap within that column. It is not kept
   until something is typed, so a stray click leaves nothing behind. */
function addFreeText(at, width, fromTop) {
  var before = stateJSON(), size = 15;
  var item = {
    id: uid("t"), x: snap(at.x), y: Math.round(at.y + (fromTop ? size * 0.95 : size * 0.35)), text: "",
    size: size, weight: 500, color: INK, anchor: "start",
    bold: false, italic: false, strike: false, underline: false
  };
  if (width) item.w = Math.round(width);
  texts().push(item);
  render(); selectOnly(item.id);
  openEditorSoon(item.id, "text", before);
  return item;
}
/* A new arrow (or line) between two ends, each { id, side, row } on a
   shape or { pt } loose on the sheet. Lines have no head and run straight. */
function newEdge(a, b, kind) {
  var e = makeEdge(a.id || null, a.id ? a.side : "auto", b.id || null, b.id ? b.side : "auto", a.row, b.row);
  if (!a.id) e.p1 = { x: a.pt.x, y: a.pt.y };
  if (!b.id) e.p2 = { x: b.pt.x, y: b.pt.y };
  if (kind === "line") { e.head = "none"; e.shape = "straight"; }
  return e;
}
/* A copy of an arrow for duplicate and paste: tied ends follow the
   copied shapes in `map`, loose ends shift along with them. An end tied
   to a shape that is not being copied leaves the arrow out. */
function copyEdge(e, map, shift) {
  if ((e.from && !map[e.from]) || (e.to && !map[e.to])) return null;
  var copy = deepCopy(e);
  copy.id = uid("e");
  if (e.from) copy.from = map[e.from]; else copy.p1 = { x: e.p1.x + shift, y: e.p1.y + shift };
  if (e.to) copy.to = map[e.to]; else copy.p2 = { x: e.p2.x + shift, y: e.p2.y + shift };
  return copy;
}
/* Where a loose end lands: on the grid when snapping is on, and with
   Shift held, on the nearest 45° line from the other end. */
function looseSpot(point, from, shiftKey) {
  var p = { x: point.x, y: point.y };
  if (shiftKey && from) {
    var dx = p.x - from.x, dy = p.y - from.y, len = Math.hypot(dx, dy);
    var ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: Math.round(from.x + Math.cos(ang) * len), y: Math.round(from.y + Math.sin(ang) * len) };
  }
  return { x: snap(p.x), y: snap(p.y) };
}
function makeEdge(fromId, fromSide, toId, toSide, fromRow, toRow) {
  var e = {
    id: uid("e"), from: fromId, to: toId, fromSide: fromSide, toSide: toSide,
    color: LINE, weight: 1.6, dashed: false, label: "", onPath: true,
    shape: "curve", detour: 0, labelSize: 9.5, head: "arrow", tail: "none"
  };
  if (fromRow != null) e.fromRow = fromRow;
  if (toRow != null) e.toRow = toRow;
  return e;
}

/* ================================================================
   13b. Pictures
        Files come in as data URLs so the sketch stays one file. Big
        photos are scaled down first; local storage only holds a few MB.
   ================================================================ */
var MAX_IMAGE_SIDE = 1600;
var imageInput = document.createElement("input");
imageInput.type = "file";
imageInput.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.svg";
imageInput.multiple = true;
imageInput.hidden = true;
document.body.appendChild(imageInput);
var imageTarget = null;   /* { at, replaceId } for the picker that is open */

function isImageFile(f) { return /^image\//.test(f.type) || /\.svg$/i.test(f.name || ""); }
function isSvgFile(f) { return f.type === "image/svg+xml" || /\.svg$/i.test(f.name || ""); }
function viewCenter() { return { x: view.x + view.w / 2, y: view.y + view.h / 2 }; }

function openImagePicker(at, replaceId) {
  imageTarget = { at: at || viewCenter(), replaceId: replaceId || null };
  imageInput.multiple = !replaceId;
  imageInput.value = "";
  imageInput.click();
}
imageInput.addEventListener("change", function () {
  var files = Array.from(imageInput.files || []).filter(isImageFile);
  var target = imageTarget || { at: viewCenter() };
  imageTarget = null;
  if (!files.length) return;
  if (target.replaceId) replaceImage(target.replaceId, files[0]);
  else importImages(files, target.at);
});

/* SVG files are read as text so they always get the right type, even
   when the system reports none. They are only ever shown through an
   <image> element, which never runs scripts inside them. */
function svgDataUrl(text) { return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(text))); }

function readImage(file, done) {
  var reader = new FileReader();
  var svg = isSvgFile(file);
  reader.onload = function () { measureImage(svg ? svgDataUrl(String(reader.result)) : String(reader.result), !svg, file.type, done); };
  reader.onerror = function () { toast("Could not read " + (file.name || "that picture")); };
  if (svg) reader.readAsText(file); else reader.readAsDataURL(file);
}
function measureImage(url, canShrink, type, done) {
  var img = new Image();
  img.onload = function () {
    var w = img.naturalWidth || 300, h = img.naturalHeight || 200;
    if (canShrink && Math.max(w, h) > MAX_IMAGE_SIDE) {
      var k = MAX_IMAGE_SIDE / Math.max(w, h);
      w = Math.round(w * k); h = Math.round(h * k);
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      url = canvas.toDataURL(type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
    }
    done({ src: url, w: w, h: h });
  };
  img.onerror = function () { toast("That picture could not be opened"); };
  img.src = url;
}
function storeAsset(src) {
  var found = Object.keys(assets).filter(function (k) { return assets[k] === src; })[0];
  if (found) return found;
  var id = uid("img");
  assets[id] = src;
  return id;
}
/* Pictures land at a comfortable size, keeping their proportions. */
function fitSize(w, h) {
  var k = Math.min(1, 320 / w, 240 / h);
  return { w: Math.max(24, Math.round(w * k)), h: Math.max(24, Math.round(h * k)) };
}
function placePicture(pic, at, offset) {
  var size = fitSize(pic.w, pic.h);
  var node = makeNode("box", "wash", at);
  node.type = "image";
  node.asset = storeAsset(pic.src);
  node.natW = pic.w; node.natH = pic.h;
  node.w = size.w; node.h = size.h;
  node.x = Math.round(at.x - size.w / 2 + offset);
  node.y = Math.round(at.y - size.h / 2 + offset);
  node.frame = false; node.wobble = false;
  nodes().push(node);
  return node;
}
function importImages(files, at) {
  var fresh = [], left = files.length;
  files.forEach(function (file, i) {
    readImage(file, function (pic) {
      fresh.push(placePicture(pic, at, i * 24).id);
      if (--left === 0) {
        sel = new Set(fresh);
        commit(); render();
        setHint("Drag a corner to resize. Shift while resizing stretches it.");
      }
    });
  });
}
function replaceImage(id, file) {
  readImage(file, function (pic) {
    var node = findNode(id);
    if (!node) return;
    node.asset = storeAsset(pic.src);
    node.natW = pic.w; node.natH = pic.h;
    node.h = Math.max(10, Math.round(node.w * pic.h / pic.w));
    commit(); render();
  });
}

document.addEventListener("paste", function (e) {
  var tag = (e.target.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable || !scrim.hidden) return;
  var data = e.clipboardData;
  var files = [];
  Array.from((data && data.items) || []).forEach(function (item) {
    if (item.kind !== "file") return;
    var f = item.getAsFile();
    if (f && isImageFile(f)) files.push(f);
  });
  e.preventDefault();
  if (files.length) { importImages(files, viewCenter()); return; }
  /* text pasted with table cells picked goes into the cells */
  var cellText = data ? data.getData("text/plain") : "";
  if (currentCell() && cellText && cellText !== "Diagram studio shapes") { pasteIntoCells(cellText); return; }
  /* SVG markup copied from a code editor or a design tool. */
  var text = data ? data.getData("text/plain").trim() : "";
  if (/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) {
    measureImage(svgDataUrl(text), false, "image/svg+xml", function (pic) {
      sel = new Set([placePicture(pic, viewCenter(), 0).id]);
      commit(); render();
    });
    return;
  }
  pasteClipboard();
});

