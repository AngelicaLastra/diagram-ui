/* ================================================================
   18. Small UI builders
   ================================================================ */
function toast(msg) {
  var t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.classList.remove("on"); }, 1700);
}
function toolButton(o) {
  var b = htmlEl("button", "btn" + (o.danger ? " danger" : "") + (o.icon && !o.label ? " icon" : ""));
  b.type = "button";
  if (o.icon) b.appendChild(icon(o.icon, o.size || 16));
  if (o.label) b.appendChild(htmlEl("span", o.labelClass || null, o.label));
  if (o.title) { b.dataset.tip = o.title; b.setAttribute("aria-label", o.title); }
  if (o.pressed != null) b.setAttribute("aria-pressed", String(!!o.pressed));
  if (o.disabled) b.disabled = true;
  if (o.onClick) b.addEventListener("click", function (e) { e.preventDefault(); o.onClick(e, b); });
  return b;
}
function divider() { return htmlEl("span", "divider"); }

/* Every colour control opens the same picker, so the recent and saved
   colours follow you from a box to a circle to a table cell. They live in
   this browser, next to the other preferences. */
var COLORS_KEY = STORE + ":colors";
var MAX_RECENT = 6;
var colorBook = { recent: [], saved: [] };
var colorSession = null;   /* { title, value, onChange } while the picker is open */

function parseHex(text) {
  var t = String(text || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t)) t = t.split("").map(function (ch) { return ch + ch; }).join("");
  return /^[0-9a-f]{6}$/i.test(t) ? "#" + t.toUpperCase() : null;
}
function loadColorBook() {
  try {
    var o = JSON.parse(localStorage.getItem(COLORS_KEY) || "null");
    if (!o) return;
    colorBook.recent = (o.recent || []).map(parseHex).filter(Boolean).slice(0, MAX_RECENT);
    colorBook.saved = (o.saved || []).map(parseHex).filter(Boolean);
  } catch (err) { /* a fresh book is fine */ }
}
function saveColorBook() {
  try { localStorage.setItem(COLORS_KEY, JSON.stringify(colorBook)); } catch (err) { /* private window */ }
}
function rememberColor(hex) {
  colorBook.recent = [hex].concat(colorBook.recent.filter(function (h) { return h !== hex; })).slice(0, MAX_RECENT);
  saveColorBook();
}

