-- Activity log: records create/edit/delete actions on outfits and clothing items,
-- driven by triggers so every write path (not just the app) gets logged.
-- item_id has no FK (must survive the referenced row's deletion), item_name/actor_name
-- are snapshotted at insert time so "ida deleted outfit 123" still reads correctly later.

CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "closet_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "actor_name" "text",
    "action_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_logs_item_type_check" CHECK (("item_type" = ANY (ARRAY['outfit'::"text", 'clothing_item'::"text"]))),
    CONSTRAINT "activity_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['created'::"text", 'edited'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_closet_id_fkey" FOREIGN KEY ("closet_id") REFERENCES "public"."closets"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


CREATE INDEX "activity_logs_closet_id_created_at_idx" ON "public"."activity_logs" ("closet_id", "created_at" DESC);


ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Members can view activity logs" ON "public"."activity_logs" FOR SELECT TO "authenticated" USING ("public"."is_closet_member"("closet_id"));


GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";


-- Trigger functions: log outfit / clothing item creates, core-field edits, and deletes.
-- UPDATE is scoped to the columns listed in "UPDATE OF" below, so e.g. bumping
-- outfits.compliment_count alone never logs an "edited" activity.
-- On DELETE, if the parent closet is already gone (bulk cascade from a closet delete),
-- skip logging entirely -- that activity_logs row would be unreadable and immediately
-- cascade-deleted anyway, and inserting it would violate the closet_id foreign key
-- since the closets row is removed before its cascade deletes fire on child tables.

CREATE OR REPLACE FUNCTION "public"."log_outfit_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.outfits;
  v_action text;
  v_actor_name text;
begin
  if TG_OP = 'DELETE' then
    v_row := OLD;
    v_action := 'deleted';
    if not exists (select 1 from public.closets where id = v_row.closet_id) then
      return OLD;
    end if;
  else
    v_row := NEW;
    v_action := case TG_OP when 'INSERT' then 'created' else 'edited' end;
  end if;

  select coalesce(username, email) into v_actor_name
  from public.users
  where id = auth.uid();

  insert into public.activity_logs
    (user_id, closet_id, item_type, item_id, item_name, actor_name, action_type)
  values
    (auth.uid(), v_row.closet_id, 'outfit', v_row.id, v_row.name, v_actor_name, v_action);

  return coalesce(NEW, OLD);
end;
$$;


ALTER FUNCTION "public"."log_outfit_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_clothing_item_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.clothing_items;
  v_action text;
  v_actor_name text;
begin
  if TG_OP = 'DELETE' then
    v_row := OLD;
    v_action := 'deleted';
    if not exists (select 1 from public.closets where id = v_row.closet_id) then
      return OLD;
    end if;
  else
    v_row := NEW;
    v_action := case TG_OP when 'INSERT' then 'created' else 'edited' end;
  end if;

  select coalesce(username, email) into v_actor_name
  from public.users
  where id = auth.uid();

  insert into public.activity_logs
    (user_id, closet_id, item_type, item_id, item_name, actor_name, action_type)
  values
    (auth.uid(), v_row.closet_id, 'clothing_item', v_row.id, v_row.name, v_actor_name, v_action);

  return coalesce(NEW, OLD);
end;
$$;


ALTER FUNCTION "public"."log_clothing_item_activity"() OWNER TO "postgres";


GRANT ALL ON FUNCTION "public"."log_outfit_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_outfit_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_outfit_activity"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_clothing_item_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_clothing_item_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_clothing_item_activity"() TO "service_role";


CREATE TRIGGER "log_outfit_activity_trigger"
    AFTER INSERT OR DELETE OR UPDATE OF "name", "description", "labels" ON "public"."outfits"
    FOR EACH ROW EXECUTE FUNCTION "public"."log_outfit_activity"();


CREATE TRIGGER "log_clothing_item_activity_trigger"
    AFTER INSERT OR DELETE OR UPDATE OF "name", "description", "fit_notes", "care_instructions", "brand", "purchase_url", "item_type" ON "public"."clothing_items"
    FOR EACH ROW EXECUTE FUNCTION "public"."log_clothing_item_activity"();
