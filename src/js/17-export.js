/* ================================================================
   24. Export and files
   ================================================================ */
/* The area an export covers: everything drawn plus a margin, or what is in
   view when the sheet is empty. */
/* The items a "selected only" export keeps: what is selected, plus any
   arrow whose two ends are both selected. Null means the whole sheet. */
function selectionScope() {
  if (!sel.size) return null;
  var ids = new Set(sel);
  edges().forEach(function (e) { if (ids.has(e.from) && ids.has(e.to)) ids.add(e.id); });
  return ids;
}
/* The box around just these items, read from the drawn sheet. */
function scopeBounds(only) {
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  Array.prototype.forEach.call(stage.querySelectorAll("#shapes [data-key], #labels [data-key]"), function (g) {
    if (!only.has(g.getAttribute("data-key")) || !g.childNodes.length) return;
    var b = g.getBBox();
    if (!b.width && !b.height) return;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  });
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function exportBox(only) {
  var b = only ? scopeBounds(only) : contentBounds(), pad = 32;
  if (!b) return { x: Math.round(view.x), y: Math.round(view.y), w: Math.round(view.w), h: Math.round(view.h) };
  return {
    x: Math.floor(b.x - pad), y: Math.floor(b.y - pad),
    w: Math.ceil(b.w + pad * 2), h: Math.ceil(b.h + pad * 2)
  };
}

/* opts.transparent drops the paper and grid; opts.opacityOf(key) lets the
   GIF export draw any moment of the reveal; opts.box fixes the area so
   every GIF frame lines up. */
function buildSvgString(withSize, opts) {
  opts = opts || {};
  var box = opts.box || exportBox(opts.only);
  var copy = stage.cloneNode(true);
  ["overlay", "hits"].concat(opts.transparent ? ["bg", "gridRect"] : []).forEach(function (id) {
    var g = copy.querySelector("#" + id);
    if (g) g.parentNode.removeChild(g);
  });
  if (opts.only) {
    Array.prototype.forEach.call(copy.querySelectorAll("[data-key]"), function (g) {
      if (!opts.only.has(g.getAttribute("data-key"))) g.parentNode.removeChild(g);
    });
  }
  Array.prototype.forEach.call(copy.querySelectorAll("[data-key]"), function (g) {
    g.style.opacity = opts.opacityOf ? String(opts.opacityOf(g.getAttribute("data-key"))) : "";
  });
  if (!textureOn) {
    Array.prototype.forEach.call(copy.querySelectorAll("#shapes g[data-key]"), function (g) { g.removeAttribute("filter"); });
  }
  ["bg", "gridRect"].forEach(function (id) {
    var r = copy.querySelector("#" + id);
    if (r) setAttrs(r, { x: box.x, y: box.y, width: box.w, height: box.h });
  });
  copy.setAttribute("viewBox", [box.x, box.y, box.w, box.h].join(" "));
  copy.setAttribute("xmlns", NS);
  copy.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  if (withSize) { copy.setAttribute("width", box.w); copy.setAttribute("height", box.h); }
  copy.removeAttribute("style");
  copy.removeAttribute("class");
  return new XMLSerializer().serializeToString(copy);
}
function download(filename, data, type) {
  var blob = data instanceof Blob ? data : new Blob([data], { type: type });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}
function fileBase() {
  return (doc.title || "diagram").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "diagram";
}
function exportPng(scale, only) {
  var p = exportBox(only);
  var svgBlob = new Blob([buildSvgString(true, { box: p, only: only })], { type: "image/svg+xml;charset=utf-8" });
  var url = URL.createObjectURL(svgBlob);
  var image = new Image();
  image.onload = function () {
    var canvas = document.createElement("canvas");
    canvas.width = p.w * scale; canvas.height = p.h * scale;
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(function (blob) {
      if (!blob) { toast("This browser could not make the PNG. Try SVG."); return; }
      download(fileBase() + (only ? "-selection" : "") + "@" + scale + "x.png", blob);
      toast("Saved the PNG at " + scale + "×");
    }, "image/png");
  };
  image.onerror = function () { URL.revokeObjectURL(url); toast("This browser could not make the PNG. Try SVG."); };
  image.src = url;
}
/* ================================================================
   24b. GIF export
        A small GIF89a encoder: one shared palette (built from the
        finished sheet), LZW, and frames that only store what changed.
        Index 255 is kept free to mean "clear" in transparent GIFs and
        "same as before" in every frame after the first.
   ================================================================ */
var GIF_KEEP = 255;
var GIF_ALPHA_CUT = 100;   /* below this a pixel counts as empty in a transparent GIF */
var gifOptions = { animated: true, background: true, scale: 1 };
var gifJob = null;

function colorKey(r, g, b) { return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); }

