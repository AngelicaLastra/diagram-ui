/* ================================================================
   10. Drawing
       Groups are keyed and reused between frames. The hit targets in
       particular keep their identity, which is what lets the browser
       fire a real dblclick instead of seeing two clicks on two
       different elements.
   ================================================================ */
var keyCache = { shapes: new Map(), labels: new Map(), hits: new Map() };

function resetDom() {
  keyCache.shapes.clear(); keyCache.labels.clear(); keyCache.hits.clear();
  clear(shapesLayer); clear(labelsLayer); clear(hitsGroup); clear($("flows"));
}
function keyedGroup(cacheName, key, useFilter) {
  var cache = keyCache[cacheName];
  var g = cache.get(key);
  if (!g) { g = makeEl("g", { "data-key": key }); cache.set(key, g); }
  setAttrs(g, { filter: useFilter ? "url(#" + filterIdFor(key) + ")" : null });
  clear(g);
  return g;
}
function keyedHit(key, tag, dataAttr) {
  var el = keyCache.hits.get(key);
  if (!el || el.tagName !== tag) {
    el = makeEl(tag, {});
    el.dataset[dataAttr] = key;
    keyCache.hits.set(key, el);
  }
  return el;
}
function syncChildren(parent, els) {
  var idx = 0;
  els.forEach(function (el) {
    if (!el) return;
    if (parent.childNodes[idx] !== el) parent.insertBefore(el, parent.childNodes[idx] || null);
    idx++;
  });
  while (parent.childNodes.length > idx) parent.removeChild(parent.lastChild);
}
function pruneCache(cache, order) {
  var live = new Set(order);
  Array.from(cache.keys()).forEach(function (k) { if (!live.has(k)) cache.delete(k); });
}
function syncLayer(parent, cache, order) {
  syncChildren(parent, order.map(function (key) { return cache.get(key); }));
  pruneCache(cache, order);
}

/* A shape's border: solid, dashed or dotted. Shapes that never chose
   keep their old look, dashed for an open outline and solid otherwise. */
var BORDER_DASH = { solid: null, dashed: "6 5", dotted: "0.6 4.6" };
function borderStyle(node) {
  if (BORDER_DASH.hasOwnProperty(node.border)) return node.border;
  return node.style !== "sketch" && !node.filled ? "dashed" : "solid";
}
/* Outline thickness, in px against the usual 2: every stroke that draws
   a shape's edge scales by it, and dashes and dots stretch along so a
   heavy dotted border still reads as dots. */
function borderScale(node) { return clamp(+node.borderW || 2, 0.5, 12) / 2; }
function borderDash(node) {
  var dash = BORDER_DASH[borderStyle(node)], k = Math.max(1, borderScale(node));
  return dash && dash.split(" ").map(function (v) { return +(v * k).toFixed(2); }).join(" ");
}

function drawSketchBody(node, shapeGroup, corners, jitter, random) {
  var dash = borderDash(node);
  var wobble = Math.max(jitter, 1.2);
  var moved = jitterPoints(corners, wobble, random);
  var body = closedPath(moved, wobble, random);

  if (node.filled) {
    shapeGroup.appendChild(makeEl("path", {
      d: closedPath(jitterPoints(corners, wobble * 1.9, random), wobble, random),
      fill: node.fill, "fill-opacity": 0.38
    }));
    shapeGroup.appendChild(makeEl("path", { d: body, fill: node.fill, "fill-opacity": 0.85 }));

    var clipId = "clip-" + node.id;
    var clip = makeEl("clipPath", { id: clipId });
    clip.appendChild(makeEl("path", { d: body }));
    clip.dataset.generated = "1";
    defs.appendChild(clip);

    var hatch = makeEl("g", { "clip-path": "url(#" + clipId + ")" });
    var step = 6 + random() * 3;
    for (var x = node.x - node.h; x < node.x + node.w; x += step) {
      var dark = random() < 0.18;
      hatch.appendChild(makeEl("line", {
        x1: (x + (random() * 2 - 1) * 2).toFixed(1),
        y1: (node.y + node.h + 5).toFixed(1),
        x2: (x + node.h + random() * 12).toFixed(1),
        y2: (node.y - 5).toFixed(1),
        stroke: dark ? node.accent : "#FFFFFF",
        "stroke-width": (0.7 + random() * 1.1).toFixed(2),
        "stroke-opacity": dark ? 0.1 : (0.18 + random() * 0.34).toFixed(2),
        "stroke-linecap": "round"
      }));
    }
    shapeGroup.appendChild(hatch);
  }

  /* Rounded shapes get a traced outline; corners get the overshoot strokes. */
  if (corners.length > 6) {
    for (var k = 0; k < 2; k++) {
      shapeGroup.appendChild(makeEl("path", {
        d: closedPath(jitterPoints(corners, wobble * (0.75 + k * 0.6), random), wobble, random),
        fill: "none", stroke: node.accent,
        "stroke-width": ((2 + random() * 1.1) * borderScale(node)).toFixed(2),
        "stroke-opacity": 0.78, "stroke-linecap": "round", "stroke-dasharray": dash
      }));
    }
    return;
  }
  for (var i = 0; i < moved.length; i++) {
    shapeGroup.appendChild(makeEl("path", {
      d: sidePath(moved[i], moved[(i + 1) % moved.length], wobble, random),
      fill: "none", stroke: node.accent,
      "stroke-width": ((2.3 + random() * 1.3) * borderScale(node)).toFixed(2),
      "stroke-opacity": 0.92, "stroke-linecap": "round", "stroke-dasharray": dash
    }));
  }
}

/* Pictures are drawn as they are. The paper filter would smear them, so
   it only goes on when "Sketchy" is switched on, and the frame is an
   optional hand-ruled border in the ink colour. */
function drawImageNode(node) {
  var shapeGroup = keyedGroup("shapes", node.id, !!node.wobble);
  keyedGroup("labels", node.id, false);
  var src = assets[node.asset];
  if (src) {
    var pic = makeEl("image", {
      x: node.x, y: node.y, width: node.w, height: node.h, preserveAspectRatio: "none"
    });
    pic.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", src);
    shapeGroup.appendChild(pic);
  } else {
    shapeGroup.appendChild(makeEl("rect", {
      x: node.x, y: node.y, width: node.w, height: node.h, rx: 4,
      fill: "#F5F2EA", stroke: LINE, "stroke-dasharray": "6 5"
    }));
    var missing = styledText(node.x + node.w / 2, node.y + node.h / 2 + 4, "Image missing", { size: 11, color: INK_SOFT, anchor: "middle" });
    shapeGroup.appendChild(missing);
  }
  if (node.frame) {
    var random = makeRandom(hashOf(node.id));
    var pad = 5;
    var corners = cornersFor({ x: node.x - pad, y: node.y - pad, w: node.w + pad * 2, h: node.h + pad * 2 });
    corners.forEach(function (c, i) {
      shapeGroup.appendChild(makeEl("path", {
        d: sidePath(c, corners[(i + 1) % 4], ROUGHNESS[roughness].jitter * 0.6, random),
        fill: "none", stroke: node.accent, "stroke-width": (2 + random() * 0.8).toFixed(2),
        "stroke-opacity": 0.9, "stroke-linecap": "round"
      }));
    });
  }
  var hit = keyedHit(node.id, "rect", "nodeId");
  setAttrs(hit, { x: node.x, y: node.y, width: node.w, height: node.h, fill: "transparent", cursor: "move" });
}

