-- DRAFT - NOT YET APPLIED, NOT YET TESTED AGAINST THE REAL DATABASE.
-- Written by the 'accessibility-first' design (see docs/filter-work/design.md).
-- The design critic ran it on a throwaway Postgres 16; it has not been run in
-- docs/filter-work/db-test-rig yet, and it still needs the fixes listed in
-- docs/filter-work/README.md ('Changes to make to the design before building').
-- When it is ready, move it to supabase/migrations/<timestamp>_closet_outfit_labels.sql.

-- FILE: supabase/migrations/20261111000000_closet_outfit_labels.sql
-- (sorts after 20261013000000_voice_notes.sql)

-- Per-closet outfit tags (Settings > Edit tags).
--
-- Until now the app offered one hardcoded list of ten outfit labels to every
-- closet. This gives each closet its own list, which starts as those same ten
-- and which the closet's owner can add to and remove from.
--
-- Stored as a text[] column on closets rather than as a table of its own:
--   * The column default IS the starting list, so existing closets are
--     backfilled by ADD COLUMN and every new closet (the app's plain INSERT,
--     supabase/seed.sql) gets it with no trigger and no seeding step.
--   * The policies already on closets say exactly who may do what: "Members
--     can view their closets" lets stylists read the list, "Owners can update
--     their closets" keeps editing to the owner. No new policy is needed.
--   * The list rides along with the closet row the app already loads, so the
--     Outfits filter and the create-outfit form never wait on a second request.
--
-- The list only decides which tags the create-outfit form offers and which
-- filter pills the Outfits tab shows. outfits.labels stays free text and is
-- deliberately NOT rewritten when a tag is removed: any UPDATE that names
-- labels fires log_outfit_activity_trigger (one "edited outfit" log line per
-- outfit) and bumps updated_at, which would throw a conflict at anyone who
-- has that outfit open. An outfit keeps a removed tag; it just no longer has
-- a filter pill.
--
-- The ten defaults and both limits (30 tags, 30 characters) are mirrored by
-- DEFAULT_OUTFIT_LABELS, MAX_OUTFIT_LABELS and MAX_OUTFIT_LABEL_LENGTH in
-- src/services/dataService.types.ts - change them together.

-- The rules every stored list must satisfy, as a function because a CHECK
-- constraint cannot run a subquery over an array's elements: at most 30 tags;
-- each 1-30 characters with no leading/trailing spaces and no control
-- characters; no two tags that differ only by letter case. The add RPC below
-- gives friendlier messages for the same rules; this constraint is what holds
-- them when an owner PATCHes their closets row directly, which "Owners can
-- update their closets" allows.
CREATE OR REPLACE FUNCTION "public"."closet_outfit_labels_are_valid"("target_labels" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select
    coalesce(array_ndims(target_labels), 1) = 1
    and cardinality(target_labels) <= 30
    and not exists (
      select 1
      from unnest(target_labels) as l(label)
      where l.label is null
         or l.label <> btrim(l.label)
         or char_length(l.label) < 1
         or char_length(l.label) > 30
         or l.label ~ '[[:cntrl:]]'
    )
    and (select count(*) from unnest(target_labels) as l(label))
      = (select count(distinct lower(l.label)) from unnest(target_labels) as l(label));
$$;


ALTER FUNCTION "public"."closet_outfit_labels_are_valid"("target_labels" "text"[]) OWNER TO "postgres";


ALTER TABLE "public"."closets"
    ADD COLUMN "outfit_labels" "text"[] DEFAULT ARRAY['Girly/Romantic'::"text", 'Work'::"text", 'Casual'::"text", 'Date Night'::"text", 'Athleisure'::"text", 'Formal Event'::"text", 'Street Style'::"text", 'Minimalist Chic'::"text", 'Artsy'::"text", 'Boho'::"text"] NOT NULL;

ALTER TABLE "public"."closets"
    ADD CONSTRAINT "closets_outfit_labels_valid" CHECK ("public"."closet_outfit_labels_are_valid"("outfit_labels"));


-- Adds one tag and returns the whole updated list. A single-row RPC rather
-- than the client writing the array back: two devices editing at once would
-- otherwise overwrite each other's change with a stale copy of the list.
-- target_position (1-based) puts a tag back where it was when a removal is
-- undone; NULL appends.
-- No SECURITY DEFINER - runs as the caller, so "Owners can update their
-- closets" still decides who may do this (same reasoning as
-- increment_outfit_compliment_count). A stylist, or a signed-out caller,
-- matches no row and gets the "Only the closet owner" error.
CREATE OR REPLACE FUNCTION "public"."add_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text", "target_position" integer DEFAULT NULL) RETURNS "text"[]
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_label text := btrim(regexp_replace(coalesce(target_label, ''), '\s+', ' ', 'g'));
  v_current text[];
  v_existing text;
  v_position integer;
  v_labels text[];
