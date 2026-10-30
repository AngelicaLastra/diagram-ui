/* ================================================================
   9. Geometry
   ================================================================ */
function center(node) { return { x: node.x + node.w / 2, y: node.y + node.h / 2 }; }

function cornersFor(node) {
  var mid = center(node), pts = [], i, a;

  if (node.type === "diamond") {
    return [
      { x: mid.x, y: node.y },
      { x: node.x + node.w, y: mid.y },
      { x: mid.x, y: node.y + node.h },
      { x: node.x, y: mid.y }
    ];
  }
  if (node.type === "ellipse") {
    for (i = 0; i < 18; i++) {
      a = -Math.PI / 2 + (i * 2 * Math.PI) / 18;
      pts.push({ x: mid.x + Math.cos(a) * node.w / 2, y: mid.y + Math.sin(a) * node.h / 2 });
    }
    return pts;
  }
  if (node.type === "pill") {
    var r = Math.min(node.w, node.h) / 2;
    var cl = { x: node.x + r, y: mid.y }, cr = { x: node.x + node.w - r, y: mid.y };
    for (i = 0; i <= 5; i++) { a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push({ x: cr.x + Math.cos(a) * r, y: cr.y + Math.sin(a) * r }); }
    for (i = 0; i <= 5; i++) { a = Math.PI / 2 + (i * Math.PI) / 5; pts.push({ x: cl.x + Math.cos(a) * r, y: cl.y + Math.sin(a) * r }); }
    return pts;
  }
  if (node.type === "database") {
    /* a cylinder seen from a little above: the back of the lid, down the
       right side, round the front of the base and up the left side */
    var ry = dbRim(node), rx = node.w / 2;
    for (i = 0; i <= 8; i++) { a = Math.PI + (i * Math.PI) / 8; pts.push({ x: mid.x + Math.cos(a) * rx, y: node.y + ry + Math.sin(a) * ry }); }
    for (i = 0; i <= 8; i++) { a = (i * Math.PI) / 8; pts.push({ x: mid.x + Math.cos(a) * rx, y: node.y + node.h - ry + Math.sin(a) * ry }); }
    return pts;
  }
  if (node.type === "note") {
    var f = Math.min(node.w * 0.22, node.h * 0.3, 22);
    return [
      { x: node.x, y: node.y },
      { x: node.x + node.w - f, y: node.y },
      { x: node.x + node.w, y: node.y + f },
      { x: node.x + node.w, y: node.y + node.h },
      { x: node.x, y: node.y + node.h }
    ];
  }
  return [
    { x: node.x, y: node.y },
    { x: node.x + node.w, y: node.y },
    { x: node.x + node.w, y: node.y + node.h },
    { x: node.x, y: node.y + node.h }
  ];
}
/* Shapes sampled into many points look wrong with one overshoot stroke
   per segment, so those get a traced outline instead. */
function isCurvy(node) { return node.type === "ellipse" || node.type === "pill" || node.type === "database"; }
/* How deep a database's lid and base curve. */
function dbRim(node) { return Math.max(4, Math.min(node.h * 0.14, node.w * 0.16, 14)); }
/* The front edge of a database's lid, the line that makes it a cylinder. */
function dbLidPoints(node) {
  var ry = dbRim(node), rx = node.w / 2, cx = node.x + rx, pts = [];
  for (var i = 0; i <= 8; i++) { var a = Math.PI - (i * Math.PI) / 8; pts.push({ x: cx + Math.cos(a) * rx, y: node.y + ry + Math.sin(a) * ry }); }
  return pts;
}

/* Tables split their box into equal rows and columns. A cell is edited
   through the field name "cell:row:col". */
function blankCells(rows, cols) {
  var out = [];
  for (var r = 0; r < rows; r++) { out.push([]); for (var c = 0; c < cols; c++) out[r].push(""); }
  return out;
}
/* Cell highlights live in a grid shaped like the cells (null means no
   fill), so adding or removing rows keeps every colour on its cell. */
