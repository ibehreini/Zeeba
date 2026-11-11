# Zeeba background remover (Cloudflare Worker)

The web app (PWA) can't remove photo backgrounds by itself - browsers have no
built-in way to do it. This small Worker does it for the web app: it checks the
caller is signed in to Zeeba, then passes the photo through Cloudflare Images
(`segment: "foreground"`) and returns a transparent PNG. It stores nothing.

The iOS app does not use this - it removes backgrounds on the phone
(`modules/zeeba-background-remover`).

## Cost

Runs on Cloudflare's free plan:

- **Workers Free**: 100,000 requests a day.
- **Cloudflare Images free allowance**: 5,000 unique transformations a month.
  Each background removal is one. On the free plan Cloudflare does not bill
  for going over - further removals fail until the next month, and the app
  tells the user so.

Background removal in Cloudflare Images was released as an open beta. If
Cloudflare changes what the free plan includes, the service would stop
working rather than start charging, as long as the account has no paid Images
plan.

## Setup (about 5 minutes, once)

1. **Point it at your Supabase project.** In `wrangler.toml`, replace
   `https://YOUR-PROJECT-REF.supabase.co` with your project URL - the same
   value as `EXPO_PUBLIC_SUPABASE_URL` in the app's `.env.local`.

2. **Deploy.** From this folder:

   ```bash
   npx wrangler login     # opens the browser to sign in to Cloudflare
   npx wrangler deploy
   ```

   The first deploy may ask you to pick a `workers.dev` subdomain. When it
   finishes it prints the service's address, like
   `https://zeeba-background-remover.YOUR-SUBDOMAIN.workers.dev`.

3. **Check it is up.** Open that address in a browser. You should see
   `{"service":"zeeba-background-remover","ok":true}`.

4. **Tell the web app where it is.** Set this variable wherever the web build
   runs, then rebuild and redeploy the site:

   ```
   EXPO_PUBLIC_BACKGROUND_REMOVER_URL=https://zeeba-background-remover.YOUR-SUBDOMAIN.workers.dev
   ```

   - Building on your computer (`npm run build:web`): add the line to `.env.local`.
   - Building on Cloudflare Pages: add it under the Pages project's
     Settings > Environment variables, then retry the deployment.

5. **Try it.** Sign in on the site, add an item, pick a photo, and press
   **Remove background**. Until step 4 is done the button does not appear on
   the web.

## If something goes wrong

The button shows an alert on failure. To see the cause, run `npx wrangler tail`
in this folder and press the button again.

| What you see | Cause | Fix |
|---|---|---|
| No **Remove background** button on the web | The site was built without `EXPO_PUBLIC_BACKGROUND_REMOVER_URL` | Step 4, then redeploy the site |
| "Your sign-in has expired" (401) | `SUPABASE_URL` points at a different project, or the session really expired | Check step 1, redeploy the Worker |
| "Something went wrong" and the log shows `origin_not_allowed` (403) | The site is served from an address not listed in `ALLOWED_ORIGINS` | Add the address to `ALLOWED_ORIGINS` in `wrangler.toml`, redeploy |
| "Something went wrong" and the log shows `not_configured` (500) | `SUPABASE_URL` is still the placeholder | Step 1, redeploy |
| "used up this month's free background removals" (429) | The 5,000 a month allowance is spent | Wait for next month |
| "Something went wrong" and the log shows `removal_failed` (502) | Cloudflare Images rejected the request; the log line includes its error code | Look the code up in Cloudflare's Images docs. If it says the feature is not available on your plan, the service can't run for free on this account |

## Adding a custom domain later

Add the new site address to `ALLOWED_ORIGINS` in `wrangler.toml` and run
`npx wrangler deploy` again.

## Local development

`npx wrangler dev` runs the Worker locally. The local Images simulator does
not perform segmentation - it returns the photo unchanged as a PNG - so the
sign-in, origin and size checks can be exercised locally, but real cutouts
only come from the deployed Worker.
