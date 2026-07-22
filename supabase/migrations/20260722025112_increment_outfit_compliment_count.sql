-- Atomically increments an outfit's compliment_count. A client-side
-- read-then-write would lose updates if two people tapped "Log compliment"
-- around the same time; this does the increment in one statement instead.
-- No SECURITY DEFINER -- runs as the caller (default), so the existing
-- "Members can manage outfits" RLS policy still applies: only closet
-- members can log a compliment.

CREATE OR REPLACE FUNCTION "public"."increment_outfit_compliment_count"("target_outfit_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer;
begin
  update public.outfits
  set compliment_count = compliment_count + 1
  where id = target_outfit_id
  returning compliment_count into v_count;

  if v_count is null then
    raise exception 'Outfit not found or not accessible';
  end if;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."increment_outfit_compliment_count"("target_outfit_id" "uuid") OWNER TO "postgres";


GRANT ALL ON FUNCTION "public"."increment_outfit_compliment_count"("target_outfit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_outfit_compliment_count"("target_outfit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_outfit_compliment_count"("target_outfit_id" "uuid") TO "service_role";
