/* Field Cards earned in Regrow Rescue (g23). */
RQ.defineCards("g23", [
  { id: "rr-biome-animals", name: "Biome", icon: "🦜", cat: "forest",
    text: "A **biome** is a kind of place with its own weather, plants and animals. Toucans live in the Amazon, koalas on Kangaroo Island.",
    reseed: "`reseed/species.py` lists the animals of every biome, e.g. `southern_eucalypt`: kangaroo, glossy black-cockatoo, koala, echidna." },
  { id: "rr-regrow-monitor", name: "Regrow: check again", icon: "🔁", cat: "space",
    text: "Planting is not the end. Satellites look at the patch again, year after year. **NDVI** is a satellite score for green leaves: when it rises near the old forest's score, plants may be growing back.",
    reseed: "The README flow ends with **Regrow: monitor NDVI, back to 03**, so the same `reseed/ndvi.py` scan runs again." },
  { id: "rr-habitat", name: "Habitat", icon: "🏡", cat: "forest",
    text: "Animals need food, water and a safe home: their **habitat**. A young forest has no old hollow trees yet, so people hang nest boxes and dig ponds. (Game version: ReSeed itself only plants seeds.)",
    reseed: "`reseed/species.py` picks native seeds that feed animals: California black oak acorns 'feed deer, jays and squirrels'." },
  { id: "rr-seed-dispersers", name: "Animals plant trees", icon: "🌰", cat: "forest",
    text: "Jays bury acorns and forget some. Monkeys and birds eat fruit and drop the seeds far away. Animals that move seeds are called **seed dispersers**.",
    reseed: "`reseed/species.py` chose Mutamba for the Amazon because its 'fruit feeds birds and monkeys that bring in more seeds'." },
  { id: "rr-s-curve", name: "Growth S-curve", icon: "📈", cat: "math",
    text: "Game version: our forest grows slowly, then fast, then levels off. On a chart that looks like a stretched **S**. Real forests and NDVI can also dip and rise along the way.",
    reseed: "The website's 3D twin plays a 15-year time-lapse (`site/js/missionui.js`) where NDVI grows with `logistic((y - 4.5) / 1.6)` (`site/js/mission3d.js`, `stepTimelapse`)." },
  { id: "rr-corridor", name: "Wildlife corridor", icon: "🌉", cat: "forest",
    text: "Gibbons almost never touch the ground. A **wildlife corridor**, like a rope bridge or a strip of trees, links forest patches so animals can travel.",
    reseed: "The Borneo mix in `reseed/species.py` includes Kadam, a fast local tree: its leafy treetops can meet in 3–4 years ('closes the canopy')." }
]);