function syncFills(node) {
  var old = Array.isArray(node.fills) ? node.fills : [];
  node.fills = node.cells.map(function (row, r) {
    return row.map(function (_, c) { return (old[r] && old[r][c]) || null; });
  });
  /* Text alignment sits in the same kind of grid: a two letter code,
     across (l, c, r) then down (t, m, b), or null for centred. */
  var was = Array.isArray(node.aligns) ? node.aligns : [];
  node.aligns = node.cells.map(function (row, r) {
    return row.map(function (_, c) { var a = was[r] && was[r][c]; return /^[lcr][tmb]w?$/.test(a || "") ? a : null; });
  });
  /* and so does each cell's own text colour (null: the table's) */
  var inked = Array.isArray(node.inks) ? node.inks : [];
  node.inks = node.cells.map(function (row, r) {
    return row.map(function (_, c) { return parseHex(inked[r] && inked[r][c]) || null; });
  });
  /* and each cell's own bold, italic, underline, strike and size; a
     missing key follows the table */
  var styled = Array.isArray(node.fmts) ? node.fmts : [];
  node.fmts = node.cells.map(function (row, r) {
    return row.map(function (_, c) {
      var f = styled[r] && styled[r][c];
      if (!f || typeof f !== "object") return null;
      var keep = {};
      ["b", "i", "u", "s"].forEach(function (k) { if (typeof f[k] === "boolean") keep[k] = f[k]; });
      if (+f.size > 0) keep.size = clamp(+f.size, 5, 96);
      return Object.keys(keep).length ? keep : null;
    });
  });
}
function cellAlign(node, r, c) {
  var a = node.aligns && node.aligns[r] && node.aligns[r][c];
  return { h: a ? a[0] : "c", v: a ? a[1] : "m", wrap: !!a && a[2] === "w" };
}
function alignCode(al) { return al.h === "c" && al.v === "m" && !al.wrap ? null : al.h + al.v + (al.wrap ? "w" : ""); }

function cellWeight(node, r) { return node.header && r === 0 && node.cells.length > 1 ? 600 : 500; }
/* How a cell's text is set: the table's font, the header weight, and a
   wrap width when wrapping is on. */
function cellFormat(node, r, c, base) {
  var f = Object.assign({
    size: node.titleSize || 11.5, bold: node.bold, italic: node.italic,
    strike: node.strike, underline: node.underline
  }, base || {});
  var own = node.fmts && node.fmts[r] && node.fmts[r][c];
  if (own) {
    if ("b" in own) f.bold = own.b;
    if ("i" in own) f.italic = own.i;
    if ("u" in own) f.underline = own.u;
    if ("s" in own) f.strike = own.s;
    if (own.size) f.size = own.size;
  }
  f.weight = cellWeight(node, r);
  f.wrapWidth = cellAlign(node, r, c).wrap ? Math.max(10, cellBox(node, r, c).w - CELL_PAD * 2) : null;
  return f;
}
function cellLineCount(node, r, c, text) {
  return richLines(text == null ? node.cells[r][c] : text, cellFormat(node, r, c)).length;
}
/* Grows each row to fit its wrapped cells, and lets it shrink back to the
   table's usual row height (rowBase) when the text gets shorter. Runs
   before every saved change, so rows follow edits, column resizes and
   font sizes. Cells merged across rows keep the height they have. */
