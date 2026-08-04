// Poem composer: selects and orders liked-song titles so they read as a poem.
//
// A playlist poem has an arc:
//   opener  — a feeling or address ("I guess I just feel like", "When you're around")
//   body    — imagery and statements that develop the theme
//   turn    — a shift about two-thirds through (a question, "But...", time passing)
//   closer  — a cadence that resolves ("I will not say goodbye", "Until the day I die")

// ---------- title cleanup ----------

const NOISE_PATTERNS = [
  /\s*[([][^)\]]*(remaster|remastered|deluxe|live|acoustic|demo|mono|stereo|edit|version|mix|feat\.?|ft\.?|with |bonus|single|radio|explicit|instrumental|from |session)[^)\]]*[)\]]/gi,
  /\s+-\s+(\d{4}\s+)?(remaster(ed)?|live|acoustic|demo|mono|stereo|single version|radio edit|album version|bonus track|deluxe|remix|re-?recorded).*$/i,
  /\s+-\s+(feat\.?|ft\.?|with)\s.*$/i,
];

export function cleanTitle(raw) {
  let t = raw;
  for (const p of NOISE_PATTERNS) t = t.replace(p, "");
  return t.replace(/\s+/g, " ").trim() || raw.trim();
}

// ---------- language helpers ----------

const STOPWORDS = new Set(
  "a an the and or but so of to in on at for with from by is are was were be been am it its it's this that these those as if then than there here my your our his her their me you we they i he she them us up down out off over under into onto all some no not do does did don't can't won't will would can could should what when where why how who oh la na hey yeah ooh gonna wanna got get like just really very more most about".split(" ")
);

// Small concept lexicon so "night" matches "moon", "stars", "dark"...
const THEMES = {
  love: "love lover loving loved heart hearts kiss kissing darling baby honey sweet valentine romance adore devotion tender",
  loss: "goodbye gone lost lose losing missing miss cry crying tears broken break apart leave leaving left alone lonely empty fade grief mourn",
  night: "night midnight moon moonlight stars star dark darkness evening dusk sleep dream dreams dreaming twilight",
  morning: "morning sunrise dawn sun sunshine daylight wake waking awake new day",
  summer: "summer july june august sunshine beach heat golden warm sunburn vacation",
  winter: "winter snow cold december frost ice freeze january chill",
  autumn: "autumn fall september october november leaves harvest amber",
  spring: "spring april may bloom blossom flowers rain green",
  home: "home house door porch garden hometown roots stay belong kitchen bed",
  road: "road drive driving highway car wheels travel wander journey miles run running walk walking go going leaving train ride",
  water: "water ocean sea river rain waves tide swim drown shore island storm",
  sky: "sky skies clouds fly flying wings birds air wind blow horizon sun moon stars space",
  fire: "fire flame flames burn burning light spark ember smoke ash",
  time: "time clock hours minutes years yesterday tomorrow today forever always never wait waiting soon someday moment memory memories remember age old young",
  hope: "hope hoping believe faith light rise rising shine better tomorrow dream wish pray",
  dance: "dance dancing move moving groove rhythm music song sing singing party",
  family: "mother father mom dad sister brother son daughter family child children kid grandma grandpa",
  friend: "friend friends buddy together company",
  work: "work working money job boss dollar grind hustle build building",
  peace: "peace quiet calm still silence easy slow breathe rest gentle soft",
  sad: "sad sadness blue lonely sorrow hurt pain ache tears down low depressing",
  joy: "happy happiness joy smile laugh laughing good great wonderful beautiful alive celebrate",
  farewell: "goodbye farewell adios leaving gone last final end ending over done",
  distance: "far away distance miles apart across oceans overseas long",
  courage: "brave courage fear afraid scared strong stronger fight fighting stand rise",
  future: "future tomorrow someday soon ahead forward next new begin beginning start",
};

const THEME_INDEX = (() => {
  const idx = new Map();
  for (const [theme, words] of Object.entries(THEMES)) {
    for (const w of words.split(" ")) {
      if (!idx.has(w)) idx.set(w, new Set());
      idx.get(w).add(theme);
    }
  }
  return idx;
})();

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z']+/g) || []).map((w) => w.replace(/^'+|'+$/g, ""));
}

function themesOf(tokens) {
  const found = new Set();
  for (const t of tokens) {
    const ts = THEME_INDEX.get(t) || THEME_INDEX.get(t.replace(/s$/, ""));
    if (ts) for (const th of ts) found.add(th);
  }
  return found;
}

// ---------- line roles ----------

