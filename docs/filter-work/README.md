# filter-work: hand-off notes

**Status (2026-11-11): built and tested locally (web + local Supabase).** The
migration has NOT been applied to the real Supabase project, and VoiceOver on
a real iPhone has not been checked. See "What's left" at the end.

## What was asked

> Put logs tab as a button inside settings and when you hit it it shows the
> logs - hide the logs tab iOS and pwa. Also allow a user to create their own
> custom tags and remove others - can start with the generic ones for all but
> can add remove as they want. Should be under settings - edit tags - and then
> can add and remove. Ensure everything works with voiceover on iOS and pwa.

Follow-up (2026-11-11): *"I also want ability to change tags for an outfit when
editing that outfit."* That answers the open question the design left.

"Tags" are the outfit labels: the filter pills on the Outfits screen and the
tag field on Create/Edit outfit. They used to be one hardcoded list
(`OUTFIT_LABELS`); outfits store theirs in `outfits.labels`.

## What's in this folder

| File | What it is |
|---|---|
| `README.md` | This file |
| `design.md` | The design that was built on, in full. The differences are listed below |
| `critique.md` | Independent review of three competing designs; its fixes were applied |
| `research-raw.json` | Raw research output (code maps, all three designs, critique) |
| `db-test-rig/` | Loads every repo migration into an in-memory Postgres (PGlite). `labels.mjs` is the 27-check test of the tag migration |

The migration itself is `supabase/migrations/20261111000000_closet_outfit_labels.sql`.

## Decisions

1. **Tags belong to a closet; only its owner can edit them.** Stylists see and
   use the owner's tags but can't change the list.
2. **Settings > Edit tags always edits your own closet**, even in Stylist mode.
3. **Every closet starts with the ten old tags**, existing ones included.
4. **Removing a tag never rewrites outfits.** The pill disappears; outfits keep
   the tag (still shown under "All") until someone edits that outfit's tags.
   Bulk-rewriting outfits would flood Logs and cause "someone else changed
   this" conflicts.
5. **Removing every tag is allowed.** The filter row hides and the tag becomes
   optional on Create outfit.
6. **Remove has no confirm dialog; the button turns into "Undo" in place**, so
   VoiceOver focus can never be lost.
7. **Logs is Settings > Logs (`/settings/logs`)**, a real sub-screen, not a
   hidden tab. `/about` redirects there.
8. **Tag rules:** 1-30 characters, up to 30 tags; spaces trimmed/collapsed;
   invisible characters stripped; case kept as typed; duplicates rejected
   ignoring case; "All" reserved.
9. **The web client works before the migration is applied** (falls back to the
   ten defaults; adding/removing says "not available yet").
10. **Outfits can have several tags, edited on Edit outfit** (new). Both outfit
    forms use the same tick-box chips instead of the old single-choice
    picker - `outfits.labels` was always an array and the filter matches any
    of them. Create outfit still requires at least one tag (when the closet
    has any); Edit outfit doesn't, so an old outfit saved without a tag can
    still be edited. A tag the owner removed but the outfit still has shows
    as "Work (removed)", ticked, so it can be cleared.

## How the build differs from design.md

All of the critique's fixes were applied:

- Tags match outfits ignoring case and extra spaces; the new-tag field uses
  `autoCapitalize="words"`.
- "All" is reserved, and invisible/control characters are cleaned, in the app,
  the RPC and the database CHECK (new `normalize_outfit_label` SQL function).
- Selected filter/tags are derived while rendering, not reset in effects.
- Outfits and Create outfit re-read the active closet's tags on focus, so
  stylists and other devices see edits. Closet loads, refreshes and edits go
  through a "newest request wins" ticket in `ClosetContext`, so a slow load
  can't put back a list from before an edit.
- `popToTopOnBlur` on the Settings tab.
- `textTransform: 'capitalize'` removed from `FilterPills`. (NativeSelect is no
  longer used for tags, so it was left alone.)
- "Try again" stays mounted while retrying; Logs keeps old entries while it
  refreshes; typing back a just-removed tag restores it to its old position.
- Toast also clears its text after fading, so VoiceOver can't swipe onto an
  invisible stale message.
- `/about /settings/logs 301` added to `public/_redirects`.

Verified on 2026-11-11 against the local docker Supabase: PostgREST really
returns 42703 (also inside the `closets(...)` embed) for the missing column
and PGRST202 for the missing RPC, so the client-first fallback works.

## What's left

1. **Apply the migration to the real project** (`supabase db push`) and deploy
   the site. Either order works.
2. **Make a new iOS build.** Old installs keep the hardcoded tags and the Logs
   tab until then, and will keep writing removed tags to outfits.
3. **Check with VoiceOver on an iPhone.** Especially: Edit tags > Remove (the
   button should read "Undo remove tag X" without focus jumping), adding a
   tag, an invalid name, the tag chips on Create/Edit outfit ("Casual,
   checkbox, checked"), and Back.

## Running the database tests

```bash
mkdir /tmp/pgrig && cd /tmp/pgrig && npm init -y && npm i @electric-sql/pglite
cp <repo>/docs/filter-work/db-test-rig/*.mjs .
export MIGRATIONS_DIR=<repo>/supabase/migrations
node sanity.mjs   # existing access rules
node labels.mjs   # tag migration: 27 checks
```
