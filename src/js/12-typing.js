/* ================================================================
   17. Typing straight onto the sheet
       A textarea floats over the item. Because the hit targets keep
       their identity between frames, the browser fires a real
       dblclick; the timestamp below only covers pointer devices that
       do not send one.
   ================================================================ */
var editing = null;
var lastTap = { id: null, t: 0 };
var tapOpening = false;

/* A tap on an arrow's bend handle still counts as a tap on the arrow.
   Short arrows put their handles right over the line, so without this a
   double click there would start a bend drag instead of opening the label. */
function idFromTarget(t) {
  var d = t.dataset || {};
  return d.nodeId || d.edgeId || d.textId || d.handleEdge || d.anchorNode || null;
}
function defaultField(id, point) {
  var f = findAny(id);
  if (!f) return null;
  if (f.kind === "node" && f.item.type === "table") {
    var cell = point ? cellAt(f.item, point) : { r: 0, c: 0 };
    return cellField(cell.r, cell.c);
  }
  if (f.kind === "node" && (f.item.type === "image" || f.item.type === "ink")) return null;
  if (f.kind === "node" && f.item.type === "code") return "code";
  return f.kind === "node" ? "title" : f.kind === "text" ? "text" : "label";
}
stage.addEventListener("dblclick", function (event) {
  var id = idFromTarget(event.target);
  if (!id && tool === "select" && blankTarget(event.target) && !editing) {
    event.preventDefault();
    addFreeText(toStage(event));
    return;
  }
  if (!id || tool === "pen" || tool === "paint") return;
  event.preventDefault();
  openEditor(id, defaultField(id, toStage(event)));
});
stage.addEventListener("pointerdown", function (event) {
  /* painting or drawing resets the double-click clock, so the next
     plain click is never read as the second half of one */
  if (tool === "pen" || tool === "paint") { lastTap = { id: null, t: 0 }; return; }
  if (event.button !== 0) return;
  var id = idFromTarget(event.target);
  var now = Date.now();
  var point = toStage(event);
  /* In a table, two quick taps only count as a double tap on the same cell. */
  var spot = id ? id + "/" + defaultField(id, point) : null;
  if (spot && lastTap.id === spot && now - lastTap.t < 520 && !editing) {
    lastTap = { id: null, t: 0 };
    tapOpening = true;
    window.setTimeout(function () { openEditor(id, defaultField(id, point)); }, 0);
  } else {
    lastTap = { id: spot, t: now };
  }
}, true);

function openEditorSoon(id, field, before) { window.setTimeout(function () { openEditor(id, field, before); }, 0); }

function openEditor(id, field, before) {
  var found = findAny(id);
  if (!found) return;
  if (!field) return;
  if (editing && editing.id === id && editing.field === field) return;
  if (editing) closeEditor();
  if (drag) { drag = null; guides = []; marquee = null; ghost = null; }

  sel = new Set([id]);
  tapOpening = false;
  var opening = parseCell(field);
  if (opening) pickCell(id, opening.r, opening.c);
  editing = { id: id, kind: found.kind, field: field, before: before || stateJSON() };

  var cell = parseCell(field);
  var value = cell ? (found.item.cells[cell.r][cell.c] || "")
            : field === "code" ? (found.item.code || "")
            : found.kind === "node" ? (field === "sub" ? (found.item.sub || "") : (found.item.title || ""))
            : found.kind === "text" ? found.item.text
            : (found.item.label || "");

  inlineInput.value = value;
  inlineInput.placeholder = found.kind === "text" ? "Type here" : "";
  inlineInput.hidden = false;
  layoutEditor();
  drawOverlay(); renderBubble();
  /* Focus right away so keys typed straight after a Tab land in the box,
     then again next frame in case a pointerdown takes focus back. */
  inlineInput.focus(); inlineInput.select();
  window.requestAnimationFrame(function () {
    if (editing && document.activeElement !== inlineInput) { inlineInput.focus(); inlineInput.select(); }
  });
  if (field === "code") { setHint("Typing code. Tab indents, Enter starts a new line, Esc or " + MOD + "+Enter finishes."); return; }
  setHint((cell ? "Typing in a cell. Tab moves to the next one, Esc finishes."
    : found.kind === "node" ? "Typing. Tab swaps between the title and the caption, Esc finishes."
    : found.kind === "text" ? "Typing. Enter starts a new line; Esc or a click outside finishes."
    : "Typing. Esc finishes.") + " Select words and press " + MOD + "+B, I, U or E (code) to format just them.");
}

