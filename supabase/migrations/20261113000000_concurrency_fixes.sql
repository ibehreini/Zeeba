-- Two races found by scripts/tests/concurrency.test.mjs (npm run test:db).
--
-- 1. outfits.updated_at is the optimistic-concurrency token for edits and
--    deletes, but its trigger fired on EVERY update - including the
--    compliment_count bump from increment_outfit_compliment_count. So anyone
--    with the outfit's edit form open got a false "Someone else saved
--    changes" when another member logged a compliment, and logging a
--    compliment and then pressing Delete on the same detail page failed with
--    "Already changed" (the page still held the pre-compliment token).
--    The trigger now fires only for the columns a person edits, the same
--    list log_outfit_activity_trigger already uses (plus closet_id).
--
-- 2. Nothing stopped a user owning two closets. Creating one from two
--    devices (or a double submit) at the same moment inserted both, after
--    which getOwnCloset's maybeSingle() failed on every launch and the user
--    was locked out of "My closet". One closet per owner is now enforced;
--    createOwnCloset returns the existing closet when it loses the race.
--    NOTE: this index fails to build if any owner already has two closets -
--    check first with:
--      select owner_id, count(*) from public.closets group by 1 having count(*) > 1;

DROP TRIGGER IF EXISTS "set_outfits_updated_at" ON "public"."outfits";

CREATE TRIGGER "set_outfits_updated_at"
    BEFORE UPDATE OF "closet_id", "name", "description", "labels" ON "public"."outfits"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE UNIQUE INDEX IF NOT EXISTS "closets_owner_id_key" ON "public"."closets" ("owner_id");
