/* ================================================================
   20. Tool rail and shape drawer
   ================================================================ */
function buildRail() {
  var rail = $("rail");
  clear(rail);
  TOOLS.forEach(function (t) {
    if (t.sep) { rail.appendChild(htmlEl("div", "spacer")); return; }
    var b = toolButton({
      icon: t.icon, title: t.title + "  (" + t.key + ")",
      pressed: t.id === tool, size: 18,
      onClick: function () { if (t.id === "image") openImagePicker(); else setTool(t.id); }
    });
    b.dataset.tool = t.id;
    rail.appendChild(b);
  });
  rail.appendChild(htmlEl("div", "spacer"));
  rail.appendChild(toolButton({
    icon: "panel", title: "Show or hide the shape drawer",
    pressed: !$("drawer").hidden,
    onClick: function () { $("drawer").hidden = !$("drawer").hidden; buildRail(); applyView(); }
  }));
  var order = toolButton({
    icon: "order", title: "Reveal order: choose what appears when  (O)",
    pressed: !$("orderPanel").hidden, onClick: function () { toggleOrderPanel(); }
  });
  order.setAttribute("aria-controls", "orderPanel");
  rail.appendChild(order);
}

function stencilPreview(kind) {
  var svg = makeEl("svg", { width: 56, height: 32, viewBox: "0 0 56 32" });
  var fake = { id: "stencil-" + kind.type + kind.style, type: kind.type, x: 6, y: 5, w: 44, h: 22 };
  var random = makeRandom(hashOf(fake.id));
  var corners = cornersFor(fake);
  if (kind.style === "sketch") {
    svg.appendChild(makeEl("path", {
      d: wobblyPath(corners, 1.5, random), fill: "currentColor", "fill-opacity": 0.1
    }));
    for (var i = 0; i < 4; i++) {
      svg.appendChild(makeEl("line", {
        x1: 10 + i * 10, y1: 26, x2: 16 + i * 10, y2: 7,
        stroke: "currentColor", "stroke-width": 0.9, "stroke-opacity": 0.4, "stroke-linecap": "round"
      }));
    }
    corners.forEach(function (c, j) {
      svg.appendChild(makeEl("path", {
        d: sidePath(c, corners[(j + 1) % corners.length], 1.4, random),
        fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round"
      }));
    });
  } else {
    svg.appendChild(makeEl("path", {
      d: wobblyPath(corners, 1.5, random), fill: "currentColor", "fill-opacity": 0.12,
      stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round"
    }));
  }
  if (kind.type === "database") {
    svg.appendChild(makeEl("path", {
      d: smoothPath(dbLidPoints(fake)), fill: "none", stroke: "currentColor", "stroke-width": 1.2, "stroke-linecap": "round"
    }));
  }
  if (kind.type === "code") {
    [[12, 13, 22, CODE_INK.kw], [12, 18, 34, CODE_INK.fn], [16, 23, 26, CODE_INK.str]].forEach(function (l) {
      svg.appendChild(makeEl("path", { d: "M" + l[0] + "," + l[1] + " H" + (l[0] + l[2]), stroke: l[3], "stroke-width": 1.8, "stroke-linecap": "round" }));
    });
  }
  if (kind.type === "table") {
    [[{ x: 6, y: 12 }, { x: 50, y: 12 }], [{ x: 6, y: 19.5 }, { x: 50, y: 19.5 }],
     [{ x: 20.5, y: 5 }, { x: 20.5, y: 27 }], [{ x: 35.5, y: 5 }, { x: 35.5, y: 27 }]]
      .forEach(function (l) {
        svg.appendChild(makeEl("path", {
          d: sidePath(l[0], l[1], 0.8, random), fill: "none",
          stroke: "currentColor", "stroke-width": 1, "stroke-opacity": 0.7, "stroke-linecap": "round"
        }));
      });
  }
  return svg;
}

function buildDrawer() {
  var host = $("stencil");
  clear(host);
  SHAPE_KINDS.forEach(function (kind) {
    var b = htmlEl("button");
    b.type = "button";
    b.draggable = true;
    b.appendChild(stencilPreview(kind));
    b.appendChild(htmlEl("span", null, kind.label));
    b.addEventListener("click", function () {
      setTool(kind.style === "sketch" ? "sketch" : kind.type);
    });
    b.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", "shape:" + kind.type + ":" + kind.style);
      e.dataTransfer.effectAllowed = "copy";
    });
    host.appendChild(b);
  });

  var pick = htmlEl("button", "image-tile");
  pick.type = "button";
  var art = htmlEl("span");
  art.style.cssText = "display:grid;place-items:center;width:56px;height:32px";
  art.appendChild(icon("image", 22));
  pick.appendChild(art);
  pick.appendChild(htmlEl("span", null, "Image"));
  pick.dataset.tip = "PNG, JPG, GIF, WebP or SVG. You can also drop or paste them.";
  pick.addEventListener("click", function () { openImagePicker(); });
  host.appendChild(pick);

  var tones = $("tones");
  clear(tones);
  PRESETS.forEach(function (preset, i) {
    var b = htmlEl("button", "tone");
    b.type = "button";
    b.style.background = preset.fill;
    b.style.borderColor = preset.accent;
    b.dataset.tip = preset.name;
    b.setAttribute("aria-label", preset.name);
    b.addEventListener("click", function () {
      toneIndex = i;
      if (selNodes().length) patchSelected({
        fill: function (it, kind) { return kind === "node" ? preset.fill : undefined; },
        accent: function (it, kind) { return kind === "node" ? preset.accent : undefined; }
      });
      else toast(preset.name + " is next");
    });
    tones.appendChild(b);
  });
}