function layoutEditor() {
  if (!editing) return;
  var found = findAny(editing.id);
  if (!found) return closeEditor(true);
  var k = viewScale(), spot;
  var cell = parseCell(editing.field);

  if (cell) {
    var size = cellFormat(found.item, cell.r, cell.c).size;
    var shownLines = cellLineCount(found.item, cell.r, cell.c, inlineInput.value);
    var at = cellTextSpot(found.item, cell.r, cell.c, shownLines, size), cb = at.box;
    spot = {
      x: cb.x + cb.w / 2, y: at.align.v === "m" ? cb.y + cb.h / 2 : at.y - size * 0.35,
      width: Math.max(cb.w - 8, 40), size: size, textAlign: at.align.h === "l" ? "left" : at.align.h === "r" ? "right" : "center",
      lines: shownLines
    };
  } else if (editing.field === "code") {
    var cn = found.item, cm = codeMetrics(cn), codeW = cn.w - cm.pad * 2 - cm.gutter;
    spot = {
      x: cn.x + cm.pad + cm.gutter + codeW / 2, y: cn.y + cm.head + (cn.h - cm.head) / 2,
      width: codeW + 10, size: cm.size, textAlign: "left", mono: true, lines: cm.lines.length, lineHeight: 1.5
    };
  } else if (found.kind === "node") {
    var n = found.item, mid = center(n), tsize = n.titleSize || 11.5;
    var lay = shapeTextLayout(n, { size: tsize, bold: n.bold, italic: n.italic }), sub = editing.field === "sub";
    var esize = sub ? lay.subSize : tsize;
    spot = {
      x: mid.x, y: (sub ? lay.subY : lay.titleY) - esize * 0.35,
      width: lay.room + 10, size: esize,
      lines: richLines(inlineInput.value, { size: esize, bold: !sub && n.bold, wrapWidth: lay.room }).length
    };
  } else if (found.kind === "text") {
    var box = textBounds[editing.id];
    var t = found.item;
    if (t.w > 0) {
      var colm = textColumn(t);
      spot = {
        x: colm.x + colm.w / 2, y: box ? box.y + box.height / 2 : t.y, width: colm.w + 10, size: t.size,
        textAlign: t.anchor === "start" ? "left" : t.anchor === "end" ? "right" : "center",
        lines: richLines(inlineInput.value, { size: t.size, bold: t.bold, italic: t.italic, weight: t.weight || 400, wrapWidth: t.w }).length
      };
    } else {
      var room = Math.max((box ? box.width : 0) + t.size * 2, 160), pad = 9 / k;
      spot = {
        x: t.anchor === "start" ? t.x - pad + room / 2 : t.anchor === "end" ? t.x + pad - room / 2 : t.x,
        y: box ? box.y + box.height / 2 : t.y - t.size * 0.35, width: room, size: t.size,
        textAlign: t.anchor === "start" ? "left" : t.anchor === "end" ? "right" : "center"
      };
    }
  } else {
    var geo = edgeGeometry(found.item);
    if (!geo) return closeEditor(true);
    spot = { x: geo.mid.x, y: geo.mid.y, width: 140, size: found.item.labelSize || 9.5 };
  }

  var place = toScreen(spot.x, spot.y);
  var lines = (spot.lines || inlineInput.value.split("\n").length);
  var fontPx = Math.max(12, spot.size * k);
  inlineInput.style.left = place.x + "px";
  inlineInput.style.top = place.y + "px";
  inlineInput.style.width = Math.max(spot.width * k, 80) + "px";
  inlineInput.style.fontSize = fontPx + "px";
  var lineGap = spot.lineHeight || 1.3;
  inlineInput.style.height = (lines * fontPx * lineGap + 10) + "px";
  inlineInput.style.fontWeight = spot.mono ? 400 : found.item.bold ? 700 : 500;
  inlineInput.style.fontStyle = !spot.mono && found.item.italic ? "italic" : "normal";
  inlineInput.style.textAlign = spot.textAlign || "";
  inlineInput.style.fontFamily = spot.mono ? MONO : "";
  inlineInput.style.color = found.kind === "text" ? (found.item.color || "") : "";
  inlineInput.style.lineHeight = spot.mono ? String(lineGap) : "";
  if (spot.mono) inlineInput.setAttribute("wrap", "off"); else inlineInput.removeAttribute("wrap");

  /* the format strip sits just above the box, inside the sheet; code
     has no word formatting, so it goes without */
  fmtStrip.hidden = !!spot.mono;
  var strip = fmtStrip.getBoundingClientRect(), sheetBox = sheet.getBoundingClientRect();
  var boxH = lines * fontPx * 1.3 + 10;
  fmtStrip.style.left = clamp(place.x - strip.width / 2, 8, sheetBox.width - strip.width - 8) + "px";
  fmtStrip.style.top = Math.max(8, place.y - boxH / 2 - strip.height - 6) + "px";
}

