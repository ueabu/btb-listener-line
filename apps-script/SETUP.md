# Apps Script setup

The Apps Script is the only backend. It runs under your Google account, so clips land in your Drive, and it sends the new-clip emails from your account.

## 1. Create the script
1. Go to <https://script.google.com> and click **New project**. Name it `Listener Line`.
2. Replace the contents of `Code.gs` with [`Code.gs`](./Code.gs) from this folder.
3. Open **Project Settings** (gear icon) and tick **Show "appsscript.json" manifest file in editor**. Then replace that file with [`appsscript.json`](./appsscript.json).
   - `timeZone` is set to Pacific (`America/Los_Angeles`, which covers Seattle). It's used for the clip file names.

## 2. Set Script Properties
In **Project Settings → Script Properties**, add:

| Property | Value |
| --- | --- |
| `HOST_KEY` | The `/host` password, in plain text. |
| `NOTIFY_EMAIL` | Where new-clip emails go. For more than one address, separate them with commas, e.g. `you@x.com,ope@x.com`. |
| `FOLDER_ID` | *(Optional.)* The ID of an existing Drive folder, taken from its URL. Leave it empty and the next step creates one. |

## 3. Run setup once
In the editor, select the `setup` function and click **Run**, then accept the permissions prompt (Drive, send email, and connect to an external service, which is used to open video uploads to Drive). This does three things:
- creates the `Listener Line` Drive folder (if `FOLDER_ID` was empty), with a `clips/` subfolder
- creates an empty `episodes.json`
- logs the folder URL

Share that folder with Ope so you can both open clips in Drive.

## 4. Deploy
1. Click **Deploy → New deployment → Web app**.
2. Set **Execute as** to *Me* and **Who has access** to *Anyone*.
3. Deploy and copy the **Web app URL**. It ends in `/exec`.

## 5. Point the site at it
In Vercel (Project → Settings → Environment Variables) and in a local `.env.local`, set:

```
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/…/exec
NEXT_PUBLIC_HOST_PASSWORD_HASH=<output of: npm run hash-password -- "the same password as HOST_KEY">
```

Redeploy the site after changing env vars. Next.js bakes `NEXT_PUBLIC_*` values in at build time.

## Updating the script later
After editing `Code.gs`, go to **Deploy → Manage deployments**, click the pencil on the existing deployment, set **Version** to *New version*, and click **Deploy**. This keeps the same URL. Creating a *new* deployment instead changes the URL.

If `appsscript.json` gained a permission (version 3 added "connect to an external service" for video uploads), paste the new manifest too, then run `setup` once from the editor and approve the new permission **before** deploying. Otherwise the web app fails when it needs that permission.

`curl -sL "$NEXT_PUBLIC_APPS_SCRIPT_URL"` shows the deployed `"version"`. It should match `VERSION` at the top of `Code.gs`.

## Changing the password
1. Update `HOST_KEY` in Script Properties.
2. Update `NEXT_PUBLIC_HOST_PASSWORD_HASH` in Vercel.
3. Redeploy the site.

## Check it's live
```
curl -sL "$NEXT_PUBLIC_APPS_SCRIPT_URL"
# {"ok":true,"data":{"service":"listener-line",...}}

curl -sL -H 'Content-Type: text/plain' -d '{"action":"list"}' "$NEXT_PUBLIC_APPS_SCRIPT_URL"
# {"ok":false,"error":"Wrong password.","code":"unauthorized"}
```

## Video uploads
- Videos go straight from the listener's browser to the `clips/` folder. Only sites in `ALLOWED_ORIGINS` (the Fly site and `http://localhost:3000`) can do this. To allow another site, add a comma-separated `ALLOWED_ORIGINS` Script Property.
- If someone starts a video upload and never finishes it, a file can be left in `clips/` with no description. The board ignores these, and you can delete them in Drive.
- **Storage:** videos are large (often 100–500 MB each). A free Google account has 15 GB, so clear out old videos in Drive now and then, or add storage.

## Limits
- Anti-spam covers: a hidden honeypot field, at least 3s between opening the page and sending, 2:00 max, ~3 MB max for audio and 1 GB for video, an MP3 header check for audio, a size and type check for video, and at most 20 listener clips per 10 minutes across everyone.
- Apps Script quotas on a free Gmail account: roughly 100 emails/day and 6 minutes per call. That's plenty here.