$("stagewrap").addEventListener("dragover", function (e) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
$("stagewrap").addEventListener("drop", function (e) {
  e.preventDefault();
  var files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
  if (files.length) {
    var pictures = files.filter(isImageFile);
    if (pictures.length) importImages(pictures, toStage(e));
    else toast("Only pictures can be dropped here: PNG, JPG, GIF, WebP or SVG");
    return;
  }
  var data = e.dataTransfer.getData("text/plain") || "";
  if (data.indexOf("shape:") !== 0) return;
  var parts = data.split(":");
  addNode(parts[1], parts[2], toStage(e));
});

/* ================================================================
   21. Menus
   ================================================================ */
var menu = $("menu"), palette = $("palette"), openMenuBtn = null;

function closeMenus() {
  if (editing && inkSpan && !palette.hidden) {
    inkSpan = null;
    window.requestAnimationFrame(function () { if (editing) inlineInput.focus(); });
  }
  menu.hidden = true;
  palette.hidden = true;
  if (openMenuBtn) { openMenuBtn.setAttribute("aria-expanded", "false"); openMenuBtn = null; }
}
function renderMenu(defs) {
  clear(menu);
  defs.forEach(function (d) {
    if (d === "-") { menu.appendChild(htmlEl("div", "menu-sep")); return; }
    if (d.header) { menu.appendChild(htmlEl("div", "menu-label", d.header)); return; }
    var b = htmlEl("button", "menu-item" + (d.danger ? " danger" : ""));
    b.type = "button";
    if (d.icon) b.appendChild(icon(d.icon, 16));
    else { var pad = htmlEl("span"); pad.style.width = "16px"; b.appendChild(pad); }
    b.appendChild(htmlEl("span", null, d.label));
    if (d.key) b.appendChild(htmlEl("span", "k", d.key));
    if (d.on) { b.classList.add("on"); b.setAttribute("aria-checked", "true"); }
    if (d.checked != null) {
      var mark = icon("eye", 14);
      mark.style.cssText = "margin-left:auto;opacity:" + (d.checked ? 1 : 0.18);
      b.appendChild(mark);
    }
    if (d.disabled) b.disabled = true;
    b.addEventListener("click", function () { closeMenus(); if (d.run) d.run(); });
    menu.appendChild(b);
  });
}
function openMenuAt(x, y, defs) {
  renderMenu(defs);
  menu.hidden = false;
  var r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 10) + "px";
  menu.style.top = Math.min(y, window.innerHeight - r.height - 10) + "px";
}
function openMenuUnder(btn, defs) {
  if (openMenuBtn === btn) { closeMenus(); return; }
  closeMenus();
  var r = btn.getBoundingClientRect();
  openMenuAt(r.left, r.bottom + 6, defs);
  btn.setAttribute("aria-expanded", "true");
  openMenuBtn = btn;
}
document.addEventListener("pointerdown", function (e) {
  if (menu.hidden && palette.hidden) return;
  if (menu.contains(e.target) || palette.contains(e.target)) return;
  if (openMenuBtn && openMenuBtn.contains(e.target)) return;
  closeMenus();
}, true);

