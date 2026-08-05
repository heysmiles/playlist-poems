// Poem composer: selects and orders liked-song titles so they read as a poem.
//
// The poem is written the way a person writes one — line by line. The first
// line sets a feeling (or the user chooses it). Every next line is chosen by
// how well it FOLLOWS what came before: the previous line most of all, the
// line before that a little, the poem's accumulated mood after that, and the
// title only as a gentle pull. Grammar matters too — a line ending mid-thought
// ("I will follow you into...") wants a line that completes it. The poem still
// gets an arc: a turn about two-thirds through, and a closing cadence.

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

// Small concept lexicon so "night" can pull toward "moon", "stars", "dark"...
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

// ---------- line roles & grammar ----------

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

// A line that ends mid-thought invites the next line to complete it.
const DANGLING_END = new Set(
  "in into on onto of to for with without from by at around through like as before after until till near over under beneath beyond about the a an my your our his her their and or but so if when where because 'cause is are was were be am feel feels need needs want wants love loves see know knows found take hold make let gonna wanna will would could should can don't won't can't say keep got have had give bring watch hear call miss remember you me".split(" ")
);
// A natural way to pick up a dangling thought.
const COMPLETION_START = new Set(
  "the a an my your our his her their this that these those i i'm i'll i've you you're we we're it it's there here me us them him her everything nothing something someone everybody nobody".split(" ")
);
const ANSWER_START = /^(i |i'm |i'll |i've |'?cause |because |maybe |yes |no |well |guess |i don't|it's |only |just )/i;

