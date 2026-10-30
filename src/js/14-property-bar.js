/* ================================================================
   19. Floating property bar
   ================================================================ */
/* Shapes are the boxes, diamonds, ellipses, pills, notes and tables:
   the things with a fill, an outline and a title. */
function isShape(node) { return node.type !== "image" && node.type !== "ink" && node.type !== "code"; }
function selectedShapes() { return selNodes().filter(isShape); }
/* Wraps a patch so it only lands on selected shapes. */
function onlyShapes(patch) {
  var out = {};
  Object.keys(patch).forEach(function (key) {
    var v = patch[key];
    out[key] = function (it, kind) {
      if (kind !== "node" || !isShape(it)) return undefined;
      return typeof v === "function" ? v(it, kind) : v;
    };
  });
  return out;
}
function allOf(list, test) { return list.length > 0 && list.every(test); }

/* The look of one or many shapes; the controls show the first shape's
   values and change every selected shape. */
function buildShapeLook(shapes) {
  var first = shapes[0];
  bubble.appendChild(toolButton({
    icon: "box", title: "Soft wash", pressed: allOf(shapes, function (n) { return n.style === "wash"; }),
    onClick: function () { patchSelected(onlyShapes({ style: "wash" })); }
  }));
  bubble.appendChild(toolButton({
    icon: "sketch", title: "Inked and hatched", pressed: allOf(shapes, function (n) { return n.style === "sketch"; }),
    onClick: function () { patchSelected(onlyShapes({ style: "sketch" })); }
  }));
  bubble.appendChild(toolButton({
    label: first.filled ? "Filled" : "Outline", title: "Filled or open outline",
    onClick: function () { patchSelected(onlyShapes({ filled: !first.filled })); }
  }));
  [["solid", "solid", "Solid border"], ["dashed", "dashed", "Dashed border"], ["dotted", "dotted", "Dotted border"]].forEach(function (b) {
    bubble.appendChild(toolButton({
      icon: b[1], title: b[2], pressed: allOf(shapes, function (n) { return borderStyle(n) === b[0]; }),
      onClick: function () { patchSelected(onlyShapes({ border: b[0] })); }
    }));
  });
  bubble.appendChild(numberControl(+first.borderW || 2, 0.5, 12, "Outline thickness", function (v) {
    patchSelected(onlyShapes({ borderW: v }));
  }, 0.5));
  bubble.appendChild(divider());

  bubble.appendChild(paletteRow(allOf(shapes, function (n) { return n.fill === first.fill; }) ? first.fill : null, function (preset) {
    patchSelected(onlyShapes({ fill: preset.fill, accent: preset.accent }));
  }));
  bubble.appendChild(colorControl(first.fill, "Fill colour", function (hex) { patchSelected(onlyShapes({ fill: hex })); }));
  bubble.appendChild(colorControl(first.accent, "Ink colour", function (hex) { patchSelected(onlyShapes({ accent: hex })); }));
}
function shapeTypeControl(shapes) {
  bubble.appendChild(selectControl([
    ["box", "Box"], ["diamond", "Diamond"], ["ellipse", "Ellipse"], ["pill", "Pill"], ["note", "Note"], ["database", "Database"]
  ], shapes[0].type, "Shape", function (v) {
    patchSelected(onlyShapes({ type: function (it) { return it.type === "table" ? undefined : v; } }));
  }));
}
/* Font controls for anything with words: shape titles, text items and
   arrow labels each keep their size and colour in their own fields. */
function textFields(it) {
  if (it.text !== undefined && it.anchor !== undefined) return { size: "size", color: "color", base: 15 };
  if (it.from !== undefined) return { size: "labelSize", color: "labelColor", base: 9.5 };
  return { size: "titleSize", color: "titleColor", base: 11.5 };
}
function buildTextLook(items) {
  var first = items[0], ff = textFields(first);
  var targets = new Set(items);
  bubble.appendChild(formatToggles(function () { return items; }));
  bubble.appendChild(numberControl(first[ff.size] || ff.base, 5, 96, items.length > 1 ? "Text size (all selected)" : "Text size",
    function (v) {
      patchSelected({
        titleSize: function (it) { return targets.has(it) && textFields(it).size === "titleSize" ? v : undefined; },
        size: function (it) { return targets.has(it) && textFields(it).size === "size" ? v : undefined; },
        labelSize: function (it) { return targets.has(it) && textFields(it).size === "labelSize" ? v : undefined; }
      });
    }, 0.5));
  bubble.appendChild(colorControl(first[ff.color] || first.color || INK, "Text colour", function (hex) {
    patchSelected({
      titleColor: function (it) { return targets.has(it) && textFields(it).color === "titleColor" ? hex : undefined; },
      color: function (it) { return targets.has(it) && textFields(it).color === "color" ? hex : undefined; },
      labelColor: function (it) { return targets.has(it) && textFields(it).color === "labelColor" ? hex : undefined; }
    });
  }));
}

