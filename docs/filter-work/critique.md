# Critic's review of the three designs

## Recommended base

Build on the a11y design (design 3).

- **VoiceOver:** it is the only one whose remove flow needs no programmatic focus move and no alert-dismissal timing. The button stays mounted and flips between Remove and Undo. Given that VoiceOver must work and no iPhone is available, that matters most.
- **Storage:** column plus invoker RPCs plus an IMMUTABLE validator CHECK. I ran the migration on a throwaway Postgres 16 with the baseline policies stubbed and it behaved as specified, including rejecting junk arrays that the minimal design accepts.
- **Deploy order:** closets keep loading if the client ships before the migration.
- **Scope:** Edit tags always edits the user's own closet, the labelled-spinner wrapper is correct for iOS, and /about keeps working.

Its real weaknesses are case-sensitive matching, effect-based selection resets, stale labels for stylists, and the retry focus drop. All are cheap to fix with ideas from the other two.

- **Minimal design:** not a safe base as written. A client-first deploy takes down closet loading, and it makes Edit tags read-only in stylist mode.
- **Robust design:** the strongest data model, but the largest surface (table, two triggers, new provider, per-focus fetches). Its iOS remove flow fires the toast before a 500 ms delayed focus move, so the announcement would be cut off.

All three migrations were run only against stubs on PG16 with SQL_ASCII. Still unverified: PG17 and Unicode cases, the PostgREST error codes the fallback relies on, and anything on a real iPhone.

## Missed by all three designs

- No design gives a way to tag or re-tag an existing outfit, yet all three allow emptying the list and removing tags. An outfit created while the list is empty, or whose tag was removed, can never be filtered again: /home/user/Zeeba/src/services/dataService.types.ts:323-326 (UpdateOutfitInput is name and description only) and /home/user/Zeeba/src/components/EditOutfitForm.tsx has no tag field. All three list this as out of scope; it should be put to the user as a product decision.
- No normaliser strips zero-width or format characters (U+200B to U+200D, U+2060). JavaScript trim() and \s do not match U+200B, so the client check passes; a visually blank tag would show as an empty pill and a button VoiceOver reads as 'Remove tag' with no name. I could not confirm the database side (the test cluster was SQL_ASCII).
- The Settings tab keeps its nested stack state and no design sets popToTopOnBlur. Leave Logs or Edit tags open, switch tabs, tap Settings: VoiceOver says 'Settings, tab' and the user lands on Logs. The web 'Settings' nav link from /settings/logs pushes a second index (same as /closet/new today). All three note it under risks but none fixes it.
- Already-installed native builds keep the hardcoded ten tags and the Logs tab. They will keep writing removed tags to outfits.labels and will never show custom tags. All three accept this; the user should be told it ends only when the new build is installed.
- No design can verify native iOS VoiceOver. The minimal and robust remove flows add programmatic focus moves that cannot be tested here; only the a11y design avoids depending on that.
- The Toast change (queued announcement on iOS, /home/user/Zeeba/src/components/Toast.tsx:27-29) is shared by all three and changes every toast in the app. None scopes it or adds a way to opt out.
- The Toast Text is always mounted with role=alert at opacity 0 (Toast.tsx:44-52), so on iOS VoiceOver can still swipe onto an invisible stale 'Removed tag X' after it fades. Pre-existing, but all three lean on the toast for the tag flows and none clears the message.
- README.md:14 still records 'make new tags? who can make? admin only?' as an open question; no design updates it with the owner-only decision.

## Ideas to graft into the base design

