"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../src/engine.js");

test("no trim area unless the trim box is ticked", () => {
  assert.equal(E.trimArea({ length: 4, width: 3, doors: 1, windows: 1 }), 0);
});

test("trim area is skirting plus door and window frames", () => {
  // 4 x 3 room: perimeter 14 m x 0.15 = 2.1; one door 0.6; one window 0.5 = 3.2.
  const a = E.trimArea({ length: 4, width: 3, doors: 1, windows: 1, trim: true });
  assert.ok(Math.abs(a - 3.2) < 1e-9, "got " + a);
});

test("a custom skirting height changes the skirting part", () => {
  const a = E.trimArea({ length: 4, width: 3, doors: 0, windows: 0, trim: true, skirt: 0.2 });
  assert.ok(Math.abs(a - 14 * 0.2) < 1e-9, "got " + a);
});

test("ticking trim adds a woodwork paint to the plan", () => {
  const withTrim = E.plan({ region: "uk", coats: 2, rooms: [{ length: 4, width: 3, height: 2.4, doors: 1, windows: 1, trim: true }] });
  const without = E.plan({ region: "uk", coats: 2, rooms: [{ length: 4, width: 3, height: 2.4, doors: 1, windows: 1 }] });
  const trimPaint = withTrim.paints.find((p) => p.key === "trim");
  assert.ok(trimPaint, "woodwork paint present");
  assert.ok(trimPaint.ml > 0);
  assert.ok(!without.paints.find((p) => p.key === "trim"), "none without the tick");
  // The woodwork is bought separately, so it adds to the bill.
  assert.ok(withTrim.total > without.total);
});
