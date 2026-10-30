/* ================================================================
   14. Editing commands
   ================================================================ */
function patchSelected(patch) {
  var changed = false;
  selList().forEach(function (found) {
    Object.keys(patch).forEach(function (key) {
      var v = typeof patch[key] === "function" ? patch[key](found.item, found.kind) : patch[key];
      if (v !== undefined) { found.item[key] = v; changed = true; }
    });
  });
  if (changed) { commit(); render(); layoutEditor(); }
}
function deleteSelected() {
  if (!sel.size) return;
  var gone = sel;
  page().nodes = nodes().filter(function (n) { return !gone.has(n.id); });
  page().edges = edges().filter(function (e) {
    return !gone.has(e.id) && !gone.has(e.from) && !gone.has(e.to);
  });
  page().texts = texts().filter(function (t) { return !gone.has(t.id); });
  sel.clear();
  closeEditor(true);
  commit(); render();
}
/* Copies of grouped things are grouped among themselves, not with the
   originals. Returns a function that gives a copy its new group id. */
function regrouper() {
  var made = {};
  return function (copy) {
    if (copy.group) copy.group = made[copy.group] || (made[copy.group] = uid("g"));
    return copy;
  };
}
function duplicateSelected() {
  var found = selList();
  if (!found.length) return;
  var map = {}, fresh = [], regroup = regrouper();

  found.filter(function (f) { return f.kind === "node"; }).forEach(function (f) {
    var copy = regroup(deepCopy(f.item));
    copy.id = uid("n"); copy.x += 24; copy.y += 24;
    map[f.item.id] = copy.id;
    nodes().push(copy); fresh.push(copy.id);
  });
  found.filter(function (f) { return f.kind === "text"; }).forEach(function (f) {
    var copy = regroup(deepCopy(f.item));
    copy.id = uid("t"); copy.x += 24; copy.y += 24;
    texts().push(copy); fresh.push(copy.id);
  });
  found.filter(function (f) { return f.kind === "edge"; }).forEach(function (f) {
    var copy = copyEdge(f.item, map, 24);
    if (!copy) return;
    regroup(copy);
    edges().push(copy); fresh.push(copy.id);
  });

  sel = new Set(fresh);
  commit(); render();
}

var clipboard = null;
function copySelected() {
  var found = selList();
  if (!found.length) return;
  clipboard = {
    nodes: found.filter(function (f) { return f.kind === "node"; }).map(function (f) { return deepCopy(f.item); }),
    texts: found.filter(function (f) { return f.kind === "text"; }).map(function (f) { return deepCopy(f.item); }),
    edges: found.filter(function (f) { return f.kind === "edge"; }).map(function (f) { return deepCopy(f.item); })
  };
  /* Put something on the system clipboard too, so an old screenshot
     sitting there does not win over these shapes on the next paste. */
  try { if (navigator.clipboard) navigator.clipboard.writeText("Diagram studio shapes").catch(function () {}); } catch (err) { /* not allowed here */ }
  toast(found.length + (found.length === 1 ? " item copied" : " items copied"));
}
function pasteClipboard() {
  if (!clipboard) return;
  var map = {}, fresh = [], regroup = regrouper();
  clipboard.nodes.forEach(function (n) {
    var copy = regroup(deepCopy(n)); copy.id = uid("n"); copy.x += 26; copy.y += 26;
    map[n.id] = copy.id; nodes().push(copy); fresh.push(copy.id);
  });
  clipboard.texts.forEach(function (t) {
    var copy = regroup(deepCopy(t)); copy.id = uid("t"); copy.x += 26; copy.y += 26;
    texts().push(copy); fresh.push(copy.id);
  });
  clipboard.edges.forEach(function (e) {
    var copy = copyEdge(e, map, 26);
    if (!copy) return;
    regroup(copy);
    edges().push(copy); fresh.push(copy.id);
  });
  sel = new Set(fresh);
  commit(); render();
}
/* Stacking: everything starts in the usual layers (arrows, then shapes,
   then text and arrow labels on top). `z` takes an item out of them: below
   zero it is drawn under everything, above zero over everything, in
   order of z and then of how it was drawn before. */
