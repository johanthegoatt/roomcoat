// RoomCoat engine: how much paint a room takes, and which tins to buy.
//
// Everything is worked out in square metres and millilitres, then shown in
// the units of the shopper's country. Pure functions, no DOM, so the page
// and `node --test` share the same code.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RoomCoat = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SQFT = 0.09290304;   // m² in one square foot
  var FT = 0.3048;         // m in one foot
  var GAL = 3785.411784;   // mL in one US gallon

  // Defaults per country. Door and window sizes are the ones paint
  // calculators subtract (US: 20 and 15 sq ft; UK/AU: a 1981 x 762 mm door
  // and a typical 1.2 x 1.2 m window). Coverage is a little under what the
  // tin says, because tins quote "up to" on smooth, sealed walls.
  // Tin sizes are the ones on the shelf in each country.
  var REGIONS = {
    us: {
      label: "the US", units: "imperial", money: "$",
      door: 20 * SQFT, window: 15 * SQFT,
      coverage: 350 * SQFT / (GAL / 1000),          // 350 sq ft per gallon, as m²/L
      primerSeparate: true,
      cans: [
        { id: "qt", name: "quart", ml: 946, price: 22 },
        { id: "gal", name: "gallon", ml: 3785, price: 45 },
        { id: "5gal", name: "5 gallon bucket", ml: 18927, price: 190 }
      ]
    },
    uk: {
      label: "the UK or Ireland", units: "metric", money: "£",
      door: 1.51, window: 1.44,
      coverage: 12,
      primerSeparate: false,
      cans: [
        { id: "1l", name: "1 L tin", ml: 1000, price: 14 },
        { id: "2.5l", name: "2.5 L tin", ml: 2500, price: 26 },
        { id: "5l", name: "5 L tin", ml: 5000, price: 40 },
        { id: "10l", name: "10 L tub", ml: 10000, price: 70 }
      ]
    },
    au: {
      label: "Australia or NZ", units: "metric", money: "$",
      door: 1.51, window: 1.44,
      coverage: 14,
      primerSeparate: true,
      cans: [
        { id: "1l", name: "1 L tin", ml: 1000, price: 38 },
        { id: "4l", name: "4 L tin", ml: 4000, price: 95 },
        { id: "10l", name: "10 L tin", ml: 10000, price: 185 },
        { id: "15l", name: "15 L tin", ml: 15000, price: 255 }
      ]
    }
  };

  function num(x, d) {
    var n = typeof x === "number" ? x : parseFloat(x);
    return isFinite(n) ? n : d;
  }

  // Wall and ceiling area of one rectangular room, in m². Lengths come in
  // metres. Openings never take the walls below zero.
  function roomArea(room, region) {
    var r = REGIONS[region] || REGIONS.us;
    var L = Math.max(0, num(room.length, 0));
    var W = Math.max(0, num(room.width, 0));
    var H = Math.max(0, num(room.height, 0));
    var doors = Math.max(0, Math.round(num(room.doors, 0)));
    var windows = Math.max(0, Math.round(num(room.windows, 0)));
    var gross = 2 * (L + W) * H;
    var openings = doors * num(room.doorArea, r.door) + windows * num(room.windowArea, r.window);
    var walls = Math.max(0, gross - openings);
    return {
      gross: gross,
      openings: Math.min(openings, gross),
      walls: walls,
      ceiling: room.ceiling ? L * W : 0
    };
  }

  // Coats that a surface really needs. New plaster or drywall takes a
  // first sealing coat (a separate primer in the US and Australia, a
  // watered-down "mist coat" of the same emulsion in the UK). A big jump
  // from dark to light takes one more top coat.
  function coatsFor(room, coats, region) {
    var r = REGIONS[region] || REGIONS.us;
    var top = Math.max(1, Math.round(num(coats, 2))) + (room.darkToLight ? 1 : 0);
    var seal = room.surface === "new" ? 1 : 0;
    return {
      top: r.primerSeparate ? top : top + seal,
      primer: r.primerSeparate ? seal : 0
    };
  }

  // Extra for spills, rollers, trays and cutting in: 5% on smooth walls,
  // 10% on textured ones that drink paint.
  function wasteFor(room) {
    return room.surface === "textured" ? 0.10 : 0.05;
  }

  function litres(area, coats, coverage, waste) {
    if (!(area > 0) || !(coats > 0) || !(coverage > 0)) return 0;
    return area * coats / coverage * (1 + waste);
  }

  // Add up every room into one amount per paint. Walls use the paint the
  // room names (so two rooms in the same colour share tins), ceilings use
  // ceiling paint, and new surfaces in primer countries add primer.
  function plan(input) {
    var region = REGIONS[input.region] ? input.region : "us";
    var r = REGIONS[region];
    var coverage = num(input.coverage, r.coverage);
    if (!(coverage > 0)) coverage = r.coverage;
    var paints = {}, order = [], rooms = [];

    function add(key, label, colour, ml, area) {
      if (!(ml > 0)) return;
      if (!paints[key]) {
        paints[key] = { key: key, label: label, colour: colour, ml: 0, area: 0 };
        order.push(key);
      }
      paints[key].ml += ml;
      paints[key].area += area;
    }

    (input.rooms || []).forEach(function (room, i) {
      var a = roomArea(room, region);
      var c = coatsFor(room, input.coats, region);
      var w = wasteFor(room);
      var name = (room.paint || "").trim() || "Wall paint";
      var key = "wall:" + name.toLowerCase();
      var wallMl = litres(a.walls, c.top, coverage, w) * 1000;
      // A new ceiling needs sealing as much as new walls do: in primer
      // countries the primer below covers it, elsewhere it takes the mist coat.
      var ceilCoats = Math.max(2, num(input.coats, 2)) + (room.surface === "new" && !r.primerSeparate ? 1 : 0);
      var ceilMl = litres(a.ceiling, ceilCoats, coverage, 0.05) * 1000;
      var primerMl = litres(a.walls + a.ceiling, c.primer, coverage, w) * 1000;
      add(key, name, room.colour || "#d9cbb8", wallMl, a.walls);
      add("ceiling", "Ceiling paint", "#ffffff", ceilMl, a.ceiling);
      add("primer", "Primer", "#f2efe8", primerMl, a.walls + a.ceiling);
      rooms.push({ index: i, name: room.name || "Room " + (i + 1), area: a, coats: c, wallMl: wallMl });
    });

    var cans = input.cans || r.cans;
    var have = input.have || {};
    var list = order.map(function (k) {
      var p = paints[k];
      // Count paint already in the cupboard. Most unused paint is a part-tin
      // of the same colour, and buying around it is the simplest way to stop
      // the pile growing (PaintCare: about a tenth of paint sold goes unused).
      var haveMl = Math.max(0, num(have[k], 0));
      p.haveMl = haveMl;
      p.needMl = Math.max(0, p.ml - haveMl);
      p.enough = haveMl > 0 && p.needMl <= 0;
      p.buy = p.needMl > 0 ? bestCans(p.needMl, cans) : null;
      return p;
    });
    var total = list.reduce(function (s, p) { return s + (p.buy ? p.buy.cost : 0); }, 0);
    return { region: region, coverage: coverage, rooms: rooms, paints: list, total: total };
  }

  var VULGAR = { "\u00bd": "1/2", "\u00bc": "1/4", "\u00be": "3/4", "\u215b": "1/8", "\u215c": "3/8", "\u215d": "5/8", "\u215e": "7/8" };

  // Tape measures are read in fractions of an inch: 6 1/2, 6½, 3/4. Each one
  // becomes a decimal (6.5) before the patterns below see it. A zero
  // denominator means the text isn't a length at all.
  function fractions(s) {
    s = s.replace(/(\d)?\s*([\u00bc-\u00be\u215b-\u215e])/g, function (_, d, f) { return (d || "") + " " + VULGAR[f]; });
    var bad = false;
    s = s.replace(/(?:(\d+)\s+)?(\d+)\/(\d+)/g, function (_, whole, n, d) {
      if (+d === 0) { bad = true; return ""; }
      return String((whole ? +whole : 0) + n / d);
    });
    return bad ? null : s.trim();
  }

  // Read a length the way a tape measure or a plan writes it, and return
  // metres. Imperial: 12, 12.5, 12' 6", 12ft 6in, 12 6, 150in. Metric: 3.6,
  // 3,6 (comma decimal), 360cm, 3600mm, 3.6 m. A bare number is feet for
  // imperial and metres for metric, except a metric number over 100 which
  // is almost always centimetres or millimetres typed without the unit.
  function parseLength(text, units) {
    if (typeof text === "number") return isFinite(text) && text >= 0 ? (units === "imperial" ? text * FT : text) : null;
    var s = String(text || "").trim().toLowerCase()
      .replace(/[\u2032\u2019]/g, "'").replace(/[\u2033\u201d]/g, '"').replace(/''/g, '"');
    s = fractions(s);
    if (s === null) return null;
    if (!s) return null;
    var m;
    if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|metres?|meters?)$/))) {
      var v = parseFloat(m[1].replace(",", "."));
      return m[2] === "mm" ? v / 1000 : m[2] === "cm" ? v / 100 : v;
    }
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inches|inch)?)?$/)))
      return (parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0)) * FT;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inches|inch)$/))) return parseFloat(m[1]) * 0.0254;
    if (units === "imperial" && (m = s.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/)))
      return (parseFloat(m[1]) + parseFloat(m[2]) / 12) * FT;
    if ((m = s.match(/^\d+(?:[.,]\d+)?$/))) {
      var n = parseFloat(s.replace(",", "."));
      if (units === "imperial") return n * FT;
      return n > 1000 ? n / 1000 : n > 100 ? n / 100 : n;
    }
    return null;
  }

  // Show metres back in the shopper's units, rounded like a tape measure.
  function showLength(m, units) {
    if (!(m >= 0)) return "";
    if (units !== "imperial") return (Math.round(m * 100) / 100) + " m";
    var inches = Math.round(m / 0.0254);
    var f = Math.floor(inches / 12), i = inches % 12;
    return i ? f + "' " + i + '"' : f + "'";
  }

  function showArea(m2, units) {
    return units === "imperial" ? Math.round(m2 / SQFT) + " sq ft" : (Math.round(m2 * 10) / 10) + " m²";
  }

  // Paint amounts: gallons with one decimal in the US, litres elsewhere.
  function showVolume(ml, units) {
    if (units === "imperial") return (Math.round(ml / GAL * 10) / 10) + " gal";
    return (Math.round(ml / 100) / 10) + " L";
  }

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  // The cheapest mix of tins that holds at least `need` mL. Unbounded
  // knapsack over volume: best[v] is the cheapest way to hold exactly v,
  // then we take the cheapest v >= need. Ties go to less left over, then
  // fewer tins to carry. Prices of 0 or blank mean "not sold here".
  function bestCans(need, cans) {
    need = Math.ceil(num(need, 0));
    var sold = (cans || []).filter(function (c) { return c.ml > 0 && num(c.price, 0) > 0; });
    if (need <= 0 || !sold.length) return null;
    var g = sold.reduce(function (a, c) { return gcd(a, Math.round(c.ml)); }, 0);
    var sizes = sold.map(function (c) { return Math.round(c.ml) / g; });
    var biggest = Math.max.apply(null, sizes);
    var target = Math.ceil(need / g);
    var top = target + biggest;
    var cost = new Float64Array(top + 1).fill(Infinity);
    var count = new Int32Array(top + 1);
    var pick = new Int16Array(top + 1).fill(-1);
    cost[0] = 0;
    for (var v = 1; v <= top; v++) {
      for (var j = 0; j < sizes.length; j++) {
        var s = sizes[j];
        if (s > v || cost[v - s] === Infinity) continue;
        var c = cost[v - s] + num(sold[j].price, 0);
        var n = count[v - s] + 1;
        if (c < cost[v] - 1e-9 || (Math.abs(c - cost[v]) <= 1e-9 && n < count[v])) {
          cost[v] = c; count[v] = n; pick[v] = j;
        }
      }
    }
    var best = -1;
    for (var w = target; w <= top; w++) {
      if (cost[w] === Infinity) continue;
      if (best < 0 || cost[w] < cost[best] - 1e-9) best = w;
    }
    if (best < 0) return null;

    function items(v) {
      var tally = {};
      for (var x = v; x > 0; x -= sizes[pick[x]]) {
        var id = sold[pick[x]].id;
        tally[id] = (tally[id] || 0) + 1;
      }
      return sold.filter(function (c) { return tally[c.id]; })
        .sort(function (a, b) { return b.ml - a.ml; })
        .map(function (c) { return { id: c.id, name: c.name, ml: c.ml, price: num(c.price, 0), qty: tally[c.id] }; });
    }

    var out = { items: items(best), cost: cost[best], ml: best * g, spare: best * g - need };

    // Small tins cost far more per litre, so the cheapest mix can be three
    // gallons and two quarts when four gallons cost a dollar more. Offer
    // the most paint we can get for at most 5% more (and at most the price
    // of the smallest tin), as long as it means fewer tins to carry.
    var cheapest = Math.min.apply(null, sold.map(function (c) { return num(c.price, 0); }));
    var cap = cost[best] + Math.min(cost[best] * 0.05, cheapest);
    var alt = -1;
    for (var y = best + 1; y <= top; y++) {
      if (cost[y] <= cap + 1e-9 && count[y] < count[best]) alt = y;
    }
    if (alt > 0) {
      out.alt = { items: items(alt), cost: cost[alt], ml: alt * g, spare: alt * g - need, more: cost[alt] - cost[best] };
    }
    return out;
  }

  return {
    REGIONS: REGIONS, SQFT: SQFT, FT: FT, GAL: GAL,
    roomArea: roomArea, coatsFor: coatsFor, wasteFor: wasteFor,
    litres: litres, plan: plan, bestCans: bestCans,
    parseLength: parseLength, showLength: showLength, showArea: showArea, showVolume: showVolume
  };
});
