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
In the editor, select the `setup` function and click **Run**, then accept the permissions prompt (Drive + send email). This does three things:
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

## Limits
- Anti-spam covers: a hidden honeypot field, at least 3s between opening the page and sending, 2:00 / ~3 MB max, MP3 header check, and at most 20 listener clips per 10 minutes across everyone.
- Apps Script quotas on a free Gmail account: roughly 100 emails/day and 6 minutes per call. That's plenty here.