function gifHistogram(px, transparent) {
  var hist = new Uint32Array(32768);
  for (var i = 0; i < px.length; i += 4) {
    if (transparent && px[i + 3] < GIF_ALPHA_CUT) continue;
    hist[colorKey(px[i], px[i + 1], px[i + 2])] += 4;
    /* the half-faded version of each colour, for the fade frames */
    if (!transparent) hist[colorKey((px[i] + 255) >> 1, (px[i + 1] + 255) >> 1, (px[i + 2] + 255) >> 1)] += 1;
  }
  return hist;
}
/* Diagrams are big flat areas, so colours are taken by how much of the
   sheet they cover, skipping any that sit too close to one already
   taken. The gap shrinks each pass until the palette is full, which still
   leaves room for the in-between shades of photos and fades. */
function gifPalette(hist, maxColors) {
  var candidates = [];
  for (var k = 0; k < 32768; k++) {
    if (!hist[k]) continue;
    var r = (k >> 10) & 31, g = (k >> 5) & 31, b = k & 31;
    candidates.push({ c: [(r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2)], n: hist[k] });
  }
  if (!candidates.length) return [[255, 255, 255]];
  candidates.sort(function (a, b) { return b.n - a.n; });
  var palette = [], taken = new Uint8Array(candidates.length);
  [48, 28, 16, 8, 0].forEach(function (gap) {
    var limit = gap * gap;
    for (var i = 0; i < candidates.length && palette.length < maxColors; i++) {
      if (taken[i]) continue;
      var c = candidates[i].c, near = false;
      for (var p = 0; p < palette.length && !near; p++) {
        var dr = palette[p][0] - c[0], dg = palette[p][1] - c[1], db = palette[p][2] - c[2];
        near = dr * dr + dg * dg + db * db < limit;
      }
      if (!near || gap === 0) { palette.push(c); taken[i] = 1; }
    }
  });
  return palette;
}
function gifMapper(palette, transparent) {
  var cache = new Int16Array(32768).fill(-1);
  return function (px) {
    var out = new Uint8Array(px.length / 4);
    for (var i = 0, o = 0; i < px.length; i += 4, o++) {
      if (transparent && px[i + 3] < GIF_ALPHA_CUT) { out[o] = GIF_KEEP; continue; }
      var key = colorKey(px[i], px[i + 1], px[i + 2]);
      var hit = cache[key];
      if (hit < 0) {
        var r = px[i], g = px[i + 1], b = px[i + 2], best = 1e9;
        for (var p = 0; p < palette.length; p++) {
          var dr = palette[p][0] - r, dg = palette[p][1] - g, db = palette[p][2] - b;
          var d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
          if (d < best) { best = d; hit = p; }
        }
        cache[key] = hit;
      }
      out[o] = hit;
    }
    return out;
  };
}
function lzwEncode(indices) {
  var minSize = 8, clearCode = 256, endCode = 257;
  var out = [], acc = 0, bits = 0, size = minSize + 1, next = endCode + 1;
  var table = new Map();
  function emit(code) {
    acc |= code << bits; bits += size;
    while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
  }
  emit(clearCode);
  var cur = indices[0];
  for (var i = 1; i < indices.length; i++) {
    var k = indices[i], key = (cur << 8) | k, found = table.get(key);
    if (found !== undefined) { cur = found; continue; }
    emit(cur);
    if (next === 4096) {
      emit(clearCode);
      table.clear(); next = endCode + 1; size = minSize + 1;
    } else {
      if (next >= (1 << size)) size++;
      table.set(key, next++);
    }
    cur = k;
  }
  emit(cur);
  emit(endCode);
  if (bits > 0) out.push(acc & 255);
  return out;
}
/* True when a pixel that was coloured has to become clear, which only
   happens in a transparent GIF when a step hides something. */
function erasesPixels(prev, idx) {
  for (var i = 0; i < idx.length; i++) if (idx[i] === GIF_KEEP && prev[i] !== GIF_KEEP) return true;
  return false;
}
function keepUnchanged(idx, prev) {
  var out = new Uint8Array(idx.length);
  for (var i = 0; i < idx.length; i++) out[i] = idx[i] === prev[i] ? GIF_KEEP : idx[i];
  return out;
}
/* Only the box that changed since the last frame is stored, and inside
   it the untouched pixels are written as "keep". */
