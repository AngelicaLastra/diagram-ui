/* ================================================================
   22. Sheets
   ================================================================ */
function renderPages() {
  var host = $("pages");
  clear(host);
  doc.pages.forEach(function (p, i) {
    var b = htmlEl("button", "page-tab", p.name);
    b.type = "button";
    b.setAttribute("aria-selected", String(i === doc.active));
    b.addEventListener("click", function () { gotoPage(i); });
    b.addEventListener("dblclick", function () { renamePage(i, b); });
    b.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      openMenuAt(e.clientX, e.clientY, [
        { label: "Rename", run: function () { renamePage(i, b); } },
        { label: "Duplicate sheet", icon: "copy", run: function () {
          var copy = deepCopy(p); copy.id = uid("p"); copy.name = p.name + " copy";
          copy.nodes.forEach(function (n) { n.id = uid("n"); });
          copy.edges = []; copy.texts.forEach(function (t) { t.id = uid("t"); });
          doc.pages.splice(i + 1, 0, copy); doc.active = i + 1;
          sel.clear(); resetDom(); commit(); render();
        } },
        { label: "Delete sheet", icon: "trash", danger: true, disabled: doc.pages.length < 2, run: function () {
          doc.pages.splice(i, 1);
          doc.active = clamp(doc.active, 0, doc.pages.length - 1);
          sel.clear(); resetDom(); commit(); render(); fitView();
        } }
      ]);
    });
    host.appendChild(b);
  });
}
function gotoPage(i) {
  if (i === doc.active) return;
  closeEditor(true);
  doc.active = i; sel.clear(); connectFrom = null;
  resetDom(); render(); fitView(); schedulePersist();
}
function renamePage(i, btn) {
  var input = htmlEl("input", "num");
  input.style.cssText = "width:120px;height:22px;text-align:left";
  input.value = doc.pages[i].name;
  btn.replaceChildren(input);
  input.focus(); input.select();
  function done() { doc.pages[i].name = input.value.trim() || doc.pages[i].name; commit(); render(); }
  input.addEventListener("blur", done);
  input.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Enter") done();
    if (e.key === "Escape") render();
  });
}
$("addPage").appendChild(icon("plus", 15));
$("addPage").addEventListener("click", function () {
  doc.pages.push(newPage("Sheet " + (doc.pages.length + 1)));
  doc.active = doc.pages.length - 1;
  sel.clear(); resetDom(); commit(); render(); fitView();
});

/* ================================================================
   23. The reveal
   ================================================================ */
var revealTimers = [];

/* A sheet can carry its own reveal: things shown from the start, then
   steps that each appear together. Anything the custom order does not
   mention (new shapes, pasted ones) joins at the end in the automatic
   order, so the custom order never hides something. */
function revealSteps() {
  var auto = revealOrder();
  var custom = page().reveal;
  if (!custom) return { start: [], steps: auto.map(function (k) { return [{ id: k, hide: false }]; }), pauses: auto.map(function () { return 0; }), endPause: 0, custom: false };
  /* Steps hold entries: a plain id appears, { id, hide: true } disappears.
     Each item appears once and hides at most once, and only after it has
     appeared; anything that breaks that is dropped rather than played. */
  var live = new Set(auto), seen = new Set(), shownAt = {};
  var start = (custom.start || []).filter(function (k) {
    if (!live.has(k) || seen.has(k)) return false;
    seen.add(k); shownAt[k] = -1;
    return true;
  });
  /* A stored step is a list of entries, or { pause, items } when it
     waits a number of seconds before it happens. */
  var steps = [], pauses = [];
  custom.steps.forEach(function (raw) {
    var index = steps.length, kept = [];
    var items = Array.isArray(raw) ? raw : (raw && raw.items) || [];
    items.forEach(function (e) {
      var entry = typeof e === "string" ? { id: e, hide: false } : { id: e && e.id, hide: !!(e && e.hide) };
      var key = entryKey(entry);
      if (!live.has(entry.id) || seen.has(key)) return;
      if (entry.hide && !(shownAt[entry.id] < index)) return;
      seen.add(key);
      if (!entry.hide) shownAt[entry.id] = index;
      kept.push(entry);
    });
    if (kept.length) { steps.push(kept); pauses.push(Array.isArray(raw) ? 0 : clamp(+raw.pause || 0, 0, 60)); }
  });
  auto.forEach(function (k) { if (!seen.has(k)) { steps.push([{ id: k, hide: false }]); pauses.push(0); } });
  /* end: seconds to hold once the last step is done, before Play
     finishes and before an animated GIF starts over */
  return { start: start, steps: steps, pauses: pauses, endPause: clamp(+custom.end || 0, 0, 60), custom: true };
}
function entryKey(e) { return e.hide ? e.id + "#hide" : e.id; }
function stepIds(st) { return st.map(function (e) { return e.id; }); }

