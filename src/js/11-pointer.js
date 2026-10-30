/* ================================================================
   15. Tools
   ================================================================ */
var TOOLS = [
  { id: "select",  icon: "select",  title: "Select and move", key: "V" },
  { id: "pan",     icon: "hand",    title: "Move around",     key: "H" },
  { sep: true },
  { id: "box",     icon: "box",     title: "Box",             key: "B" },
  { id: "diamond", icon: "diamond", title: "Diamond",         key: "D" },
  { id: "sketch",  icon: "sketch",  title: "Inked box",       key: "S" },
  { id: "ellipse", icon: "ellipse", title: "Ellipse",         key: "E" },
  { id: "database", icon: "database", title: "Database",      key: "Y" },
  { id: "table",   icon: "table",   title: "Table",           key: "G" },
  { id: "image",   icon: "image",   title: "Import an image", key: "I" },
  { sep: true },
  { id: "text",    icon: "text",    title: "Text",            key: "T" },
  { id: "pen",     icon: "pen",     title: "Draw",            key: "P" },
  { id: "code",    icon: "code",    title: "Code block",      key: "K" },
  { id: "connect", icon: "connect", title: "Draw an arrow",   key: "C" },
  { id: "line",    icon: "line",    title: "Draw a line",     key: "L" }
];
var SHORTCUT_TOOLS = { v: "select", h: "pan", b: "box", d: "diamond", s: "sketch", e: "ellipse", y: "database", g: "table", t: "text", c: "connect", l: "line", p: "pen", k: "code" };
/* The arrow and line tools draw the same thing; a line has no head. */
function isLineTool() { return tool === "connect" || tool === "line"; }

function toolShape(id) {
  if (id === "sketch") return { type: "box", style: "sketch" };
  if (id === "box" || id === "diamond" || id === "ellipse" || id === "pill" || id === "note" || id === "database" || id === "table" || id === "code") {
    return { type: id, style: "wash" };
  }
  return null;
}
function setTool(next) {
  tool = next;
  connectFrom = null;
  Array.prototype.forEach.call(document.querySelectorAll("[data-tool]"), function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
  });
  updateCursor();
  if (isLineTool()) setHint("Drag anywhere to draw " + (tool === "line" ? "a line" : "an arrow") + ". Start or end on a shape to tie it there. Shift keeps it to 45°.");
  else if (tool === "text") setHint("Click the sheet to drop some text.");
  else if (tool === "pan") setHint("Drag to move the sheet around.");
  else if (tool === "pen") setHint("Draw on the canvas. Strokes made close together, one after another, stay one drawing. V or Esc to stop.");
  else if (toolShape(tool)) setHint("Click to place it, or drag to size it as you go.");
  else if (tool === "paint") setHint(paintSticky
    ? "Click items to give them this style. Esc or a click on empty canvas stops."
    : "Click an item to give it this style.");
  else setHint("Double click a shape to type. Drag from an edge dot to draw an arrow.");
  if (tool !== "paint") paintSticky = false;
  if (tool === "pen") { sel.clear(); closeEditor(true); }
  lastInk = null;
  drawOverlay();
  renderBubble();
}
var spaceDown = false;
function updateCursor() {
  stage.classList.toggle("grabbing", !!(drag && drag.type === "pan" && (!drag.right || (rightPan && rightPan.moved))));
  stage.classList.toggle("grabby", !drag && (tool === "pan" || spaceDown));
  stage.classList.toggle("crossy", isLineTool() || tool === "pen" || !!toolShape(tool));
  stage.classList.toggle("texty", tool === "text");
  stage.classList.toggle("painty", tool === "paint");
}

/* ================================================================
   16. Pointer interaction
   ================================================================ */
function blankTarget(t) { return t === stage || t.id === "bg" || t.id === "gridRect"; }

function nodeAt(point) {
  var list = nodes();
  for (var i = list.length - 1; i >= 0; i--) {
    var n = list[i];
    if (point.x >= n.x && point.x <= n.x + n.w && point.y >= n.y && point.y <= n.y + n.h) return n;
  }
  return null;
}
/* A usable row for an arrow end, or null for the side's middle. */
function edgeRow(node, row) {
  return node && node.type === "table" && row != null && row >= 0 && row < node.cells.length ? row : null;
}
/* Where a pointer over a shape would attach an arrow. On a table it is
   the nearest edge line, and on the left or right edge the row under
   the pointer, so arrows can point at a row. */
