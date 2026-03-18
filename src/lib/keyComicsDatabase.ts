/**
 * Key Comics Database
 *
 * Curated list of 400+ key comics with guaranteed accurate key info.
 * This database is checked FIRST before falling back to AI lookup.
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
  year?: number; // Release year — required for titles with multiple volumes (e.g., X-Men 1963 vs 1991)
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
  { title: "Tales of Suspense", issue: "39", year: 1963, keyInfo: ["First appearance of Iron Man"] },
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
  { title: "Journey Into Mystery", issue: "83", year: 1962, keyInfo: ["First appearance of Thor"] },
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
  { title: "Marvel Premiere", issue: "15", year: 1972, keyInfo: ["First appearance of Iron Fist"] },
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
  },
  { title: "Ghost Rider", issue: "1", year: 1973, keyInfo: ["First Ghost Rider solo"] },
  { title: "Tomb of Dracula", issue: "10", year: 1972, keyInfo: ["First appearance of Blade"] },
  { title: "Strange Tales", issue: "110", year: 1963, keyInfo: ["First Doctor Strange"] },
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
];

// Entry in the lookup map — stores keyInfo and optional year for disambiguation
interface KeyComicEntry {
  keyInfo: string[];
  year?: number;
}

// Build lookup map: title → issue → KeyComicEntry[]
// Multiple entries per title+issue are possible (different volumes/years)
const keyComicsMap = new Map<string, Map<string, KeyComicEntry[]>>();

KEY_COMICS.forEach((comic) => {
  const normalizedTitle = normalizeTitle(comic.title);
  if (!keyComicsMap.has(normalizedTitle)) {
    keyComicsMap.set(normalizedTitle, new Map());
  }
  const issueMap = keyComicsMap.get(normalizedTitle)!;
  if (!issueMap.has(comic.issue)) {
    issueMap.set(comic.issue, []);
  }
  issueMap.get(comic.issue)!.push({ keyInfo: comic.keyInfo, year: comic.year });
});

/**
 * Resolve the best match from multiple entries for the same title+issue.
 * - If releaseYear is provided and an entry has a matching year, use it.
 * - If releaseYear is provided and an entry has a year within ±5 years, use it.
 * - If only one entry exists (no year conflict), use it regardless.
 * - If multiple entries exist and no year matches, return null (ambiguous — let AI handle it).
 */
function resolveEntry(entries: KeyComicEntry[], releaseYear?: number | null): string[] | null {
  // SINGLE ENTRY — no volume conflict exists in our database
  if (entries.length === 1) {
    const entry = entries[0];

    if (!entry.year) {
      // No year on entry — safe to use, no conflict possible
      return entry.keyInfo;
    }

    if (!releaseYear) {
      // Entry has year but comic doesn't — trust the match since there's no conflict
      return entry.keyInfo;
    }

    // Both have years. The entry year is the series START year.
    // For long-running series (e.g., ASM started 1963, issue published 2012 at #700),
    // the comic's publication year will be much later than the series start — that's fine.
    if (releaseYear < entry.year) {
      // Comic claims to be published before the series started — wrong volume
      return null;
    }

    // Comic published after series started — valid match
    // NOTE: If a title has known relaunches (e.g., X-Men 1963 vs 1991), BOTH volumes
    // must be in the curated DB. That triggers the multi-entry path above instead.
    return entry.keyInfo;
  }

  // MULTIPLE ENTRIES — need releaseYear to disambiguate between volumes
  if (!releaseYear) {
    return null; // Can't pick without a year
  }

  // Find exact year match first
  const exactMatch = entries.find((e) => e.year === releaseYear);
  if (exactMatch) return exactMatch.keyInfo;

  // Find the entry whose series start year is closest to (but not after) the release year
  const validEntries = entries
    .filter((e) => e.year && releaseYear >= e.year)
    .sort((a, b) => b.year! - a.year!); // Prefer the most recent series that started before this issue

  if (validEntries.length > 0) return validEntries[0].keyInfo;

  // Fallback: find closest year within ±5 years
  const closeMatch = entries
    .filter((e) => e.year && Math.abs(e.year - releaseYear) <= 5)
    .sort((a, b) => Math.abs(a.year! - releaseYear) - Math.abs(b.year! - releaseYear))[0];
  if (closeMatch) return closeMatch.keyInfo;

  return null; // No matching volume found
}

/**
 * Look up key info for a comic from our curated database.
 * Pass releaseYear to disambiguate titles with multiple volumes.
 * Returns null if not found (should fall back to AI lookup).
 */
export function lookupKeyInfo(title: string, issueNumber: string, releaseYear?: number | null): string[] | null {
  const normalizedTitle = normalizeTitle(title);
  const issueMap = keyComicsMap.get(normalizedTitle);

  if (!issueMap) {
    return null;
  }

  // Try exact issue match
  const entries = issueMap.get(issueNumber);
  if (entries) {
    return resolveEntry(entries, releaseYear);
  }

  // Try without leading zeros (e.g., "01" -> "1")
  const cleanIssue = issueNumber.replace(/^0+/, "") || "0";
  const entriesClean = issueMap.get(cleanIssue);
  if (entriesClean) {
    return resolveEntry(entriesClean, releaseYear);
  }

  return null;
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
