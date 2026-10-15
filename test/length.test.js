const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/engine.js");

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + " vs " + b);

test("imperial lengths the way a tape measure reads", () => {
  near(R.parseLength("12", "imperial"), 12 * R.FT);
  near(R.parseLength("12' 6\"", "imperial"), 12.5 * R.FT);
  near(R.parseLength("12ft 6in", "imperial"), 12.5 * R.FT);
  near(R.parseLength("12 6", "imperial"), 12.5 * R.FT);
  near(R.parseLength("12\u2032 6\u2033", "imperial"), 12.5 * R.FT);
  near(R.parseLength("150 in", "imperial"), 150 * 0.0254);
  near(R.parseLength("12.5", "imperial"), 12.5 * R.FT);
});

test("metric lengths with units, comma decimals, and bare cm or mm", () => {
  near(R.parseLength("3.6", "metric"), 3.6);
  near(R.parseLength("3,6", "metric"), 3.6);
  near(R.parseLength("360cm", "metric"), 3.6);
  near(R.parseLength("3600 mm", "metric"), 3.6);
  near(R.parseLength("360", "metric"), 3.6);
  near(R.parseLength("3600", "metric"), 3.6);
  near(R.parseLength("2.4 m", "metric"), 2.4);
});

test("nonsense is null, not zero", () => {
  assert.equal(R.parseLength("", "metric"), null);
  assert.equal(R.parseLength("abc", "imperial"), null);
  assert.equal(R.parseLength("-3", "metric"), null);
});

test("lengths, areas and amounts shown back in the shopper's units", () => {
  assert.equal(R.showLength(12.5 * R.FT, "imperial"), "12' 6\"");
  assert.equal(R.showLength(8 * R.FT, "imperial"), "8'");
  assert.equal(R.showLength(2.4, "metric"), "2.4 m");
  assert.equal(R.showArea(302 * R.SQFT, "imperial"), "302 sq ft");
  assert.equal(R.showVolume(2 * R.GAL, "imperial"), "2 gal");
  assert.equal(R.showVolume(6540, "metric"), "6.5 L");
});

test("fractions of an inch, typed or as the ½ characters", () => {
  const ftIn = (f, i) => (f + i / 12) * R.FT;
  near(R.parseLength("8' 6 1/2\"", "imperial"), ftIn(8, 6.5));
  near(R.parseLength("8 6 1/2", "imperial"), ftIn(8, 6.5));
  near(R.parseLength("8ft 6½in", "imperial"), ftIn(8, 6.5));
  near(R.parseLength("8' 3/4\"", "imperial"), ftIn(8, 0.75));
  near(R.parseLength("12 1/2", "imperial"), 12.5 * R.FT);
  near(R.parseLength("150 3/8 in", "imperial"), 150.375 * 0.0254);
  near(R.parseLength("10' 5⅛\"", "imperial"), ftIn(10, 5.125));
  assert.equal(R.parseLength("8 6 1/0", "imperial"), null);
});
