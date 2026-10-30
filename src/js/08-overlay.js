/* ================================================================
   11. Overlay: selection, handles, anchors, guides
   ================================================================ */
var marquee = null, guides = [], ghost = null, drag = null, hoverNode = null;
/* The cells picked in a table: r,c is where the pick started and r2,c2 is
   where Shift+click stretched it to. */
var activeCell = null;

function pickCell(id, r, c) { activeCell = { id: id, r: r, c: c, r2: r, c2: c }; }
function currentCell() {
  var list = selList();
  if (!activeCell || list.length !== 1 || list[0].item.id !== activeCell.id) return null;
  var node = list[0].item, t = tableSize(node), a = activeCell;
  if (Math.max(a.r, a.r2) >= t.rows || Math.max(a.c, a.c2) >= t.cols) return null;
  var cur = {
    node: node,
    r0: Math.min(a.r, a.r2), r1: Math.max(a.r, a.r2),
    c0: Math.min(a.c, a.c2), c1: Math.max(a.c, a.c2)
  };
  /* a pick that cuts into a merged region grows to take all of it */
  for (var grew = true; grew;) {
    grew = false;
    tableMerges(node).forEach(function (m) {
      var meets = m.r <= cur.r1 && m.r + m.rs - 1 >= cur.r0 && m.c <= cur.c1 && m.c + m.cs - 1 >= cur.c0;
      if (!meets) return;
      var r0 = Math.min(cur.r0, m.r), r1 = Math.max(cur.r1, m.r + m.rs - 1);
      var c0 = Math.min(cur.c0, m.c), c1 = Math.max(cur.c1, m.c + m.cs - 1);
      if (r0 !== cur.r0 || r1 !== cur.r1 || c0 !== cur.c0 || c1 !== cur.c1) {
        cur.r0 = r0; cur.r1 = r1; cur.c0 = c0; cur.c1 = c1; grew = true;
      }
    });
  }
  return cur;
}
function pickedMerges(cur) {
  return tableMerges(cur.node).filter(function (m) {
    return m.r >= cur.r0 && m.r + m.rs - 1 <= cur.r1 && m.c >= cur.c0 && m.c + m.cs - 1 <= cur.c1;
  });
}
function pickIsOneRegion(cur) {
  var ms = pickedMerges(cur);
  return ms.length === 1 && ms[0].r === cur.r0 && ms[0].c === cur.c0 &&
         ms[0].rs === cur.r1 - cur.r0 + 1 && ms[0].cs === cur.c1 - cur.c0 + 1;
}
/* Merging keeps every bit of text, joined in reading order into the
   top-left cell, and the first colour found. */
/* Aligns the picked cells, or every cell when the table was selected
   without picking one. part is "h" or "v". */