function fitTableRows(n) {
  if (n.type !== "table" || !n.cells) return;
  var wraps = n.aligns && n.aligns.some(function (row) { return row.some(function (a) { return a && a[2] === "w"; }); });
  if (!wraps && !n.rowH) return;
  var rows = n.cells.length, base = n.rowBase || n.h / rows, size = n.titleSize || 11.5;
  var need = n.cells.map(function () { return base; });
  if (wraps) {
    n.cells.forEach(function (row, r) {
      row.forEach(function (text, c) {
        var m = mergeAt(n, r, c);
        if (!text || isCovered(n, r, c) || (m && m.rs > 1) || !cellAlign(n, r, c).wrap) return;
        var lines = cellLineCount(n, r, c), own = cellFormat(n, r, c).size;
        need[r] = Math.max(need[r], Math.ceil(lines * own * 1.25 + CELL_PAD * 2));
      });
    });
  }
  if (need.every(function (h) { return h === base; })) {
    delete n.rowH; delete n.rowBase;
    n.h = Math.round(base * rows);
    return;
  }
  n.rowBase = base;
  n.rowH = need;
  n.h = need.reduce(function (a, b) { return a + b; }, 0);
}
function fitAllTables() { nodes().forEach(function (n) { fitTableRows(n); fitCode(n); fitShapeText(n); }); }
/* Where a cell's text sits. Several lines stay a block, so top and bottom
   move the whole block rather than its middle line. */
var CELL_PAD = 6;
function cellTextSpot(node, r, c, lines, size) {
  var box = cellBox(node, r, c), al = cellAlign(node, r, c);
  var block = (lines - 1) * size * 1.25 / 2;
  var x = al.h === "l" ? box.x + CELL_PAD : al.h === "r" ? box.x + box.w - CELL_PAD : box.x + box.w / 2;
  var y = al.v === "t" ? box.y + CELL_PAD + size * 0.8 + block
        : al.v === "b" ? box.y + box.h - CELL_PAD - size * 0.25 - block
        : box.y + box.h / 2 + size * 0.35;
  return { x: x, y: y, anchor: al.h === "l" ? "start" : al.h === "r" ? "end" : "middle", box: box, align: al };
}
function tableSize(node) {
  var rows = node.cells.length, cols = node.cells[0].length;
  return { rows: rows, cols: cols, ch: node.h / rows };
}
/* Column widths are kept as weights (colW), so resizing the whole table
   scales every column, while dragging one column line changes just that
   column. Tables without weights have even columns. */
function colWidths(node) {
  var cols = node.cells[0].length, weights = node.colW;
  var usable = Array.isArray(weights) && weights.length === cols &&
               weights.every(function (v) { return v > 0; });
  if (!usable) weights = node.cells[0].map(function () { return 1; });
  var sum = weights.reduce(function (a, b) { return a + b; }, 0);
  return weights.map(function (v) { return node.w * v / sum; });
}
function colEdges(node) {
  var xs = [node.x];
  colWidths(node).forEach(function (w) { xs.push(xs[xs.length - 1] + w); });
  return xs;
}
/* Merged cells are regions { r, c, rs, cs }: the top-left cell holds the
   text and colour for the whole region, and the cells it covers are
   skipped. Regions never overlap. */
function tableMerges(node) { return Array.isArray(node.merges) ? node.merges : []; }
function mergeAt(node, r, c) {
  return tableMerges(node).filter(function (m) {
    return r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs;
  })[0] || null;
}
function isCovered(node, r, c) {
  var m = mergeAt(node, r, c);
  return !!m && (m.r !== r || m.c !== c);
}
/* Keeps regions inside the table after rows or columns go, and drops
   any that are down to a single cell or overlap one kept earlier. */
function trimMerges(node) {
  var rows = node.cells.length, cols = node.cells[0].length, taken = {};
  node.merges = tableMerges(node).map(function (m) {
    var r = Math.max(0, m.r | 0), c = Math.max(0, m.c | 0);
    return { r: r, c: c, rs: Math.min(m.rs | 0, rows - r), cs: Math.min(m.cs | 0, cols - c) };
  }).filter(function (m) {
    if (m.r >= rows || m.c >= cols || m.rs < 1 || m.cs < 1 || m.rs * m.cs < 2) return false;
    for (var r = m.r; r < m.r + m.rs; r++) for (var c = m.c; c < m.c + m.cs; c++) if (taken[r + ":" + c]) return false;
    for (r = m.r; r < m.r + m.rs; r++) for (c = m.c; c < m.c + m.cs; c++) taken[r + ":" + c] = 1;
    return true;
  });
  if (!node.merges.length) delete node.merges;
}
/* Rows are even unless rowH holds their heights, which happens once
   wrapped text needs a row to grow. They scale with the table like
   column widths do. */
