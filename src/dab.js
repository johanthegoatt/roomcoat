// Dab, the paint tin who helps you measure up. Dab wears the colour of your
// walls, watches your pointer (or the box you are typing in on a phone),
// gives a tip for the step you are on when tapped, frowns at sizes that
// can't be right, and splashes paint if you tap five times in a row.
// Everything Dab says goes through the bubble's live region, so screen
// readers hear it too.
(function () {
  "use strict";
  var btn = document.getElementById("dab");
  var bubble = document.getElementById("dab-bubble");
  var dock = document.getElementById("dab-dock");
  var hide = document.getElementById("dab-hide");
  if (!btn) {
    window.Dab = { context: function () {}, react: function () {}, say: function () {} };
    return;
  }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var baseMood = "sleepy", tipKey = "start", colour = "#9fb59a";
  var flashing = false, flashTimer = null, bubbleTimer = null, tapTimes = [], tipIndex = {};
  var greeted = false, cheered = false;

  var TIPS = {
    start: [
      "Hi, I'm Dab! Measure the floor along each wall and type it in. Any way you write it is fine.",
      "No tape measure? Count your steps along the wall. One big step is about 3 feet or 1 metre.",
      "Tap Try an example to see how it works first."
    ],
    rooms: [
      "Wall height is floor to ceiling. Most rooms are 8 feet or 2.4 metres.",
      "Count every door, even cupboard doors. I take them off the wall for you.",
      "Painting two rooms the same colour? Give them the same paint name and they share tins."
    ],
    result: [
      "Small tins cost more for the paint inside. I pick the cheapest mix for you.",
      "Prices are a guess. Open Tin sizes and prices and type in your shop's.",
      "Keep the leftover paint. Touch-ups match best from the same tin."
    ],
    bad: [
      "One of the sizes doesn't look right to me. Try 12 6 for 12 foot 6, or 360cm.",
      "That wall is very tall. Did you mean centimetres? Add cm after the number."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }

  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }

  function flash(m, ms) {
    setMood(m);
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashing = false; setMood(baseMood); }, ms || 1400);
  }

  function play(cls) {
    if (still.matches) return;
    btn.classList.remove("hop", "wobble");
    void btn.offsetWidth;
    btn.classList.add(cls);
  }
  btn.addEventListener("animationend", function () { btn.classList.remove("hop", "wobble"); });

  function context(c) {
    if (c.colour) { colour = c.colour; btn.style.setProperty("--paint", colour); }
    if (c.bad || c.odd) { tipKey = "bad"; baseMood = "worried"; }
    else if (!c.measured) { tipKey = "start"; baseMood = "sleepy"; }
    else if (c.measured < c.rooms) { tipKey = "rooms"; baseMood = "happy"; }
    else { tipKey = "result"; baseMood = "happy"; }
    if (!flashing) setMood(baseMood);
    if (c.measured && c.measured === c.rooms && c.paints && !c.bad && !cheered) {
      cheered = true;
      play("hop");
      flash("party", 1600);
      say("All measured! Your shopping list is ready below.");
    }
    if (!greeted) {
      greeted = true;
      setTimeout(function () { if (!bubble.textContent && baseMood === "sleepy") say(TIPS.start[0], 9000); }, 900);
    }
  }

  function nextTip() {
    var list = TIPS[tipKey] || TIPS.result;
    var i = tipIndex[tipKey] || 0;
    tipIndex[tipKey] = (i + 1) % list.length;
    return list[i];
  }

  btn.addEventListener("click", function () {
    if (dock.classList.contains("tucked")) {
      dock.classList.remove("tucked");
      remember(false);
      say("I'm back! Tap me any time for a tip.");
      play("hop");
      return;
    }
    var now = Date.now();
    tapTimes = tapTimes.filter(function (t) { return now - t < 1600; });
    tapTimes.push(now);
    if (tapTimes.length >= 5) {
      tapTimes = [];
      play("wobble");
      flash("wow", 1200);
      splash(12);
      say("Whoa, careful! You nearly knocked my lid off.");
      return;
    }
    play("hop");
    if (baseMood === "sleepy") flash("happy", 1600);
    say(nextTip());
  });

  hide.addEventListener("click", function () {
    dock.classList.add("tucked");
    bubble.textContent = "";
    remember(true);
  });

  function remember(tucked) {
    try { localStorage.setItem("roomcoat.dabTucked", tucked ? "1" : ""); } catch (e) {}
  }
  try { if (localStorage.getItem("roomcoat.dabTucked")) dock.classList.add("tucked"); } catch (e) {}

  // Eyes follow the pointer, a few pixels at most.
  var pupils = btn.querySelectorAll(".d-pupil");
  var target = null, frame = 0;
  function look() {
    frame = 0;
    if (!target) return;
    var r = btn.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height * 0.67;
    var dx = target.x - cx, dy = target.y - cy;
    var d = Math.hypot(dx, dy) || 1;
    var reach = Math.min(1, d / 220);
    var x = (dx / d) * 3.2 * reach, y = (dy / d) * 3.6 * reach;
    pupils.forEach(function (p) { p.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)"; });
  }
  window.addEventListener("pointermove", function (ev) {
    target = { x: ev.clientX, y: ev.clientY };
    if (!frame) frame = requestAnimationFrame(look);
  }, { passive: true });
  document.addEventListener("focusin", function (ev) {
    var r = ev.target.getBoundingClientRect && ev.target.getBoundingClientRect();
    if (!r || ev.target === btn) return;
    target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (!frame) frame = requestAnimationFrame(look);
  });

  (function blink() {
    setTimeout(function () {
      if (baseMood !== "sleepy" && !document.hidden) {
        btn.classList.add("blink");
        setTimeout(function () { btn.classList.remove("blink"); }, 140);
      }
      blink();
    }, 2600 + Math.random() * 3800);
  })();

  // Drops of the wall colour fly out of the tin and fall.
  function splash(n) {
    if (still.matches) return;
    var r = btn.getBoundingClientRect();
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span");
      var size = 6 + Math.random() * 8;
      s.className = "splat";
      s.style.width = s.style.height = size + "px";
      s.style.background = colour;
      s.style.left = r.left + r.width * (0.3 + Math.random() * 0.4) + "px";
      s.style.top = r.top + r.height * 0.3 + "px";
      document.body.appendChild(s);
      var dx = -(30 + Math.random() * 170), dy = -(50 + Math.random() * 150);
      var a = s.animate([
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + dx * 0.6 + "px," + dy + "px) scale(1.1)", opacity: 1, offset: 0.5 },
        { transform: "translate(" + dx + "px," + (dy + 230) + "px) scale(1.6, 0.5)", opacity: 0 }
      ], { duration: 1200 + Math.random() * 600, easing: "ease-out" });
      a.onfinish = (function (node) { return function () { node.remove(); }; })(s);
    }
  }

  var lastFocus = "";
  function react(what) {
    var k = String(what);
    if (k.indexOf("focus:") === 0) {
      // Only speak the first time someone lands on a kind of box.
      if (k === lastFocus) return;
      lastFocus = k;
      if (k === "focus:height") say("Floor to ceiling. Most rooms are 8 feet or 2.4 metres.", 5000);
      else if (k === "focus:doors") say("Every door counts, cupboards too. I take each one off the wall.", 5000);
      return;
    }
    switch (k) {
      case "example": play("hop"); say("Here's a bedroom and a hallway in the same green. They share tins."); break;
      case "added": play("hop"); say("New room! I copied the wall height and paint from the last one."); break;
      case "ceiling": say("Ceilings get their own white paint, so I list it on its own."); break;
      case "darkToLight": flash("wow", 1000); say("Dark to light needs an extra coat, or the old colour shows through. Added."); break;
      case "surface:new": say("New plaster or drywall soaks up the first coat. I added a sealing coat for it."); break;
      case "surface:textured": say("Rough walls drink paint. I added a bit extra."); break;
      case "region": play("hop"); say("Switched. I changed your sizes and tins to match."); break;
      case "coats:1": say("One coat works when it's the same colour going on again."); break;
      case "coats:3": say("Three coats is a lot. Good for bright reds and yellows."); break;
      case "copied": play("hop"); flash("party", 1200); say("Copied! Take it to the shop."); break;
    }
  }

  window.Dab = { react: react, context: context, say: say };
})();