function applyEditor() {
  if (!editing) return;
  var found = findAny(editing.id);
  if (!found) return;
  var value = inlineInput.value;
  var cell = parseCell(editing.field);
  if (cell) {
    found.item.cells[cell.r][cell.c] = value;
    fitTableRows(found.item);   /* the row grows while you type */
  } else if (editing.field === "code") {
    found.item.code = value;
    fitCode(found.item);   /* the card grows while you type */
  } else if (found.kind === "node") {
    if (editing.field === "sub") found.item.sub = value; else found.item.title = value;
    fitShapeText(found.item);
  } else if (found.kind === "text") {
    found.item.text = value;
  } else {
    found.item.label = value;
  }
  renderCanvas();
  layoutEditor();
}
function closeEditor(silent) {
  if (!editing) return;
  var was = editing;
  editing = null;
  inlineInput.hidden = true;
  /* text left empty goes, so it never lingers as an invisible item */
  var left = findAny(was.id);
  if (left && left.kind === "text" && !String(left.item.text || "").trim()) {
    page().texts = texts().filter(function (t) { return t.id !== was.id; });
    sel.delete(was.id);
  }
  fmtStrip.hidden = true;
  inkRow.hidden = true; inkToggle.setAttribute("aria-pressed", "false"); inkSpan = null;
  if (!silent) {
    var now = stateJSON();
    if (now !== was.before) { snapshot = was.before; commit(); }
  }
  render();
  setHint("Double click a shape to type. Drag from an edge dot to draw an arrow.");
}

inlineInput.addEventListener("input", applyEditor);
inlineInput.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
/* Formatting single words while typing: wraps the selection (or the word
   under the caret) in a marker, or takes the marker off if it is
   already there. */
