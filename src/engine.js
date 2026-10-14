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
      var ceilMl = litres(a.ceiling, Math.max(2, num(input.coats, 2)), coverage, 0.05) * 1000;
      var primerMl = litres(a.walls + a.ceiling, c.primer, coverage, w) * 1000;
      add(key, name, room.colour || "#d9cbb8", wallMl, a.walls);
      add("ceiling", "Ceiling paint", "#ffffff", ceilMl, a.ceiling);
      add("primer", "Primer", "#f2efe8", primerMl, a.walls + a.ceiling);
      rooms.push({ index: i, name: room.name || "Room " + (i + 1), area: a, coats: c, wallMl: wallMl });
    });

    var cans = input.cans || r.cans;
    var list = order.map(function (k) {
      var p = paints[k];
      p.buy = bestCans(p.ml, cans);
      return p;
    });
    var total = list.reduce(function (s, p) { return s + (p.buy ? p.buy.cost : 0); }, 0);
    return { region: region, coverage: coverage, rooms: rooms, paints: list, total: total };
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
    var tally = {};
    for (var x = best; x > 0; x -= sizes[pick[x]]) {
      var id = sold[pick[x]].id;
      tally[id] = (tally[id] || 0) + 1;
    }
    var items = sold.filter(function (c) { return tally[c.id]; })
      .sort(function (a, b) { return b.ml - a.ml; })
      .map(function (c) { return { id: c.id, name: c.name, ml: c.ml, price: num(c.price, 0), qty: tally[c.id] }; });
    var bought = best * g;
    return { items: items, cost: cost[best], ml: bought, spare: bought - need };
  }

  return {
    REGIONS: REGIONS, SQFT: SQFT, FT: FT, GAL: GAL,
    roomArea: roomArea, coatsFor: coatsFor, wasteFor: wasteFor,
    litres: litres, plan: plan, bestCans: bestCans
  };
});