function attachAt(node, point) {
  if (node.type !== "table") return { side: nearestSide(node, point), row: null };
  var gaps = { left: Math.abs(point.x - node.x), right: Math.abs(point.x - node.x - node.w),
               top: Math.abs(point.y - node.y), bottom: Math.abs(point.y - node.y - node.h) };
  var side = Object.keys(gaps).sort(function (a, b) { return gaps[a] - gaps[b]; })[0];
  if (side === "top" || side === "bottom") return { side: side, row: null };
  return { side: side, row: rowAt(node, point.y) };
}
function nearestSide(node, point) {
  var best = "top", bd = Infinity;
  SIDES.forEach(function (side) {
    var a = anchorPoint(node, side);
    var d = Math.hypot(a.x - point.x, a.y - point.y);
    if (d < bd) { bd = d; best = side; }
  });
  return best;
}
/* Click-to-connect ending on empty sheet: the arrow ends loose there. */
function finishConnectionAt(pt) {
  edges().push(newEdge(connectFrom, { pt: pt }, tool === "line" ? "line" : "arrow"));
  connectFrom = null;
  commit(); render();
}
function startOrFinishConnection(id, side, row) {
  row = row == null || row === "" ? null : +row;
  if (!connectFrom) {
    connectFrom = { id: id, side: side, row: row };
    setHint("Now click an edge dot on the shape the arrow points to.");
    drawOverlay();
    return;
  }
  if (connectFrom.id === id) { connectFrom = null; drawOverlay(); return; }
  edges().push(newEdge(connectFrom, { id: id, side: side, row: row }, tool === "line" ? "line" : "arrow"));
  connectFrom = null;
  commit(); render();
  setHint("Arrow drawn. Double click it to add a label.");
}

stage.addEventListener("pointermove", function (event) {
  if (drag) return;
  var d = event.target.dataset || {};
  var next = d.nodeId || d.anchorNode || null;
  if (next !== hoverNode) { hoverNode = next; drawOverlay(); }
});
stage.addEventListener("pointerleave", function () {
  if (hoverNode && !drag) { hoverNode = null; drawOverlay(); }
});

