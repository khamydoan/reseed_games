/* Seed Drop physics: a classic-script port of ReSeed's seed-release model
 * (reseed/site/js/physics.js, the browser twin of reseed/reseed/physics.py).
 *
 *   dv/dt = g - k |v - w| (v - w),   k = g / v_t^2   (quadratic drag relative to the moving air)
 *   wind profile  w(z) = w10 * (z / 10) ^ alpha  (+ an Ornstein-Uhlenbeck gust shared by all seeds)
 *   rotor downwash: a downward jet under the drone, 6 m/s decaying over ~1.5 m
 *
 * Frame used by the game: x = forward (the drone's flight direction), y = up, z = to the drone's right.
 * Units: metres and seconds. Exposes window.SeedPhys. */
(function () {
  "use strict";
  var G = 9.81;

  /** Small deterministic PRNG (same xorshift as physics.js) so a release can be replayed. */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    function next() {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    }
    next.normal = function (mu, sd) {
      var u = Math.max(next(), 1e-12), v = next();
      return (mu || 0) + (sd == null ? 1 : sd) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return next;
  }

  /** Initial seed velocities for a release (heading = +x). Same recipes as physics.py MODES. */
  function initialVelocities(mode, n, speed, R, opt) {
    opt = opt || {};
    var flick = opt.flick == null ? 3.0 : opt.flick, spinRev = opt.spinRev == null ? 2.0 : opt.spinRev,
      spinR = opt.spinRadius == null ? 0.25 : opt.spinRadius, out = [];
    for (var i = 0; i < n; i++) {
      var vx = speed, vz = 0, vy = 0;
      if (mode === "hatch_drop") {
        vx += R.normal(0, 0.25); vz += R.normal(0, 0.25); vy += R.normal(0, 0.12);
      } else if (mode === "jerk_back") {
        // seeds keep the pre-brake speed and exit the open front of the roll inside a +/-12 degree cone
        var cone = 12 * Math.PI / 180, a = R() * 2 * Math.PI, r = cone * Math.sqrt(R()), s = speed * R.normal(1, 0.08);
        vx = Math.cos(r) * s; vz = Math.cos(a) * Math.sin(r) * s; vy = Math.sin(a) * Math.sin(r) * s;
      } else if (mode === "backward_flick") {
        // a servo flicks the roll rearwards at ~3 m/s relative to the drone
        var f = flick * R.normal(1, 0.15);
        vx += -f; vz += R.normal(0, 0.6); vy += R.normal(0.3, 0.3);
      } else if (mode === "spin_spread") {
        // the drone yaws at 2 rev/s with the roll 0.25 m off-centre: seeds leave tangentially (~3.1 m/s)
        var ph = R() * 2 * Math.PI, vt = 2 * Math.PI * spinRev * spinR * R.normal(1, 0.1);
        vx += Math.cos(ph) * vt; vz += Math.sin(ph) * vt;
      }
      out.push({ x: vx, y: vy, z: vz });
    }
    return out;
  }

  /**
   * Integrate every seed to the ground (y = 0) with fixed 10 ms steps, like SeedCloud.step().
   * o: {vt, mode, n, alt, speed, wind:{speed, dx, dz, gust, tau, alpha}, seed, downwash, downwashDepth, recDt, noise}
   * Returns {seeds:[{x, z, t, path:[[t,x,y,z]...]}], stats}. Positions are relative to the release point.
   */
  function simulate(o) {
    var R = rng(o.seed || 1), n = o.n || 40, vt = o.vt || 17, k = G / (vt * vt), speed = o.speed || 0, alt = o.alt || 20;
    var W = o.wind || {}, wsp = W.speed || 0, wdx = W.dx == null ? 1 : W.dx, wdz = W.dz || 0,
      sigma = W.gust == null ? 0.8 : W.gust, tau = W.tau || 3, alpha = W.alpha == null ? 0.2 : W.alpha;
    var dw = o.downwash == null ? 6 : o.downwash, dwd = o.downwashDepth || 1.5, recDt = o.recDt || 0.03, noise = o.noise !== false;
    var gust = noise ? R.normal(0, sigma) : 0;
    var vel = noise ? initialVelocities(o.mode || "hatch_drop", n, speed, R, o) : meanVelocities(o.mode || "hatch_drop", n, speed, o);
    var seeds = vel.map(function (v, i) {
      var delay = noise ? R() * 0.3 : 0.15; // seeds leave over ~0.3 s while the drone moves on
      return { x: speed * delay + (noise ? R.normal(0, 0.03) : 0), y: alt, z: noise ? R.normal(0, 0.03) : 0,
        vx: v.x, vy: v.y, vz: v.z, t: 0, landed: false, id: i, path: [] };
    });
    seeds.forEach(function (p) { p.path.push([0, p.x, p.y, p.z]); });
    var h = 0.01, t = 0, nextRec = recDt, left = n;
    while (left > 0 && t < 60) {
      if (noise) gust += (-gust / tau) * h + sigma * Math.sqrt((2 * h) / tau) * R.normal();
      t += h;
      for (var i = 0; i < n; i++) {
        var p = seeds[i];
        if (p.landed) continue;
        var zz = Math.max(p.y, 0.2), w = wsp * Math.pow(zz / 10, alpha) + gust;
        var depth = Math.max(alt - p.y, 0);
        var ax = wdx * w, az = wdz * w, ay = -dw * Math.exp(-depth / dwd);
        var rx = p.vx - ax, ry = p.vy - ay, rz = p.vz - az, sp = Math.sqrt(rx * rx + ry * ry + rz * rz);
        p.vx += -k * sp * rx * h;
        p.vy += (-k * sp * ry - G) * h;
        p.vz += -k * sp * rz * h;
        p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h; p.t += h;
        if (p.y <= 0) {
          // back-interpolate to the ground for a clean landing point
          var f = p.y / (p.vy * h || -1e-9);
          p.x -= p.vx * h * f; p.z -= p.vz * h * f; p.y = 0; p.landed = true; left--;
          p.path.push([t, p.x, 0, p.z]);
        }
      }
      if (t >= nextRec) {
        nextRec += recDt;
        for (var j = 0; j < n; j++) if (!seeds[j].landed) seeds[j].path.push([t, seeds[j].x, seeds[j].y, seeds[j].z]);
      }
    }
    return { seeds: seeds, stats: stats(seeds), duration: t };
  }
  /** Noise-free velocities for a prediction line (spin spread: n seeds evenly round the ring). */
  function meanVelocities(mode, n, speed, opt) {
    var out = [], flick = (opt && opt.flick) || 3.0, vt = 2 * Math.PI * 2.0 * 0.25;
    for (var i = 0; i < n; i++) {
      if (mode === "backward_flick") out.push({ x: speed - flick, y: 0.3, z: 0 });
      else if (mode === "spin_spread") { var ph = (i + .5) / n * 2 * Math.PI; out.push({ x: speed + Math.cos(ph) * vt, y: 0, z: Math.sin(ph) * vt }); }
      else out.push({ x: speed, y: 0, z: 0 });
    }
    return out;
  }

  /** Summary like SeedCloud.stats() / physics.summarise(): centroid, blast radius (90 %), 2-sigma ellipse, fall time. */
  function stats(seeds) {
    var pts = seeds.filter(function (p) { return p.landed; }), n = pts.length || 1, cx = 0, cz = 0, tf = 0;
    pts.forEach(function (p) { cx += p.x; cz += p.z; tf += p.t; });
    cx /= n; cz /= n; tf /= n;
    var r = pts.map(function (p) { return Math.hypot(p.x - cx, p.z - cz); }).sort(function (a, b) { return a - b; });
    var r90 = r.length ? r[Math.min(r.length - 1, Math.floor(0.9 * r.length))] : 0;
    var sxx = 0, szz = 0, sxz = 0;
    pts.forEach(function (p) { var dx = p.x - cx, dz = p.z - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; });
    sxx /= n; szz /= n; sxz /= n;
    var tr = sxx + szz, det = sxx * szz - sxz * sxz, q = Math.sqrt(Math.max(tr * tr / 4 - det, 0));
    return { landed: pts.length, centroid: { x: cx, z: cz }, blastRadius: r90, drift: Math.hypot(cx, cz), meanFall: tf,
      ellipse: { a: 2 * Math.sqrt(Math.max(tr / 2 + q, 0)), b: 2 * Math.sqrt(Math.max(tr / 2 - q, 0)), angle: 0.5 * Math.atan2(2 * sxz, sxx - szz) } };
  }

  /** Closed-form fall time from height h with terminal velocity vt in still air (physics.js fallTime). */
  function fallTime(h, vt) { return (vt / G) * Math.acosh(Math.exp((G * h) / (vt * vt))); }

  /** Wind speed at height z for a 10 m wind w10: w(z) = w10 * (z / 10) ^ alpha. */
  function windAt(w10, z, alpha) { return w10 * Math.pow(Math.max(z, 0.2) / 10, alpha == null ? 0.2 : alpha); }

  window.SeedPhys = { G: G, rng: rng, initialVelocities: initialVelocities, simulate: simulate, stats: stats, fallTime: fallTime, windAt: windAt,
    MODES: ["hatch_drop", "jerk_back", "backward_flick", "spin_spread"] };
})();