function alignCells(part, code) {
  var cur = currentCell(), tables = cur ? [cur.node] : selNodes().filter(function (n) { return n.type === "table"; });
  tables.forEach(function (n) {
    if (!n.aligns) syncFills(n);
    function set(r, c) {
      var al = cellAlign(n, r, c);
      if (part === "h") al.h = code; else if (part === "v") al.v = code; else al.wrap = code;
      n.aligns[r][c] = alignCode(al);
    }
    if (cur) eachPickedCell(cur, set);
    else n.cells.forEach(function (row, r) { row.forEach(function (_, c) { set(r, c); }); });
  });
  commit(); render();
}
function alignButton(node) {
  var cur = currentCell(), cells = [];
  if (cur) eachPickedCell(cur, function (r, c) { if (!isCovered(node, r, c)) cells.push(cellAlign(node, r, c)); });
  else node.cells.forEach(function (row, r) { row.forEach(function (_, c) { if (!isCovered(node, r, c)) cells.push(cellAlign(node, r, c)); }); });
  function all(part, code) { return cells.length > 0 && cells.every(function (a) { return a[part] === code; }); }
  var h = all("h", "l") ? "alignLeft" : all("h", "r") ? "alignRight" : "alignCenter";
  return toolButton({
    icon: h, label: "Align", title: cur ? "Line up the text in these cells" : "Line up the text in every cell",
    onClick: function (e, b) {
      var rc = b.getBoundingClientRect();
      openMenuAt(rc.left, rc.bottom + 6, [
        { header: cur ? "Text in the picked cells" : "Text in every cell" },
        { label: "Left", icon: "alignLeft", on: all("h", "l"), run: function () { alignCells("h", "l"); } },
        { label: "Centre", icon: "alignCenter", on: all("h", "c"), run: function () { alignCells("h", "c"); } },
        { label: "Right", icon: "alignRight", on: all("h", "r"), run: function () { alignCells("h", "r"); } },
        "-",
        { label: "Top", icon: "vTop", on: all("v", "t"), run: function () { alignCells("v", "t"); } },
        { label: "Middle", icon: "vMid", on: all("v", "m"), run: function () { alignCells("v", "m"); } },
        { label: "Bottom", icon: "vBot", on: all("v", "b"), run: function () { alignCells("v", "b"); } }
      ]);
    }
  });
}
function wrapButton(node) {
  var cur = currentCell(), cells = [];
  if (cur) eachPickedCell(cur, function (r, c) { if (!isCovered(node, r, c)) cells.push(cellAlign(node, r, c)); });
  else node.cells.forEach(function (row, r) { row.forEach(function (_, c) { if (!isCovered(node, r, c)) cells.push(cellAlign(node, r, c)); }); });
  var on = cells.length > 0 && cells.every(function (a) { return a.wrap; });
  return toolButton({
    icon: "wrap", label: "Wrap", pressed: on,
    title: on ? "Stop wrapping: keep each line on one line" : (cur ? "Wrap long text in these cells, growing the row" : "Wrap long text in every cell, growing rows to fit"),
    onClick: function () { alignCells("w", !on); }
  });
}
function mergePicked() {
  var cur = currentCell();
  if (!cur || (cur.r0 === cur.r1 && cur.c0 === cur.c1) || pickIsOneRegion(cur)) return;
  var n = cur.node, words = [], colour = null, inside = new Set(pickedMerges(cur));
  eachPickedCell(cur, function (r, c) {
    if (isCovered(n, r, c)) return;
    if (n.cells[r][c]) words.push(n.cells[r][c]);
    if (!colour && n.fills[r][c]) colour = n.fills[r][c];
  });
  eachPickedCell(cur, function (r, c) { n.cells[r][c] = ""; });
  n.cells[cur.r0][cur.c0] = words.join(" ");
  if (colour) n.fills[cur.r0][cur.c0] = colour;
  n.merges = tableMerges(n).filter(function (m) { return !inside.has(m); })
    .concat([{ r: cur.r0, c: cur.c0, rs: cur.r1 - cur.r0 + 1, cs: cur.c1 - cur.c0 + 1 }]);
  pickCell(n.id, cur.r0, cur.c0);
  commit(); render();
  if (words.length > 1) toast("Merged, and joined the text from " + words.length + " cells");
}
function unmergePicked() {
  var cur = currentCell();
  if (!cur) return;
  var gone = new Set(pickedMerges(cur));
  if (!gone.size) return;
  cur.node.merges = tableMerges(cur.node).filter(function (m) { return !gone.has(m); });
  trimMerges(cur.node);
  commit(); render();
}
function eachPickedCell(cur, visit) {
  for (var r = cur.r0; r <= cur.r1; r++) for (var c = cur.c0; c <= cur.c1; c++) visit(r, c);
}
function setCellInk(hex) {
  var cur = currentCell();
  if (!cur) return;
  if (!cur.node.inks) syncFills(cur.node);
  eachPickedCell(cur, function (r, c) { cur.node.inks[r][c] = hex; });
  commit(); render();
}
function setCellFill(hex) {
  var cur = currentCell();
  if (!cur) return;
  eachPickedCell(cur, function (r, c) { cur.node.fills[r][c] = hex; });
  commit(); render();
}