stage.addEventListener("pointerdown", function (event) {
  /* The right button pans when dragged and opens the menu when it is
     just clicked; the contextmenu handler below makes that call. */
  if (event.button === 2) {
    closeMenus();
    stopReveal();
    rightPan = { target: event.target, x: event.clientX, y: event.clientY, moved: false, menuAsked: false };
    drag = { type: "pan", right: true, sx: event.clientX, sy: event.clientY, vx: view.x, vy: view.y };
    stage.setPointerCapture(event.pointerId);
    return;
  }
  closeMenus();
  stopReveal();

  var target = event.target;
  var d = target.dataset || {};
  var point = toStage(event);

  if (tapOpening) { tapOpening = false; return; }

  /* pan */
  if (event.button === 1 || spaceDown || tool === "pan") {
    drag = { type: "pan", sx: event.clientX, sy: event.clientY, vx: view.x, vy: view.y };
    stage.setPointerCapture(event.pointerId);
    updateCursor();
    event.preventDefault();
    return;
  }

  if (tool === "paint") {
    var target = d.nodeId || d.edgeId || d.textId || d.handleEdge || d.anchorNode || d.colNode || d.resizeNode;
    var found = target ? findAny(target) : null;
    if (!found) { setTool("select"); return; }
    applyStyle(found, paintStyle);
    commit(); render();
    if (!paintSticky) { setTool("select"); selectOnly(found.item.id); }
    return;
  }

  /* The pen draws over anything, shapes included. */
  if (tool === "pen") {
    closeEditor(true);
    sel.clear();
    drag = { type: "ink", points: [point] };
    stage.setPointerCapture(event.pointerId);
    renderBubble();
    return;
  }

  if (editing && !(d.nodeId === editing.id || d.textId === editing.id || d.edgeId === editing.id)) closeEditor();

  /* drag out of an edge dot; with the arrow or line tool a click on one
     starts a click-to-connect instead */
  if (d.anchorSide) {
    var fromRow = d.anchorRow === undefined ? null : +d.anchorRow;
    drag = { type: "connect", fromId: d.anchorNode, fromSide: d.anchorSide, fromRow: fromRow, start: point, hot: null, preview: null,
             byTool: isLineTool(), kind: tool === "line" ? "line" : "arrow" };
    stage.setPointerCapture(event.pointerId);
    return;
  }
  /* dragging either end of the picked arrow ties it to a shape or lets it loose */
  if (d.endEdge) {
    drag = { type: "reend", id: d.endEdge, which: d.endWhich, hot: null, moved: false };
    stage.setPointerCapture(event.pointerId);
    return;
  }
  if (d.textWidth) {
    drag = { type: "textw", id: d.textWidth, moved: false };
    stage.setPointerCapture(event.pointerId);
    return;
  }
  if (d.laneNode) {
    drag = { type: "lanemove", id: d.laneNode, axis: d.laneAxis, from: +d.laneIndex, to: null, moved: false };
    stage.setPointerCapture(event.pointerId);
    drawOverlay();
    return;
  }
  if (d.colEdge) {
    var cn = findNode(d.colNode);
    drag = { type: "col", id: cn.id, col: +d.colEdge - 1, startX: point.x, widths: colWidths(cn), moved: false };
    stage.setPointerCapture(event.pointerId);
    return;
  }
  if (d.resizeCorner) {
    var rn = findNode(d.resizeNode);
    drag = { type: "resize", id: d.resizeNode, corner: d.resizeCorner, box: { x: rn.x, y: rn.y, w: rn.w, h: rn.h } };
    stage.setPointerCapture(event.pointerId);
    return;
  }
  if (d.handleRole) {
    var he = findEdge(d.handleEdge);
    drag = {
      type: "handle", id: d.handleEdge, role: d.handleRole, axis: d.handleAxis,
      originX: point.x, originY: point.y, startDetour: he ? (he.detour || 0) : 0
    };
    stage.setPointerCapture(event.pointerId);
    return;
  }

  var hitId = d.nodeId || d.edgeId || d.textId || null;

  /* The arrow and line tools draw from wherever the press lands: tied to
     the shape under it, or loose on the sheet. */
  if (isLineTool()) {
    var under = d.nodeId ? findNode(d.nodeId) : null, spot = under ? attachAt(under, point) : null;
    drag = {
      /* from inside a shape the arrow leaves by whichever side faces where it goes */
      type: "connect", fromId: under ? under.id : null, fromSide: "auto", fromRow: spot ? spot.row : null,
      start: point, from: under ? null : looseSpot(point), hot: null, preview: null,
      byTool: true, kind: tool === "line" ? "line" : "arrow"
    };
    stage.setPointerCapture(event.pointerId);
    return;
  }

  /* A shape or text tool wins over whatever is already under the pointer,
     so you can drop something on top of an existing shape. */
  var pending = toolShape(tool);
  if (pending) {
    drag = { type: "place", shape: pending, start: point, moved: false };
    ghost = { x: point.x, y: point.y, w: 0, h: 0 };
    stage.setPointerCapture(event.pointerId);
    return;
  }
  if (tool === "text") {
    drag = { type: "textbox", start: point, moved: false };
    ghost = { x: point.x, y: point.y, w: 0, h: 0 };
    stage.setPointerCapture(event.pointerId);
    return;
  }

  if (hitId) {
    var hitNode = d.nodeId ? findNode(d.nodeId) : null;
    if (hitNode && hitNode.type === "table") {
      var picked = cellAt(hitNode, point);
      /* Shift+click inside the table already picked stretches the pick
         instead of adding to the selection, the way a spreadsheet does. */
      if (event.shiftKey && currentCell() && activeCell.id === hitNode.id) {
        activeCell.r2 = picked.r; activeCell.c2 = picked.c;
        afterSelect();
        return;
      }
      pickCell(hitNode.id, picked.r, picked.c);
      setHint("Drag a column line to resize it, or the tabs above columns and beside rows to move them. Shift+click picks a block of cells.");
    }
    if (event.shiftKey || event.metaKey || event.ctrlKey) selectToggle(hitId);
    else if (!sel.has(hitId)) selectOnly(hitId);
    else afterSelect();

    /* tied arrows move with their shapes; loose ends move themselves */
    if (d.edgeId && sel.size === 1 && !isLooseEdge(findEdge(d.edgeId))) return;

    var movers = [];
    selList().forEach(function (f) {
      if (f.kind === "node" || f.kind === "text") movers.push({ id: f.item.id, x: f.item.x, y: f.item.y });
      else if (f.kind === "edge" && isLooseEdge(f.item)) movers.push({ id: f.item.id, edge: true, p1: f.item.p1 && deepCopy(f.item.p1), p2: f.item.p2 && deepCopy(f.item.p2) });
    });
    if (!movers.length) return;
    var box = selectionBox();
    drag = { type: "move", start: point, moved: false, movers: movers, box: box };
    stage.setPointerCapture(event.pointerId);
    document.body.classList.add("no-texture");
    return;
  }

  if (!blankTarget(target)) return;

  if (!event.shiftKey) clearSel();
  connectFrom = null;
  activeCell = null;   /* a table picked by marquee is picked whole, not by an old cell */
  drag = { type: "marquee", start: point, base: new Set(sel), add: event.shiftKey };
  marquee = { x: point.x, y: point.y, w: 0, h: 0 };
  stage.setPointerCapture(event.pointerId);
});