var FORMAT_KEYS = [
  ["**", "B", "fmt-b", "Bold", MOD + "+B"], ["*", "I", "fmt-i", "Italic", MOD + "+I"],
  ["++", "U", "fmt-u", "Underline", MOD + "+U"], ["~~", "S", "fmt-s", "Strikethrough", MOD + "+Shift+X"],
  ["`", "", "", "Inline code", MOD + "+E"]
];
function toggleMarker(mark) {
  var el = inlineInput, v = el.value, a = el.selectionStart, b = el.selectionEnd, L = mark.length;
  if (a === b) {
    while (a > 0 && /\S/.test(v[a - 1])) a--;
    while (b < v.length && /\S/.test(v[b])) b++;
  }
  while (a < b && /\s/.test(v[a])) a++;
  while (b > a && /\s/.test(v[b - 1])) b--;
  var before = v.slice(a - L, a), after = v.slice(b, b + L);
  /* a lone * next to ** belongs to the bold marker, not to italics */
  var boldStar = mark === "*" && v[a - 2] === "*" && v[b + 1] === "*" && v[a - 3] !== "*";
  if (before === mark && after === mark && !boldStar) {
    v = v.slice(0, a - L) + v.slice(a, b) + v.slice(b + L); a -= L; b -= L;
  } else if (b - a > 2 * L && v.slice(a, a + L) === mark && v.slice(b - L, b) === mark) {
    v = v.slice(0, a) + v.slice(a + L, b - L) + v.slice(b); b -= 2 * L;
  } else if (a === b) {
    v = v.slice(0, a) + mark + mark + v.slice(b); a += L; b = a;
  } else {
    v = v.slice(0, a) + mark + v.slice(a, b) + mark + v.slice(b); a += L; b += L;
  }
  el.value = v;
  el.setSelectionRange(a, b);
  applyEditor();
}
var fmtStrip = $("fmtStrip");
FORMAT_KEYS.forEach(function (f) {
  var b = toolButton({ icon: f[0] === "`" ? "code" : null, label: f[1] || null, labelClass: f[2] || null, title: f[3] + "  (" + f[4] + ")" });
  b.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); });
  b.addEventListener("mousedown", function (e) { e.preventDefault(); });
  b.addEventListener("click", function (e) { e.preventDefault(); toggleMarker(f[0]); });
  fmtStrip.appendChild(b);
});

inlineInput.addEventListener("keydown", function (event) {
  event.stopPropagation();
  /* in a code block Tab indents and Enter starts a new line */
  if (editing && editing.field === "code") {
    if (event.key === "Tab") {
      event.preventDefault();
      var a = inlineInput.selectionStart, b = inlineInput.selectionEnd, v = inlineInput.value;
      inlineInput.value = v.slice(0, a) + "  " + v.slice(b);
      inlineInput.setSelectionRange(a + 2, a + 2);
      applyEditor();
      return;
    }
    if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) { event.preventDefault(); closeEditor(); }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && !event.altKey) {
    var key = event.key.toLowerCase();
    var mark = key === "b" ? "**" : key === "i" ? "*" : key === "u" ? "++" : key === "e" || key === "`" ? "`" :
               key === "x" && event.shiftKey ? "~~" : null;
    if (mark) { event.preventDefault(); toggleMarker(mark); return; }
  }
  if (event.key === "Escape") { event.preventDefault(); closeEditor(); return; }
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); closeEditor(); return; }
  if (event.key === "Enter" && !event.shiftKey && editing && ((editing.kind !== "node" && editing.kind !== "text") || parseCell(editing.field))) {
    event.preventDefault(); closeEditor(); return;
  }
  if (event.key === "Tab" && editing && parseCell(editing.field)) {
    event.preventDefault();
    moveCell(event.shiftKey ? -1 : 1);
    return;
  }
  if (event.key === "Tab" && editing && editing.kind === "node") {
    event.preventDefault();
    var id = editing.id, next = editing.field === "title" ? "sub" : "title";
    closeEditor();
    openEditor(id, next);
  }
});
/* Colouring words while typing: the strip's colour button opens a row
   of inks. Choosing one wraps the selection (or the word under the
   caret) in {#hex}...{/}, replacing any colour already around it;
   "No colour" takes it off. "Any colour" uses the shared picker and
   keeps the editor open while it is up. */