const OPENER_STARTS = /^(i |i'm |i've |i'll |we |we're |you |you're |your |it's |this |these |sometimes |when |lately |all |every |dear |hello |hey |here |there's |my |the first)/i;
const CONNECTOR_STARTS = /^(and |but |so |then |now |'?cause |because |still |even |until |till |after |before |maybe |or |if )/i;
const QUESTION_HINTS = /^(why |what |where |who |how |do |does |did |will |would |can |could |are |is |am )|[?]$/i;
const CLOSER_HINTS = /(goodbye|farewell|the end|forever|always|never let|won't let|die|dying|sleep|rest|amen|home|stay|remain|till the|until the|eternity|evermore|last|still be|be loving you|hold on|let go|see you|meet again|carry me)/i;

export function classifyLine(title) {
  const roles = [];
  if (OPENER_STARTS.test(title)) roles.push("opener");
  if (CONNECTOR_STARTS.test(title)) roles.push("connector");
  if (QUESTION_HINTS.test(title)) roles.push("question");
  if (CLOSER_HINTS.test(title)) roles.push("closer");
  if (!roles.length) roles.push("image");
  return roles;
}

// ---------- scoring ----------

function scoreTrack(track, topicTokens, topicThemes) {
  const tokens = track._tokens;
  let score = 0;
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (topicTokens.has(t)) score += 4;
    else if (topicTokens.has(t.replace(/s$/, "")) || topicTokens.has(t + "s")) score += 3;
  }
  for (const th of track._themes) if (topicThemes.has(th)) score += 2;
  const wc = tokens.length;
  if (wc >= 2 && wc <= 6) score += 1; // readable line length
  if (wc > 9) score -= 1;
  return score;
}

// ---------- seeded shuffle so "regenerate" gives a new-but-stable poem ----------

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- composer ----------

export function prepareLibrary(tracks) {
  return tracks.map((t) => {
    const line = cleanTitle(t.title);
    const tokens = tokenize(line);
    return {
      ...t,
      line,
      _tokens: tokens,
      _themes: themesOf(tokens),
      _roles: classifyLine(line),
    };
  });
}

/**
 * Compose a poem.
 * @param {Array} library  prepared tracks (from prepareLibrary)
 * @param {string} title   the poem's title
 * @param {string} about   optional extra description
 * @param {number} target  desired number of lines
 * @param {number} seed    change to regenerate a different poem
 * @returns {Array} ordered subset of library
 */
export function composePoem(library, title, about = "", target = 14, seed = 1) {
  const rand = mulberry32(seed * 2654435761);
  const topicTokens = new Set(tokenize(title + " " + about).filter((t) => !STOPWORDS.has(t)));
  const topicThemes = themesOf([...topicTokens]);

  // Score everything. On-topic tracks always outrank neutral ones; the random
  // jitter only reshuffles within those bands so "regenerate" explores the
  // library without letting off-topic lines crowd out relevant ones.
  const scored = library
    .map((t) => {
      const base = scoreTrack(t, topicTokens, topicThemes);
      return { t, base, s: base * 10 + rand() * 8 };
    })
    .sort((a, b) => b.s - a.s);

  const poolSize = Math.max(target * 6, 60);
  const pool = scored.slice(0, poolSize).map((x) => x.t);
  const used = new Set();
  const lines = [];

  const pick = (predicate) => {
    let best = null;
    for (const t of pool) {
      if (used.has(t.uri || t.line)) continue;
      if (predicate && !predicate(t)) continue;
      // avoid starting adjacent lines with the same word, or same artist twice in a row
      const prev = lines[lines.length - 1];
      if (prev) {
        if (prev._tokens[0] && prev._tokens[0] === t._tokens[0]) continue;
        if (prev.artist && prev.artist === t.artist) continue;
      }
      best = t;
      break;
    }
    if (best) {
      used.add(best.uri || best.line);
      lines.push(best);
    }
    return best;
  };

  const hasRole = (r) => (t) => t._roles.includes(r);
  const notRole = (r) => (t) => !t._roles.includes(r);

  // 1. opener
  pick(hasRole("opener")) || pick(notRole("closer")) || pick();

  // 2. body with a turn ~2/3 through
  const bodyCount = Math.max(target - 4, 4);
  const turnAt = Math.floor(bodyCount * 0.62);
  for (let i = 0; i < bodyCount; i++) {
    if (i === turnAt) {
      pick(hasRole("question")) || pick(hasRole("connector")) || pick();
      continue;
    }
    // alternate texture: image, image, connector...
    if (i % 3 === 2) pick(hasRole("connector")) || pick(notRole("closer")) || pick();
    else pick(notRole("closer")) || pick();
  }

  // 3. closing cadence: 2–3 closers, strongest ending last
  const FINALITY = [
    [/(die|dying|the end|eternity|evermore|until the|till the)/i, 4],
    [/(goodbye|farewell|see you|meet again|last)/i, 3],
    [/(forever|always|never let|won't let|still be|rest|sleep|amen)/i, 2],
  ];
  const finality = (t) => FINALITY.reduce((s, [re, w]) => (re.test(t.line) ? s + w : s), 0);

  const closerWanted = target >= 16 ? 3 : 2;
  const closers = [];
  for (let i = 0; i < closerWanted; i++) {
    const c = pick(hasRole("closer"));
    if (c) { closers.push(c); lines.pop(); }
  }
  closers.sort((a, b) => finality(a) - finality(b));

  // pad the body (never after the ending) if the library ran short
  while (lines.length + closers.length < target && pick(notRole("closer"))) { /* keep padding */ }

  lines.push(...closers);
  return lines;
}

/** Alternative lines for swapping one out — same vibe, not used yet. */
export function suggestAlternatives(library, poemLines, replacing, title, about, limit = 12) {
  const topicTokens = new Set(tokenize(title + " " + about).filter((t) => !STOPWORDS.has(t)));
  const topicThemes = themesOf([...topicTokens]);
  const usedKeys = new Set(poemLines.map((l) => l.uri || l.line));
  const sameRole = new Set(replacing?._roles || []);

  return library
    .filter((t) => !usedKeys.has(t.uri || t.line))
    .map((t) => {
      let s = scoreTrack(t, topicTokens, topicThemes);
      if (t._roles.some((r) => sameRole.has(r))) s += 2;
      return { t, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

export function poemToText(lines) {
  return lines.map((l) => l.line).join("\n");
}