function fileMenu() {
  return [
    { label: "New sketch", icon: "file", run: newDoc },
    { label: "Open a file…", icon: "folder", key: MOD + "+O", run: function () { $("fileInput").click(); } },
    { label: "Import an image…", icon: "image", key: "I", run: function () { openImagePicker(); } },
    { label: "Save a copy", icon: "save", key: MOD + "+S", run: saveJson },
    "-",
    { header: "Export" },
    { label: "PNG  ·  1×", icon: "image", run: function () { exportPng(1); } },
    { label: "PNG  ·  2×", icon: "image", run: function () { exportPng(2); } },
    { label: "PNG  ·  3×", icon: "image", run: function () { exportPng(3); } },
    { label: "SVG", icon: "code", run: function () { exportSvg(); } },
    { label: "GIF…", icon: "play", run: showGifExport },
    { label: "Video (MP4)…", icon: "play", run: showVideoExport },
    { label: "Standalone web page", icon: "code", run: function () { exportHtml(); } }
  ].concat(selectionScope() ? (function (only) {
    var count = sel.size;
    return [
      { header: "Selected items only (" + count + ")" },
      { label: "PNG  ·  2×", icon: "image", run: function () { exportPng(2, only); } },
      { label: "SVG", icon: "code", run: function () { exportSvg(only); } },
      { label: "Standalone web page", icon: "code", run: function () { exportHtml(only); } }
    ];
  })(selectionScope()) : []).concat([
    "-",
    { label: "Load the sample", icon: "eye", run: function () { loadSample(); toast("Sample loaded"); } },
    { label: "Keyboard shortcuts", icon: "help", key: "?", run: showShortcuts }
  ]);
}
function editMenu() {
  return [
    { label: "Undo", icon: "undo", key: MOD + "+Z", disabled: !past.length, run: undo },
    { label: "Redo", icon: "redo", key: MOD + "+Shift+Z", disabled: !future.length, run: redo },
    "-",
    { label: "Cut", key: MOD + "+X", disabled: !sel.size, run: function () { copySelected(); deleteSelected(); } },
    { label: "Copy", icon: "copy", key: MOD + "+C", disabled: !sel.size, run: copySelected },
    { label: "Paste", key: MOD + "+V", disabled: !clipboard, run: pasteClipboard },
    { label: "Duplicate", icon: "copy", key: MOD + "+D", disabled: !sel.size, run: duplicateSelected },
    "-",
    { label: "Copy style", icon: "brush", key: MOD + "+Alt+C", disabled: !sel.size, run: function () { copyStyle(false); } },
    { label: "Paste style", key: MOD + "+Alt+V", disabled: !sel.size || !paintStyle, run: pasteStyle },
    "-",
    { label: "Select everything", key: MOD + "+A", run: selectAll },
    { label: "Delete", icon: "trash", key: "Del", danger: true, disabled: !sel.size, run: deleteSelected }
  ];
}
function groupItems() {
  var grouped = selList().some(function (f) { return f.item.group; });
  return [
    { label: "Group", icon: "group", key: MOD + "+G", disabled: sel.size < 2 || selIsOneGroup(), run: groupSelected },
    { label: "Ungroup", icon: "ungroup", key: MOD + "+Shift+G", disabled: !grouped, run: ungroupSelected }
  ];
}
function arrangeMenu() {
  return groupItems().concat(["-",
    { label: "Bring to front", icon: "front", run: function () { reorder("front"); } },
    { label: "Send to back", icon: "back", run: function () { reorder("back"); } },
    "-",
    { label: "Align left", icon: "alnL", run: function () { alignSelected("left"); } },
    { label: "Centre across", icon: "alnCH", run: function () { alignSelected("hcenter"); } },
    { label: "Align right", icon: "alnR", run: function () { alignSelected("right"); } },
    { label: "Align top", icon: "alnT", run: function () { alignSelected("top"); } },
    { label: "Centre down", icon: "alnCV", run: function () { alignSelected("vcenter"); } },
    { label: "Align bottom", icon: "alnB", run: function () { alignSelected("bottom"); } },
    "-",
    { label: "Spread across", icon: "distH", run: function () { distributeSelected("h"); } },
    { label: "Spread down", icon: "distV", run: function () { distributeSelected("v"); } },
    "-",
    { label: "Smart guides", checked: guidesOn, run: function () { guidesOn = !guidesOn; persistNow(); } }
  ]);
}
function openContextMenu(x, y) {
  var has = sel.size > 0;
  var many = selNodes().length > 1;
  var defs;
  if (has) {
    defs = [
      { label: "Edit text", icon: "text", run: function () { var f = firstSel(); if (f) openEditor(f.item.id, defaultField(f.item.id)); } },
      { label: "Duplicate", icon: "copy", key: MOD + "+D", run: duplicateSelected },
      { label: "Copy", run: copySelected },
      { label: "Copy style", icon: "brush", key: MOD + "+Alt+C", run: function () { copyStyle(false); } },
      { label: "Paste style", key: MOD + "+Alt+V", disabled: !paintStyle, run: pasteStyle },
      "-"].concat(groupItems(), ["-",
      { label: "Bring to front", icon: "front", run: function () { reorder("front"); } },
      { label: "Send to back", icon: "back", run: function () { reorder("back"); } }
    ]);
    var only = selList();
    if (only.length === 1) {
      defs.push("-", { label: "Hide it during Play", icon: "eyeOff", run: function () { addHide(only[0].item.id, true); } });
    }
    if (many) {
      defs.push("-",
        { label: "Align left", icon: "alnL", run: function () { alignSelected("left"); } },
        { label: "Centre across", icon: "alnCH", run: function () { alignSelected("hcenter"); } },
        { label: "Spread across", icon: "distH", run: function () { distributeSelected("h"); } });
    }
    defs.push("-", { label: "Delete", icon: "trash", danger: true, run: deleteSelected });
  } else {
    defs = [
      { label: "Paste here", disabled: !clipboard, run: pasteClipboard },
      { label: "Insert an image…", icon: "image", run: function () { openImagePicker(menuPoint); } },
      { label: "Select everything", run: selectAll },
      "-",
      { label: "Fit everything", run: fitView },
      { label: gridOn ? "Hide the grid" : "Show the grid", run: function () { gridOn = !gridOn; pressToggle($("btnGrid"), gridOn); render(); persistNow(); } },
      "-",
      { label: "Play the reveal", icon: "play", run: playReveal }
    ];
  }
  openMenuAt(x, y, defs);
}