var TEXT_INKS = ["#23231F", "#DD4B44", "#B97F12", "#4C7040", "#2E7A7B", "#2E5E8C", "#5B4A85", "#8C8A80"];
var inkSpan = null;   /* the selection to colour while the picker is open */
function colourWords(hex, span) {
  var el = inlineInput, v = el.value;
  var a = span ? span[0] : el.selectionStart, b = span ? span[1] : el.selectionEnd;
  if (a === b) {
    while (a > 0 && /\S/.test(v[a - 1])) a--;
    while (b < v.length && /\S/.test(v[b])) b++;
  }
  while (a < b && /\s/.test(v[a])) a++;
  while (b > a && /\s/.test(v[b - 1])) b--;
  /* step outside a colour already wrapped around exactly these words */
  var before = /\{#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\}$/.exec(v.slice(0, a));
  if (before && v.slice(b, b + 3) === "{/}") { a -= before[0].length; b += 3; }
  var inner = v.slice(a, b), wrapped = /^\{#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\}([\s\S]*)\{\/\}$/.exec(inner);
  if (wrapped) inner = wrapped[1];
  inner = inner.replace(/\{#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\}|\{\/\}/g, "");
  var put = hex ? "{" + hex + "}" + inner + "{/}" : inner;
  el.value = v.slice(0, a) + put + v.slice(b);
  var start = a + (hex ? hex.length + 2 : 0);
  el.focus();
  el.setSelectionRange(start, start + inner.length);
  applyEditor();
}
var inkRow = htmlEl("span", "ink-row"), inkAny = null;
inkRow.hidden = true;
TEXT_INKS.forEach(function (hex) {
  var b = htmlEl("button", "swatch-btn");
  b.type = "button";
  b.style.background = hex;
  b.dataset.tip = hex;
  b.setAttribute("aria-label", "Colour " + hex);
  b.addEventListener("mousedown", function (e) { e.preventDefault(); });
  b.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); });
  b.addEventListener("click", function (e) { e.preventDefault(); colourWords(hex); });
  inkRow.appendChild(b);
});
[["Any colour…", function () {
  inkSpan = [inlineInput.selectionStart, inlineInput.selectionEnd];
  openColorPicker(inkAny, null, "Colour these words", function (hex) { colourWords(hex, inkSpan); inkSpan = [inlineInput.selectionStart, inlineInput.selectionEnd]; });
}], ["No colour", function () { colourWords(null); }]].forEach(function (o) {
  var b = toolButton({ label: o[0], title: o[0] === "No colour" ? "Take the colour off these words" : "Pick any colour, or a hex" });
  b.addEventListener("mousedown", function (e) { e.preventDefault(); });
  b.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); });
  b.addEventListener("click", function (e) { e.preventDefault(); o[1](); });
  inkRow.appendChild(b);
  if (o[0] === "Any colour…") inkAny = b;
});
var inkToggle = toolButton({ icon: "palette", title: "Colour the selected words" });
inkToggle.addEventListener("mousedown", function (e) { e.preventDefault(); });
inkToggle.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); });
inkToggle.addEventListener("click", function (e) {
  e.preventDefault();
  inkRow.hidden = !inkRow.hidden;
  inkToggle.setAttribute("aria-pressed", String(!inkRow.hidden));
  layoutEditor();
});
fmtStrip.appendChild(inkToggle);
fmtStrip.appendChild(inkRow);

/* Focus moving into the strip or the colour picker is still typing. */
inlineInput.addEventListener("blur", function (e) {
  var to = e.relatedTarget;
  if (to && (fmtStrip.contains(to) || palette.contains(to))) return;
  if (editing && !palette.hidden && inkSpan) return;
  if (editing) closeEditor();
});

/* Tab walks the cells in reading order. Tabbing out of the last cell adds
   a fresh row, the way a spreadsheet does. */
function moveCell(step) {
  var id = editing.id, cell = parseCell(editing.field);
  var node = findNode(id), t = tableSize(node);
  var index = cell.r * t.cols + cell.c;
  do { index += step; }
  while (index >= 0 && index < t.rows * t.cols && isCovered(node, Math.floor(index / t.cols), index % t.cols));
  if (index < 0) return;
  closeEditor();
  node = findNode(id);
  if (index >= t.rows * t.cols) { addTableRow(node); commit(); render(); }
  openEditor(id, cellField(Math.floor(index / t.cols), index % t.cols));
}

