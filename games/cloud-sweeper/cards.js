/* Field Cards earned in Cloud Sweeper (g07). */
RQ.defineCards("g07", [
  { id: "cloud-mask", name: "Cloud mask (SCL)", icon: "🎭", cat: "space",
    text: "Sentinel-2 **Level-2A** pictures come with a **scene classification layer (SCL)**, made by computers on Earth. Each pixel gets a class number: 4 vegetation, 6 water, 8 and 9 cloud, 3 cloud shadow, 10 thin cirrus. (Game version: we mask big squares, the real mask works pixel by pixel.)",
    reseed: "`reseed/acquire.py` loads `sentinel-2-l2a` and keeps classes 4, 5, 6, 7 and 11 (`S2_CLEAR_SCL`). Other pixels get NaN, a marker that means \"no usable number here\"." },
  { id: "min-clear", name: "Half-clear rule", icon: "⛅", cat: "space",
    text: "A picture that is mostly cloud is not worth keeping. The satellite passes again a few days later, so wait for a clearer one.",
    reseed: "`load_sentinel2` in `reseed/acquire.py` skips a scene when less than half of your square is clear (`min_clear=0.5`)." },
  { id: "median", name: "Median", icon: "🎯", cat: "algo",
    text: "Sort the numbers and take the one in the **middle** position. With an even count, take halfway between the two middle numbers. A wild value, like a bright cloud, changes the median much less than the **mean** (average). It works when most values are clear: if most are cloudy, the middle is a cloud too!",
    reseed: "`reseed/acquire.py` mixes the scenes with `np.nanmedian`, which skips the masked (NaN) pixels." },
  { id: "pixel-numbers", name: "Pixels are numbers", icon: "🔢", cat: "data",
    text: "A picture is a grid of numbers: each tiny square, or **pixel**, has a number for each kind of light (a **band**). (Game version: brightness from 0 to 100. ReSeed measures reflected light, usually from 0 to 1.)",
    reseed: "Each ReSeed site is a 6.4 km square (`chip_m = 6400` in `reseed/config.py`) of 10 m pixels: 640 × 640. By default `load_sentinel2` loads 5 bands: blue, green, red, near-infrared and short-wave infrared." },
  { id: "composite", name: "Median composite", icon: "🖼️", cat: "space",
    text: "Stack pictures of the same place, taken on different days. Mask the clouds, then take each pixel's median. Spots that were clear in some pictures come out clean; a spot never seen clear stays empty.",
    reseed: "`load_sentinel2` in `reseed/acquire.py` stacks up to 8 scenes that are at least half clear (`max_scenes=8`, `min_clear=0.5`) into one `Composite`; never-clear pixels stay NaN. Your site picture in ReSeed is one of these." },
  { id: "cloud-cover", name: "Cloud cover", icon: "☁️", cat: "data",
    text: "Every satellite scene comes with a cloud-cover number for its whole tile. When you search the catalogue, you can ask for the least cloudy ones.",
    reseed: "`search()` in `reseed/acquire.py` asks for scenes under a cloud limit (`eo:cloud_cover`) and sorts them, least cloudy first." }
]);