/* Stores a reveal after checking that every hide comes in a later step
   than its item's appearance. Returns false (and says why) if not. The
   end pause is kept as it is unless a new one is passed. */
function saveReveal(start, steps, pauses, endPause) {
  var end = endPause !== undefined ? endPause : clamp(+(page().reveal && page().reveal.end) || 0, 0, 60);
  pauses = (pauses || []).filter(function (p, i) { return steps[i] && steps[i].length; });
  steps = steps.filter(function (st) { return st.length; });
  var shownAt = {};
  start.forEach(function (k) { shownAt[k] = -1; });
  steps.forEach(function (st, i) { st.forEach(function (e) { if (!e.hide) shownAt[e.id] = i; }); });
  for (var i = 0; i < steps.length; i++) {
    for (var j = 0; j < steps[i].length; j++) {
      var e = steps[i][j];
      if (e.hide && !(shownAt[e.id] < i)) {
        toast("“" + itemName(e.id).label + "” has to appear before it can hide");
        render();
        return false;
      }
    }
  }
  page().reveal = {
    start: start.slice(),
    steps: steps.map(function (st, i) {
      var items = st.map(function (e) { return e.hide ? { id: e.id, hide: true } : e.id; });
      return pauses[i] ? { pause: pauses[i], items: items } : items;
    })
  };
  if (end) page().reveal.end = end;
  commit(); render();
  return true;
}

function revealOrder() {
  var keys = [], seen = {};
  function visit(id) {
    if (seen[id]) return;
    seen[id] = true;
    keys.push(id);
    edges().filter(function (e) { return e.from === id; }).forEach(function (edge) {
      keys.push(edge.id);
      visit(edge.to);
    });
  }
  var hasIncoming = {};
  edges().forEach(function (edge) { hasIncoming[edge.to] = true; });
  nodes().filter(function (n) { return !hasIncoming[n.id]; }).forEach(function (n) { visit(n.id); });
  nodes().forEach(function (n) { visit(n.id); });
  edges().forEach(function (edge) { if (keys.indexOf(edge.id) === -1) keys.push(edge.id); });
  texts().forEach(function (item) { keys.push(item.id); });
  return keys;
}
function setKeyOpacity(key, value) {
  Array.prototype.forEach.call(stage.querySelectorAll('[data-key="' + key + '"]'), function (g) {
    g.style.opacity = value;
  });
}
function showEverything() {
  Array.prototype.forEach.call(stage.querySelectorAll("[data-key]"), function (g) { g.style.opacity = ""; });
}
function playingNow() { return revealTimers.length > 0; }
function setPlayButton() {
  var playing = playingNow();
  clear($("playIcon"));
  $("playIcon").appendChild(icon(playing ? "stop" : "play", 13));
  $("playLabel").textContent = playing ? "Stop" : "Play";
}
/* After a reveal with hides finishes, the sheet holds its last frame
   until the next click, then everything comes back for editing. */
