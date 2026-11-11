# filter-work: hand-off notes

**Status (2026-11-11): design finished, implementation not started.**
No app code on this branch has been changed for this feature yet. Everything
in this folder is planning material.

## What was asked

> Put logs tab as a button inside settings and when you hit it it shows the
> logs - hide the logs tab iOS and pwa. Also allow a user to create their own
> custom tags and remove others - can start with the generic ones for all but
> can add remove as they want. Should be under settings - edit tags - and then
> can add and remove. Ensure everything works with voiceover on iOS and pwa.

"Tags" means the outfit labels: the filter pills on the Outfits screen and the
"Label" picker on Create outfit. Today they are one hardcoded list,
`OUTFIT_LABELS` in `src/services/dataService.types.ts`, stored per outfit in
`outfits.labels`.

## What this branch contains

This branch starts from `claude/zeeba-recent-commit-7kakvj` (it includes the
background-removal and camera work) plus this folder:

| File | What it is |
|---|---|
| `README.md` | This file: decisions, where things stand, next steps |
| `design.md` | The recommended design, in full: decisions, data layer, every screen, accessibility details, the file list |
| `critique.md` | An independent review of three competing designs, with the defects it found and the fixes |
| `draft_closet_outfit_labels.sql` | Draft database migration from the recommended design. **Not applied anywhere and not yet run in the test rig.** It is deliberately outside `supabase/migrations/` so it can't be applied by accident |
| `research-raw.json` | Raw output: four code maps (navigation, tag data flow, database, accessibility conventions), all three designs, the critique |
| `db-test-rig/` | Loads every repo migration into an in-memory Postgres (PGlite) with Supabase-like roles, so new SQL and its access rules can be tested without touching the real database |

## How it was produced

1. Four readers mapped the code that changes: navigation, the tag data flow,
   the database, and the accessibility conventions (`research-raw.json`, "codeMaps").
2. Three designs were written independently: smallest change,
   multi-user robustness, and accessibility first.
3. A critic checked all three against the real code and ran each migration on
   a throwaway Postgres (`critique.md`).
4. **Not done:** the step that merges them into one final spec was stopped
   when you asked to pause. The list in "Changes to make to the design before
   building" below is that merge, done by hand from the critique.

## Decisions taken (change any of these before building if you disagree)

1. **Tags belong to a closet, and only its owner can edit them.** Stylists see
   and use the owner's tags but can't change them. Your README had this as an
   open question ("who can make? admin only?").
2. **Settings > Edit tags always edits your own closet**, even while the Home
   toggle is on Stylist mode.
3. **Every closet starts with the current ten tags.** Existing closets get them
   too.
4. **Removing a tag never rewrites outfits.** The pill disappears; outfits that
   had it still show under "All", and re-adding the tag brings the pill back.
   Rewriting outfits would flood Logs with "edited" entries and cause "someone
   else changed this" conflicts.
5. **Removing every tag is allowed.** The Outfits filter row then hides, and the
   tag becomes optional on Create outfit.
6. **Remove has no confirm dialog. Instead the button turns into "Undo"** in
   place. The button never disappears, so VoiceOver focus can't be lost; this
   is why the critic chose this design.
7. **Logs moves to Settings > Logs (`/settings/logs`)** as a real sub-screen,
   not a hidden tab. A hidden tab makes VoiceOver say "tab, 5 of 5" with four
   tabs visible, and Back would go to Home instead of Settings.
8. **The old `/about` link redirects to `/settings/logs`.**
9. **Tag rules:** 1 to 30 characters; spaces trimmed and collapsed; letter case
   kept as typed; duplicates rejected ignoring case; "All" is reserved.
10. **The web client keeps working before the migration is applied.** It falls
    back to the ten generic tags, so the site and the database can be deployed
    in either order.

## Open question for you

Today an outfit's tag is set once, when it is created, and can't be changed.
Should the Edit outfit screen get a tag field? All three designs left it out
because you didn't ask for it. Without it, an outfit whose tag you removed (or
created with no tags) can never be filtered again.

