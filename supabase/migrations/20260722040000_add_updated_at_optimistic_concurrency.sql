-- Adds `updated_at` to outfits and clothing_items, plus a trigger that keeps
-- it current on every update. The app compares this value against what it
-- last read (optimistic concurrency control) to detect when two people -
-- e.g. a stylist and the closet owner - edit or delete the same row at once,
-- rather than silently letting the second write clobber the first.
--
-- The column is only ever set by the trigger, never by the client, so a
-- stale device clock can't produce a false match.

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

ALTER TABLE "public"."clothing_items"
    ADD COLUMN "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL;

ALTER TABLE "public"."outfits"
    ADD COLUMN "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL;

CREATE TRIGGER "set_clothing_items_updated_at"
    BEFORE UPDATE ON "public"."clothing_items"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "set_outfits_updated_at"
    BEFORE UPDATE ON "public"."outfits"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";