function buildNodeBubble(node) {
  if (node.type === "table") { buildTableBubble(node); return; }
  buildShapeLook([node]);
  bubble.appendChild(divider());
  shapeTypeControl([node]);
  bubble.appendChild(divider());
  buildTextLook([node]);
}
/* A table's bar puts what tables need first: the Table menu, the picked
   cells' colours, alignment and text, and only then the general look.
   Rows, columns, moves, even columns and the header row all live in the
   Table menu, so the bar stays a sensible length. */
function buildTableBubble(node) {
  var cur = currentCell();
  bubble.appendChild(tableMenuButton(node, cur));
  if (cur) {
    /* Show a colour only when every picked cell shares it. */
    var shades = [];
    eachPickedCell(cur, function (r, c) { shades.push(cur.node.fills[r][c]); });
    var now = shades.every(function (f) { return f === shades[0]; }) ? shades[0] : null;
    var many = shades.length > 1, oneRegion = pickIsOneRegion(cur);
    bubble.appendChild(divider());
    bubble.appendChild(htmlEl("span", null, oneRegion ? "Merged cell" : many ? shades.length + " cells" : "Cell"));
    bubble.appendChild(colorControl(now || node.fill, many ? "Any colour for these cells" : "Any colour for this cell", setCellFill));
    bubble.appendChild(toolButton({
      label: "Clear", title: many ? "Take the colour off these cells" : "Take the colour off this cell",
      disabled: !shades.some(Boolean),
      onClick: function () { setCellFill(null); }
    }));
    /* the text colour of the picked cells, apart from the table's */
    var inks = [];
    eachPickedCell(cur, function (r, c) { inks.push(cur.node.inks ? cur.node.inks[r][c] : null); });
    var inkNow = inks.every(function (x) { return x === inks[0]; }) ? inks[0] : null;
    bubble.appendChild(htmlEl("span", "bar-label", "Text"));
    bubble.appendChild(colorControl(inkNow || node.titleColor || INK, many ? "Text colour for these cells" : "Text colour for this cell", setCellInk));
    if (inks.some(Boolean)) {
      bubble.appendChild(toolButton({ icon: "trash", title: "Back to the table's text colour", onClick: function () { setCellInk(null); } }));
    }
    if (many && !oneRegion) {
      bubble.appendChild(toolButton({ icon: "merge", label: "Merge", title: "Merge these cells into one", onClick: mergePicked }));
    }
    if (pickedMerges(cur).length) {
      bubble.appendChild(toolButton({ icon: "unmerge", label: "Unmerge", title: "Split merged cells back apart", onClick: unmergePicked }));
    }
  }
  bubble.appendChild(divider());
  bubble.appendChild(alignButton(node));
  bubble.appendChild(wrapButton(node));
  bubble.appendChild(divider());
  if (cur) buildCellTextLook(cur); else buildTextLook([node]);
  bubble.appendChild(divider());
  buildShapeLook([node]);
}
function tableMenuButton(node, cur) {
  function span(a, b, one, many) { return a === b ? one + " " + (a + 1) : many + " " + (a + 1) + "–" + (b + 1); }
  var rows = node.cells.length, cols = node.cells[0].length;
  return toolButton({
    icon: "table", label: "Table", title: "Rows, columns, moving them, and the header row",
    onClick: function (e, b) {
      var rc = b.getBoundingClientRect(), items = [{ header: "Rows" }];
      if (cur) items.push(
        { label: "Insert row above", icon: "rowAdd", run: function () { editTables("rowAbove"); } },
        { label: "Insert row below", icon: "rowAdd", run: function () { editTables("rowBelow"); } });
      items.push({ label: "Add a row at the end", icon: cur ? null : "rowAdd", run: function () { editTables("addRow"); } });
      items.push({ label: cur ? span(cur.r0, cur.r1, "Delete row", "Delete rows") : "Remove the last row", icon: "rowDel", danger: true,
                   disabled: rows < 2, run: function () { editTables("dropRow"); } });
      items.push({ header: "Columns" });
      if (cur) items.push(
        { label: "Insert column left", icon: "colAdd", run: function () { editTables("colLeft"); } },
        { label: "Insert column right", icon: "colAdd", run: function () { editTables("colRight"); } });
      items.push({ label: "Add a column at the end", icon: cur ? null : "colAdd", run: function () { editTables("addCol"); } });
      items.push({ label: cur ? span(cur.c0, cur.c1, "Delete column", "Delete columns") : "Remove the last column", icon: "colDel", danger: true,
                   disabled: cols < 2, run: function () { editTables("dropCol"); } });
      if (cur) items.push("-",
        { label: "Move column left", icon: "left", key: "Alt+←", disabled: cur.c0 === 0, run: function () { moveTablePick("c", -1); } },
        { label: "Move column right", icon: "right", key: "Alt+→", disabled: cur.c1 === cols - 1, run: function () { moveTablePick("c", 1); } },
        { label: "Move row up", icon: "up", key: "Alt+↑", disabled: cur.r0 === 0, run: function () { moveTablePick("r", -1); } },
        { label: "Move row down", icon: "down", key: "Alt+↓", disabled: cur.r1 === rows - 1, run: function () { moveTablePick("r", 1); } });
      items.push("-",
        { label: "Even columns", disabled: evenColumns(node), run: function () { editTables("evenCols"); } },
        { label: "Header row", on: !!node.header, run: function () { patchSelected({ header: function (it) { return it.type === "table" ? !it.header : undefined; } }); } });
      openMenuAt(rc.left, rc.bottom + 6, items);
    }
  });
}
/* Moves rows (axis "r") or columns ("c") from..fromEnd so they sit
   before index `to` (in today's numbering; the count means the end).
   Everything a row or column carries moves with it: text, fills, text
   colours, alignment, cell formats, widths or heights, and arrows tied
   to rows. A merged region across several of them must stay in one
   piece, so a move that would split one is refused. Returns the map
   from old index to new, or null. */