function zOf(it) { return +it.z || 0; }
function stackOrder() {
  var all = edges().concat(nodes(), texts());
  function byZ(a, b) { return zOf(a) - zOf(b) || all.indexOf(a) - all.indexOf(b); }
  return {
    back: all.filter(function (it) { return zOf(it) < 0; }).sort(byZ),
    middle: all.filter(function (it) { return !zOf(it); }),
    front: all.filter(function (it) { return zOf(it) > 0; }).sort(byZ)
  };
}
/* Bring to front puts the picked things over everything else, and send
   to back under everything, arrows and text included. Picked things keep
   their order among themselves. */
function reorder(mode) {
  if (!sel.size) return;
  var st = stackOrder(), drawn = st.back.concat(
    st.middle.filter(function (it) { return it.from !== undefined; }),
    st.middle.filter(function (it) { return it.from === undefined && it.text === undefined; }),
    st.middle.filter(function (it) { return it.text !== undefined && it.anchor !== undefined; }),
    st.front);
  var chosen = drawn.filter(function (it) { return sel.has(it.id); });
  var others = drawn.filter(function (it) { return !sel.has(it.id); }).map(zOf);
  if (!chosen.length) return;
  if (mode === "front") {
    var hi = Math.max.apply(null, [0].concat(others));
    chosen.forEach(function (it, i) { it.z = hi + 1 + i; });
  } else {
    var lo = Math.min.apply(null, [0].concat(others));
    chosen.forEach(function (it, i) { it.z = lo - chosen.length + i; });
  }
  commit(); render();
}
function alignSelected(mode) {
  var list = selNodes();
  if (list.length < 2) return toast("Pick at least two shapes");
  var x0 = Math.min.apply(null, list.map(function (n) { return n.x; }));
  var x1 = Math.max.apply(null, list.map(function (n) { return n.x + n.w; }));
  var y0 = Math.min.apply(null, list.map(function (n) { return n.y; }));
  var y1 = Math.max.apply(null, list.map(function (n) { return n.y + n.h; }));
  list.forEach(function (n) {
    if (mode === "left")    n.x = x0;
    if (mode === "hcenter") n.x = Math.round((x0 + x1) / 2 - n.w / 2);
    if (mode === "right")   n.x = x1 - n.w;
    if (mode === "top")     n.y = y0;
    if (mode === "vcenter") n.y = Math.round((y0 + y1) / 2 - n.h / 2);
    if (mode === "bottom")  n.y = y1 - n.h;
  });
  commit(); render();
}
function distributeSelected(axis) {
  var list = selNodes();
  if (list.length < 3) return toast("Pick at least three shapes");
  var key = axis === "h" ? "x" : "y";
  var dim = axis === "h" ? "w" : "h";
  var sorted = list.slice().sort(function (a, b) { return a[key] - b[key]; });
  var first = sorted[0], last = sorted[sorted.length - 1];
  var span = (last[key] + last[dim]) - first[key];
  var used = sorted.reduce(function (sum, n) { return sum + n[dim]; }, 0);
  var gap = (span - used) / (sorted.length - 1);
  var cursor = first[key];
  sorted.forEach(function (n) { n[key] = Math.round(cursor); cursor += n[dim] + gap; });
  commit(); render();
}

/* ================================================================
   14b. Copying a look from one item to another
        A copied style is a small bag of looks that every kind of item
        can read from: colours cross between kinds (a box outline paints
        an arrow's line or a drawing's ink), while sizes and thickness
        only cross between items of the same kind, since a box title and
        an arrow label use different scales.
   ================================================================ */
var paintStyle = null;     /* the copied look */
var paintSticky = false;   /* true when the brush stays on for several clicks */
var TEXT_FLAGS = ["bold", "italic", "underline", "strike"];

