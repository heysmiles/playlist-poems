// Spotify Web API client with Authorization Code + PKCE (no server, no secret).

const SCOPES = "user-library-read playlist-modify-private playlist-modify-public";
const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

const store = {
  get clientId() { return localStorage.getItem("pp_client_id") || ""; },
  set clientId(v) { localStorage.setItem("pp_client_id", v); },
  get tokens() { try { return JSON.parse(localStorage.getItem("pp_tokens")); } catch { return null; } },
  set tokens(v) { v ? localStorage.setItem("pp_tokens", JSON.stringify(v)) : localStorage.removeItem("pp_tokens"); },
};

export function redirectUri() {
  return location.origin + location.pathname;
}

export function savedClientId() { return store.clientId; }

export function isAuthed() {
  return !!store.tokens?.refresh_token;
}

export function logout() {
  store.tokens = null;
  localStorage.removeItem("pp_library_cache");
}

// ---------- PKCE flow ----------

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function beginAuth(clientId) {
  store.clientId = clientId.trim();
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  sessionStorage.setItem("pp_verifier", verifier);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));

  const params = new URLSearchParams({
    client_id: store.clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  location.href = `${AUTH_URL}?${params}`;
}

/** Call on page load; completes the flow if we're returning from Spotify. */
export async function handleAuthCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  if (!code) return false;
  history.replaceState({}, "", redirectUri()); // clean the URL

  const verifier = sessionStorage.getItem("pp_verifier");
  if (!verifier) return false;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: store.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error("Spotify login failed: " + (await res.text()));
  const tok = await res.json();
  tok.expires_at = Date.now() + tok.expires_in * 1000;
  store.tokens = tok;
  sessionStorage.removeItem("pp_verifier");
  return true;
}

async function accessToken() {
  let tok = store.tokens;
  if (!tok) throw new Error("Not connected to Spotify");
  if (Date.now() < tok.expires_at - 60_000) return tok.access_token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: store.clientId,
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
    }),
  });
  if (!res.ok) { store.tokens = null; throw new Error("Session expired — please reconnect."); }
  const fresh = await res.json();
  fresh.refresh_token = fresh.refresh_token || tok.refresh_token;
  fresh.expires_at = Date.now() + fresh.expires_in * 1000;
  store.tokens = fresh;
  return fresh.access_token;
}

async function api(path, options = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + path, {
      ...options,
      headers: { Authorization: `Bearer ${await accessToken()}`, ...(options.headers || {}) },
    });
    if (res.status === 429) {
      const wait = (parseInt(res.headers.get("Retry-After") || "2", 10) + 1) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Spotify API ${res.status}: ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  throw new Error("Spotify API: rate limited, try again in a minute.");
}

// ---------- library ----------

/**
 * Fetch every liked song as {title, artist, uri}.
 * Cached in localStorage for 24h so repeat visits are instant.
 */
export async function getLikedSongs(onProgress) {
  try {
    const cache = JSON.parse(localStorage.getItem("pp_library_cache"));
    if (cache && Date.now() - cache.at < 24 * 3600 * 1000) return cache.tracks;
  } catch { /* refetch */ }

  const tracks = [];
  let url = "/me/tracks?limit=50";
  let total = null;
  while (url) {
    const page = await api(url);
    total = page.total;
    for (const item of page.items) {
      const t = item.track;
      if (!t) continue;
      tracks.push({ title: t.name, artist: t.artists.map((a) => a.name).join(", "), uri: t.uri });
    }
    onProgress?.(tracks.length, total);
    url = page.next ? page.next.replace(API, "") : null;
  }
  try { localStorage.setItem("pp_library_cache", JSON.stringify({ at: Date.now(), tracks })); } catch { /* library too big to cache */ }
  return tracks;
}

export function invalidateLibraryCache() {
  localStorage.removeItem("pp_library_cache");
}

// ---------- playlist creation ----------

export async function createPoemPlaylist(name, description, uris, isPublic = false) {
  const me = await api("/me");
  const playlist = await api(`/users/${encodeURIComponent(me.id)}/playlists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, public: isPublic }),
  });
  for (let i = 0; i < uris.length; i += 100) {
    await api(`/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }
  return playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`;
}