function reorderTable(n, axis, from, fromEnd, to) {
  if (!n.aligns || !n.inks || !n.fmts) syncFills(n);
  var count = axis === "r" ? n.cells.length : n.cells[0].length;
  if (to >= from && to <= fromEnd + 1) return null;
  var block = [], rest = [];
  for (var i = 0; i < count; i++) (i >= from && i <= fromEnd ? block : rest).push(i);
  var at = to > fromEnd ? to - block.length : to;
  var order = rest.slice(0, at).concat(block, rest.slice(at));   /* order[new] = old */
  var where = [];
  order.forEach(function (old, now) { where[old] = now; });
  var merges = tableMerges(n), moved = [];
  for (var m = 0; m < merges.length; m++) {
    var mg = merges[m], start = axis === "r" ? mg.r : mg.c, len = axis === "r" ? mg.rs : mg.cs;
    var spots = [];
    for (var j = start; j < start + len; j++) spots.push(where[j]);
    var lo = Math.min.apply(null, spots), hi = Math.max.apply(null, spots);
    if (hi - lo !== len - 1) {
      toast("That would split a merged cell. Unmerge it first.");
      return null;
    }
    moved.push(lo);
  }
  merges.forEach(function (mg, k) { if (axis === "r") mg.r = moved[k]; else mg.c = moved[k]; });
  var grids = [n.cells, n.fills, n.aligns, n.inks, n.fmts];
  if (axis === "r") {
    var hs = rowHeights(n);
    grids.forEach(function (g) { var was = g.slice(); order.forEach(function (old, now) { g[now] = was[old]; }); });
    if (n.rowH) n.rowH = order.map(function (old) { return Math.round(hs[old]); });
    shiftEdgeRows(n.id, function (r) { return where[r]; });
  } else {
    var ws = colWidths(n);
    grids.forEach(function (g) { g.forEach(function (row) { var was = row.slice(); order.forEach(function (old, now) { row[now] = was[old]; }); }); });
    if (n.colW) n.colW = order.map(function (old) { return Math.round(ws[old]); });
  }
  return where;
}
/* Moves the picked rows or columns one step; the pick moves with them. */
function moveTablePick(axis, by) {
  var cur = currentCell();
  if (!cur) return;
  var n = cur.node, count = axis === "r" ? n.cells.length : n.cells[0].length;
  var a = axis === "r" ? cur.r0 : cur.c0, b = axis === "r" ? cur.r1 : cur.c1;
  if ((by < 0 && a === 0) || (by > 0 && b === count - 1)) return;
  var where = reorderTable(n, axis, a, b, by < 0 ? a - 1 : b + 2);
  if (!where) return;
  if (axis === "r") { activeCell.r = where[activeCell.r]; activeCell.r2 = where[activeCell.r2]; }
  else { activeCell.c = where[activeCell.c]; activeCell.c2 = where[activeCell.c2]; }
  commit(); render();
}
/* Copying and pasting cells, the way a spreadsheet does. Copied cells go
   on the clipboard as tab-separated rows, so they paste into Sheets or
   Excel too. Pasting one value fills every picked cell with it; pasting
   rows and columns from a spreadsheet (text with tabs) lays them out
   from the pick's top-left corner instead. */
