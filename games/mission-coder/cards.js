/* Field Cards earned in Mission Coder (g22). */
RQ.defineCards("g22", [
  { id: "mc-algorithm", name: "Algorithm", icon: "📜", cat: "algo",
    text: "An **algorithm** is a list of exact steps for solving a problem. In this game, the computer follows your steps in order, one by one.",
    reseed: "`pipeline.run_site` runs ReSeed's steps 1–9 in order for each site: picture, forest check, NDVI, decide, outline, plan, dispatch." },
  { id: "mc-debugging", name: "Debugging", icon: "🐞", cat: "algo",
    text: "A **bug** is a mistake in code. **Debugging** means: run it, watch what really happens, fix one thing, run again.",
    reseed: "`test_mission_lines_cover_patch` in `tests/test_core.py` checks the lines are long enough to cover a test patch and the `.waypoints` file starts with `QGC WPL 110`; `.github/workflows/tests.yml` runs it on every push." },
  { id: "mc-loop", name: "Loop (repeat)", icon: "🔁", cat: "algo",
    text: "A **loop** does the same blocks again and again. `repeat 3:` in blocks is `for i in range(3):` in Python. A loop inside a loop is **nested**.",
    reseed: "`reseed/mission.py` uses a `while` loop to lay one seeding line after another across the patch." },
  { id: "mc-lawnmower", name: "Lawnmower path", icon: "🚜", cat: "drone",
    text: "Fly straight lines side by side and turn back at each end, like mowing a lawn. A **swath** is the width seeded in one pass (game version: one square).",
    reseed: "`mission.lawnmower()` uses the swath as its line spacing, alternating direction along the patch's long side. Rondônia's real run (`mission.plan_mission`): 2.26 m swath, 86,396 seed drops." },
  { id: "mc-waypoints", name: "GPS waypoints file", icon: "📍", cat: "space",
    text: "**Latitude** says how far north or south, **longitude** how far east or west. A `.waypoints` file lists commands: **22** take off, **16** fly to a point, **183** move a servo, **20** return to launch.",
    reseed: "`mission.export_waypoints()` saves flight instructions in a QGC WPL 110 file. Servo 9 is the hatch motor: setting it to 1900 opens the hatch at each release point (our practice file has 6 points)." },
  { id: "mc-jerk-back", name: "Jerk back", icon: "⏪", cat: "drone",
    text: "When the drone suddenly flies backwards, the seeds keep moving forward (that is **inertia**) and shoot out of the roll.",
    reseed: "`reseed/demo_flight.py`: take off to 1.5 m, fly towards (+1 m, +1 m) at 1.2 m/s, reverse at 1.5 m/s for 0.35 s, return, land." }
]);
