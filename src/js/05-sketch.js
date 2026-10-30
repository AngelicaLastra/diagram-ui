/* ================================================================
   7. Seeded randomness, so each shape is crooked in its own way
   ================================================================ */
function hashOf(text) {
  var hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash = hash ^ text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function makeRandom(seed) {
  var state = seed;
  return function () {
    state = (state + 0x6D2B79F5) | 0;
    var t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function filterIdFor(id) { return "wc" + (hashOf(id) % FILTER_COUNT); }

function buildFilters() {
  Array.prototype.forEach.call(defs.querySelectorAll("filter"), function (node) {
    node.parentNode.removeChild(node);
  });
  var scale = ROUGHNESS[roughness].scale;

  for (var i = 0; i < FILTER_COUNT; i++) {
    var filter = makeEl("filter", { id: "wc" + i, x: "-15%", y: "-15%", width: "130%", height: "130%" });
    filter.appendChild(makeEl("feTurbulence", {
      type: "fractalNoise", baseFrequency: (0.011 + i * 0.003).toFixed(3),
      numOctaves: 2, seed: 7 + i * 13, result: "warp"
    }));
    filter.appendChild(makeEl("feDisplacementMap", {
      in: "SourceGraphic", in2: "warp", scale: (scale * FILTER_MIX[i]).toFixed(2),
      xChannelSelector: "R", yChannelSelector: "G", result: "shape"
    }));
    filter.appendChild(makeEl("feTurbulence", {
      type: "fractalNoise", baseFrequency: 0.8, numOctaves: 4, seed: 3 + i * 5, result: "noise"
    }));
    filter.appendChild(makeEl("feColorMatrix", {
      in: "noise", type: "matrix", result: "grain",
      values: "0 0 0 0 0.43  0 0 0 0 0.36  0 0 0 0 0.27  0 0 0 0.28 0"
    }));
    filter.appendChild(makeEl("feComposite", { in: "grain", in2: "shape", operator: "in", result: "grainClipped" }));
    var merge = makeEl("feMerge", {});
    merge.appendChild(makeEl("feMergeNode", { in: "shape" }));
    merge.appendChild(makeEl("feMergeNode", { in: "grainClipped" }));
    filter.appendChild(merge);
    defs.appendChild(filter);
  }
}

/* ================================================================
   8. Hand drawn outlines
   ================================================================ */
function jitterPoints(points, jitter, random) {
  return points.map(function (p) {
    return { x: p.x + (random() * 2 - 1) * jitter, y: p.y + (random() * 2 - 1) * jitter };
  });
}
function closedPath(moved, jitter, random) {
  function off() { return (random() * 2 - 1) * jitter * 1.3; }
  var d = "M" + moved[0].x.toFixed(1) + "," + moved[0].y.toFixed(1);
  for (var i = 0; i < moved.length; i++) {
    var from = moved[i];
    var to = moved[(i + 1) % moved.length];
    d += " Q" + ((from.x + to.x) / 2 + off()).toFixed(1) + "," +
         ((from.y + to.y) / 2 + off()).toFixed(1) + " " +
         to.x.toFixed(1) + "," + to.y.toFixed(1);
  }
  return d + " Z";
}
function wobblyPath(points, jitter, random) {
  return closedPath(jitterPoints(points, jitter, random), jitter, random);
}

/* One side drawn as its own stroke running past both corners. That
   overshoot is what makes ink look hand laid. */
function sidePath(a, b, jitter, random) {
  var dx = b.x - a.x, dy = b.y - a.y;
  var length = Math.sqrt(dx * dx + dy * dy) || 1;
  var ux = dx / length, uy = dy / length;
  var head = 2 + random() * 4, tail = 2 + random() * 4;
  var start = { x: a.x - ux * head, y: a.y - uy * head };
  var end = { x: b.x + ux * tail, y: b.y + uy * tail };
  var midX = (start.x + end.x) / 2 + (random() * 2 - 1) * jitter * 1.2;
  var midY = (start.y + end.y) / 2 + (random() * 2 - 1) * jitter * 1.2;
  return "M" + start.x.toFixed(1) + "," + start.y.toFixed(1) +
         " Q" + midX.toFixed(1) + "," + midY.toFixed(1) +
         " " + end.x.toFixed(1) + "," + end.y.toFixed(1);
}

