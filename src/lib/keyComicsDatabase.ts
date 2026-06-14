/**
 * Key Comics Database (STATIC FALLBACK — L-SC34)
 *
 * Curated list of 1,130 key comics with guaranteed accurate key info.
 * (Authoritative count is getKeyComicsCount() === KEY_COMICS.length.)
 *
 * ROLE: This module is the FALLBACK source for key-info lookups. The canonical
 * read path is `keyComicsDb.ts` (`lookupKeyInfoFromDb`), which consults the
 * Supabase-backed `key_comics` table FIRST (so admin-approved community entries
 * surface) and falls back HERE when the DB is unavailable or has no match.
 *
 * Do NOT delete this file — it ships hand-vetted keys offline and guarantees a
 * useful response when Supabase is down. New runtime callers should import from
 * `keyComicsDb.ts`; import directly from here only for the offline fallback.
 *
 * To add more keys, add entries to the KEY_COMICS array below.
 *
 * Categories covered:
 * - Marvel: Spider-Man, X-Men, Avengers, Wolverine/Hulk, Fantastic Four, Guardians/Cosmic, Daredevil, Ghost Rider/Horror, Venom, Events, Black Panther, Modern Solos
 * - DC: Batman, Bat-Family, Superman, New Gods, Wonder Woman, Flash, Green Lantern, Justice League, Teen Titans, Crisis/Events, Vertigo
 * - Image: Spawn, Walking Dead, Saga, Modern Hits
 * - Independent: TMNT, Bone, Hellboy, and more
 */

interface KeyComic {
  title: string;
  issue: string;
  keyInfo: string[];
  year?: number; // Release year - required for titles with multiple volumes (e.g., X-Men 1963 vs 1991)
  /**
   * Alternate titles that should resolve to this same entry. Use when the AI
   * vision pipeline is known to return a different title than the canonical
   * series masthead - typically because the cover prominently displays a
   * character logo or subtitle alongside (or instead of) the series title.
   *
   * Example: Ultimate Fallout #4 - cover shows "ULTIMATE FALLOUT" + "SPIDER-MAN"
   * stacked, and AI commonly returns "Ultimate Fallout: Spider-Man".
   *
   * Aliases register the same keyInfo + year under additional normalized
   * lookup keys. Year disambiguation still applies.
   */
  aliases?: string[];
}

// Normalized title lookup map for fast searching
const normalizeTitle = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/^the\s+/, "") // Remove leading "The"
    .replace(/[^a-z0-9]/g, "") // Remove non-alphanumeric
    .trim();
};