function copyCells(cut) {
  var cur = currentCell();
  if (!cur) return;
  var n = cur.node, rows = [];
  for (var r = cur.r0; r <= cur.r1; r++) {
    var row = [];
    for (var c = cur.c0; c <= cur.c1; c++) row.push(isCovered(n, r, c) ? "" : String(n.cells[r][c] || "").replace(/[\t\n]/g, " "));
    rows.push(row.join("\t"));
  }
  var text = rows.join("\n"), count = (cur.r1 - cur.r0 + 1) * (cur.c1 - cur.c0 + 1);
  try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {}); } catch (err) { /* not allowed here */ }
  if (cut) {
    eachPickedCell(cur, function (r, c) { n.cells[r][c] = ""; });
    commit(); render();
  }
  toast((cut ? "Cut " : "Copied ") + count + (count === 1 ? " cell" : " cells") +
        (cut ? "" : ". Ctrl+D duplicates the table itself."));
}
function pasteIntoCells(text) {
  var cur = currentCell();
  if (!cur) return;
  var n = cur.node, rows = n.cells.length, cols = n.cells[0].length, filled = 0;
  text = String(text).replace(/\r\n?/g, "\n");
  if (text.indexOf("\t") >= 0) {
    text.replace(/\n$/, "").split("\n").forEach(function (line, i) {
      line.split("\t").forEach(function (value, j) {
        var r = cur.r0 + i, c = cur.c0 + j;
        if (r < rows && c < cols && !isCovered(n, r, c)) { n.cells[r][c] = value; filled++; }
      });
    });
  } else {
    var value = text.replace(/\n$/, "");
    eachPickedCell(cur, function (r, c) { if (!isCovered(n, r, c)) { n.cells[r][c] = value; filled++; } });
  }
  if (!filled) return;
  commit(); render();
  toast("Pasted into " + filled + (filled === 1 ? " cell" : " cells"));
}

/* Ctrl+B, I or U with cells picked press the cell button in the bar. */
function cellShortcut(k) {
  if (!currentCell()) return false;
  var label = { b: "Bold", i: "Italic", u: "Underline" }[k];
  var b = [].filter.call(bubble.querySelectorAll("button[aria-label]"), function (el) { return el.getAttribute("aria-label").indexOf(label + " for th") === 0; })[0];
  if (!b) return false;
  b.click();
  return true;
}
/* With cells picked, the font controls format just those cells: each
   button shows on when every picked cell is set that way, and pressing
   it sets them all one way. Cells keep the table's own setting until
   they are given one. */
