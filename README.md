# btb-listener-line

Listener Line for **Beyond the Build**: a public page where listeners send a voice or video clip, and a private board where Uma & Ope review clips and build the listener segment.

- `/`: the listener page. Pick where the clip goes (Last Week in Tech or an upcoming episode) and whether it's a question, a thought, or an intro. Then record, or upload an audio or video file. The browser converts everything to a mono MP3 capped at 2:00. Video never leaves the device; only its audio is sent.
- `/host`: the password-gated host board. Play, shortlist, or pass on clips, order the segment rundown with timecodes, copy it for show notes, drop in files by hand, and manage upcoming episodes.

Design reference: [`design/listener-line-design.html`](design/listener-line-design.html).

## How it fits together

```
Next.js (Vercel, client-only) ──POST text/plain──▶ Apps Script web app ──▶ Google Drive folder
                                                                            clips/*.mp3 (metadata in description)
                                                                            episodes.json, board.json
```

There are no Next.js API routes. Recording, video-to-audio extraction, and MP3 encoding (lamejs in a Web Worker) all run in the browser. The Apps Script in [`apps-script/`](apps-script) runs as the host's Google account. It writes to Drive, emails on new clips, and checks the host password on every host call.

## Run locally

```bash
npm install
npm run dev
```

With no `NEXT_PUBLIC_APPS_SCRIPT_URL` set, the app uses an in-browser mock backend, so you can click through everything. Clips are kept in memory and localStorage. With no password hash set, `/host` accepts any password.

To use the real backend, follow [`apps-script/SETUP.md`](apps-script/SETUP.md), then copy `.env.example` to `.env.local` and fill it in.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (sample math, rundown timecodes) |
| `npm run deploy:fly` | Build and deploy to Fly.io |
| `npm run hash-password -- "pw"` | SHA-256 for `NEXT_PUBLIC_HOST_PASSWORD_HASH` |

## Deploy (Fly.io)
Live at <https://btb-listener-line.fly.dev> (app `btb-listener-line`, personal org, region `sjc`).

**Merging to `main` deploys automatically.** The [`Deploy to Fly.io`](.github/workflows/fly-deploy.yml) workflow runs lint and tests, then `flyctl deploy`. It uses three repo secrets: `FLY_API_TOKEN` (a deploy token scoped to this app, valid for one year), `NEXT_PUBLIC_APPS_SCRIPT_URL` and `NEXT_PUBLIC_HOST_PASSWORD_HASH`. You can also run it by hand from the Actions tab.

To deploy by hand from your machine instead:

```bash
npm run deploy:fly
```

The deploy script reads `NEXT_PUBLIC_APPS_SCRIPT_URL` and `NEXT_PUBLIC_HOST_PASSWORD_HASH` from `.env.local` and passes them to the Docker build. They're compiled into the browser bundle, so after changing either one you need to redeploy. For the automatic deploys, also update the matching GitHub secret (`gh secret set NAME`). Fly builds the image remotely, so you don't need Docker locally. One machine always stays running (`min_machines_running = 1`), so pages load without a cold start.

## Deploy (Vercel, alternative)
1. Import the repo in Vercel. The defaults are fine.
2. Add `NEXT_PUBLIC_APPS_SCRIPT_URL` and `NEXT_PUBLIC_HOST_PASSWORD_HASH`.
3. Deploy.

## About the password
The `/host` gate runs in the browser, so on its own it only keeps casual visitors out. The clips are actually protected by the Apps Script: `list`, `clip`, `saveBoard`, and `saveEpisodes` all reject calls without the right `HOST_KEY`.