function gifFrame(idx, prev, w, h) {
  if (!prev) return { x: 0, y: 0, w: w, h: h, data: lzwEncode(idx) };
  var x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      if (idx[y * w + x] !== prev[y * w + x]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  var fw = x1 - x0 + 1, fh = y1 - y0 + 1, part = new Uint8Array(fw * fh);
  for (var yy = 0; yy < fh; yy++) {
    for (var xx = 0; xx < fw; xx++) {
      var at = (y0 + yy) * w + x0 + xx;
      part[yy * fw + xx] = idx[at] === prev[at] ? GIF_KEEP : idx[at];
    }
  }
  return { x: x0, y: y0, w: fw, h: fh, data: lzwEncode(part) };
}
function writeGif(w, h, palette, frames, loop) {
  var bytes = [];
  function u16(v) { bytes.push(v & 255, (v >> 8) & 255); }
  function ascii(t) { for (var i = 0; i < t.length; i++) bytes.push(t.charCodeAt(i)); }
  ascii("GIF89a"); u16(w); u16(h);
  bytes.push(0xF7, 0, 0);
  for (var c = 0; c < 256; c++) { var col = palette[c] || [0, 0, 0]; bytes.push(col[0], col[1], col[2]); }
  if (loop) { bytes.push(0x21, 0xFF, 0x0B); ascii("NETSCAPE2.0"); bytes.push(3, 1); u16(0); bytes.push(0); }
  frames.forEach(function (f) {
    /* disposal 1 leaves the frame in place; 2 clears it after showing */
    bytes.push(0x21, 0xF9, 4, ((f.dispose || 1) << 2) | 1);
    u16(Math.max(2, Math.round(f.delay / 10)));
    bytes.push(GIF_KEEP, 0);
    bytes.push(0x2C); u16(f.x); u16(f.y); u16(f.w); u16(f.h); bytes.push(0);
    bytes.push(8);
    for (var i = 0; i < f.data.length; i += 255) {
      var chunk = f.data.slice(i, i + 255);
      bytes.push(chunk.length);
      for (var j = 0; j < chunk.length; j++) bytes.push(chunk[j]);
    }
    bytes.push(0);
  });
  bytes.push(0x3B);
  return new Uint8Array(bytes);
}

var gifCanvas = null;
function rasterize(svg, w, h, done, fail) {
  var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  var image = new Image();
  image.onload = function () {
    if (!gifCanvas) gifCanvas = document.createElement("canvas");
    gifCanvas.width = w; gifCanvas.height = h;
    var g = gifCanvas.getContext("2d", { willReadFrequently: true });
    g.clearRect(0, 0, w, h);
    g.drawImage(image, 0, 0, w, h);
    URL.revokeObjectURL(url);
    done(g.getImageData(0, 0, w, h).data);
  };
  image.onerror = function () { URL.revokeObjectURL(url); fail(); };
  image.src = url;
}

/* The frames follow Play: the same order, the same speed setting and
   the same 200ms fade (skipped when transparent, since GIF has no soft
   edges). The last frame holds so the finished sheet can be read. */
/* The reveal with only the given items in it: steps left empty go, and
   their pauses with them. */
function scopedReveal(only) {
  var r = revealSteps();
  if (!only) return r;
  var steps = [], pauses = [];
  r.steps.forEach(function (st, i) {
    var kept = st.filter(function (e) { return only.has(e.id); });
    if (kept.length) { steps.push(kept); pauses.push(r.pauses[i]); }
  });
  return { start: r.start.filter(function (k) { return only.has(k); }), steps: steps, pauses: pauses, endPause: r.endPause, custom: r.custom };
}
function gifPlan(opts) {
  var plan = scopedReveal(opts.only), steps = plan.steps;
  if (!opts.animated || !steps.length) return { steps: steps, frames: [{ all: true, delay: 0 }] };
  var step = parseInt($("speed").value, 10) || 700;
  var frames = [{ visible: 0, partial: 0, delay: 500 }];
  steps.forEach(function (st, i) {
    /* a pause stretches whatever frame is on screen before this step */
    frames[frames.length - 1].delay += plan.pauses[i] * 1000;
    if (opts.background) {
      frames.push({ visible: i, partial: 1 / 3, delay: 70 }, { visible: i, partial: 2 / 3, delay: 70 });
      frames.push({ visible: i + 1, partial: 0, delay: Math.max(60, step - 140) });
    } else {
      frames.push({ visible: i + 1, partial: 0, delay: step });
    }
  });
  frames[frames.length - 1].delay += 2500 + plan.endPause * 1000;
  return { steps: steps, frames: frames };
}
function exportGif(opts, onProgress, onDone, onFail) {
  stopReveal();
  sel.clear(); closeEditor(true); render();
  var box = exportBox(opts.only), w = Math.round(box.w * opts.scale), h = Math.round(box.h * opts.scale);
  var plan = gifPlan(opts), timeline = {};
  plan.steps.forEach(function (st, i) {
    st.forEach(function (e) {
      var t = timeline[e.id] || (timeline[e.id] = { show: -1, hide: null });
      if (e.hide) t.hide = i; else t.show = i;
    });
  });
  var job = { cancelled: false };

  function svgFor(f) {
    return buildSvgString(true, {
      box: box, only: opts.only,
      transparent: !opts.background,
      /* how far each step has got at this frame: done, fading, or not yet */
      opacityOf: function (key) {
        var t = timeline[key];
        if (!t || f.all) return 1;
        function reached(i) { return i < f.visible ? 1 : i === f.visible ? f.partial : 0; }
        var shown = t.show < 0 ? 1 : reached(t.show);
        var gone = t.hide === null ? 0 : reached(t.hide);
        return Math.max(0, shown - gone);
      }
    });
  }
  /* the palette comes from the sheet with everything showing, hidden things included */
  rasterize(svgFor({ all: true }), w, h, function (finished) {
    var palette = gifPalette(gifHistogram(finished, !opts.background), 255);
    var toIndices = gifMapper(palette, !opts.background);
    /* shown: what the last stored frame leaves on screen; before: what was
       on screen before it, which is what its "keep" pixels point back to */
    var frames = [], shown = null, before = null, i = 0;
    (function next() {
      if (job.cancelled) return;
      if (i >= plan.frames.length) { onDone(writeGif(w, h, palette, frames, opts.animated)); return; }
      onProgress(i, plan.frames.length);
      var f = plan.frames[i++];
      rasterize(svgFor(f), w, h, function (px) {
        var idx = toIndices(px);
        var frame;
        if (shown && erasesPixels(shown, idx)) {
          /* "Keep" can't turn a coloured pixel clear again. So the frame
             before this one is stored whole and marked to clear the
             canvas once it has been shown, and this one is drawn whole
             on that clean canvas. */
          var last = frames[frames.length - 1];
          /* a frame drawn on a cleared canvas has nothing under it to keep */
          var whole = last.onClean ? shown : keepUnchanged(shown, before);
          last.x = 0; last.y = 0; last.w = w; last.h = h;
          last.data = lzwEncode(whole);
          last.dispose = 2;
          frame = { x: 0, y: 0, w: w, h: h, data: lzwEncode(idx), onClean: true };
        } else {
          frame = gifFrame(idx, shown, w, h);
          if (frame) frame.onClean = !frames.length;
        }
        if (frame) {
          frame.delay = f.delay;
          frames.push(frame);
          before = shown;
          shown = idx;
        } else if (frames.length) {
          frames[frames.length - 1].delay += f.delay;
        }
        setTimeout(next, 0);
      }, onFail);
    })();
  }, onFail);
  return job;
}

/* The GIF and video dialogs remember the selection they were opened
   with, since exporting clears it from the screen. */
var exportPick = null;
function exportScopeRow(m, options, redraw) {
  if (!exportPick) { options.only = null; return; }
  var row = htmlEl("div", "gif-row");
  row.appendChild(htmlEl("span", "gif-label", "Export"));
  var seg = htmlEl("span", "gif-seg");
  [[false, "Whole sheet"], [true, "Selected items (" + sel.size + ")"]].forEach(function (opt) {
    seg.appendChild(toolButton({
      label: opt[1], pressed: !!options.only === opt[0],
      onClick: function () { options.only = opt[0] ? exportPick : null; redraw(); }
    }));
  });
  row.appendChild(seg);
  m.appendChild(row);
}
function showGifExport() {
  closeMenus();
  exportPick = selectionScope();
  gifOptions.only = gifOptions.only && exportPick ? exportPick : null;
  openModal(function (m) {
    var o = gifOptions;
    m.appendChild(htmlEl("h2", null, "Export a GIF"));
    var speedName = $("speed").options[$("speed").selectedIndex].text.toLowerCase();
    m.appendChild(htmlEl("p", "sub", o.animated
      ? "Plays the reveal in the same order as Play, at your " + speedName + " speed, then holds on the finished sheet."
      : "One still picture of the sheet."));

    function choice(label, options, current, set) {
      var row = htmlEl("div", "gif-row");
      row.appendChild(htmlEl("span", "gif-label", label));
      var group = htmlEl("span", "gif-seg");
      options.forEach(function (opt) {
        group.appendChild(toolButton({
          label: opt[1], pressed: current === opt[0],
          onClick: function () { set(opt[0]); showGifExport(); }
        }));
      });
      row.appendChild(group);
      m.appendChild(row);
    }
    exportScopeRow(m, o, showGifExport);
    choice("Motion", [[true, "Animated reveal"], [false, "Still picture"]], o.animated, function (v) { o.animated = v; });
    choice("Background", [[true, "Paper"], [false, "Transparent"]], o.background, function (v) { o.background = v; });
    choice("Size", [[1, "1×"], [2, "2×"]], o.scale, function (v) { o.scale = v; });
    if (!o.background) {
      m.appendChild(htmlEl("p", "gif-note", "GIF transparency is all or nothing, so very faint marks drop out and elements pop in without fading."));
    }
    var status = htmlEl("p", "gif-note gif-status", "");
    m.appendChild(status);

    var foot = htmlEl("div", "modal-foot");
    foot.appendChild(toolButton({ label: "Cancel", onClick: closeModal }));
    var go = toolButton({ label: "Export GIF", onClick: function () {
      go.disabled = true;
      status.textContent = "Drawing the frames…";
      gifJob = exportGif(o, function (done, total) {
        status.textContent = total > 1 ? "Drawing frame " + (done + 1) + " of " + total + "…" : "Drawing…";
      }, function (bytes) {
        gifJob = null;
        download(fileBase() + (o.animated ? "" : "-still") + ".gif", new Blob([bytes], { type: "image/gif" }));
        closeModal();
        toast("Saved the GIF (" + (bytes.length / 1048576).toFixed(1) + " MB)");
      }, function () {
        gifJob = null;
        status.textContent = "This browser could not draw the sheet. Try the SVG export instead.";
        go.disabled = false;
      });
    } });
    go.classList.add("accent");
    foot.appendChild(go);
    m.appendChild(foot);
  });
}

/* ================================================================
   24c. Video export
        Frames are drawn like the GIF's, encoded to H.264 by the
        browser (WebCodecs) and packed into an MP4 here, so the file
        stays self-contained. Timing follows Play exactly, with the
        200ms fade drawn smoothly at 30 frames a second.
   ================================================================ */
var VIDEO_FPS = 30, VIDEO_FADE = 200, VIDEO_LEAD = 500, VIDEO_HOLD = 2500, VIDEO_MAX = 1920;
var videoOptions = { scale: 1 };
var videoJob = null;

/* When each item appears and goes, in ms from the start of the video. */
function videoTimeline(only) {
  var plan = scopedReveal(only), step = parseInt($("speed").value, 10) || 700;
  var at = 0, times = {};
  plan.steps.forEach(function (st, i) {
    at += (i ? step : 0) + plan.pauses[i] * 1000;
    st.forEach(function (e) {
      var t = times[e.id] || (times[e.id] = { show: null, hide: null });
      if (e.hide) t.hide = VIDEO_LEAD + at; else t.show = VIDEO_LEAD + at;
    });
  });
  return { times: times, duration: VIDEO_LEAD + at + VIDEO_FADE + VIDEO_HOLD + plan.endPause * 1000 };
}
function easeFade(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function videoOpacity(times, key, ms) {
  var t = times[key];
  if (!t) return 1;
  var shown = t.show === null ? 1 : easeFade((ms - t.show) / VIDEO_FADE);
  var gone = t.hide === null ? 0 : easeFade((ms - t.hide) / VIDEO_FADE);
  return Math.round(Math.max(0, shown - gone) * 100) / 100;
}

/* The smallest H.264 profile and level this size needs that the browser
   can encode. */
function pickVideoCodec(w, h, done) {
  if (typeof VideoEncoder === "undefined") { done(null); return; }
  var blocks = Math.ceil(w / 16) * Math.ceil(h / 16);
  var levels = blocks <= 3600 ? ["1F", "28", "33"] : blocks <= 8192 ? ["28", "33"] : ["33"];
  var tries = [];
  levels.forEach(function (lv) { ["6400", "4D00", "42E0"].forEach(function (pr) { tries.push("avc1." + pr + lv); }); });
  (function next(i) {
    if (i >= tries.length) { done(null); return; }
    var config = videoConfig(tries[i], w, h);
    VideoEncoder.isConfigSupported(config).then(function (r) {
      if (r.supported) done(config); else next(i + 1);
    }, function () { next(i + 1); });
  })(0);
}
function videoConfig(codec, w, h) {
  return {
    codec: codec, width: w, height: h, framerate: VIDEO_FPS,
    bitrate: clamp(Math.round(w * h * VIDEO_FPS * 0.15), 1500000, 12000000),
    avc: { format: "avc" }, latencyMode: "quality"
  };
}

/* ---- MP4 packing: one H.264 track, all samples in one chunk, with the
   index (moov) ahead of the data so players can start straight away. */
function mp4Bytes(parts) {
  var size = 0;
  parts.forEach(function (p) { size += p.length; });
  var out = new Uint8Array(size), at = 0;
  parts.forEach(function (p) { out.set(p, at); at += p.length; });
  return out;
}
function u32(v) { return new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]); }
function u16(v) { return new Uint8Array([(v >>> 8) & 255, v & 255]); }
function fourcc(t) { return new Uint8Array([t.charCodeAt(0), t.charCodeAt(1), t.charCodeAt(2), t.charCodeAt(3)]); }
function mp4Box(type) {
  var parts = Array.prototype.slice.call(arguments, 1), body = mp4Bytes(parts);
  return mp4Bytes([u32(body.length + 8), fourcc(type), body]);
}
function mp4Full(type, version, flags) {
  var parts = Array.prototype.slice.call(arguments, 3);
  return mp4Box.apply(null, [type, new Uint8Array([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255])].concat(parts));
}
var MP4_MATRIX = mp4Bytes([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);
function buildMp4(samples, avcC, w, h) {
  var timescale = VIDEO_FPS * 1000, delta = 1000, count = samples.length;
  var mediaDur = count * delta, ms = Math.round(count * 1000 / VIDEO_FPS);
  var keys = [], sizes = [];
  samples.forEach(function (smp, i) { if (smp.key) keys.push(u32(i + 1)); sizes.push(u32(smp.data.length)); });
  function moov(offset) {
    var entry = mp4Box("avc1",
      new Uint8Array(6), u16(1), u16(0), u16(0), new Uint8Array(12), u16(w), u16(h),
      u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Uint8Array(32), u16(0x0018), u16(0xFFFF),
      mp4Box("avcC", avcC));
    var stbl = mp4Box("stbl",
      mp4Full("stsd", 0, 0, u32(1), entry),
      mp4Full("stts", 0, 0, u32(1), u32(count), u32(delta)),
      mp4Full("stss", 0, 0, u32(keys.length), mp4Bytes(keys)),
      mp4Full("stsc", 0, 0, u32(1), u32(1), u32(count), u32(1)),
      mp4Full("stsz", 0, 0, u32(0), u32(count), mp4Bytes(sizes)),
      mp4Full("stco", 0, 0, u32(1), u32(offset)));
    var minf = mp4Box("minf",
      mp4Full("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)),
      mp4Box("dinf", mp4Full("dref", 0, 0, u32(1), mp4Full("url ", 0, 1))),
      stbl);
    var mdia = mp4Box("mdia",
      mp4Full("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(mediaDur), u16(0x55C4), u16(0)),
      mp4Full("hdlr", 0, 0, u32(0), fourcc("vide"), new Uint8Array(12), new Uint8Array([86, 105, 100, 101, 111, 0])),
      minf);
    var tkhd = mp4Full("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), new Uint8Array(8),
      u16(0), u16(0), u16(0), u16(0), MP4_MATRIX, u32(w * 65536), u32(h * 65536));
    var mvhd = mp4Full("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x00010000), u16(0x0100),
      new Uint8Array(10), MP4_MATRIX, new Uint8Array(24), u32(2));
    return mp4Box("moov", mvhd, mp4Box("trak", tkhd, mdia));
  }
  var ftyp = mp4Box("ftyp", fourcc("isom"), u32(0x200), fourcc("isom"), fourcc("iso2"), fourcc("avc1"), fourcc("mp41"));
  var dataSize = 0;
  samples.forEach(function (smp) { dataSize += smp.data.length; });
  var head = moov(0);
  var offset = ftyp.length + head.length + 8;
  return new Blob([ftyp, moov(offset), u32(dataSize + 8), fourcc("mdat")].concat(samples.map(function (smp) { return smp.data; })), { type: "video/mp4" });
}

function exportVideo(opts, onProgress, onDone, onFail) {
  stopReveal();
  sel.clear(); closeEditor(true); render();
  var box = exportBox(opts.only), scale = opts.scale;
  if (Math.max(box.w, box.h) * scale > VIDEO_MAX) scale = VIDEO_MAX / Math.max(box.w, box.h);
  var w = Math.max(2, Math.floor(box.w * scale / 2) * 2), h = Math.max(2, Math.floor(box.h * scale / 2) * 2);
  var plan = videoTimeline(opts.only), total = Math.ceil(plan.duration / 1000 * VIDEO_FPS);
  var job = { cancelled: false };
  var canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  var g = canvas.getContext("2d");

  pickVideoCodec(w, h, function (config) {
    if (job.cancelled) return;
    if (!config) { onFail("codec"); return; }
    var samples = [], avcC = null, failed = false;
    var encoder = new VideoEncoder({
      output: function (chunk, meta) {
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) {
          var desc = meta.decoderConfig.description;
          avcC = desc instanceof ArrayBuffer ? new Uint8Array(desc.slice(0)) : new Uint8Array(desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength));
        }
        var data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data: data, key: chunk.type === "key" });
      },
      error: function () { failed = true; onFail("encode"); }
    });
    encoder.configure(config);
    var frame = 0, lastLook = null;
    function draw(ms, then) {
      /* only redraw when something on screen has changed */
      var look = Object.keys(plan.times).map(function (k) { return videoOpacity(plan.times, k, ms); }).join(",");
      if (look === lastLook && !flowingEdges().length) { then(); return; }
      lastLook = look;
      drawFlows(ms);   /* balls where they are at this moment of the video */
      var svg = buildSvgString(true, { box: box, only: opts.only, opacityOf: function (key) { return videoOpacity(plan.times, key, ms); } });
      var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      var image = new Image();
      image.onload = function () {
        g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
        g.drawImage(image, 0, 0, w, h);
        URL.revokeObjectURL(url);
        then();
      };
      image.onerror = function () { URL.revokeObjectURL(url); onFail("draw"); };
      image.src = url;
    }
    (function next() {
      if (job.cancelled || failed) { try { encoder.close(); } catch (e) { /* already closed */ } return; }
      if (frame >= total) {
        encoder.flush().then(function () {
          encoder.close();
          if (!avcC || !samples.length) { onFail("encode"); return; }
          onDone(buildMp4(samples, avcC, w, h), { w: w, h: h, seconds: total / VIDEO_FPS });
        }, function () { onFail("encode"); });
        return;
      }
      /* keep the encoder's queue short so memory stays flat */
      if (encoder.encodeQueueSize > 8) { setTimeout(next, 5); return; }
      onProgress(frame, total);
      draw(frame * 1000 / VIDEO_FPS, function () {
        var vf = new VideoFrame(canvas, { timestamp: Math.round(frame * 1e6 / VIDEO_FPS), duration: Math.round(1e6 / VIDEO_FPS) });
        encoder.encode(vf, { keyFrame: frame % (VIDEO_FPS * 2) === 0 });
        vf.close();
        frame++;
        setTimeout(next, 0);
      });
    })();
  });
  return job;
}