begin
  if char_length(v_label) < 1 then
    raise exception 'Enter a tag name.';
  end if;

  if char_length(v_label) > 30 then
    raise exception 'Tags can be up to 30 characters.';
  end if;

  -- Locks the row so two adds at the same moment can't both pass the
  -- duplicate and limit checks below.
  select c.outfit_labels into v_current
  from public.closets c
  where c.id = target_closet_id and c.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'Only the closet owner can edit its tags.';
  end if;

  select l.label into v_existing
  from unnest(v_current) as l(label)
  where lower(l.label) = lower(v_label)
  limit 1;

  if v_existing is not null then
    raise exception 'You already have a tag named "%".', v_existing;
  end if;

  if cardinality(v_current) >= 30 then
    raise exception 'You can have up to 30 tags. Remove one to add another.';
  end if;

  v_position := least(greatest(coalesce(target_position, cardinality(v_current) + 1), 1), cardinality(v_current) + 1);

  update public.closets
  set outfit_labels = v_current[1:v_position - 1] || v_label || v_current[v_position:]
  where id = target_closet_id
  returning outfit_labels into v_labels;

  return v_labels;
end;
$$;


ALTER FUNCTION "public"."add_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text", "target_position" integer) OWNER TO "postgres";


-- Removes one tag (exact match) and returns the whole updated list. Removing
-- a tag that is already gone is not an error - the caller just gets the
-- current list back - so a removal made on another device never fails here.
-- Invoker rights, as above. Outfits are not touched; see the header.
CREATE OR REPLACE FUNCTION "public"."remove_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text") RETURNS "text"[]
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_labels text[];
begin
  update public.closets
  set outfit_labels = array_remove(outfit_labels, target_label)
  where id = target_closet_id and owner_id = auth.uid()
  returning outfit_labels into v_labels;

  if not found then
    raise exception 'Only the closet owner can edit its tags.';
  end if;

  return v_labels;
end;
$$;


ALTER FUNCTION "public"."remove_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text") OWNER TO "postgres";


GRANT ALL ON FUNCTION "public"."closet_outfit_labels_are_valid"("target_labels" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."closet_outfit_labels_are_valid"("target_labels" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."closet_outfit_labels_are_valid"("target_labels" "text"[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."add_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text", "target_position" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text", "target_position" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text", "target_position" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."remove_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_closet_outfit_label"("target_closet_id" "uuid", "target_label" "text") TO "service_role";

-- NOTES (not part of the file):
-- * No new table, policy, trigger or backfill statement. No grant is needed for the column: GRANT ALL ON TABLE closets already exists (baseline:664-666).
-- * supabase/seed.sql and supabase/schema.sql are not edited (seed closets take the default; schema.sql is a stale snapshot).
-- * Written by inspection only; not run. For a PGlite check: stub roles, auth.uid() and the baseline as the database engineer described, then assert (1) existing and new closets rows have the ten defaults, (2) add as owner appends / inserts at target_position, (3) add of 'casual ' raises the duplicate message, (4) add as a collaborator raises 'Only the closet owner can edit its tags.', (5) remove is idempotent, (6) a direct UPDATE setting ARRAY['a','A'] or a 31-element array violates closets_outfit_labels_valid, (7) '{}' is accepted.
