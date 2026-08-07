import * as spotify from "./spotify.js";
import { prepareLibrary, composePoem, suggestAlternatives, poemToText, findTrack } from "./poem.js";
import { composeWithClaude } from "./claude.js";
import { DEMO_LIBRARY } from "./demo.js";
import { initExamples } from "./examples.js";

const $ = (id) => document.getElementById(id);

const state = {
  demo: false,
  library: [],      // prepared tracks
  poem: [],         // current ordered lines
  title: "",
  about: "",
  firstSong: null,  // user-chosen opening line
  seed: 1,
};

function show(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(screenId).classList.add("active");
  window.scrollTo(0, 0);
}

function setError(id, msg) {
  const el = $(id);
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

// ===================== connect =====================

$("redirect-uri-display").textContent = spotify.redirectUri();
$("btn-copy-uri").addEventListener("click", () => {
  navigator.clipboard.writeText(spotify.redirectUri());
  $("btn-copy-uri").textContent = "copied!";
  setTimeout(() => ($("btn-copy-uri").textContent = "copy"), 1500);
});

if (spotify.savedClientId() && spotify.savedClientId() !== spotify.DEFAULT_CLIENT_ID) {
  $("client-id").value = spotify.savedClientId();
}

$("btn-connect").addEventListener("click", () => {
  const id = $("client-id").value.trim() || spotify.DEFAULT_CLIENT_ID;
  spotify.beginAuth(id);
});

$("btn-demo").addEventListener("click", () => {
  state.demo = true;
  state.library = prepareLibrary(DEMO_LIBRARY);
  $("library-stats").textContent = `demo library · ${state.library.length} songs`;
  $("first-song-note").textContent = "The poem's first line.";
  show("screen-compose");
});

// the logo is the way home
$("btn-home-compose").addEventListener("click", () => show("screen-connect"));
$("btn-home-preview").addEventListener("click", () => show("screen-connect"));

$("btn-logout").addEventListener("click", () => {
  spotify.logout();
  state.demo = false;
  state.library = [];
  show("screen-connect");
});

// ===================== library loading =====================

async function loadLibrary() {
  show("screen-loading");
  try {
    const tracks = await spotify.getLikedSongs((done, total) => {
      $("progress-bar").style.width = total ? `${Math.round((done / total) * 100)}%` : "10%";
      $("progress-text").textContent = total ? `${done} of ${total} songs` : `${done} songs`;
    });
    if (!tracks.length) {
      alert("No Liked Songs found on this account — like some songs on Spotify first, then come back!");
      show("screen-connect");
      return;
    }
    state.demo = false;
    state.library = prepareLibrary(tracks);
    $("library-stats").textContent = `${state.library.length} liked songs`;
    $("first-song-note").textContent = "The poem's first line — it has to be a song in your library.";
    show("screen-compose");
  } catch (e) {
    alert(e.message);
    spotify.logout();
    show("screen-connect");
  }
}

// ===================== compose =====================

$("engine").addEventListener("change", () => {
  $("claude-key-row").classList.toggle("hidden", $("engine").value !== "claude");
});

$("btn-compose").addEventListener("click", async () => {
  const title = $("poem-title").value.trim();
  if (!title) { setError("compose-error", "Every poem needs a title."); $("poem-title").focus(); return; }
  setError("compose-error", "");

  state.title = title;
  state.about = $("poem-about").value.trim();
  state.seed = 1;
  const target = parseInt($("poem-length").value, 10);

  // optional user-chosen first line — must exist in the library
  const firstTitle = $("first-song-title").value.trim();
  const firstArtist = $("first-song-artist").value.trim();
  state.firstSong = null;
  if (firstTitle) {
    state.firstSong = findTrack(state.library, firstTitle, firstArtist);
    if (!state.firstSong) {
      setError("compose-error", `Couldn't find “${firstTitle}” in ${state.demo ? "the demo library" : "your Liked Songs"} — check the spelling, or leave it blank.`);
      return;
    }
  }

  const btn = $("btn-compose");
  btn.disabled = true;
  btn.textContent = "Composing…";
  try {
    if ($("engine").value === "claude") {
      const key = $("claude-key").value.trim();
      if (!key) throw new Error("Enter your Anthropic API key, or switch to the built-in composer.");
      state.poem = await composeWithClaude(key, state.library, title, state.about, target, state.firstSong);
    } else {
      state.poem = composePoem(state.library, title, state.about, target, state.seed, state.firstSong);
    }
    renderPoem();
    show("screen-preview");
  } catch (e) {
    setError("compose-error", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Write my poem";
  }
});

$("btn-regenerate").addEventListener("click", () => {
  state.seed += 1;
  state.poem = composePoem(state.library, state.title, state.about, parseInt($("poem-length").value, 10), state.seed, state.firstSong);
  renderPoem();
});

$("btn-back").addEventListener("click", () => show("screen-compose"));

// ===================== preview / edit =====================

function renderPoem() {
  $("preview-title").textContent = state.title;
  $("preview-sub").textContent = `${state.poem.length} songs`;
  $("preview-about").textContent = state.about;
  $("demo-hint").classList.toggle("hidden", !state.demo);
  const ol = $("poem-lines");
  ol.innerHTML = "";

  state.poem.forEach((line, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="sp-num"></span>
      <div class="sp-cell">
        <div class="sp-track"></div>
        <div class="sp-artist"></div>
      </div>
      <div class="line-controls">
        <button title="Move up">↑</button>
        <button title="Move down">↓</button>
        <button title="Swap for a different song">⇄</button>
        <button title="Remove line">✕</button>
      </div>`;
    li.querySelector(".sp-num").textContent = i + 1;
    li.querySelector(".sp-track").textContent = line.line;
    li.querySelector(".sp-artist").textContent = line.artist;

    const [up, down, swap, del] = li.querySelectorAll("button");
    up.onclick = () => { if (i > 0) { [state.poem[i - 1], state.poem[i]] = [state.poem[i], state.poem[i - 1]]; renderPoem(); } };
    down.onclick = () => { if (i < state.poem.length - 1) { [state.poem[i + 1], state.poem[i]] = [state.poem[i], state.poem[i + 1]]; renderPoem(); } };
    del.onclick = () => { state.poem.splice(i, 1); renderPoem(); };
    swap.onclick = () => {
      const alts = suggestAlternatives(state.library, state.poem, line, state.title, state.about, 1);
      if (alts.length) { state.poem[i] = alts[0]; renderPoem(); }
    };
    ol.appendChild(li);
  });
}

// add-a-line search
$("line-search").addEventListener("input", () => {
  const q = $("line-search").value.trim().toLowerCase();
  const box = $("line-search-results");
  if (q.length < 2) { box.classList.add("hidden"); return; }
  const usedKeys = new Set(state.poem.map((l) => l.uri || l.line));
  const hits = state.library
    .filter((t) => !usedKeys.has(t.uri || t.line) && (t.line.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)))
    .slice(0, 8);
  box.innerHTML = "";
  hits.forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="sr-title"></span> <span class="sr-artist"></span>`;
    li.querySelector(".sr-title").textContent = t.line;
    li.querySelector(".sr-artist").textContent = "— " + t.artist;
    li.onclick = () => {
      state.poem.push(t);
      $("line-search").value = "";
      box.classList.add("hidden");
      renderPoem();
    };
    box.appendChild(li);
  });
  box.classList.toggle("hidden", hits.length === 0);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".add-line")) $("line-search-results").classList.add("hidden");
});

