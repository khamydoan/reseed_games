/* Field Cards earned in Seed Drop (g19). */
RQ.defineCards("g19", [
  { id: "inertia", name: "Inertia", icon: "➡️", cat: "math",
    text: "Things keep their speed and direction unless a force changes them. Seeds start with the drone's forward speed, so with no wind they land **ahead** of the drop point.",
    reseed: "`reseed/physics.py`: every seed inherits the drone's velocity at release." },
  { id: "wind-drift", name: "Wind drift", icon: "🌬️", cat: "math",
    text: "In this wind model, wind blows faster high up: **w(z) = w10 × (z / 10)^0.2**. Slowly falling seeds spend longer in the wind, so they drift farther. Gusts change where seeds land.",
    reseed: "`reseed/physics.py` `Wind` changes with height and has gusts. Its usual speed is 3 metres per second at 10 m high. (Game version: in levels 1–4 the wind blows along your flight path.)" },
  { id: "terminal-velocity", name: "Terminal velocity", icon: "🌰", cat: "math",
    text: "A falling seed speeds up until the air pushes back as hard as gravity pulls. Then it falls at a steady speed: its **terminal velocity**. Acorns: about 17 m/s. Pine seeds with the wing removed (dewinged): about 5.5 m/s.",
    reseed: "`reseed/species.py` stores `v_terminal` for every seed; `physics.py` turns it into drag: k = g / v_t²." },
  { id: "release-modes", name: "Release modes", icon: "🌀", cat: "drone",
    text: "Four ways to let seeds go: **hatch drop** (tight cluster), **jerk back** (drone brakes, seeds fly on), **backward flick** (seeds thrown back), **spin spread** (a wide ring).",
    reseed: "`reseed/physics.py` `MODES`; the demo-day flight uses jerk back (`reseed/demo_flight.py`)." },
  { id: "simulation", name: "Simulation", icon: "🧮", cat: "algo",
    text: "A **simulation** is a computer's model of what might happen. Every hundredth of a second it works out how gravity and moving air change each seed's speed and position, until the seed reaches the ground.",
    reseed: "`physics.simulate()` steps a cloud of 40–60 seeds with dt = 0.01 s using dv/dt = g − k|v−w|(v−w); the same model runs on the website (`site/js/physics.js`)." },
  { id: "footprint", name: "Release footprint", icon: "🎯", cat: "drone",
    text: "Where a group of seeds lands: the **drift** (how far the middle of the group lands from the release point), the **spread** (a circle holding about 9 in 10 seeds) and the **fall time**.",
    reseed: "`reseed/pipeline.py` simulates a hatch drop of the lead species from 20 m at 4 m/s and saves the estimate as `release_footprint` (`drift_m`, `blast_radius_m`, `mean_fall_s`)." }
]);
