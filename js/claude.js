// Optional Claude-powered composer. The user's Anthropic API key is sent
// directly from the browser to Anthropic (CORS-enabled) and kept only in memory.

const MODEL = "claude-sonnet-5";
const MAX_CANDIDATES = 900;

import { prepareLibrary, composePoem } from "./poem.js";

export async function composeWithClaude(apiKey, library, title, about, target) {
  // Trim huge libraries: keep the heuristically-relevant half plus a random slice
  // for variety, so the prompt stays a reasonable size.
  let candidates = library;
  if (library.length > MAX_CANDIDATES) {
    const relevant = composePoem(library, title, about, MAX_CANDIDATES / 2, 7);
    const keys = new Set(relevant.map((t) => t.uri || t.line));
    const rest = library.filter((t) => !keys.has(t.uri || t.line));
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    candidates = [...relevant, ...rest.slice(0, MAX_CANDIDATES - relevant.length)];
  }

  const numbered = candidates.map((t, i) => `${i}. ${t.line} — ${t.artist}`).join("\n");
  const prompt = `You are a poet who writes "playlist poems": poems built ONLY from existing song titles, in order, so that reading the playlist top to bottom reads as a poem.

Poem title: "${title}"
${about ? `It should also be about: ${about}` : ""}

Rules:
- Use ONLY songs from the numbered list below. Never invent songs.
- Pick ${Math.max(target - 3, 8)}–${target + 3} songs whose TITLES, read in order, form the poem.
- Give it an arc: an opening line that sets a feeling, development, a turn about two-thirds in, and a closing cadence that resolves (the last 2-3 lines should land like an ending).
- Titles should flow into each other grammatically where possible.
- Respond with ONLY a JSON array of the chosen song numbers in poem order, e.g. [12, 5, 88].

Songs:
${numbered}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? "Anthropic API key was rejected." : `Claude request failed: ${err}`);
  }
  const data = await res.json();
  const text = data.content?.map((b) => b.text || "").join("") || "";
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error("Claude didn't return a song list — try again.");
  const indices = JSON.parse(match[0]);
  const lines = indices.map((i) => candidates[i]).filter(Boolean);
  if (lines.length < 4) throw new Error("Claude returned too few songs — try again.");
  return lines;
}