window.addEventListener("pointermove", function (event) {
  if (!drag) return;
  var point = toStage(event);

  if (drag.type === "pan") {
    var k = viewScale();
    if (drag.right && !rightPan.moved) {
      if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 4) return;
      rightPan.moved = true;
      updateCursor();
    }
    view.x = drag.vx - (event.clientX - drag.sx) / k;
    view.y = drag.vy - (event.clientY - drag.sy) / k;
    applyView();
    return;
  }

  if (drag.type === "move") {
    var dx = point.x - drag.start.x, dy = point.y - drag.start.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    if (event.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    if (snapOn && drag.box) {
      dx = Math.round((drag.box.x + dx) / GRID_STEP) * GRID_STEP - drag.box.x;
      dy = Math.round((drag.box.y + dy) / GRID_STEP) * GRID_STEP - drag.box.y;
    }
    if (drag.box) {
      var g = computeGuides(drag.movers.map(function (m) { return m.id; }),
                            { x: drag.box.x + dx, y: drag.box.y + dy, w: drag.box.w, h: drag.box.h });
      dx += g.dx; dy += g.dy; guides = g.lines;
    }
    drag.movers.forEach(function (m) {
      var f = findAny(m.id);
      if (!f) return;
      if (m.edge) {
        if (m.p1 && !f.item.from) f.item.p1 = { x: Math.round(m.p1.x + dx), y: Math.round(m.p1.y + dy) };
        if (m.p2 && !f.item.to) f.item.p2 = { x: Math.round(m.p2.x + dx), y: Math.round(m.p2.y + dy) };
        return;
      }
      f.item.x = Math.round(m.x + dx);
      f.item.y = Math.round(m.y + dy);
    });
    renderCanvas();
    return;
  }

  if (drag.type === "resize") {
    var node = findNode(drag.id);
    if (!node) return;
    var box = drag.box;
    var right = box.x + box.w, bottom = box.y + box.h;
    var minW = node.type === "ink" ? 4 : MIN_W, minH = node.type === "ink" ? 4 : MIN_H;
    if (node.type === "table") {
      var ws = colWidths(node);
      minW = Math.max(MIN_W, Math.ceil(MIN_CELL_W * node.w / Math.min.apply(null, ws)));
      minH = Math.max(MIN_H, node.cells.length * MIN_CELL_H);
    }
    if (drag.corner === "nw" || drag.corner === "sw") {
      node.x = Math.min(snap(point.x), right - minW);
      node.w = right - node.x;
    } else {
      node.w = Math.max(minW, snap(point.x) - box.x);
    }
    if (drag.corner === "nw" || drag.corner === "ne") {
      node.y = Math.min(snap(point.y), bottom - minH);
      node.h = bottom - node.y;
    } else {
      node.h = Math.max(minH, snap(point.y) - box.y);
    }
    if (node.type === "image" && node.natW && node.natH && !event.shiftKey) {
      node.h = Math.max(10, Math.round(node.w * node.natH / node.natW));
      if (drag.corner === "nw" || drag.corner === "ne") node.y = bottom - node.h;
    }
    renderCanvas();
    return;
  }

  if (drag.type === "ink") {
    var lastPt = drag.points[drag.points.length - 1];
    if (Math.hypot(point.x - lastPt.x, point.y - lastPt.y) * viewScale() >= 1.5) {
      drag.points.push(point);
      drawOverlay();
    }
    return;
  }

  /* Dragging a column line resizes that column and the table grows with
     it. With Shift the next column gives up the width instead, so the
     table keeps its size. */
  /* dragging a row or column tab: the landing spot is the nearest line
     between rows or columns to the pointer */
  /* dragging a text column's handle sets how wide it is */
  if (drag.type === "textw") {
    var tw = findText(drag.id);
    if (!tw) return;
    var reach = tw.anchor === "middle" ? 2 * Math.abs(point.x - tw.x) : tw.anchor === "end" ? tw.x - point.x : point.x - tw.x;
    tw.w = Math.round(clamp(snapOn ? snap(reach) : reach, 60, 2000));
    drag.moved = true;
    renderCanvas();
    return;
  }

  if (drag.type === "lanemove") {
    var lt = findNode(drag.id);
    if (!lt) return;
    var edgesAt = drag.axis === "c" ? colEdges(lt) : rowEdges(lt), along = drag.axis === "c" ? point.x : point.y;
    var best = 0;
    edgesAt.forEach(function (v, i) { if (Math.abs(v - along) < Math.abs(edgesAt[best] - along)) best = i; });
    drag.moved = true;
    drag.to = best === drag.from || best === drag.from + 1 ? null : best;
    drawOverlay();
    return;
  }

  if (drag.type === "col") {
    var tbl = findNode(drag.id);
    if (!tbl) return;
    var ws = drag.widths.slice(), col = drag.col;
    var left = tbl.x + ws.slice(0, col).reduce(function (a, b) { return a + b; }, 0);
    var line = left + ws[col] + (point.x - drag.startX);
    if (snapOn) line = snap(line);
    var want = Math.max(MIN_CELL_W, line - left);
    if (event.shiftKey && col < ws.length - 1) {
      var pair = ws[col] + ws[col + 1];
      want = clamp(want, MIN_CELL_W, pair - MIN_CELL_W);
      ws[col + 1] = pair - want;
    }
    ws[col] = want;
    if (Math.abs(point.x - drag.startX) > 2) drag.moved = true;
    tbl.colW = ws.map(function (w) { return Math.round(w); });
    tbl.w = tbl.colW.reduce(function (a, b) { return a + b; }, 0);
    renderCanvas();
    return;
  }

  if (drag.type === "handle") {
    var edge = findEdge(drag.id);
    var geo = edge ? edgeGeometry(edge) : null;
    if (edge && geo) {
      if (drag.role === "c1") edge.o1 = { x: point.x - geo.start.x, y: point.y - geo.start.y };
      else if (drag.role === "c2") edge.o2 = { x: point.x - geo.end.x, y: point.y - geo.end.y };
      else if (drag.role === "detour") {
        var shift = drag.axis === "y" ? point.y - drag.originY : point.x - drag.originX;
        edge.detour = Math.round(drag.startDetour + shift);
      }
    }
    renderCanvas();
    return;
  }

  if (drag.type === "connect") {
    var over = nodeAt(point);
    if (over && over.id === drag.fromId) over = null;
    var spot = over ? attachAt(over, point) : null;
    drag.hot = over ? { id: over.id, side: spot.side, row: spot.row } : null;
    var startPt = drag.fromId ? anchorPoint(findNode(drag.fromId), drag.fromSide, edgeRow(findNode(drag.fromId), drag.fromRow)) : drag.from;
    drag.to = drag.hot ? null : looseSpot(point, startPt, event.shiftKey);
    /* the preview is the arrow it will make, drawn the same way */
    var trial = newEdge(drag.fromId ? { id: drag.fromId, side: drag.fromSide, row: drag.fromRow } : { pt: drag.from },
                        drag.hot || { pt: drag.to }, drag.kind);
    var trialGeo = edgeGeometry(trial);
    drag.preview = trialGeo ? trialGeo.d : null;
    drawOverlay();
    return;
  }
  /* an end of the picked arrow follows the pointer, tying on to any shape
     it is over except the one the other end is on */
  if (drag.type === "reend") {
    var re = findEdge(drag.id);
    if (!re) return;
    var keys = drag.which === "from" ? ["from", "fromSide", "fromRow", "p1"] : ["to", "toSide", "toRow", "p2"];
    var otherId = drag.which === "from" ? re.to : re.from;
    var onto = nodeAt(point);
    if (onto && onto.id === otherId) onto = null;
    if (onto) {
      var at2 = attachAt(onto, point);
      re[keys[0]] = onto.id; re[keys[1]] = at2.side;
      if (at2.row != null) re[keys[2]] = at2.row; else delete re[keys[2]];
      delete re[keys[3]];
      drag.hot = { id: onto.id, side: at2.side, row: at2.row };
    } else {
      var geoOther = edgeGeometry(re), fixed = geoOther ? (drag.which === "from" ? geoOther.end : geoOther.start) : null;
      re[keys[0]] = null; re[keys[1]] = "auto"; delete re[keys[2]];
      re[keys[3]] = looseSpot(point, fixed, event.shiftKey);
      drag.hot = null;
    }
    drag.moved = true;
    renderCanvas();
    return;
  }

  if (drag.type === "place" || drag.type === "textbox") {
    var w = point.x - drag.start.x, h = point.y - drag.start.y;
    if (Math.abs(w) > 5 || Math.abs(h) > 5) drag.moved = true;
    ghost = { x: Math.min(drag.start.x, point.x), y: Math.min(drag.start.y, point.y), w: Math.abs(w), h: Math.abs(h) };
    drawOverlay();
    return;
  }

  if (drag.type === "marquee") {
    marquee = {
      x: Math.min(drag.start.x, point.x), y: Math.min(drag.start.y, point.y),
      w: Math.abs(point.x - drag.start.x), h: Math.abs(point.y - drag.start.y)
    };
    var hits = [];
    function overlaps(b) {
      return b && b.x < marquee.x + marquee.w && b.x + b.w > marquee.x &&
             b.y < marquee.y + marquee.h && b.y + b.h > marquee.y;
    }
    nodes().forEach(function (n) { if (overlaps({ x: n.x, y: n.y, w: n.w, h: n.h })) hits.push(n.id); });
    texts().forEach(function (t) { if (overlaps(boxOf({ kind: "text", item: t }))) hits.push(t.id); });
    function endIn(id, pt) {
      return id ? hits.indexOf(id) >= 0 : !!pt && overlaps({ x: pt.x, y: pt.y, w: 0.01, h: 0.01 });
    }
    edges().forEach(function (e) {
      if (endIn(e.from, e.p1) && endIn(e.to, e.p2)) hits.push(e.id);
    });
    hits = [].concat.apply([], hits.map(withGroup));
    sel = drag.add ? new Set(Array.from(drag.base).concat(hits)) : new Set(hits);
    drawOverlay(); renderBubble();
    return;
  }
});