function showVideoExport() {
  closeMenus();
  exportPick = selectionScope();
  videoOptions.only = videoOptions.only && exportPick ? exportPick : null;
  openModal(function (m) {
    var o = videoOptions;
    var plan = videoTimeline(o.only);
    m.appendChild(htmlEl("h2", null, "Export a video"));
    var speedName = $("speed").options[$("speed").selectedIndex].text.toLowerCase();
    m.appendChild(htmlEl("p", "sub", "An MP4 of the reveal, the same as Play at your " + speedName +
      " speed, with every pause and hide, then a hold on the finished sheet. About " +
      Math.round(plan.duration / 100) / 10 + " seconds."));
    exportScopeRow(m, o, showVideoExport);
    var row = htmlEl("div", "gif-row");
    row.appendChild(htmlEl("span", "gif-label", "Size"));
    var seg = htmlEl("span", "gif-seg");
    [[1, "1×"], [2, "2×  sharper"]].forEach(function (opt) {
      seg.appendChild(toolButton({ label: opt[1], pressed: o.scale === opt[0], onClick: function () { o.scale = opt[0]; showVideoExport(); } }));
    });
    row.appendChild(seg);
    m.appendChild(row);
    m.appendChild(htmlEl("p", "gif-note", "Videos always keep the paper background, since MP4 has no transparency. The long side is capped at 1920 pixels."));
    var status = htmlEl("p", "gif-note gif-status", "");
    m.appendChild(status);

    var foot = htmlEl("div", "modal-foot");
    foot.appendChild(toolButton({ label: "Cancel", onClick: closeModal }));
    var go = toolButton({ label: "Export MP4", onClick: function () {
      go.disabled = true;
      status.textContent = "Getting the encoder ready…";
      videoJob = exportVideo(o, function (done, total) {
        status.textContent = "Recording frame " + (done + 1) + " of " + total + "…";
      }, function (blob, info) {
        videoJob = null;
        download(fileBase() + ".mp4", blob);
        closeModal();
        toast("Saved the video (" + info.w + "×" + info.h + ", " + Math.round(info.seconds * 10) / 10 + "s, " + (blob.size / 1048576).toFixed(1) + " MB)");
      }, function (why) {
        videoJob = null;
        status.textContent = why === "codec"
          ? "This browser can't make MP4 videos. Chrome, Edge or Safari can, or use File, Export, GIF."
          : "The video could not be made in this browser. Try again, or use the GIF export.";
        go.disabled = false;
      });
    } });
    go.classList.add("accent");
    foot.appendChild(go);
    m.appendChild(foot);
  });
}