function kindOf(found) {
  if (found.kind !== "node") return found.kind;
  return found.item.type === "image" || found.item.type === "ink" || found.item.type === "table" || found.item.type === "code" ? found.item.type : "shape";
}
function styleOf(found) {
  var it = found.item, kind = kindOf(found), st = { kind: kind };
  if (kind === "shape" || kind === "table") {
    st.line = it.accent; st.fill = it.fill; st.filled = it.filled; st.style = it.style; st.border = borderStyle(it); st.borderW = +it.borderW || 2;
    st.textColor = it.titleColor; st.size = it.titleSize;
    if (kind === "table") st.header = !!it.header;
  } else if (kind === "edge") {
    st.line = it.color; st.textColor = it.labelColor || it.color; st.size = it.labelSize;
    st.weight = it.weight; st.dashed = !!it.dashed; st.head = it.head; st.tail = it.tail; st.onPath = it.onPath;
    st.flow = !!it.flow; st.flowSpeed = it.flowSpeed; st.flowStyle = it.flowStyle; st.headLen = +it.headLen || 5;
  } else if (kind === "text") {
    st.line = it.color; st.textColor = it.color; st.size = it.size; st.anchor = it.anchor;
  } else if (kind === "code") {
    st.line = it.accent; st.fill = it.fill; st.size = it.titleSize; st.codeInk = it.codeInk ? Object.assign({}, it.codeInk) : null;
  } else if (kind === "ink") {
    st.line = it.accent; st.weight = it.weight;
  } else if (kind === "image") {
    st.line = it.accent; st.frame = !!it.frame; st.wobble = !!it.wobble;
  }
  if (kind === "shape" || kind === "table" || kind === "edge" || kind === "text") {
    TEXT_FLAGS.forEach(function (k) { st[k] = !!it[k]; });
  }
  return st;
}
function applyStyle(found, st) {
  var it = found.item, kind = kindOf(found);
  var same = st.kind === kind || ((st.kind === "shape" || st.kind === "table") && (kind === "shape" || kind === "table"));
  function set(key, v) { if (v !== undefined && v !== null) it[key] = v; }
  if (kind === "shape" || kind === "table") {
    set("accent", st.line); set("fill", st.fill); set("filled", st.filled); set("style", st.style); set("border", st.border); set("borderW", st.borderW);
    set("titleColor", st.textColor);
    if (same) set("titleSize", st.size);
    if (kind === "table" && st.kind === "table") set("header", st.header);
  } else if (kind === "edge") {
    set("color", st.line); set("labelColor", st.textColor);
    if (same) { set("labelSize", st.size); set("weight", st.weight); set("dashed", st.dashed); set("head", st.head); set("tail", st.tail); set("onPath", st.onPath); set("flow", st.flow); set("flowSpeed", st.flowSpeed); set("flowStyle", st.flowStyle); set("headLen", st.headLen); }
  } else if (kind === "text") {
    set("color", st.textColor || st.line);
    if (same) { set("size", st.size); set("anchor", st.anchor); }
  } else if (kind === "code") {
    set("accent", st.line); set("fill", st.fill);
    if (same) {
      set("titleSize", st.size);
      if (st.codeInk) it.codeInk = Object.assign({}, st.codeInk); else delete it.codeInk;
    }
  } else if (kind === "ink") {
    set("accent", st.line);
    if (same) set("weight", st.weight);
  } else if (kind === "image") {
    set("accent", st.line);
    if (same) { set("frame", st.frame); set("wobble", st.wobble); }
  }
  if (st.bold !== undefined && (kind === "shape" || kind === "table" || kind === "edge" || kind === "text")) {
    TEXT_FLAGS.forEach(function (k) { it[k] = st[k]; });
  }
}
function copyStyle(sticky) {
  var f = firstSel();
  if (!f) return toast("Select something to copy its style");
  paintStyle = styleOf(f);
  paintSticky = !!sticky;
  setTool("paint");
}
function pasteStyle() {
  if (!paintStyle) return toast("Copy a style first: " + MOD + "+Alt+C");
  var list = selList();
  if (!list.length) return toast("Select something to paste the style onto");
  list.forEach(function (f) { applyStyle(f, paintStyle); });
  commit(); render();
  toast(list.length === 1 ? "Style pasted" : "Style pasted onto " + list.length + " items");
}
/* One click on the brush paints one item; a double click keeps it on.
   Clicking it again while it is on puts it down. The bar is rebuilt
   after the first click, so the double click is told apart by timing
   rather than by a dblclick event. */
var lastBrushClick = 0;
function brushButton() {
  var on = tool === "paint";
  return toolButton({
    icon: "brush", pressed: on,
    title: on ? (paintSticky ? "Painting: click items, Esc to stop" : "Click an item to paint it") : "Copy this style  (double click to paint several)",
    onClick: function () {
      var now = Date.now(), quick = now - lastBrushClick < 400;
      lastBrushClick = now;
      if (quick) copyStyle(true);
      else if (tool === "paint") setTool("select");
      else copyStyle(false);
    }
  });
}

