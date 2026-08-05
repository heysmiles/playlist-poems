# 📜 Playlist Poems

Turn your Spotify **Liked Songs** into poems. Every track title is a line; the playlist is the poem.

> *I guess I just feel like*
> *When you're around*
> *This is home*
> *Don't look down*
> *…*
> *I will not say goodbye*
> *Until the day I die*

You give it a **title** and (optionally) **what it should be about**. It reads your Liked Songs, picks titles that read in order as a poem — with an opening, a development, a turn, and a closing cadence — lets you edit the lines, and saves the finished poem as a playlist straight into your Spotify library.

**Everything runs in your browser.** No server, no database, nothing stored anywhere but your own machine. Your Spotify login happens on spotify.com via OAuth (PKCE) — this app never sees your password.

## Try it

**Live site: [heysmiles.github.io/playlist-poems](https://heysmiles.github.io/playlist-poems/)** — hit **Connect Spotify** and go, or **“Try the demo”** to play with a sample library, no login needed.

> New Spotify apps run in development mode, so the live site works for the owner and up to 25 invited users. Anyone else: fork it and drop in your own Client ID (below) — it takes 2 minutes.

To run your own copy you need a free Spotify **Client ID**:

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and log in with your Spotify account.
2. Click **Create app** — name it anything (e.g. “Playlist Poems”).
3. Set the **Redirect URI** to the exact URL where you're running the app (shown under "Advanced" on the connect screen — e.g. `https://yourname.github.io/playlist-poems/` or `http://127.0.0.1:8080/`).
4. Check **Web API**, save, and either paste the Client ID under **Advanced** on the connect screen or replace `DEFAULT_CLIENT_ID` in [js/spotify.js](js/spotify.js).

> A Client ID is public by design — PKCE apps have no secret — so shipping one in the repo is safe. Registering your own just points the app at your Spotify developer account, and your data always flows only between your browser and Spotify.

## Run locally

No build step — it's plain HTML/CSS/JS.

```bash
git clone https://github.com/heysmiles/playlist-poems
cd playlist-poems
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/` (use that exact URL as your Spotify Redirect URI — Spotify accepts `http` only for `127.0.0.1`, not `localhost`).

## Deploy

It's a static site — GitHub Pages works out of the box:

1. Fork this repo → Settings → Pages → deploy from `main`.
2. Add `https://yourname.github.io/playlist-poems/` as a Redirect URI in your Spotify app.

## Two composers

- **Built-in composer** (default) — a local heuristic engine: cleans titles ("(Remastered)" begone), scores them against your poem's title/description via a theme lexicon, classifies lines as openers / connectors / questions / closers, and assembles them into an arc. Free, instant, offline.
- **Claude AI** (optional) — paste an Anthropic API key and Claude composes the poem from your library for noticeably more coherent verse. The key goes directly from your browser to Anthropic and is never stored.

Either way you can reorder, swap, remove, and add lines before saving.

## Use it from Claude instead

If you use Claude with the Spotify connector (MCP), you don't even need this site — see [docs/claude-mcp.md](docs/claude-mcp.md) for a prompt recipe that writes playlist poems conversationally.

## Privacy

- Spotify tokens and the Liked Songs cache live in your browser's `localStorage` only.
- Scopes requested: `user-library-read` (to read Liked Songs), `playlist-modify-private` / `playlist-modify-public` (to save your poem).
- No analytics, no server, no third parties (except Anthropic, only if you opt into Claude mode).

## License

MIT — see [LICENSE](LICENSE).
