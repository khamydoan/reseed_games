/* Field Cards earned in Drone Academy (g20). */
RQ.defineCards("g20", [
  { id: "drone-types", name: "Drone types", icon: "🛸", cat: "drone",
    text: "**Multicopters** (quad = 4 rotors, hexa = 6, octo = 8) can hover. **Fixed-wing** drones glide far and fast but cannot hover. A **VTOL** hybrid does both. A **single-rotor helicopter** lifts heavy loads with one big rotor.",
    reseed: "ReSeed's X500-class quad model: 22 min hover without cargo, up to 900 g of cargo, 1 seed roll per trip (`reseed/logistics.py` `PROTOTYPE`)." },
  { id: "prop-direction", name: "Propeller directions", icon: "🔄", cat: "drone",
    text: "Two props spin **clockwise** and two **counter-clockwise**; diagonal partners match. Their twists cancel, so the drone does not spin like a top. To turn, the flight controller speeds up one pair.",
    reseed: "`reseed/demo_flight.py` flies an ArduPilot drone; ArduPilot mixes the four motors to climb, tilt and turn." },
  { id: "flight-controller", name: "Flight controller", icon: "🧠", cat: "hardware",
    text: "The drone's brain. It reads motion sensors, its **GPS** location and the pilot's radio commands. Each **ESC** (motor control) sets a motor's speed, and a **LiPo** rechargeable battery powers it all.",
    reseed: "`reseed/demo_flight.py` talks to the flight controller over **MAVLink** with `pymavlink`; `reseed/mission.py` mission files open the seed hatch with a servo (`MAV_CMD_DO_SET_SERVO`)." },
  { id: "sticks", name: "Throttle, yaw, pitch, roll", icon: "🕹️", cat: "drone",
    text: "On a **Mode 2** controller, a common layout, the **left stick** controls throttle (up/down) and yaw (turn). The **right stick** controls pitch (forward/back) and roll (sideways).",
    reseed: "On demo day a pilot keeps the RC transmitter in hand, with a kill switch, while the code flies (`reseed/demo_flight.py`)." },
  { id: "preflight", name: "Pre-flight checklist", icon: "📋", cat: "drone",
    text: "Before every flight: props, battery, GPS lock, radio link, clear area, line of sight, weather. Never fly over people, and follow local drone rules with a trained adult pilot.",
    reseed: "`reseed/demo_flight.py`: \"Test in SITL first, fly outdoors or in a netted hall, keep a pilot on the RC transmitter with a kill switch.\"" },
  { id: "flight-modes", name: "Flight modes", icon: "🧭", cat: "drone",
    text: "**GUIDED**: a computer sends targets. **RTL** (Return To Launch): fly home by itself, which needs GPS and a saved home point. **LAND**: come straight down. **Arming** lets the motors spin. **SITL** is a pretend drone inside the computer for safe tests.",
    reseed: "`reseed/demo_flight.py` sets GUIDED, arms, takes off, flies, returns to the start and switches to LAND." }
]);