function buildCellTextLook(cur) {
  var n = cur.node, cells = [];
  eachPickedCell(cur, function (r, c) { if (!isCovered(n, r, c)) cells.push({ r: r, c: c, f: cellFormat(n, r, c) }); });
  function setCells(change) {
    if (!n.fmts) syncFills(n);
    cells.forEach(function (cell) {
      var own = Object.assign({}, n.fmts[cell.r][cell.c] || {});
      change(own);
      n.fmts[cell.r][cell.c] = Object.keys(own).length ? own : null;
    });
    commit(); render();
  }
  var wrap = htmlEl("span");
  wrap.style.cssText = "display:flex;gap:2px";
  [["b", "bold", "B", "fmt-b", "Bold"], ["i", "italic", "I", "fmt-i", "Italic"],
   ["u", "underline", "U", "fmt-u", "Underline"], ["s", "strike", "S", "fmt-s", "Strikethrough"]].forEach(function (k) {
    var on = cells.every(function (cell) { return !!cell.f[k[1]]; });
    wrap.appendChild(toolButton({
      label: k[2], labelClass: k[3], title: k[4] + (cells.length > 1 ? " for these cells" : " for this cell"), pressed: on,
      onClick: function () { setCells(function (own) { own[k[0]] = !on; }); }
    }));
  });
  bubble.appendChild(wrap);
  var sizes = cells.map(function (cell) { return cell.f.size; });
  bubble.appendChild(numberControl(sizes[0], 5, 96, cells.length > 1 ? "Text size for these cells" : "Text size for this cell", function (v) {
    setCells(function (own) { if (v === (n.titleSize || 11.5)) delete own.size; else own.size = v; });
  }, 0.5));
  bubble.appendChild(toolButton({
    label: "Table text", title: "Format the whole table's text instead (pick no cell, or drag a box round the table)",
    onClick: function () { activeCell = null; afterSelect(); }
  }));
}
/* The open arrowhead's length in px (5 by default); it spreads in
   proportion and keeps the line's own thickness. */
