/* Field Cards earned in Drone Rush (g21). */
RQ.defineCards("g21", [
  { id: "thrust-gravity", name: "Thrust vs gravity", icon: "🚀", cat: "math",
    text: "Spinning propellers push air down, so the air pushes the drone **up**: that is **thrust**. More thrust than weight: you climb. Less: you sink. Tilt the drone and some thrust pushes you sideways.",
    reseed: "ReSeed's prototype model is an X500-class quadcopter (`reseed/logistics.py` `PROTOTYPE`). (Game version: simplified physics, and the whole seed pack drops on a rope.)" },
  { id: "payload-battery", name: "Payload and battery", icon: "🔋", cat: "drone",
    text: "A heavier drone needs more lift, so its battery runs out sooner. Carrying the heaviest allowed load cuts flying time by about a third.",
    reseed: "`reseed/logistics.py`: flight time starts at 22 minutes without cargo and drops by 35 % with a full 900 g load. Plans save a quarter of the battery. (Game version: time runs faster.)" },
  { id: "gusts", name: "Wind gusts", icon: "💨", cat: "math",
    text: "A **gust** is a sudden push of wind that comes and goes. Pilots tilt **into** the wind to stay in place.",
    reseed: "`reseed/physics.py` adds random gusts (0.8 m/s) to the wind when it predicts where seeds land." },
  { id: "flight-safety", name: "Altitude limit", icon: "📏", cat: "drone",
    text: "Small drones must stay low: in the US the limit is **400 ft (about 120 m)** above the ground, and pilots keep the drone where they can see it. Real flights follow local drone rules, with a trained adult pilot.",
    reseed: "`reseed/mission.py` plans seeding flights at **20 m** (`altitude_m = 20.0`), far below the limit." },
  { id: "return-home", name: "Return to launch", icon: "🏠", cat: "drone",
    text: "Always save enough battery to fly home. Many drones have a **Return to Launch (RTL)** setting that guides them back to where they took off, using GPS and a saved home point.",
    reseed: "`reseed/mission.py` ends every mission file with `RETURN_TO_LAUNCH`; `demo_flight.py` flies back to the start and lands." }
]);