var revealHolding = false;
function stopReveal() {
  if (revealHolding && !revealTimers.length) { revealHolding = false; showEverything(); setHint("Back to editing."); return; }
  if (!revealTimers.length) return;
  revealHolding = false;
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  hitsGroup.style.display = "";
  showEverything();
  setPlayButton();
  markPlayingStep(-1);
  setHint("Reveal stopped.");
}
function playReveal() {
  if (playingNow()) { stopReveal(); return; }
  if (!nodes().length && !texts().length) { setHint("Add something first."); return; }
  if (reduceMotion) { showEverything(); setHint("Reduced motion is on, so the sheet is shown all at once."); return; }

  sel.clear();
  closeEditor(true);
  render();
  showEverything();
  revealHolding = false;

  var plan = revealSteps();
  if (!plan.steps.length) { setHint("Everything is set to show from the start, so there is nothing to reveal."); return; }
  var step = parseInt($("speed").value, 10);
  plan.steps.forEach(function (st) { st.forEach(function (e) { if (!e.hide) setKeyOpacity(e.id, "0"); }); });
  var anyHides = plan.steps.some(function (st) { return st.some(function (e) { return e.hide; }); });
  hitsGroup.style.display = "none";
  setHint("Playing. Press Play again or click the sheet to stop.");

  var at = 0;
  plan.steps.forEach(function (st, index) {
    at += (index ? step : 0) + plan.pauses[index] * 1000;
    revealTimers.push(setTimeout(function () {
      st.forEach(function (e) { setKeyOpacity(e.id, e.hide ? "0" : "1"); });
      markPlayingStep(index);
      if (index === plan.steps.length - 1) {
        var finish = function () {
          revealTimers = [];
          hitsGroup.style.display = "";
          setPlayButton();
          markPlayingStep(-1);
          revealHolding = anyHides;
          setHint(anyHides ? "Reveal finished. Click the sheet to bring back what was hidden." : "Reveal finished.");
        };
        if (plan.endPause) revealTimers.push(setTimeout(finish, plan.endPause * 1000));
        else finish();
      }
    }, at));
  });
  setPlayButton();
}

/* ================================================================
   23b. Reveal order panel
        Steps can be dragged around, items dragged between steps (to
        appear together) or into the gaps (to get a step of their own).
        The arrows on each step do the same for anyone not dragging.
   ================================================================ */
var orderPanel = $("orderPanel"), orderBody = $("orderBody");
var orderDrag = null;     /* entries ({ id, hide }) being dragged in the panel */
var orderHover = [];      /* ids outlined on the sheet while a step is hovered */

function itemName(id) {
  var f = findAny(id);
  if (!f) return { label: "", icon: "box", dim: true };
  var it = f.item;
  if (f.kind === "text") return { label: plainText(it.text).split("\n")[0] || "Empty text", icon: "text", dim: !it.text };
  if (f.kind === "edge") {
    if (it.label) return { label: plainText(it.label), icon: "connect" };
    var a = findNode(it.from), b = findNode(it.to), what = it.head === "none" && it.tail !== "arrow" ? "Line" : "Arrow";
    if (!a && !b) return { label: what, icon: what === "Line" ? "line" : "connect", dim: true };
    return { label: what + ": " + (a ? shortName(a) : "·") + " → " + (b ? shortName(b) : "·"), icon: "connect", dim: true };
  }
  if (it.type === "image") return { label: "Image", icon: "image", dim: true };
  if (it.type === "ink") return { label: "Drawing", icon: "pen", dim: true };
  if (it.type === "code") {
    var firstLine = String(it.code || "").split("\n").filter(function (l) { return l.trim(); })[0];
    return { label: firstLine ? "Code: " + firstLine.trim() : "Code", icon: "code", dim: !firstLine };
  }
  if (it.type === "table") {
    var first = [].concat.apply([], it.cells).filter(Boolean)[0];
    return { label: first ? "Table: " + plainText(first).split("\n")[0] : "Table", icon: "table", dim: !first };
  }
  var kinds = { box: "Box", diamond: "Diamond", ellipse: "Ellipse", pill: "Pill", note: "Note" };
  var title = plainText(it.title || "").split("\n")[0];
  return { label: title || kinds[it.type] || "Shape", icon: it.style === "sketch" ? "sketch" : it.type, dim: !title };
}
function shortName(node) {
  if (!node) return "?";
  return plainText(node.title || "").split("\n")[0] || (node.type === "image" ? "image" : node.type);
}

/* Moves entries to the start zone, into a step, or into the gap before
   step `index` (an index past the end makes a new last step). Taking them
   out first keeps every step in place, so the indexes still line up. */