function arrowheadPath(edge) {
  var len = clamp(+edge.headLen || 5, 2, 30), half = Math.round(len * 8) / 10;
  return "M" + (-len) + "," + (-half) + " L0,0 L" + (-len) + "," + half;
}
function headSizeControl(list) {
  bubble.appendChild(numberControl(+list[0].headLen || 5, 2, 30, "Arrowhead size", function (v) {
    patchSelected({ headLen: function (it, kind) { return kind === "edge" ? v : undefined; } });
  }, 1));
}
function flowControls(list) {
  var on = list.length > 0 && list.every(function (e) { return e.flow; });
  bubble.appendChild(toolButton({
    icon: "flow", label: "Flow", pressed: on, title: on ? "Stop the balls flowing" : "Send balls flowing along to the shape it points at",
    onClick: function () { patchSelected({ flow: function (it, kind) { return kind === "edge" ? !on : undefined; } }); }
  }));
  if (on) {
    bubble.appendChild(selectControl(FLOW_STYLES, FLOW_GAPS[list[0].flowStyle] ? list[0].flowStyle : "ink", "Flow style",
      function (v) { patchSelected({ flowStyle: function (it, kind) { return kind === "edge" ? v : undefined; } }); }));
    bubble.appendChild(selectControl([["0.5", "Slow"], ["1", "Normal"], ["2", "Fast"]], String(list[0].flowSpeed || 1), "Flow speed",
      function (v) { patchSelected({ flowSpeed: function (it, kind) { return kind === "edge" ? +v : undefined; } }); }));
  }
}
function buildEdgeBubble(edge) {
  [["curve", "routeCurve", "Curved"], ["elbow", "routeElbow", "Right angles"], ["straight", "routeStraight", "Straight"]]
    .forEach(function (r) {
      bubble.appendChild(toolButton({
        icon: r[1], title: r[2], pressed: edge.shape === r[0],
        onClick: function () { patchSelected({ shape: r[0] }); }
      }));
    });
  bubble.appendChild(divider());

  bubble.appendChild(toolButton({
    icon: edge.dashed ? "dashed" : "solid", title: "Solid or dashed",
    onClick: function () { patchSelected({ dashed: function (it) { return !it.dashed; } }); }
  }));
  bubble.appendChild(colorControl(edge.color || LINE, "Line colour", function (hex) { patchSelected({ color: hex }); }));
  bubble.appendChild(numberControl(edge.weight || 1.6, 0.5, 8, "Line width",
    function (v) { patchSelected({ weight: v }); }, 0.1));

  if (edge.shape === "curve") {
    bubble.appendChild(numberControl(Math.round(edge.pull || 60), 0, 400, "How far it bows",
      function (v) { patchSelected({ pull: v, o1: undefined, o2: undefined }); }));
    bubble.appendChild(toolButton({
      label: "Reset bend", title: "Put the curve back to its default",
      onClick: function () {
        selList().filter(function (f) { return f.kind === "edge"; }).forEach(function (f) {
          delete f.item.o1; delete f.item.o2; delete f.item.pull;
        });
        commit(); render();
      }
    }));
  } else if (edge.shape === "elbow") {
    bubble.appendChild(numberControl(edge.detour || 0, -600, 600, "Detour",
      function (v) { patchSelected({ detour: v }); }));
  }
  bubble.appendChild(divider());

  /* a loose end has no side to choose */
  if (edge.from) {
    bubble.appendChild(selectControl(SIDES.concat(["auto"]).map(function (s) { return [s, s]; }),
      edge.fromSide || "auto", "Leaves from", function (v) { patchSelected({ fromSide: v }); }));
  }
  if (edge.to) {
    bubble.appendChild(selectControl(SIDES.concat(["auto"]).map(function (s) { return [s, s]; }),
      edge.toSide || "auto", "Arrives at", function (v) { patchSelected({ toSide: v }); }));
  }
  /* an end on a table can be tied to one of its rows */
  [["from", "fromRow", "fromSide", "From row"], ["to", "toRow", "toSide", "To row"]].forEach(function (end) {
    var table = findNode(edge[end[0]]);
    if (!table || table.type !== "table") return;
    var options = [["", "Whole side"]].concat(table.cells.map(function (row, r) {
      var words = row.filter(Boolean)[0];
      return [String(r), "Row " + (r + 1) + (words ? ": " + plainText(words).split("\n")[0].slice(0, 18) : "")];
    }));
    var now = edgeRow(table, edge[end[1]]);
    bubble.appendChild(selectControl(options, now == null ? "" : String(now), end[3], function (v) {
      var patch = {};
      patch[end[1]] = v === "" ? null : +v;
      /* a row sits on the left or right, so a top or bottom side goes back to auto */
      patch[end[2]] = function (it) { return v !== "" && (it[end[2]] === "top" || it[end[2]] === "bottom") ? "auto" : undefined; };
      patchSelected(patch);
    }));
  });
  headSizeControl([edge]);
  flowControls([edge]);
  bubble.appendChild(toolButton({
    label: "Flip", title: "Turn the arrow around",
    onClick: function () {
      selList().filter(function (f) { return f.kind === "edge"; }).forEach(function (f) {
        var e = f.item;
        var a = e.from, as = e.fromSide, ar = e.fromRow, ap = e.p1;
        e.from = e.to; e.fromSide = e.toSide; e.fromRow = e.toRow; e.p1 = e.p2;
        e.to = a; e.toSide = as; e.toRow = ar; e.p2 = ap;
        ["fromRow", "toRow", "p1", "p2"].forEach(function (key) { if (e[key] == null) delete e[key]; });
        delete e.o1; delete e.o2;
      });
      commit(); render();
    }
  }));
  bubble.appendChild(divider());

  if (edge.label) {
    bubble.appendChild(toolButton({
      icon: edge.onPath ? "labelPath" : "labelFlat",
      title: edge.onPath ? "Label rides the line" : "Label sits flat",
      onClick: function () { patchSelected({ onPath: function (it) { return !it.onPath; } }); }
    }));
    bubble.appendChild(numberControl(edge.labelSize || 9.5, 5, 40, "Label size",
      function (v) { patchSelected({ labelSize: v }); }, 0.5));
  } else {
    bubble.appendChild(toolButton({
      label: "Add label", title: "Put a word on this arrow",
      onClick: function () { openEditor(edge.id, "label"); }
    }));
  }
}
/* Where a wrapping text item's column sits, from its anchor point. */
function textColumn(item) {
  var w = item.w, x = item.anchor === "middle" ? item.x - w / 2 : item.anchor === "end" ? item.x - w : item.x;
  return { x: x, w: w };
}
function buildTextBubble(item) {
  bubble.appendChild(numberControl(item.size, 6, 96, "Font size",
    function (v) { patchSelected({ size: v }); }, 0.5));
  bubble.appendChild(colorControl(item.color, "Text colour", function (hex) { patchSelected({ color: hex }); }));
  bubble.appendChild(divider());
  bubble.appendChild(formatToggles(function () {
    return selList().filter(function (f) { return f.kind === "text"; }).map(function (f) { return f.item; });
  }));
  bubble.appendChild(divider());
  [["start", "alignLeft", "Left"], ["middle", "alignCenter", "Centre"], ["end", "alignRight", "Right"]]
    .forEach(function (a) {
      bubble.appendChild(toolButton({
        icon: a[1], title: a[2], pressed: item.anchor === a[0],
        onClick: function () { patchSelected({ anchor: a[0] }); }
      }));
    });
  bubble.appendChild(divider());
  /* Wrap gives the text a column to flow in; the handle on the right of
     the selection sets how wide it is. */
  bubble.appendChild(toolButton({
    icon: "wrap", label: "Wrap", pressed: item.w > 0,
    title: item.w > 0 ? "Stop wrapping: lines run as long as they are typed" : "Wrap into a column; drag the handle on the right to set its width",
    onClick: function () {
      patchSelected({ w: function (it, kind) {
        if (kind !== "text") return undefined;
        if (it.w > 0) return 0;
        var box = textBounds[it.id];
        return Math.round(clamp(box ? box.width : 320, 160, 420));
      } });
    }
  }));
}

