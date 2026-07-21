-- Lets a stylist who isn't a member yet join a closet by typing its passphrase.
-- Plain RLS can't support this: "Members can view their closets" blocks a
-- non-member from SELECTing the closets row to resolve pass_phrase -> id, and
-- "Owners can add collaborators" only lets the owner INSERT into
-- closet_collaborators, not a self-joining stylist. SECURITY DEFINER runs
-- both steps with elevated privilege instead of widening either policy.

CREATE OR REPLACE FUNCTION "public"."join_closet_by_passphrase"("target_pass_phrase" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_closet_id uuid;
begin
  select id into v_closet_id
  from public.closets
  where pass_phrase = target_pass_phrase;

  if v_closet_id is null then
    raise exception 'Invalid passphrase';
  end if;

  if exists (select 1 from public.closets where id = v_closet_id and owner_id = auth.uid()) then
    raise exception 'You already own this closet';
  end if;

  insert into public.closet_collaborators (user_id, closet_id)
  values (auth.uid(), v_closet_id)
  on conflict (user_id, closet_id) do nothing;

  return v_closet_id;
end;
$$;


ALTER FUNCTION "public"."join_closet_by_passphrase"("target_pass_phrase" "text") OWNER TO "postgres";


GRANT ALL ON FUNCTION "public"."join_closet_by_passphrase"("target_pass_phrase" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_closet_by_passphrase"("target_pass_phrase" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_closet_by_passphrase"("target_pass_phrase" "text") TO "service_role";
