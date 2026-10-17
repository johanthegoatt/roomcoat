// RoomCoat page. Holds the rooms as typed, re-runs the engine on every
// change, and keeps the plan in localStorage and in share links (the URL
// fragment, so it never reaches a server).
(function () {
  "use strict";
  var R = window.RoomCoat;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "roomcoat:v1";
  var mascot = function () { return window.Dab || { context: function () {}, react: function () {}, say: function () {} }; };

  var EXAMPLES = {
    imperial: [
      { name: "Bedroom", length: "12' 6\"", width: "11", height: "8", doors: 1, windows: 2, ceiling: true, surface: "painted", paint: "Sage green", colour: "#9fb59a" },
      { name: "Hallway", length: "14", width: "4", height: "8", doors: 3, windows: 0, surface: "painted", paint: "Sage green", colour: "#9fb59a" }
    ],
    metric: [
      { name: "Bedroom", length: "3.8", width: "3.4", height: "2.4", doors: 1, windows: 2, ceiling: true, surface: "painted", paint: "Sage green", colour: "#9fb59a" },
      { name: "Hallway", length: "4.2", width: "1.2", height: "2.4", doors: 3, windows: 0, surface: "new", paint: "Sage green", colour: "#9fb59a" }
    ]
  };

  function blankRoom(n) {
    return { name: "Room " + n, length: "", width: "", height: "", doors: 1, windows: 1, ceiling: false, surface: "painted", darkToLight: false, paint: "", colour: "#d9cbb8" };
  }

  var state = { region: "us", coats: 2, coverage: "", have: "", prices: {}, rooms: [blankRoom(1)] };

  function units() { return R.REGIONS[state.region].units; }

  // ---- load and save ------------------------------------------------------

  function decode(s) {
    try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))); }
    catch (e) { return null; }
  }
  function encode(o) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function load() {
    var shared = location.hash.match(/^#s=(.+)$/);
    var got = shared ? decode(shared[1]) : null;
    if (!got) { try { got = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { got = null; } }
    if (!got || !Array.isArray(got.rooms)) {
      // First visit: guess the country from the browser's language.
      var lang = (navigator.language || "en-US").toLowerCase();
      state.region = /-(gb|ie)$/.test(lang) ? "uk" : /-(au|nz)$/.test(lang) ? "au" : "us";
      return;
    }
    state.region = R.REGIONS[got.region] ? got.region : "us";
    state.coats = [1, 2, 3].indexOf(+got.coats) >= 0 ? +got.coats : 2;
    state.coverage = got.coverage || "";
    state.have = got.have || "";
    state.prices = got.prices && typeof got.prices === "object" ? got.prices : {};
    state.rooms = got.rooms.slice(0, 20).map(function (r, i) { return Object.assign(blankRoom(i + 1), r); });
    if (!state.rooms.length) state.rooms = [blankRoom(1)];
    if (shared) history.replaceState(null, "", location.pathname);
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---- engine input -------------------------------------------------------

  function cans() {
    return R.REGIONS[state.region].cans.map(function (c) {
      var p = state.prices[state.region + ":" + c.id];
      return Object.assign({}, c, { price: p === undefined ? c.price : p });
    });
  }

  // Coverage is typed the way the tin prints it: sq ft per gallon in the
  // US, m² per litre elsewhere. The engine wants m² per litre.
  function coverage() {
    var v = parseFloat(String(state.coverage).replace(",", "."));
    if (!(v > 0)) return R.REGIONS[state.region].coverage;
    return units() === "imperial" ? v * R.SQFT / (R.GAL / 1000) : v;
  }

  function engineRooms() {
    return state.rooms.map(function (r) {
      return Object.assign({}, r, {
        length: R.parseLength(r.length, units()),
        width: R.parseLength(r.width, units()),
        height: R.parseLength(r.height, units())
      });
    });
  }

  // ---- rooms --------------------------------------------------------------

  var roomsEl = $("rooms"), tpl = $("room-tpl");

  function renderRooms() {
    roomsEl.textContent = "";
    state.rooms.forEach(function (room, i) {
      var node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.i = i;
      node.querySelectorAll("[data-k]").forEach(function (el) {
        var k = el.dataset.k;
        var id = "r" + i + "-" + k;
        el.id = id;
        if (el.type === "checkbox") el.checked = !!room[k];
        else el.value = room[k] == null ? "" : room[k];
      });
      var nameLabel = node.querySelector("[data-for=name]");
      nameLabel.setAttribute("for", "r" + i + "-name");
      node.querySelector(".remove").hidden = state.rooms.length < 2;
      node.querySelector(".remove").setAttribute("aria-label", "Remove " + (room.name || "this room"));
      roomsEl.appendChild(node);
      readBack(node, room);
    });
    var u = units();
    $("measure-hint").innerHTML = u === "imperial"
      ? 'Measure along the floor, wall to wall. Write it any way: <b>12\' 6"</b>, <b>12 6</b> or <b>12.5</b>.'
      : "Measure along the floor, wall to wall. Write it any way: <b>3.6</b>, <b>3,6</b>, <b>360cm</b> or <b>3600mm</b>.";
  }

  // Under each size box, say what we read, so "12 6" visibly becomes 12' 6".
  function readBack(node, room) {
    ["length", "width", "height"].forEach(function (k) {
      var input = node.querySelector("[data-k=" + k + "]");
      var out = input.parentNode.querySelector(".read");
      var raw = String(room[k] || "").trim();
      var m = R.parseLength(raw, units());
      input.removeAttribute("aria-invalid");
      if (!raw) out.textContent = "";
      else if (m == null) { out.textContent = "Can't read that"; input.setAttribute("aria-invalid", "true"); }
      else out.textContent = "= " + R.showLength(m, units());
    });
  }

  roomsEl.addEventListener("input", function (e) {
    var el = e.target, node = el.closest(".room");
    if (!node || !el.dataset.k) return;
    var room = state.rooms[+node.dataset.i];
    room[el.dataset.k] = el.type === "checkbox" ? el.checked
      : el.type === "number" ? Math.max(0, parseInt(el.value, 10) || 0) : el.value;
    if (el.dataset.k === "name") node.querySelector(".remove").setAttribute("aria-label", "Remove " + (el.value || "this room"));
    readBack(node, room);
    update();
    if (el.type === "checkbox" && el.checked) mascot().react(el.dataset.k);
  });
  roomsEl.addEventListener("change", function (e) {
    if (e.target.dataset.k === "surface") mascot().react("surface:" + e.target.value);
  });
  roomsEl.addEventListener("focusin", function (e) {
    if (e.target.dataset && e.target.dataset.k) mascot().react("focus:" + e.target.dataset.k);
  });

  roomsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".remove");
    if (!b) return;
    var i = +b.closest(".room").dataset.i;
    var gone = state.rooms.splice(i, 1)[0];
    renderRooms();
    update();
    flashStatus((gone.name || "Room") + " removed.");
    var next = roomsEl.querySelectorAll(".room-name")[Math.max(0, i - 1)];
    if (next) next.focus();
  });

  $("add-room").addEventListener("click", function () {
    var last = state.rooms[state.rooms.length - 1];
    var room = blankRoom(state.rooms.length + 1);
    // A new room usually has the same ceiling height and paint as the last.
    if (last) { room.height = last.height; room.paint = last.paint; room.colour = last.colour; }
    state.rooms.push(room);
    renderRooms();
    update();
    var inputs = roomsEl.querySelectorAll("[data-k=length]");
    inputs[inputs.length - 1].focus();
    mascot().react("added");
  });

  $("try-example").addEventListener("click", function () {
    state.rooms = EXAMPLES[units()].map(function (r, i) { return Object.assign(blankRoom(i + 1), r); });
    renderRooms();
    update();
    mascot().react("example");
  });

  // ---- settings -----------------------------------------------------------

  $("region").addEventListener("change", function () {
    var before = units();
    state.region = this.value;
    // Switching between feet and metres: convert what was typed so the
    // room keeps its size instead of a 12 ft wall becoming 12 m.
    if (before !== units()) {
      state.coverage = "";
      state.rooms.forEach(function (r) {
        ["length", "width", "height"].forEach(function (k) {
          var m = R.parseLength(r[k], before);
          if (m != null) r[k] = units() === "imperial" ? R.showLength(m, "imperial") : String(Math.round(m * 100) / 100);
        });
      });
    }
    renderRooms();
    renderTins();
    update();
    mascot().react("region");
  });
  $("coats").addEventListener("change", function () { state.coats = +this.value; update(); mascot().react("coats:" + this.value); });

  function renderTins() {
    var u = units();
    $("coverage-label").textContent = u === "imperial" ? "Covers (sq ft per gallon, from the tin)" : "Covers (m² per litre, from the tin)";
    var def = R.REGIONS[state.region].coverage;
    $("coverage").placeholder = u === "imperial" ? String(Math.round(def / R.SQFT * R.GAL / 1000)) : String(def);
    $("coverage").value = state.coverage;
    var box = $("prices");
    box.textContent = "";
    var money = R.REGIONS[state.region].money;
    cans().forEach(function (c) {
      var l = document.createElement("label");
      l.className = "field";
      var span = document.createElement("span");
      span.textContent = c.name.charAt(0).toUpperCase() + c.name.slice(1) + " (" + money + ")";
      var input = document.createElement("input");
      input.inputMode = "decimal";
      input.value = c.price === "" ? "" : c.price;
      input.dataset.can = c.id;
      l.appendChild(span);
      l.appendChild(input);
      box.appendChild(l);
    });
  }
  $("coverage").addEventListener("input", function () { state.coverage = this.value; update(); });
  $("have").addEventListener("input", function () { state.have = this.value; update(); });
  $("prices").addEventListener("input", function (e) {
    var id = e.target.dataset.can;
    if (!id) return;
    var v = e.target.value.trim();
    state.prices[state.region + ":" + id] = v === "" ? "" : Math.max(0, parseFloat(v.replace(",", ".")) || 0);
    update();
  });
  $("reset-tins").addEventListener("click", function () {
    Object.keys(state.prices).forEach(function (k) { if (k.indexOf(state.region + ":") === 0) delete state.prices[k]; });
    state.coverage = "";
    renderTins();
    update();
  });

  // ---- results ------------------------------------------------------------

  var last = null;

  function money(n) {
    var sym = R.REGIONS[state.region].money;
    return sym + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0);
  }

  function buyText(buy) {
    return buy.items.map(function (it) { return it.qty + " × " + it.name; }).join(" + ");
  }

  // The "paint you already have" box is in the shopper's units (litres, or
  // US gallons), and applies to the main wall colour, the one most people
  // have a part-tin of. Convert it to mL and point it at that paint's key.
  function haveMl() {
    var v = parseFloat(String(state.have).replace(",", "."));
    if (!(v > 0)) return 0;
    return units() === "imperial" ? v * R.GAL : v * 1000;
  }
  function mainWallKey(plan) {
    var best = null;
    plan.paints.forEach(function (p) {
      if (p.key.indexOf("wall:") === 0 && (!best || p.ml > best.ml)) best = p;
    });
    return best ? best.key : null;
  }

  function update() {
    var u = units();
    $("have-label").innerHTML = (u === "imperial"
      ? "Paint you already have, of the main colour (gallons)"
      : "Paint you already have, of the main colour (litres)") + " <small>(optional)</small>";
    var base = { region: state.region, coats: state.coats, coverage: coverage(), cans: cans(), rooms: engineRooms() };
    var p = R.plan(base);
    var key = mainWallKey(p);
    var ownMl = haveMl();
    if (key && ownMl > 0) {
      var have = {}; have[key] = ownMl;
      p = R.plan(Object.assign({}, base, { have: have }));
    }
    last = p;
    var box = $("paints");
    box.textContent = "";

    p.rooms.forEach(function (r) {
      var node = roomsEl.querySelector('.room[data-i="' + r.index + '"] .room-sum');
      if (!node) return;
      var a = r.area;
      node.textContent = a.gross > 0
        ? "Walls " + R.showArea(a.walls, u) + (a.ceiling ? ", ceiling " + R.showArea(a.ceiling, u) : "") +
          " after " + R.showArea(a.openings, u) + " of doors and windows."
        : "";
    });

    if (!p.paints.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Fill in a length, width and wall height and the tins show up here.";
      box.appendChild(empty);
      $("total").textContent = "";
    } else {
      p.paints.forEach(function (paint) {
        var card = document.createElement("div");
        card.className = "paint";
        var sw = document.createElement("span");
        sw.className = "dot";
        sw.style.background = paint.colour;
        var body = document.createElement("div");
        var h = document.createElement("h3");
        h.textContent = paint.label;
        var need = document.createElement("p");
        need.className = "need";
        need.textContent = "Needs about " + R.showVolume(paint.ml, u) + " for " + R.showArea(paint.area, u) + ".";
        if (paint.haveMl > 0) {
          need.textContent += " You have " + R.showVolume(paint.haveMl, u) +
            (paint.enough ? "." : ", so buy for " + R.showVolume(paint.needMl, u) + ".");
        }
        var buy = document.createElement("p");
        buy.className = "buy";
        if (paint.enough) {
          buy.textContent = "You already have enough. Nothing to buy for this one.";
          body.appendChild(h); body.appendChild(need); body.appendChild(buy);
          card.appendChild(sw); card.appendChild(body); box.appendChild(card);
          return;
        }
        if (paint.buy) {
          buy.innerHTML = "<b></b> <span class=\"cost\"></span>";
          buy.querySelector("b").textContent = buyText(paint.buy);
          buy.querySelector(".cost").textContent = money(paint.buy.cost);
          var spare = document.createElement("p");
          spare.className = "spare";
          spare.textContent = paint.buy.spare > 50
            ? "About " + R.showVolume(paint.buy.spare, u) + " left over for touch-ups."
            : "Almost nothing left over, so keep the tin for touch-ups.";
          body.appendChild(h); body.appendChild(need); body.appendChild(buy); body.appendChild(spare);
          if (paint.buy.alt) {
            var alt = document.createElement("p");
            alt.className = "alt";
            alt.textContent = "Or " + buyText(paint.buy.alt) + " for " + money(paint.buy.alt.more) +
              " more: fewer tins and " + R.showVolume(paint.buy.alt.ml - paint.buy.ml, u) + " more paint.";
            body.appendChild(alt);
          }
        } else {
          buy.textContent = "Add a price for at least one tin size below.";
          body.appendChild(h); body.appendChild(need); body.appendChild(buy);
        }
        card.appendChild(sw);
        card.appendChild(body);
        box.appendChild(card);
      });
      $("total").textContent = p.total > 0 ? "About " + money(p.total) + " in paint, at the prices below." : "";
    }

    save();
    var big = p.rooms.some(function (r) { return r.area.gross > 0 && (engineRooms()[r.index].height > 6); });
    mascot().context({
      rooms: state.rooms.length,
      measured: p.rooms.filter(function (r) { return r.area.gross > 0; }).length,
      paints: p.paints.length,
      colour: (state.rooms.find(function (r) { return r.paint || r.colour !== "#d9cbb8"; }) || {}).colour,
      odd: big,
      bad: !!document.querySelector("#rooms [aria-invalid]")
    });
  }

  // ---- copy ---------------------------------------------------------------

  var statusTimer;
  function flashStatus(t) {
    $("status").textContent = t;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { $("status").textContent = ""; }, 4000);
  }

  function copy(text, done) {
    var ok = function () { flashStatus(done); mascot().react("copied"); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(text); ok(); });
    } else { fallback(text); ok(); }
  }
  function fallback(text) {
    var t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    try { document.execCommand("copy"); } catch (e) {}
    t.remove();
  }

  $("copy-list").addEventListener("click", function () {
    if (!last || !last.paints.length) { flashStatus("Measure a room first."); return; }
    var lines = ["Paint to buy (RoomCoat)"];
    last.paints.forEach(function (p) {
      if (p.buy) lines.push("- " + p.label + ": " + buyText(p.buy) + " (" + money(p.buy.cost) + ")");
    });
    lines.push("Rooms: " + state.rooms.map(function (r) { return r.name; }).join(", "));
    copy(lines.join("\n"), "Shopping list copied.");
  });

  $("copy-link").addEventListener("click", function () {
    copy(location.origin + location.pathname + "#s=" + encode(state), "Link copied. Anyone who opens it sees these rooms.");
  });

  // ---- start --------------------------------------------------------------

  load();
  $("region").value = state.region;
  $("coats").value = String(state.coats);
  $("have").value = state.have || "";
  renderRooms();
  renderTins();
  update();
})();
