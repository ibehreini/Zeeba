-- Lets "Edit outfit" change which clothing items are in an outfit.
--
-- The outfit row and its outfit_items rows have to change together, under
-- the same optimistic-concurrency token (outfits.updated_at), or two people
-- editing the same outfit's items could interleave: e.g. the owner's row
-- update succeeds, then the stylist's stale item list overwrites the owner's.
-- Two client calls can't guarantee that, so it is one function, i.e. one
-- transaction:
--
--   1. UPDATE the outfit WHERE updated_at = the token the caller read. This
--      takes the row lock, so a concurrent call on the same outfit waits and
--      then matches 0 rows. 0 rows (someone else saved first, the outfit was
--      deleted, or the caller can't see it) returns NULL, which the app maps
--      to ConflictError, just like updateWithOcc's empty result.
--      updated_at = now() is set explicitly so the token is bumped even when
--      only the item list changed. set_outfits_updated_at fires too (name,
--      description and labels are always in the SET list) and sets the same
--      value. log_outfit_activity_trigger fires for the same reason, so an
--      items-only edit is logged as "edited outfit", as it should be.
--   2. Checks the picked items: one that no longer exists (or that the caller
--      can't see) raises 23503, the same code an outfit_items insert gets for
--      a deleted item, so the app shows its usual "was just deleted" message.
--      One from another closet raises 22023 - the outfit_items policy only
--      checks the outfit's closet, not the item's.
--   3. Diffs the join rows: deletes the unpicked ones, inserts the new ones.
--      Any exception rolls back the whole call, including step 1.
--
-- No SECURITY DEFINER - runs as the caller, so "Members can manage outfits",
-- "Members can manage outfit items" and the clothing_items select policy all
-- still apply: only closet members can edit an outfit.

CREATE OR REPLACE FUNCTION "public"."update_outfit_with_items"(
    "p_outfit_id" "uuid",
    "p_expected_updated_at" timestamp with time zone,
    "p_name" "text",
    "p_description" "text",
    "p_labels" "text"[],
    "p_item_ids" "uuid"[]
) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_closet_id uuid;
  v_updated_at timestamptz;
begin
  if coalesce(cardinality(p_item_ids), 0) = 0 or array_position(p_item_ids, null) is not null then
    raise exception 'An outfit needs at least one clothing item.' using errcode = '22023';
  end if;

  update public.outfits
  set name = p_name,
      description = p_description,
      labels = p_labels,
      updated_at = now()
  where id = p_outfit_id
    and updated_at = p_expected_updated_at
  returning closet_id, updated_at into v_closet_id, v_updated_at;

  if not found then
    return null;
  end if;

  if exists (
    select 1 from unnest(p_item_ids) as picked(id)
    where not exists (select 1 from public.clothing_items ci where ci.id = picked.id)
  ) then
    raise exception 'One of the items you picked was just deleted.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.clothing_items ci
    where ci.id = any(p_item_ids) and ci.closet_id <> v_closet_id
  ) then
    raise exception 'One of the items you picked belongs to a different closet.' using errcode = '22023';
  end if;

  delete from public.outfit_items
  where outfit_id = p_outfit_id
    and clothing_item_id <> all(p_item_ids);

  insert into public.outfit_items (outfit_id, clothing_item_id)
  select distinct p_outfit_id, picked.id
  from unnest(p_item_ids) as picked(id)
  on conflict do nothing;

  return v_updated_at;
end;
$$;


ALTER FUNCTION "public"."update_outfit_with_items"("p_outfit_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_name" "text", "p_description" "text", "p_labels" "text"[], "p_item_ids" "uuid"[]) OWNER TO "postgres";


GRANT ALL ON FUNCTION "public"."update_outfit_with_items"("p_outfit_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_name" "text", "p_description" "text", "p_labels" "text"[], "p_item_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_outfit_with_items"("p_outfit_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_name" "text", "p_description" "text", "p_labels" "text"[], "p_item_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_outfit_with_items"("p_outfit_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_name" "text", "p_description" "text", "p_labels" "text"[], "p_item_ids" "uuid"[]) TO "service_role";