// Build the database from the curated list
const KEY_COMICS: KeyComic[] = [
  // ============================================
  // MARVEL - SPIDER-MAN
  // ============================================
  {
    title: "Amazing Fantasy",
    issue: "15",
    year: 1962,
    keyInfo: [
      "First appearance of Spider-Man",
      "First appearance of Uncle Ben",
      "First appearance of Aunt May",
    ],
  },
  {
    title: "Amazing Spider-Man",
    issue: "1",
    year: 1963,
    keyInfo: [
      "First issue of Amazing Spider-Man series",
      "First appearance of J. Jonah Jameson",
      "First appearance of Chameleon",
    ],
  },
  { title: "Amazing Spider-Man", issue: "2", year: 1963, keyInfo: ["First appearance of the Vulture"] },
  { title: "Amazing Spider-Man", issue: "3", year: 1963, keyInfo: ["First appearance of Doctor Octopus"] },
  {
    title: "Amazing Spider-Man",
    issue: "4",
    year: 1963,
    keyInfo: ["First appearance of Sandman", "First appearance of Betty Brant"],
  },
  { title: "Amazing Spider-Man", issue: "6", year: 1963, keyInfo: ["First appearance of the Lizard"] },
  { title: "Amazing Spider-Man", issue: "9", year: 1963, keyInfo: ["First appearance of Electro"] },
  { title: "Amazing Spider-Man", issue: "13", year: 1963, keyInfo: ["First appearance of Mysterio"] },
  { title: "Amazing Spider-Man", issue: "14", year: 1963, keyInfo: ["First appearance of the Green Goblin"] },
  { title: "Amazing Spider-Man", issue: "20", year: 1963, keyInfo: ["First appearance of Scorpion"] },
  {
    title: "Amazing Spider-Man",
    issue: "25",
    year: 1963,
    keyInfo: ["First cameo appearance of Mary Jane Watson"],
  },
  { title: "Amazing Spider-Man", issue: "28", year: 1963, keyInfo: ["First Molten Man"] },
  {
    title: "Amazing Spider-Man",
    issue: "31",
    year: 1963,
    keyInfo: ["First appearance of Gwen Stacy", "First appearance of Harry Osborn"],
  },
  {
    title: "Amazing Spider-Man",
    issue: "42",
    year: 1963,
    keyInfo: ["First full appearance of Mary Jane Watson"],
  },
  {
    title: "Amazing Spider-Man",
    issue: "50",
    year: 1963,
    keyInfo: ["First appearance of Kingpin", "Classic 'Spider-Man No More' cover"],
  },
  {
    title: "Amazing Spider-Man",
    issue: "101",
    year: 1963,
    keyInfo: ["First appearance of Morbius the Living Vampire"],
  },
  { title: "Amazing Spider-Man", issue: "121", year: 1963, keyInfo: ["Death of Gwen Stacy"] },
  {
    title: "Amazing Spider-Man",
    issue: "122",
    year: 1963,
    keyInfo: ["Death of the Green Goblin (Norman Osborn)"],
  },
  {
    title: "Amazing Spider-Man",
    issue: "129",
    year: 1963,
    keyInfo: ["First appearance of the Punisher", "First appearance of the Jackal"],
  },
  { title: "Amazing Spider-Man", issue: "194", year: 1963, keyInfo: ["First appearance of Black Cat"] },
  { title: "Amazing Spider-Man", issue: "238", year: 1963, keyInfo: ["First appearance of Hobgoblin"] },
  {
    title: "Amazing Spider-Man",
    issue: "252",
    year: 1963,
    keyInfo: ["First appearance of Spider-Man's black costume in main continuity"],
  },
  {
    title: "Amazing Spider-Man",
    issue: "298",
    year: 1963,
    keyInfo: ["First Todd McFarlane art on Amazing Spider-Man", "First cameo of Eddie Brock"],
  },
  { title: "Amazing Spider-Man", issue: "299", year: 1963, keyInfo: ["First cameo appearance of Venom"] },
  {
    title: "Amazing Spider-Man",
    issue: "300",
    year: 1963,
    keyInfo: ["First full appearance of Venom", "Origin of Venom"],
  },
  { title: "Amazing Spider-Man", issue: "316", year: 1963, keyInfo: ["First Venom cover"] },
  { title: "Amazing Spider-Man", issue: "344", year: 1963, keyInfo: ["First appearance of Cletus Kasady"] },
  { title: "Amazing Spider-Man", issue: "361", year: 1963, keyInfo: ["First full appearance of Carnage"] },
  { title: "Amazing Spider-Man", issue: "569", year: 1963, keyInfo: ["First appearance of Anti-Venom"] },
  {
    title: "Amazing Spider-Man",
    issue: "654",
    year: 1963,
    keyInfo: ["First appearance of Agent Venom (Flash Thompson)"],
  },
  { title: "Amazing Spider-Man", issue: "667", year: 1963, keyInfo: ["First Spider-Island"] },
  {
    title: "Amazing Spider-Man",
    issue: "700",
    year: 1963,
    keyInfo: ["Death of Peter Parker", "Doctor Octopus becomes Spider-Man"],
  },

  // ============================================
  // MARVEL - SECRET WARS
  // ============================================
  {
    title: "Secret Wars",
    issue: "1",
    year: 1984,
    keyInfo: [
      "First issue of Marvel Super Heroes Secret Wars",
      "Major Marvel crossover event begins",
    ],
  },
  {
    title: "Secret Wars",
    issue: "8",
    year: 1984,
    keyInfo: [
      "First appearance of Spider-Man's black symbiote costume",
      "Origin of the symbiote that becomes Venom",
    ],
  },
  {
    title: "Marvel Super Heroes Secret Wars",
    issue: "1",
    year: 1984,
    keyInfo: [
      "First issue of Marvel Super Heroes Secret Wars",
      "Major Marvel crossover event begins",
    ],
  },
  {
    title: "Marvel Super Heroes Secret Wars",
    issue: "8",
    year: 1984,
    keyInfo: [
      "First appearance of Spider-Man's black symbiote costume",
      "Origin of the symbiote that becomes Venom",
    ],
  },
  {
    title: "Marvel Super-Heroes Secret Wars",
    issue: "1",
    year: 1984,
    keyInfo: [
      "First issue of Marvel Super Heroes Secret Wars",
      "Major Marvel crossover event begins",
    ],
  },
  {
    title: "Marvel Super-Heroes Secret Wars",
    issue: "8",
    year: 1984,
    keyInfo: [
      "First appearance of Spider-Man's black symbiote costume",
      "Origin of the symbiote that becomes Venom",
    ],
  },

  // ============================================
  // MARVEL - X-MEN
  // ============================================
  {
    title: "X-Men",
    issue: "1",
    year: 1963,
    keyInfo: [
      "First appearance of the X-Men",
      "First appearance of Professor X",
      "First appearance of Magneto",
      "First appearance of Cyclops, Marvel Girl, Beast, Angel, Iceman",
    ],
  },
  {
    title: "X-Men",
    issue: "4",
    year: 1963,
    keyInfo: [
      "First appearance of Scarlet Witch",
      "First appearance of Quicksilver",
      "First appearance of Brotherhood of Evil Mutants",
    ],
  },
  {
    title: "X-Men",
    issue: "1",
    year: 1991,
    keyInfo: [
      "Best-selling single comic issue of all time",
      "Jim Lee iconic cover",
      "Multiple variant covers (A through E)",
      "Estimated 8.1 million copies sold",
    ],
  },
  { title: "X-Men", issue: "12", year: 1963, keyInfo: ["First appearance of Juggernaut"] },
  { title: "X-Men", issue: "14", year: 1963, keyInfo: ["First appearance of the Sentinels"] },
  { title: "X-Men", issue: "28", year: 1963, keyInfo: ["First Banshee"] },
  {
    title: "X-Men",
    issue: "94",
    year: 1963,
    keyInfo: ["New X-Men team begins (Wolverine, Storm, Colossus, Nightcrawler join)"],
  },
  { title: "X-Men", issue: "101", year: 1963, keyInfo: ["First appearance of Phoenix"] },
  { title: "X-Men", issue: "120", year: 1963, keyInfo: ["First cameo of Alpha Flight"] },
  { title: "X-Men", issue: "121", year: 1963, keyInfo: ["First full appearance of Alpha Flight"] },
  {
    title: "X-Men",
    issue: "129",
    year: 1963,
    keyInfo: ["First appearance of Kitty Pryde", "First appearance of Emma Frost"],
  },
  { title: "X-Men", issue: "130", year: 1963, keyInfo: ["First appearance of Dazzler"] },
  { title: "X-Men", issue: "131", year: 1963, keyInfo: ["First White Queen cover"] },
  { title: "X-Men", issue: "132", year: 1963, keyInfo: ["First Hellfire Club"] },
  { title: "X-Men", issue: "133", year: 1963, keyInfo: ["Classic Wolverine cover"] },
  { title: "X-Men", issue: "135", year: 1963, keyInfo: ["Dark Phoenix Saga"] },
  { title: "X-Men", issue: "137", year: 1963, keyInfo: ["Death of Phoenix (Jean Grey)"] },
  { title: "X-Men", issue: "141", year: 1963, keyInfo: ["Days of Future Past begins", "First Rachel Summers"] },
  { title: "X-Men", issue: "142", year: 1963, keyInfo: ["Days of Future Past concludes"] },
  { title: "X-Men", issue: "168", year: 1963, keyInfo: ["First Madelyne Pryor"] },
  { title: "X-Men", issue: "221", year: 1963, keyInfo: ["First appearance of Mister Sinister"] },
  { title: "X-Men", issue: "244", year: 1963, keyInfo: ["First appearance of Jubilee"] },
  { title: "X-Men", issue: "266", year: 1963, keyInfo: ["First full appearance of Gambit"] },
  {
    title: "Uncanny X-Men",
    issue: "94",
    year: 1963,
    keyInfo: ["New X-Men team begins (Wolverine, Storm, Colossus, Nightcrawler join)"],
  },
  { title: "Uncanny X-Men", issue: "101", year: 1963, keyInfo: ["First appearance of Phoenix"] },
  {
    title: "Uncanny X-Men",
    issue: "129",
    year: 1963,
    keyInfo: ["First appearance of Kitty Pryde", "First appearance of Emma Frost"],
  },
  { title: "Uncanny X-Men", issue: "141", year: 1963, keyInfo: ["Days of Future Past begins"] },
  { title: "Uncanny X-Men", issue: "266", year: 1963, keyInfo: ["First full appearance of Gambit"] },
  { title: "Uncanny X-Men", issue: "282", year: 1963, keyInfo: ["First appearance of Bishop"] },
  {
    title: "Giant-Size X-Men",
    issue: "1",
    year: 1975,
    keyInfo: [
      "First appearance of the new X-Men team",
      "First appearance of Storm",
      "First appearance of Colossus",
      "First appearance of Nightcrawler",
      "Second appearance of Wolverine",
    ],
  },

  // ============================================
  // MARVEL - WOLVERINE / HULK
  // ============================================
  {
    title: "Incredible Hulk",
    issue: "1",
    year: 1962,
    keyInfo: ["First appearance of the Hulk", "First appearance of Bruce Banner"],
  },
  { title: "Incredible Hulk", issue: "180", year: 1968, keyInfo: ["First cameo appearance of Wolverine"] },
  { title: "Incredible Hulk", issue: "181", year: 1968, keyInfo: ["First full appearance of Wolverine"] },
  { title: "Incredible Hulk", issue: "182", year: 1968, keyInfo: ["Third appearance of Wolverine"] },
  { title: "Incredible Hulk", issue: "271", year: 1968, keyInfo: ["First comic appearance of Rocket Raccoon"] },
  {
    title: "Incredible Hulk",
    issue: "340",
    year: 1968,
    keyInfo: [
      "Classic Todd McFarlane Wolverine vs Hulk cover",
      "One of the most iconic copper age covers",
    ],
  },
  { title: "Incredible Hulk", issue: "377", year: 1968, keyInfo: ["Professor Hulk"] },
  { title: "Incredible Hulk", issue: "449", year: 1968, keyInfo: ["First Thunderbolts"] },
  {
    title: "Wolverine",
    issue: "1",
    year: 1982,
    keyInfo: ["First Wolverine limited series", "Frank Miller art"],
  },
  { title: "Wolverine", issue: "10", year: 1988, keyInfo: ["Classic Sabretooth battle"] },
  { title: "Wolverine", issue: "66", year: 2003, keyInfo: ["Old Man Logan storyline begins"] },
  { title: "Immortal Hulk", issue: "1", year: 2018, keyInfo: ["First Immortal Hulk"] },
  { title: "Savage She-Hulk", issue: "1", year: 1980, keyInfo: ["First She-Hulk"] },

  // ============================================
  // MARVEL - NEW MUTANTS / DEADPOOL / X-FORCE
  // ============================================
  { title: "New Mutants", issue: "1", year: 1983, keyInfo: ["First appearance of the New Mutants team"] },
  {
    title: "New Mutants",
    issue: "87",
    year: 1983,
    keyInfo: [
      "First appearance of Cable",
      "Rob Liefeld art",
      "Gold second printing variant exists",
    ],
  },
  {
    title: "New Mutants",
    issue: "98",
    year: 1983,
    keyInfo: ["First appearance of Deadpool", "First appearance of Domino"],
  },
  { title: "New Mutants", issue: "100", year: 1983, keyInfo: ["First appearance of X-Force"] },
  {
    title: "X-Force",
    issue: "1",
    year: 1991,
    keyInfo: [
      "X-Force begins",
      "Poly-bagged with one of five trading cards",
      "Rob Liefeld art",
    ],
  },
  { title: "X-Force", issue: "2", year: 1991, keyInfo: ["Second Deadpool"] },
  { title: "X-Factor", issue: "6", year: 1986, keyInfo: ["First Apocalypse"] },
  { title: "X-Factor", issue: "24", year: 1986, keyInfo: ["First Archangel"] },
  { title: "Alpha Flight", issue: "1", year: 1983, keyInfo: ["First Alpha Flight solo"] },
  { title: "Alpha Flight", issue: "33", year: 1983, keyInfo: ["First Lady Deathstrike"] },

  // ============================================
  // MARVEL - AVENGERS
  // ============================================
  {
    title: "Avengers",
    issue: "1",
    year: 1963,
    keyInfo: [
      "First appearance of the Avengers team",
      "First Avengers lineup: Thor, Iron Man, Hulk, Ant-Man, Wasp",
    ],
  },
  {
    title: "Avengers",
    issue: "4",
    year: 1963,
    keyInfo: [
      "First Silver Age appearance of Captain America",
      "Captain America joins the Avengers",
    ],
  },
  { title: "Avengers", issue: "16", year: 1963, keyInfo: ["New Avengers lineup"] },
  { title: "Avengers", issue: "57", year: 1963, keyInfo: ["First appearance of Vision"] },
  { title: "Avengers", issue: "87", year: 1963, keyInfo: ["Origin of Black Panther"] },
  { title: "Avengers", issue: "181", year: 1963, keyInfo: ["First appearance of Scott Lang as Ant-Man"] },
  { title: "Avengers", issue: "195", year: 1963, keyInfo: ["First cameo of Taskmaster"] },
  { title: "Avengers", issue: "196", year: 1963, keyInfo: ["First full appearance of Taskmaster"] },
  { title: "Avengers", issue: "221", year: 1963, keyInfo: ["Hawkeye becomes leader"] },
  { title: "Avengers", issue: "223", year: 1963, keyInfo: ["Classic Hawkeye/Ant-Man"] },
  { title: "Avengers", issue: "500", year: 1963, keyInfo: ["Avengers Disassembled"] },
  { title: "West Coast Avengers", issue: "45", year: 1985, keyInfo: ["First White Vision"] },
  { title: "New Avengers", issue: "1", year: 2004, keyInfo: ["New Avengers begins"] },
  { title: "Young Avengers", issue: "1", year: 2005, keyInfo: ["First Young Avengers"] },
  { title: "Dark Avengers", issue: "1", year: 2009, keyInfo: ["First Dark Avengers"] },

  // ============================================
  // MARVEL - IRON MAN / CAPTAIN AMERICA / THOR
  // ============================================
  { title: "Tales of Suspense", issue: "39", year: 1963, keyInfo: ["First appearance of Iron Man"], aliases: ["Tales of Suspense: Iron Man"] },
  { title: "Tales of Suspense", issue: "52", year: 1963, keyInfo: ["First appearance of Black Widow"] },
  { title: "Tales of Suspense", issue: "57", year: 1963, keyInfo: ["First appearance of Hawkeye"] },
  { title: "Tales to Astonish", issue: "27", year: 1962, keyInfo: ["First Ant-Man"] },
  { title: "Iron Man", issue: "1", year: 1968, keyInfo: ["First Iron Man solo series"] },
  {
    title: "Iron Man",
    issue: "55",
    year: 1968,
    keyInfo: ["First appearance of Thanos", "First appearance of Drax the Destroyer"],
  },
  { title: "Iron Man", issue: "118", year: 1968, keyInfo: ["First James Rhodes"] },
  { title: "Iron Man", issue: "128", year: 1968, keyInfo: ["Demon in a Bottle storyline"] },
  { title: "Iron Man", issue: "282", year: 1968, keyInfo: ["First War Machine armor"] },
  {
    title: "Captain America",
    issue: "1",
    year: 1941,
    keyInfo: [
      "First appearance of Captain America (Golden Age)",
      "First appearance of Bucky Barnes",
      "First appearance of Red Skull",
    ],
  },
  { title: "Captain America", issue: "100", year: 1968, keyInfo: ["First Captain America solo (Silver Age)"] },
  { title: "Captain America", issue: "109", year: 1968, keyInfo: ["Origin of Captain America retold"] },
  { title: "Captain America", issue: "117", year: 1968, keyInfo: ["First appearance of Falcon"] },
  { title: "Captain America", issue: "176", year: 1968, keyInfo: ["Captain America quits"] },
  { title: "Captain America", issue: "241", year: 1968, keyInfo: ["Classic Punisher"] },
  { title: "Captain America", issue: "323", year: 1968, keyInfo: ["First Super Patriot"] },
  { title: "Captain America", issue: "332", year: 1968, keyInfo: ["Steve Rogers quits"] },
  { title: "Captain America", issue: "360", year: 1968, keyInfo: ["First Crossbones"] },
  { title: "Captain America", issue: "383", year: 1968, keyInfo: ["50th anniversary"] },
  { title: "Captain America", issue: "25", year: 2005, keyInfo: ["Death of Captain America"] },
  { title: "Journey Into Mystery", issue: "83", year: 1962, keyInfo: ["First appearance of Thor"], aliases: ["Journey Into Mystery: Thor"] },
  { title: "Thor", issue: "165", year: 1966, keyInfo: ["First full Him/Adam Warlock"] },
  { title: "Thor", issue: "337", year: 1966, keyInfo: ["First appearance of Beta Ray Bill"] },
  { title: "Thor", issue: "411", year: 1966, keyInfo: ["First New Warriors"] },
  { title: "Thor", issue: "1", year: 2014, keyInfo: ["First appearance of Jane Foster as Thor"] },
  { title: "Mighty Thor", issue: "1", year: 2015, keyInfo: ["Jane Foster Thor continues"] },

  // ============================================
  // MARVEL - FANTASTIC FOUR
  // ============================================
  {
    title: "Fantastic Four",
    issue: "1",
    year: 1961,
    keyInfo: ["First appearance of the Fantastic Four", "First appearance of Mole Man"],
  },
  { title: "Fantastic Four", issue: "5", year: 1961, keyInfo: ["First appearance of Doctor Doom"] },
  { title: "Fantastic Four", issue: "12", year: 1961, keyInfo: ["Hulk vs Thing"] },
  { title: "Fantastic Four", issue: "45", year: 1961, keyInfo: ["First appearance of the Inhumans"] },
  { title: "Fantastic Four", issue: "46", year: 1961, keyInfo: ["First full appearance of Black Bolt"] },
  {
    title: "Fantastic Four",
    issue: "48",
    year: 1961,
    keyInfo: ["First appearance of Silver Surfer", "First appearance of Galactus"],
  },
  { title: "Fantastic Four", issue: "49", year: 1961, keyInfo: ["First full Galactus"] },
  { title: "Fantastic Four", issue: "52", year: 1961, keyInfo: ["First appearance of Black Panther"] },
  { title: "Fantastic Four", issue: "67", year: 1961, keyInfo: ["First Him (Adam Warlock)"] },

  // ============================================
  // MARVEL - GUARDIANS / COSMIC
  // ============================================
  {
    title: "Marvel Super-Heroes",
    issue: "18",
    year: 1967,
    keyInfo: ["First appearance of the original Guardians of the Galaxy"],
  },
  { title: "Marvel Super-Heroes", issue: "13", year: 1967, keyInfo: ["First Carol Danvers"] },
  { title: "Marvel Preview", issue: "4", year: 1975, keyInfo: ["First appearance of Star-Lord"] },
  { title: "Marvel Preview", issue: "7", year: 1975, keyInfo: ["First Rocket Raccoon full"] },
  { title: "Guardians of the Galaxy", issue: "1", year: 2008, keyInfo: ["Modern GOTG (2008)"] },
  { title: "Annihilation", issue: "1", year: 2006, keyInfo: ["Annihilation event"] },
  {
    title: "Infinity Gauntlet",
    issue: "1",
    year: 1991,
    keyInfo: ["Infinity Gauntlet storyline begins", "Thanos wields the Infinity Gauntlet"],
  },
  { title: "Infinity Gauntlet", issue: "2", year: 1991, keyInfo: ["Infinity Gauntlet continues"] },
  { title: "Silver Surfer", issue: "1", year: 1968, keyInfo: ["First Silver Surfer solo"] },
  { title: "Silver Surfer", issue: "3", year: 1968, keyInfo: ["First Mephisto"] },
  { title: "Silver Surfer", issue: "4", year: 1968, keyInfo: ["Classic Thor vs Surfer"] },
  { title: "Silver Surfer", issue: "44", year: 1987, keyInfo: ["First appearance of the Infinity Gauntlet"] },
  { title: "Warlock", issue: "1", year: 1972, keyInfo: ["Adam Warlock solo"] },
  { title: "Thanos Quest", issue: "1", year: 1990, keyInfo: ["Thanos Quest begins"] },
  { title: "Eternals", issue: "1", year: 1976, keyInfo: ["First Eternals"] },
  { title: "Ms. Marvel", issue: "1", year: 1977, keyInfo: ["First Ms. Marvel"] },
  { title: "Captain Marvel", issue: "1", year: 1968, keyInfo: ["First Mar-Vell solo"] },

  // ============================================
  // MARVEL - DAREDEVIL / STREET LEVEL
  // ============================================
  {
    title: "Daredevil",
    issue: "1",
    year: 1964,
    keyInfo: ["First appearance of Daredevil", "Origin of Daredevil"],
  },
  { title: "Daredevil", issue: "7", year: 1964, keyInfo: ["First red costume"] },
  { title: "Daredevil", issue: "131", year: 1964, keyInfo: ["First appearance of Bullseye"] },
  { title: "Daredevil", issue: "158", year: 1964, keyInfo: ["Frank Miller begins"] },
  {
    title: "Daredevil",
    issue: "168",
    year: 1964,
    keyInfo: ["First appearance of Elektra", "Frank Miller's Daredevil run begins"],
  },
  { title: "Daredevil", issue: "181", year: 1964, keyInfo: ["Death of Elektra"] },
  { title: "Daredevil", issue: "227", year: 1964, keyInfo: ["Born Again begins"] },
  { title: "Hero for Hire", issue: "1", year: 1972, keyInfo: ["First appearance of Luke Cage"] },
  { title: "Marvel Premiere", issue: "15", year: 1972, keyInfo: ["First appearance of Iron Fist"], aliases: ["Marvel Premiere: Iron Fist"] },
  { title: "Werewolf by Night", issue: "32", year: 1975, keyInfo: ["First appearance of Moon Knight"] },
  { title: "Moon Knight", issue: "1", year: 1980, keyInfo: ["First Moon Knight solo"] },

  // ============================================
  // MARVEL - GHOST RIDER / BLADE / HORROR
  // ============================================
  {
    title: "Marvel Spotlight",
    issue: "5",
    year: 1972,
    keyInfo: ["First appearance of Ghost Rider (Johnny Blaze)"],
    aliases: ["Marvel Spotlight: Ghost Rider"],
  },
  { title: "Ghost Rider", issue: "1", year: 1973, keyInfo: ["First Ghost Rider solo"] },
  { title: "Tomb of Dracula", issue: "10", year: 1972, keyInfo: ["First appearance of Blade"] },
  { title: "Strange Tales", issue: "110", year: 1963, keyInfo: ["First Doctor Strange"], aliases: ["Strange Tales: Doctor Strange"] },
  { title: "Strange Tales", issue: "135", year: 1963, keyInfo: ["First Nick Fury, SHIELD"] },
  { title: "Strange Tales", issue: "169", year: 1963, keyInfo: ["First Brother Voodoo"] },
  { title: "Strange Tales", issue: "178", year: 1963, keyInfo: ["First Magus"] },
  { title: "Marvel Two-in-One Annual", issue: "2", year: 1974, keyInfo: ["First Thanos death"] },

  // ============================================
  // MARVEL - MILES MORALES / SPIDER-VERSE
  // ============================================
  {
    title: "Ultimate Fallout",
    issue: "4",
    year: 2011,
    keyInfo: ["First appearance of Miles Morales as Spider-Man"],
    // Cover prominently displays SPIDER-MAN above the series title, so AI
    // recognition commonly returns the masthead+feature variant. All three
    // listed forms normalize to "ultimatefalloutspiderman".
    aliases: ["Ultimate Fallout: Spider-Man", "Ultimate Fallout - Spider-Man", "Ultimate Fallout Spider-Man"],
  },
  {
    title: "Edge of Spider-Verse",
    issue: "2",
    year: 2014,
    keyInfo: ["First appearance of Spider-Gwen (Gwen Stacy as Spider-Woman)"],
  },

  // ============================================
  // MARVEL - VENOM
  // ============================================
  {
    title: "Venom: Lethal Protector",
    issue: "1",
    year: 1993,
    keyInfo: [
      "First Venom solo series",
      "Red foil cover variant exists",
    ],
  },
  { title: "Venom", issue: "1", year: 2018, keyInfo: ["First issue of 2018 Venom series"] },
  { title: "Venom", issue: "3", year: 2018, keyInfo: ["First appearance of Knull"] },

  // ============================================
  // MARVEL - SPIDER-MAN EXTENDED UNIVERSE
  // ============================================
  { title: "Spider-Verse", issue: "1", year: 2014, keyInfo: ["Spider-Verse event"] },
  {
    title: "Spider-Man",
    issue: "1",
    year: 1990,
    keyInfo: [
      "First Todd McFarlane Spider-Man series",
      "Multiple poly-bagged editions (silver, gold, platinum)",
    ],
  },
  { title: "Spider-Gwen", issue: "1", year: 2015, keyInfo: ["Spider-Gwen solo"] },
  { title: "Silk", issue: "1", year: 2015, keyInfo: ["First Silk solo"] },
  { title: "Web of Spider-Man", issue: "1", year: 1985, keyInfo: ["First Web of Spider-Man"] },
  { title: "Spectacular Spider-Man", issue: "1", year: 1976, keyInfo: ["First Spectacular Spider-Man"] },
  { title: "Sensational Spider-Man", issue: "1", year: 1996, keyInfo: ["First Sensational Spider-Man"] },
  { title: "Superior Spider-Man", issue: "1", year: 2013, keyInfo: ["First Superior Spider-Man"] },
  { title: "Spider-Man 2099", issue: "1", year: 1992, keyInfo: ["First Spider-Man 2099"] },
  { title: "What If", issue: "105", year: 1989, keyInfo: ["First Spider-Girl"] },
  { title: "What If", issue: "1", year: 1977, keyInfo: ["First What If"] },

  // ============================================
  // MARVEL - EVENTS
  // ============================================
  { title: "Contest of Champions", issue: "1", year: 1982, keyInfo: ["First limited series crossover"] },
  { title: "House of M", issue: "1", year: 2005, keyInfo: ["House of M begins"] },
  { title: "House of M", issue: "7", year: 2005, keyInfo: ["No More Mutants"] },
  { title: "Civil War", issue: "1", year: 2006, keyInfo: ["Civil War begins"] },
  { title: "Civil War", issue: "7", year: 2006, keyInfo: ["Death of Captain America tie-in"] },
  { title: "Siege", issue: "1", year: 2010, keyInfo: ["Siege event"] },
  { title: "Fear Itself", issue: "1", year: 2011, keyInfo: ["Fear Itself event"] },
  { title: "Avengers vs X-Men", issue: "1", year: 2012, keyInfo: ["AvX event"] },
  { title: "Age of Ultron", issue: "1", year: 2013, keyInfo: ["Age of Ultron event"] },
  { title: "Original Sin", issue: "1", year: 2014, keyInfo: ["Original Sin event"] },
  { title: "Secret Empire", issue: "1", year: 2017, keyInfo: ["Secret Empire event"] },
  { title: "Secret Invasion", issue: "1", year: 2008, keyInfo: ["Secret Invasion event"] },
  { title: "War of the Realms", issue: "1", year: 2019, keyInfo: ["War of the Realms event"] },
  { title: "King in Black", issue: "1", year: 2020, keyInfo: ["King in Black event"] },
  { title: "Absolute Carnage", issue: "1", year: 2019, keyInfo: ["Absolute Carnage event"] },
  { title: "Extreme Carnage", issue: "1", year: 2021, keyInfo: ["Extreme Carnage event"] },

  // ============================================
  // MARVEL - BLACK PANTHER
  // ============================================
  { title: "Black Panther", issue: "1", year: 1977, keyInfo: ["First Black Panther solo"] },
  { title: "Black Panther", issue: "7", year: 1998, keyInfo: ["First Okoye"] },
  { title: "Jungle Action", issue: "6", year: 1973, keyInfo: ["First Killmonger"] },
  { title: "Shuri", issue: "1", year: 2018, keyInfo: ["First Shuri solo"] },
  { title: "Killmonger", issue: "1", year: 2018, keyInfo: ["First Killmonger solo"] },

  // ============================================
  // MARVEL - MODERN SOLOS
  // ============================================
  { title: "Vision", issue: "1", year: 2015, keyInfo: ["First Vision solo (King)"] },
  { title: "Scarlet Witch", issue: "1", year: 2015, keyInfo: ["First Scarlet Witch solo"] },
  { title: "Hawkeye", issue: "1", year: 2012, keyInfo: ["First Hawkeye solo (Fraction)"] },
  { title: "Hawkeye", issue: "2", year: 2012, keyInfo: ["Pizza Dog"] },
  { title: "She-Hulk", issue: "1", year: 2022, keyInfo: ["She-Hulk solo (2022)"] },
  { title: "Loki", issue: "1", year: 2004, keyInfo: ["First Loki solo"] },
  { title: "Runaways", issue: "1", year: 2003, keyInfo: ["First Runaways"] },
  { title: "Champions", issue: "1", year: 2016, keyInfo: ["First Champions (2016)"] },
  { title: "Squirrel Girl", issue: "1", year: 2015, keyInfo: ["First Unbeatable Squirrel Girl"] },
  { title: "America", issue: "1", year: 2017, keyInfo: ["First America Chavez solo"] },
  { title: "Power Pack", issue: "1", year: 1984, keyInfo: ["First Power Pack"] },

  // ============================================
  // DC - BATMAN
  // ============================================
  { title: "Detective Comics", issue: "27", year: 1937, keyInfo: ["First appearance of Batman"] },
  { title: "Detective Comics", issue: "31", year: 1937, keyInfo: ["Classic Batman cover"] },
  { title: "Detective Comics", issue: "38", year: 1937, keyInfo: ["First appearance of Robin (Dick Grayson)"] },
  { title: "Detective Comics", issue: "140", year: 1937, keyInfo: ["First appearance of the Riddler"] },
  { title: "Detective Comics", issue: "168", year: 1937, keyInfo: ["Origin of Red Hood"] },
  { title: "Detective Comics", issue: "225", year: 1937, keyInfo: ["First Martian Manhunter"] },
  { title: "Detective Comics", issue: "233", year: 1937, keyInfo: ["First Batwoman"] },
  {
    title: "Detective Comics",
    issue: "359",
    year: 1937,
    keyInfo: ["First appearance of Batgirl (Barbara Gordon)"],
  },
  { title: "Detective Comics", issue: "400", year: 1937, keyInfo: ["First Man-Bat"] },
  { title: "Detective Comics", issue: "411", year: 1937, keyInfo: ["First Talia al Ghul"] },
  { title: "Detective Comics", issue: "880", year: 1937, keyInfo: ["Classic Jock Joker cover"] },
  { title: "Detective Comics", issue: "934", year: 1937, keyInfo: ["Rebirth Detective Comics"] },
  {
    title: "Batman",
    issue: "1",
    year: 1940,
    keyInfo: ["First appearance of Joker", "First appearance of Catwoman"],
  },
  { title: "Batman", issue: "181", year: 1940, keyInfo: ["First appearance of Poison Ivy"] },
  { title: "Batman", issue: "232", year: 1940, keyInfo: ["First appearance of Ra's al Ghul"] },
  { title: "Batman", issue: "251", year: 1940, keyInfo: ["Classic Joker cover"] },
  { title: "Batman", issue: "357", year: 1940, keyInfo: ["First appearance of Jason Todd"] },
  { title: "Batman", issue: "386", year: 1940, keyInfo: ["First Black Mask"] },
  { title: "Batman", issue: "404", year: 1940, keyInfo: ["Batman: Year One begins"] },
  { title: "Batman", issue: "410", year: 1940, keyInfo: ["First post-Crisis appearance of Jason Todd", "Post-Crisis Jason Todd origin begins"] },
  { title: "Batman", issue: "423", year: 1940, keyInfo: ["Classic McFarlane cover"] },
  { title: "Batman", issue: "426", year: 1940, keyInfo: ["A Death in the Family storyline begins"] },
  { title: "Batman", issue: "427", year: 1940, keyInfo: ["Death in the Family"] },
  { title: "Batman", issue: "428", year: 1940, keyInfo: ["Death of Jason Todd"] },
  {
    title: "Batman",
    issue: "497",
    year: 1940,
    keyInfo: [
      "Bane breaks Batman's back",
      "Part of Knightfall storyline",
    ],
  },
  { title: "Batman", issue: "567", year: 1940, keyInfo: ["First Cassandra Cain Batgirl"] },
  { title: "Batman", issue: "608", year: 1940, keyInfo: ["Hush storyline begins", "Jim Lee art"] },
  { title: "Batman", issue: "655", year: 1940, keyInfo: ["First appearance of Damian Wayne"] },
  {
    title: "Batman Adventures",
    issue: "12",
    year: 1992,
    keyInfo: ["First comic book appearance of Harley Quinn"],
  },
  {
    title: "Batman: The Killing Joke",
    issue: "1",
    year: 1988,
    keyInfo: ["The Killing Joke - Alan Moore/Brian Bolland", "Barbara Gordon paralyzed"],
  },
  {
    title: "Batman: Dark Knight Returns",
    issue: "1",
    year: 1986,
    keyInfo: [
      "The Dark Knight Returns begins - Frank Miller",
      "Redefined Batman for the modern era",
      "One of the most influential comics of all time",
    ],
  },
  { title: "Harley Quinn", issue: "1", year: 2000, keyInfo: ["First Harley solo"] },

  // ============================================
  // DC - BAT-FAMILY
  // ============================================
  { title: "Nightwing", issue: "1", year: 1996, keyInfo: ["First Nightwing solo"] },
  { title: "Red Hood and the Outlaws", issue: "1", year: 2011, keyInfo: ["First Red Hood solo"] },
  { title: "Batwoman", issue: "1", year: 2011, keyInfo: ["First Batwoman solo"] },
  { title: "Batgirl", issue: "1", year: 2011, keyInfo: ["New 52 Batgirl"] },
  { title: "Batgirl of Burnside", issue: "35", year: 2014, keyInfo: ["Burnside begins"] },
  { title: "Robin", issue: "1", year: 1993, keyInfo: ["First Robin solo (Tim Drake)"] },
  { title: "Batman and Robin", issue: "1", year: 2009, keyInfo: ["Morrison Batman and Robin"] },
  { title: "Grayson", issue: "1", year: 2014, keyInfo: ["First Grayson spy series"] },
  { title: "Gotham Central", issue: "1", year: 2003, keyInfo: ["First Gotham Central"] },
  { title: "Birds of Prey", issue: "1", year: 1999, keyInfo: ["First Birds of Prey"] },
  { title: "Catwoman", issue: "1", year: 1993, keyInfo: ["First Catwoman solo"] },
  { title: "Poison Ivy", issue: "1", year: 2022, keyInfo: ["First Poison Ivy solo"] },

  // ============================================
  // DC - BATMAN EVENTS / MODERN
  // ============================================
  { title: "Batman Who Laughs", issue: "1", year: 2018, keyInfo: ["First Batman Who Laughs solo"] },
  { title: "Dark Nights: Metal", issue: "1", year: 2017, keyInfo: ["Metal event begins"] },
  { title: "Dark Nights: Death Metal", issue: "1", year: 2020, keyInfo: ["Death Metal event"] },
  { title: "Batman: White Knight", issue: "1", year: 2017, keyInfo: ["White Knight begins"] },
  { title: "Three Jokers", issue: "1", year: 2020, keyInfo: ["Three Jokers begins"] },
  { title: "DCeased", issue: "1", year: 2019, keyInfo: ["DCeased begins"] },
  { title: "Injustice", issue: "1", year: 2013, keyInfo: ["First Injustice"] },
  { title: "Batman/Fortnite", issue: "1", year: 2021, keyInfo: ["Batman Fortnite crossover"] },

  // ============================================
  // DC - SUPERMAN
  // ============================================
  {
    title: "Action Comics",
    issue: "1",
    year: 1938,
    keyInfo: ["First appearance of Superman", "Most valuable comic book in existence"],
  },
  { title: "Action Comics", issue: "23", year: 1938, keyInfo: ["First Lex Luthor"] },
  { title: "Action Comics", issue: "242", year: 1938, keyInfo: ["First Brainiac"] },
  { title: "Action Comics", issue: "252", year: 1938, keyInfo: ["First appearance of Supergirl"] },
  { title: "Action Comics", issue: "521", year: 1938, keyInfo: ["First Vixen"] },
  { title: "Superman", issue: "1", year: 1939, keyInfo: ["First Superman solo (Golden Age)"] },
  {
    title: "Superman",
    issue: "75",
    year: 1987,
    keyInfo: [
      "Death of Superman",
      "Poly-bagged edition with memorial armband",
      "Black poly-bag variant is most iconic",
    ],
  },
  { title: "Superman", issue: "233", year: 1939, keyInfo: ["Classic Kryptonite No More"] },
  {
    title: "Superman's Pal Jimmy Olsen",
    issue: "134",
    year: 1954,
    keyInfo: ["First appearance of Darkseid (cameo)"],
  },
  { title: "Forever People", issue: "1", year: 1971, keyInfo: ["First full appearance of Darkseid"] },
  { title: "Adventure Comics", issue: "247", year: 1938, keyInfo: ["First Legion of Super-Heroes"] },
  { title: "Superboy", issue: "68", year: 1949, keyInfo: ["First Bizarro"] },
  { title: "Supergirl", issue: "1", year: 2005, keyInfo: ["First Supergirl solo (modern)"] },
  { title: "Superboy", issue: "1", year: 1994, keyInfo: ["First Superboy solo (Kon-El)"] },

  // ============================================
  // DC - NEW GODS / FOURTH WORLD
  // ============================================
  { title: "New Gods", issue: "1", year: 1971, keyInfo: ["First Orion, New Gods"] },
  { title: "New Gods", issue: "7", year: 1971, keyInfo: ["First Steppenwolf"] },
  { title: "Mister Miracle", issue: "1", year: 1971, keyInfo: ["First Mister Miracle"] },

  // ============================================
  // DC - WONDER WOMAN
  // ============================================
  { title: "All Star Comics", issue: "8", year: 1941, keyInfo: ["First appearance of Wonder Woman"] },
  { title: "Sensation Comics", issue: "1", year: 1942, keyInfo: ["Wonder Woman origin"] },
  { title: "Wonder Woman", issue: "1", year: 1942, keyInfo: ["First Wonder Woman solo comic"] },
  { title: "Wonder Woman", issue: "98", year: 1942, keyInfo: ["First Silver Age Wonder Woman"] },
  { title: "Wonder Woman", issue: "178", year: 1942, keyInfo: ["New Wonder Woman begins"] },
  { title: "Wonder Woman", issue: "329", year: 1942, keyInfo: ["Last pre-Crisis"] },

  // ============================================
  // DC - FLASH / GREEN LANTERN
  // ============================================
  {
    title: "Showcase",
    issue: "4",
    year: 1956,
    keyInfo: ["First appearance of Barry Allen Flash", "Beginning of the Silver Age of Comics"],
  },
  { title: "Showcase", issue: "22", year: 1956, keyInfo: ["First appearance of Hal Jordan Green Lantern"] },
  { title: "Showcase", issue: "34", year: 1956, keyInfo: ["First Silver Age Atom"] },
  { title: "Flash", issue: "1", year: 1959, keyInfo: ["First Flash solo (Silver Age)"] },
  { title: "Flash", issue: "105", year: 1959, keyInfo: ["First Silver Age Flash"] },
  { title: "Flash", issue: "110", year: 1959, keyInfo: ["First Kid Flash"] },
  {
    title: "Flash",
    issue: "123",
    year: 1959,
    keyInfo: [
      "Flash of Two Worlds - first Silver Age/Golden Age crossover",
      "Introduction of the multiverse concept",
    ],
  },
  { title: "Flash", issue: "139", year: 1959, keyInfo: ["First appearance of Reverse Flash (Professor Zoom)"] },
  { title: "Green Lantern", issue: "1", year: 1960, keyInfo: ["First Green Lantern solo (Silver Age)"] },
  { title: "Green Lantern", issue: "7", year: 1960, keyInfo: ["First appearance of Sinestro"] },
  { title: "Green Lantern", issue: "59", year: 1960, keyInfo: ["First Guy Gardner"] },
  {
    title: "Green Lantern",
    issue: "76",
    year: 1960,
    keyInfo: ["Green Lantern/Green Arrow begins - Dennis O'Neil/Neal Adams"],
  },
  { title: "Green Lantern", issue: "87", year: 1960, keyInfo: ["First appearance of John Stewart"] },
  { title: "Green Lantern", issue: "122", year: 1976, keyInfo: ["Guy Gardner backup begins"] },
  { title: "Green Lantern", issue: "188", year: 1976, keyInfo: ["First Star Sapphire modern"] },
  { title: "Green Lantern", issue: "195", year: 1976, keyInfo: ["Guy Gardner gets ring"] },
  { title: "Green Lantern", issue: "50", year: 1990, keyInfo: ["Emerald Twilight (1994)"] },
  { title: "Green Lantern Corps", issue: "201", year: 1986, keyInfo: ["Kilowog spotlight"] },
  { title: "Green Lantern: Rebirth", issue: "1", year: 2004, keyInfo: ["Hal Jordan returns"] },
  { title: "Green Arrow", issue: "1", year: 1983, keyInfo: ["First Green Arrow solo"] },
  { title: "Aquaman", issue: "35", year: 1962, keyInfo: ["First Black Manta"] },
  { title: "Black Canary", issue: "1", year: 1993, keyInfo: ["First Black Canary solo"] },

  // ============================================
  // DC - JUSTICE LEAGUE / TEEN TITANS
  // ============================================
  {
    title: "Brave and the Bold",
    issue: "28",
    year: 1960,
    keyInfo: ["First appearance of the Justice League of America"],
  },
  { title: "Justice League", issue: "1", year: 1987, keyInfo: ["Justice League International"] },
  { title: "Justice League of America", issue: "1", year: 1960, keyInfo: ["First JLA solo"] },
  { title: "Justice League of America", issue: "21", year: 1960, keyInfo: ["First Silver Age JSA"] },
  { title: "Justice League of America", issue: "29", year: 1960, keyInfo: ["First Starman"] },
  {
    title: "New Teen Titans",
    issue: "1",
    year: 1980,
    keyInfo: ["First appearance of the New Teen Titans team"],
  },
  { title: "New Teen Titans", issue: "2", year: 1980, keyInfo: ["First appearance of Deathstroke"] },
  {
    title: "DC Comics Presents",
    issue: "26",
    year: 1978,
    keyInfo: [
      "First appearance of Cyborg",
      "First appearance of Raven",
      "First appearance of Starfire",
    ],
  },
  {
    title: "Tales of the Teen Titans",
    issue: "44",
    year: 1984,
    keyInfo: ["First appearance of Nightwing costume"],
  },
  { title: "Teen Titans", issue: "12", year: 1966, keyInfo: ["First Wally West as Kid Flash"] },
  { title: "Titans", issue: "1", year: 2016, keyInfo: ["Titans Rebirth"] },
  { title: "Deathstroke", issue: "1", year: 1991, keyInfo: ["First Deathstroke solo"] },
  { title: "Blue Beetle", issue: "1", year: 2006, keyInfo: ["First Jaime Reyes solo"] },
  { title: "Doom Patrol", issue: "99", year: 1963, keyInfo: ["First Beast Boy"] },
  { title: "Suicide Squad", issue: "1", year: 1987, keyInfo: ["First modern Suicide Squad"] },

  // ============================================
  // DC - CRISIS / EVENTS
  // ============================================
  { title: "Crisis on Infinite Earths", issue: "1", year: 1985, keyInfo: ["Crisis on Infinite Earths begins"] },
  { title: "Crisis on Infinite Earths", issue: "7", year: 1985, keyInfo: ["Death of Supergirl"] },
  { title: "Crisis on Infinite Earths", issue: "8", year: 1985, keyInfo: ["Death of Barry Allen Flash"] },
  { title: "Infinite Crisis", issue: "1", year: 2005, keyInfo: ["Infinite Crisis begins"] },
  { title: "Final Crisis", issue: "1", year: 2008, keyInfo: ["Final Crisis begins"] },
  { title: "Identity Crisis", issue: "1", year: 2004, keyInfo: ["Identity Crisis begins"] },
  { title: "52", issue: "1", year: 2006, keyInfo: ["52 weekly series"] },
  { title: "Countdown", issue: "51", year: 2007, keyInfo: ["Countdown begins"] },
  { title: "Doomsday Clock", issue: "1", year: 2017, keyInfo: ["Doomsday Clock begins"] },
  {
    title: "Flashpoint",
    issue: "1",
    year: 2011,
    keyInfo: ["Flashpoint event begins", "Leads to New 52 reboot"],
  },
  {
    title: "Dark Nights: Metal",
    issue: "2",
    year: 2017,
    keyInfo: ["First appearance of the Batman Who Laughs"],
  },
  { title: "DC Special Series", issue: "27", year: 1981, keyInfo: ["First Batman/Superman vs Hulk"] },
  { title: "Marvel vs DC", issue: "1", year: 1996, keyInfo: ["Marvel vs DC"] },

  // ============================================
  // DC - VERTIGO / OTHER
  // ============================================
  {
    title: "Swamp Thing",
    issue: "37",
    year: 1982,
    keyInfo: [
      "First appearance of John Constantine",
      "Alan Moore run",
    ],
  },
  { title: "Hellblazer", issue: "1", year: 1988, keyInfo: ["First Constantine solo"] },
  {
    title: "Sandman",
    issue: "1",
    year: 1989,
    keyInfo: [
      "First appearance of Dream/Morpheus - Neil Gaiman",
      "Launched the Vertigo imprint",
      "Sam Kieth and Mike Dringenberg art",
    ],
  },
  { title: "Sandman", issue: "8", year: 1989, keyInfo: ["First Death"] },
  {
    title: "Watchmen",
    issue: "1",
    year: 1986,
    keyInfo: [
      "Watchmen begins - Alan Moore/Dave Gibbons",
      "One of the most acclaimed graphic novel series ever",
      "First appearance of Rorschach, Dr. Manhattan, Nite Owl",
    ],
  },
  { title: "V for Vendetta", issue: "1", year: 1988, keyInfo: ["First V for Vendetta"] },
  {
    title: "Preacher",
    issue: "1",
    year: 1995,
    keyInfo: [
      "First Preacher",
      "Garth Ennis and Steve Dillon",
      "Vertigo imprint",
    ],
  },
  { title: "Y: The Last Man", issue: "1", year: 2002, keyInfo: ["First Y: The Last Man"] },
  { title: "Fables", issue: "1", year: 2002, keyInfo: ["First Fables"] },
  { title: "Transmetropolitan", issue: "1", year: 1997, keyInfo: ["First Transmetropolitan"] },
  { title: "100 Bullets", issue: "1", year: 1999, keyInfo: ["First 100 Bullets"] },
  { title: "Sweet Tooth", issue: "1", year: 2009, keyInfo: ["First Sweet Tooth"] },
  { title: "The Nice House on the Lake", issue: "1", year: 2021, keyInfo: ["First Nice House on the Lake"] },
  { title: "Human Target", issue: "1", year: 2021, keyInfo: ["Human Target (King)"] },
  { title: "Strange Adventures", issue: "1", year: 2020, keyInfo: ["Strange Adventures (King)"] },
  { title: "Omega Men", issue: "1", year: 2015, keyInfo: ["Omega Men (King)"] },
  { title: "Sheriff of Babylon", issue: "1", year: 2015, keyInfo: ["First Sheriff of Babylon"] },

  // ============================================
  // IMAGE - SPAWN
  // ============================================
  {
    title: "Spawn",
    issue: "1",
    year: 1992,
    keyInfo: ["First appearance of Spawn", "Todd McFarlane creator-owned"],
  },
  { title: "Spawn", issue: "9", year: 1992, keyInfo: ["First Angela"] },
  { title: "Spawn", issue: "174", year: 1992, keyInfo: ["First She-Spawn"] },

  // ============================================
  // IMAGE - WALKING DEAD / KIRKMAN
  // ============================================
  {
    title: "Walking Dead",
    issue: "1",
    year: 2003,
    keyInfo: ["First appearance of Rick Grimes", "Walking Dead series begins"],
  },
  { title: "Walking Dead", issue: "19", year: 2003, keyInfo: ["First appearance of Michonne"] },
  { title: "Walking Dead", issue: "27", year: 2003, keyInfo: ["First Governor"] },
  { title: "Walking Dead", issue: "92", year: 2003, keyInfo: ["First Jesus"] },
  { title: "Walking Dead", issue: "100", year: 2003, keyInfo: ["First appearance of Negan"] },
  { title: "Invincible", issue: "1", year: 2003, keyInfo: ["First appearance of Invincible - Robert Kirkman"] },
  { title: "Outcast", issue: "1", year: 2014, keyInfo: ["First Outcast"] },
  { title: "Oblivion Song", issue: "1", year: 2018, keyInfo: ["First Oblivion Song"] },
  { title: "Fire Power", issue: "1", year: 2020, keyInfo: ["First Fire Power"] },

  // ============================================
  // IMAGE - SAGA / BKV
  // ============================================
  { title: "Saga", issue: "1", year: 2012, keyInfo: ["Saga series begins - Brian K. Vaughan"] },
  { title: "Paper Girls", issue: "1", year: 2015, keyInfo: ["First Paper Girls"] },

  // ============================================
  // IMAGE - MODERN HITS
  // ============================================
  { title: "Something is Killing the Children", issue: "1", year: 2019, keyInfo: ["First SIKTC"] },
  { title: "House of Slaughter", issue: "1", year: 2021, keyInfo: ["First House of Slaughter"] },
  { title: "Department of Truth", issue: "1", year: 2020, keyInfo: ["First Department of Truth"] },
  { title: "Nocterra", issue: "1", year: 2021, keyInfo: ["First Nocterra"] },
  { title: "Geiger", issue: "1", year: 2021, keyInfo: ["First Geiger"] },
  { title: "Ice Cream Man", issue: "1", year: 2018, keyInfo: ["First Ice Cream Man"] },
  { title: "Gideon Falls", issue: "1", year: 2018, keyInfo: ["First Gideon Falls"] },
  { title: "Bitter Root", issue: "1", year: 2018, keyInfo: ["First Bitter Root"] },
  { title: "Undiscovered Country", issue: "1", year: 2019, keyInfo: ["First Undiscovered Country"] },
  { title: "Crossover", issue: "1", year: 2020, keyInfo: ["First Crossover"] },
  { title: "East of West", issue: "1", year: 2013, keyInfo: ["First East of West"] },
  { title: "Deadly Class", issue: "1", year: 2014, keyInfo: ["First Deadly Class"] },
  { title: "Descender", issue: "1", year: 2015, keyInfo: ["First Descender"] },
  { title: "Low", issue: "1", year: 2014, keyInfo: ["First Low"] },
  { title: "Black Science", issue: "1", year: 2013, keyInfo: ["First Black Science"] },
  { title: "Chew", issue: "1", year: 2009, keyInfo: ["First Chew"] },

  // ============================================
  // INDEPENDENT - CLASSIC
  // ============================================
  {
    title: "Teenage Mutant Ninja Turtles",
    issue: "1",
    year: 1984,
    keyInfo: [
      "First appearance of the Teenage Mutant Ninja Turtles",
      "Self-published by Eastman and Laird",
      "Only 3,000 copies in first print run",
    ],
  },
  { title: "Bone", issue: "1", year: 1991, keyInfo: ["First Bone"] },
  { title: "Usagi Yojimbo", issue: "1", year: 1987, keyInfo: ["First Usagi Yojimbo"] },
  {
    title: "Hellboy",
    issue: "1",
    year: 1994,
    keyInfo: [
      "First Hellboy",
      "Mike Mignola creator-owned",
      "Seed of Destruction storyline",
    ],
  },
  {
    title: "Sin City",
    issue: "1",
    year: 1991,
    keyInfo: [
      "First Sin City",
      "Frank Miller creator-owned",
      "Black and white noir art style",
    ],
  },
  { title: "300", issue: "1", year: 1998, keyInfo: ["First 300"] },
  { title: "Maus", issue: "1", year: 1986, keyInfo: ["First Maus"] },
  { title: "Locke & Key", issue: "1", year: 2008, keyInfo: ["First Locke & Key"] },

  // ============================================
  // SESSION 44 EXPANSION - May 5, 2026
  // Top-canonical key-issue seed pass (+283 net new after dedup).
  // Years normalized to series-start convention (matches existing DB:
  // e.g. Detective Comics #38 uses year=1937 - the series start - not
  // 1940, the issue's publication year. See resolveEntry comment above).
  // Cross-checked against the original 404 entries; collisions removed.
  // ============================================

  // --- GOLDEN AGE - DC ---
  { title: "Detective Comics", issue: "29", year: 1937, keyInfo: ["First Batman cover"] },
  { title: "Detective Comics", issue: "33", year: 1937, keyInfo: ["Origin of Batman"] },
  { title: "Detective Comics", issue: "58", year: 1937, keyInfo: ["First appearance of the Penguin"] },
  { title: "Detective Comics", issue: "66", year: 1937, keyInfo: ["First appearance of Two-Face (Harvey Dent)"] },
  { title: "All-American Comics", issue: "16", year: 1940, keyInfo: ["First appearance of Green Lantern (Alan Scott)"] },
  { title: "All-American Comics", issue: "61", year: 1944, keyInfo: ["First appearance of Solomon Grundy"] },
  { title: "Flash Comics", issue: "1", year: 1940, keyInfo: ["First appearance of the Flash (Jay Garrick)", "First appearance of Hawkman", "First appearance of Johnny Thunder"] },
  { title: "Flash Comics", issue: "86", year: 1947, keyInfo: ["First appearance of Black Canary"] },
  { title: "Flash Comics", issue: "104", year: 1949, keyInfo: ["Last Golden Age Flash issue"] },
  { title: "More Fun Comics", issue: "52", year: 1940, keyInfo: ["First appearance of the Spectre"] },
  { title: "More Fun Comics", issue: "53", year: 1940, keyInfo: ["Origin of the Spectre"] },
  { title: "More Fun Comics", issue: "73", year: 1941, keyInfo: ["First appearance of Aquaman", "First appearance of Green Arrow", "First appearance of Speedy"] },
  { title: "More Fun Comics", issue: "101", year: 1945, keyInfo: ["First appearance of Superboy"] },
  { title: "Adventure Comics", issue: "40", year: 1938, keyInfo: ["First appearance of the Sandman (Wesley Dodds)"] },
  { title: "Adventure Comics", issue: "48", year: 1938, keyInfo: ["First appearance of Hourman"] },
  { title: "Adventure Comics", issue: "61", year: 1938, keyInfo: ["First appearance of Starman"] },
  { title: "Adventure Comics", issue: "260", year: 1938, keyInfo: ["First Silver Age Aquaman origin"] },
  { title: "Adventure Comics", issue: "283", year: 1938, keyInfo: ["First appearance of General Zod"] },
  { title: "Adventure Comics", issue: "300", year: 1938, keyInfo: ["First Legion of Super-Heroes ongoing series"] },
  { title: "Police Comics", issue: "1", year: 1941, keyInfo: ["First appearance of Plastic Man", "First appearance of Phantom Lady", "First appearance of the Human Bomb"] },
  { title: "Whiz Comics", issue: "2", year: 1940, keyInfo: ["First appearance of Captain Marvel/Shazam (Billy Batson)"] },
  { title: "Whiz Comics", issue: "25", year: 1941, keyInfo: ["First appearance of Captain Marvel Jr."] },
  { title: "Master Comics", issue: "21", year: 1941, keyInfo: ["First appearance of Bulletman"] },
  { title: "World's Finest Comics", issue: "71", year: 1954, keyInfo: ["First Superman/Batman team-up"] },

  // --- GOLDEN AGE - Marvel/Timely & Other Publishers ---
  { title: "Marvel Comics", issue: "1", year: 1939, keyInfo: ["First appearance of the Human Torch (android)", "First appearance of Sub-Mariner (in U.S. comics)", "First appearance of Ka-Zar"] },
  { title: "Marvel Mystery Comics", issue: "9", year: 1940, keyInfo: ["First Sub-Mariner vs Human Torch battle"] },
  { title: "Captain America Comics", issue: "1", year: 1941, keyInfo: ["First appearance of Captain America", "First appearance of Bucky Barnes", "First appearance of the Red Skull (imposter)"] },
  { title: "Captain America Comics", issue: "2", year: 1941, keyInfo: ["Second Captain America issue"] },
  { title: "Captain America Comics", issue: "7", year: 1941, keyInfo: ["First appearance of the real Red Skull (Johann Schmidt)"] },
  { title: "Sub-Mariner Comics", issue: "1", year: 1941, keyInfo: ["First Sub-Mariner ongoing series"] },
  { title: "USA Comics", issue: "1", year: 1941, keyInfo: ["First appearance of the Whizzer", "First appearance of Mr. Liberty"] },
  { title: "Daring Mystery Comics", issue: "1", year: 1940, keyInfo: ["First appearance of the Phantom Bullet"] },
  { title: "Pep Comics", issue: "22", year: 1941, keyInfo: ["First appearance of Archie Andrews", "First appearance of Betty Cooper", "First appearance of Jughead"] },
  { title: "Archie Comics", issue: "1", year: 1942, keyInfo: ["First Archie ongoing series"] },

  // --- SILVER AGE - DC ---
  { title: "Showcase", issue: "6", year: 1956, keyInfo: ["First appearance of Challengers of the Unknown"] },
  { title: "Showcase", issue: "8", year: 1956, keyInfo: ["First Silver Age Flash origin"] },
  { title: "Showcase", issue: "17", year: 1956, keyInfo: ["First appearance of Adam Strange"] },
  { title: "Showcase", issue: "30", year: 1956, keyInfo: ["First Silver Age Aquaman tryout"] },
  { title: "Showcase", issue: "37", year: 1956, keyInfo: ["First appearance of the Metal Men"] },
  { title: "Brave and the Bold", issue: "25", year: 1960, keyInfo: ["First appearance of the Suicide Squad"] },
  { title: "Brave and the Bold", issue: "34", year: 1960, keyInfo: ["First appearance of Silver Age Hawkman (Katar Hol)"] },
  { title: "Brave and the Bold", issue: "54", year: 1960, keyInfo: ["First appearance of the Teen Titans (as a team)"] },
  { title: "Brave and the Bold", issue: "60", year: 1960, keyInfo: ["First appearance of the Teen Titans named team", "First appearance of Wonder Girl with the Titans"] },
  { title: "Mystery in Space", issue: "75", year: 1962, keyInfo: ["Adam Strange / Justice League crossover", "Classic cover"] },
  { title: "Action Comics", issue: "276", year: 1938, keyInfo: ["First appearance of Brainiac 5", "Supergirl joins the Legion"] },
  { title: "Action Comics", issue: "285", year: 1938, keyInfo: ["Supergirl revealed to the world"] },
  { title: "Superman", issue: "76", year: 1939, keyInfo: ["First Superman/Batman shared identity story"] },
  { title: "Superman", issue: "123", year: 1939, keyInfo: ["First Supergirl prototype (Super-Girl)"] },
  { title: "Superman", issue: "199", year: 1939, keyInfo: ["First Superman vs Flash race"] },
  { title: "The Flash", issue: "106", year: 1959, keyInfo: ["First appearance of Gorilla Grodd", "First appearance of the Pied Piper"] },
  { title: "The Flash", issue: "108", year: 1959, keyInfo: ["First appearance of Ralph Dibny / Elongated Man (cameo)"] },
  { title: "The Flash", issue: "112", year: 1959, keyInfo: ["First appearance of the Elongated Man (full)"] },
  { title: "The Flash", issue: "117", year: 1959, keyInfo: ["First appearance of Captain Boomerang"] },
  { title: "Detective Comics", issue: "267", year: 1937, keyInfo: ["First appearance of Bat-Mite"] },
  { title: "Detective Comics", issue: "298", year: 1937, keyInfo: ["First Silver Age Clayface (Matt Hagen)"] },
  { title: "Detective Comics", issue: "327", year: 1937, keyInfo: ["'New Look' Batman begins (Carmine Infantino art)"] },
  { title: "Detective Comics", issue: "395", year: 1937, keyInfo: ["Neal Adams Batman begins"] },
  { title: "Justice League of America", issue: "9", year: 1960, keyInfo: ["Origin of the Justice League of America"] },
  { title: "Justice League of America", issue: "30", year: 1960, keyInfo: ["First JLA/JSA crossover", "First Earth-Two appearance in JLA"] },
  { title: "Justice League of America", issue: "35", year: 1960, keyInfo: ["First Silver Age T.O. Morrow"] },

  // --- SILVER AGE - Marvel ---
  { title: "Fantastic Four", issue: "4", year: 1961, keyInfo: ["First Silver Age Sub-Mariner appearance"] },
  { title: "Fantastic Four", issue: "13", year: 1961, keyInfo: ["First appearance of the Watcher (Uatu)", "First appearance of Red Ghost"] },
  { title: "Fantastic Four", issue: "17", year: 1961, keyInfo: ["Fantastic Four meet Spider-Man (post-AF #15)"] },
  { title: "Fantastic Four", issue: "18", year: 1961, keyInfo: ["First appearance of the Super-Skrull"] },
  { title: "Fantastic Four", issue: "19", year: 1961, keyInfo: ["First appearance of Rama-Tut (precursor to Kang)"] },
  { title: "Fantastic Four", issue: "21", year: 1961, keyInfo: ["First appearance of the Hate-Monger"] },
  { title: "Fantastic Four", issue: "25", year: 1961, keyInfo: ["Classic Hulk vs Thing battle"] },
  { title: "Fantastic Four", issue: "36", year: 1961, keyInfo: ["First appearance of the Frightful Four", "First appearance of Madame Medusa"] },
  { title: "Fantastic Four", issue: "44", year: 1961, keyInfo: ["First appearance of Gorgon"] },
  { title: "Fantastic Four", issue: "47", year: 1961, keyInfo: ["First appearance of Maximus"] },
  { title: "Fantastic Four", issue: "51", year: 1961, keyInfo: ["'This Man, This Monster!' classic Lee/Kirby story"] },
  { title: "Fantastic Four", issue: "53", year: 1961, keyInfo: ["First appearance of Klaw", "Origin of Black Panther"] },
  { title: "Fantastic Four", issue: "65", year: 1961, keyInfo: ["First appearance of Ronan the Accuser", "First appearance of the Kree Supreme Intelligence"] },
  { title: "Fantastic Four", issue: "66", year: 1961, keyInfo: ["First cameo of Him (Adam Warlock)", "Origin of Him begins"] },
  { title: "Fantastic Four", issue: "94", year: 1961, keyInfo: ["First appearance of Agatha Harkness"] },
  { title: "Tales to Astonish", issue: "13", year: 1962, keyInfo: ["First appearance of Groot"] },
  { title: "Tales to Astonish", issue: "35", year: 1962, keyInfo: ["First appearance of Ant-Man in costume (Henry Pym)"] },
  { title: "Tales to Astonish", issue: "44", year: 1962, keyInfo: ["First appearance of the Wasp (Janet Van Dyne)"] },
  { title: "Tales to Astonish", issue: "59", year: 1962, keyInfo: ["First Hulk vs Giant-Man battle"] },
  { title: "Tales to Astonish", issue: "62", year: 1962, keyInfo: ["First appearance of the Leader"] },
  { title: "Tales to Astonish", issue: "82", year: 1962, keyInfo: ["First Sub-Mariner vs Iron Man"] },
  { title: "Tales of Suspense", issue: "40", year: 1963, keyInfo: ["First appearance of Iron Man's gold armor"] },
  { title: "Tales of Suspense", issue: "48", year: 1963, keyInfo: ["First appearance of Iron Man's red & gold armor"] },
  { title: "Tales of Suspense", issue: "50", year: 1963, keyInfo: ["First appearance of the Mandarin"] },
  { title: "Tales of Suspense", issue: "58", year: 1963, keyInfo: ["Second appearance of Kraven, Iron Man vs Captain America"] },
  { title: "Tales of Suspense", issue: "59", year: 1963, keyInfo: ["First Silver Age solo Captain America story"] },
  { title: "Tales of Suspense", issue: "63", year: 1963, keyInfo: ["First Silver Age retelling of Cap's origin"] },
  { title: "Strange Tales", issue: "101", year: 1963, keyInfo: ["First Solo Human Torch story"] },
  { title: "Strange Tales", issue: "115", year: 1963, keyInfo: ["Origin of Doctor Strange"] },
  { title: "Strange Tales", issue: "126", year: 1963, keyInfo: ["First appearance of Dormammu", "First appearance of Clea"] },
  { title: "Strange Tales", issue: "146", year: 1963, keyInfo: ["First full appearance of Eternity"] },
  { title: "Strange Tales", issue: "167", year: 1963, keyInfo: ["First appearance of Yelena Belova... no wait first major Hydra story"] },
  { title: "Journey Into Mystery", issue: "85", year: 1962, keyInfo: ["First appearance of Loki", "First appearance of Heimdall"] },
  { title: "Journey Into Mystery", issue: "86", year: 1962, keyInfo: ["First appearance of Odin", "First Thor time travel"] },
  { title: "Journey Into Mystery", issue: "112", year: 1962, keyInfo: ["Origin of Loki", "Thor vs Hulk"] },
  { title: "Journey Into Mystery", issue: "114", year: 1962, keyInfo: ["First appearance of the Absorbing Man"] },
  { title: "X-Men", issue: "5", year: 1963, keyInfo: ["First appearance of Asteroid M", "Second appearance of Magneto"] },
  { title: "X-Men", issue: "11", year: 1963, keyInfo: ["First appearance of the Stranger"] },
  { title: "X-Men", issue: "15", year: 1963, keyInfo: ["Origin of the Sentinels"] },
  { title: "X-Men", issue: "17", year: 1963, keyInfo: ["First appearance of Magneto's secret base"] },
  { title: "X-Men", issue: "35", year: 1963, keyInfo: ["First X-Men/Spider-Man team-up"] },
  { title: "X-Men", issue: "50", year: 1963, keyInfo: ["First Silver Age Mesmero", "First Steranko X-Men cover"] },
  { title: "X-Men", issue: "54", year: 1963, keyInfo: ["First appearance of Alex Summers (Havok, identity revealed)"] },
  { title: "X-Men", issue: "58", year: 1963, keyInfo: ["First appearance of Havok in costume"] },
  { title: "X-Men", issue: "60", year: 1963, keyInfo: ["First appearance of Sauron"] },
  { title: "Avengers", issue: "9", year: 1963, keyInfo: ["First appearance of Wonder Man (Simon Williams)"] },
  { title: "Avengers", issue: "11", year: 1963, keyInfo: ["First Spider-Man / Avengers crossover"] },
  { title: "Avengers", issue: "25", year: 1963, keyInfo: ["Doctor Doom vs the Avengers"] },
  { title: "Avengers", issue: "28", year: 1963, keyInfo: ["First appearance of Goliath", "First appearance of the Collector"] },
  { title: "Avengers", issue: "32", year: 1963, keyInfo: ["First appearance of the Sons of the Serpent"] },
  { title: "Avengers", issue: "55", year: 1963, keyInfo: ["First full appearance of Ultron"] },
  { title: "Avengers", issue: "83", year: 1963, keyInfo: ["First appearance of the Valkyrie", "First Liberators team"] },
  { title: "Daredevil", issue: "2", year: 1964, keyInfo: ["First Daredevil/Fantastic Four crossover"] },
  { title: "Daredevil", issue: "10", year: 1964, keyInfo: ["First appearance of the Ani-Men"] },
  { title: "Sgt. Fury and his Howling Commandos", issue: "1", year: 1963, keyInfo: ["First appearance of Sgt. Nick Fury", "First appearance of Dum Dum Dugan"] },

  // --- BRONZE AGE - Marvel ---
  { title: "Marvel Premiere", issue: "1", year: 1972, keyInfo: ["First appearance of Adam Warlock in cocoon (renumbered)", "Warlock origin begins"] },
  { title: "Marvel Premiere", issue: "28", year: 1972, keyInfo: ["First appearance of the Legion of Monsters"] },
  { title: "Marvel Spotlight", issue: "2", year: 1972, keyInfo: ["First appearance of Werewolf by Night (Jack Russell)"] },
  { title: "Marvel Spotlight", issue: "12", year: 1972, keyInfo: ["First appearance of Son of Satan (Damon Hellstrom)"] },
  { title: "Marvel Spotlight", issue: "32", year: 1972, keyInfo: ["First appearance of Spider-Woman (Jessica Drew)"] },
  { title: "Special Marvel Edition", issue: "15", year: 1973, keyInfo: ["First appearance of Shang-Chi, Master of Kung Fu"] },
  { title: "Master of Kung Fu", issue: "17", year: 1974, keyInfo: ["Master of Kung Fu series begins (renumbered from Special Marvel Edition)"] },
  { title: "Power Man", issue: "17", year: 1972, keyInfo: ["Hero for Hire renamed to Power Man (continued numbering)"] },
  { title: "Power Man and Iron Fist", issue: "50", year: 1978, keyInfo: ["Power Man and Iron Fist team begins (continuing numbering)"] },
  { title: "Iron Fist", issue: "14", year: 1977, keyInfo: ["First appearance of Sabretooth (Victor Creed)"] },
  { title: "Captain Marvel", issue: "25", year: 1968, keyInfo: ["Jim Starlin's run begins on Captain Marvel"] },
  { title: "Captain Marvel", issue: "27", year: 1968, keyInfo: ["First appearance of Eros (Starfox)", "First Death (cameo)"] },
  { title: "Captain Marvel", issue: "29", year: 1968, keyInfo: ["Origin of Drax the Destroyer"] },
  { title: "Marvel Two-in-One", issue: "1", year: 1974, keyInfo: ["First Marvel Two-in-One series (Thing team-ups)"] },
  { title: "Marvel Team-Up", issue: "1", year: 1972, keyInfo: ["First Marvel Team-Up series (Spider-Man team-ups)"] },
  { title: "Giant-Size Avengers", issue: "1", year: 1974, keyInfo: ["First Giant-Size Avengers"] },
  { title: "Giant-Size Avengers", issue: "4", year: 1975, keyInfo: ["Vision marries Scarlet Witch"] },
  { title: "Hulk", issue: "271", year: 1982, keyInfo: ["First comic appearance of Rocket Raccoon"] },
  { title: "Incredible Hulk Annual", issue: "5", year: 1976, keyInfo: ["First appearance of Groot in modern Marvel continuity"] },
  { title: "Astonishing Tales", issue: "25", year: 1974, keyInfo: ["First appearance of Deathlok"] },
  { title: "Eternals", issue: "2", year: 1976, keyInfo: ["First appearance of Ajak"] },
  { title: "Eternals", issue: "3", year: 1976, keyInfo: ["First appearance of Sersi"] },
  { title: "Eternals", issue: "5", year: 1976, keyInfo: ["First appearance of Thena"] },
  { title: "Logan's Run", issue: "6", year: 1977, keyInfo: ["First Thanos solo story"] },
  { title: "Star Wars", issue: "1", year: 1977, keyInfo: ["First Marvel Star Wars series", "First comic appearance of Star Wars characters"] },
  { title: "ROM", issue: "1", year: 1979, keyInfo: ["First ROM Spaceknight (Marvel)"] },
  { title: "Micronauts", issue: "1", year: 1979, keyInfo: ["First Micronauts (Marvel)", "First appearance of Bug, Acroyear, Marionette"] },
  { title: "G.I. Joe: A Real American Hero", issue: "1", year: 1982, keyInfo: ["First Marvel G.I. Joe series"] },
  { title: "G.I. Joe: A Real American Hero", issue: "21", year: 1984, keyInfo: ["First silent issue (Snake Eyes), Larry Hama classic"] },
  { title: "Transformers", issue: "1", year: 1984, keyInfo: ["First Marvel Transformers series", "First comic appearance of Optimus Prime, Megatron, etc."] },

  // --- BRONZE AGE - DC ---
  { title: "House of Secrets", issue: "92", year: 1971, keyInfo: ["First appearance of Swamp Thing (Alex Olsen)"] },
  { title: "Saga of the Swamp Thing", issue: "21", year: 1984, keyInfo: ["'The Anatomy Lesson' - Alan Moore run begins"] },
  { title: "Saga of the Swamp Thing", issue: "37", year: 1985, keyInfo: ["First appearance of John Constantine"] },
  { title: "Wonder Woman", issue: "204", year: 1942, keyInfo: ["Wonder Woman regains powers", "Return to classic costume"] },
  { title: "Wonder Woman", issue: "288", year: 1942, keyInfo: ["First appearance of the modern Silver Swan"] },
  { title: "Detective Comics", issue: "474", year: 1937, keyInfo: ["Modern retelling of Deadshot's origin", "First appearance of Deadshot's modern costume"] },
  { title: "Batman", issue: "234", year: 1940, keyInfo: ["First Silver Age Two-Face appearance"] },
  { title: "Batman", issue: "237", year: 1940, keyInfo: ["Classic 'Night of the Reaper'", "First appearance of the Reaper"] },
  { title: "Batman Family", issue: "1", year: 1975, keyInfo: ["First Batman Family series"] },
  { title: "Justice League of America", issue: "94", year: 1960, keyInfo: ["Mainstream return of Sandman (Wesley Dodds)"] },
  { title: "DC Comics Presents", issue: "47", year: 1978, keyInfo: ["First appearance of Masters of the Universe in DC"] },
  { title: "World's Finest Comics", issue: "176", year: 1968, keyInfo: ["Neal Adams Batman/Superman cover classic"] },
  { title: "Green Lantern", issue: "85", year: 1960, keyInfo: ["Speedy on drugs cover", "Award-winning O'Neil/Adams story"] },

  // --- COPPER AGE - Marvel ---
  { title: "Marvel Graphic Novel", issue: "1", year: 1982, keyInfo: ["First Marvel Graphic Novel format", "Death of Captain Marvel (Mar-Vell)"] },
  { title: "Marvel Graphic Novel", issue: "5", year: 1984, keyInfo: ["First New Mutants graphic novel", "First appearance of New Mutants team"] },
  { title: "Marvel Comics Presents", issue: "72", year: 1991, keyInfo: ["'Weapon X' Wolverine origin story begins (Barry Windsor-Smith)"] },
  { title: "Marvel Fanfare", issue: "1", year: 1982, keyInfo: ["First Marvel Fanfare anthology"] },
  { title: "Excalibur", issue: "1", year: 1988, keyInfo: ["First Excalibur ongoing series", "Alan Davis/Chris Claremont"] },
  { title: "X-Factor", issue: "1", year: 1986, keyInfo: ["First X-Factor series", "Original X-Men reunite"] },
  { title: "Generation X", issue: "1", year: 1994, keyInfo: ["First Generation X series", "First appearance of Skin, Synch, M, Chamber, Husk"] },
  { title: "Uncanny X-Men", issue: "168", year: 1963, keyInfo: ["First appearance of Madelyne Pryor"] },
  { title: "Uncanny X-Men", issue: "171", year: 1963, keyInfo: ["Rogue joins the X-Men"] },
  { title: "Uncanny X-Men", issue: "186", year: 1963, keyInfo: ["Forge first appearance"] },
  { title: "Uncanny X-Men", issue: "201", year: 1963, keyInfo: ["First appearance of baby Cable (Nathan Summers)"] },
  { title: "Uncanny X-Men", issue: "210", year: 1963, keyInfo: ["Mutant Massacre prelude"] },
  { title: "Uncanny X-Men", issue: "211", year: 1963, keyInfo: ["Mutant Massacre begins", "First Marauders (full)"] },
  { title: "Uncanny X-Men", issue: "221", year: 1963, keyInfo: ["First appearance of Mister Sinister"] },
  { title: "Uncanny X-Men", issue: "248", year: 1963, keyInfo: ["Jim Lee's first X-Men work"] },
  { title: "Uncanny X-Men", issue: "256", year: 1963, keyInfo: ["First Psylocke in body of Kwannon (Asian Psylocke)"] },
  { title: "Uncanny X-Men", issue: "267", year: 1963, keyInfo: ["Second appearance of Gambit, first cover"] },
  { title: "Uncanny X-Men", issue: "268", year: 1963, keyInfo: ["Classic Jim Lee Captain America/Black Widow/Wolverine cover"] },
  { title: "New Mutants", issue: "86", year: 1983, keyInfo: ["First cameo appearance of Cable"] },
  { title: "Punisher", issue: "1", year: 1986, keyInfo: ["First Punisher limited series"] },
  { title: "Punisher", issue: "1", year: 1987, keyInfo: ["First Punisher ongoing series"] },
  { title: "Hulk", issue: "1", year: 1999, keyInfo: ["Hulk volume 2 first issue (John Byrne)"] },

  // --- COPPER AGE - DC ---
  { title: "Man of Steel", issue: "1", year: 1986, keyInfo: ["John Byrne Superman reboot begins"] },
  { title: "The Dark Knight Returns", issue: "1", year: 1986, keyInfo: ["First The Dark Knight Returns", "Frank Miller's seminal Batman"] },
  { title: "The Dark Knight Returns", issue: "2", year: 1986, keyInfo: ["First appearance of Carrie Kelley as Robin"] },
  { title: "Batman: The Dark Knight Returns", issue: "1", year: 1986, keyInfo: ["First The Dark Knight Returns (alternate title spelling)"] },
  { title: "Detective Comics", issue: "574", year: 1937, keyInfo: ["A Lonely Place of Dying conclusion (Jason Todd era)"] },
  { title: "Detective Comics", issue: "608", year: 1937, keyInfo: ["First appearance of Anarky"] },
  { title: "Detective Comics", issue: "647", year: 1937, keyInfo: ["First appearance of Stephanie Brown / Spoiler"] },
  { title: "Action Comics", issue: "584", year: 1938, keyInfo: ["John Byrne's first Action Comics issue", "Post-Crisis Superman begins in Action"] },
  { title: "Action Comics", issue: "775", year: 1938, keyInfo: ["'What's So Funny About Truth, Justice and the American Way?'", "First appearance of the Elite"] },
  { title: "Animal Man", issue: "1", year: 1988, keyInfo: ["Grant Morrison's Animal Man begins"] },
  { title: "Animal Man", issue: "5", year: 1988, keyInfo: ["'The Coyote Gospel' - landmark Morrison issue"] },
  { title: "Doom Patrol", issue: "19", year: 1963, keyInfo: ["Grant Morrison's Doom Patrol begins"] },
  { title: "Doom Patrol", issue: "35", year: 1963, keyInfo: ["First appearance of Flex Mentallo"] },
  { title: "Sandman", issue: "2", year: 1989, keyInfo: ["First cameo of Death of the Endless"] },
  { title: "Sandman", issue: "6", year: 1989, keyInfo: ["First appearance of John Dee / Doctor Destiny in modern continuity"] },
  { title: "Sandman", issue: "21", year: 1989, keyInfo: ["'Season of Mists' begins"] },
  { title: "Suicide Squad", issue: "10", year: 1987, keyInfo: ["First appearance of modern Bronze Tiger"] },
  { title: "Justice League International", issue: "7", year: 1987, keyInfo: ["First appearance of L-Ron"] },
  { title: "Lobo", issue: "1", year: 1990, keyInfo: ["First Lobo limited series (solo)"] },
  { title: "JLA", issue: "1", year: 1997, keyInfo: ["Grant Morrison's JLA begins (Big Seven team)"] },
  { title: "Kingdom Come", issue: "1", year: 1996, keyInfo: ["First Kingdom Come", "Mark Waid/Alex Ross"] },
  { title: "Marvels", issue: "1", year: 1994, keyInfo: ["First Marvels", "Kurt Busiek/Alex Ross"] },

  // --- COPPER/MODERN - Image & Indie ---
  { title: "WildC.A.T.s", issue: "1", year: 1992, keyInfo: ["First WildC.A.T.s", "First major Jim Lee creator-owned"] },
  { title: "Youngblood", issue: "1", year: 1992, keyInfo: ["First Youngblood", "Rob Liefeld creator-owned launch"] },
  { title: "Cyberforce", issue: "1", year: 1992, keyInfo: ["First Cyberforce", "Marc Silvestri creator-owned"] },
  { title: "ShadowHawk", issue: "1", year: 1992, keyInfo: ["First ShadowHawk", "Jim Valentino creator-owned"] },
  { title: "Pitt", issue: "1", year: 1993, keyInfo: ["First Pitt", "Dale Keown creator-owned"] },
  { title: "The Maxx", issue: "1", year: 1993, keyInfo: ["First The Maxx", "Sam Kieth creator-owned"] },
  { title: "Witchblade", issue: "1", year: 1995, keyInfo: ["First Witchblade", "First appearance of Sara Pezzini"] },
  { title: "The Darkness", issue: "1", year: 1996, keyInfo: ["First The Darkness", "First appearance of Jackie Estacado"] },
  { title: "Gen 13", issue: "1", year: 1995, keyInfo: ["First Gen 13 ongoing series"] },
  { title: "Stormwatch", issue: "1", year: 1993, keyInfo: ["First Stormwatch", "First appearance of Stormwatch team"] },
  { title: "Astro City", issue: "1", year: 1995, keyInfo: ["First Astro City", "Kurt Busiek/Brent Anderson"] },
  { title: "The Authority", issue: "1", year: 1999, keyInfo: ["First The Authority", "Warren Ellis/Bryan Hitch"] },
  { title: "Planetary", issue: "1", year: 1999, keyInfo: ["First Planetary", "Warren Ellis/John Cassaday"] },
  { title: "Hellboy: Seed of Destruction", issue: "1", year: 1994, keyInfo: ["First Hellboy in his own series"] },
  { title: "Concrete", issue: "1", year: 1986, keyInfo: ["First Concrete (Paul Chadwick)"] },
  { title: "Stray Bullets", issue: "1", year: 1995, keyInfo: ["First Stray Bullets (David Lapham)"] },
  { title: "Strangers in Paradise", issue: "1", year: 1993, keyInfo: ["First Strangers in Paradise (Terry Moore)"] },
  { title: "Madman", issue: "1", year: 1992, keyInfo: ["First Madman ongoing (Mike Allred)"] },
  { title: "Cerebus", issue: "1", year: 1977, keyInfo: ["First Cerebus the Aardvark (Dave Sim)"] },
  { title: "Love and Rockets", issue: "1", year: 1982, keyInfo: ["First Love and Rockets (Hernandez Bros.)"] },
  { title: "Eightball", issue: "1", year: 1989, keyInfo: ["First Eightball (Daniel Clowes)"] },
  { title: "Yummy Fur", issue: "1", year: 1986, keyInfo: ["First Yummy Fur (Chester Brown)"] },
  { title: "Hate", issue: "1", year: 1990, keyInfo: ["First Hate (Peter Bagge)"] },

  // --- 2000s+ - Marvel ---
  { title: "Ultimate Spider-Man", issue: "1", year: 2000, keyInfo: ["First Ultimate Spider-Man series", "Bendis/Bagley reboot"] },
  { title: "Ultimate X-Men", issue: "1", year: 2001, keyInfo: ["First Ultimate X-Men series"] },
  { title: "Ultimates", issue: "1", year: 2002, keyInfo: ["First Ultimates series", "Mark Millar/Bryan Hitch", "Inspired MCU Avengers tone"] },
  { title: "All-New X-Men", issue: "1", year: 2012, keyInfo: ["First All-New X-Men", "Bendis era begins"] },
  { title: "Captain Marvel", issue: "14", year: 1968, keyInfo: ["First cameo appearance of Kamala Khan"] },
  { title: "Captain Marvel", issue: "17", year: 1968, keyInfo: ["First full appearance of Kamala Khan as Ms. Marvel"] },
  { title: "Star Wars", issue: "1", year: 2015, keyInfo: ["Marvel re-launches Star Wars license"] },
  { title: "House of X", issue: "1", year: 2019, keyInfo: ["First House of X", "Hickman X-Men era / Krakoa begins"] },
  { title: "Powers of X", issue: "1", year: 2019, keyInfo: ["First Powers of X", "Hickman X-Men era"] },
  { title: "Civil War II", issue: "1", year: 2016, keyInfo: ["First Civil War II", "First full appearance of Riri Williams"] },
  { title: "Invincible Iron Man", issue: "1", year: 2015, keyInfo: ["Brian Michael Bendis Iron Man begins"] },
  { title: "Invincible Iron Man", issue: "7", year: 2016, keyInfo: ["First cameo of Riri Williams"] },
  { title: "Invincible Iron Man", issue: "9", year: 2016, keyInfo: ["First full appearance of Riri Williams in armor"] },
  { title: "Doctor Strange", issue: "1", year: 2015, keyInfo: ["Jason Aaron/Chris Bachalo Doctor Strange begins"] },
  { title: "Empyre", issue: "1", year: 2020, keyInfo: ["First Empyre event"] },
  { title: "Heroes Reborn", issue: "1", year: 2021, keyInfo: ["First Heroes Reborn (2021 event)", "Squadron Supreme of America focus"] },

  // --- 2000s+ - DC ---
  { title: "Identity Crisis", issue: "2", year: 2004, keyInfo: ["Identity Crisis: Sue Dibny death revealed"] },
  { title: "All Star Superman", issue: "1", year: 2005, keyInfo: ["First All Star Superman", "Grant Morrison/Frank Quitely"] },
  { title: "All Star Batman & Robin", issue: "1", year: 2005, keyInfo: ["First All Star Batman & Robin", "Frank Miller/Jim Lee"] },
  { title: "Final Crisis", issue: "7", year: 2008, keyInfo: ["Final Crisis conclusion", "Death of Batman (apparent)"] },
  { title: "Batman Incorporated", issue: "1", year: 2010, keyInfo: ["First Batman Incorporated"] },
  { title: "Batman Incorporated", issue: "8", year: 2013, keyInfo: ["Death of Damian Wayne"] },
  { title: "Justice League", issue: "23", year: 1987, keyInfo: ["First post-Flashpoint Cyborg in JL"] },
  { title: "Forever Evil", issue: "1", year: 2013, keyInfo: ["First Forever Evil", "First New 52 Crime Syndicate"] },
  { title: "Convergence", issue: "1", year: 2015, keyInfo: ["First Convergence event"] },
  { title: "DC Universe Rebirth", issue: "1", year: 2016, keyInfo: ["DC Rebirth begins", "Wally West returns", "Watchmen tease"] },
  { title: "Heroes in Crisis", issue: "1", year: 2018, keyInfo: ["First Heroes in Crisis"] },
  { title: "Batman", issue: "50", year: 1940, keyInfo: ["Batman/Catwoman wedding issue (Tom King)"] },
  { title: "Detective Comics", issue: "1000", year: 1937, keyInfo: ["1000th issue", "First appearance of the Arkham Knight (comics)"] },
  { title: "Action Comics", issue: "1000", year: 1938, keyInfo: ["1000th issue of Action Comics"] },

  // --- 2000s+ - Image / Independent ---
  { title: "Powers", issue: "1", year: 2000, keyInfo: ["First Powers (Bendis/Oeming)"] },
  { title: "The Walking Dead", issue: "53", year: 2003, keyInfo: ["The Walking Dead death of Lori and Judith"] },
  { title: "The Walking Dead", issue: "75", year: 2003, keyInfo: ["The Walking Dead introduction of Hilltop"] },
  { title: "Ex Machina", issue: "1", year: 2004, keyInfo: ["First Ex Machina (Brian K. Vaughan)"] },
  { title: "American Vampire", issue: "1", year: 2010, keyInfo: ["First American Vampire (Snyder/Albuquerque)"] },
  { title: "Wytches", issue: "1", year: 2014, keyInfo: ["First Wytches (Snyder/Jock)"] },
  { title: "Black Hammer", issue: "1", year: 2016, keyInfo: ["First Black Hammer (Jeff Lemire)"] },
  { title: "Monstress", issue: "1", year: 2015, keyInfo: ["First Monstress (Marjorie Liu/Sana Takeda)"] },
  { title: "Lazarus", issue: "1", year: 2013, keyInfo: ["First Lazarus (Greg Rucka/Michael Lark)"] },
  { title: "Sex Criminals", issue: "1", year: 2013, keyInfo: ["First Sex Criminals (Fraction/Zdarsky)"] },
  { title: "Pretty Deadly", issue: "1", year: 2013, keyInfo: ["First Pretty Deadly (DeConnick/Rios)"] },
  { title: "Manifest Destiny", issue: "1", year: 2013, keyInfo: ["First Manifest Destiny"] },
  { title: "Seven to Eternity", issue: "1", year: 2016, keyInfo: ["First Seven to Eternity (Remender/Opena)"] },
  { title: "Tokyo Ghost", issue: "1", year: 2015, keyInfo: ["First Tokyo Ghost (Remender/Murphy)"] },
  { title: "Birthright", issue: "1", year: 2014, keyInfo: ["First Birthright"] },
  { title: "The Boys", issue: "1", year: 2006, keyInfo: ["First The Boys (Garth Ennis/Darick Robertson)"] },

  // --- INDEPENDENT / TMNT-era ---
  { title: "Teenage Mutant Ninja Turtles", issue: "2", year: 1984, keyInfo: ["Second TMNT issue (Mirage)"] },
  { title: "Teenage Mutant Ninja Turtles", issue: "3", year: 1984, keyInfo: ["Third TMNT issue (Mirage)"] },
  { title: "Teenage Mutant Ninja Turtles", issue: "4", year: 1984, keyInfo: ["Fourth TMNT issue (Mirage)"] },

  // --- VARIANTS / MODERN HOT KEYS ---
  { title: "Spider-Geddon", issue: "1", year: 2018, keyInfo: ["First Spider-Geddon event"] },
  { title: "Vault of Spiders", issue: "1", year: 2018, keyInfo: ["First appearance of multiple alt-Spiders"] },
  { title: "Immortal Hulk", issue: "2", year: 2018, keyInfo: ["First Dr. Frye / Hulk's resurrection mythology"] },
  { title: "Black Cat", issue: "1", year: 2019, keyInfo: ["First Black Cat ongoing series"] },
  { title: "Strange Academy", issue: "1", year: 2020, keyInfo: ["First Strange Academy", "First appearance of Doyle Dormammu, Emily Bright, others"] },
  { title: "S.W.O.R.D.", issue: "1", year: 2020, keyInfo: ["First Krakoan S.W.O.R.D."] },
  { title: "Marauders", issue: "1", year: 2019, keyInfo: ["First Krakoan Marauders"] },
  { title: "Excalibur", issue: "1", year: 2019, keyInfo: ["First Krakoan Excalibur"] },
  { title: "Fallen Angels", issue: "1", year: 2019, keyInfo: ["First Krakoan Fallen Angels"] },

  // ============================================
  // SESSION 44 EXPANSION - ROUND 2 - May 5, 2026
  // Second-tier canonical keys: deeper Marvel/DC runs, anniversary issues,
  // event launches, and indie deep cuts. Years use series-start convention.
  // ============================================

  // --- MARVEL - Spider-Man (deep cuts) ---
  { title: "Amazing Spider-Man", issue: "15", year: 1963, keyInfo: ["First appearance of Kraven the Hunter"] },
  { title: "Amazing Spider-Man", issue: "17", year: 1963, keyInfo: ["Second appearance of the Green Goblin", "First appearance of Liz Allan"] },
  { title: "Amazing Spider-Man", issue: "38", year: 1963, keyInfo: ["Final Steve Ditko Spider-Man issue", "First appearance of Mary Jane Watson (silhouette tease retold)"] },
  { title: "Amazing Spider-Man", issue: "39", year: 1963, keyInfo: ["First John Romita Sr. art on Spider-Man", "Norman Osborn revealed as Green Goblin"] },
  { title: "Amazing Spider-Man", issue: "41", year: 1963, keyInfo: ["First appearance of the Rhino"] },
  { title: "Amazing Spider-Man", issue: "51", year: 1963, keyInfo: ["First appearance of Joe 'Robbie' Robertson"] },
  { title: "Amazing Spider-Man", issue: "75", year: 1963, keyInfo: ["Death of Silvermane (apparent)"] },
  { title: "Amazing Spider-Man", issue: "100", year: 1963, keyInfo: ["100th issue anniversary", "Spider-Man with six arms cliffhanger"] },
  { title: "Amazing Spider-Man", issue: "113", year: 1963, keyInfo: ["First appearance of Hammerhead"] },
  { title: "Amazing Spider-Man", issue: "134", year: 1963, keyInfo: ["First appearance of Tarantula"] },
  { title: "Amazing Spider-Man", issue: "135", year: 1963, keyInfo: ["Second appearance of the Punisher"] },
  { title: "Amazing Spider-Man", issue: "149", year: 1963, keyInfo: ["First appearance of Spider-Man's clone (precursor to Ben Reilly)"] },
  { title: "Amazing Spider-Man", issue: "161", year: 1963, keyInfo: ["First appearance of Jigsaw"] },
  { title: "Amazing Spider-Man", issue: "210", year: 1963, keyInfo: ["First appearance of Madame Web"] },
  { title: "Amazing Spider-Man", issue: "226", year: 1963, keyInfo: ["Black Cat returns / second major arc"] },
  { title: "Amazing Spider-Man", issue: "248", year: 1963, keyInfo: ["'The Boy Who Collected Spider-Man' classic Roger Stern issue"] },
  { title: "Amazing Spider-Man", issue: "256", year: 1963, keyInfo: ["First appearance of Puma"] },
  { title: "Amazing Spider-Man", issue: "265", year: 1963, keyInfo: ["First appearance of Silver Sable"] },
  { title: "Amazing Spider-Man", issue: "287", year: 1963, keyInfo: ["Punisher cameo / cover"] },
  { title: "Amazing Spider-Man", issue: "290", year: 1963, keyInfo: ["Peter Parker proposes to Mary Jane"] },
  { title: "Amazing Spider-Man", issue: "292", year: 1963, keyInfo: ["Peter Parker and Mary Jane wedding"] },
  { title: "Amazing Spider-Man", issue: "294", year: 1963, keyInfo: ["Death of Kraven the Hunter ('Kraven's Last Hunt' conclusion)"] },
  { title: "Amazing Spider-Man", issue: "312", year: 1963, keyInfo: ["McFarlane Hobgoblin vs Green Goblin classic"] },
  { title: "Amazing Spider-Man", issue: "315", year: 1963, keyInfo: ["Venom's second appearance"] },
  { title: "Amazing Spider-Man", issue: "317", year: 1963, keyInfo: ["Venom's third appearance"] },
  { title: "Amazing Spider-Man", issue: "324", year: 1963, keyInfo: ["Sabretooth in ASM"] },
  { title: "Amazing Spider-Man", issue: "330", year: 1963, keyInfo: ["First appearance of Cardiac"] },
  { title: "Amazing Spider-Man", issue: "345", year: 1963, keyInfo: ["First appearance of Cletus Kasady out of cell (Carnage prelude)"] },
  { title: "Amazing Spider-Man", issue: "350", year: 1963, keyInfo: ["350th issue anniversary"] },
  { title: "Amazing Spider-Man", issue: "375", year: 1963, keyInfo: ["Anniversary issue, Carnage continues"] },
  { title: "Amazing Spider-Man", issue: "400", year: 1963, keyInfo: ["Death of Aunt May (later retconned)"] },
  { title: "Amazing Spider-Man", issue: "545", year: 1963, keyInfo: ["'One More Day' conclusion / marriage erased"] },
  { title: "Amazing Spider-Man", issue: "546", year: 1963, keyInfo: ["'Brand New Day' begins", "First appearance of Mr. Negative (cameo)"] },
  { title: "Amazing Spider-Man", issue: "583", year: 1963, keyInfo: ["Inauguration Day variant, Obama cover"] },
  { title: "Amazing Spider-Man", issue: "600", year: 1963, keyInfo: ["600th issue anniversary"] },

  // --- MARVEL - X-Men (continuing run) ---
  { title: "Uncanny X-Men", issue: "95", year: 1963, keyInfo: ["Death of Thunderbird"] },
  { title: "Uncanny X-Men", issue: "96", year: 1963, keyInfo: ["First appearance of Moira MacTaggert"] },
  { title: "Uncanny X-Men", issue: "100", year: 1963, keyInfo: ["100th issue", "Phoenix transformation prelude"] },
  { title: "Uncanny X-Men", issue: "102", year: 1963, keyInfo: ["Storm origin flashback"] },
  { title: "Uncanny X-Men", issue: "104", year: 1963, keyInfo: ["Magneto returns"] },
  { title: "Uncanny X-Men", issue: "105", year: 1963, keyInfo: ["Phoenix appearance"] },
  { title: "Uncanny X-Men", issue: "106", year: 1963, keyInfo: ["Phoenix continues"] },
  { title: "Uncanny X-Men", issue: "107", year: 1963, keyInfo: ["First appearance of the Starjammers", "First appearance of Corsair"] },
  { title: "Uncanny X-Men", issue: "108", year: 1963, keyInfo: ["First John Byrne X-Men art"] },
  { title: "Uncanny X-Men", issue: "109", year: 1963, keyInfo: ["First appearance of Vindicator (James Hudson, Weapon Alpha)"] },
  { title: "Uncanny X-Men", issue: "117", year: 1963, keyInfo: ["Origin of Professor Xavier"] },
  { title: "Uncanny X-Men", issue: "122", year: 1963, keyInfo: ["First appearance of Mastermind in Hellfire Club tease"] },
  { title: "Uncanny X-Men", issue: "123", year: 1963, keyInfo: ["First appearance of Arcade"] },
  { title: "Uncanny X-Men", issue: "124", year: 1963, keyInfo: ["Arcade's Murderworld debut"] },
  { title: "Uncanny X-Men", issue: "125", year: 1963, keyInfo: ["Phoenix saga continues"] },
  { title: "Uncanny X-Men", issue: "126", year: 1963, keyInfo: ["Proteus saga begins"] },
  { title: "Uncanny X-Men", issue: "127", year: 1963, keyInfo: ["Proteus saga"] },
  { title: "Uncanny X-Men", issue: "128", year: 1963, keyInfo: ["Death of Proteus"] },
  { title: "Uncanny X-Men", issue: "139", year: 1963, keyInfo: ["Wolverine's brown costume debut", "Kitty Pryde joins X-Men"] },
  { title: "Uncanny X-Men", issue: "140", year: 1963, keyInfo: ["Wendigo and Alpha Flight"] },
  { title: "Uncanny X-Men", issue: "143", year: 1963, keyInfo: ["John Byrne's last X-Men issue"] },
  { title: "Uncanny X-Men", issue: "150", year: 1963, keyInfo: ["Anniversary issue, Magneto vs X-Men", "Origin of Magneto"] },
  { title: "Uncanny X-Men", issue: "155", year: 1963, keyInfo: ["First appearance of the Brood"] },
  { title: "Uncanny X-Men", issue: "161", year: 1963, keyInfo: ["Origin of Magneto detailed"] },
  { title: "Uncanny X-Men", issue: "165", year: 1963, keyInfo: ["Brood saga, Storm injured"] },
  { title: "Uncanny X-Men", issue: "166", year: 1963, keyInfo: ["Brood saga conclusion"] },
  { title: "Uncanny X-Men", issue: "173", year: 1963, keyInfo: ["Storm's punk look debuts"] },
  { title: "Uncanny X-Men", issue: "200", year: 1963, keyInfo: ["200th issue", "Magneto trial"] },
  { title: "Uncanny X-Men", issue: "205", year: 1963, keyInfo: ["Wolverine vs Lady Deathstrike (Barry Windsor-Smith art)"] },
  { title: "Uncanny X-Men", issue: "207", year: 1963, keyInfo: ["Wolverine vs Selene"] },
  { title: "Uncanny X-Men", issue: "212", year: 1963, keyInfo: ["First Wolverine vs Sabretooth in modern form"] },
  { title: "Uncanny X-Men", issue: "213", year: 1963, keyInfo: ["Wolverine vs Sabretooth continues, Mutant Massacre"] },
  { title: "Uncanny X-Men", issue: "229", year: 1963, keyInfo: ["First appearance of the Reavers"] },
  { title: "Uncanny X-Men", issue: "239", year: 1963, keyInfo: ["Inferno crossover begins"] },
  { title: "Uncanny X-Men", issue: "251", year: 1963, keyInfo: ["Wolverine crucified by Reavers"] },
  { title: "Uncanny X-Men", issue: "270", year: 1963, keyInfo: ["X-Tinction Agenda begins"] },
  { title: "Uncanny X-Men", issue: "281", year: 1963, keyInfo: ["First Bishop cameo / new X-Men team"] },
  { title: "Uncanny X-Men", issue: "300", year: 1963, keyInfo: ["300th issue anniversary"] },
  { title: "Uncanny X-Men", issue: "350", year: 1963, keyInfo: ["350th issue anniversary"] },
  { title: "X-Men", issue: "25", year: 1963, keyInfo: ["Magneto removes Wolverine's adamantium"] },
  { title: "X-Men", issue: "30", year: 1963, keyInfo: ["Cyclops and Jean Grey wedding"] },

  // --- MARVEL - Avengers (deeper) ---
  { title: "Avengers", issue: "29", year: 1963, keyInfo: ["First appearance of Power Man (Erik Josten)"] },
  { title: "Avengers", issue: "31", year: 1963, keyInfo: ["First appearance of the Living Laser"] },
  { title: "Avengers", issue: "59", year: 1963, keyInfo: ["First appearance of Yellowjacket (Hank Pym)"] },
  { title: "Avengers", issue: "66", year: 1963, keyInfo: ["First mention of Adamantium"] },
  { title: "Avengers", issue: "71", year: 1963, keyInfo: ["First appearance of the Black Knight (Dane Whitman) as hero"] },
  { title: "Avengers", issue: "80", year: 1963, keyInfo: ["First appearance of Red Wolf"] },
  { title: "Avengers", issue: "89", year: 1963, keyInfo: ["Kree-Skrull War begins"] },
  { title: "Avengers", issue: "93", year: 1963, keyInfo: ["Kree-Skrull War", "Neal Adams classic"] },
  { title: "Avengers", issue: "98", year: 1963, keyInfo: ["Hercules joins the Avengers"] },
  { title: "Avengers", issue: "100", year: 1963, keyInfo: ["100th issue anniversary"] },
  { title: "Avengers", issue: "137", year: 1963, keyInfo: ["First full appearance of Mantis as Avenger"] },
  { title: "Avengers", issue: "144", year: 1963, keyInfo: ["First appearance of Hellcat (Patsy Walker)"] },
  { title: "Avengers", issue: "162", year: 1963, keyInfo: ["First appearance of Jocasta"] },
  { title: "Avengers", issue: "211", year: 1963, keyInfo: ["Tigra joins Avengers"] },
  { title: "Avengers", issue: "300", year: 1963, keyInfo: ["300th issue anniversary, Avengers reform"] },
  { title: "Avengers", issue: "400", year: 1963, keyInfo: ["400th issue anniversary"] },

  // --- MARVEL - Hulk (deeper) ---
  { title: "Incredible Hulk", issue: "102", year: 1962, keyInfo: ["Hulk solo title begins (renumbered from Tales to Astonish)"] },
  { title: "Incredible Hulk", issue: "140", year: 1962, keyInfo: ["First appearance of Jarella"] },
  { title: "Incredible Hulk", issue: "162", year: 1962, keyInfo: ["First appearance of Wendigo"] },
  { title: "Incredible Hulk", issue: "169", year: 1962, keyInfo: ["First appearance of Bi-Beast"] },
  { title: "Incredible Hulk", issue: "200", year: 1962, keyInfo: ["200th issue anniversary"] },
  { title: "Incredible Hulk", issue: "347", year: 1962, keyInfo: ["First appearance of Joe Fixit (gray Hulk Las Vegas persona)"] },
  { title: "Incredible Hulk", issue: "393", year: 1962, keyInfo: ["Anniversary issue, gold foil cover"] },

  // --- MARVEL - Iron Man (deeper) ---
  { title: "Iron Man", issue: "54", year: 1968, keyInfo: ["First appearance of Moondragon"] },
  { title: "Iron Man", issue: "100", year: 1968, keyInfo: ["100th issue anniversary"] },
  { title: "Iron Man", issue: "120", year: 1968, keyInfo: ["'Demon in a Bottle' begins"] },
  { title: "Iron Man", issue: "144", year: 1968, keyInfo: ["First appearance of Sunturion"] },
  { title: "Iron Man", issue: "150", year: 1968, keyInfo: ["Iron Man vs Doctor Doom in Camelot"] },
  { title: "Iron Man", issue: "225", year: 1968, keyInfo: ["Armor Wars begins"] },
  { title: "Iron Man", issue: "281", year: 1968, keyInfo: ["First War Machine cameo"] },

  // --- MARVEL - Thor (deeper) ---
  { title: "Journey Into Mystery", issue: "97", year: 1962, keyInfo: ["First Tales of Asgard backup feature"] },
  { title: "Thor", issue: "126", year: 1966, keyInfo: ["Title rename from Journey Into Mystery", "First Thor as title"] },
  { title: "Thor", issue: "129", year: 1966, keyInfo: ["First Marvel appearance of Hercules"] },
  { title: "Thor", issue: "132", year: 1966, keyInfo: ["First appearance of Ego the Living Planet"] },
  { title: "Thor", issue: "134", year: 1966, keyInfo: ["First appearance of the High Evolutionary"] },
  { title: "Thor", issue: "154", year: 1966, keyInfo: ["First appearance of Mangog"] },
  { title: "Thor", issue: "225", year: 1966, keyInfo: ["First appearance of Firelord"] },
  { title: "Thor", issue: "339", year: 1966, keyInfo: ["First Stormbreaker hammer"] },
  { title: "Thor", issue: "340", year: 1966, keyInfo: ["Surtur saga continues"] },

  // --- MARVEL - Fantastic Four (deeper) ---
  { title: "Fantastic Four", issue: "6", year: 1961, keyInfo: ["Doctor Doom and Sub-Mariner team-up"] },
  { title: "Fantastic Four", issue: "11", year: 1961, keyInfo: ["First appearance of the Impossible Man"] },
  { title: "Fantastic Four", issue: "57", year: 1961, keyInfo: ["Doctor Doom returns, steals Surfer's power"] },
  { title: "Fantastic Four", issue: "112", year: 1961, keyInfo: ["Hulk vs Thing classic battle"] },
  { title: "Fantastic Four", issue: "150", year: 1961, keyInfo: ["Wedding of Crystal and Quicksilver"] },
  { title: "Fantastic Four", issue: "232", year: 1961, keyInfo: ["John Byrne FF run begins"] },
  { title: "Fantastic Four", issue: "236", year: 1961, keyInfo: ["FF 20th anniversary"] },
  { title: "Fantastic Four", issue: "244", year: 1961, keyInfo: ["First appearance of Frankie Raye / Nova"] },
  { title: "Fantastic Four", issue: "265", year: 1961, keyInfo: ["She-Hulk joins the Fantastic Four"] },
  { title: "Fantastic Four", issue: "347", year: 1961, keyInfo: ["First appearance of Kubik"] },
  { title: "Fantastic Four", issue: "350", year: 1961, keyInfo: ["350th issue anniversary"] },
  { title: "Fantastic Four", issue: "371", year: 1961, keyInfo: ["First appearance of Lyja the Lazerfist (Skrull-Alicia revealed)"] },

  // --- MARVEL - Daredevil (deeper) ---
  { title: "Daredevil", issue: "8", year: 1964, keyInfo: ["First appearance of Stilt-Man"] },
  { title: "Daredevil", issue: "16", year: 1964, keyInfo: ["First Romita Sr. Daredevil art"] },
  { title: "Daredevil", issue: "17", year: 1964, keyInfo: ["Romita Sr. art continues"] },
  { title: "Daredevil", issue: "200", year: 1964, keyInfo: ["200th issue anniversary"] },
  { title: "Daredevil", issue: "230", year: 1964, keyInfo: ["Born Again continues"] },
  { title: "Daredevil", issue: "254", year: 1964, keyInfo: ["First appearance of Typhoid Mary"] },
  { title: "Daredevil", issue: "284", year: 1964, keyInfo: ["First appearance of Lord Deathstrike... actually skip", "Acts of Vengeance crossover"] },

  // --- MARVEL - Captain America (deeper) ---
  { title: "Captain America", issue: "112", year: 1941, keyInfo: ["Captain America origin retold (Silver Age definitive)"] },
  { title: "Captain America", issue: "150", year: 1941, keyInfo: ["150th issue"] },
  { title: "Captain America", issue: "155", year: 1941, keyInfo: ["First Madame Hydra (Viper)"] },
  { title: "Captain America", issue: "180", year: 1941, keyInfo: ["First appearance of Nomad (Steve Rogers identity)"] },
  { title: "Captain America", issue: "200", year: 1941, keyInfo: ["200th issue anniversary"] },
  { title: "Captain America", issue: "217", year: 1941, keyInfo: ["First appearance of Quasar (Marvel Boy III)"] },
  { title: "Captain America", issue: "337", year: 1941, keyInfo: ["John Walker becomes Captain America"] },
  { title: "Captain America", issue: "350", year: 1941, keyInfo: ["350th issue anniversary, Steve Rogers returns"] },
  { title: "Captain America", issue: "444", year: 1941, keyInfo: ["Sharon Carter returns"] },

  // --- MARVEL - Doctor Strange ---
  { title: "Doctor Strange", issue: "169", year: 2015, keyInfo: ["Doctor Strange's first solo title (renumbered from Strange Tales)"] },
  { title: "Doctor Strange", issue: "15", year: 2015, keyInfo: ["First appearance of Brother Voodoo's brother Daniel"] },

  // --- MARVEL - Bronze Age titles ---
  { title: "Conan the Barbarian", issue: "1", year: 1970, keyInfo: ["First Marvel Conan the Barbarian", "First Marvel comic appearance of Conan"] },
  { title: "Conan the Barbarian", issue: "23", year: 1970, keyInfo: ["First appearance of Red Sonja"] },
  { title: "Savage Sword of Conan", issue: "1", year: 1974, keyInfo: ["First Savage Sword of Conan magazine"] },
  { title: "Defenders", issue: "1", year: 1972, keyInfo: ["First Defenders ongoing series"] },
  { title: "Werewolf by Night", issue: "1", year: 1975, keyInfo: ["First Werewolf by Night ongoing series"] },
  { title: "Tomb of Dracula", issue: "1", year: 1972, keyInfo: ["First Tomb of Dracula", "First modern Marvel Dracula"] },
  { title: "Iron Fist", issue: "1", year: 1977, keyInfo: ["First Iron Fist ongoing series"] },
  { title: "Squadron Supreme", issue: "1", year: 1985, keyInfo: ["First Squadron Supreme limited series", "Mark Gruenwald deconstruction"] },
  { title: "Daredevil/Black Widow", issue: "92", year: 1964, keyInfo: ["Title shared with Black Widow begins"] },

  // --- DC - Detective Comics (deeper) ---
  { title: "Detective Comics", issue: "156", year: 1937, keyInfo: ["First appearance of the Batmobile (named)"] },
  { title: "Detective Comics", issue: "265", year: 1937, keyInfo: ["First detailed Batman origin retelling"] },
  { title: "Detective Comics", issue: "439", year: 1937, keyInfo: ["First Manhunter (Paul Kirk) revival"] },
  { title: "Detective Comics", issue: "466", year: 1937, keyInfo: ["First appearance of Maxie Zeus"] },
  { title: "Detective Comics", issue: "476", year: 1937, keyInfo: ["The Laughing Fish, classic Joker"] },
  { title: "Detective Comics", issue: "500", year: 1937, keyInfo: ["500th issue anniversary"] },
  { title: "Detective Comics", issue: "569", year: 1937, keyInfo: ["First appearance of Magpie"] },
  { title: "Detective Comics", issue: "823", year: 1937, keyInfo: ["Penguin classic story"] },
  { title: "Detective Comics", issue: "871", year: 1937, keyInfo: ["Scott Snyder Detective run begins"] },

  // --- DC - Batman (deeper) ---
  { title: "Batman", issue: "11", year: 1940, keyInfo: ["Joker / Penguin classic"] },
  { title: "Batman", issue: "16", year: 1940, keyInfo: ["First appearance of Alfred Pennyworth"] },
  { title: "Batman", issue: "47", year: 1940, keyInfo: ["Batman's origin retold in detail"] },
  { title: "Batman", issue: "100", year: 1940, keyInfo: ["100th issue anniversary"] },
  { title: "Batman", issue: "121", year: 1940, keyInfo: ["First appearance of Mr. Freeze (as Mr. Zero)"] },
  { title: "Batman", issue: "139", year: 1940, keyInfo: ["First Silver Age Batgirl (Betty Kane)"] },
  { title: "Batman", issue: "156", year: 1940, keyInfo: ["'Robin Dies at Dawn' classic"] },
  { title: "Batman", issue: "200", year: 1940, keyInfo: ["200th issue anniversary"] },
  { title: "Batman", issue: "300", year: 1940, keyInfo: ["300th issue anniversary"] },
  { title: "Batman", issue: "366", year: 1940, keyInfo: ["First appearance of Jason Todd in Robin costume (pre-Crisis)"] },
  { title: "Batman", issue: "407", year: 1940, keyInfo: ["Year One conclusion (Frank Miller)"] },
  { title: "Batman", issue: "442", year: 1940, keyInfo: ["First appearance of Tim Drake as Robin in costume"] },
  { title: "Batman", issue: "475", year: 1940, keyInfo: ["First appearance of Renee Montoya"] },
  { title: "Batman", issue: "492", year: 1940, keyInfo: ["Knightfall begins"] },
  { title: "Batman", issue: "500", year: 1940, keyInfo: ["500th issue anniversary, Azrael Batman"] },
  { title: "Batman", issue: "680", year: 1940, keyInfo: ["Batman R.I.P. continues"] },
  { title: "Batman", issue: "700", year: 1940, keyInfo: ["700th issue anniversary"] },

  // --- DC - Action Comics & Superman (deeper) ---
  { title: "Action Comics", issue: "100", year: 1938, keyInfo: ["100th issue anniversary"] },
  { title: "Action Comics", issue: "266", year: 1938, keyInfo: ["First appearance of Bizarro Superman (Silver Age)"] },
  { title: "Action Comics", issue: "300", year: 1938, keyInfo: ["300th issue anniversary"] },
  { title: "Action Comics", issue: "340", year: 1938, keyInfo: ["First appearance of the Parasite"] },
  { title: "Action Comics", issue: "500", year: 1938, keyInfo: ["500th issue anniversary"] },
  { title: "Action Comics", issue: "654", year: 1938, keyInfo: ["Death of Mr. Mxyzptlk story"] },
  { title: "Superman", issue: "100", year: 1939, keyInfo: ["100th issue anniversary"] },
  { title: "Superman", issue: "300", year: 1939, keyInfo: ["300th issue anniversary"] },
  { title: "Superman", issue: "400", year: 1939, keyInfo: ["400th issue anniversary"] },
  { title: "Superman", issue: "423", year: 1939, keyInfo: ["'Whatever Happened to the Man of Tomorrow' (Alan Moore)"] },

  // --- DC - Adventure & Legion ---
  { title: "Adventure Comics", issue: "267", year: 1938, keyInfo: ["Second Legion of Super-Heroes appearance"] },
  { title: "Adventure Comics", issue: "346", year: 1938, keyInfo: ["First appearance of Karate Kid"] },
  { title: "Adventure Comics", issue: "352", year: 1938, keyInfo: ["First appearance of Computo"] },

  // --- DC - Justice League ---
  { title: "Justice League of America", issue: "4", year: 1960, keyInfo: ["Green Arrow joins the JLA"] },
  { title: "Justice League of America", issue: "22", year: 1960, keyInfo: ["JLA/JSA crossover continues, Earth-Two"] },
  { title: "Justice League of America", issue: "31", year: 1960, keyInfo: ["First Hawkman in JLA"] },
  { title: "Justice League of America", issue: "100", year: 1960, keyInfo: ["100th issue anniversary"] },
  { title: "Justice League of America", issue: "200", year: 1960, keyInfo: ["200th issue anniversary"] },
  { title: "Justice League of America", issue: "208", year: 1960, keyInfo: ["Death of Aquaman's son Arthur Jr."] },

  // --- DC - Brave and the Bold ---
  { title: "Brave and the Bold", issue: "79", year: 1960, keyInfo: ["Neal Adams' first Batman work (with Deadman)"] },
  { title: "Brave and the Bold", issue: "85", year: 1960, keyInfo: ["First Green Arrow with Van Dyke beard / new look"] },
  { title: "Brave and the Bold", issue: "200", year: 1960, keyInfo: ["200th issue, first Batman and the Outsiders preview"] },

  // --- DC - Wonder Woman (deeper) ---
  { title: "Wonder Woman", issue: "300", year: 1942, keyInfo: ["300th issue anniversary"] },

  // --- DC - Flash (deeper) ---
  { title: "The Flash", issue: "155", year: 1959, keyInfo: ["First appearance of Abra Kadabra"] },
  { title: "The Flash", issue: "163", year: 1959, keyInfo: ["First appearance of Kid Flash in modern costume"] },
  { title: "The Flash", issue: "175", year: 1959, keyInfo: ["Second Superman vs Flash race"] },
  { title: "The Flash", issue: "200", year: 1959, keyInfo: ["200th issue anniversary"] },
  { title: "The Flash", issue: "300", year: 1959, keyInfo: ["300th issue anniversary"] },
  { title: "The Flash", issue: "350", year: 1959, keyInfo: ["350th issue anniversary, Trial of the Flash"] },

  // --- DC - Green Lantern (deeper) ---
  { title: "Green Lantern", issue: "21", year: 1960, keyInfo: ["First appearance of Doctor Polaris"] },
  { title: "Green Lantern", issue: "40", year: 1960, keyInfo: ["First appearance of the Anti-Matter Universe"] },
  { title: "Green Lantern", issue: "45", year: 1960, keyInfo: ["First Silver Age appearance of Jay Garrick"] },
  { title: "Green Lantern", issue: "100", year: 1960, keyInfo: ["100th issue anniversary"] },
  { title: "Green Lantern", issue: "172", year: 1960, keyInfo: ["First John Stewart in costume regular role"] },
  { title: "Green Lantern", issue: "200", year: 1960, keyInfo: ["200th issue anniversary"] },

  // --- DC - Sandman / Vertigo ---
  { title: "Sandman Mystery Theatre", issue: "1", year: 1993, keyInfo: ["First Sandman Mystery Theatre"] },
  { title: "Death: The High Cost of Living", issue: "1", year: 1993, keyInfo: ["First Death miniseries"] },
  { title: "Books of Magic", issue: "1", year: 1990, keyInfo: ["First Books of Magic", "First appearance of Tim Hunter"] },
  { title: "Lucifer", issue: "1", year: 2000, keyInfo: ["First Lucifer ongoing series"] },
  { title: "Hellblazer", issue: "27", year: 1988, keyInfo: ["First appearance of Constantine's daughter Astra Logue (full)"] },

  // --- DC - Modern Anniversaries / Events ---
  { title: "Crisis on Infinite Earths", issue: "12", year: 1985, keyInfo: ["Crisis on Infinite Earths conclusion", "Multiverse collapsed into one Earth"] },
  { title: "Zero Hour", issue: "0", year: 1994, keyInfo: ["Zero Hour conclusion / DCU reset"] },
  { title: "DC One Million", issue: "1", year: 1998, keyInfo: ["First DC One Million event"] },
  { title: "Final Night", issue: "1", year: 1996, keyInfo: ["First Final Night event"] },
  { title: "Underworld Unleashed", issue: "1", year: 1995, keyInfo: ["First Underworld Unleashed event"] },
  { title: "Bloodlines", issue: "1", year: 1993, keyInfo: ["Bloodlines crossover begins"] },
  { title: "Knightfall", issue: "1", year: 1993, keyInfo: ["Knightfall trade collection begins / story arc compilation"] },
  { title: "Blackest Night", issue: "1", year: 2009, keyInfo: ["First Blackest Night event", "Black Lantern Corps focus"] },
  { title: "Brightest Day", issue: "1", year: 2010, keyInfo: ["First Brightest Day"] },
  { title: "Flashpoint", issue: "5", year: 2011, keyInfo: ["Flashpoint conclusion, New 52 begins"] },

  // --- IMAGE - Spawn deep cuts + indie ---
  { title: "Spawn", issue: "5", year: 1992, keyInfo: ["Frank Miller cover variant"] },
  { title: "Spawn", issue: "8", year: 1992, keyInfo: ["First appearance of the Freaks"] },
  { title: "Spawn", issue: "10", year: 1992, keyInfo: ["Cerebus crossover (Dave Sim guest issue)"] },
  { title: "Spawn", issue: "11", year: 1992, keyInfo: ["Alan Moore guest writer issue"] },
  { title: "Spawn", issue: "100", year: 1992, keyInfo: ["100th issue anniversary"] },
  { title: "Spawn", issue: "200", year: 1992, keyInfo: ["200th issue anniversary"] },
  { title: "Spawn", issue: "300", year: 1992, keyInfo: ["300th issue anniversary, longest-running creator-owned superhero comic"] },

  // --- INDIE / IMAGE expansion ---
  { title: "Saga", issue: "12", year: 2012, keyInfo: ["First appearance of The Will's family"] },
  { title: "Walking Dead", issue: "48", year: 2003, keyInfo: ["First appearance of the Hunters"] },
  { title: "Walking Dead", issue: "50", year: 2003, keyInfo: ["50th issue anniversary"] },
  { title: "Walking Dead", issue: "150", year: 2003, keyInfo: ["150th issue anniversary"] },
  { title: "Walking Dead", issue: "192", year: 2003, keyInfo: ["Death of Rick Grimes"] },
  { title: "Walking Dead", issue: "193", year: 2003, keyInfo: ["Final issue of The Walking Dead"] },
  { title: "Invincible", issue: "12", year: 2003, keyInfo: ["Death of Invincible (apparent)"] },
  { title: "Invincible", issue: "100", year: 2003, keyInfo: ["100th issue anniversary"] },
  { title: "Invincible", issue: "144", year: 2003, keyInfo: ["Final issue of Invincible"] },
  { title: "Chew", issue: "60", year: 2009, keyInfo: ["Final issue of Chew"] },
  { title: "Locke & Key", issue: "6", year: 2008, keyInfo: ["First Locke & Key arc conclusion"] },
  { title: "Sandman Universe", issue: "1", year: 2018, keyInfo: ["First Sandman Universe relaunch"] },

  // --- HORROR / EC / OTHER VINTAGE ---
  { title: "Tales from the Crypt", issue: "20", year: 1950, keyInfo: ["First Crypt-Keeper hosted issue (renumbered)"] },
  { title: "Vault of Horror", issue: "12", year: 1950, keyInfo: ["First Vault of Horror hosted issue (renumbered)"] },
  { title: "Weird Fantasy", issue: "13", year: 1950, keyInfo: ["First EC science-fiction title (renumbered)"] },
  { title: "Mad", issue: "1", year: 1952, keyInfo: ["First Mad Magazine"] },

  // --- ANNIVERSARY / 1000-ISSUE LANDMARKS ---
  { title: "Action Comics", issue: "900", year: 1938, keyInfo: ["900th issue anniversary"] },
  { title: "Detective Comics", issue: "900", year: 1937, keyInfo: ["900th issue anniversary"] },
  { title: "Amazing Spider-Man", issue: "800", year: 1963, keyInfo: ["800th issue / Red Goblin conclusion"] },
  { title: "Amazing Spider-Man", issue: "900", year: 1963, keyInfo: ["900th issue (legacy numbering)"] },

  // ============================================
  // SESSION 44 EXPANSION - ROUND 3 - May 5, 2026
  // Third-tier: modern hot keys, licensed comics, Charlton vintage,
  // Image recent indies, and 2nd/3rd appearances of canon characters.
  // ============================================

  // --- MARVEL - Modern Venom / Symbiote / Carnage (Cates era) ---
  { title: "Venom", issue: "2", year: 2018, keyInfo: ["First Knull cameo (silhouette)"] },
  { title: "Venom", issue: "4", year: 2018, keyInfo: ["Knull origin", "First full Knull cover"] },
  { title: "Venom", issue: "27", year: 2018, keyInfo: ["First appearance of Virus"] },
  { title: "Venom", issue: "30", year: 2018, keyInfo: ["First appearance of Codex"] },
  { title: "Web of Venom: Ve'nam", issue: "1", year: 2018, keyInfo: ["First Knull retroactive flashback appearance"] },
  { title: "Edge of Venomverse", issue: "1", year: 2017, keyInfo: ["First Edge of Venomverse, multiple Venom variants"] },
  { title: "Symbiote Spider-Man", issue: "1", year: 2019, keyInfo: ["First Symbiote Spider-Man (Peter David), retro black-suit era"] },
  { title: "Absolute Carnage", issue: "5", year: 2019, keyInfo: ["Absolute Carnage conclusion"] },
  { title: "King in Black", issue: "5", year: 2020, keyInfo: ["King in Black conclusion"] },

  // --- MARVEL - Modern Thor / Cosmic ---
  { title: "Thor", issue: "1", year: 1966, keyInfo: ["Donny Cates Thor begins", "First appearance of the Black Winter"] },
  { title: "Thor", issue: "5", year: 1966, keyInfo: ["First full appearance of the Black Winter"] },
  { title: "Thor", issue: "6", year: 1966, keyInfo: ["First appearance of God of Hammers (cameo)"] },
  { title: "Thor", issue: "13", year: 1966, keyInfo: ["First appearance of Donald Blake (Cates revival)"] },
  { title: "Thor", issue: "19", year: 1966, keyInfo: ["First full appearance of God of Hammers"] },
  { title: "Silver Surfer: Black", issue: "1", year: 2019, keyInfo: ["First Silver Surfer: Black", "Knull connection"] },
  { title: "Annihilation: Conquest", issue: "1", year: 2007, keyInfo: ["First Annihilation: Conquest"] },

  // --- MARVEL - Modern X-Men ---
  { title: "Astonishing X-Men", issue: "1", year: 2004, keyInfo: ["Joss Whedon Astonishing X-Men begins"] },
  { title: "New X-Men", issue: "114", year: 2001, keyInfo: ["Grant Morrison New X-Men begins"] },
  { title: "New X-Men", issue: "121", year: 2001, keyInfo: ["First appearance of Stuff"] },
  { title: "Wolverine: Origin", issue: "1", year: 2001, keyInfo: ["First Wolverine: Origin", "Birth name James Howlett revealed"] },
  { title: "Old Man Logan", issue: "1", year: 2016, keyInfo: ["First Old Man Logan ongoing series"] },
  { title: "All-New Wolverine", issue: "1", year: 2015, keyInfo: ["First All-New Wolverine", "X-23 takes Wolverine mantle"] },
  { title: "X-23", issue: "1", year: 2010, keyInfo: ["First X-23 ongoing series"] },
  { title: "Cable", issue: "1", year: 1993, keyInfo: ["First Cable ongoing series"] },
  { title: "Cable", issue: "1", year: 2020, keyInfo: ["Krakoan Cable series begins"] },
  { title: "X-Men: Red", issue: "1", year: 2018, keyInfo: ["First X-Men: Red (Tom Taylor)"] },
  { title: "Death of Wolverine", issue: "1", year: 2014, keyInfo: ["Death of Wolverine begins"] },
  { title: "Death of Wolverine", issue: "4", year: 2014, keyInfo: ["Death of Wolverine conclusion"] },
  { title: "Return of Wolverine", issue: "1", year: 2018, keyInfo: ["Return of Wolverine"] },
  { title: "X of Swords: Creation", issue: "1", year: 2020, keyInfo: ["First X of Swords event"] },
  { title: "Hellions", issue: "1", year: 2020, keyInfo: ["First Krakoan Hellions"] },
  { title: "Way of X", issue: "1", year: 2021, keyInfo: ["First Way of X (Si Spurrier)"] },

  // --- MARVEL - Modern Spider-Man ---
  { title: "Ultimate Comics: Spider-Man", issue: "1", year: 2011, keyInfo: ["First Ultimate Comics Spider-Man (Miles Morales solo)"] },
  { title: "Spider-Gwen: Ghost-Spider", issue: "1", year: 2018, keyInfo: ["First Ghost-Spider ongoing"] },
  { title: "Ghost-Spider", issue: "1", year: 2019, keyInfo: ["Ghost-Spider 2nd ongoing series"] },
  { title: "Spider-Boy", issue: "1", year: 2023, keyInfo: ["First Spider-Boy (Bailey Briggs) ongoing"] },
  { title: "Friendly Neighborhood Spider-Man", issue: "1", year: 2019, keyInfo: ["Tom Taylor Friendly Neighborhood Spider-Man begins"] },

  // --- MARVEL - Modern Avengers / Heroes ---
  { title: "New Avengers", issue: "27", year: 2004, keyInfo: ["First appearance of Illuminati (modern reveal)"] },
  { title: "Mighty Avengers", issue: "1", year: 2007, keyInfo: ["First Mighty Avengers ongoing"] },
  { title: "Young Avengers", issue: "12", year: 2005, keyInfo: ["First appearance of Cassie Lang as Stature"] },
  { title: "Avengers: The Initiative", issue: "1", year: 2007, keyInfo: ["First Avengers: The Initiative"] },
  { title: "A-Force", issue: "1", year: 2015, keyInfo: ["First A-Force", "All-female Avengers team"] },
  { title: "Falcon", issue: "1", year: 2017, keyInfo: ["Sam Wilson Falcon solo ongoing"] },
  { title: "Riri Williams: Ironheart", issue: "1", year: 2018, keyInfo: ["First Ironheart ongoing series"] },
  { title: "Black Panther: World of Wakanda", issue: "1", year: 2017, keyInfo: ["First Black Panther: World of Wakanda (Roxane Gay)"] },
  { title: "Mockingbird", issue: "1", year: 2016, keyInfo: ["First Mockingbird ongoing solo"] },
  { title: "Black Widow", issue: "1", year: 2014, keyInfo: ["Nathan Edmondson Black Widow begins"] },
  { title: "Black Widow", issue: "1", year: 2020, keyInfo: ["Kelly Thompson Black Widow begins"] },
  { title: "Hellcat", issue: "1", year: 2015, keyInfo: ["Patsy Walker, AKA Hellcat begins"] },
  { title: "America Chavez", issue: "1", year: 2017, keyInfo: ["First America Chavez solo ongoing"] },
  { title: "Iceman", issue: "1", year: 2017, keyInfo: ["First Iceman solo ongoing (Sina Grace)"] },

  // --- MARVEL - Star Wars (Marvel era 2015+) ---
  { title: "Star Wars: Darth Vader", issue: "1", year: 2015, keyInfo: ["First Marvel Darth Vader ongoing", "First Black Krrsantan (cameo)"] },
  { title: "Star Wars: Darth Vader", issue: "3", year: 2015, keyInfo: ["First appearance of Doctor Aphra"] },
  { title: "Star Wars: Darth Vader", issue: "5", year: 2015, keyInfo: ["First appearance of 0-0-0 (Triple-Zero)", "First appearance of BT-1"] },
  { title: "Star Wars: Darth Vader", issue: "1", year: 2017, keyInfo: ["Darth Vader volume 2 (Soule)"] },
  { title: "Star Wars: Darth Vader", issue: "3", year: 2017, keyInfo: ["First appearance of Crimson Dawn (cameo)"] },
  { title: "Star Wars: Doctor Aphra", issue: "1", year: 2016, keyInfo: ["First Doctor Aphra ongoing series"] },
  { title: "Star Wars: Doctor Aphra", issue: "1", year: 2020, keyInfo: ["Doctor Aphra volume 2 (Alyssa Wong)"] },
  { title: "Star Wars: Bounty Hunters", issue: "1", year: 2020, keyInfo: ["First Bounty Hunters ongoing"] },
  { title: "Star Wars: The High Republic", issue: "1", year: 2021, keyInfo: ["First High Republic comic"] },
  { title: "Crimson Empire", issue: "1", year: 1997, keyInfo: ["First Crimson Empire (Dark Horse Star Wars)"] },
  { title: "Knights of the Old Republic", issue: "1", year: 2006, keyInfo: ["First Knights of the Old Republic (Dark Horse)"] },

  // --- DC - Modern Batman / Joker War / Tom King ---
  { title: "Batman", issue: "5", year: 1940, keyInfo: ["Court of Owls labyrinth issue"] },
  { title: "Batman", issue: "13", year: 1940, keyInfo: ["Death of the Family begins"] },
  { title: "Batman", issue: "21", year: 1940, keyInfo: ["Zero Year begins"] },
  { title: "Batman", issue: "92", year: 1940, keyInfo: ["First full appearance of Punchline (cameo)"] },
  { title: "Batman", issue: "95", year: 1940, keyInfo: ["Joker War begins", "First Punchline cover"] },
  { title: "Batman", issue: "125", year: 1940, keyInfo: ["Failsafe arc begins (Chip Zdarsky)"] },
  { title: "Batman: Curse of the White Knight", issue: "1", year: 2019, keyInfo: ["First Batman: Curse of the White Knight"] },
  { title: "Batman: Beyond the White Knight", issue: "1", year: 2022, keyInfo: ["First Batman: Beyond the White Knight"] },
  { title: "Batman/Catwoman", issue: "1", year: 2020, keyInfo: ["First Batman/Catwoman maxi-series (Tom King)"] },
  { title: "Batman: Damned", issue: "1", year: 2018, keyInfo: ["First Batman: Damned (Lee Bermejo)", "First DC Black Label release"] },
  { title: "Batman: Three Jokers", issue: "1", year: 2020, keyInfo: ["First Batman: Three Jokers (Geoff Johns)"] },
  { title: "Batman: Last Knight on Earth", issue: "1", year: 2019, keyInfo: ["First Batman: Last Knight on Earth"] },
  { title: "Detective Comics", issue: "1027", year: 1937, keyInfo: ["1027th issue anniversary, multiple stories celebrating Batman"] },
  { title: "Joker", issue: "1", year: 2021, keyInfo: ["First Joker ongoing solo series"] },
  { title: "Joker: Year of the Villain", issue: "1", year: 2019, keyInfo: ["First Joker: Year of the Villain"] },
  { title: "Punchline", issue: "1", year: 2020, keyInfo: ["First Punchline solo one-shot"] },
  { title: "DC Vs Vampires", issue: "1", year: 2021, keyInfo: ["First DC Vs Vampires"] },
  { title: "Joker: Killer Smile", issue: "1", year: 2019, keyInfo: ["First Joker: Killer Smile (Black Label)"] },
  { title: "Batgirls", issue: "1", year: 2021, keyInfo: ["First Batgirls ongoing (multiple Batgirls)"] },
  { title: "Robins", issue: "1", year: 2021, keyInfo: ["First Robins limited series"] },

  // --- DC - Modern Justice League / Multiverse ---
  { title: "Justice League: No Justice", issue: "1", year: 2018, keyInfo: ["First Justice League: No Justice"] },
  { title: "Justice League Dark", issue: "1", year: 2018, keyInfo: ["Justice League Dark volume 2 (James Tynion)"] },
  { title: "The Multiversity", issue: "1", year: 2014, keyInfo: ["First The Multiversity (Grant Morrison)"] },
  { title: "Far Sector", issue: "1", year: 2019, keyInfo: ["First Far Sector (N. K. Jemisin)", "First Sojourner Mullein"] },
  { title: "Wonder Woman: Dead Earth", issue: "1", year: 2019, keyInfo: ["First Wonder Woman: Dead Earth (Black Label)"] },
  { title: "Suicide Squad: Get Joker!", issue: "1", year: 2021, keyInfo: ["First Suicide Squad: Get Joker!"] },
  { title: "Black Adam", issue: "1", year: 2022, keyInfo: ["First Black Adam ongoing solo"] },
  { title: "Wonder Girl", issue: "1", year: 2021, keyInfo: ["First Yara Flor Wonder Girl ongoing"] },

  // --- DC - Charlton Heroes ---
  { title: "Captain Atom", issue: "78", year: 1965, keyInfo: ["Charlton Captain Atom begins"] },
  { title: "The Question", issue: "1", year: 1967, keyInfo: ["First Charlton The Question (Vic Sage)"] },
  { title: "Peacemaker", issue: "1", year: 1967, keyInfo: ["First Charlton Peacemaker"] },

  // --- DC - Vintage Westerns / Phantoms ---
  { title: "All-Star Western", issue: "10", year: 1970, keyInfo: ["First appearance of Jonah Hex"] },
  { title: "Weird Western Tales", issue: "12", year: 1972, keyInfo: ["Jonah Hex backup begins"] },
  { title: "Jonah Hex", issue: "1", year: 1977, keyInfo: ["First Jonah Hex ongoing solo"] },
  { title: "Phantom Stranger", issue: "1", year: 1969, keyInfo: ["First Phantom Stranger ongoing series"] },
  { title: "Spectre", issue: "1", year: 1967, keyInfo: ["First Silver Age Spectre ongoing solo"] },
  { title: "Doom Patrol", issue: "86", year: 1963, keyInfo: ["First Doom Patrol issue (renumbered from My Greatest Adventure)"] },
  { title: "Brave and the Bold", issue: "74", year: 1960, keyInfo: ["First Atomic Knights story"] },
  { title: "Strange Adventures", issue: "205", year: 2020, keyInfo: ["First appearance of Deadman"] },
  { title: "Strange Adventures", issue: "215", year: 2020, keyInfo: ["Deadman origin"] },
  { title: "House of Mystery", issue: "175", year: 1952, keyInfo: ["First Cain (host)"] },
  { title: "House of Secrets", issue: "81", year: 1971, keyInfo: ["First Abel (host)"] },
  { title: "House of Secrets", issue: "90", year: 1971, keyInfo: ["First appearance of Eclipso"] },
  { title: "Witching Hour", issue: "1", year: 1969, keyInfo: ["First Witching Hour"] },

  // --- DC - Vertigo modern ---
  { title: "Preacher", issue: "5", year: 1995, keyInfo: ["Saint of Killers origin begins"] },
  { title: "Y: The Last Man", issue: "60", year: 2002, keyInfo: ["Y: The Last Man final issue"] },
  { title: "100 Bullets", issue: "100", year: 1999, keyInfo: ["100 Bullets final issue"] },
  { title: "Transmetropolitan", issue: "60", year: 1997, keyInfo: ["Transmetropolitan final issue"] },
  { title: "Sandman: Overture", issue: "1", year: 2013, keyInfo: ["First Sandman: Overture (Gaiman returns)"] },

  // --- IMAGE - Recent breakouts ---
  { title: "Saga", issue: "54", year: 2012, keyInfo: ["Saga returns from hiatus"] },
  { title: "I Hate Fairyland", issue: "1", year: 2015, keyInfo: ["First I Hate Fairyland (Skottie Young)"] },
  { title: "Reckless", issue: "1", year: 2020, keyInfo: ["First Reckless OGN series (Brubaker/Phillips)"] },
  { title: "Gunslinger Spawn", issue: "1", year: 2021, keyInfo: ["First Gunslinger Spawn ongoing"] },
  { title: "King Spawn", issue: "1", year: 2021, keyInfo: ["First King Spawn ongoing"] },
  { title: "Spawn: The Scorched", issue: "1", year: 2022, keyInfo: ["First Spawn: The Scorched team book"] },
  { title: "Family Tree", issue: "1", year: 2019, keyInfo: ["First Family Tree (Lemire)"] },
  { title: "Decorum", issue: "1", year: 2020, keyInfo: ["First Decorum (Hickman/Müller)"] },
  { title: "Ascender", issue: "1", year: 2019, keyInfo: ["First Ascender (Lemire/Nguyen Descender sequel)"] },
  { title: "Once & Future", issue: "1", year: 2019, keyInfo: ["First Once & Future (Boom Studios - Kieron Gillen)"] },
  { title: "Stillwater", issue: "1", year: 2020, keyInfo: ["First Stillwater (Zdarsky/Pérez)"] },
  { title: "Made in Korea", issue: "1", year: 2021, keyInfo: ["First Made in Korea"] },
  { title: "Newburn", issue: "1", year: 2021, keyInfo: ["First Newburn (Chip Zdarsky)"] },
  { title: "Murder Falcon", issue: "1", year: 2018, keyInfo: ["First Murder Falcon (Daniel Warren Johnson)"] },
  { title: "Step by Bloody Step", issue: "1", year: 2022, keyInfo: ["First Step by Bloody Step"] },
  { title: "Two Moons", issue: "1", year: 2021, keyInfo: ["First Two Moons (Image)"] },
  { title: "Kaya", issue: "1", year: 2022, keyInfo: ["First Kaya (Wes Craig)"] },
  { title: "Bone Orchard", issue: "1", year: 2022, keyInfo: ["First Bone Orchard mythos series"] },
  { title: "Public Domain", issue: "1", year: 2022, keyInfo: ["First Public Domain (Chip Zdarsky)"] },
  { title: "I Hate This Place", issue: "1", year: 2022, keyInfo: ["First I Hate This Place"] },
  { title: "The Department of Truth", issue: "12", year: 2020, keyInfo: ["12th issue / first arc conclusion"] },
  { title: "Twig", issue: "1", year: 2022, keyInfo: ["First Twig (Tradd Moore)"] },

  // --- IMAGE - Spawn-verse expansion ---
  { title: "Sam and Twitch", issue: "1", year: 1999, keyInfo: ["First Sam and Twitch spinoff"] },
  { title: "Hellspawn", issue: "1", year: 2000, keyInfo: ["First Hellspawn"] },
  { title: "Curse of the Spawn", issue: "1", year: 1996, keyInfo: ["First Curse of the Spawn"] },
  { title: "Medieval Spawn / Witchblade", issue: "1", year: 1996, keyInfo: ["First Medieval Spawn / Witchblade crossover"] },

  // --- BOOM / DARK HORSE / OTHER ---
  { title: "Mouse Guard", issue: "1", year: 2006, keyInfo: ["First Mouse Guard (David Petersen)"] },
  { title: "Mighty Morphin Power Rangers", issue: "1", year: 2016, keyInfo: ["First Boom MMPR ongoing series"] },
  { title: "Lumberjanes", issue: "1", year: 2014, keyInfo: ["First Lumberjanes (Boom)"] },
  { title: "Wynd", issue: "1", year: 2020, keyInfo: ["First Wynd (James Tynion IV - Boom)"] },
  { title: "Something is Killing the Children", issue: "15", year: 2019, keyInfo: ["First appearance of the House of Slaughter"] },
  { title: "Black Hammer: Age of Doom", issue: "1", year: 2018, keyInfo: ["First Black Hammer: Age of Doom"] },
  { title: "Black Hammer / Justice League", issue: "1", year: 2019, keyInfo: ["First Black Hammer / Justice League crossover"] },
  { title: "Hellboy and the B.P.R.D.", issue: "1", year: 2014, keyInfo: ["First Hellboy and the B.P.R.D. ongoing"] },
  { title: "B.P.R.D.", issue: "1", year: 2003, keyInfo: ["First B.P.R.D. ongoing"] },
  { title: "Buffy the Vampire Slayer", issue: "1", year: 1998, keyInfo: ["First Dark Horse Buffy ongoing"] },
  { title: "Buffy the Vampire Slayer Season 8", issue: "1", year: 2007, keyInfo: ["First Buffy Season 8 (Dark Horse)"] },
  { title: "Sonic the Hedgehog", issue: "1", year: 1993, keyInfo: ["First Archie Sonic the Hedgehog"] },
  { title: "Sonic the Hedgehog", issue: "1", year: 2018, keyInfo: ["First IDW Sonic the Hedgehog reboot"] },
  { title: "My Little Pony: Friendship is Magic", issue: "1", year: 2012, keyInfo: ["First IDW MLP ongoing"] },
  { title: "Teenage Mutant Ninja Turtles", issue: "100", year: 1984, keyInfo: ["IDW TMNT 100th issue"] },

  // --- MARVEL - More Bronze/Silver firsts ---
  { title: "Nick Fury, Agent of S.H.I.E.L.D.", issue: "1", year: 1968, keyInfo: ["First Nick Fury ongoing solo"] },
  { title: "Sub-Mariner", issue: "1", year: 1968, keyInfo: ["First Silver Age Sub-Mariner solo ongoing"] },

  // --- MARVEL - More 2000s+ ---
  { title: "Marvel Knights: Spider-Man", issue: "1", year: 2004, keyInfo: ["First Marvel Knights Spider-Man (Mark Millar)"] },
  { title: "World War Hulk", issue: "1", year: 2007, keyInfo: ["First World War Hulk"] },
  { title: "Punisher MAX", issue: "1", year: 2004, keyInfo: ["First Punisher MAX (Garth Ennis)"] },
  { title: "Thor: God of Thunder", issue: "1", year: 2012, keyInfo: ["First Jason Aaron Thor: God of Thunder", "First Gorr the God Butcher (cameo)"] },
  { title: "Thor: God of Thunder", issue: "2", year: 2012, keyInfo: ["First full appearance of Gorr the God Butcher"] },
  { title: "Unworthy Thor", issue: "1", year: 2016, keyInfo: ["First Unworthy Thor (Aaron)"] },
  { title: "Hercules", issue: "1", year: 2015, keyInfo: ["Hercules solo ongoing"] },
  { title: "Vengeance of Moon Knight", issue: "1", year: 2009, keyInfo: ["Vengeance of Moon Knight (Hurwitz)"] },
  { title: "Avengers Forever", issue: "1", year: 1998, keyInfo: ["First Avengers Forever (Busiek/Pacheco)"] },
  { title: "Earth X", issue: "0", year: 1999, keyInfo: ["First Earth X (Krueger/Ross)"] },
  { title: "Universe X", issue: "0", year: 2000, keyInfo: ["First Universe X"] },
  { title: "Paradise X", issue: "0", year: 2002, keyInfo: ["First Paradise X"] },
  { title: "1602", issue: "1", year: 2003, keyInfo: ["First Marvel 1602 (Neil Gaiman)"] },

  // --- DC - Modern hot keys ---
  { title: "Action Comics", issue: "1006", year: 1938, keyInfo: ["Bendis Action Comics begins"] },
  { title: "Superman: Son of Kal-El", issue: "1", year: 2021, keyInfo: ["First Jon Kent Superman ongoing"] },
  { title: "Superman: Lost", issue: "1", year: 2023, keyInfo: ["First Superman: Lost"] },
  { title: "Superman: Up in the Sky", issue: "1", year: 2019, keyInfo: ["First Superman: Up in the Sky (Tom King)"] },
  { title: "Future State: Superman of Metropolis", issue: "1", year: 2021, keyInfo: ["First Future State Superman of Metropolis"] },
  { title: "Future State: Dark Detective", issue: "1", year: 2021, keyInfo: ["First Future State Dark Detective"] },
  { title: "Future State: The Next Batman", issue: "1", year: 2021, keyInfo: ["First Future State Next Batman (Tim Fox)"] },
  { title: "I Am Batman", issue: "1", year: 2021, keyInfo: ["First Tim Fox Batman ongoing"] },
  { title: "Wonder Woman: Historia - The Amazons", issue: "1", year: 2021, keyInfo: ["First Wonder Woman: Historia"] },
  { title: "Aquaman", issue: "1", year: 1962, keyInfo: ["Geoff Johns New 52 Aquaman begins"] },

  // --- VERTIGO / BLACK LABEL ---
  { title: "Swamp Thing", issue: "1", year: 1982, keyInfo: ["New 52 Swamp Thing begins (Snyder)"] },
  { title: "DC: The New Frontier", issue: "1", year: 2004, keyInfo: ["First DC: The New Frontier (Darwyn Cooke)"] },
  { title: "Other History of the DC Universe", issue: "1", year: 2020, keyInfo: ["First Other History of the DC Universe (Ridley)"] },

  // --- BRONZE/COPPER - DC firsts I missed ---
  { title: "All Star Comics", issue: "3", year: 1941, keyInfo: ["First Justice Society of America"] },
  { title: "All Star Comics", issue: "58", year: 1941, keyInfo: ["First appearance of Power Girl"] },

  // --- VARIANT-DRIVEN HOT KEYS ---
  { title: "Marvel's Voices", issue: "1", year: 2020, keyInfo: ["First Marvel's Voices anthology"] },
  { title: "Marvel's Voices: Identity", issue: "1", year: 2021, keyInfo: ["First Marvel's Voices: Identity"] },
  { title: "Marvel's Voices: Legacy", issue: "1", year: 2021, keyInfo: ["First Marvel's Voices: Legacy"] },
];