function rowHeights(node) {
  var rows = node.cells.length, hs = node.rowH;
  var usable = Array.isArray(hs) && hs.length === rows && hs.every(function (v) { return v > 0; });
  if (!usable) return node.cells.map(function () { return node.h / rows; });
  var sum = hs.reduce(function (a, b) { return a + b; }, 0);
  return hs.map(function (v) { return node.h * v / sum; });
}
function rowEdges(node) {
  var ys = [node.y];
  rowHeights(node).forEach(function (h) { ys.push(ys[ys.length - 1] + h); });
  return ys;
}
function rowAt(node, y) {
  var ys = rowEdges(node), r = 0;
  while (r < node.cells.length - 1 && y >= ys[r + 1]) r++;
  return r;
}
function rawCellBox(node, r, c) {
  var xs = colEdges(node), ys = rowEdges(node);
  return { x: xs[c], y: ys[r], w: xs[c + 1] - xs[c], h: ys[r + 1] - ys[r] };
}
/* The box a cell shows in: its own, or the whole region it is merged into. */
function cellBox(node, r, c) {
  var m = mergeAt(node, r, c);
  if (!m) return rawCellBox(node, r, c);
  var a = rawCellBox(node, m.r, m.c), b = rawCellBox(node, m.r + m.rs - 1, m.c + m.cs - 1);
  return { x: a.x, y: a.y, w: b.x + b.w - a.x, h: b.y + b.h - a.y };
}
/* The cell under a point; inside a merged region that is its top-left. */
function cellAt(node, point) {
  var t = tableSize(node), xs = colEdges(node), c = 0;
  while (c < t.cols - 1 && point.x >= xs[c + 1]) c++;
  var r = rowAt(node, point.y);
  var m = mergeAt(node, r, c);
  return m ? { r: m.r, c: m.c } : { r: r, c: c };
}
function evenColumns(node) {
  var ws = colWidths(node);
  return ws.every(function (w) { return Math.abs(w - ws[0]) < 0.5; });
}
function cellField(r, c) { return "cell:" + r + ":" + c; }
function parseCell(field) {
  var m = /^cell:(\d+):(\d+)$/.exec(field || "");
  return m ? { r: +m[1], c: +m[2] } : null;
}

/* row: on a table, the left and right sides can anchor at a row's middle */
function anchorPoint(node, side, row) {
  var mid = center(node);
  if (row != null && node.type === "table" && (side === "left" || side === "right")) {
    var ys = rowEdges(node);
    return { x: side === "left" ? node.x : node.x + node.w, y: (ys[row] + ys[row + 1]) / 2 };
  }
  if (side === "top")    return { x: mid.x, y: node.y };
  if (side === "bottom") return { x: mid.x, y: node.y + node.h };
  if (side === "left")   return { x: node.x, y: mid.y };
  return { x: node.x + node.w, y: mid.y };
}
function outward(side) {
  if (side === "top")    return { x: 0, y: -1 };
  if (side === "bottom") return { x: 0, y: 1 };
  if (side === "left")   return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}
function autoSides(from, to) {
  var a = center(from), b = center(to);
  var dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
}
function bezierAt(t, p0, p1, p2, p3) {
  var u = 1 - t;
  return (u * u * u * p0) + (3 * u * u * t * p1) + (3 * u * t * t * p2) + (t * t * t * p3);
}
function pathFrom(p) {
  return "M" + p[0].toFixed(1) + "," + p[1].toFixed(1) +
         " C" + p[2].toFixed(1) + "," + p[3].toFixed(1) +
         " " + p[4].toFixed(1) + "," + p[5].toFixed(1) +
         " " + p[6].toFixed(1) + "," + p[7].toFixed(1);
}
function reversedPath(p) { return pathFrom([p[6], p[7], p[4], p[5], p[2], p[3], p[0], p[1]]); }