function boxOf(found) {
  if (found.kind === "node") {
    var n = found.item;
    return { x: n.x, y: n.y, w: n.w, h: n.h };
  }
  if (found.kind === "text") {
    var b = textBounds[found.item.id];
    return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
  }
  var geo = edgeGeometry(found.item);
  return geo ? { x: geo.mid.x - 20, y: geo.mid.y - 12, w: 40, h: 24 } : null;
}
function selectionBox() {
  var boxes = selList().map(boxOf).filter(Boolean);
  if (!boxes.length) return null;
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  boxes.forEach(function (b) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function ov() { return 1 / viewScale(); }  /* keep overlay furniture a constant screen size */

function handleRect(x, y, data) {
  var s = 4 * ov();
  var r = makeEl("rect", {
    x: (x - s).toFixed(1), y: (y - s).toFixed(1),
    width: (s * 2).toFixed(1), height: (s * 2).toFixed(1), rx: (1.5 * ov()).toFixed(1),
    fill: "#FFFFFF", stroke: RED, "stroke-width": (1.4 * ov()).toFixed(2), class: "grab"
  });
  Object.keys(data).forEach(function (k) { r.dataset[k] = data[k]; });
  return r;
}

function drawOverlay() {
  clear(overlay);
  var k = ov();

  guides.forEach(function (g) {
    overlay.appendChild(makeEl("line", {
      x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2,
      stroke: RED, "stroke-width": (0.9 * k).toFixed(2), "stroke-dasharray": (3 * k) + " " + (3 * k), opacity: 0.7
    }));
  });

  if (ghost) {
    overlay.appendChild(makeEl("rect", {
      x: ghost.x, y: ghost.y, width: Math.max(1, ghost.w), height: Math.max(1, ghost.h),
      fill: "none", stroke: RED, "stroke-width": (1.3 * k).toFixed(2),
      "stroke-dasharray": (5 * k) + " " + (4 * k), rx: 4
    }));
  }
  if (marquee) {
    overlay.appendChild(makeEl("rect", {
      x: marquee.x, y: marquee.y, width: marquee.w, height: marquee.h,
      fill: "rgba(221,75,68,.07)", stroke: RED, "stroke-width": (0.9 * k).toFixed(2),
      "stroke-dasharray": (4 * k) + " " + (3 * k)
    }));
  }
  if (drag && drag.type === "ink") {
    overlay.appendChild(makeEl("path", {
      d: smoothPath(drag.points), fill: "none", stroke: penStyle.color, "stroke-width": penStyle.weight,
      "stroke-linecap": "round", "stroke-linejoin": "round"
    }));
  }
  if (drag && drag.type === "connect" && drag.preview) {
    overlay.appendChild(makeEl("path", {
      d: drag.preview, fill: "none", stroke: RED, "stroke-width": (1.5 * k).toFixed(2),
      "stroke-dasharray": (5 * k) + " " + (4 * k), "stroke-linecap": "round"
    }));
  }

  /* column grips on a selected table: one on every column line, plus the
     right edge, which widens only the last column */
  var only = selList();
  if (!editing && only.length === 1 && only[0].kind === "node" && only[0].item.type === "table" &&
      (!drag || drag.type === "col")) {
    var tn = only[0].item, xs = colEdges(tn);
    for (var ci = 1; ci < xs.length; ci++) {
      var edgeEnd = ci === xs.length - 1, inset = edgeEnd ? 10 * k : 0;
      var grip = makeEl("rect", {
        x: (xs[ci] - 5 * k).toFixed(1), y: (tn.y + inset).toFixed(1),
        width: (10 * k).toFixed(1), height: Math.max(1, tn.h - inset * 2).toFixed(1),
        rx: (3 * k).toFixed(1), class: "grab col-grip" + (drag && drag.col === ci - 1 ? " live" : "")
      });
      grip.dataset.colNode = tn.id;
      grip.dataset.colEdge = ci;
      overlay.appendChild(grip);
    }
  }

  /* tabs for moving whole columns (above the table) and rows (to its
     left); while one is dragged a red line shows where it will land */
  if (!editing && only.length === 1 && only[0].kind === "node" && only[0].item.type === "table" &&
      (!drag || drag.type === "lanemove")) {
    var mt = only[0].item, mxs = colEdges(mt), mys = rowEdges(mt);
    var lanes = [];
    for (var lc = 0; lc < mxs.length - 1; lc++) lanes.push({ axis: "c", i: lc, x: (mxs[lc] + mxs[lc + 1]) / 2 - 9 * k, y: mt.y - 15 * k, w: 18 * k, h: 9 * k });
    for (var lr = 0; lr < mys.length - 1; lr++) lanes.push({ axis: "r", i: lr, x: mt.x - 15 * k, y: (mys[lr] + mys[lr + 1]) / 2 - 9 * k, w: 9 * k, h: 18 * k });
    lanes.forEach(function (ln) {
      var live = drag && drag.type === "lanemove" && drag.axis === ln.axis && drag.from === ln.i;
      var tab = makeEl("rect", {
        x: ln.x.toFixed(1), y: ln.y.toFixed(1), width: ln.w.toFixed(1), height: ln.h.toFixed(1), rx: (3 * k).toFixed(1),
        class: "grab lane-tab" + (live ? " live" : "")
      });
      tab.dataset.laneNode = mt.id; tab.dataset.laneAxis = ln.axis; tab.dataset.laneIndex = ln.i;
      overlay.appendChild(tab);
      /* three small dots so it reads as something to grab */
      for (var dd = -1; dd <= 1; dd++) {
        var cx = ln.x + ln.w / 2 + (ln.axis === "c" ? dd * 4 * k : 0), cy = ln.y + ln.h / 2 + (ln.axis === "r" ? dd * 4 * k : 0);
        overlay.appendChild(makeEl("circle", { cx: cx.toFixed(1), cy: cy.toFixed(1), r: (1.1 * k).toFixed(2), fill: RED, "pointer-events": "none" }));
      }
    });
    if (drag && drag.type === "lanemove" && drag.to !== null) {
      var lineAt = drag.axis === "c" ? mxs[drag.to] : mys[drag.to];
      overlay.appendChild(makeEl("path", {
        d: drag.axis === "c"
          ? "M" + lineAt.toFixed(1) + "," + (mt.y - 6 * k).toFixed(1) + " V" + (mt.y + mt.h + 6 * k).toFixed(1)
          : "M" + (mt.x - 6 * k).toFixed(1) + "," + lineAt.toFixed(1) + " H" + (mt.x + mt.w + 6 * k).toFixed(1),
        stroke: RED, "stroke-width": (3 * k).toFixed(2), "stroke-linecap": "round"
      }));
    }
  }

  /* anchor dots: on the hovered shape, or on everything while connecting */
  var anchorNodes = [];
  if (isLineTool()) anchorNodes = nodes();
  else if (hoverNode && !drag && tool !== "pen") { var hv = findNode(hoverNode); if (hv) anchorNodes = [hv]; }
  else if (drag && (drag.type === "connect" || drag.type === "reend")) { anchorNodes = nodes(); }

  anchorNodes.forEach(function (node) {
    var spots = [];
    SIDES.forEach(function (side) {
      if (node.type === "table" && (side === "left" || side === "right")) {
        node.cells.forEach(function (_, row) { spots.push({ side: side, row: row }); });
      } else {
        spots.push({ side: side, row: null });
      }
    });
    spots.forEach(function (spot) {
      var side = spot.side, point = anchorPoint(node, side, spot.row);
      function same(a) { return a && a.id === node.id && a.side === side && (a.row == null ? null : a.row) === spot.row; }
      var chosen = same(connectFrom) || (drag && (drag.type === "connect" || drag.type === "reend") && same(drag.hot));
      var dot = makeEl("circle", {
        cx: point.x.toFixed(1), cy: point.y.toFixed(1), r: ((chosen ? 5.2 : spot.row != null ? 3.2 : 3.8) * k).toFixed(1),
        fill: chosen ? RED : "#FFFFFF", stroke: RED, "stroke-width": (1.4 * k).toFixed(2), class: "grab"
      });
      dot.dataset.anchorNode = node.id;
      dot.dataset.anchorSide = side;
      if (spot.row != null) dot.dataset.anchorRow = spot.row;
      overlay.appendChild(dot);
    });
  });

  orderHover.forEach(function (id) {
    var f = findAny(id), b = f && boxOf(f);
    if (!b) return;
    overlay.appendChild(makeEl("rect", {
      x: (b.x - 6 * k).toFixed(1), y: (b.y - 6 * k).toFixed(1),
      width: (b.w + 12 * k).toFixed(1), height: (b.h + 12 * k).toFixed(1),
      fill: "rgba(221,75,68,.06)", stroke: RED, "stroke-width": (1.2 * k).toFixed(2),
      "stroke-dasharray": (4 * k) + " " + (3 * k), rx: 6 * k
    }));
  });

  if (editing) return;
  var chosenList = selList();
  if (!chosenList.length) return;

  chosenList.forEach(function (found) {
    var box = boxOf(found);
    if (!box) return;
    overlay.appendChild(makeEl("rect", {
      x: (box.x - 4 * k).toFixed(1), y: (box.y - 4 * k).toFixed(1),
      width: (box.w + 8 * k).toFixed(1), height: (box.h + 8 * k).toFixed(1),
      fill: "none", stroke: RED, "stroke-width": (1.1 * k).toFixed(2),
      "stroke-dasharray": found.kind === "node" ? null : (4 * k) + " " + (3 * k),
      opacity: 0.85, rx: 4 * k
    }));
  });

  if (drag && drag.type !== "connect") return;

  pickedGroups().forEach(function (members) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    members.forEach(function (f) {
      var b = boxOf(f);
      if (f.kind === "edge") { var eg = edgeGeometry(f.item); if (eg) b = { x: Math.min(eg.start.x, eg.end.x), y: Math.min(eg.start.y, eg.end.y), w: Math.abs(eg.end.x - eg.start.x), h: Math.abs(eg.end.y - eg.start.y) }; }
      if (!b) return;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    });
    if (x0 === Infinity) return;
    overlay.appendChild(makeEl("rect", {
      x: (x0 - 12 * k).toFixed(1), y: (y0 - 12 * k).toFixed(1), width: (x1 - x0 + 24 * k).toFixed(1), height: (y1 - y0 + 24 * k).toFixed(1),
      fill: "none", stroke: RED, "stroke-width": (1.2 * k).toFixed(2), "stroke-dasharray": (8 * k) + " " + (5 * k), rx: 10 * k
    }));
  });

  var single = chosenList.length === 1 ? chosenList[0] : null;

  var cur = currentCell();
  if (cur) {
    var cb = cellBox(cur.node, cur.r0, cur.c0), end = cellBox(cur.node, cur.r1, cur.c1);
    cb.w = end.x + end.w - cb.x; cb.h = end.y + end.h - cb.y;
    overlay.appendChild(makeEl("rect", {
      x: (cb.x + 2 * k).toFixed(1), y: (cb.y + 2 * k).toFixed(1),
      width: Math.max(1, cb.w - 4 * k).toFixed(1), height: Math.max(1, cb.h - 4 * k).toFixed(1),
      fill: "none", stroke: RED, "stroke-width": (1.4 * k).toFixed(2),
      "stroke-dasharray": (3 * k) + " " + (2.5 * k), rx: 2 * k
    }));
  }

  if (single && single.kind === "text" && single.item.w > 0) {
    var col = textColumn(single.item), tb = textBounds[single.item.id];
    var midY = tb ? tb.y + tb.height / 2 : single.item.y;
    overlay.appendChild(makeEl("line", {
      x1: col.x.toFixed(1), y1: (midY - 14 * k).toFixed(1), x2: col.x.toFixed(1), y2: (midY + 14 * k).toFixed(1),
      stroke: RED, "stroke-width": (0.8 * k).toFixed(2), "stroke-dasharray": (3 * k) + " " + (3 * k), opacity: 0.6
    }));
    overlay.appendChild(handleRect(col.x + col.w, midY, { textWidth: single.item.id }));
  }
  if (single && single.kind === "node") {
    var n = single.item;
    [["nw", n.x, n.y], ["ne", n.x + n.w, n.y], ["se", n.x + n.w, n.y + n.h], ["sw", n.x, n.y + n.h]]
      .forEach(function (c) {
        overlay.appendChild(handleRect(c[1], c[2], { resizeCorner: c[0], resizeNode: n.id }));
      });
  } else if (chosenList.length > 1 && !selIsOneGroup()) {
    var b = selectionBox();
    if (b) {
      overlay.appendChild(makeEl("rect", {
        x: b.x - 7 * k, y: b.y - 7 * k, width: b.w + 14 * k, height: b.h + 14 * k,
        fill: "none", stroke: RED, "stroke-width": (1 * k).toFixed(2),
        "stroke-dasharray": (6 * k) + " " + (4 * k), opacity: 0.55, rx: 6 * k
      }));
    }
  }

  if (single && single.kind === "edge") {
    var geo = edgeGeometry(single.item);
    if (geo) {
      geo.handles.forEach(function (h) {
        if (h.anchor) {
          overlay.appendChild(makeEl("line", {
            x1: h.anchor.x, y1: h.anchor.y, x2: h.x, y2: h.y,
            stroke: RED, "stroke-width": (0.8 * k).toFixed(2), "stroke-dasharray": (3 * k) + " " + (3 * k), opacity: 0.55
          }));
        }
        var dot = makeEl("circle", {
          cx: h.x.toFixed(1), cy: h.y.toFixed(1), r: (4.4 * k).toFixed(1),
          fill: "#FFFFFF", stroke: RED, "stroke-width": (1.4 * k).toFixed(2), class: "grab"
        });
        dot.dataset.handleRole = h.role;
        dot.dataset.handleEdge = single.item.id;
        if (h.axis) dot.dataset.handleAxis = h.axis;
        overlay.appendChild(dot);
      });
      [["from", geo.start], ["to", geo.end]].forEach(function (end) {
        var tip = makeEl("rect", {
          x: (end[1].x - 4.5 * k).toFixed(1), y: (end[1].y - 4.5 * k).toFixed(1),
          width: (9 * k).toFixed(1), height: (9 * k).toFixed(1), rx: (4.5 * k).toFixed(1),
          fill: single.item[end[0]] ? RED : "#FFFFFF", stroke: RED, "stroke-width": (1.4 * k).toFixed(2), class: "grab"
        });
        tip.dataset.endEdge = single.item.id;
        tip.dataset.endWhich = end[0];
        overlay.appendChild(tip);
      });
    }
  }
}

/* smart guides while dragging */
function computeGuides(movingIds, box) {
  if (!guidesOn) return { dx: 0, dy: 0, lines: [] };
  var tol = 5 * ov();
  var others = nodes().filter(function (n) { return movingIds.indexOf(n.id) < 0; })
    .map(function (n) { return { x: n.x, y: n.y, w: n.w, h: n.h }; });

  var dx = null, dy = null;
  var bx = [box.x, box.x + box.w / 2, box.x + box.w];
  var by = [box.y, box.y + box.h / 2, box.y + box.h];

  others.forEach(function (o) {
    [o.x, o.x + o.w / 2, o.x + o.w].forEach(function (ox) {
      bx.forEach(function (v) {
        var d = ox - v;
        if (Math.abs(d) <= tol && (dx === null || Math.abs(d) < Math.abs(dx))) dx = d;
      });
    });
    [o.y, o.y + o.h / 2, o.y + o.h].forEach(function (oy) {
      by.forEach(function (v) {
        var d = oy - v;
        if (Math.abs(d) <= tol && (dy === null || Math.abs(d) < Math.abs(dy))) dy = d;
      });
    });
  });
  dx = dx || 0; dy = dy || 0;

  var nb = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
  var lines = [];
  others.forEach(function (o) {
    [o.x, o.x + o.w / 2, o.x + o.w].forEach(function (ox) {
      if ([nb.x, nb.x + nb.w / 2, nb.x + nb.w].some(function (v) { return Math.abs(v - ox) < 0.5; })) {
        lines.push({ x1: ox, y1: Math.min(o.y, nb.y) - 12, x2: ox, y2: Math.max(o.y + o.h, nb.y + nb.h) + 12 });
      }
    });
    [o.y, o.y + o.h / 2, o.y + o.h].forEach(function (oy) {
      if ([nb.y, nb.y + nb.h / 2, nb.y + nb.h].some(function (v) { return Math.abs(v - oy) < 0.5; })) {
        lines.push({ x1: Math.min(o.x, nb.x) - 12, y1: oy, x2: Math.max(o.x + o.w, nb.x + nb.w) + 12, y2: oy });
      }
    });
  });
  return { dx: dx, dy: dy, lines: lines.slice(0, 8) };
}

function render() {
  renderCanvas();
  renderOrderPanel();
  renderBubble();
  renderPages();
  refreshHistory();
}

/* ================================================================
   12. Selection helpers
   ================================================================ */
/* Grouped things carry the same `group` id and are picked together.
   Double clicking one still types into just that one. */
function withGroup(id) {
  var f = findAny(id), g = f && f.item.group;
  if (!g) return [id];
  return nodes().concat(edges(), texts()).filter(function (it) { return it.group === g; }).map(function (it) { return it.id; });
}
function selectOnly(id) { sel.clear(); if (id) withGroup(id).forEach(function (k) { sel.add(k); }); afterSelect(); }
function selectToggle(id) {
  var on = !sel.has(id);
  withGroup(id).forEach(function (k) { if (on) sel.add(k); else sel.delete(k); });
  afterSelect();
}
/* The groups whose every member is picked, as lists of items. */
function pickedGroups() {
  var seen = {}, out = [];
  selList().forEach(function (f) {
    var g = f.item.group;
    if (!g || seen[g]) return;
    seen[g] = true;
    var members = withGroup(f.item.id);
    if (members.every(function (k) { return sel.has(k); })) out.push(members.map(findAny).filter(Boolean));
  });
  return out;
}
/* One group, and nothing else, is picked. */
function selIsOneGroup() {
  var g = pickedGroups();
  return g.length === 1 && g[0].length === sel.size;
}
function groupSelected() {
  var list = selList();
  if (list.length < 2) { toast("Pick two or more things to group"); return; }
  var g = uid("g");
  list.forEach(function (f) { f.item.group = g; });
  commit(); render();
  toast("Grouped " + list.length + " items  (" + MOD + "+Shift+G ungroups)");
}
function ungroupSelected() {
  var any = false;
  selList().forEach(function (f) { if (f.item.group) { delete f.item.group; any = true; } });
  if (!any) { toast("Nothing grouped here"); return; }
  commit(); render();
  toast("Ungrouped");
}
function clearSel() { sel.clear(); afterSelect(); }
function selectAll() {
  sel = new Set(nodes().map(function (n) { return n.id; })
    .concat(edges().map(function (e) { return e.id; }))
    .concat(texts().map(function (t) { return t.id; })));
  afterSelect();
}
function afterSelect() { drawOverlay(); renderBubble(); markPickedSteps(); }