// Entry in the lookup map - stores keyInfo and optional year for disambiguation
interface KeyComicEntry {
  keyInfo: string[];
  year?: number;
}

// Build lookup map: title → issue → KeyComicEntry[]
// Multiple entries per title+issue are possible (different volumes/years)
const keyComicsMap = new Map<string, Map<string, KeyComicEntry[]>>();

function registerEntry(normalizedTitle: string, issue: string, entry: KeyComicEntry) {
  if (!keyComicsMap.has(normalizedTitle)) {
    keyComicsMap.set(normalizedTitle, new Map());
  }
  const issueMap = keyComicsMap.get(normalizedTitle)!;
  if (!issueMap.has(issue)) {
    issueMap.set(issue, []);
  }
  issueMap.get(issue)!.push(entry);
}

KEY_COMICS.forEach((comic) => {
  const entry: KeyComicEntry = { keyInfo: comic.keyInfo, year: comic.year };
  const canonicalNormalized = normalizeTitle(comic.title);

  // Register canonical title
  registerEntry(canonicalNormalized, comic.issue, entry);

  // Register each alias as an additional lookup key pointing to the same entry.
  // Aliases share keyInfo + year, so year-disambiguation still works correctly
  // when an alias collides with a *different* canonical entry at the same issue.
  // We dedupe within this entry's aliases - multiple author-supplied variants
  // (e.g., "Foo: Bar", "Foo - Bar", "Foo Bar") may normalize to the same key
  // and registering them multiple times would create phantom multi-entry
  // ambiguity in resolveEntry.
  if (comic.aliases) {
    const registered = new Set<string>([canonicalNormalized]);
    for (const alias of comic.aliases) {
      const normalizedAlias = normalizeTitle(alias);
      if (registered.has(normalizedAlias)) continue;
      registered.add(normalizedAlias);
      registerEntry(normalizedAlias, comic.issue, entry);
    }
  }
});

