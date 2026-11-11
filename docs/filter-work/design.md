# Recommended design: Accessibility-first: Settings becomes a stack (Edit tags, Logs); tags live in closets.outfit_labels; remove is an in-place toggle with Undo, so focus never moves

Produced by the design workflow and chosen by the critic as the base to build on.
It is NOT final: apply the changes listed in README.md (section 'Changes to make to the design before building') first.

## Decisions

### tagOwnership

A tag list belongs to a CLOSET, stored on the closets row. Reason: outfits live in closets and stylists create outfits in the owner's closet (RLS "Members can manage outfits", supabase/migrations/20260101000000_baseline_schema.sql:379; CreateOutfitForm writes to activeClosetId, src/components/CreateOutfitForm.tsx:72,187), so owner and stylist must see the same list or the filter pills would disagree about the same outfits. A user owns exactly one closet (getOwnCloset uses maybeSingle, src/services/supabaseClosetsService.ts:31-39), so "my tags" and "my closet's tags" are the same thing to the user. Naming: UI copy says "tag"; code and DB keep "label" (outfits.labels, Outfit.labels, closets.outfit_labels) so nothing existing is renamed.

### whoCanEdit

Owner only. Stylists read the owner's list (filter pills and the create-outfit Tag select) but cannot change it. Settings > Edit tags ALWAYS edits the signed-in user's OWN closet, including while the Home toggle is on Stylist; the screen says so in text ("These tags belong to your closet, <name>. Stylists on your closet use the same list."). A user with no closet of their own (pure stylist) gets an explanatory empty state and no form. Reason: Settings is personal and the request says "their own custom tags"; RLS already restricts closets UPDATE to the owner (baseline:403), so no new policy and no SECURITY DEFINER is needed. Because ClosetContext only loads the own closet in my-closet mode (src/context/ClosetContext.tsx:51-75), the Edit tags screen fetches it itself with dataService.getOwnCloset(userId) on focus (same approach as src/components/outfitDetailPage.tsx:81) and pushes results into the context cache with applyClosetLabels.

### storage

