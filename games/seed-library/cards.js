/* Field Cards earned in Seed Library (g18). */
RQ.defineCards("g18", [
  { id: "db-table", name: "Database table", icon: "🗄️", cat: "data",
    text: "A **table** keeps facts in a grid. Each **row** is one thing (a **record**). Each **column** is one kind of fact (a **field**).",
    reseed: "(game version) ReSeed keeps its seed facts in `reseed/species.py` as a Python dict called `BIOMES`; here we show them as a table." },
  { id: "record-field", name: "Record, field, cell", icon: "📇", cat: "data",
    text: "A **cell** is where one row meets one column, like the `mass_g` of White oak: **3.5** grams.",
    reseed: "Every seed in `reseed/species.py` has the same fields: `latin`, `common`, `mass_g`, `volume_ml`, `v_terminal`, `establishment`, `delivery`." },
  { id: "sql-query", name: "Query: SELECT, WHERE, ORDER BY", icon: "🔍", cat: "data",
    text: "A **query** asks a database for exactly the rows you need. `SELECT` picks columns, `WHERE` filters rows, `ORDER BY` sorts them.",
    reseed: "(game version) ReSeed does not use SQL: `pipeline.run_site` looks up `BIOMES[site.biome]` to get the seed mix, and `species.seed_mix` does the same lookup." },
  { id: "native-species", name: "Native species", icon: "🌳", cat: "forest",
    text: "A **native** plant grows naturally in a place, rather than being brought there by people. Native seeds help rebuild forests and feed local animals.",
    reseed: "`reseed/species.py`: an oak-woodland gap gets acorns, never mango. Each forest biome lists one `not_suitable` seed and why." },
  { id: "key-join", name: "Key and join", icon: "🔑", cat: "data",
    text: "A **primary key** labels a row so we can tell it apart. A **foreign key** points to it from another table, and a **join** combines the matching facts.",
    reseed: "`reseed/config.py`: every `Site` has a `biome` field (\"key into reseed.species.BIOMES\"), like Ozarks → `oak_hickory`." },
  { id: "json", name: "JSON", icon: "📦", cat: "data",
    text: "**JSON** is a text format for data that websites love. JSON text needs \"double quotes\"; a Python dict looks almost the same and allows 'single' or \"double\" quotes.",
    reseed: "`webexport.write_species` writes `BIOMES` to `site/data/species.json` so the ReSeed website can read the seed library." }
]);