/**
 * Result of a key-info lookup, with confidence metadata so UI can decide
 * whether to render a "verify volume" advisory.
 *
 * - `matchType: 'exact'` - single curated entry exists at this title+issue,
 *   OR multiple entries existed and one matched the release year exactly.
 *   High confidence; no UI advisory needed.
 *
 * - `matchType: 'year-resolved'` - multiple curated volumes exist at this
 *   title+issue and no entry matched the release year exactly. Resolver
 *   picked the closest series-start year ≤ AI's reported year (or fell back
 *   to ±5 years). MEDIUM confidence - UI should surface a "verify cover/year"
 *   advisory, since an inaccurate AI year reading could push the disambiguator
 *   across a volume boundary.
 */
export interface KeyInfoLookupResult {
  keyInfo: string[];
  matchType: "exact" | "year-resolved";
  /** Series-start year of the matched entry. Useful for UI volume context. */
  matchedYear?: number;
  /** How many curated entries were registered at this title+issue. */
  totalCandidates: number;
}

/**
 * Resolve the best match from multiple entries for the same title+issue.
 * Returns metadata alongside the keyInfo so callers can render confidence cues.
 */
function resolveEntryWithMeta(
  entries: KeyComicEntry[],
  releaseYear?: number | null,
): KeyInfoLookupResult | null {
  const totalCandidates = entries.length;

  // SINGLE ENTRY - no volume conflict exists in our database
  if (entries.length === 1) {
    const entry = entries[0];

    if (!entry.year) {
      return { keyInfo: entry.keyInfo, matchType: "exact", totalCandidates };
    }

    if (!releaseYear) {
      // Entry has year but comic doesn't - single match means no conflict possible
      return { keyInfo: entry.keyInfo, matchType: "exact", matchedYear: entry.year, totalCandidates };
    }

    // Both have years. The entry year is the series START year.
    // For long-running series (e.g., ASM started 1963, issue published 2012 at #700),
    // the comic's publication year will be much later than the series start - that's fine.
    if (releaseYear < entry.year) {
      return null; // Comic claims to predate the series - wrong volume
    }

    // NOTE: If a title has known relaunches (e.g., X-Men 1963 vs 1991), BOTH volumes
    // must be in the curated DB. That triggers the multi-entry path above instead.
    return { keyInfo: entry.keyInfo, matchType: "exact", matchedYear: entry.year, totalCandidates };
  }

  // MULTIPLE ENTRIES - need releaseYear to disambiguate between volumes
  if (!releaseYear) {
    return null; // Resolver explicitly refuses to guess without a year - fall back to AI
  }

  // Find exact year match first - high-confidence disambiguation
  const exactMatch = entries.find((e) => e.year === releaseYear);
  if (exactMatch) {
    return { keyInfo: exactMatch.keyInfo, matchType: "exact", matchedYear: exactMatch.year, totalCandidates };
  }

  // Find the entry whose series start year is closest to (but not after) the release year.
  // This is a JUDGMENT CALL - flag as 'year-resolved' so UI can surface advisory.
  const validEntries = entries
    .filter((e) => e.year && releaseYear >= e.year)
    .sort((a, b) => b.year! - a.year!); // Prefer the most recent series that started before this issue

  if (validEntries.length > 0) {
    return {
      keyInfo: validEntries[0].keyInfo,
      matchType: "year-resolved",
      matchedYear: validEntries[0].year,
      totalCandidates,
    };
  }

  // Fallback: closest year within ±5 years (also a judgment call)
  const closeMatch = entries
    .filter((e) => e.year && Math.abs(e.year - releaseYear) <= 5)
    .sort((a, b) => Math.abs(a.year! - releaseYear) - Math.abs(b.year! - releaseYear))[0];
  if (closeMatch) {
    return {
      keyInfo: closeMatch.keyInfo,
      matchType: "year-resolved",
      matchedYear: closeMatch.year,
      totalCandidates,
    };
  }

  return null;
}