function colorControl(value, title, onChange) {
  var hex = parseHex(value);
  var b = htmlEl("button", "color-btn" + (hex ? "" : " empty"));
  b.type = "button";
  if (hex) b.style.setProperty("--chip", hex);
  b.dataset.tip = hex ? title + "  " + hex : title;
  b.setAttribute("aria-label", title);
  b.setAttribute("aria-haspopup", "dialog");
  b.addEventListener("click", function (e) { e.preventDefault(); openColorPicker(b, hex, title, onChange); });
  return b;
}
function openColorPicker(opener, value, title, onChange) {
  var again = !palette.hidden && colorSession && colorSession.title === title;
  closeMenus();
  if (again) return;
  colorSession = { title: title, value: value, onChange: onChange };
  renderColorPicker(true);
  palette.hidden = false;
  var r = opener.getBoundingClientRect(), box = palette.getBoundingClientRect();
  var top = r.bottom + 8;
  if (top + box.height > window.innerHeight - 8) top = Math.max(8, r.top - box.height - 8);
  palette.style.left = clamp(r.left + r.width / 2 - box.width / 2, 8, window.innerWidth - box.width - 8) + "px";
  palette.style.top = top + "px";
}
function applyPickedColor(hex, refocus) {
  if (!colorSession || !hex) return;
  colorSession.value = hex;
  rememberColor(hex);
  colorSession.onChange(hex);
  renderColorPicker(refocus);
}
function colorChip(hex, tip) {
  var b = htmlEl("button", "pal-cell");
  b.type = "button";
  b.style.background = hex;
  b.dataset.tip = tip || hex;
  b.setAttribute("aria-label", hex);
  b.setAttribute("aria-pressed", String(colorSession.value === hex));
  b.addEventListener("click", function () { applyPickedColor(hex); });
  return b;
}
function renderColorPicker(focusHex) {
  clear(palette);
  var session = colorSession;
  palette.appendChild(htmlEl("div", "pal-head", session.title));

  palette.appendChild(htmlEl("div", "pal-label", "Recent"));
  var recent = htmlEl("div", "pal-grid");
  colorBook.recent.forEach(function (hex) { recent.appendChild(colorChip(hex)); });
  if (!colorBook.recent.length) recent.appendChild(htmlEl("span", "pal-empty", "Colours you use show up here."));
  palette.appendChild(recent);

  palette.appendChild(htmlEl("div", "pal-label", "Saved"));
  var saved = htmlEl("div", "pal-grid");
  /* Each saved colour gets a small x on hover or focus. Right click,
     Delete and Backspace remove it too. */
  function forget(hex) {
    colorBook.saved = colorBook.saved.filter(function (h) { return h !== hex; });
    saveColorBook();
    renderColorPicker();
    toast("Removed " + hex + " from saved colours");
  }
  colorBook.saved.forEach(function (hex) {
    var slot = htmlEl("span", "pal-saved");
    var chip = colorChip(hex);
    chip.addEventListener("contextmenu", function (e) { e.preventDefault(); forget(hex); });
    chip.addEventListener("keydown", function (e) {
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); forget(hex); }
    });
    var drop = htmlEl("button", "pal-del", "×");
    drop.type = "button";
    drop.dataset.tip = "Remove " + hex;
    drop.setAttribute("aria-label", "Remove " + hex + " from saved colours");
    drop.addEventListener("click", function (e) { e.stopPropagation(); forget(hex); });
    slot.appendChild(chip);
    slot.appendChild(drop);
    saved.appendChild(slot);
  });
  var add = htmlEl("button", "pal-cell pal-add");
  add.type = "button";
  add.appendChild(icon("plus", 12));
  add.dataset.tip = session.value ? "Save " + session.value : "Pick a colour first";
  add.setAttribute("aria-label", "Save this colour");
  add.disabled = !session.value || colorBook.saved.indexOf(session.value) >= 0;
  add.addEventListener("click", function () {
    var hex = parseHex(hexInput.value) || session.value;
    if (!hex || colorBook.saved.indexOf(hex) >= 0) return;
    colorBook.saved.push(hex);
    saveColorBook();
    if (hex !== session.value) applyPickedColor(hex); else renderColorPicker();
    toast("Saved " + hex);
  });
  saved.appendChild(add);
  palette.appendChild(saved);

  palette.appendChild(htmlEl("div", "pal-label", "Palette"));
  var base = htmlEl("div", "pal-grid");
  SWATCHES.forEach(function (hex) { base.appendChild(colorChip(hex)); });
  palette.appendChild(base);

  var foot = htmlEl("div", "pal-foot");
  var wheel = document.createElement("input");
  wheel.type = "color";
  wheel.value = session.value ? session.value.toLowerCase() : "#888888";
  wheel.dataset.tip = "Pick any colour";
  wheel.setAttribute("aria-label", "Pick any colour");
  wheel.addEventListener("change", function () { applyPickedColor(parseHex(wheel.value)); });
  foot.appendChild(wheel);

  var hexInput = htmlEl("input", "pal-hex");
  hexInput.type = "text";
  hexInput.spellcheck = false;
  hexInput.maxLength = 7;
  hexInput.placeholder = "#RRGGBB";
  hexInput.value = session.value || "";
  hexInput.setAttribute("aria-label", "Hex colour");
  hexInput.addEventListener("input", function () {
    hexInput.classList.toggle("bad", hexInput.value.trim() !== "" && !parseHex(hexInput.value));
  });
  hexInput.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); closeMenus(); }
    if (e.key === "Enter") {
      e.preventDefault();
      var hex = parseHex(hexInput.value);
      if (hex) applyPickedColor(hex, true); else hexInput.classList.add("bad");
    }
  });
  foot.appendChild(hexInput);
  var use = toolButton({
    label: "Use", title: "Apply the hex colour  (Enter)",
    onClick: function () {
      var hex = parseHex(hexInput.value);
      if (hex) applyPickedColor(hex, true); else hexInput.classList.add("bad");
    }
  });
  foot.appendChild(use);
  palette.appendChild(foot);

  if (focusHex) window.requestAnimationFrame(function () { hexInput.focus(); hexInput.select(); });
}
/* A number box. Typed digits wait until Enter or a click elsewhere, so
   "24" is not cut short at "2" (and clamped to the minimum) halfway
   through; Esc puts the old value back. The arrow keys and the
   spinner's own arrows still apply at once, a step at a time. */