One new column: closets.outfit_labels text[] NOT NULL, DEFAULT = the ten current labels, plus a CHECK constraint backed by an IMMUTABLE validator function and two invoker-rights RPCs (add_closet_outfit_label, remove_closet_outfit_label) that each return the full updated list. Reasons: (1) the column default backfills every existing closet and seeds every new one (the app's plain INSERT at supabaseClosetsService.ts:48-56 and supabase/seed.sql:75-84 omit the column) with no trigger and no backfill statement; (2) existing closets policies already give members SELECT (baseline:387) and owners UPDATE (baseline:403); (3) the list arrives with the closet row the app already loads, so the Outfits filter and create form have no second request and no extra loading state to announce. RPCs instead of a client-side whole-array UPDATE so two devices cannot overwrite each other with a stale copy (closets has no updated_at; src/services/occConcurrency.ts:5 covers only outfits and clothing_items). A separate table was rejected: it needs a seeding trigger, a backfill, its own RLS, a sort column and a second fetch, and buys nothing once editing is owner-only.

### removalSemantics

Removing a tag removes it from closets.outfit_labels only. outfits.labels is NOT rewritten: an UPDATE naming labels fires log_outfit_activity_trigger (supabase/migrations/20260717025406_create_activity_tablejlzv.sql:141-143) and bumps updated_at (20260722040000:31-33), which would spam Logs and throw ConflictError at anyone with that outfit open. Effects: the tag's filter pill and its option in the create-outfit select disappear immediately (context update); outfits that carry it stay visible under All and match again if the identical tag is added back; if the removed tag was the selected filter, OutfitsGrid resets to All; if it was selected in an open create form, the select resets to its placeholder. Because nothing is destroyed, there is NO confirm dialog: the row stays in the list as "<name> (removed)" and its button becomes Undo (re-adds the same string at the same position via target_position). The removed row disappears the next time the screen gains focus. No activity_logs entry is written for tag edits (item_type is CHECK-limited and the client throws on unknown values, src/services/dataService.types.ts:248-251). No "Restore default tags" button: not requested, Undo covers slips, and retyping a default restores it.

### emptyListBehaviour

Zero tags is allowed ("add remove as they want"). OutfitsGrid: when the list is empty the FilterPills row is not rendered at all (an "All"-only row filters nothing); all outfits show. CreateOutfitForm: when the list is empty the Tag select is replaced by a sentence and the outfit saves with labels: [] (column default '{}' already allows it, baseline:182). Copy in my-closet mode: "You have no tags, so this outfit will be saved without one. To add tags, go to Settings, then Edit tags." Copy in stylist mode: "This closet has no tags, so this outfit will be saved without one. Only the closet's owner can add tags." When the list is non-empty a tag stays required exactly as today (canSubmit and the Missing information alert, CreateOutfitForm.tsx:168-182). Edit tags with zero tags shows "You have no tags. Outfits can still be created without one." under the Your tags heading and the Add form keeps working.

### routeStructure

Settings becomes a nested stack inside its tab, the same pattern as closet/ and outfits/ (src/app/(tabs)/closet/_layout.tsx:5-23).
- src/app/(tabs)/settings/_layout.tsx (new) -> Stack, unstable_settings.initialRouteName = 'index'
- src/app/(tabs)/settings/index.tsx (git mv from src/app/(tabs)/settings.tsx) -> /settings, title "Settings"
- src/app/(tabs)/settings/logs.tsx (git mv from src/app/(tabs)/about.tsx) -> /settings/logs, title "Logs"
- src/app/(tabs)/settings/tags.tsx (new) -> /settings/tags, title "Edit tags"
- Both tab layouts: delete the about Tabs.Screen (src/app/(tabs)/_layout.tsx:51-59, _layout.web.tsx:33) and add headerShown: false to the settings Tabs.Screen (_layout.tsx:60-68, _layout.web.tsx:34). HeaderNav.web.tsx loses the Logs link and '/about' from the href union (lines 6, 15).
- Not a hidden tab (href: null): that keeps the route in the tab list, so iOS VoiceOver would say "Settings, tab, 5 of 5" with four visible tabs, and back from a hidden tab goes Home. The file must leave the (tabs) root, otherwise expo-router auto-appends it as a tab.
- /about keeps working as a redirect: new root route src/app/about.tsx renders <Redirect href="/settings/logs" withAnchor /> (withAnchor loads settings/index underneath so Back lands on Settings), registered in src/app/_layout.tsx inside the signed-in Stack.Protected group as <Stack.Screen name="about" options={{ headerShown: false }} />. Reason: /about is still a claimed universal link (public/.well-known/apple-app-site-association:16-19, app.config.ts:82) and +not-found is a dead end for screen-reader users (src/app/+not-found.tsx has no heading and no link). app.config.ts is left unchanged (the path is still handled; no native config change); the AASA entry stays and only its comment text changes. /settings is not added to the AASA or intent filters (not requested; it never was a universal link). public/_redirects needs no rule (all three settings routes are static).
- Settings stack header is always neutral (theme.surface / theme.textPrimary), NOT the stylist blue used by closet/outfits: white on #38bdf8 is 2.14:1, and Edit tags always concerns the user's own closet.

### validation

Normalise before validating: collapse every whitespace run to one space, then trim (so tabs/newlines never survive). Case is preserved as typed. Rules, enforced in the client (immediate, exact copy), in add_closet_outfit_label (same messages) and in the CHECK constraint (backstop for direct PATCH):
- 1 to 30 characters. TextInput maxLength={30}; visible hint "Up to 30 characters." Empty -> "Enter a tag name." Over 30 (only reachable server-side) -> "Tags can be up to 30 characters."
- No duplicates ignoring letter case (lower() in SQL, toLowerCase() in TS). Message names the existing spelling: You already have a tag named "Casual".
- At most 30 tags per closet -> "You can have up to 30 tags. Remove one to add another."
- Any characters are allowed (letters, digits, punctuation such as the "/" in Girly/Romantic, emoji) except control characters, which the CHECK rejects.
- Tags display verbatim everywhere: CreateOutfitForm passes an identity formatLabel to NativeSelect (the default splits on "_" and upper-cases, src/components/NativeSelect.shared.ts:20-25) and textTransform: 'capitalize' is removed from FilterPills (src/components/FilterPills.tsx:118; safe because ClosetList already passes Title Case via CATEGORY_TITLES and the ten defaults are Title Case), so the visible pill text always equals its aria-label.
- Matching against outfits stays exact and case-sensitive (src/components/OutfitsGrid.tsx:72); Undo re-adds the identical string so old outfits match again.

## Data layer

All names keep "label" in code; only UI copy says "tag".

=== src/services/dataService.types.ts ===
DELETE `OUTFIT_LABELS` (lines 210-226) and `OutfitLabel` (line 228). ADD in their place:

/**
 * The ten outfit tags every closet starts with. Mirrors the DEFAULT of
 * closets.outfit_labels (supabase/migrations/20261111000000_closet_outfit_labels.sql);
 * live closets get their list from that column, so this is only used by
 * preview mode and as the fallback for a database that predates the migration.
 */
export const DEFAULT_OUTFIT_LABELS: readonly string[] = ['Girly/Romantic','Work','Casual','Date Night','Athleisure','Formal Event','Street Style','Minimalist Chic','Artsy','Boho'];
/** Longest allowed tag, in characters - mirrored by the closets_outfit_labels_valid check constraint. */
export const MAX_OUTFIT_LABEL_LENGTH = 30;
/** Most tags one closet can have - mirrored by the same check constraint. */
export const MAX_OUTFIT_LABELS = 30;
/** The form tags are stored and compared in: whitespace runs collapsed to one space, ends trimmed. */
export function normalizeOutfitLabel(raw: string): string;            // raw.replace(/\s+/g, ' ').trim()
export type OutfitLabelValidation = { ok: true; label: string } | { ok: false; message: string };
/** Checks a typed tag against a closet's current list. Messages are user-facing and identical to the ones add_closet_outfit_label raises. */
export function validateNewOutfitLabel(raw: string, existing: readonly string[]): OutfitLabelValidation;
  // order of checks and exact messages:
  // label.length === 0                        -> 'Enter a tag name.'
  // label.length > MAX_OUTFIT_LABEL_LENGTH    -> `Tags can be up to ${MAX_OUTFIT_LABEL_LENGTH} characters.`
  // existing.find(c => c.toLowerCase() === label.toLowerCase()) -> `You already have a tag named "${match}".`
  // existing.length >= MAX_OUTFIT_LABELS      -> `You can have up to ${MAX_OUTFIT_LABELS} tags. Remove one to add another.`

CHANGE:
export interface NewOutfitInput { closetId: string; userId: string; name: string; description: string;
  /** One of the closet's tags, or null when the closet has no tags to choose from. */
  label: string | null;
  itemIds: string[]; }
(JSDoc at 230-234: "label is required whenever the closet has at least one tag".)

export interface StylistCloset { closet_id: string; closet_name: string;
  /** The closet's outfit tags in display order (closets.outfit_labels). The owner edits them in Settings > Edit tags; stylists only read them. */
  outfit_labels: string[]; }
(OwnCloset extends it unchanged.)

ADD to IDataService, after joinClosetByPassphrase (line 407):
  /** Adds a tag to a closet's outfit tag list and returns the full updated list. `atIndex` (0-based) puts it at that position - used to undo a removal; omitted appends. Caller must own the closet. Throws with a user-facing message if the tag is empty, too long, a duplicate (ignoring case) or the list is full. */
  addClosetOutfitLabel(closetId: string, label: string, atIndex?: number): Promise<string[]>;
  /** Removes a tag from a closet's outfit tag list and returns the full updated list. Outfits that already carry the tag keep it. Caller must own the closet. */
  removeClosetOutfitLabel(closetId: string, label: string): Promise<string[]>;
getStylistClosets / getOwnCloset / createOwnCloset / joinClosetByPassphrase keep their signatures; their returned objects now include outfit_labels.

=== src/services/supabaseClosetsService.ts ===
- StylistClosetRow: closets: (Pick<Tables<'closets'>, 'id' | 'closet_name'> & { outfit_labels?: string[] }) | null.
- Private helper (deploy-order safety net; the web client ships independently of the database):
  /** Postgres undefined_column - what PostgREST returns while closets.outfit_labels does not exist yet. */
  const UNDEFINED_COLUMN = '42703';
  async function selectWithLabelsFallback<R extends { error: { code?: string } | null }>(run: (withLabels: boolean) => PromiseLike<R>): Promise<R>
    // const first = await run(true); return first.error?.code === UNDEFINED_COLUMN ? run(false) : first;
  const labelsOf = (row: { outfit_labels?: string[] | null }) => row.outfit_labels ?? [...DEFAULT_OUTFIT_LABELS];
- getStylistClosets: select withLabels ? 'closets(id, closet_name, outfit_labels)' : 'closets(id, closet_name)'; map adds outfit_labels: labelsOf(row.closets).
- getOwnCloset: select withLabels ? 'id, closet_name, pass_phrase, outfit_labels' : 'id, closet_name, pass_phrase'; map adds outfit_labels.
- createOwnCloset: same two select strings on the insert (a 42703 fails the whole INSERT ... RETURNING, so the retry cannot create a second closet).
- joinClosetByPassphrase: follow-up select withLabels ? 'id, closet_name, outfit_labels' : 'id, closet_name'.
- NEW:
  /** Adds a tag through the add_closet_outfit_label RPC (atomic on the server, so a second device's edit is never overwritten) and returns the updated list. Throws the Supabase error on failure - its message is the user-facing reason. */
  export async function addClosetOutfitLabel(closetId: string, label: string, atIndex?: number): Promise<string[]>
    // supabase.rpc('add_closet_outfit_label', { target_closet_id: closetId, target_label: label, ...(atIndex === undefined ? {} : { target_position: atIndex + 1 }) })
  /** Removes a tag through the remove_closet_outfit_label RPC and returns the updated list. Throws the Supabase error on failure. */
  export async function removeClosetOutfitLabel(closetId: string, label: string): Promise<string[]>
    // supabase.rpc('remove_closet_outfit_label', { target_closet_id: closetId, target_label: label })
  Both: if (error) { if (error.code === 'PGRST202') throw new Error('Editing tags is not available yet. Please try again later.'); throw error; } return data as string[];

=== src/services/supabaseService.ts ===
Import addClosetOutfitLabel and removeClosetOutfitLabel from './supabaseClosetsService' (lines 3-9) and list both in the object after joinClosetByPassphrase (line 68).

=== src/services/supabaseOutfitsService.ts:43 and src/services/previewService.ts:270 ===
labels: input.label ? [input.label] : [],

=== src/services/previewService.ts ===
- PREVIEW_CLOSET becomes Omit<OwnCloset, 'outfit_labels'> (lines 28-32).
- New module state, next to the other session-only stores (after line 80):
  // Tags edited in Settings > Edit tags during a guest session - same session-only lifetime as everything else above. Starts from the ten every real closet starts with.
  let previewOutfitLabels: string[] = [...DEFAULT_OUTFIT_LABELS];
  function previewCloset(): OwnCloset { return { ...PREVIEW_CLOSET, outfit_labels: [...previewOutfitLabels] }; }
- getOwnCloset and createOwnCloset return delay(previewCloset()); joinClosetByPassphrase returns delay({ closet_id, closet_name, outfit_labels: [...previewOutfitLabels] }).
- NEW methods on PreviewDataService (closetId accepted for interface parity but ignored - one closet):
  async addClosetOutfitLabel(_closetId: string, label: string, atIndex?: number): Promise<string[]>
    // const result = validateNewOutfitLabel(label, previewOutfitLabels); if (!result.ok) throw new Error(result.message);
    // const index = Math.min(Math.max(atIndex ?? previewOutfitLabels.length, 0), previewOutfitLabels.length);
    // previewOutfitLabels = [...slice(0, index), result.label, ...slice(index)]; return delay([...previewOutfitLabels]);
  async removeClosetOutfitLabel(_closetId: string, label: string): Promise<string[]>
    // previewOutfitLabels = previewOutfitLabels.filter(c => c !== label); return delay([...previewOutfitLabels]);
- src/constants/MyOutfitsData.tsx is not changed (its lowercase labels matching no pill is pre-existing).

=== src/context/ClosetContext.tsx ===
ADD to ClosetContextValue:
  /** Outfit tags of the active closet, in display order - what the Outfits filter and the create-outfit form offer. Stylists get the owner's list read-only. Empty while no closet is active. */
  activeClosetLabels: readonly string[];
  /** Replaces the cached tag list of `closetId` after Settings > Edit tags saved a change (or re-read it), so the Outfits filter and an open create-outfit form update without a refetch. Ignored for a closet that is not loaded. */
  applyClosetLabels: (closetId: string, labels: string[]) => void;
Implementation:
  const NO_LABELS: readonly string[] = [];   // module scope, stable identity so consumers' effects do not loop
  const applyClosetLabels = useCallback((closetId: string, labels: string[]) => {
    setMyCloset(prev => (prev && prev.closet_id === closetId ? { ...prev, outfit_labels: labels } : prev));
    setStylistClosets(prev => prev?.map(c => (c.closet_id === closetId ? { ...c, outfit_labels: labels } : c)) ?? prev);
  }, []);
  value: activeClosetLabels: activeCloset?.outfit_labels ?? NO_LABELS, applyClosetLabels   (add applyClosetLabels to the useMemo dependency array at 151-162; activeCloset is already there)
No change to when closets load. Not exposing an ownClosetId: the Edit tags screen reads the own closet itself.

=== Consumers ===
- src/app/(tabs)/outfits/index.tsx: read activeClosetLabels from useCloset() (line 15) and render <OutfitsGrid closetId={activeClosetId} labels={activeClosetLabels} onOutfitPress={handleNavigation} /> (line 65).
- src/components/OutfitsGrid.tsx: Props gains `/** The closet's outfit tags in display order - one filter pill each. Empty or omitted hides the filter row. */ labels?: readonly string[]` (default a module-level empty array); selectedLabel becomes useState<string | null>(null); add useEffect(() => { if (selectedLabel !== null && !labels.includes(selectedLabel)) setSelectedLabel(null); }, [labels, selectedLabel]); render {labels.length > 0 && <FilterPills options={labels} selected={selectedLabel} onSelect={setSelectedLabel} />}. Drop the OUTFIT_LABELS / OutfitLabel imports.
- src/components/CreateOutfitForm.tsx: const { activeClosetId, activeClosetLabels, closetMode } = useCloset(); label state useState<string | null>(null); const hasTags = activeClosetLabels.length > 0; useEffect resets label to null when it is no longer in activeClosetLabels; canSubmit uses (!hasTags || !!label); createOutfit gets label: hasTags ? label : null. See uiSpec for the field.
- src/components/FilterPills.tsx: remove textTransform: 'capitalize' from styles.pillText (line 118). No API change.
- No change: src/services/supabaseRowMappers.ts, src/state/outfitsRefresh.ts (tag edits do not touch outfit rows, so markOutfitsDirty is not called), NativeSelect*.tsx, supabaseActivityService.ts.

=== src/types/supabase.types.ts (hand-edited, generator style) ===
closets.Row (130-136): add `outfit_labels: string[]` between id and owner_id; closets.Insert and closets.Update: add `outfit_labels?: string[]` in the same position.
Functions (496-507), alphabetical:
  add_closet_outfit_label: { Args: { target_closet_id: string; target_label: string; target_position?: number }; Returns: string[] }
  closet_outfit_labels_are_valid: { Args: { target_labels: string[] }; Returns: boolean }
  ... existing ...
  remove_closet_outfit_label: { Args: { target_closet_id: string; target_label: string }; Returns: string[] }

=== New utility: src/utils/announce.ts ===
/** Speaks `message` through VoiceOver/TalkBack. Queued on iOS so it follows whatever VoiceOver is already saying instead of cutting it off or being cut off. No-op on web, where react-native-web's announce API is an empty function and live regions do this job. */
export function announceForScreenReader(message: string): void
  // ios: AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true }); other native: AccessibilityInfo.announceForAccessibility(message); web: nothing
/** Web only: moves keyboard and screen-reader focus to a non-interactive element (a heading) after the control that held focus left the page. No-op on native, where the screen reader relocates focus itself. */
export function focusOnWeb(target: unknown): void
  // if (Platform.OS !== 'web' || !target) return; const node = target as HTMLElement; node.tabIndex = -1; node.focus();
src/components/Toast.tsx lines 24-29: replace the Platform check + AccessibilityInfo.announceForAccessibility(text) with announceForScreenReader(text) and update the comment (this makes every toast queued on iOS, matching RemoveBackgroundButton.tsx:166-172).

## Screens

Common: colours only from useTheme(); layout in StyleSheet.create; every pressable minHeight 48 (never a fixed height, so Dynamic Type can grow it); text inputs fontSize 16; screens use the Settings column (width 100%, maxWidth 560, alignSelf center, paddingHorizontal 16, paddingTop 24, paddingBottom 40, gap 16; cards borderWidth 1, borderRadius 10, padding 16, gap 12 - src/app/(tabs)/settings.tsx:116-134).

1. src/app/(tabs)/settings/_layout.tsx (new)
import { Stack } from 'expo-router'; import { useTheme } from '@/context/ThemeContext';
export const unstable_settings = { initialRouteName: 'index' };
export default function SettingsLayout() { const { theme } = useTheme(); return <Stack screenOptions={{ headerTitleAlign: 'center', headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.textPrimary }} />; }
Comment: why it does not copy the stylist header colours (contrast 2.14:1; these screens are about the user's own settings). No headerLeft: sub-screens use the default back control like closet/new.tsx.

2. src/app/(tabs)/settings/index.tsx (moved from settings.tsx; component SettingsScreen)
- Wrap in a fragment with <Stack.Screen options={{ title: 'Settings' }} />; keep the ScrollView root with aria-hidden={!isFocused}; add useRouter.
- New card inserted between Account and Appearance:
  heading (h2): "Closet"
  row button 1: visible "Edit tags" + decorative chevron "›" -> router.push('/settings/tags')
  hairline divider (existing styles.divider)
  row button 2: visible "Logs" + decorative chevron "›" -> router.push('/settings/logs')
  New styles: navRow { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, navRowText { fontSize: 16, fontWeight: '500' } in theme.textPrimary, navRowChevron { fontSize: 20 } in theme.textSecondary, pressed state opacity 0.7.
- Account, Appearance and Sign out unchanged.

3. src/app/(tabs)/settings/logs.tsx (moved from about.tsx; rename component LogsScreen)
- <Stack.Screen options={{ title: 'Logs' }} />; remove useIsFocused/aria-hidden (the stack hides unfocused screens; only tab-root screens carry that); update the two "this tab" comments to "this screen".
- Data loading unchanged (refetch on focus for activeClosetId, about.tsx:34-55).
- States, in the existing if/else order:
  closetLoading or entries === null -> <LoadingIndicator label="Loading activity" />
  closetError -> <Text role="alert"> closetError
  !activeClosetId -> <Text role="alert"> closetMode === 'stylist' ? "You aren't a stylist on any closets yet." : "No closet found."
  error -> <Text role="alert"> getErrorMessage(err, 'Failed to load activity.')  (also announceForScreenReader(message) when it is set, for native)
  entries.length === 0 -> "No activity yet." (textSecondary)
  list -> ScrollView containing: h2 `Recent activity in ${activeClosetName}` (omit when the name is null), then <View role="list" aria-label="Recent activity"> with one <View role="listitem" key={entry.id}> per entry holding ONE Text: {describeActivity(entry)}{'\n'}<Text style={timestamp}>{new Date(entry.created_at).toLocaleString()}</Text>.
- Guest mode still shows "No activity yet." (previewService.getActivityLog returns []).

4. src/components/LoadingIndicator.tsx (new, used by Logs and TagEditor)
export default function LoadingIndicator({ label }: { label: string }) -> <View accessible role="progressbar" aria-label={label} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator aria-hidden /></View>
Comment: the native spinner is a host view that never passes through View's aria-* mapping (node_modules/react-native/Libraries/Components/ActivityIndicator/ActivityIndicator.js spreads rest props straight onto the native component), so the name goes on an accessible wrapper; on web the wrapper is the named progressbar and the inner one is hidden.

5. src/app/(tabs)/settings/tags.tsx (new): <><Stack.Screen options={{ title: 'Edit tags' }} /><TagEditor /></>

6. src/components/TagEditor.tsx (new)
State:
  type TagRow = { name: string; removed: boolean; busy: boolean };
  type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'no-closet' } | { status: 'ready'; closetId: string; closetName: string };
  rows: TagRow[]; draft: string; inputError: { message: string; nonce: number } | null; adding: boolean; reloadKey: number; refs: inputRef (TextInput), addHeadingRef (Text), retryPending (boolean ref).
Load: useFocusEffect(useCallback(..., [dataService, mode, userId, reloadKey, applyClosetLabels])): skip while mode === 'live' && !userId; dataService.getOwnCloset(userId) with the cancelled-flag pattern. null -> 'no-closet'. Otherwise rows = closet.outfit_labels.map(name => ({ name, removed: false, busy: false })) (this is what clears removed rows on re-entry), status 'ready', and applyClosetLabels(closet.closet_id, closet.outfit_labels). On failure: if already 'ready' keep the current content, else status 'error' with getErrorMessage(err, 'Failed to load your tags.') and announceForScreenReader(message). On a re-focus while 'ready' the old rows stay on screen until the new list arrives (no spinner flash).
Helper: reconcileTagRows(previous: TagRow[], serverLabels: readonly string[]): TagRow[] - keeps local order; a previous row is active iff serverLabels includes its exact name, otherwise it becomes/stays removed (never unmounted); a removed row whose lower-cased name equals a server label with different spelling is dropped; server labels not in previous are appended as active rows.
Handlers:
  handleAdd: if (adding || status !== 'ready') return; result = validateNewOutfitLabel(draft, active names). Not ok -> failInput(result.message). Ok -> setAdding(true); labels = await dataService.addClosetOutfitLabel(closetId, result.label); setRows(prev => reconcileTagRows(prev, labels)); applyClosetLabels(closetId, labels); setDraft(''); setInputError(null); showToast(`Added tag ${result.label}`); catch -> failInput(getErrorMessage(err, 'Something went wrong. Please try again.')); finally setAdding(false).
  failInput(message): setInputError(prev => ({ message, nonce: (prev?.nonce ?? 0) + 1 })); announceForScreenReader(message); if web, inputRef.current?.focus().
  handleRemove(row): if (row.busy) return; mark busy; labels = await dataService.removeClosetOutfitLabel(closetId, row.name); setRows(prev => reconcileTagRows(prev.map(r => r.name === row.name ? { ...r, removed: true, busy: false } : r), labels)); applyClosetLabels(closetId, labels); showToast(`Removed tag ${row.name}. Undo is available.`); catch -> clear busy; showAlert("Couldn't remove tag", getErrorMessage(err, 'Something went wrong. Please try again.')).
  handleUndo(row, index): if (row.busy) return; mark busy; atIndex = rows.slice(0, index).filter(r => !r.removed).length; labels = await dataService.addClosetOutfitLabel(closetId, row.name, atIndex); reconcile (row becomes active, busy false); applyClosetLabels; showToast(`Restored tag ${row.name}`); catch -> clear busy; showAlert("Couldn't restore tag", ...).
  handleRetry: retryPending.current = true; setLoad({ status: 'loading' }); setReloadKey(k => k + 1). useEffect on load.status: when it becomes 'ready' and retryPending is set, clear it and focusOnWeb(addHeadingRef.current).
Render (root: ScrollView, keyboardShouldPersistTaps="handled", automaticallyAdjustKeyboardInsets):
  loading -> <LoadingIndicator label="Loading tags" />
  error -> <Text role="alert" danger>{message}</Text> + button "Try again"
  no-closet -> Text: "You don't have a closet of your own yet, so there are no tags to edit. Create your closet on the Home tab first. Tags for closets you style are managed by their owners."
  ready, top to bottom:
   a. Intro (textSecondary, 15px): "Tags describe an outfit's vibe or occasion, like Casual or Date Night. You choose one when you create an outfit, and you can filter your outfits by tag."
   b. Ownership (textSecondary): `These tags belong to your closet, ${closetName}. Stylists on your closet use the same list.`
   c. Card "Add a tag" (h2, ref addHeadingRef): visible label Text "New tag"; TextInput (surfaceAlt fill, border token, minHeight 48, fontSize 16, borderRadius 10, placeholder "e.g. Vintage", placeholderTextColor theme.textSecondary, maxLength={MAX_OUTFIT_LABEL_LENGTH}, enterKeyHint="done", onSubmitEditing={handleAdd}, blurOnSubmit={false} and submitBehavior="submit" so Enter/Done adds and keeps focus and the keyboard, onChangeText clears inputError); hint Text id="new-tag-hint": "Up to 30 characters."; when inputError: <Text key={inputError.nonce} id="new-tag-error" role="alert" danger 14px>{inputError.message}</Text>; button "Add tag" (filled theme.accent, text theme.onAccent 16px bold, opacity 0.6 while adding, never disabled).
   d. Card "Your tags" (h2): count sentence - n > 1: `${n} tags. You can have up to 30.`; n === 1: "1 tag. You can have up to 30."; n === 0: "You have no tags. Outfits can still be created without one."; then note (textSecondary 13px): "Removing a tag takes it off this list and the outfit filter. Outfits that already have it are not changed."; then, if rows.length > 0, <View role="list" aria-label="Your tags"> with rows separated by hairline dividers. Row = <View role="listitem" key={row.name}> flexDirection row, alignItems center, minHeight 48, gap 12: name Text (flex 1, flexShrink 1, wraps, 16px) and ONE Pressable (minHeight 48, minWidth 64, paddingHorizontal 12, centred; opacity 0.6 while busy).
      active row: name in textPrimary; button visible text "Remove" in theme.danger.
      removed row: name struck through in textSecondary followed by plain " (removed)"; button visible text "Undo" in theme.link.
      The Pressable is the same element in both states (only props change) so focus stays on it.
  n counts active rows only.

7. src/components/CreateOutfitForm.tsx (lines 258-267 and 168-193)
- Only when activeClosetId is set: <Field label="Tag" required={hasTags}>.
  hasTags: <NativeSelect label="Tag" options={activeClosetLabels} value={label} onChange={setLabel} placeholder="Select a tag" required formatLabel={formatTag} /> with a module-level const formatTag = (tag: string) => tag;
  !hasTags: Text (textSecondary 15px) - my-closet mode: "You have no tags, so this outfit will be saved without one. To add tags, go to Settings, then Edit tags." Stylist mode: "This closet has no tags, so this outfit will be saved without one. Only the closet's owner can add tags."
- Missing information alert text: with tags "Name, description, a tag, and at least one clothing item are all required."; without "Name, description, and at least one clothing item are all required."
- Field name changes from "Label" to "Tag" so the form and Settings use one word.

8. src/components/OutfitsGrid.tsx: pills come from the labels prop; row hidden when empty; selection resets to All when its tag disappears. "No outfits match this filter." unchanged.

9. Navigation chrome
- src/app/(tabs)/_layout.tsx: delete lines 51-59; add headerShown: false to settings options.
- src/app/(tabs)/_layout.web.tsx: delete line 33; line 34 becomes options={{ title: 'Settings', headerShown: false }}; comment at 8-12: "maps /closet, /outfits and /settings".
- src/components/HeaderNav.web.tsx: href union '/' | '/closet' | '/outfits' | '/settings'; remove { href: '/about', label: 'Logs' }; comment line 10: "Mirrors the four <Tabs.Screen> destinations ... Logs and Edit tags are opened from Settings, and isActive's prefix match keeps the Settings link current on /settings/logs and /settings/tags."
- src/app/about.tsx (new): import { Redirect } from 'expo-router'; export default function LegacyLogsRedirect() { return <Redirect href="/settings/logs" withAnchor />; } with a comment explaining /about was the Logs tab and is still a claimed universal link.
- src/app/_layout.tsx: add <Stack.Screen name="about" options={{ headerShown: false }} /> after outfit/edit/[id] inside the signed-in Stack.Protected group.
- public/.well-known/apple-app-site-association line 18: comment becomes "Legacy Logs URL - the app redirects it to /settings/logs."
- Visible side effect: the Settings title moves from HeaderBanner to the centred stack header, the same header My Closet and Outfits already use.

Guest/preview mode: everything above works; tag edits live in previewService memory for the session and reset on app restart. Android: identical, with the system back button popping the settings stack.

## Accessibility (VoiceOver on iOS, screen readers on the web)

Principles: (1) navigation is a real route push, so iOS posts its screen-change notification and the web shell's useAnnounceRouteChange (src/components/AppShell.web.tsx:71-98) focuses the new page's h1; (2) no control that can hold focus is ever disabled or unmounted by its own action, so focus is never lost and no programmatic VoiceOver focus calls are needed; (3) every outcome is spoken: Toast = queued announcement on iOS / polite live region on web, validation = role="alert" on web / announcement on native, failures on rows = showAlert; (4) role/aria-* props only; every in-page heading has an explicit aria-level of 2 (a level-less heading renders as a second h1 on web and could steal route focus). iOS speech below is expected from source reading and must be confirmed on a device.

TAB BAR / NAV
- iOS tab bar: four tabs; VoiceOver "Settings, tab, 4 of 4" (route removed, not hidden).
- Web: nav "Primary" has exactly four links Home, My Closet, Outfits, Settings; Settings has aria-current="page" on /settings, /settings/logs, /settings/tags.

HEADERS (all three settings screens)
- Title: web role="heading" aria-level=1 (react-navigation HeaderTitle), exactly one visible h1 per screen: "Settings", "Logs", "Edit tags". iOS: navigation bar title with header trait.
- Back control on Logs and Edit tags (default native-stack control, same as /closet/new): web <a role="link"> named "Settings, back", Enter activates; iOS "Settings, back button", two-finger scrub pops; Android "Navigate up" plus system back.
- After push: web focus on the new h1 (announces "Logs" / "Edit tags", heading level 1); iOS VoiceOver moves to the new screen (back button, then title).
- After back (control, gesture or browser back): web focus on h1 "Settings" (app-wide convention, not the originating row); iOS VoiceOver lands at the top of Settings.
- Unfocused screens leave the accessibility tree: settings/index keeps aria-hidden={!isFocused}; on web the stack and TabScene apply display:none.

SETTINGS INDEX
- Card heading "Closet": role="heading" aria-level={2}.
- "Edit tags": Pressable role="button" aria-label="Edit tags" (explicit so iOS does not append the chevron glyph); chevron Text aria-hidden. Web: <button>, Enter/Space activate. VoiceOver: "Edit tags, button". Activation -> /settings/tags.
- "Logs": Pressable role="button" aria-label="Logs"; same structure. VoiceOver: "Logs, button". Activation -> /settings/logs.
- Unchanged: radiogroup "Theme" with three radios, "Sign out" button.

LOGS
- Loading: wrapper role="progressbar" aria-label="Loading activity" (accessible on native); inner spinner aria-hidden. VoiceOver: "Loading activity".
- Error and no-closet texts: role="alert" (web announces on insert); load errors are also sent through announceForScreenReader on native.
- Empty: plain text "No activity yet."
- h2 "Recent activity in <closet name>": role="heading" aria-level={2}.
- List: View role="list" aria-label="Recent activity"; each entry View role="listitem" containing one Text (description, newline, nested timestamp Text) -> one VoiceOver stop per entry, read as "Ava created outfit Sunday Brunch, <date and time>"; web: one listitem per entry. No interactive elements, so nothing can lose focus when the list refreshes.

EDIT TAGS
- Loading: role="progressbar" aria-label="Loading tags".
- Load error: Text role="alert"; button "Try again" (role="button", name from text). After a successful retry the button is gone, so on web focus is moved to the "Add a tag" heading (focusOnWeb); native needs nothing.
- Section headings "Add a tag" and "Your tags": role="heading" aria-level={2}.
- Text field: TextInput aria-label="New tag"; visible label "New tag" above it. Web only (spread from a Record<string, string | boolean> like ariaCurrentPage in HeaderNav.web.tsx:27-29): aria-describedby = "new-tag-error new-tag-hint" when there is an error, else "new-tag-hint"; aria-invalid="true" only while an error is shown. Native: accessibilityHint="Up to 30 characters". VoiceOver: "New tag, text field, Up to 30 characters". Enter (web) / Done (iOS) submits and keeps focus in the field.
- Validation error: <Text id="new-tag-error" role="alert" key={nonce}>. The key remounts the node on every failed attempt so an identical message is announced again on web. Web: focus moves to (or stays in) the field, which then reads its name plus the error and hint. Native: announceForScreenReader(message); VoiceOver focus stays where it was (Add button or field). The error is cleared on the next keystroke and on a successful add. It is text, not colour alone.
- "Add tag" button: Pressable role="button", accessible name = visible text "Add tag" and it never changes; aria-busy={adding}; never disabled (a disabled web <button> drops focus to <body>, react-native-web Pressable/index.js:118-133); presses while busy are ignored. On success: field cleared, new row appended at the end of the list, focus unchanged (button or field), toast "Added tag <name>" spoken.
- Count sentence and removal note: plain text, read in order after the "Your tags" heading; not live regions (the toast already speaks each change).
- List: View role="list" aria-label="Your tags"; each row View role="listitem" (not `accessible`, so both children are reachable).
  - Name text. Active: "<name>". Removed: "<name> (removed)" - the state is in the words, the strike-through is decoration.
  - Row button, active state: role="button", aria-label={`Remove tag ${name}`}, visible "Remove" (visible word is contained in the name). VoiceOver: "Remove tag Casual, button".
  - Row button, removed state: same element, aria-label={`Undo remove tag ${name}`}, visible "Undo". VoiceOver: "Undo remove tag Casual, button".
  - In flight: aria-busy true, name and visible text unchanged, opacity 0.6, extra presses ignored; never disabled, never unmounted.
  - Remove success: focus stays on the same button (now Undo); toast "Removed tag <name>. Undo is available." is spoken. Activating again undoes; toast "Restored tag <name>"; the button is Remove again; focus still on it.
  - Failure: showAlert("Couldn't remove tag" | "Couldn't restore tag", message) - UIAlertController on iOS (VoiceOver reads title, message, OK), window.alert on web; when dismissed, focus returns to the same row button, which still exists.
- There is no confirm dialog and no window.confirm anywhere in the flow.
- Stylist mode / no closet: the same screen; ownership sentence or the no-closet paragraph is ordinary text directly after the title.

CREATE OUTFIT
- With tags: field label "Tag"; iOS button "Tag, required", value "Not selected" or the tag, opening the native action sheet; web <select aria-label="Tag" aria-required="true"> listing tags verbatim. If the chosen tag is removed while the form is open the select returns to "Select a tag" and Save disables as it does today.
- Without tags: one sentence of text in place of the select (copy in uiSpec); Save is enabled once name, description and an item are present.

OUTFITS FILTER
- Pills remain role="tab" with aria-selected inside the tablist; aria-label is the tag exactly as stored and now equals the visible text. Row absent when the closet has no tags. Selection falls back to "All" (aria-selected true) if its tag is removed.

TOAST (shared)
- Web: unchanged always-mounted <Text role="alert" aria-live="polite">. iOS: now announceForAccessibilityWithOptions(text, { queue: true }); Android: announceForAccessibility. Tag toasts always include the tag name and alternate between Added / Removed / Restored, so two identical consecutive messages (which the web live region would not repeat) cannot occur.

TARGETS, CONTRAST, REFLOW
- All new buttons minHeight 48 (rows full width; Remove/Undo minWidth 64); input minHeight 48, fontSize 16 (prevents iOS Safari zoom in the PWA). Text colours used: textPrimary, textSecondary, danger, link on surface/surfaceAlt, all at least 5:1 in both themes (src/theme/theme.ts:52-81); header stays neutral in stylist mode. Long tags wrap inside flexShrink text; the button keeps its width; nothing scrolls horizontally at 320px.

CHECKS FOR THE WEB EXPORT (Playwright, select by role/name; needs a test-auth build or injected session because web sign-in is Google-only, src/app/sign-in.tsx:64-81)
1. /settings: buttons "Edit tags" and "Logs" are BUTTON elements at least 44px tall; nav "Primary" has four links and no "Logs".
2. Activate each: URL /settings/tags or /settings/logs, exactly one visible h1 with the title and it is focused; link "Settings, back" exists; after back and after page.goBack() URL is /settings and h1 "Settings" is focused; "Sign out" has count 0 while a sub-screen is open.
3. Direct load of /settings/logs and /settings/tags shows the back link; /about ends on /settings/logs.
4. Edit tags: list "Your tags" has 10 listitems; fill "Vintage" + Enter -> 11 listitems, field empty and still focused, live region contains "Added tag Vintage".
5. Add with empty field, with "casual " and at 30 tags -> role=alert with the exact message, field focused with aria-invalid="true" and aria-describedby containing new-tag-error; repeating the same mistake keeps focus in the field.
6. Click "Remove tag Casual" -> no dialog event; the same element is focused and is now named "Undo remove tag Casual"; listitem text contains "(removed)"; live region contains "Removed tag Casual. Undo is available."; document.activeElement is never BODY. Click again -> "Remove tag Casual", live region "Restored tag Casual", and after reload Casual is back in its original position.
7. Propagation: on Outfits, tab "Vintage" exists and tab "Casual" does not while removed; on Create outfit, combobox "Tag" options match the list; with zero tags there are no tabs and no combobox, and the sentence is visible.
8. Dark mode (localStorage 'zeeba.theme-mode' = 'dark') and 320px width: repeat 1, 4, 6; document.scrollWidth <= clientWidth.
iPhone-only (cannot be run here): "Settings, tab, 4 of 4"; back button speech; queued toast heard in full after a double-tap; VoiceOver focus staying on the row button as it flips Remove/Undo; Dynamic Type at the largest size; behaviour inside the installed standalone PWA.

## Files to touch

- supabase/migrations/20261111000000_closet_outfit_labels.sql (NEW - column, validator function, check constraint, add/remove RPCs, grants)
- src/types/supabase.types.ts (closets Row/Insert/Update gain outfit_labels; three entries added to Functions)
- src/services/dataService.types.ts (remove OUTFIT_LABELS/OutfitLabel; add DEFAULT_OUTFIT_LABELS, limits, normalizeOutfitLabel, validateNewOutfitLabel; NewOutfitInput.label: string | null; StylistCloset.outfit_labels; two IDataService methods)
- src/services/supabaseClosetsService.ts (select outfit_labels with 42703 fallback in four functions; addClosetOutfitLabel, removeClosetOutfitLabel)
- src/services/supabaseService.ts (register the two new functions)
- src/services/supabaseOutfitsService.ts (line 43: labels: input.label ? [input.label] : [])
- src/services/previewService.ts (session-only previewOutfitLabels, previewCloset(), two new methods, line 270 labels)
- src/context/ClosetContext.tsx (activeClosetLabels, applyClosetLabels, memo deps)
- src/utils/announce.ts (NEW - announceForScreenReader, focusOnWeb)
- src/components/Toast.tsx (use announceForScreenReader so iOS announcements are queued)
- src/components/LoadingIndicator.tsx (NEW - labelled spinner that works on iOS, Android and web)
- src/components/TagEditor.tsx (NEW - Edit tags screen body)
- src/components/CreateOutfitForm.tsx (Tag field from activeClosetLabels, identity formatLabel, no-tags text, optional tag when list is empty, copy)
- src/components/OutfitsGrid.tsx (labels prop, string selection, reset effect, hide pills when empty)
- src/components/FilterPills.tsx (remove textTransform: 'capitalize' at line 118)
- src/components/HeaderNav.web.tsx (remove Logs item and '/about' from the href union; comment)
- src/app/(tabs)/outfits/index.tsx (pass activeClosetLabels to OutfitsGrid)
- src/app/(tabs)/_layout.tsx (remove about Tabs.Screen; settings headerShown: false)
- src/app/(tabs)/_layout.web.tsx (remove about Tabs.Screen; settings headerShown: false; comment)
- src/app/(tabs)/settings/_layout.tsx (NEW - nested Stack, neutral header)
- src/app/(tabs)/settings/index.tsx (git mv from src/app/(tabs)/settings.tsx; Stack.Screen title; Closet card with Edit tags and Logs buttons)
- src/app/(tabs)/settings/logs.tsx (git mv from src/app/(tabs)/about.tsx; title, labelled spinner, role=alert errors, list semantics, h2)
- src/app/(tabs)/settings/tags.tsx (NEW - title + TagEditor)
- src/app/about.tsx (NEW - Redirect to /settings/logs withAnchor)
- src/app/_layout.tsx (register the about redirect screen inside the signed-in Stack.Protected group)
- public/.well-known/apple-app-site-association (comment text of the /about component only)
- DELETED BY THE MOVES: src/app/(tabs)/settings.tsx, src/app/(tabs)/about.tsx
- CHECKED, NO CHANGE: app.config.ts, public/_redirects, public/sw.js, public/manifest.json, supabase/seed.sql, supabase/schema.sql, src/services/supabaseRowMappers.ts, src/services/supabaseActivityService.ts, src/state/outfitsRefresh.ts, src/components/NativeSelect.tsx, src/components/NativeSelect.web.tsx, src/components/NativeSelect.shared.ts, src/constants/MyOutfitsData.tsx

## Risks noted by the design

- Deploy order: the migration cannot be applied from this environment and the web client deploys independently. Apply the migration BEFORE shipping the client. If the client ships first, selectWithLabelsFallback keeps closets loading with the ten defaults and add/remove fail with 'Editing tags is not available yet. Please try again later.' That fallback relies on PostgREST reporting Postgres code 42703 for the missing column (also inside the closets(...) embed) and PGRST202 for a missing function; neither was exercised here. If the codes differ, a client-first deploy shows 'Failed to load your closet.' for everyone until the migration runs.
- Nothing was built or run: the SQL is correct by inspection only (array slicing for target_position, SELECT ... FOR UPDATE under RLS, the [[:cntrl:]] regex and the IMMUTABLE validator inside a CHECK should be exercised in PGlite or a local Supabase before production).
- iOS VoiceOver behaviour is unverified (no device): whether the queued toast announcement is heard in full after a double-tap, whether VoiceOver focus stays on the row button when its label flips between Remove and Undo, how the default back button and the role=list/listitem Views are spoken, and whether the LoadingIndicator wrapper reads 'Loading tags'. The design avoids programmatic VoiceOver focus and alert-dismissal timing precisely because they cannot be tested here.
- Toast now queues its announcement on iOS for every screen that toasts (voice notes, item/outfit updated, background removal, join closet). This matches the existing RemoveBackgroundButton pattern but is a global behaviour change that only a device can confirm.
- Tag lists reach other sessions lazily: a stylist's running session, or the owner's second device, keeps its copy until closet mode is toggled or the app restarts (ClosetContext only refetches then, src/context/ClosetContext.tsx:51-97). A stale list is harmless (an outfit may be saved with a tag the owner just removed and then shows only under All) but is not live.
- Removed tags stay on existing outfits, and already-installed iOS builds keep offering the hardcoded ten and writing them to outfits.labels regardless of the owner's list. The app must keep tolerating outfit labels that are in no list. Matching is exact and case-sensitive, so removing 'Work' and later typing 'work' does not reconnect old outfits; only Undo (same string) or retyping the identical spelling does.
- Undo exists only until the Edit tags screen next gains focus; after that a removed tag must be retyped. There is no 'Restore default tags' button by decision.
- Route behaviour derived from library source, not run: the /about Redirect with withAnchor; the static export layout for /settings as a directory route (same shape as /closet, which works in production); a back chevron appearing on the Settings root after arriving from an item/outfit detail page via the web nav; and the duplicate index pushed when the Settings nav link is clicked from /settings/logs or /settings/tags. The last two already happen for My Closet and Outfits.
- tsc cannot validate hrefs here (.expo/types is absent, so Href is string). Stale '/about' strings and the new '/settings/logs', '/settings/tags' literals must be checked by grep and at runtime; on a dev machine with generated typed routes HeaderNav.web.tsx would error if '/about' were left in the union.
- The web back control on the two sub-screens is react-navigation's default icon-only link (about 24x24 CSS px, named 'Settings, back'), the same control /closet/new and /outfits/new use. It meets the 24px minimum but is below the app's 48pt norm; in the standalone PWA it is the only visible way back.
- Settings' title moves from the left-aligned HeaderBanner to the centred stack header. Intentional (same as My Closet/Outfits) but visible. The settings stack deliberately does not turn blue in stylist mode.
- The supabase client has no Database generic (src/utils/supabase.ts:9), so a typo in 'outfit_labels', 'add_closet_outfit_label' or an argument name compiles and fails only at runtime; src/types/supabase.types.ts is hand-maintained and will not catch drift from the migration.
- An owner can still PATCH their own closets row directly; the CHECK constraint bounds what they can store (30 tags, 30 characters, no case-insensitive duplicates) but such a write skips the whitespace normalisation the RPC applies.
- Client length checks count UTF-16 units and Postgres counts code points, so the client is equal or stricter (an emoji counts as two toward the 30 on the client). JS toLowerCase and Postgres lower() can disagree on unusual Unicode; the server is authoritative and its message is shown inline.
- Android only: the NativeSelect modal still applies textTransform: 'capitalize' to option text (src/components/NativeSelect.tsx:162-165), so a lower-case custom tag looks capitalised in that one picker. Left alone because the style is shared with the item-type select.
- Guest mode: tag edits are in memory and reset on restart; the bundled preview outfits carry lower-case labels that match none of the default pills (pre-existing, src/constants/MyOutfitsData.tsx); Logs is always empty for guests. Guest mode cannot be reached on web, so Playwright needs a test-auth build (EXPO_PUBLIC_ENABLE_TEST_AUTH) or an injected session with mocked REST, and a populated Logs list needs mocked data.
- Pre-existing and out of scope: document.title is never set on web; +not-found has hard-coded colours and no way home; regenerate_closet_passphrase is called by the client but defined in no migration (do not expect it in a PGlite or migration-built database).

## Migration SQL

See `draft_closet_outfit_labels.sql` in this folder.