function exportSvg(only) {
  download(fileBase() + (only ? "-selection" : "") + ".svg", buildSvgString(true, { only: only }), "image/svg+xml");
  toast(only ? "Saved the selection as SVG" : "Saved the SVG");
}
function exportHtml(only) {
  var body = buildSvgString(false, { only: only });
  var html = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    "<title>" + (doc.title || "Diagram").replace(/[<>&]/g, "") + "</title>\n" +
    "<link href=\"https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap\" rel=\"stylesheet\">\n" +
    "<style>body{margin:0;background:#FBFAF7;font-family:Poppins,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}" +
    "figure{margin:0;max-width:1000px;width:100%}svg{width:100%;height:auto;background:#fff;border:1px solid #E4E0D6;border-radius:10px;box-shadow:0 2px 10px rgba(35,35,31,.07)}" +
    "figcaption{margin-top:12px;color:#8C8A80;font-size:13px;text-align:center}</style>\n</head>\n<body>\n<figure>\n" +
    body + "\n<figcaption>" + (doc.title || "Diagram").replace(/[<>&]/g, "") + "</figcaption>\n</figure>\n</body>\n</html>\n";
  download(fileBase() + (only ? "-selection" : "") + ".html", html, "text/html");
  toast("Saved a standalone page");
}
function saveJson() {
  download(fileBase() + ".json", JSON.stringify({
    format: "diagram-studio", version: 3, title: doc.title,
    roughness: roughness, pages: doc.pages, assets: usedAssets()
  }, null, 2), "application/json");
  toast("Saved a copy");
}

