/* Field Cards earned in Satellite Snap (g06). */
RQ.defineCards("g06", [
  { id: "lat-lon", name: "Latitude & longitude", icon: "🌐", cat: "space",
    text: "**Latitude** tells how far north or south a place is from Earth's middle line, the **equator**. **Longitude** tells how far east or west it is from a starting line through Greenwich, London. Both are measured in degrees (°), and minus means south or west. Two numbers mark any spot on Earth.",
    reseed: "Every site in `reseed/config.py` starts from a lat and lon, like Rondônia at `-9.35, -64.35` (minus means south and west)." },
  { id: "sentinel-2", name: "Sentinel-2", icon: "🛰️", cat: "space",
    text: "Two European **Sentinel-2** satellites fly the same orbit, half a lap apart. Together they photograph each place about every **5 days**, with **10 m** pixels for red, green, blue and near-infrared light. (game version: the real ones fly 786 km up and take about 100 minutes per lap)",
    reseed: "`reseed/acquire.py` `load_sentinel2()` finds a site's Sentinel-2 L2A pictures in a date window, hides the cloudy pixels, and blends up to 8 mostly clear pictures (`max_scenes=8`, `min_clear=0.5`) by taking the middle value." },
  { id: "landsat", name: "Landsat", icon: "📼", cat: "space",
    text: "**Landsat** satellites see **30 m** pixels: blurrier than Sentinel-2, but their photo album is much older. ReSeed can use Landsat pictures back to **1984**, perfect for asking: what did this forest look like long ago?",
    reseed: "`reseed/acquire.py` `load_landsat()` uses Landsat 5, 7, 8 and 9 (Collection 2 Level-2) for old years like 2001 (`landsat_years` in `config.py`)." },
  { id: "cloudy-pass", name: "Cloudy pass", icon: "☁️", cat: "space",
    text: "A satellite can come back every 5 days and still see only clouds. So you keep many passes and use the clear ones.",
    reseed: "`acquire.search()` only asks for scenes with `eo:cloud_cover` below `max_cloud` (Ketapang uses 30 % in `config.py`), then masks the clouds that are left." },
  { id: "pixel-size", name: "Pixel size", icon: "🔲", cat: "space",
    text: "A **10 m pixel** is one colour for a 10 m × 10 m square: that is **0.01 hectare**. At 10 m (Sentinel-2) and 30 m (Landsat), you see forest **patches**, not single trees. A close-up drone picture shows single trees.",
    reseed: "`acquire.site_geobox()` puts Sentinel-2 on a 10 m grid, so one pixel is exactly 0.01 ha; `reseed/pipeline.py` loads Landsat on a 30 m grid. Patches under `MIN_PATCH_HA` = 0.5 ha are skipped." },
  { id: "gps", name: "GPS (navigation satellites)", icon: "📍", cat: "space",
    text: "GPS satellites do not take pictures. They send very exact time signals, and a receiver (a phone or a drone) just listens. From the signals it works out how far away each satellite is, and the one spot that fits all the distances is where you are: **trilateration**. Phones are good to about 5 m under open sky. (game version: flat map, 3 satellites; real receivers use 4 or more)",
    reseed: "`reseed/mission.py` `export_waypoints()` writes the drone's `.waypoints` mission file (QGC WPL 110): every seed-release point is a latitude and longitude, and the drone uses GPS to fly to it." }
]);