function elbowPoints(start, end, fromSide, toSide, detour) {
  var stub = 24;
  var d1 = outward(fromSide), d2 = outward(toSide);
  var a = { x: start.x + d1.x * stub, y: start.y + d1.y * stub };
  var b = { x: end.x + d2.x * stub, y: end.y + d2.y * stub };
  var vertFrom = (fromSide === "top" || fromSide === "bottom");
  var vertTo = (toSide === "top" || toSide === "bottom");
  var points = [start, a];

  if (vertFrom && vertTo) {
    var midY = (a.y + b.y) / 2 + detour;
    points.push({ x: a.x, y: midY }, { x: b.x, y: midY });
  } else if (!vertFrom && !vertTo) {
    var midX = (a.x + b.x) / 2 + detour;
    points.push({ x: midX, y: a.y }, { x: midX, y: b.y });
  } else if (vertFrom) {
    points.push({ x: b.x, y: a.y });
  } else {
    points.push({ x: a.x, y: b.y });
  }
  points.push(b, end);
  return points;
}
function roundedPolyline(points, radius) {
  var clean = [points[0]];
  for (var i = 1; i < points.length; i++) {
    var last = clean[clean.length - 1];
    if (Math.abs(points[i].x - last.x) > 0.5 || Math.abs(points[i].y - last.y) > 0.5) clean.push(points[i]);
  }
  if (clean.length < 3) {
    var tailOnly = clean[clean.length - 1];
    return "M" + clean[0].x.toFixed(1) + "," + clean[0].y.toFixed(1) +
           " L" + tailOnly.x.toFixed(1) + "," + tailOnly.y.toFixed(1);
  }
  var d = "M" + clean[0].x.toFixed(1) + "," + clean[0].y.toFixed(1);
  for (var j = 1; j < clean.length - 1; j++) {
    var prev = clean[j - 1], cur = clean[j], next = clean[j + 1];
    var len1 = Math.sqrt(Math.pow(prev.x - cur.x, 2) + Math.pow(prev.y - cur.y, 2)) || 1;
    var len2 = Math.sqrt(Math.pow(next.x - cur.x, 2) + Math.pow(next.y - cur.y, 2)) || 1;
    var r = Math.min(radius, len1 / 2, len2 / 2);
    d += " L" + (cur.x + ((prev.x - cur.x) / len1) * r).toFixed(1) + "," +
         (cur.y + ((prev.y - cur.y) / len1) * r).toFixed(1) +
         " Q" + cur.x.toFixed(1) + "," + cur.y.toFixed(1) + " " +
         (cur.x + ((next.x - cur.x) / len2) * r).toFixed(1) + "," +
         (cur.y + ((next.y - cur.y) / len2) * r).toFixed(1);
  }
  var tail = clean[clean.length - 1];
  return d + " L" + tail.x.toFixed(1) + "," + tail.y.toFixed(1);
}
function angleBetween(from, to) { return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI; }

/* An arrow end is tied to a shape (from, to) or loose on the sheet at a
   point (p1, p2). A loose end acts as a shape of no size, so the routing
   below works the same; it faces the other end rather than a side. */