function endDrag(event) {
  if (!drag) return;
  var d = drag;
  var point = event ? toStage(event) : null;
  drag = null;
  guides = []; marquee = null;
  document.body.classList.remove("no-texture");

  if (d.type === "pan") {
    if (d.right) {
      var held = rightPan;
      rightPan = null;
      if (held.moved) quietMenuUntil = Date.now() + 400;
      else if (held.menuAsked) openContextFor(held.target, held.x, held.y);
    }
    updateCursor();
    return;
  }

  if (d.type === "place") {
    var at = point || d.start;
    var node;
    if (d.moved && ghost && ghost.w > 12 && ghost.h > 12) {
      node = makeNode(d.shape.type, d.shape.style, { x: ghost.x + ghost.w / 2, y: ghost.y + ghost.h / 2 });
      node.x = snap(ghost.x); node.y = snap(ghost.y);
      node.w = Math.max(MIN_W, snap(ghost.w)); node.h = Math.max(MIN_H, snap(ghost.h));
      if (node.type === "code") { node.minW = node.w; node.minH = node.h; fitCode(node); }
      if (node.type === "table") {
        node.w = Math.max(node.w, node.cells[0].length * MIN_CELL_W);
        node.h = Math.max(node.h, node.cells.length * MIN_CELL_H);
      }
    } else {
      node = makeNode(d.shape.type, d.shape.style, at);
    }
    ghost = null;
    nodes().push(node); toneIndex += 1;
    commit(); render(); selectOnly(node.id);
    if (!(event && event.altKey)) setTool("select");
    openEditorSoon(node.id, defaultField(node.id));
    return;
  }
  if (d.type === "textbox") {
    var area = d.moved && ghost && ghost.w > 30 ? ghost : null;
    ghost = null;
    setTool("select");
    if (area) addFreeText({ x: area.x, y: area.y }, area.w, true);
    else addFreeText(point || d.start);
    return;
  }
  ghost = null;

  if (d.type === "connect") {
    var stayed = !point || Math.hypot(point.x - d.start.x, point.y - d.start.y) * viewScale() < 4;
    if (stayed) {
      if (d.byTool && d.fromId) startOrFinishConnection(d.fromId, d.fromSide, d.fromRow);
      else if (d.byTool && connectFrom) finishConnectionAt(d.from);
      else if (d.fromId) selectOnly(d.fromId);   /* a click on an edge dot that goes nowhere picks the shape instead */
      render();
      return;
    }
    var made = newEdge(d.fromId ? { id: d.fromId, side: d.fromSide, row: d.fromRow } : { pt: d.from },
                       d.hot || { pt: d.to || looseSpot(point) }, d.kind);
    edges().push(made);
    commit(); render();
    if (d.byTool) selectOnly(made.id);
    setHint((d.kind === "line" ? "Line" : "Arrow") + " drawn. Drag its ends to move them, or double click it to add a label.");
    return;
  }
  if (d.type === "reend") { if (d.moved) commit(); render(); return; }

  if (d.type === "marquee") { render(); return; }
  if (d.type === "move" && !d.moved) { render(); return; }
  if (d.type === "col" && !d.moved) { render(); return; }
  if (d.type === "textw") { if (d.moved) commit(); render(); return; }
  if (d.type === "lanemove") {
    var lt2 = findNode(d.id);
    if (lt2 && d.to !== null) {
      var where = reorderTable(lt2, d.axis, d.from, d.from, d.to);
      if (where) {
        if (activeCell && activeCell.id === lt2.id) {
          if (d.axis === "r") { activeCell.r = where[activeCell.r]; activeCell.r2 = where[activeCell.r2]; }
          else { activeCell.c = where[activeCell.c]; activeCell.c2 = where[activeCell.c2]; }
        }
        commit();
      }
    }
    render();
    return;
  }
  if (d.type === "resize") {
    var rt = findNode(d.id);
    if (rt && rt.type === "table" && rt.rowBase && d.box.h) rt.rowBase = rt.rowBase * rt.h / d.box.h;
    if (rt && rt.type === "code") { rt.minW = rt.w; rt.minH = rt.h; }
  }
  if (d.type === "ink") { finishStroke(d.points); return; }

  commit();
  render();
}
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", function () {
  rightPan = null;
  if (!drag) return;
  drag = null; guides = []; marquee = null; ghost = null;
  document.body.classList.remove("no-texture");
  render();
});

