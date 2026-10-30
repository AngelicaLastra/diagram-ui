/* ================================================================
   6. Text nodes  (multi-line aware)
   ================================================================ */
/* Text can carry formatting inside it, written the way chat apps do:
   **bold**, *italic*, ++underline++, ~~strikethrough~~ and `code`. A
   marker only counts when it hugs a word (no space just inside it) and
   has a partner later on the line, so "2 * 3" and "C++" stay as typed;
   a backslash keeps a marker literal. Underscores are left alone, since
   names like school_id are common. Colour wraps words as
   {#D9480F}these words{/} and can hold the other formats inside. */
var RICH_MARKS = [["**", "b"], ["++", "u"], ["~~", "s"], ["*", "i"]];
var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function parseRich(line) {
  var runs = [], buf = "", style = { b: false, i: false, u: false, s: false }, inks = [];
  function ink() { return inks.length ? inks[inks.length - 1] : null; }
  function flush() {
    if (!buf) return;
    var last = runs[runs.length - 1];
    if (last && !last.code && last.b === style.b && last.i === style.i && last.u === style.u && last.s === style.s && last.c === ink()) last.text += buf;
    else runs.push({ text: buf, b: style.b, i: style.i, u: style.u, s: style.s, c: ink(), code: false });
    buf = "";
  }
  function closes(mark, from) {
    for (var j = line.indexOf(mark, from); j >= 0; j = line.indexOf(mark, j + 1)) {
      if (!/\s/.test(line[j - 1]) && line[j - 1] !== "\\") return true;
    }
    return false;
  }
  for (var i = 0; i < line.length;) {
    var ch = line[i];
    if (ch === "\\" && i + 1 < line.length && "*+~`{\\".indexOf(line[i + 1]) >= 0) { buf += line[i + 1]; i += 2; continue; }
    if (ch === "{") {
      var opens = /^\{#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\}/.exec(line.slice(i));
      if (opens && line.indexOf("{/}", i + opens[0].length) >= 0) { flush(); inks.push(parseHex(opens[1])); i += opens[0].length; continue; }
      if (line.substr(i, 3) === "{/}" && inks.length) { flush(); inks.pop(); i += 3; continue; }
    }
    if (ch === "`") {
      var shut = line.indexOf("`", i + 1);
      if (shut > i + 1) {
        flush();
        runs.push({ text: line.slice(i + 1, shut), b: style.b, i: style.i, u: style.u, s: style.s, c: ink(), code: true });
        i = shut + 1;
        continue;
      }
    }
    var hit = null;
    for (var m = 0; m < RICH_MARKS.length && !hit; m++) {
      var mark = RICH_MARKS[m][0], key = RICH_MARKS[m][1];
      if (line.substr(i, mark.length) !== mark) continue;
      if (style[key] && i > 0 && !/\s/.test(line[i - 1])) hit = { mark: mark, key: key, on: false };
      else if (!style[key] && i + mark.length < line.length && !/\s/.test(line[i + mark.length]) &&
               closes(mark, i + mark.length + 1)) hit = { mark: mark, key: key, on: true };
    }
    if (hit) { flush(); style[hit.key] = hit.on; i += hit.mark.length; continue; }
    buf += ch; i++;
  }
  flush();
  return runs;
}
/* The words without their markers, for lists and labels. */
function plainText(text) {
  return String(text == null ? "" : text).split("\n").map(function (l) {
    return parseRich(l).map(function (r) { return r.text; }).join("");
  }).join("\n");
}

/* Measuring uses the same fonts the sheet draws with. */
var measurer = null;
function runFont(run, format) {
  var size = run.code ? format.size * 0.92 : format.size;
  var weight = format.bold || run.b ? 700 : (format.weight || 400);
  return (format.italic || run.i ? "italic " : "") + weight + " " + size + "px " +
         (run.code ? MONO : "Poppins, system-ui, sans-serif");
}
function runWidth(run, format) {
  measurer = measurer || document.createElement("canvas").getContext("2d");
  measurer.font = runFont(run, format);
  return measurer.measureText(run.text).width;
}
function sameStyle(a, b) { return a.b === b.b && a.i === b.i && a.u === b.u && a.s === b.s && a.code === b.code && a.c === b.c; }

/* Lines of runs. With format.wrapWidth, lines break between words to fit,
   and a word wider than the line is split by letters. */
function richLines(content, format) {
  var out = [];
  String(content == null ? "" : content).split("\n").forEach(function (para) {
    var runs = parseRich(para);
    if (!format.wrapWidth) {
      /* spaces at the end of a line would only nudge it off centre */
      var tail = runs[runs.length - 1];
      if (tail && tail.text) tail.text = tail.text.replace(/\s+$/, "");
      out.push(runs);
      return;
    }
    /* spaces at the start of a typed line are an indent and stay; a line
       started by wrapping drops them */
    var max = format.wrapWidth, line = [], used = 0, typedStart = true;
    function put(text, run) {
      var last = line[line.length - 1];
      if (last && sameStyle(last, run)) last.text += text;
      else line.push(Object.assign({}, run, { text: text }));
    }
    function breakLine() {
      while (line.length && !line[line.length - 1].text.trim()) line.pop();
      if (line.length) line[line.length - 1].text = line[line.length - 1].text.replace(/\s+$/, "");
      out.push(line); line = []; used = 0; typedStart = false;
    }
    runs.forEach(function (run) {
      run.text.split(/(\s+)/).forEach(function (tok) {
        if (!tok) return;
        var w = runWidth(Object.assign({}, run, { text: tok }), format);
        if (!tok.trim()) { if (line.length || typedStart) { put(tok, run); used += w; } return; }
        if (used + w > max && line.length) breakLine();
        while (w > max && tok.length > 1) {
          var cut = tok.length - 1;
          while (cut > 1 && runWidth(Object.assign({}, run, { text: tok.slice(0, cut) }), format) > max) cut--;
          put(tok.slice(0, cut), run);
          breakLine();
          tok = tok.slice(cut);
          w = runWidth(Object.assign({}, run, { text: tok }), format);
        }
        put(tok, run); used += w;
      });
    });
    breakLine();
  });
  return out;
}
function appendRuns(parent, runs, format) {
  runs.forEach(function (r) {
    var t = makeEl("tspan", {});
    if (r.b && !format.bold) t.setAttribute("font-weight", 700);
    if (r.i && !format.italic) t.setAttribute("font-style", "italic");
    if (r.u || r.s) {
      var deco = [];
      if (r.u || format.underline) deco.push("underline");
      if (r.s || format.strike) deco.push("line-through");
      t.setAttribute("text-decoration", deco.join(" "));
    }
    if (r.code) { t.setAttribute("font-family", MONO); t.setAttribute("font-size", (format.size * 0.92).toFixed(2)); }
    if (r.c) t.setAttribute("fill", r.c);
    t.textContent = r.text;
    parent.appendChild(t);
  });
}

/* Draws text with its lines centred around y. Returns the <text>, or a
   group holding it when inline code needs its soft background. */
function styledText(x, y, content, format) {
  var decorations = [];
  if (format.strike) decorations.push("line-through");
  if (format.underline) decorations.push("underline");

  var node = makeEl("text", {
    x: x, y: y,
    "font-size": format.size,
    "font-weight": format.bold ? 700 : (format.weight || 400),
    "font-style": format.italic ? "italic" : "normal",
    fill: format.color,
    "text-anchor": format.anchor || "start"
  });
  if (decorations.length) node.setAttribute("text-decoration", decorations.join(" "));
  /* keep every space as typed: SVG would otherwise fold runs of them
     into one, and indents (like a folder tree) would lose their shape */
  node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  node.style.whiteSpace = "pre";

  var lines = richLines(content, format);
  var plain = lines.every(function (l) { return l.every(function (r) { return !r.b && !r.i && !r.u && !r.s && !r.code && !r.c; }); });
  if (lines.length === 1 && plain) {
    node.textContent = lines[0].map(function (r) { return r.text; }).join("");
    return node;
  }
  var lh = format.size * 1.25;
  var top = y - ((lines.length - 1) * lh) / 2;
  var marks = [];
  lines.forEach(function (line, i) {
    var ly = lines.length === 1 ? y : top + i * lh;
    var span = lines.length === 1 ? node : makeEl("tspan", { x: x, y: ly.toFixed(1) });
    if (!line.length) span.textContent = " ";
    else appendRuns(span, line, format);
    if (span !== node) node.appendChild(span);
    if (line.some(function (r) { return r.code; })) {
      var widths = line.map(function (r) { return runWidth(r, format); });
      var total = widths.reduce(function (a, b) { return a + b; }, 0);
      var anchor = format.anchor || "start";
      var at = anchor === "middle" ? x - total / 2 : anchor === "end" ? x - total : x;
      line.forEach(function (r, j) {
        if (r.code) marks.push({ x: at - 2.5, y: ly - format.size * 0.86, w: widths[j] + 5, h: format.size * 1.16 });
        at += widths[j];
      });
    }
  });
  if (!marks.length) return node;
  var g = makeEl("g", {});
  marks.forEach(function (m) {
    g.appendChild(makeEl("rect", {
      x: m.x.toFixed(1), y: m.y.toFixed(1), width: m.w.toFixed(1), height: m.h.toFixed(1),
      rx: 3, fill: format.color || INK, "fill-opacity": 0.09
    }));
  });
  g.appendChild(node);
  return g;
}