/* Several things selected: the same look and font controls as a single
   shape, applied to everything they fit, with alignment folded into one
   menu so the bar stays a sensible length. */
function buildMultiBubble() {
  var oneGroup = selIsOneGroup();
  bubble.appendChild(htmlEl("span", null, oneGroup ? "Group of " + sel.size : sel.size + " selected"));
  bubble.appendChild(toolButton(oneGroup
    ? { icon: "ungroup", label: "Ungroup", title: "Ungroup  (" + MOD + "+Shift+G)", onClick: ungroupSelected }
    : { icon: "group", label: "Group", title: "Group these so they pick and move as one  (" + MOD + "+G)", onClick: groupSelected }));
  bubble.appendChild(divider());
  var align = toolButton({
    icon: "alnL", label: "Align", title: "Line up or spread out the selection",
    onClick: function (e, b) {
      var rc = b.getBoundingClientRect();
      openMenuAt(rc.left, rc.bottom + 6, [
        { label: "Align left", icon: "alnL", run: function () { alignSelected("left"); } },
        { label: "Centre across", icon: "alnCH", run: function () { alignSelected("hcenter"); } },
        { label: "Align right", icon: "alnR", run: function () { alignSelected("right"); } },
        "-",
        { label: "Align top", icon: "alnT", run: function () { alignSelected("top"); } },
        { label: "Centre down", icon: "alnCV", run: function () { alignSelected("vcenter"); } },
        { label: "Align bottom", icon: "alnB", run: function () { alignSelected("bottom"); } },
        "-",
        { label: "Spread across", icon: "distH", run: function () { distributeSelected("h"); } },
        { label: "Spread down", icon: "distV", run: function () { distributeSelected("v"); } }
      ]);
    }
  });
  bubble.appendChild(align);
  bubble.appendChild(divider());

  var shapes = selectedShapes();
  if (shapes.length) {
    buildShapeLook(shapes);
    if (shapes.every(function (n) { return n.type !== "table"; })) {
      bubble.appendChild(divider());
      shapeTypeControl(shapes);
    }
  } else {
    bubble.appendChild(paletteRow(null, function (preset) {
      patchSelected({
        accent: function (it, kind) { return kind === "node" ? preset.accent : undefined; },
        color: function (it, kind) { return kind === "edge" ? preset.accent : undefined; }
      });
    }));
  }
  var arrows = selList().filter(function (f) { return f.kind === "edge"; }).map(function (f) { return f.item; });
  if (arrows.length) { bubble.appendChild(divider()); headSizeControl(arrows); flowControls(arrows); }
  var worded = selList().filter(function (f) {
    return f.kind === "text" || f.kind === "edge" || (f.kind === "node" && isShape(f.item));
  }).map(function (f) { return f.item; });
  if (worded.length) {
    bubble.appendChild(divider());
    buildTextLook(worded);
  }
}