function numberControl(value, min, max, title, onChange, step) {
  var input = htmlEl("input", "num");
  input.type = "number";
  input.min = min; input.max = max; input.step = step || 1;
  input.value = value;
  input.dataset.tip = title;
  input.setAttribute("aria-label", title);
  var applied = value, typed = false;
  function apply() {
    var v = parseFloat(input.value);
    if (isNaN(v)) { input.value = applied; return; }
    v = clamp(v, min, max);
    input.value = v;
    if (v !== applied) { applied = v; onChange(v); }
  }
  input.addEventListener("keydown", function (e) {
    typed = e.key.length === 1 || e.key === "Backspace" || e.key === "Delete";
    if (e.key === "Enter") { e.preventDefault(); apply(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); input.value = applied; input.blur(); }
  });
  input.addEventListener("input", function () {
    if (typed) { typed = false; return; }   /* still typing: wait */
    apply();                                 /* arrow key or spinner: now */
  });
  input.addEventListener("change", apply);
  input.addEventListener("blur", apply);
  return input;
}
function selectControl(options, value, title, onChange) {
  var s = htmlEl("select", "sel");
  s.dataset.tip = title;
  s.setAttribute("aria-label", title);
  options.forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o[0]; opt.textContent = o[1];
    if (String(o[0]) === String(value)) opt.selected = true;
    s.appendChild(opt);
  });
  s.addEventListener("change", function () { onChange(s.value); });
  return s;
}
function paletteRow(current, onPick) {
  var wrap = htmlEl("span");
  wrap.style.cssText = "display:flex;gap:3px";
  PRESETS.forEach(function (preset) {
    var b = htmlEl("button", "swatch-btn");
    b.type = "button";
    b.style.background = preset.fill;
    b.style.borderColor = preset.accent;
    b.dataset.tip = preset.name;
    b.setAttribute("aria-label", preset.name);
    b.setAttribute("aria-pressed", String(current === preset.fill));
    b.addEventListener("click", function () { onPick(preset); });
    wrap.appendChild(b);
  });
  return wrap;
}
function formatToggles(getItems) {
  var wrap = htmlEl("span");
  wrap.style.cssText = "display:flex;gap:2px";
  [["bold", "B", "fmt-b", "Bold"], ["italic", "I", "fmt-i", "Italic"],
   ["underline", "U", "fmt-u", "Underline"], ["strike", "S", "fmt-s", "Strikethrough"]]
    .forEach(function (f) {
      var list = getItems();
      var on = list.length && list.every(function (i) { return !!i[f[0]]; });
      wrap.appendChild(toolButton({
        label: f[1], labelClass: f[2], title: f[3], pressed: on,
        onClick: function () {
          var targets = new Set(getItems());
          patchSelected({ [f[0]]: function (it) { return targets.has(it) ? !on : undefined; } });
        }
      }));
    });
  return wrap;
}