/* Pen drawings are nodes too, so they move, resize, connect, undo and
   play like any shape. Each stroke is stored relative to the drawing's
   box (0 to 1), which is what lets a drag on a corner stretch it. */
function inkStrokes(node) {
  return (node.strokes || []).map(function (st) {
    var pts = [];
    for (var i = 0; i + 1 < st.length; i += 2) pts.push({ x: node.x + st[i] * node.w, y: node.y + st[i + 1] * node.h });
    return pts;
  });
}
/* A smooth line through the points: quadratic curves between midpoints. */
function smoothPath(pts) {
  if (!pts.length) return "";
  var f = function (v) { return v.toFixed(1); };
  if (pts.length === 1) return "M" + f(pts[0].x) + "," + f(pts[0].y) + " l0.01,0";
  var d = "M" + f(pts[0].x) + "," + f(pts[0].y);
  for (var i = 1; i < pts.length - 1; i++) {
    d += " Q" + f(pts[i].x) + "," + f(pts[i].y) + " " + f((pts[i].x + pts[i + 1].x) / 2) + "," + f((pts[i].y + pts[i + 1].y) / 2);
  }
  var last = pts[pts.length - 1];
  return d + " L" + f(last.x) + "," + f(last.y);
}
function drawInkNode(node) {
  var shapeGroup = keyedGroup("shapes", node.id, false);
  keyedGroup("labels", node.id, false);
  var d = inkStrokes(node).map(smoothPath).join(" ");
  shapeGroup.appendChild(makeEl("path", {
    d: d, fill: "none", stroke: node.accent, "stroke-width": node.weight || 3,
    "stroke-linecap": "round", "stroke-linejoin": "round"
  }));
  /* the strokes themselves are the click target, not the empty box */
  var hit = keyedHit(node.id, "path", "nodeId");
  setAttrs(hit, { d: d, fill: "none", stroke: "transparent", "stroke-width": Math.max(14, (node.weight || 3) + 10), cursor: "move", "stroke-linecap": "round" });
}

/* Douglas-Peucker: drop points that sit on the line between their
   neighbours, so a stroke keeps its shape at a fraction of the size. */
function simplifyPoints(pts, tolerance) {
  if (pts.length < 3) return pts;
  var keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  (function walk(a, b) {
    var dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y, len = Math.hypot(dx, dy), far = 0, at = -1;
    for (var i = a + 1; i < b; i++) {
      /* a closed loop starts and ends on the same spot, so measure from that spot */
      var dist = len < 1e-6 ? Math.hypot(pts[i].x - pts[a].x, pts[i].y - pts[a].y)
        : Math.abs(dy * pts[i].x - dx * pts[i].y + pts[b].x * pts[a].y - pts[b].y * pts[a].x) / len;
      if (dist > far) { far = dist; at = i; }
    }
    if (far > tolerance) { keep[at] = 1; walk(a, at); walk(at, b); }
  })(0, pts.length - 1);
  return pts.filter(function (_, i) { return keep[i]; });
}
/* Rebuilds a drawing's box around absolute strokes and stores them
   relative to it again. */
function setInk(node, strokes) {
  var all = [].concat.apply([], strokes);
  var x0 = Math.min.apply(null, all.map(function (p) { return p.x; }));
  var y0 = Math.min.apply(null, all.map(function (p) { return p.y; }));
  var x1 = Math.max.apply(null, all.map(function (p) { return p.x; }));
  var y1 = Math.max.apply(null, all.map(function (p) { return p.y; }));
  node.x = Math.round(x0 * 10) / 10; node.y = Math.round(y0 * 10) / 10;
  node.w = Math.max(1, x1 - x0); node.h = Math.max(1, y1 - y0);
  node.strokes = strokes.map(function (pts) {
    var flat = [];
    pts.forEach(function (p) {
      flat.push(+((p.x - node.x) / node.w).toFixed(4), +((p.y - node.y) / node.h).toFixed(4));
    });
    return flat;
  });
}

/* Strokes started soon after the last one ended, and close to it, join
   the same drawing. Anything else starts a new drawing. */
var INK_JOIN_MS = 1500, INK_JOIN_GAP = 60;
var lastInk = null;   /* { id, at } of the drawing the last stroke went into */

function finishStroke(points) {
  if (!points.length) return;
  var k = viewScale();
  var stroke = simplifyPoints(points, 0.6 / k);
  var target = null;
  if (lastInk && Date.now() - lastInk.at < INK_JOIN_MS) {
    var prev = findNode(lastInk.id), first = points[0];
    if (prev && prev.type === "ink" &&
        first.x > prev.x - INK_JOIN_GAP && first.x < prev.x + prev.w + INK_JOIN_GAP &&
        first.y > prev.y - INK_JOIN_GAP && first.y < prev.y + prev.h + INK_JOIN_GAP) target = prev;
  }
  if (target) {
    setInk(target, inkStrokes(target).concat([stroke]));
  } else {
    target = makeNode("box", "wash", points[0]);
    target.type = "ink";
    target.accent = penStyle.color;
    target.weight = penStyle.weight;
    target.filled = false;
    setInk(target, [stroke]);
    nodes().push(target);
  }
  lastInk = { id: target.id, at: Date.now() };
  commit(); render();
}

function buildInkBubble(node) {
  bubble.appendChild(paletteRow(null, function (preset) { patchSelected({ accent: function (it) { return it.type === "ink" ? preset.accent : undefined; } }); }));
  bubble.appendChild(colorControl(node.accent, "Ink colour", function (hex) {
    patchSelected({ accent: function (it) { return it.type === "ink" ? hex : undefined; } });
  }));
  bubble.appendChild(divider());
  bubble.appendChild(numberControl(node.weight || 3, 0.5, 24, "Line thickness", function (v) {
    patchSelected({ weight: function (it) { return it.type === "ink" ? v : undefined; } });
  }, 0.5));
}
/* While the pen is out and nothing is selected, the floating bar holds
   the pen's own colour and thickness. */
var PEN_SIZES = [[1.5, "Fine"], [3, "Medium"], [6, "Bold"]];
function buildPenBar() {
  bubble.appendChild(htmlEl("span", null, "Pen"));
  bubble.appendChild(divider());
  bubble.appendChild(paletteRow(null, function (preset) { penStyle.color = preset.accent; persistNow(); renderBubble(); }));
  bubble.appendChild(colorControl(penStyle.color, "Pen colour", function (hex) { penStyle.color = hex; persistNow(); renderBubble(); }));
  bubble.appendChild(divider());
  PEN_SIZES.forEach(function (size) {
    var b = toolButton({
      title: size[1], pressed: penStyle.weight === size[0],
      onClick: function () { penStyle.weight = size[0]; persistNow(); renderBubble(); }
    });
    var dot = htmlEl("span", "pen-dot");
    dot.style.width = dot.style.height = (size[0] + 3) + "px";
    dot.style.background = penStyle.color;
    b.appendChild(dot);
    bubble.appendChild(b);
  });
  bubble.appendChild(divider());
  bubble.appendChild(toolButton({ label: "Done", title: "Put the pen down  (V)", onClick: function () { setTool("select"); } }));
  var rect = bubble.getBoundingClientRect(), width = sheet.getBoundingClientRect().width;
  bubble.style.left = Math.max(8, (width - rect.width) / 2) + "px";
  bubble.style.top = "12px";
}