- From minimal: derive the effective selection during render instead of resetting it in an effect. In OutfitsGrid, activeLabel = selected && labels.includes(selected) ? selected : null; the same for CreateOutfitForm selectedLabel. No stale frame, and the choice survives Remove then Undo.
- From minimal and robust: match outfits to tags case-insensitively on a trimmed, lower-cased key (robust's outfitLabelKey), and set autoCapitalize="words" on the New tag input.
- From robust: reserve the name 'All' (any case) in the client validator, the add RPC and the validator function, so the filter row never has two tabs named All.
- From robust: turn control characters into spaces in normalizeOutfitLabel and in the RPC before validating, so the CHECK never surfaces a raw constraint error.
- From robust: refresh the active closet's labels when Outfits and Create outfit gain focus (a small getClosetOutfitLabels(closetId) read of closets.outfit_labels pushed through applyClosetLabels), so stylists and second devices see the owner's edits. Guard applyClosetLabels against older in-flight context loads with a sequence counter.
- From robust: Logs keeps the previously loaded entries for the same closet instead of clearing to a spinner on every focus, and shows a caption naming the closet.
- From robust: remove textTransform 'capitalize' from /home/user/Zeeba/src/components/NativeSelect.tsx:164 as well as FilterPills.tsx:118, so Android shows tags verbatim.
- From robust (optional): the pre-save tag re-check in CreateOutfitForm with the 'Tag no longer available' alert. Set submitting before the await.
- From robust (optional): add '/settings' and '/settings/*' to the AASA file and an Android pathPrefix '/settings' if Logs and Edit tags should open in the app from links. It needs a native rebuild.
- From minimal: order any focus move before the toast. This applies to the a11y design's one focus move (focusOnWeb after a retry) and anywhere else focus is moved.
- From minimal (optional): the Cloudflare line '/about /settings/logs 301' in /home/user/Zeeba/public/_redirects alongside the in-app redirect route, and correct the '/about.html' example in that file's comment at line 14.
- Fix within the a11y design: keep the 'Try again' button mounted (aria-busy) while retrying, and make Undo and add-by-typing converge on server order after each mutation.
- For all: before merge, run the chosen migration and the 42703/PGRST202 fallback against a local Supabase (PG17, UTF-8), including a zero-width-character tag and a client-before-migration smoke test.

## Defects in the 'minimal' design

- **[blocker] dataLayerSpec section 2 (supabaseClosetsService selects) and risks 'ROLLOUT ORDER'**: No tolerance for the client shipping before the migration. Every closet query names outfit_labels, so a client-first deploy makes getOwnCloset/getStylistClosets fail and Home, Closet, Outfits, Logs and Settings > Edit tags all show 'Failed to load your closet.' The migration cannot be applied from this workflow and the web client deploys independently.
  - Evidence: /home/user/Zeeba/src/services/supabaseClosetsService.ts:18,34,52,87 are the four selects the design edits. /home/user/Zeeba/src/context/ClosetContext.tsx:66-69 turns any failure into the app-wide closet error. The design's own note: 'shipping it first makes closet loading fail for everyone'.
  - Fix: Graft the a11y design's selectWithLabelsFallback (retry without the column on Postgres 42703, fall back to DEFAULT_OUTFIT_LABELS) and map PGRST202 on the RPCs to a friendly message.
- **[major] decisions.whoCanEdit and tags.tsx (canEdit = closetMode === 'my-closet')**: In stylist mode a user cannot edit their own tags. Edit tags shows another person's closet read-only and tells them to change a toggle on another tab. The request is 'allow a user to create their own custom tags ... under settings - edit tags'. A screen-reader user must leave Settings, find the Home radiogroup, switch, and come back.
  - Evidence: Design text: 'in Stylist mode it shows the selected closet's tags READ-ONLY'. The stated reason is that /home/user/Zeeba/src/context/ClosetContext.tsx:51-75 only loads myCloset in my-closet mode, but /home/user/Zeeba/src/components/outfitDetailPage.tsx:81 already fetches the own closet directly.
  - Fix: Always edit the signed-in user's own closet: fetch it with dataService.getOwnCloset(userId) on focus (robust and a11y designs) and push results into context with an applyClosetLabels-style setter.
- **[major] tags.tsx handleRemove plus the afterRemove effect; a11ySpec section I(1)**: The iOS remove flow relies on a programmatic VoiceOver focus move immediately after a UIAlertController closes. UIKit returns focus to the pressed (now unmounted) button asynchronously, so the sendAccessibilityEvent call can lose the race and the cursor ends up nowhere. This cannot be tested here, and the design itself says it 'may need a one-frame delay'.
  - Evidence: Design a11ySpec I(1): 'UIKit first returns focus to the pressed button; if the move does not stick, defer moveFocusTo'. There is no precedent in the repo: grep finds no sendAccessibilityEvent or setAccessibilityFocus under /home/user/Zeeba/src.
  - Fix: Use the a11y design's in-place Remove/Undo toggle (button never unmounts, no confirm, no focus move). If a confirm is kept, do not unmount the row on success.
- **[minor] CreateOutfitForm Tag field (hasLabels = activeClosetLabels.length > 0)**: 'No tags' is indistinguishable from 'no closet loaded'. While the closet is loading, after a cold load of /outfits/new, or in stylist mode with no closets, the form shows 'You have no tags yet ... save this outfit without one' and drops the tag requirement.
  - Evidence: /home/user/Zeeba/src/components/CreateOutfitForm.tsx:230-348 renders with no activeClosetId guard (it is only checked in handleSubmit at :172). ClosetContext.tsx:55 sets myCloset to null on every reload, which the design maps to NO_LABELS.
  - Fix: Render the Tag field only when activeClosetId is set (a11y design does), or expose labels as null while no closet is loaded.
- **[minor] migrationSql (only a cardinality CHECK)**: An owner's direct PATCH can store NULL, duplicate, empty or very long elements, which stylists then load. A NULL element throws in addOutfitLabel (candidate.toLowerCase()), and duplicates collide as React keys.
  - Evidence: Executed as the owner after the migration: update closets set outfit_labels = array[null,'a','a','',repeat('x',500)] succeeded, and the stylist's SELECT returned it. /home/user/Zeeba/src/components/FilterPills.tsx:39 uses key={option}.
  - Fix: Add the a11y design's IMMUTABLE validator CHECK (closet_outfit_labels_are_valid).
- **[minor] settings/logs.tsx and settings/tags.tsx spinners**: <ActivityIndicator aria-label="Loading ..."> is not spoken on iOS, although the a11ySpec says it is.
  - Evidence: /home/user/Zeeba/node_modules/react-native/Libraries/Components/ActivityIndicator/ActivityIndicator.js:96-104 spreads restProps straight onto the native component; only View.js:39,60-61 maps aria-label to accessibilityLabel. No 'aria-label' handling exists under node_modules/react-native/ReactCommon or React.
  - Fix: Use the a11y design's LoadingIndicator wrapper (accessible View with role=progressbar and aria-label, inner spinner aria-hidden).
- **[minor] validation (any characters allowed)**: A tag named 'All' is accepted and produces two tabs with the accessible name 'All' in the filter row.
  - Evidence: /home/user/Zeeba/src/components/FilterPills.tsx:32-44 renders the built-in All pill plus one pill per option with aria-label={label}.
  - Fix: Reject 'all' case-insensitively on the client and in the RPC (robust design's rule).
- **[minor] routeStructure (/about deleted; only a Cloudflare 301)**: On a new native build that still receives /about as a universal link (cached association file), the app lands on +not-found, which has no heading role, no link home and hard-coded colours.
  - Evidence: /home/user/Zeeba/src/app/+not-found.tsx:4-13. /home/user/Zeeba/public/.well-known/apple-app-site-association:16-19 and /home/user/Zeeba/app.config.ts:82 currently claim /about.
  - Fix: Add the root src/app/about.tsx <Redirect href="/settings/logs" withAnchor /> (the prop exists: node_modules/expo-router/build/link/Redirect.js:31-37). Keep the 301 as well if wanted.
- **[minor] ClosetContext (labels carried on the closet shape)**: A stylist's running session never sees the owner's tag edits until closet mode is toggled or the app restarts.
  - Evidence: /home/user/Zeeba/src/context/ClosetContext.tsx:77-97 refetches stylist closets only when closetMode, dataService or userId changes.
  - Fix: Refresh the active closet's labels on Outfits and Create-outfit focus.

Strengths:
- SQL runs as written. I executed the migration on a throwaway Postgres 16 with the baseline closets/collaborators/outfits tables, helper functions, policies and grants stubbed (scratchpad only, repo untouched; PG16 not 17, SQL_ASCII so no Unicode cases). Existing and new closets got the ten defaults; owner add normalised '  Vin   tage ' to 'Vin tage'; 'casual ' raised 'You already have a tag called "Casual"'; remove was idempotent; stylist, non-member and anon all raised 'Only the closet owner can edit tags'; a stylist's direct UPDATE touched 0 rows.
- Selection is derived, not reset in an effect (OutfitsGrid activeLabel, CreateOutfitForm selectedLabel), so a removed tag never leaves a stale frame, and the web <select> gets value '' (/home/user/Zeeba/src/components/NativeSelect.web.tsx:62).
- Case-insensitive filter matching, so a tag re-added in another case reconnects old outfits.
- The useMemo dependency claim holds: addOutfitLabel/removeOutfitLabel read only closetMode, myCloset and dataService, all already listed at /home/user/Zeeba/src/context/ClosetContext.tsx:151-162.
- Every StylistCloset/OwnCloset construction site is covered (supabaseClosetsService.ts:27,38,55,89; previewService.ts:28-32,398). Grep confirms OUTFIT_LABELS/OutfitLabel appear only in OutfitsGrid.tsx, CreateOutfitForm.tsx and dataService.types.ts.
- Focus-then-toast ordering after a removal is the right order for VoiceOver, and the Cloudflare 301 passes through the service worker untouched (sw.js networkFirst returns the fetch response; only response.ok on '/' is cached).

## Defects in the 'robust' design

- **[major] uiSpec F handleRemove versus a11ySpec section 5 'After removal'**: The announcement and the focus move are ordered so the announcement is cut off on iOS. handleRemove calls showToast right after removeLabel resolves, but the VoiceOver focus move is deferred 500 ms. The focus-change speech then interrupts the queued 'Removed tag X'. The a11ySpec claims the opposite order.
  - Evidence: Design text: 'await removeLabel(label); showToast(...)' and 'iOS/Android -> setTimeout(() => AccessibilityInfo.sendAccessibilityEvent(node, 'focus'), 500)'. /home/user/Zeeba/src/components/RemoveBackgroundButton.tsx:162-172 documents that focus speech cuts announcements off.
  - Fix: Fire the toast from the same delayed callback, after the focus move (minimal design's order), or adopt the a11y design's no-focus-move Remove/Undo row.
- **[major] a11ySpec section 5 (confirm alert, then 500 ms timer, then sendAccessibilityEvent)**: VoiceOver correctness depends on an untestable magic delay after UIAlertController dismissal. If UIKit's own refocus lands later than 500 ms (slow device, Reduce Motion off), focus returns to an unmounted button and the cursor is lost. The user's explicit requirement is that VoiceOver works, and no iPhone is available.
  - Evidence: Design text: 'The delay lets UIKit finish returning VoiceOver focus after the alert closes; tune on a device.' No existing use of sendAccessibilityEvent in /home/user/Zeeba/src.
  - Fix: Do not unmount the focused control: keep the row and flip the button to Undo (a11y design).
- **[minor] OutfitLabelsContext reset effect**: useEffect(() => { seq.current = {}; setEntries({}) }, [dataService, userId]) runs after child focus effects in the same commit. A refresh that a consumer started in that commit has its ticket wiped, so its result is discarded and labels stay null until the next focus (Create outfit shows a spinner with Save disabled).
  - Evidence: Design text: refresh stores 'only if seq.current[closetId] === ticket'. React runs child effects before parent effects. /home/user/Zeeba/src/context/ClosetContext.tsx:52 keeps a stale myCloset across sign-out, so a closet id can be present at the moment userId changes.
  - Fix: Key the store by identity (state {identity, entries}, derived on read) instead of resetting in an effect, or bump a generation counter that tickets include.
- **[minor] CreateOutfitForm handleSubmit pre-save refreshLabels()**: The spec puts a network await before submitting is set ('before setSubmitting's try block'). Save stays enabled during the round trip, so a double tap can create two outfits.
  - Evidence: /home/user/Zeeba/src/components/CreateOutfitForm.tsx:168-169 and :184: canSubmit depends on submitting, which today is set synchronously before the first await.
  - Fix: Call setSubmitting(true) before the refresh and clear it on the early return.
- **[minor] dataLayerSpec section 9 (fallback to DEFAULT_OUTFIT_LABELS on load error, 'no error is shown')**: A transient network failure silently swaps a closet's custom list for the ten defaults in the filter row and the Tag select. An outfit can then be saved with a tag the owner removed, with nothing telling a screen-reader user the list is not theirs.
  - Evidence: Design text: 'tagNames = labels ? ... : labelsError ? DEFAULT_OUTFIT_LABELS : null' and 'If the tag list fails to load, the ten defaults are offered (no error is shown)'.
  - Fix: Use the fallback only for the missing-table error (42P01 or PGRST205). For other errors keep the last good list, or show a retry.
- **[minor] settings/logs.tsx and TagEditor spinners**: Same as the minimal design: aria-label on ActivityIndicator is not spoken on iOS.
  - Evidence: /home/user/Zeeba/node_modules/react-native/Libraries/Components/ActivityIndicator/ActivityIndicator.js:96-104.
  - Fix: Use the a11y design's LoadingIndicator wrapper.
- **[minor] migrationSql Backfill 2 and implementer check (8)**: When a closet's outfits carry both 'vintage' and 'Vintage', which spelling is kept depends on database collation, not on the data. Check (8) expects 'vintage'; my run kept 'Vintage'.
  - Evidence: Executed with outfits {vintage,Work} and {Vintage,' padded ',All}: the rows added were 'Vintage' and 'padded' (SELECT DISTINCT ... ORDER BY 1, 2 with ON CONFLICT DO NOTHING).
  - Fix: Harmless because matching is case-insensitive; correct the expectation, or pick the most-used spelling.
- **[minor] overall surface (new table, two SECURITY DEFINER triggers, new provider, new service, per-focus fetches)**: The largest change set for an owner-only add/remove list. Outfits and Create outfit gain a request and a loading state (the pill row pops in after load) that the column designs avoid.
  - Evidence: filesToTouch lists 25 entries including OutfitLabelsContext.tsx and supabaseOutfitLabelsService.ts. previewService delays each call 400 ms (/home/user/Zeeba/src/services/previewService.ts:26,34-36).
  - Fix: If the table is kept, render pills from the last known list immediately. Otherwise take the column plus CHECK plus RPC storage and keep only the refresh-on-focus idea.

Strengths:
- SQL runs as written on the stubbed schema (same throwaway Postgres 16). Backfill gave the existing closet ten rows with sort_order 1..10; a closet inserted as an authenticated user was seeded with ten by the trigger; the owner's 'work' raised 23505; ' x', 'a  b', a tab and 31 characters raised 23514; a stylist insert raised the RLS error (42501) and a stylist delete touched 0 rows; an owner UPDATE touched 0 rows; an outsider saw 0 rows; deleting the closet cascaded.
- Only design where every invariant (length, whitespace, case-insensitive uniqueness, owner-only writes) holds for any client, with no UPDATE path on closets at all.
- Only design that keeps Outfits and Create outfit working if the client ships before the migration (falls back to the ten defaults).
- Stylists get fresh tag lists (refetch on focus, keyed by closet id), and Edit tags always edits the user's own closet regardless of closet mode.
- Reserves the name 'All', matches case-insensitively, re-checks the tag before save, keeps /about working through a withAnchor redirect and adds /settings deep links.
- Inline role=alert validation with aria-invalid/aria-describedby on web (react-native-web forwards both: node_modules/react-native-web/dist/modules/forwardedProps/index.js) and an explicit announcement on native. Logs keeps the previous entries instead of flashing a spinner on refocus.

## Defects in the 'a11y' design

- **[major] decisions.validation ('Matching against outfits stays exact and case-sensitive') versus case-insensitive uniqueness**: Removing a tag and re-adding it in a different case orphans every outfit that carried it. Removing 'Date Night' and later typing 'Date night' gives a pill that matches none of the old outfits, and 'Date Night' cannot be added back while 'Date night' exists. No autoCapitalize is specified on the input, so iOS sentence-case makes this likely. Outfits cannot be re-tagged either.
  - Evidence: /home/user/Zeeba/src/components/OutfitsGrid.tsx:72 uses outfit.labels.includes(selectedLabel) and the design leaves it. The RPC rejects lower()-equal duplicates. /home/user/Zeeba/src/services/dataService.types.ts:323-326 UpdateOutfitInput has no labels.
  - Fix: Compare lower-cased trimmed keys in the grid (minimal and robust designs) and set autoCapitalize="words" on the input.
- **[minor] TagEditor handleRetry**: Contradicts the design's own principle (2). setLoad({status:'loading'}) unmounts the focused 'Try again' button, so web focus drops to <body>. Focus is repaired only when the retry succeeds; a second failure remounts a new button and leaves focus on <body>.
  - Evidence: Design text: 'handleRetry: retryPending.current = true; setLoad({ status: "loading" })' and the effect acts only 'when it becomes ready'.
  - Fix: Keep the error view mounted during retry (aria-busy on the button) and swap content only on the result.
- **[minor] OutfitsGrid and CreateOutfitForm (useEffect that resets the selection)**: Effect-based reset gives one committed frame where the grid is still filtered but no pill is selected, and it permanently clears the form's chosen tag on Remove then Undo. The minimal design's derived value has neither problem.
  - Evidence: Design text: 'useEffect(() => { if (selectedLabel !== null && !labels.includes(selectedLabel)) setSelectedLabel(null); }, ...)'. /home/user/Zeeba/src/components/FilterPills.tsx:34 selects All only when selected === null.
  - Fix: Derive the effective selection during render (minimal design).
- **[minor] add_closet_outfit_label versus closets_outfit_labels_valid**: The RPC does not strip control characters that are not whitespace, so a pasted one passes the RPC checks and fails the CHECK with a raw Postgres message shown to the user.
  - Evidence: Executed: add_closet_outfit_label(A, E'bell\x07x') raised 'new row for relation "closets" violates check constraint "closets_outfit_labels_valid"'. normalizeOutfitLabel only does raw.replace(/\s+/g, ' ').trim().
  - Fix: Replace control characters with spaces in both normalisers (robust design's client rule) and raise a friendly message in the RPC before the UPDATE.
- **[minor] ClosetContext (labels only refresh with the closet)**: Same staleness as the minimal design for stylists and second devices. In addition, applyClosetLabels can be overwritten by an in-flight context getOwnCloset that started before the edit.
  - Evidence: /home/user/Zeeba/src/context/ClosetContext.tsx:51-97. The design's setMyCloset(prev => ...) has no ordering guard against the .then at :61-64.
  - Fix: Refresh the active closet's labels on Outfits and Create-outfit focus, and ignore context loads that started before the last applyClosetLabels (sequence counter).
- **[minor] validation (any characters allowed)**: A tag named 'All' is accepted, giving two tabs named 'All'.
  - Evidence: /home/user/Zeeba/src/components/FilterPills.tsx:32-44.
  - Fix: Reject 'all' case-insensitively in validateNewOutfitLabel, the RPC and the validator.
- **[minor] TagEditor reconcileTagRows**: The local Undo state is a second source of truth. A removed row that is re-added by typing the same name becomes active in its old local position while the server appended it, so Edit tags and the Outfits pill order disagree until the screen regains focus.
  - Evidence: Design text: reconcile 'keeps local order; a previous row is active iff serverLabels includes its exact name', while handleAdd appends on the server.
  - Fix: When an add matches a removed row, call the Undo path (same position), or re-sort active rows to server order after every mutation.
- **[minor] supabaseClosetsService selectWithLabelsFallback**: The safety net depends on error codes that were not exercised: 42703 for a missing column inside the closets(...) embed, and PGRST202 for a missing function. If either differs, a client-first deploy still fails closet loading.
  - Evidence: Design risk text: 'neither was exercised here'.
  - Fix: Test against a local Supabase before merge. As belt and braces, also fall back when error.message mentions outfit_labels.

Strengths:
- SQL runs as written on the stubbed schema (same throwaway Postgres 16). ADD COLUMN backfilled both closets with ten; a new closet got ten; target_position 3, 1, 999 and 0 inserted and clamped correctly; adding into '{}' worked; 'casual ' raised the duplicate message; remove was idempotent; stylist and anon got 'Only the closet owner can edit its tags.'
- The CHECK validator closes the direct-PATCH hole the minimal design leaves open: array['a','A'], array[NULL], a tab and a 31-element array were all rejected with closets_outfit_labels_valid, while '{}' was accepted.
- Remove/Undo in place: the focused button never unmounts and nothing is disabled, so there is no confirm dialog, no window.confirm, no programmatic VoiceOver focus and no alert-dismissal timing. It is the only remove flow whose iOS behaviour does not depend on untestable assumptions.
- LoadingIndicator wrapper correctly handles the native ActivityIndicator not mapping aria-label (ActivityIndicator.js:96-104).
- Client-first deploy keeps closets loading (42703 fallback to defaults, PGRST202 mapped to a message). Edit tags always edits the user's own closet. The Tag field renders only when activeClosetId is set. /about keeps working through a withAnchor redirect with no native config change.
- Inline role=alert validation with key={nonce} so a repeated identical error re-announces on web; aria-invalid/aria-describedby on web and accessibilityHint plus a queued announcement on native. Concrete Playwright acceptance checks are listed.