/* Scrolling moves around the canvas; Ctrl or Cmd with the wheel, or a
   trackpad pinch (which arrives as a Ctrl wheel), zooms at the pointer. */
stage.addEventListener("wheel", function (event) {
  event.preventDefault();
  var unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stageSize().h : 1;
  var dx = event.deltaX * unit, dy = event.deltaY * unit;
  if (event.ctrlKey || event.metaKey) {
    zoomAround(toStage(event), Math.exp(clamp(dy, -60, 60) * 0.0035));
    return;
  }
  if (event.shiftKey && !dx) { dx = dy; dy = 0; }
  var k = viewScale();
  view.x += dx / k;
  view.y += dy / k;
  applyView();
}, { passive: false });

var menuPoint = null;
/* Mac and Linux send contextmenu as the right button goes down, Windows
   as it comes up. While the button is held we only note the request and
   decide on release; right after a pan, a late Windows one is ignored. */
var rightPan = null, quietMenuUntil = 0;
stage.addEventListener("contextmenu", function (event) {
  event.preventDefault();
  if (rightPan) { rightPan.menuAsked = true; return; }
  if (Date.now() < quietMenuUntil) return;
  openContextFor(event.target, event.clientX, event.clientY);
});
function openContextFor(target, clientX, clientY) {
  menuPoint = toStage({ clientX: clientX, clientY: clientY });
  var d = target.dataset || {};
  var id = d.nodeId || d.edgeId || d.textId;
  if (id && !sel.has(id)) selectOnly(id);
  else if (!id) clearSel();
  openContextMenu(clientX, clientY);
}