/* Code blocks: a sketched card holding code, highlighted in the sheet's
   own palette rather than an editor theme. Languages: sql, jinja (SQL
   with dbt-style {{ }}, {% %} and {# #}), yaml (Jinja allowed inside),
   and text. */
var CODE_LANGS = [["sql", "SQL"], ["jinja", "Jinja + SQL"], ["yaml", "YAML"], ["text", "Plain text"]];
var CODE_INK = {
  kw: "#2E7A7B", fn: "#2E5E8C", str: "#B97F12", num: "#9E2F2A", com: "#8C8A80",
  jd: "#8E7BB5", jk: "#5B4A85", jv: "#5B4A85", key: "#2E5E8C", punct: "#8C8A80", plain: INK
};
var SQL_WORDS = new Set(("select from where and or not null is in as on join left right inner outer full cross " +
  "group by order having limit offset with union all distinct insert into values update set delete create " +
  "table view replace if exists cast case when then else end between like ilike over partition qualify " +
  "window asc desc true false using lateral merge matched returning materialized recursive top any some " +
  "except intersect primary key references default alter drop add column").split(" "));
var JINJA_WORDS = new Set(("if elif else endif for in endfor set endset macro endmacro call endcall filter " +
  "endfilter block endblock extends include import from as with endwith is not and or true false none " +
  "return do raw endraw snapshot endsnapshot test endtest").split(" "));
var YAML_WORDS = new Set("true false yes no null on off ~".split(" "));

function pushTok(out, text, kind) {
  if (!text) return;
  var last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text; else out.push({ text: text, kind: kind });
}
function nextChar(line, i) { var m = /\S/.exec(line.slice(i)); return m ? m[0] : ""; }

