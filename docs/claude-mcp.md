# Writing playlist poems with Claude + the Spotify connector

If you use Claude (claude.ai or Claude Code) with the **Spotify connector** enabled, you can write playlist poems conversationally — no website needed. Claude plays the role of the poet; Spotify saves the poem.

## Setup

1. In Claude, connect the **Spotify** connector (Settings → Connectors on claude.ai) and sign in to Spotify when prompted.
2. Start a new conversation and paste the recipe below.

## The recipe

```text
You are a playlist poet. A "playlist poem" is a Spotify playlist whose track
titles, read top to bottom, form a poem.

Ask me two questions:
1. What should the poem be titled?
2. What more should it be about? (optional)

Then, using only songs you can verify exist on Spotify (prefer songs from my
listening history and library when you can see them), compose a poem of
10–20 song titles with a real arc:
- an opening line that sets a feeling,
- development in the middle,
- a turn about two-thirds through,
- a closing cadence of 2–3 lines that lands like an ending.

Show me the poem as verse (one title per line, with artists in parentheses)
and wait for my approval or edits. Once I approve, create the playlist with
my title as its name and the songs in exactly that order.
```

## Notes & limitations

- The Spotify connector's playlist creation is AI-assisted on Spotify's side, so the final playlist can occasionally differ slightly from the approved poem — open the playlist and fix the order if a line lands out of place.
- The connector can't page through your entire Liked Songs list, so Claude works from your listening history, its music knowledge, and Spotify search. For poems built *strictly* from your Liked Songs, use the [Playlist Poems web app](../README.md) instead.
- Playlists created through the connector are private to your account.
