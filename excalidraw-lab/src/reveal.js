/* The Play reveal, ported from diagram-studio.
   Walks the arrows as a graph so a diagram unfolds in reading order rather
   than in whatever order the elements happen to sit in the array. */

function boundIds(el) {
  return {
    from: el.startBinding && el.startBinding.elementId,
    to: el.endBinding && el.endBinding.elementId
  };
}

/* One step per shape or arrow. Bound labels ride along with their owner. */
export function revealOrder(elements) {
  const arrows = elements.filter((e) => e.type === "arrow");
  const owners = new Map();
  elements.forEach((e) => {
    if (e.containerId) {
      if (!owners.has(e.containerId)) owners.set(e.containerId, []);
      owners.get(e.containerId).push(e.id);
    }
  });

  const stepFor = (id) => [id].concat(owners.get(id) || []);
  const shapes = elements.filter((e) => !e.containerId && e.type !== "arrow");

  const steps = [];
  const seen = new Set();

  function visit(id) {
    if (seen.has(id)) return;
    seen.add(id);
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    steps.push(stepFor(id));
    arrows.forEach((arrow) => {
      const b = boundIds(arrow);
      if (b.from !== id || seen.has(arrow.id)) return;
      seen.add(arrow.id);
      steps.push(stepFor(arrow.id));
      if (b.to) visit(b.to);
    });
  }

  const hasIncoming = new Set();
  arrows.forEach((a) => { const b = boundIds(a); if (b.to) hasIncoming.add(b.to); });

  shapes.filter((s) => !hasIncoming.has(s.id)).forEach((s) => visit(s.id));
  shapes.forEach((s) => visit(s.id));
  arrows.forEach((a) => { if (!seen.has(a.id)) { seen.add(a.id); steps.push(stepFor(a.id)); } });

  return steps;
}

/* Drives the animation through updateScene. Every write is marked so it never
   lands in the undo stack. */
export function createRevealPlayer(getApi, helpers) {
  let timers = [];
  let originals = null;

  const write = (elements) =>
    getApi().updateScene({ elements, captureUpdate: helpers.CaptureUpdateAction.NEVER });

  function setOpacity(ids, value) {
    const wanted = new Set(ids);
    const next = getApi().getSceneElements().map((el) =>
      wanted.has(el.id) ? helpers.newElementWith(el, { opacity: value }) : el
    );
    write(next);
  }

  function restore() {
    if (!originals) return;
    const map = originals;
    const next = getApi().getSceneElements().map((el) =>
      map.has(el.id) ? helpers.newElementWith(el, { opacity: map.get(el.id) }) : el
    );
    write(next);
    originals = null;
  }

  return {
    playing: () => timers.length > 0,
    stop() {
      if (!timers.length) return;
      timers.forEach(clearTimeout);
      timers = [];
      restore();
    },
    play(stepMs, onDone) {
      this.stop();
      const elements = getApi().getSceneElements();
      if (!elements.length) return false;

      originals = new Map(elements.map((el) => [el.id, el.opacity]));
      const steps = revealOrder(elements);
      setOpacity(steps.flat(), 0);

      steps.forEach((ids, i) => {
        timers.push(setTimeout(() => {
          setOpacity(ids, originals.get(ids[0]) ?? 100);
          if (i === steps.length - 1) {
            timers = [];
            originals = null;
            if (onDone) onDone();
          }
        }, i * stepMs));
      });
      return true;
    }
  };
}