## Changes to make to the design before building

`design.md` is the base. Apply these on top (from `critique.md`):

- [ ] **Match tags to outfits ignoring case and extra spaces.** Otherwise removing
      "Date Night" and adding back "Date night" orphans the old outfits. Also set
      `autoCapitalize="words"` on the new-tag input.
- [ ] **Reserve "All"** (any case) in the app check, the add function and the
      database check, so the filter row never shows two "All" tabs.
- [ ] **Strip invisible characters** (zero-width spaces U+200B to U+200D, U+2060, control
      characters) before validating, in the app and in the database. Otherwise a
      blank-looking tag gives VoiceOver a "Remove tag" button with no name.
- [ ] **Work out which tag is selected while rendering**, not in an effect: if the
      selected tag no longer exists, show "All". Do this in `OutfitsGrid` and
      `CreateOutfitForm`.
- [ ] **Refresh the active closet's tags when Outfits or Create outfit gets
      focus**, so a stylist sees the owner's edits and so do your other devices.
- [ ] **Return Settings to its top screen when you leave the tab**
      (`popToTopOnBlur` on the settings tab). Otherwise tapping Settings later
      lands you on Logs or Edit tags.
- [ ] **Remove `textTransform: 'capitalize'`** from `FilterPills.tsx` and
      `NativeSelect.tsx` so tags show exactly as typed.
- [ ] **Keep "Try again" mounted while retrying** (use `aria-busy`, not
      `disabled`): on the web a disabled button drops keyboard and screen-reader
      focus to the top of the page.
- [ ] **Logs keeps showing the last loaded entries** while it refreshes, instead
      of flashing a spinner on every visit.
- [ ] Optional: add `/about /settings/logs 301` to `public/_redirects`.

## Next steps, in order

1. **Answer the open question above** (tag field on Edit outfit: yes or no).
2. **Finish the migration.** Apply the database items from the list above
   (reserve "All", strip invisible characters) to `draft_closet_outfit_labels.sql`,
   then test it in the rig:
   ```bash
   mkdir /tmp/pgrig && cd /tmp/pgrig && npm init -y && npm i @electric-sql/pglite
   cp <repo>/docs/filter-work/db-test-rig/*.mjs .
   node sanity.mjs   # loads all migrations; checks the existing access rules
   ```
   Then copy the draft into `supabase/migrations/` (the rig loads that folder)
   and write tests along the lines of `sanity.mjs`: the owner can add and
   remove tags, a stylist can read but not change them, a stranger can't read
   them, duplicates, "All", too-long and invisible-only names are rejected,
   and existing closets got the ten defaults.
3. **Build it.** Follow "Files to touch" in `design.md`. It splits cleanly into
   three parts that can be built in parallel:
   - **Data:** the migration, `src/types/supabase.types.ts`, the services and `ClosetContext`
   - **Navigation:** the Settings stack, the Logs move, removing the Logs tab, the `/about` redirect
   - **Tags:** the Edit tags screen, the Outfits filter pills and the Create outfit form
4. **Test the web build** with the Playwright approach used for background
   removal: export the site, fake the Supabase responses, and check roles,
   accessible names, focus after add/remove/undo and announcements. Checklists
   are in `design.md` ("Accessibility" section).
5. **Apply the migration** to the real Supabase project, deploy the site, and
   make a new iOS build.
6. **Check with VoiceOver on an iPhone.** It can't be tested here. Listen
   especially to: Settings > Edit tags > remove a tag (the button should read
   "Undo remove tag X" without focus jumping), adding a tag, an invalid name,
   and Back.

## Things to know

- **The real database can't be reached from these sessions.** The migration must
  be applied by you (for example with `supabase db push`).
- **Old app installs keep the old behaviour** (hardcoded tags and a Logs tab)
  until you install the new iOS build.
- **iOS screen-reader behaviour has only been reasoned about, not heard.** The
  "Undo" design was chosen because it needs no tricky focus moves, which are the
  part most likely to fail on a real device.
