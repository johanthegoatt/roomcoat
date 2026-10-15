const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/engine.js");

const ft = (x) => x * R.FT;

test("a 12 x 10 ft room with 8 ft walls, one door and two windows", () => {
  const a = R.roomArea({ length: ft(12), width: ft(10), height: ft(8), doors: 1, windows: 2, ceiling: true }, "us");
  assert.ok(Math.abs(a.gross / R.SQFT - 352) < 1e-6);
  assert.ok(Math.abs(a.walls / R.SQFT - (352 - 20 - 30)) < 1e-6);
  assert.ok(Math.abs(a.ceiling / R.SQFT - 120) < 1e-6);
});

test("openings never push the wall area below zero", () => {
  const a = R.roomArea({ length: 1, width: 1, height: 1, doors: 5 }, "uk");
  assert.equal(a.walls, 0);
  assert.equal(a.openings, a.gross);
});

test("350 sq ft per gallon, two coats: 302 sq ft needs about 1.8 gallons", () => {
  const p = R.plan({ region: "us", coats: 2, rooms: [{ length: ft(12), width: ft(10), height: ft(8), doors: 1, windows: 2 }] });
  const gal = p.paints[0].ml / R.GAL;
  // 302 * 2 / 350 = 1.726, plus 5% for trays and rollers
  assert.ok(Math.abs(gal - 1.726 * 1.05) < 0.01, String(gal));
});

test("cheapest tins: two gallons beat a gallon and three quarts", () => {
  const cans = R.REGIONS.us.cans;
  const b = R.bestCans(6900, cans);
  assert.deepEqual(b.items.map((i) => [i.id, i.qty]), [["gal", 2]]);
  assert.equal(b.cost, 90);
});

test("a little over a gallon adds a quart, not a second gallon", () => {
  const b = R.bestCans(4300, R.REGIONS.us.cans);
  assert.deepEqual(b.items.map((i) => [i.id, i.qty]), [["gal", 1], ["qt", 1]]);
});

test("UK: 6 L is cheaper as 5 L + 1 L than as three 2.5 L tins", () => {
  const b = R.bestCans(6000, R.REGIONS.uk.cans);
  assert.deepEqual(b.items.map((i) => [i.id, i.qty]), [["5l", 1], ["1l", 1]]);
  assert.equal(b.cost, 54);
});

test("on a price tie, the mix with less left over wins", () => {
  const cans = [{ id: "a", ml: 1000, price: 10 }, { id: "b", ml: 3000, price: 10 }];
  const b = R.bestCans(900, cans);
  assert.equal(b.ml, 1000);
});

test("a tin size with no price is left out", () => {
  const cans = R.REGIONS.uk.cans.map((c) => (c.id === "1l" ? { ...c, price: "" } : c));
  const b = R.bestCans(800, cans);
  assert.deepEqual(b.items.map((i) => i.id), ["2.5l"]);
});

test("new plaster: primer in the US, an extra mist coat in the UK", () => {
  const room = { length: 4, width: 3, height: 2.4, surface: "new" };
  assert.deepEqual(R.coatsFor(room, 2, "us"), { top: 2, primer: 1 });
  assert.deepEqual(R.coatsFor(room, 2, "uk"), { top: 3, primer: 0 });
  const p = R.plan({ region: "us", coats: 2, rooms: [room] });
  assert.ok(p.paints.some((x) => x.key === "primer"));
});

test("dark to light adds a coat; textured walls add 10% instead of 5%", () => {
  assert.equal(R.coatsFor({ darkToLight: true }, 2, "uk").top, 3);
  assert.equal(R.wasteFor({ surface: "textured" }), 0.1);
  assert.equal(R.wasteFor({}), 0.05);
});

test("two rooms in the same colour share one paint line", () => {
  const p = R.plan({ region: "uk", coats: 2, rooms: [
    { length: 4, width: 3, height: 2.4, paint: "Sage" },
    { length: 3, width: 3, height: 2.4, paint: "sage " },
    { length: 3, width: 2, height: 2.4, paint: "White", ceiling: true }
  ] });
  assert.deepEqual(p.paints.map((x) => x.key), ["wall:sage", "wall:white", "ceiling"]);
  assert.ok(p.total > 0);
});

test("a bigger room never needs less paint", () => {
  let last = 0;
  for (let L = 1; L < 12; L += 0.5) {
    const p = R.plan({ region: "uk", coats: 2, rooms: [{ length: L, width: 3, height: 2.4 }] });
    assert.ok(p.paints[0].ml >= last);
    last = p.paints[0].ml;
  }
});

test("3.3 gallons: cheapest is 3 gallons + 2 quarts, with 4 gallons offered for $1 more", () => {
  const b = R.bestCans(3.3 * R.GAL, R.REGIONS.us.cans);
  assert.deepEqual(b.items.map((i) => [i.id, i.qty]), [["gal", 3], ["qt", 2]]);
  assert.equal(b.cost, 179);
  assert.deepEqual(b.alt.items.map((i) => [i.id, i.qty]), [["gal", 4]]);
  assert.equal(b.alt.more, 1);
});

test("no alternative when the cheapest is already the fewest tins", () => {
  const b = R.bestCans(6900, R.REGIONS.us.cans);
  assert.equal(b.alt, undefined);
});

test("a new plaster ceiling gets its mist coat too where there's no separate primer", () => {
  const room = { length: 4, width: 3, height: 2.4, ceiling: true };
  const ceiling = (region, surface) =>
    R.plan({ region, rooms: [{ ...room, surface }] }).paints.find((p) => p.key === "ceiling").ml;
  assert.ok(Math.abs(ceiling("uk", "new") / ceiling("uk", "smooth") - 3 / 2) < 1e-9);
  // In the US the primer already covers the ceiling, so its top coats stay the same.
  assert.equal(ceiling("us", "new"), ceiling("us", "smooth"));
});