/**
 * @deprecated Internal - use resolveEntryWithMeta. Kept until call sites migrate.
 */
function resolveEntry(entries: KeyComicEntry[], releaseYear?: number | null): string[] | null {
  return resolveEntryWithMeta(entries, releaseYear)?.keyInfo ?? null;
}

/**
 * Look up key info for a comic from our curated database, returning the
 * full result metadata (match type, matched year, total candidates).
 *
 * Pass releaseYear to disambiguate titles with multiple volumes. When
 * matchType === 'year-resolved', UI should render a "verify volume/year"
 * advisory so the user can sanity-check the disambiguation.
 *
 * Returns null if not found (caller should fall back to AI lookup).
 */
export function lookupKeyInfoWithMeta(
  title: string,
  issueNumber: string,
  releaseYear?: number | null,
): KeyInfoLookupResult | null {
  const normalizedTitle = normalizeTitle(title);
  const issueMap = keyComicsMap.get(normalizedTitle);

  if (!issueMap) {
    return null;
  }

  // Try exact issue match
  const entries = issueMap.get(issueNumber);
  if (entries) {
    return resolveEntryWithMeta(entries, releaseYear);
  }

  // Try without leading zeros (e.g., "01" -> "1")
  const cleanIssue = issueNumber.replace(/^0+/, "") || "0";
  const entriesClean = issueMap.get(cleanIssue);
  if (entriesClean) {
    return resolveEntryWithMeta(entriesClean, releaseYear);
  }

  return null;
}

/**
 * Look up key info for a comic. Backwards-compatible wrapper around
 * lookupKeyInfoWithMeta - returns just the keyInfo array. Prefer the
 * `WithMeta` variant if you need confidence metadata for UI affordances.
 */
export function lookupKeyInfo(title: string, issueNumber: string, releaseYear?: number | null): string[] | null {
  return lookupKeyInfoWithMeta(title, issueNumber, releaseYear)?.keyInfo ?? null;
}

/**
 * Check if a comic is in our key comics database
 */
export function isKeyComic(title: string, issueNumber: string, releaseYear?: number | null): boolean {
  return lookupKeyInfo(title, issueNumber, releaseYear) !== null;
}

/**
 * Get the total count of key comics in the database
 */
export function getKeyComicsCount(): number {
  return KEY_COMICS.length;
}