function moveReveal(entries, target) {
  var r = revealSteps(), gone = new Set(entries.map(entryKey));
  if (target.kind === "start" && entries.some(function (e) { return e.hide; })) {
    toast("Hiding happens during Play, so it cannot go in “Showing from the start”");
    render();
    return;
  }
  var start = r.start.filter(function (k) { return !gone.has(k); });
  var steps = r.steps.map(function (st) { return st.filter(function (e) { return !gone.has(entryKey(e)); }); });
  var pauses = r.pauses.slice();
  if (target.kind === "start") start = start.concat(entries.map(function (e) { return e.id; }));
  else if (target.kind === "step") steps[target.index] = steps[target.index].concat(entries);
  else { steps.splice(target.index, 0, entries.slice()); pauses.splice(target.index, 0, 0); }
  saveReveal(start, steps, pauses);
}
function moveStep(index, by) {
  var r = revealSteps(), to = index + by;
  if (to < 0 || to >= r.steps.length) return;
  var moving = r.steps.splice(index, 1)[0], wait = r.pauses.splice(index, 1)[0];
  r.steps.splice(to, 0, moving);
  r.pauses.splice(to, 0, wait);
  saveReveal(r.start, r.steps, r.pauses);
}
function splitStep(index) {
  var r = revealSteps(), parts = r.steps[index].map(function (e) { return [e]; });
  r.steps.splice.apply(r.steps, [index, 1].concat(parts));
  r.pauses.splice.apply(r.pauses, [index + 1, 0].concat(parts.slice(1).map(function () { return 0; })));
  saveReveal(r.start, r.steps, r.pauses);
}
/* A hide goes in its own step right after the item appears (or at the
   very end), ready to be dragged in with whatever it should go with. */
function addHide(id, atEnd) {
  var r = revealSteps();
  if (r.steps.some(function (st) { return st.some(function (e) { return e.id === id && e.hide; }); })) {
    toast("It already has a hide step");
    return;
  }
  var shown = -1;
  r.steps.forEach(function (st, i) { if (st.some(function (e) { return e.id === id && !e.hide; })) shown = i; });
  if (shown < 0 && r.start.indexOf(id) < 0) return;
  var at = atEnd ? r.steps.length : shown + 1;
  r.steps.splice(at, 0, [{ id: id, hide: true }]);
  r.pauses.splice(at, 0, 0);
  if (saveReveal(r.start, r.steps, r.pauses)) toast("Added a step that hides it. Drag it to the moment it should go.");
}
function removeHide(id) {
  var r = revealSteps();
  saveReveal(r.start, r.steps.map(function (st) { return st.filter(function (e) { return !(e.id === id && e.hide); }); }), r.pauses);
}
/* A pause is extra time, in seconds, waited before a step happens, on top
   of the usual spacing set by the speed menu. Index steps.length is the
   pause after the last step. */
function setPause(index, seconds) {
  var r = revealSteps(), v = clamp(Math.round((+seconds || 0) * 10) / 10, 0, 60);
  if (index >= r.steps.length) { saveReveal(r.start, r.steps, r.pauses, v); return; }
  r.pauses[index] = v;
  saveReveal(r.start, r.steps, r.pauses);
}
function pauseTitle(index) {
  return index >= revealSteps().steps.length ? "Hold after the last step" : "Pause before step " + (index + 1);
}
function formatPause(seconds) { return (Math.round(seconds * 10) / 10) + "s"; }
function pauseMenu(index, current, x, y) {
  var items = [{ header: pauseTitle(index) }];
  [0.5, 1, 2, 3, 5].forEach(function (v) {
    items.push({ label: formatPause(v), checked: current === v ? true : null, run: function () { setPause(index, v); } });
  });
  items.push({ label: "Other amount…", run: function () { askPause(index, current); } });
  if (current) items.push("-", { label: "Remove the pause", icon: "trash", danger: true, run: function () { setPause(index, 0); } });
  openMenuAt(x, y, items);
}
function askPause(index, current) {
  openModal(function (m) {
    var atEnd = index >= revealSteps().steps.length;
    m.appendChild(htmlEl("h2", null, pauseTitle(index)));
    m.appendChild(htmlEl("p", "sub", atEnd
      ? "Extra time to stay on the finished sheet. A GIF holds this long (plus its usual 2.5s) before it starts over."
      : "Extra time to wait, on top of the usual spacing between steps."));
    var row = htmlEl("div");
    row.style.cssText = "display:flex;gap:8px;align-items:center";
    var input = numberControl(current || 2, 0, 60, "Seconds", function () {}, 0.1);
    input.style.width = "90px";
    row.appendChild(input);
    row.appendChild(htmlEl("span", null, "seconds"));
    m.appendChild(row);
    function apply() { closeModal(); setPause(index, parseFloat(input.value)); }
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); apply(); } });
    var foot = htmlEl("div", "modal-foot");
    foot.appendChild(toolButton({ label: "Cancel", onClick: closeModal }));
    var ok = toolButton({ label: "Set pause", onClick: apply });
    ok.classList.add("accent");
    foot.appendChild(ok);
    m.appendChild(foot);
    window.requestAnimationFrame(function () { input.focus(); input.select(); });
  });
}