function placeBubble() {
  var box = selectionBox();
  if (!box || bubble.hidden) return;
  var sheetWidth = sheet.getBoundingClientRect().width;
  var rect = bubble.getBoundingClientRect();
  var top = toScreen(box.x + box.w / 2, box.y);
  var bottom = toScreen(box.x + box.w / 2, box.y + box.h);

  bubble.style.maxWidth = Math.max(240, sheetWidth - 16) + "px";
  rect = bubble.getBoundingClientRect();
  var left = clamp(top.x - rect.width / 2, 8, Math.max(8, sheetWidth - rect.width - 8));
  var y = top.y - rect.height - 14;
  if (y < 8) y = bottom.y + 14;
  bubble.style.left = left + "px";
  bubble.style.top = y + "px";
}
function buildImageBubble(node) {
  bubble.appendChild(toolButton({
    label: "Frame", title: "Draw a hand-ruled border around it", pressed: !!node.frame,
    onClick: function () { patchSelected({ frame: function (it) { return it.type === "image" ? !it.frame : undefined; } }); }
  }));
  if (node.frame) {
    bubble.appendChild(colorControl(node.accent, "Frame colour", function (hex) { patchSelected({ accent: hex }); }));
  }
  bubble.appendChild(toolButton({
    label: "Sketchy", title: "Give the picture a hand-drawn wobble", pressed: !!node.wobble,
    onClick: function () { patchSelected({ wobble: function (it) { return it.type === "image" ? !it.wobble : undefined; } }); }
  }));
  bubble.appendChild(divider());
  bubble.appendChild(toolButton({
    label: "Natural shape", title: "Undo any stretching  (Shift while resizing stretches)",
    disabled: !node.natW || Math.abs(node.h - node.w * node.natH / node.natW) < 1,
    onClick: function () { patchSelected({ h: function (it) { return it.type === "image" && it.natW ? Math.round(it.w * it.natH / it.natW) : undefined; } }); }
  }));
  bubble.appendChild(toolButton({
    icon: "image", label: "Replace", title: "Swap in a different picture",
    onClick: function () { openImagePicker(null, node.id); }
  }));
}

/* Rebuilding the bar replaces its controls, so the one being used (a
   number box stepped with the arrow keys, say) gets its focus back. */
function renderBubble() {
  var active = document.activeElement, keep = active && bubble.contains(active) ? active.getAttribute("aria-label") : null;
  buildBubble();
  if (!keep) return;
  var again = [].filter.call(bubble.querySelectorAll("[aria-label]"), function (el) { return el.getAttribute("aria-label") === keep; })[0];
  if (again) again.focus();
}
/* A press anywhere else applies a half-typed number first, while the
   thing it belongs to is still selected. */
document.addEventListener("pointerdown", function (e) {
  var a = document.activeElement;
  if (a && a.classList && a.classList.contains("num") && a !== e.target) a.blur();
}, true);
function buildBubble() {
  clear(bubble);
  var list = selList();
  if (tool === "pen" && !list.length && !editing && !drag) { bubble.hidden = false; buildPenBar(); return; }
  if (!list.length || editing || (drag && drag.type !== "connect")) { bubble.hidden = true; return; }
  bubble.hidden = false;

  if (list.length > 1) {
    buildMultiBubble();
  } else {
    var found = list[0];
    if (found.kind === "node" && found.item.type === "image") buildImageBubble(found.item);
    else if (found.kind === "node" && found.item.type === "ink") buildInkBubble(found.item);
    else if (found.kind === "node" && found.item.type === "code") buildCodeBubble(found.item);
    else if (found.kind === "node") buildNodeBubble(found.item);
    else if (found.kind === "edge") buildEdgeBubble(found.item);
    else buildTextBubble(found.item);
  }

  bubble.appendChild(divider());
  bubble.appendChild(brushButton());
  bubble.appendChild(toolButton({ icon: "front", title: "Bring to front", onClick: function () { reorder("front"); } }));
  bubble.appendChild(toolButton({ icon: "back", title: "Send to back", onClick: function () { reorder("back"); } }));
  bubble.appendChild(toolButton({ icon: "copy", title: "Duplicate", onClick: duplicateSelected }));
  bubble.appendChild(toolButton({ icon: "trash", title: "Delete", danger: true, onClick: deleteSelected }));
  placeBubble();
}