// ===================== save =====================

$("btn-save").addEventListener("click", async () => {
  setError("save-error", "");
  if (state.demo) {
    setError("save-error", "Demo mode can't save to Spotify — connect your account to keep this poem.");
    return;
  }
  if (state.poem.length < 2) {
    setError("save-error", "A poem needs at least a couple of lines.");
    return;
  }
  const btn = $("btn-save");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const description = "A playlist poem — read the track titles in order. Written with Playlist Poems.";
    const url = await spotify.createPoemPlaylist(
      state.title,
      description,
      state.poem.map((l) => l.uri).filter(Boolean),
      $("playlist-public").checked
    );
    $("done-poem").textContent = poemToText(state.poem);
    $("done-link").href = url;
    show("screen-done");
  } catch (e) {
    setError("save-error", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save poem to Spotify";
  }
});

$("btn-another").addEventListener("click", () => {
  $("poem-title").value = "";
  $("poem-about").value = "";
  $("first-song-title").value = "";
  $("first-song-artist").value = "";
  show("screen-compose");
});

// ===================== boot =====================

initExamples();

(async function boot() {
  try {
    const returned = await spotify.handleAuthCallback();
    if (returned || spotify.isAuthed()) {
      await loadLibrary();
      return;
    }
  } catch (e) {
    alert(e.message);
  }
  show("screen-connect");
})();