function pointBox(p) { return { x: p.x, y: p.y, w: 0, h: 0 }; }
function edgeEnds(edge) {
  var from = edge.from ? findNode(edge.from) : null, to = edge.to ? findNode(edge.to) : null;
  if (edge.from ? !from : !edge.p1) return null;
  if (edge.to ? !to : !edge.p2) return null;
  return { from: from || pointBox(edge.p1), to: to || pointBox(edge.p2), fromFree: !from, toFree: !to };
}
function toward(a, b) {
  var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
function isLooseEdge(edge) { return !edge.from || !edge.to; }
function edgeGeometry(edge) {
  var ends = edgeEnds(edge);
  if (!ends) return null;
  var from = ends.from, to = ends.to;

  var auto = autoSides(from, to);
  var fromRow = edgeRow(from, edge.fromRow), toRow = edgeRow(to, edge.toRow);
  /* an end tied to a row leaves from the left or right, whichever faces
     the other shape, when its side is left on auto */
  var leftOf = center(to).x >= center(from).x;
  var fromSide = (ends.fromFree || !edge.fromSide || edge.fromSide === "auto") ? (fromRow != null ? (leftOf ? "right" : "left") : auto[0]) : edge.fromSide;
  var toSide = (ends.toFree || !edge.toSide || edge.toSide === "auto") ? (toRow != null ? (leftOf ? "left" : "right") : auto[1]) : edge.toSide;

  var start = anchorPoint(from, fromSide, fromRow), end = anchorPoint(to, toSide, toRow);
  var dirStart = ends.fromFree ? toward(start, end) : outward(fromSide);
  var dirEnd = ends.toFree ? toward(end, start) : outward(toSide);
  var span = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

  if (edge.shape === "straight") {
    return {
      d: "M" + start.x.toFixed(1) + "," + start.y.toFixed(1) + " L" + end.x.toFixed(1) + "," + end.y.toFixed(1),
      reversed: "M" + end.x.toFixed(1) + "," + end.y.toFixed(1) + " L" + start.x.toFixed(1) + "," + start.y.toFixed(1),
      tip: { x: end.x, y: end.y, angle: angleBetween(start, end) },
      mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      handles: [], start: start, end: end
    };
  }

  if (edge.shape === "elbow") {
    var points = elbowPoints(start, end, fromSide, toSide, edge.detour || 0);
    var vertFrom = (fromSide === "top" || fromSide === "bottom");
    var vertTo = (toSide === "top" || toSide === "bottom");
    var handles = [];
    if (vertFrom === vertTo) {
      handles.push({
        role: "detour",
        x: (points[2].x + points[3].x) / 2,
        y: (points[2].y + points[3].y) / 2,
        axis: vertFrom ? "y" : "x"
      });
    }
    return {
      d: roundedPolyline(points, 14),
      reversed: roundedPolyline(points.slice().reverse(), 14),
      tip: { x: end.x, y: end.y, angle: angleBetween(points[points.length - 2], points[points.length - 1]) },
      mid: points[Math.floor(points.length / 2)],
      handles: handles, start: start, end: end
    };
  }

  var pull = edge.pull || Math.max(30, span * 0.4);
  var o1 = edge.o1 || { x: dirStart.x * pull, y: dirStart.y * pull };
  var o2 = edge.o2 || { x: dirEnd.x * pull, y: dirEnd.y * pull };
  var p = [start.x, start.y, start.x + o1.x, start.y + o1.y, end.x + o2.x, end.y + o2.y, end.x, end.y];
  var nearX = bezierAt(0.96, p[0], p[2], p[4], p[6]);
  var nearY = bezierAt(0.96, p[1], p[3], p[5], p[7]);

  return {
    d: pathFrom(p),
    reversed: reversedPath(p),
    p: p,
    tip: { x: end.x, y: end.y, angle: Math.atan2(p[7] - nearY, p[6] - nearX) * 180 / Math.PI },
    mid: { x: bezierAt(0.5, p[0], p[2], p[4], p[6]), y: bezierAt(0.5, p[1], p[3], p[5], p[7]) },
    handles: [
      { role: "c1", x: p[2], y: p[3], anchor: start },
      { role: "c2", x: p[4], y: p[5], anchor: end }
    ],
    start: start, end: end
  };
}