/* SQL, carrying an open block comment from one line to the next. */
function sqlTokens(text, state, out) {
  var i = 0;
  while (i < text.length) {
    if (state.block) {
      var shut = text.indexOf("*/", i);
      if (shut < 0) { pushTok(out, text.slice(i), "com"); return; }
      pushTok(out, text.slice(i, shut + 2), "com"); i = shut + 2; state.block = false; continue;
    }
    var rest = text.slice(i), m;
    if ((m = /^--.*/.exec(rest))) { pushTok(out, m[0], "com"); i += m[0].length; continue; }
    if (rest.indexOf("/*") === 0) { state.block = true; pushTok(out, "/*", "com"); i += 2; continue; }
    if ((m = /^'(?:[^'\\]|\\.|'')*'?/.exec(rest))) { pushTok(out, m[0], "str"); i += m[0].length; continue; }
    if ((m = /^"(?:[^"\\]|\\.)*"?/.exec(rest)) || (m = /^`[^`]*`?/.exec(rest))) { pushTok(out, m[0], "plain"); i += m[0].length; continue; }
    if ((m = /^\d+(?:\.\d+)?\b/.exec(rest))) { pushTok(out, m[0], "num"); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_][\w$]*/.exec(rest))) {
      var word = m[0], low = word.toLowerCase();
      var kind = SQL_WORDS.has(low) ? "kw" : nextChar(text, i + word.length) === "(" ? "fn" : "plain";
      pushTok(out, word, kind); i += word.length; continue;
    }
    if ((m = /^\s+/.exec(rest))) { pushTok(out, m[0], "plain"); i += m[0].length; continue; }
    pushTok(out, text[i], /[(),;.=<>!+\-*\/%|:]/.test(text[i]) ? "punct" : "plain"); i++;
  }
}
/* Inside {{ }} or {% %}: names, strings and numbers. */
function jinjaTokens(text, out) {
  var i = 0, m;
  while (i < text.length) {
    var rest = text.slice(i);
    if ((m = /^'[^']*'?|^"[^"]*"?/.exec(rest))) { pushTok(out, m[0], "str"); i += m[0].length; continue; }
    if ((m = /^\d+(?:\.\d+)?/.exec(rest))) { pushTok(out, m[0], "num"); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_]\w*/.exec(rest))) {
      var word = m[0];
      pushTok(out, word, JINJA_WORDS.has(word.toLowerCase()) ? "jk" : nextChar(text, i + word.length) === "(" ? "fn" : "jv");
      i += word.length; continue;
    }
    pushTok(out, text[i], /\s/.test(text[i]) ? "plain" : "punct"); i++;
  }
}
/* One YAML line outside any Jinja: comments, keys, list dashes, values. */
function yamlTokens(text, atLineStart, out) {
  var m, i = 0;
  if (atLineStart) {
    if ((m = /^(\s*)(#.*)$/.exec(text))) { pushTok(out, m[1], "plain"); pushTok(out, m[2], "com"); return; }
    if ((m = /^(\s*)(- )?/.exec(text)) && m[0]) { pushTok(out, m[1], "plain"); pushTok(out, m[2] || "", "punct"); i = m[0].length; }
    var keyed = /^([^\s:#'"{][^:#]*?|"[^"]*"|'[^']*')(\s*:)(?=\s|$)/.exec(text.slice(i));
    if (keyed) { pushTok(out, keyed[1], "key"); pushTok(out, keyed[2], "punct"); i += keyed[0].length; }
  }
  while (i < text.length) {
    var rest = text.slice(i);
    if ((m = /^\s+#.*/.exec(rest))) { pushTok(out, m[0], "com"); return; }
    if ((m = /^'[^']*'?|^"(?:[^"\\]|\\.)*"?/.exec(rest))) { pushTok(out, m[0], "str"); i += m[0].length; continue; }
    if ((m = /^-?\d+(?:\.\d+)?(?=\s|$|,|\])/.exec(rest))) { pushTok(out, m[0], "num"); i += m[0].length; continue; }
    if ((m = /^[^\s,\[\]{}]+/.exec(rest))) { pushTok(out, m[0], YAML_WORDS.has(m[0].toLowerCase()) ? "kw" : "plain"); i += m[0].length; continue; }
    pushTok(out, rest[0], /\s/.test(rest[0]) ? "plain" : "punct"); i++;
  }
}
/* Splits a line into Jinja tags and the text between them, carrying an
   unclosed tag on to the next line. */
function codeLineTokens(line, lang, state) {
  var out = [];
  if (lang === "text") { pushTok(out, line, "plain"); return out; }
  if (lang === "sql") { sqlTokens(line, state, out); return out; }
  var i = 0, first = true;
  while (i < line.length) {
    if (state.tag) {
      var close = state.tag === "{#" ? "#}" : state.tag === "{%" ? "%}" : "}}";
      var shut = line.indexOf(close, i), inner = line.slice(i, shut < 0 ? line.length : shut);
      if (state.tag === "{#") pushTok(out, inner, "com"); else jinjaTokens(inner, out);
      if (shut < 0) return out;
      pushTok(out, close, state.tag === "{#" ? "com" : "jd");
      i = shut + 2; state.tag = null; first = false; continue;
    }
    var open = line.slice(i).search(/\{\{|\{%|\{#/);
    var plain = open < 0 ? line.slice(i) : line.slice(i, i + open);
    if (lang === "yaml") yamlTokens(plain, first, out); else sqlTokens(plain, state, out);
    if (open < 0) break;
    i += open;
    state.tag = line.substr(i, 2);
    pushTok(out, state.tag, state.tag === "{#" ? "com" : "jd");
    i += 2; first = false;
  }
  return out;
}

/* Size and spacing of a code block, from its text. */
function codeMetrics(node) {
  var size = node.titleSize || 11;
  var lines = String(node.code || "").replace(/\t/g, "  ").split("\n");
  measurer = measurer || document.createElement("canvas").getContext("2d");
  measurer.font = size + "px " + MONO;
  var cw = measurer.measureText("M").width, longest = 0;
  lines.forEach(function (l) { longest = Math.max(longest, l.length); });
  var numbers = node.lineNumbers !== false;
  var gutter = numbers ? String(lines.length).length * cw + 16 : 0;
  var lh = size * 1.5, head = 24, pad = 12;
  return {
    size: size, lines: lines, cw: cw, gutter: gutter, lh: lh, head: head, pad: pad, numbers: numbers,
    w: Math.ceil(Math.max(170, gutter + longest * cw + pad * 2)),
    h: Math.ceil(head + lines.length * lh + pad)
  };
}
/* A code block is as big as its code, or as big as it was dragged to,
   whichever is larger. */
function fitCode(node) {
  if (node.type !== "code") return;
  var m = codeMetrics(node);
  node.w = Math.max(m.w, node.minW || 0);
  node.h = Math.max(m.h, node.minH || 0);
}
function drawCodeNode(node) {
  var shapeGroup = keyedGroup("shapes", node.id, true);
  var labelGroup = keyedGroup("labels", node.id, false);
  var random = makeRandom(hashOf(node.id)), jitter = ROUGHNESS[roughness].jitter;
  var m = codeMetrics(node), corners = cornersFor(node);

  shapeGroup.appendChild(makeEl("path", { d: wobblyPath(corners, jitter * 0.5, random), fill: node.fill, "fill-opacity": 0.95 }));
  shapeGroup.appendChild(makeEl("path", {
    d: wobblyPath(cornersFor({ x: node.x, y: node.y, w: node.w, h: m.head }), jitter * 0.4, random),
    fill: node.accent, "fill-opacity": 0.09
  }));
  corners.forEach(function (c, i) {
    shapeGroup.appendChild(makeEl("path", {
      d: sidePath(c, corners[(i + 1) % 4], jitter * 0.5, random), fill: "none", stroke: node.accent,
      "stroke-width": (1.4 + random() * 0.5).toFixed(2), "stroke-opacity": 0.72, "stroke-linecap": "round"
    }));
  });
  shapeGroup.appendChild(makeEl("path", {
    d: sidePath({ x: node.x, y: node.y + m.head }, { x: node.x + node.w, y: node.y + m.head }, jitter * 0.4, random),
    fill: "none", stroke: node.accent, "stroke-width": 1.1, "stroke-opacity": 0.45, "stroke-linecap": "round"
  }));

  var tag = (CODE_LANGS.filter(function (l) { return l[0] === node.lang; })[0] || CODE_LANGS[0])[1];
  var label = makeEl("text", {
    x: node.x + m.pad, y: node.y + 16, "font-size": 8.5, "font-weight": 600, fill: node.accent,
    "letter-spacing": "0.12em", "fill-opacity": 0.9
  });
  label.textContent = tag.toUpperCase();
  labelGroup.appendChild(label);

  var state = {}, top = node.y + m.head + m.pad * 0.5;
  m.lines.forEach(function (line, i) {
    var y = top + i * m.lh + m.size * 1.05;
    if (m.numbers) {
      var num = makeEl("text", { x: node.x + m.pad + m.gutter - 10, y: y, "font-size": m.size * 0.9, "font-family": MONO, fill: codeInk(node, "line"), "fill-opacity": 0.6, "text-anchor": "end" });
      num.textContent = String(i + 1);
      labelGroup.appendChild(num);
    }
    var row = makeEl("text", { x: node.x + m.pad + m.gutter, y: y, "font-size": m.size, "font-family": MONO, fill: INK });
    row.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    row.style.whiteSpace = "pre";
    codeLineTokens(line, node.lang || "sql", state).forEach(function (tok) {
      var t = makeEl("tspan", { fill: codeInk(node, tok.kind) });
      if (tok.kind === "kw" || tok.kind === "jk" || tok.kind === "key") t.setAttribute("font-weight", 600);
      if (tok.kind === "com") t.setAttribute("font-style", "italic");
      t.textContent = tok.text;
      row.appendChild(t);
    });
    labelGroup.appendChild(row);
  });

  var hit = keyedHit(node.id, "rect", "nodeId");
  setAttrs(hit, { x: node.x, y: node.y, width: node.w, height: node.h, fill: "transparent", cursor: "move" });
}

/* A code block can recolour each kind of text for itself; Jinja's tags,
   keywords and names share one colour. */
var CODE_KINDS = [
  ["plain", "Text"], ["kw", "Keywords"], ["fn", "Functions"], ["str", "Strings"], ["num", "Numbers"],
  ["com", "Comments"], ["punct", "Punctuation"], ["jinja", "Jinja tags"], ["key", "YAML keys"], ["line", "Line numbers"]
];
function codeGroup(kind) { return kind === "jd" || kind === "jk" || kind === "jv" ? "jinja" : kind; }
function codeDefault(group) { return group === "jinja" ? CODE_INK.jk : group === "line" ? INK_SOFT : CODE_INK[group] || INK; }
function codeInk(node, kind) {
  var own = node.codeInk && node.codeInk[codeGroup(kind)];
  return own || (kind === "line" ? INK_SOFT : CODE_INK[kind] || INK);
}
function kindsFor(lang) {
  return CODE_KINDS.filter(function (k) {
    if (lang === "text") return k[0] === "plain" || k[0] === "line";
    if (k[0] === "jinja") return lang === "jinja" || lang === "yaml";
    if (k[0] === "key") return lang === "yaml";
    if (k[0] === "fn") return lang !== "yaml";
    return true;
  });
}
function setCodeInk(id, group, hex) {
  var node = findNode(id);
  if (!node) return;
  var own = Object.assign({}, node.codeInk || {});
  if (hex) own[group] = hex; else delete own[group];
  if (Object.keys(own).length) node.codeInk = own; else delete node.codeInk;
  commit(); render();
}
function showCodeColours(id) {
  var node = findNode(id);
  if (!node) return;
  openModal(function (m) {
    m.appendChild(htmlEl("h2", null, "Code colours"));
    m.appendChild(htmlEl("p", "sub", "Recolour each kind of text in this code block. Other code blocks keep theirs."));
    var list = htmlEl("div", "code-colours");
    kindsFor(node.lang || "sql").forEach(function (k) {
      var group = k[0], own = node.codeInk && node.codeInk[group];
      var row = htmlEl("div", "gif-row");
      row.appendChild(htmlEl("span", "gif-label", k[1]));
      row.appendChild(colorControl(own || codeDefault(group), k[1] + " colour", function (hex) { setCodeInk(id, group, hex); showCodeColours(id); }));
      var sample = htmlEl("code", "code-sample", { plain: "students", kw: "select", fn: "count()", str: "'2024-25'", num: "42", com: "-- note", punct: "( , )", jinja: "{{ ref() }}", key: "name:", line: "1 2 3" }[group]);
      sample.style.color = own || codeDefault(group);
      row.appendChild(sample);
      if (own) row.appendChild(toolButton({ label: "Reset", title: "Back to the usual colour", onClick: function () { setCodeInk(id, group, null); showCodeColours(id); } }));
      list.appendChild(row);
    });
    m.appendChild(list);
    var foot = htmlEl("div", "modal-foot");
    var reset = toolButton({ label: "Reset all", disabled: !node.codeInk, onClick: function () { var n = findNode(id); delete n.codeInk; commit(); render(); showCodeColours(id); } });
    foot.appendChild(reset);
    var done = toolButton({ label: "Done", onClick: closeModal });
    done.classList.add("accent");
    foot.appendChild(done);
    m.appendChild(foot);
  });
}

function buildCodeBubble(node) {
  bubble.appendChild(selectControl(CODE_LANGS, node.lang || "sql", "Language", function (v) {
    patchSelected({ lang: function (it) { return it.type === "code" ? v : undefined; } });
  }));
  bubble.appendChild(toolButton({
    label: "Line numbers", title: "Show or hide line numbers", pressed: node.lineNumbers !== false,
    onClick: function () { patchSelected({ lineNumbers: function (it) { return it.type === "code" ? it.lineNumbers === false : undefined; } }); }
  }));
  bubble.appendChild(divider());
  bubble.appendChild(paletteRow(null, function (preset) {
    patchSelected({ fill: function (it) { return it.type === "code" ? preset.fill : undefined; }, accent: function (it) { return it.type === "code" ? preset.accent : undefined; } });
  }));
  bubble.appendChild(toolButton({
    label: "Paper", title: "Back to the plain paper card",
    onClick: function () { patchSelected({ fill: function (it) { return it.type === "code" ? CODE_PAPER.fill : undefined; }, accent: function (it) { return it.type === "code" ? CODE_PAPER.accent : undefined; } }); }
  }));
  bubble.appendChild(colorControl(node.fill, "Card colour", function (hex) { patchSelected({ fill: function (it) { return it.type === "code" ? hex : undefined; } }); }));
  bubble.appendChild(colorControl(node.accent, "Outline colour", function (hex) { patchSelected({ accent: function (it) { return it.type === "code" ? hex : undefined; } }); }));
  bubble.appendChild(divider());
  bubble.appendChild(toolButton({
    icon: "palette", label: "Colours", title: "Recolour the code text: keywords, strings, comments and more",
    onClick: function () { showCodeColours(node.id); }
  }));
  bubble.appendChild(numberControl(node.titleSize || 11, 7, 28, "Code size", function (v) {
    patchSelected({ titleSize: function (it) { return it.type === "code" ? v : undefined; } });
  }, 0.5));
}
var CODE_PAPER = { fill: "#F7F4EC", accent: "#5F5D55" };

function drawNode(node) {
  if (node.type === "image") { drawImageNode(node); return; }
  if (node.type === "code") { drawCodeNode(node); return; }
  if (node.type === "ink") { drawInkNode(node); return; }
  var shapeGroup = keyedGroup("shapes", node.id, true);
  var labelGroup = keyedGroup("labels", node.id, false);
  var mid = center(node);
  var jitter = ROUGHNESS[roughness].jitter;
  var random = makeRandom(hashOf(node.id));
  var corners = cornersFor(node);

  if (node.style === "sketch") {
    drawSketchBody(node, shapeGroup, corners, jitter, random);
  } else if (node.filled) {
    shapeGroup.appendChild(makeEl("path", {
      d: wobblyPath(corners, jitter, random), fill: node.fill, "fill-opacity": WASH * 0.62
    }));
    shapeGroup.appendChild(makeEl("path", {
      d: wobblyPath(corners, jitter, random), fill: node.fill, "fill-opacity": WASH * 0.52
    }));
    if (borderDash(node)) {
      /* a dashed or dotted border goes all the way round the wash; a
         table draws its own border with its grid */
      if (node.type !== "table") {
        shapeGroup.appendChild(makeEl("path", {
          d: wobblyPath(corners, jitter * 0.6, random), fill: "none", stroke: node.accent,
          "stroke-width": 2 * borderScale(node), "stroke-opacity": WASH_EDGE, "stroke-linecap": "round",
          "stroke-dasharray": borderDash(node)
        }));
      }
    } else if (isCurvy(node)) {
      shapeGroup.appendChild(makeEl("path", {
        d: wobblyPath(corners, jitter * 0.6, random), fill: "none", stroke: node.accent,
        "stroke-width": 2.4 * borderScale(node), "stroke-opacity": WASH_EDGE * 0.85, "stroke-linecap": "round"
      }));
    } else {
      shapeGroup.appendChild(makeEl("path", {
        d: sidePath(corners[corners.length - 1], corners[0], jitter * 0.6, random),
        fill: "none", stroke: node.accent, "stroke-width": 3.2 * borderScale(node),
        "stroke-opacity": WASH_EDGE, "stroke-linecap": "round"
      }));
    }
  } else {
    shapeGroup.appendChild(makeEl("path", {
      d: wobblyPath(corners, jitter, random), fill: "none", stroke: node.accent,
      "stroke-width": (borderStyle(node) === "dotted" ? 2 : 1.6) * borderScale(node), "stroke-dasharray": borderDash(node), "stroke-linecap": "round"
    }));
  }

  if (node.type === "database") {
    shapeGroup.appendChild(makeEl("path", {
      d: smoothPath(jitterPoints(dbLidPoints(node), jitter * 0.45, random)),
      fill: "none", stroke: node.accent, "stroke-width": (node.style === "sketch" ? 2.2 : 1.8) * borderScale(node),
      "stroke-opacity": 0.85, "stroke-linecap": "round", "stroke-dasharray": borderDash(node)
    }));
  }
  if (node.type === "note") {
    var f = Math.min(node.w * 0.22, node.h * 0.3, 22);
    shapeGroup.appendChild(makeEl("path", {
      d: sidePath({ x: node.x + node.w - f, y: node.y }, { x: node.x + node.w, y: node.y + f }, jitter * 0.7, random),
      fill: "none", stroke: node.accent, "stroke-width": 1.8, "stroke-opacity": 0.75, "stroke-linecap": "round"
    }));
  }

  var format = {
    size: node.titleSize || 11.5,
    color: node.titleColor || (node.filled ? INK : node.accent),
    bold: node.bold, italic: node.italic, strike: node.strike, underline: node.underline,
    weight: 500, anchor: "middle"
  };

  if (node.type === "table") {
    drawTableGrid(node, shapeGroup, labelGroup, jitter, random, format);
  } else {
    drawNodeLabels(node, labelGroup, mid, format);
  }

  var hit = keyedHit(node.id, "rect", "nodeId");
  setAttrs(hit, { x: node.x, y: node.y, width: node.w, height: node.h, fill: "transparent", cursor: "move" });
}

/* Inner rules are drawn one stroke each, like the outline, so they run a
   little past the border the way a ruled-by-hand table does. */
function drawTableGrid(node, shapeGroup, labelGroup, jitter, random, format) {
  var t = tableSize(node);
  var ink = { fill: "none", stroke: node.accent, "stroke-linecap": "round" };
  var r, c;

  if (node.header && t.rows > 1) {
    var band = rawCellBox(node, 0, 0);
    band.w = node.w;
    shapeGroup.appendChild(makeEl("path", {
      d: wobblyPath(cornersFor(band), jitter * 0.6, random),
      fill: node.accent, "fill-opacity": node.filled ? 0.22 : 0.12
    }));
  }
  for (r = 0; r < t.rows; r++) {
    for (c = 0; c < t.cols; c++) {
      var fill = node.fills[r][c];
      if (!fill || isCovered(node, r, c)) continue;
      var lit = cellBox(node, r, c);
      shapeGroup.appendChild(makeEl("path", {
        d: wobblyPath(cornersFor({ x: lit.x + 1.5, y: lit.y + 1.5, w: lit.w - 3, h: lit.h - 3 }), jitter * 0.5, random),
        fill: fill, "fill-opacity": 0.72
      }));
    }
  }
  if (node.style !== "sketch") {
    shapeGroup.appendChild(makeEl("path", Object.assign({
      d: wobblyPath(cornersFor(node), jitter * 0.5, random),
      "stroke-width": (borderDash(node) ? 1.8 : 1.4) * borderScale(node), "stroke-opacity": borderDash(node) || borderScale(node) > 1 ? 0.85 : 0.55,
      "stroke-dasharray": borderDash(node)
    }, ink)));
  }
  /* A rule is drawn in runs, stopping where a merged region spans it, so
     each run still overshoots its ends like a line ruled by hand. */
  var xs = colEdges(node);
  function spans(m, r0, r1, c0, c1) { return m.r <= r0 && m.r + m.rs > r1 && m.c <= c0 && m.c + m.cs > c1; }
  function blocked(a0, a1, b0, b1) { return tableMerges(node).some(function (m) { return spans(m, a0, a1, b0, b1); }); }
  function runs(count, open) {
    var out = [], start = -1;
    for (var i = 0; i <= count; i++) {
      if (i < count && open(i)) { if (start < 0) start = i; }
      else if (start >= 0) { out.push([start, i - 1]); start = -1; }
    }
    return out;
  }
  var ys = rowEdges(node);
  for (r = 1; r < t.rows; r++) {
    var y = ys[r];
    var strong = node.header && r === 1;
    runs(t.cols, function (col) { return !blocked(r - 1, r, col, col); }).forEach(function (run) {
      shapeGroup.appendChild(makeEl("path", Object.assign({
        d: sidePath({ x: xs[run[0]], y: y }, { x: xs[run[1] + 1], y: y }, jitter * 0.5, random),
        "stroke-width": strong ? 2 : 1.2, "stroke-opacity": strong ? 0.85 : 0.6
      }, ink)));
    });
  }
  for (c = 1; c < t.cols; c++) {
    var x = xs[c];
    runs(t.rows, function (row) { return !blocked(row, row, c - 1, c); }).forEach(function (run) {
      shapeGroup.appendChild(makeEl("path", Object.assign({
        d: sidePath({ x: x, y: ys[run[0]] }, { x: x, y: ys[run[1] + 1] }, jitter * 0.5, random),
        "stroke-width": 1.2, "stroke-opacity": 0.6
      }, ink)));
    });
  }

  for (r = 0; r < t.rows; r++) {
    for (c = 0; c < t.cols; c++) {
      if (!node.cells[r][c] || isCovered(node, r, c)) continue;
      var setting = cellFormat(node, r, c, format);
      if (node.inks && node.inks[r][c]) setting.color = node.inks[r][c];
      var spot = cellTextSpot(node, r, c, richLines(node.cells[r][c], setting).length, setting.size);
      setting.anchor = spot.anchor;
      labelGroup.appendChild(styledText(spot.x, spot.y, node.cells[r][c], setting));
    }
  }
}

/* How wide a shape's words may run: its width less some margin, and
   less again for diamonds and ellipses so the words stay inside the
   curve. */
function textRoom(node) {
  var k = node.type === "diamond" ? 0.56 : node.type === "ellipse" ? 0.74 : 1;
  var margin = node.type === "pill" ? node.h * 0.6 : node.type === "note" ? 26 : 18;
  return Math.max(30, node.w * k - margin);
}
/* The title and caption as one block, wrapped to the shape and centred
   on it. A single short title sits exactly where it always has. */
function shapeTextLayout(node, format) {
  var size = format.size, subSize = Math.max(8, size - 2.5), room = textRoom(node);
  var titleLines = node.title ? richLines(node.title, Object.assign({}, format, { wrapWidth: room })).length : 1;
  var subLines = node.sub ? richLines(node.sub, { size: subSize, italic: node.italic, wrapWidth: room }).length : 0;
  var titleH = titleLines * size * 1.25, subH = node.sub ? subLines * subSize * 1.25 + 2 : 0;
  var top = center(node).y - (titleH + subH) / 2 + (node.type === "database" ? dbRim(node) * 0.6 : 0);
  /* one line each: exactly the old spots, so existing sheets do not move */
  if (titleLines === 1 && subLines <= 1) {
    var my = center(node).y;
    return { room: room, subSize: subSize, height: titleH + subH, titleY: node.sub ? my - 3 : my + 4, subY: my + 12 };
  }
  return {
    room: room, subSize: subSize, height: titleH + subH,
    titleY: top + titleH / 2 + size * 0.35,
    subY: top + titleH + 2 + (subH - 2) / 2 + subSize * 0.35
  };
}
function drawNodeLabels(node, labelGroup, mid, format) {
  var lay = shapeTextLayout(node, format);
  labelGroup.appendChild(styledText(mid.x, lay.titleY, node.title, Object.assign({}, format, { wrapWidth: lay.room })));

  if (node.sub) {
    labelGroup.appendChild(styledText(mid.x, lay.subY, node.sub, {
      size: lay.subSize, color: INK_SOFT, italic: node.italic, anchor: "middle", wrapWidth: lay.room
    }));
  }
}
/* A shape grows when its words need more room than it has: boxes, notes
   and pills grow taller, while diamonds and ellipses, which have little
   room near their edges, grow both ways about their centre and keep
   their proportions. A shape never shrinks on its own, so a size someone
   chose stays put. */
function fitShapeText(node) {
  if (!isShape(node) || node.type === "table" || (!node.title && !node.sub)) return;
  var format = { size: node.titleSize || 11.5, bold: node.bold, italic: node.italic };
  var extra = node.type === "diamond" ? 2.1 : node.type === "ellipse" ? 1.5 : 1;
  function need() { return Math.ceil(shapeTextLayout(node, format).height * extra + 18 + (node.type === "database" ? dbRim(node) * 2 : 0)); }
  if (node.type !== "diamond" && node.type !== "ellipse") {
    if (node.h < need()) node.h = need();
    return;
  }
  if (node.h >= need()) return;
  var cx = node.x + node.w / 2, cy = node.y + node.h / 2;
  for (var guard = 0; guard < 60 && node.h < need(); guard++) { node.w *= 1.05; node.h *= 1.05; }
  node.w = Math.round(node.w); node.h = Math.round(node.h);
  node.x = Math.round(cx - node.w / 2); node.y = Math.round(cy - node.h / 2);
}

function drawEdge(edge) {
  var geo = edgeGeometry(edge);
  var shapeGroup = keyedGroup("shapes", edge.id, true);
  var labelGroup = keyedGroup("labels", edge.id, false);
  var hit = keyedHit(edge.id, "path", "edgeId");

  if (!geo) { setAttrs(hit, { d: "M0,0", fill: "none", stroke: "none" }); return; }

  var color = edge.color || LINE;
  var line = {
    d: geo.d, fill: "none", stroke: color, "stroke-width": edge.weight || 1.6,
    "stroke-linecap": "round", "stroke-linejoin": "round"
  };
  if (edge.dashed) line["stroke-dasharray"] = "6 5";
  line["data-line"] = "1";
  shapeGroup.appendChild(makeEl("path", line));
  /* The paper filter sizes itself to the group's box, and a level or
     upright line with no head has no height or width, so it would vanish.
     An unseen frame a few px round the ends gives it room. */
  shapeGroup.appendChild(makeEl("rect", {
    x: (Math.min(geo.start.x, geo.end.x) - 4).toFixed(1), y: (Math.min(geo.start.y, geo.end.y) - 4).toFixed(1),
    width: (Math.abs(geo.end.x - geo.start.x) + 8).toFixed(1), height: (Math.abs(geo.end.y - geo.start.y) + 8).toFixed(1),
    fill: "none", stroke: "none", "pointer-events": "none"
  }));

  if (edge.head !== "none") {
    shapeGroup.appendChild(makeEl("path", {
      d: arrowheadPath(edge),
      fill: "none", stroke: color, "stroke-width": edge.weight || 1.6,
      "stroke-linecap": "round", "stroke-linejoin": "round",
      transform: "translate(" + geo.tip.x.toFixed(1) + "," + geo.tip.y.toFixed(1) + ") rotate(" + geo.tip.angle.toFixed(1) + ")"
    }));
  }
  if (edge.tail === "arrow") {
    var backAngle = angleBetween(geo.handles.length ? { x: geo.handles[0].x, y: geo.handles[0].y } : geo.end, geo.start);
    shapeGroup.appendChild(makeEl("path", {
      d: arrowheadPath(edge),
      fill: "none", stroke: color, "stroke-width": edge.weight || 1.6,
      "stroke-linecap": "round", "stroke-linejoin": "round",
      transform: "translate(" + geo.start.x.toFixed(1) + "," + geo.start.y.toFixed(1) + ") rotate(" + backAngle.toFixed(1) + ")"
    }));
  }

  if (edge.label) {
    var format = {
      size: edge.labelSize || 9.5, color: edge.labelColor || color,
      bold: edge.bold, italic: edge.italic, strike: edge.strike, anchor: "middle"
    };
    if (edge.onPath) {
      var guideId = "guide-" + edge.id;
      var guide = makeEl("path", { id: guideId, d: geo.end.x < geo.start.x ? geo.reversed : geo.d, fill: "none" });
      guide.dataset.generated = "1";
      defs.appendChild(guide);

      var riding = styledText(0, 0, "", format);
      riding.removeAttribute("x"); riding.removeAttribute("y");
      riding.setAttribute("dy", -5);
      var textPath = makeEl("textPath", { href: "#" + guideId, startOffset: "50%" });
      textPath.setAttribute("xlink:href", "#" + guideId);
      appendRuns(textPath, [].concat.apply([], richLines(edge.label.replace(/\n/g, " "), format)), format);
      riding.appendChild(textPath);
      labelGroup.appendChild(riding);
    } else {
      labelGroup.appendChild(styledText(geo.mid.x, geo.mid.y - 6, edge.label, format));
    }
  }

  setAttrs(hit, { d: geo.d, fill: "none", stroke: "transparent", "stroke-width": 14, cursor: "pointer" });
}

function drawFreeText(item) {
  var labelGroup = keyedGroup("labels", item.id, false);
  var node = styledText(item.x, item.y, item.text, {
    size: item.size, color: item.color, bold: item.bold, italic: item.italic,
    strike: item.strike, underline: item.underline,
    weight: item.weight || 400, anchor: item.anchor,
    wrapWidth: item.w > 0 ? item.w : null
  });
  labelGroup.appendChild(node);
  measureText(item);
}
/* A text's box, for its hit target, its selection outline and the typing
   box. Only text already on the page can be measured, so a new one is
   measured again once it is placed. Empty text gets a box one line tall
   where its first line would be. */
function measureText(item) {
  var g = keyCache.labels.get(item.id);
  if (!g || !g.isConnected) return;
  var b = g.getBBox();
  var box = b.width || b.height ? { x: b.x, y: b.y, width: b.width, height: b.height }
    : { x: item.anchor === "middle" ? item.x - 20 : item.anchor === "end" ? item.x - 40 : item.x, y: item.y - item.size * 0.95, width: 40, height: item.size * 1.25 };
  textBounds[item.id] = box;
  var hit = keyedHit(item.id, "rect", "textId");
  setAttrs(hit, {
    x: box.x - 4, y: box.y - 4,
    width: Math.max(box.width + 8, 16), height: Math.max(box.height + 8, 16),
    fill: "transparent", cursor: "move"
  });
}

/* ================================================================
   10b. Flow along arrows
        Something travels along a flowing arrow toward the shape it
        points at, in one of three hand-drawn styles:
          ink      a swell of ink slides along: the line itself thickens
                   for a moment, like something squeezed through a
                   fabric tube, then settles
          ball     little wobbly pebbles that rock as they go
          chevron  open > marks, the arrowhead's own shape, marching on
        Each grows in after leaving the start and settles before the
        arrowhead. Positions come from time alone, so the video export
        can draw any moment.
   ================================================================ */
var flowLayer = $("flows");
var flowFrame = null;
var FLOW_PACE = 46, FLOW_SPAN = 30;   /* px per second at normal speed, ink swell length */
var FLOW_STYLES = [["ink", "Ink swell"], ["ball", "Balls"], ["chevron", "Chevrons"]];
var FLOW_GAPS = { ink: 130, ball: 58, chevron: 30 };

function flowingEdges() { return edges().filter(function (e) { return e.flow; }); }

/* One swell: a closed shape that hugs the line from at - span/2 to
   at + span/2, widest in the middle and tapering to the line's own
   width at both ends, with a little hand-drawn unevenness. */
function swellPath(line, len, at, w, puff, random) {
  var steps = 10, left = [], right = [];
  for (var i = 0; i <= steps; i++) {
    var t = i / steps, s = clamp(at - FLOW_SPAN / 2 + t * FLOW_SPAN, 0, len);
    var p = line.getPointAtLength(s), q = line.getPointAtLength(Math.min(len, s + 0.8)), b = line.getPointAtLength(Math.max(0, s - 0.8));
    var dx = q.x - b.x, dy = q.y - b.y, n = Math.hypot(dx, dy) || 1;
    var half = w / 2 + puff * Math.pow(Math.sin(Math.PI * t), 1.5) * (0.85 + random() * 0.3);
    left.push({ x: p.x - dy / n * half, y: p.y + dx / n * half });
    right.push({ x: p.x + dy / n * half, y: p.y - dx / n * half });
  }
  var pts = left.concat(right.reverse()), f = function (v) { return v.toFixed(1); };
  return "M" + pts.map(function (pt) { return f(pt.x) + "," + f(pt.y); }).join(" L") + " Z";
}
/* One pebble, drawn around 0,0 the way the sheet draws shapes: a filled
   wobbly blob and a pen outline laid slightly off it. */
function pebblePaths(seed, r) {
  var random = makeRandom(hashOf(seed)), pts = [];
  for (var i = 0; i < 9; i++) {
    var a = (i / 9) * Math.PI * 2, rr = r * (0.86 + random() * 0.28);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  return {
    body: closedPath(pts, r * 0.12, random),
    pen: closedPath(jitterPoints(pts, r * 0.16, random), r * 0.14, random)
  };
}
function drawFlows(ms) {
  clear(flowLayer);
  flowingEdges().forEach(function (e) {
    var group = keyCache.shapes.get(e.id), line = group && group.querySelector("path[data-line]");
    if (!line) return;
    var style = FLOW_GAPS[e.flowStyle] ? e.flowStyle : "ink";
    var len = line.getTotalLength(), margin = style === "ink" ? FLOW_SPAN / 2 : 0;
    if (len < 2 * margin + 24) return;
    var count = Math.max(1, Math.floor(len / FLOW_GAPS[style])), gap = len / count;
    var shift = (ms / 1000 * FLOW_PACE * (e.flowSpeed || 1)) % gap;
    var color = e.color || LINE, w = e.weight || 1.6;
    var holder = makeEl("g", { "data-key": e.id });
    holder.style.opacity = group.style.opacity;   /* hidden while the reveal hides the arrow */
    for (var i = 0; i < count; i++) {
      var at = i * gap + shift;
      var grow = clamp(Math.min((at - margin) / 22, (len - at - margin - 12) / 22), 0, 1);
      if (grow <= 0) continue;
      var random = makeRandom(hashOf(e.id + ":" + i));
      if (style === "ink") {
        holder.appendChild(makeEl("path", {
          d: swellPath(line, len, at, w, (1.3 + w * 0.9) * grow, random),
          fill: color, "fill-opacity": (0.55 + 0.4 * grow).toFixed(2)
        }));
        continue;
      }
      var p = line.getPointAtLength(at), q = line.getPointAtLength(Math.min(len, at + 1.5));
      var heading = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      if (style === "ball") {
        var r = 2.6 + w * 0.5, shape = pebblePaths(e.id + ":" + i, r);
        /* it faces the way it travels and rocks a little as it goes */
        var pebble = makeEl("g", {
          transform: "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ") rotate(" + (heading + 24 * Math.sin(at / 9)).toFixed(1) + ") scale(" + (0.7 + 0.3 * grow).toFixed(2) + ")",
          opacity: grow.toFixed(2)
        });
        pebble.appendChild(makeEl("path", { d: shape.body, fill: color, "fill-opacity": 0.78 }));
        pebble.appendChild(makeEl("path", {
          d: shape.pen, fill: "none", stroke: color, "stroke-width": Math.max(0.8, w * 0.6).toFixed(2),
          "stroke-linecap": "round", "stroke-linejoin": "round"
        }));
        holder.appendChild(pebble);
      } else {
        /* the arrowhead's open shape, a touch uneven, drawn by the same pen */
        var size = 3.2 + w * 0.9, j = function () { return ((random() * 2 - 1) * size * 0.12).toFixed(2); };
        holder.appendChild(makeEl("path", {
          d: "M" + (-size) + "," + (-size * 0.85 + +j()) + " L" + j() + "," + j() + " L" + (-size) + "," + (size * 0.85 + +j()),
          transform: "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ") rotate(" + heading.toFixed(1) + ") scale(" + (0.6 + 0.4 * grow).toFixed(2) + ")",
          fill: "none", stroke: color, "stroke-width": Math.max(1.1, w * 0.85).toFixed(2),
          "stroke-linecap": "round", "stroke-linejoin": "round", opacity: grow.toFixed(2)
        }));
      }
    }
    flowLayer.appendChild(holder);
  });
}
/* Runs while any arrow on the sheet flows. With reduced motion on, the
   balls are drawn once and stay put. */
function syncFlows() {
  var want = flowingEdges().length > 0;
  if (want && !reduceMotion && !flowFrame) {
    flowFrame = requestAnimationFrame(function tick(now) { drawFlows(now); flowFrame = requestAnimationFrame(tick); });
  }
  if ((!want || reduceMotion) && flowFrame) { cancelAnimationFrame(flowFrame); flowFrame = null; }
  drawFlows(reduceMotion ? 0 : performance.now());
}

function renderCanvas() {
  var p = page();
  paintPaper();

  Array.prototype.forEach.call(defs.querySelectorAll("[data-generated]"), function (n) {
    n.parentNode.removeChild(n);
  });

  var order = [];
  edges().forEach(function (e) { drawEdge(e); order.push(e.id); });
  nodes().forEach(function (n) { drawNode(n); order.push(n.id); });
  texts().forEach(function (t) { drawFreeText(t); order.push(t.id); });

  /* A shape's words sit right on top of its own body, so bringing a
     picture forward covers the text of whatever is behind it. Arrow
     labels and free text sit on the top layer above every shape, except
     for anything sent to the back (drawn under it all) or brought to the
     front (drawn over it all), which keeps its words with it. */
  var bottom = [], top = [], st = stackOrder(), hitOrder = [];
  function whole(id) { return [keyCache.shapes.get(id), keyCache.labels.get(id)]; }
  st.back.forEach(function (it) { bottom.push.apply(bottom, whole(it.id)); hitOrder.push(it.id); });
  st.middle.forEach(function (it) { if (it.from !== undefined) { bottom.push(keyCache.shapes.get(it.id)); top.push(keyCache.labels.get(it.id)); hitOrder.push(it.id); } });
  st.middle.forEach(function (it) { if (it.from === undefined && it.text === undefined) { bottom.push.apply(bottom, whole(it.id)); hitOrder.push(it.id); } });
  st.middle.forEach(function (it) { if (it.text !== undefined && it.anchor !== undefined) { top.push(keyCache.labels.get(it.id)); hitOrder.push(it.id); } });
  st.front.forEach(function (it) { top.push.apply(top, whole(it.id)); hitOrder.push(it.id); });
  syncChildren(shapesLayer, bottom);
  syncChildren(labelsLayer, top);
  order = hitOrder;
  texts().forEach(measureText);
  pruneCache(keyCache.shapes, order);
  pruneCache(keyCache.labels, order);
  syncLayer(hitsGroup, keyCache.hits, order);

  document.body.classList.toggle("no-texture", !textureOn);
  syncFlows();
  drawOverlay();
}