const FINALITY = [
  [/(die|dying|the end|eternity|evermore|until the|till the)/i, 4],
  [/(goodbye|farewell|see you|meet again|last )/i, 3],
  [/(forever|always|never let|won't let|still be|rest|sleep|amen|carry me|home)/i, 2],
];
function finality(t) {
  return FINALITY.reduce((s, [re, w]) => (re.test(t.line) ? s + w : s), 0);
}

// ---------- seeded RNG so "regenerate" gives a new-but-stable poem ----------

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- library prep ----------

export function prepareLibrary(tracks) {
  return tracks.map((t) => {
    const line = cleanTitle(t.title);
    const tokens = tokenize(line);
    return {
      ...t,
      line,
      _tokens: tokens,
      _content: [...new Set(tokens.filter((w) => !STOPWORDS.has(w)))],
      _themes: themesOf(tokens),
      _roles: classifyLine(line),
    };
  });
}

export function trackKey(t) {
  return t.uri || `${t.line}::${t.artist}`;
}

/** Find a track in the library by (fuzzy) title, optionally narrowed by artist. */
export function findTrack(library, title, artist = "") {
  const wantTitle = cleanTitle(title).toLowerCase();
  const wantArtist = artist.trim().toLowerCase();
  if (!wantTitle) return null;
  const candidates = library.filter((t) => {
    const have = t.line.toLowerCase();
    const titleHit = have === wantTitle || have.includes(wantTitle) || wantTitle.includes(have);
    const artistHit = !wantArtist || t.artist.toLowerCase().includes(wantArtist);
    return titleHit && artistHit;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const ax = a.line.toLowerCase() === wantTitle ? 0 : 1;
    const bx = b.line.toLowerCase() === wantTitle ? 0 : 1;
    return ax - bx || a.line.length - b.line.length;
  });
  return candidates[0];
}

// ---------- scoring the NEXT line, given what's already written ----------

function overlapScore(aContent, bContent) {
  if (!aContent.length || !bContent.length) return 0;
  let n = 0;
  const bSet = new Set(bContent);
  for (const w of aContent) {
    if (bSet.has(w) || bSet.has(w + "s") || bSet.has(w.replace(/s$/, ""))) n++;
  }
  return n;
}

function themeOverlap(aThemes, bThemes) {
  let n = 0;
  for (const th of aThemes) if (bThemes.has(th)) n++;
  return n;
}

function scoreNext(cand, ctx) {
  const { prev, prev2, moodCounts, wordCounts, topicContent, topicThemes, anaphoraRun, position, target, rand } = ctx;
  let s = 0;

  // Every association channel decays as its word/theme gets used, so the
  // poem moves through associations instead of circling one word forever.
  const wordUse = (w) =>
    wordCounts.get(w) || wordCounts.get(w + "s") || wordCounts.get(w.replace(/s$/, "")) || 0;
  const wordLink = (w) => 1 / (1 + wordUse(w));
  const themeLink = (th) => 1 / (1 + (moodCounts.get(th) || 0) * 0.5);

  const matches = (set, w) => set.has(w) || set.has(w + "s") || set.has(w.replace(/s$/, ""));

  // 1. Follow the previous line (the strongest voice in the room)
  if (prev) {
    const prevSet = new Set(prev._content);
    for (const w of cand._content) if (matches(prevSet, w)) s += 3 * wordLink(w);
    for (const th of cand._themes) if (prev._themes.has(th)) s += 2.5 * themeLink(th);
  }
  // 2. ...and the line before it, more faintly
  if (prev2) {
    const prev2Set = new Set(prev2._content);
    for (const w of cand._content) if (matches(prev2Set, w)) s += 1.2 * wordLink(w);
    for (const th of cand._themes) if (prev2._themes.has(th)) s += 1 * themeLink(th);
  }
  // 3. The poem's accumulated mood (every line so far votes on the themes)
  let mood = 0;
  for (const th of cand._themes) mood += Math.min(moodCounts.get(th) || 0, 3) * 0.4;
  s += Math.min(mood, 2.5);

  // 4. A gentle pull from the title/description — an anchor, not a filter
  //    (it decays too: once the poem has said "new" twice, stop pushing it)
  const topicSet = new Set(topicContent);
  for (const w of cand._content) if (matches(topicSet, w)) s += 1.5 * wordLink(w);
  for (const th of cand._themes) if (topicThemes.has(th)) s += 0.8 * themeLink(th);

  // 5. Grammar: does this line pick up where the last one left off?
  if (prev) {
    const prevLast = prev._tokens[prev._tokens.length - 1];
    const candFirst = cand._tokens[0];
    const prevDangles = DANGLING_END.has(prevLast);
    if (prevDangles && COMPLETION_START.has(candFirst)) s += 3;
    if (prev._roles.includes("question") && ANSWER_START.test(cand.line)) s += 2.5;
    if (cand._roles.includes("connector")) s += 1.2;

    // Anaphora ("I think... / I think... "): lovely once, tired by the fourth time
    if (candFirst && candFirst === prev._tokens[0]) {
      s += anaphoraRun === 1 ? 2 : anaphoraRun === 2 ? 0.5 : -4;
    }
    if (prev.artist && prev.artist === cand.artist) s -= 2;
  }

  // 6. Don't ride one word into the ground — an echo is nice, a rut isn't
  let repetition = 0;
  for (const w of cand._content) repetition += Math.max(wordUse(w) - 1, 0);
  s -= Math.min(repetition * 2.2, 6);

  // 7. Readable line length
  const wc = cand._tokens.length;
  if (wc >= 2 && wc <= 6) s += 0.8;
  if (wc > 9) s -= 1;

  // 8. The arc: hold endings back, then lean into them; a question near the turn
  const progress = position / Math.max(target - 1, 1);
  const fin = finality(cand);
  if (cand._roles.includes("closer") || fin > 0) {
    if (progress < 0.7) s -= 2.5 + fin * 1.5;
    else s += fin * 1.4 * ((progress - 0.7) / 0.3);
  }
  const turnAt = Math.round(target * 0.62);
  if (cand._roles.includes("question") && Math.abs(position - turnAt) <= 1) s += 2;
  if (cand._roles.includes("question") && progress > 0.85) s -= 2; // don't end on a shrug

  // 9. A little chance, so regenerating explores
  s += rand() * 1.4;
  return s;
}

// ---------- composer ----------

/**
 * Compose a poem, one line at a time.
 * @param {Array}  library   prepared tracks (from prepareLibrary)
 * @param {string} title     the poem's title
 * @param {string} about     optional extra description
 * @param {number} target    desired number of lines
 * @param {number} seed      change to regenerate a different poem
 * @param {Object} firstSong optional track (from this library) to open with
 * @returns {Array} ordered subset of library
 */
export function composePoem(library, title, about = "", target = 14, seed = 1, firstSong = null) {
  const rand = mulberry32(seed * 2654435761);
  const topicTokens = tokenize(title + " " + about);
  const topicContent = topicTokens.filter((w) => !STOPWORDS.has(w));
  const topicThemes = themesOf(topicTokens);

  const used = new Set();
  const lines = [];
  const moodCounts = new Map();
  const wordCounts = new Map();

  const commit = (t) => {
    used.add(trackKey(t));
    used.add(t.line.toLowerCase()); // same title from a different artist is still the same line
    lines.push(t);
    for (const th of t._themes) moodCounts.set(th, (moodCounts.get(th) || 0) + 1);
    for (const w of t._content) wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  };

  // --- line 1: the user's choice, or the best opening feeling ---
  if (firstSong) {
    commit(firstSong);
  } else {
    let best = null, bestScore = -Infinity;
    for (const t of library) {
      let s = overlapScore(t._content, topicContent) * 2.5 + themeOverlap(t._themes, topicThemes) * 1.5;
      if (t._roles.includes("opener")) s += 2.5;
      if (t._roles.includes("closer") || finality(t) > 0) s -= 3;
      if (t._tokens.length >= 2 && t._tokens.length <= 7) s += 0.8;
      s += rand() * 1.6;
      if (s > bestScore) { bestScore = s; best = t; }
    }
    if (!best) return [];
    commit(best);
  }

  // --- every next line follows from what's written so far ---
  let anaphoraRun = 0;
  while (lines.length < target) {
    const prev = lines[lines.length - 1];
    const prev2 = lines[lines.length - 2] || null;
    const ctx = {
      prev, prev2, moodCounts, wordCounts, topicContent, topicThemes,
      anaphoraRun, position: lines.length, target, rand,
    };
    const usedLines = lines.map((l) => l.line.toLowerCase());
    let best = null, bestScore = -Infinity;
    for (const t of library) {
      if (used.has(trackKey(t)) || used.has(t.line.toLowerCase())) continue;
      const cl = t.line.toLowerCase();
      if (usedLines.some((u) => u.includes(cl) || cl.includes(u))) continue; // "Last Goodbye" after "The Last Goodbye"
      const s = scoreNext(t, ctx);
      if (s > bestScore) { bestScore = s; best = t; }
    }
    if (!best) break; // library exhausted
    anaphoraRun = best._tokens[0] === prev._tokens[0] ? anaphoraRun + 1 : 0;
    commit(best);
  }

  // --- make sure the poem lands: strongest ending last ---
  const tail = lines.slice(-3);
  tail.sort((a, b) => finality(a) - finality(b));
  lines.splice(lines.length - 3, 3, ...tail);

  return lines;
}

/** Alternative lines for swapping one out — what would follow just as well. */
export function suggestAlternatives(library, poemLines, replacing, title, about, limit = 12) {
  const idx = poemLines.indexOf(replacing);
  const prev = idx > 0 ? poemLines[idx - 1] : null;
  const prev2 = idx > 1 ? poemLines[idx - 2] : null;
  const topicTokens = tokenize(title + " " + about);
  const topicContent = topicTokens.filter((w) => !STOPWORDS.has(w));
  const topicThemes = themesOf(topicTokens);
  const moodCounts = new Map();
  const wordCounts = new Map();
  for (const l of poemLines) {
    for (const th of l._themes) moodCounts.set(th, (moodCounts.get(th) || 0) + 1);
    for (const w of l._content) wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  }
  const usedKeys = new Set(poemLines.map(trackKey));
  const rand = mulberry32(idx + 99);
  const ctx = {
    prev, prev2, moodCounts, wordCounts, topicContent, topicThemes,
    anaphoraRun: 0, position: Math.max(idx, 0), target: Math.max(poemLines.length, 1), rand,
  };

  return library
    .filter((t) => !usedKeys.has(trackKey(t)))
    .map((t) => ({ t, s: scoreNext(t, ctx) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

export function poemToText(lines) {
  return lines.map((l) => l.line).join("\n");
}