function orderChip(entry, hasHide) {
  var info = itemName(entry.id);
  var row = htmlEl("div", "chip-row" + (entry.hide ? " hides" : ""));
  var chip = htmlEl("button", "chip" + (info.dim ? " dim" : ""));
  chip.type = "button";
  chip.draggable = true;
  chip.appendChild(icon(entry.hide ? "eyeOff" : info.icon, 14));
  if (entry.hide) chip.appendChild(htmlEl("b", "chip-tag", "Hide"));
  chip.appendChild(htmlEl("span", null, info.label));
  chip.dataset.tip = entry.hide ? "Disappears here. Drag to another step" : "Drag to another step";
  chip.addEventListener("click", function (e) { e.stopPropagation(); selectOnly(entry.id); });
  chip.addEventListener("dragstart", function (e) { startOrderDrag(e, [entry], row); e.stopPropagation(); });
  chip.addEventListener("dragend", endOrderDrag);
  row.appendChild(chip);
  if (entry.hide) {
    row.appendChild(toolButton({ icon: "close", title: "Remove this hide", size: 12, onClick: function (e) { e.stopPropagation(); removeHide(entry.id); } }));
  } else if (!hasHide) {
    row.appendChild(toolButton({ icon: "eyeOff", title: "Hide it later in the reveal", size: 13, onClick: function (e) { e.stopPropagation(); addHide(entry.id); } }));
  }
  return row;
}
function startOrderDrag(e, entries, el) {
  orderDrag = entries;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", "reveal");
  el.classList.add("dragging");
}
function endOrderDrag() {
  orderDrag = null;
  Array.prototype.forEach.call(orderBody.querySelectorAll(".dragging, .over"), function (n) { n.classList.remove("dragging", "over"); });
}
function dropTarget(el, target) {
  el.addEventListener("dragover", function (e) {
    if (!orderDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    el.classList.add("over");
  });
  el.addEventListener("dragleave", function (e) { if (!el.contains(e.relatedTarget)) el.classList.remove("over"); });
  el.addEventListener("drop", function (e) {
    if (!orderDrag) return;
    e.preventDefault(); e.stopPropagation();
    var entries = orderDrag;
    endOrderDrag();
    moveReveal(entries, target);
  });
}
function hoverIds(ids) { orderHover = ids; drawOverlay(); }

function renderOrderPanel() {
  if (orderPanel.hidden) return;
  clear(orderBody);
  var r = revealSteps();
  $("orderReset").disabled = !r.custom;

  orderBody.appendChild(htmlEl("p", "order-note",
    "Drag to change when things appear or hide. Everything in one step happens at the same moment. Use the eye on an item to make it hide later."));
  var hidden = new Set();
  r.steps.forEach(function (st) { st.forEach(function (e) { if (e.hide) hidden.add(e.id); }); });

  orderBody.appendChild(htmlEl("div", "order-label", "Showing from the start"));
  var zone = htmlEl("div", "start-zone");
  if (r.start.length) r.start.forEach(function (id) { zone.appendChild(orderChip({ id: id, hide: false }, hidden.has(id))); });
  else zone.appendChild(htmlEl("div", "empty", "Drop things here to have them on the sheet before Play begins."));
  dropTarget(zone, { kind: "start" });
  orderBody.appendChild(zone);

  orderBody.appendChild(htmlEl("div", "order-label", r.steps.length ? "Then, one step at a time" : "No steps yet"));
  r.steps.forEach(function (entries, index) {
    var ids = stepIds(entries);
    var gap = htmlEl("div", "gap");
    var wait = r.pauses[index];
    if (wait) {
      gap.classList.add("has-pause");
      var pill = htmlEl("button", "pause-pill");
      pill.type = "button";
      pill.appendChild(icon("pause", 12));
      pill.appendChild(htmlEl("span", null, formatPause(wait) + " pause"));
      pill.dataset.tip = "Change or remove this pause";
      pill.addEventListener("click", function (e) {
        e.stopPropagation();
        var rc = pill.getBoundingClientRect();
        pauseMenu(index, wait, rc.left, rc.bottom + 4);
      });
      gap.appendChild(pill);
    }
    dropTarget(gap, { kind: "gap", index: index });
    orderBody.appendChild(gap);

    var card = htmlEl("div", "step");
    card.dataset.step = index;
    if (ids.some(function (id) { return sel.has(id); })) card.classList.add("picked");
    var num = htmlEl("span", "step-num", String(index + 1));
    num.draggable = true;
    num.dataset.tip = "Drag to move this step";
    num.addEventListener("dragstart", function (e) { startOrderDrag(e, entries.slice(), card); });
    num.addEventListener("dragend", endOrderDrag);
    card.appendChild(num);

    var list = htmlEl("div", "step-items");
    entries.forEach(function (e) { list.appendChild(orderChip(e, hidden.has(e.id))); });
    card.appendChild(list);

    var after = index + 1 < r.steps.length ? r.pauses[index + 1] : r.endPause;
    function stepMenu(x, y) {
      openMenuAt(x, y, [
        { label: "Move earlier", icon: "up", disabled: index === 0, run: function () { moveStep(index, -1); } },
        { label: "Move later", icon: "down", disabled: index === r.steps.length - 1, run: function () { moveStep(index, 1); } },
        { label: "Split into separate steps", icon: "distV", disabled: entries.length < 2, run: function () { splitStep(index); } },
        "-",
        { label: r.pauses[index] ? "Change the pause before it…" : "Pause before this step…", icon: "pause",
          run: function () { pauseMenu(index, r.pauses[index], x, y); } },
        { label: after ? "Change the pause after it…" : "Pause after this step…", icon: "pause",
          run: function () { pauseMenu(index + 1, after, x, y); } }
      ]);
    }
    var tools = htmlEl("div", "step-tools");
    tools.appendChild(toolButton({
      icon: "more", title: "Move or split this step", size: 14,
      onClick: function (e, b) { e.stopPropagation(); var rc = b.getBoundingClientRect(); stepMenu(rc.left, rc.bottom + 4); }
    }));
    card.appendChild(tools);
    card.addEventListener("contextmenu", function (e) { e.preventDefault(); stepMenu(e.clientX, e.clientY); });

    card.addEventListener("mouseenter", function () { hoverIds(ids); });
    card.addEventListener("mouseleave", function () { hoverIds([]); });
    card.addEventListener("click", function () {
      sel = new Set(ids); afterSelect();
    });
    dropTarget(card, { kind: "step", index: index });
    orderBody.appendChild(card);
  });
  var tail = htmlEl("div", "gap");
  if (r.endPause && r.steps.length) {
    tail.classList.add("has-pause");
    var hold = htmlEl("button", "pause-pill");
    hold.type = "button";
    hold.appendChild(icon("pause", 12));
    hold.appendChild(htmlEl("span", null, formatPause(r.endPause) + " hold at the end"));
    hold.dataset.tip = "Change or remove the hold after the last step";
    hold.addEventListener("click", function (e) {
      e.stopPropagation();
      var rc = hold.getBoundingClientRect();
      pauseMenu(r.steps.length, r.endPause, rc.left, rc.bottom + 4);
    });
    tail.appendChild(hold);
  }
  dropTarget(tail, { kind: "gap", index: r.steps.length });
  orderBody.appendChild(tail);
}
function markPickedSteps() {
  if (orderPanel.hidden) return;
  var r = revealSteps();
  Array.prototype.forEach.call(orderBody.querySelectorAll(".step"), function (card) {
    var ids = stepIds(r.steps[+card.dataset.step] || []);
    card.classList.toggle("picked", ids.some(function (id) { return sel.has(id); }));
  });
}
function markPlayingStep(index) {
  Array.prototype.forEach.call(orderBody.querySelectorAll(".step"), function (card) {
    card.classList.toggle("playing", +card.dataset.step === index);
  });
  var live = orderBody.querySelector(".step.playing");
  if (live && live.scrollIntoView) live.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
}
function toggleOrderPanel(open) {
  orderPanel.hidden = open === undefined ? !orderPanel.hidden : !open;
  buildRail();
  orderHover = [];
  renderOrderPanel();
  applyView();
}
$("orderReset").addEventListener("click", function () {
  if (!page().reveal) return;
  page().reveal = null;
  commit(); render();
  toast("Back to the automatic order");
});