function upgradeNode(n) {
  var o = Object.assign({
    id: uid("n"), type: "box", style: "wash", x: 40, y: 40, w: 170, h: 54,
    fill: PRESETS[0].fill, accent: PRESETS[0].accent, filled: true,
    title: "", sub: "", titleSize: 11.5, titleColor: INK,
    bold: false, italic: false, strike: false, underline: false
  }, n);
  if (!o.fill) { o.fill = PRESETS[0].fill; o.accent = PRESETS[0].accent; }
  if (o.type === "table" && !(Array.isArray(o.cells) && o.cells.length && o.cells[0].length)) {
    o.cells = blankCells(3, 3);
  }
  if (o.type === "table") { syncFills(o); trimMerges(o); }
  return o;
}
function upgradeEdge(e) {
  return Object.assign({
    id: uid("e"), color: LINE, weight: 1.6, dashed: false, label: "", onPath: true,
    shape: "curve", detour: 0, labelSize: 9.5, fromSide: "auto", toSide: "auto",
    head: "arrow", tail: "none"
  }, e);
}
function upgradeText(t) {
  return Object.assign({
    id: uid("t"), x: 60, y: 60, text: "", size: 15, weight: 400, color: INK,
    anchor: "middle", bold: false, italic: false, strike: false, underline: false
  }, t);
}
function upgradePage(p) {
  return {
    id: p.id || uid("p"), name: p.name || "Sheet", w: p.w || 900, h: p.h || 660,
    nodes: (p.nodes || []).map(upgradeNode),
    edges: (p.edges || []).map(upgradeEdge),
    texts: (p.texts || []).map(upgradeText),
    reveal: p.reveal && Array.isArray(p.reveal.steps) ? p.reveal : null
  };
}
function openJsonText(text) {
  try {
    var o = JSON.parse(text);
    var pages;
    if (Array.isArray(o.pages) && o.pages.length) pages = o.pages.map(upgradePage);
    else if (Array.isArray(o.nodes)) pages = [upgradePage({ name: "Sheet 1", nodes: o.nodes, edges: o.edges, texts: o.texts })];
    else throw new Error("unknown");

    doc.title = o.title || "Untitled sketch";
    doc.pages = pages;
    doc.active = 0;
    if (o.assets && typeof o.assets === "object") {
      Object.keys(o.assets).forEach(function (k) {
        if (/^data:image\//.test(o.assets[k])) assets[k] = o.assets[k];
      });
    }
    if (o.roughness && ROUGHNESS[o.roughness]) { roughness = o.roughness; $("rough").value = roughness; buildFilters(); }
    sel.clear(); past = []; future = []; snapshot = null;
    $("docTitle").value = doc.title;
    resetDom(); commit(); render(); fitView();
    toast("Opened " + doc.title);
  } catch (err) {
    toast("That file is not a diagram studio sketch");
  }
}
function newDoc() {
  if ((nodes().length || texts().length) && !confirm("Start a new sketch? The current one is already saved in this browser.")) return;
  doc = { title: "Untitled sketch", pages: [newPage("Sheet 1")], active: 0 };
  sel.clear(); past = []; future = []; snapshot = null;
  $("docTitle").value = doc.title;
  resetDom(); commit(); render(); fitView();
}

