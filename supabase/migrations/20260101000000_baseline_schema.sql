


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.users (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_closet_member"("target_closet_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.closets c
    where c.id = target_closet_id and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.closet_collaborators cc
    where cc.closet_id = target_closet_id and cc.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_closet_member"("target_closet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_closet_owner"("target_closet_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.closets c
    where c.id = target_closet_id and c.owner_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_closet_owner"("target_closet_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."closet_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "closet_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."closet_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."closets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "closet_name" "text" NOT NULL,
    "pass_phrase" "text" DEFAULT "substr"("md5"((("random"())::"text" || ("clock_timestamp"())::"text")), 1, 10) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."closets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clothing_item_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clothing_item_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clothing_item_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clothing_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "closet_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "fit_notes" "text",
    "care_instructions" "text",
    "brand" "text",
    "purchase_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clothing_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['shirt'::"text", 'pants'::"text", 'dress_romper'::"text", 'shoes'::"text", 'jacket'::"text", 'purse'::"text", 'jewelry'::"text", 'accessory'::"text"])))
);


ALTER TABLE "public"."clothing_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outfit_items" (
    "outfit_id" "uuid" NOT NULL,
    "clothing_item_id" "uuid" NOT NULL
);


ALTER TABLE "public"."outfit_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outfit_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "outfit_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."outfit_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outfits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "closet_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "labels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "compliment_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."outfits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "username" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wear_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "closet_id" "uuid" NOT NULL,
    "outfit_id" "uuid",
    "clothing_item_id" "uuid",
    "worn_on_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT "wear_logs_check" CHECK ((("outfit_id" IS NOT NULL) OR ("clothing_item_id" IS NOT NULL)))
);


ALTER TABLE "public"."wear_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."closet_collaborators"
    ADD CONSTRAINT "closet_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."closet_collaborators"
    ADD CONSTRAINT "closet_collaborators_user_id_closet_id_key" UNIQUE ("user_id", "closet_id");



ALTER TABLE ONLY "public"."closets"
    ADD CONSTRAINT "closets_pass_phrase_key" UNIQUE ("pass_phrase");



ALTER TABLE ONLY "public"."closets"
    ADD CONSTRAINT "closets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clothing_item_photos"
    ADD CONSTRAINT "clothing_item_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clothing_items"
    ADD CONSTRAINT "clothing_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outfit_items"
    ADD CONSTRAINT "outfit_items_pkey" PRIMARY KEY ("outfit_id", "clothing_item_id");



ALTER TABLE ONLY "public"."outfit_photos"
    ADD CONSTRAINT "outfit_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outfits"
    ADD CONSTRAINT "outfits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."closet_collaborators"
    ADD CONSTRAINT "closet_collaborators_closet_id_fkey" FOREIGN KEY ("closet_id") REFERENCES "public"."closets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."closet_collaborators"
    ADD CONSTRAINT "closet_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."closets"
    ADD CONSTRAINT "closets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clothing_item_photos"
    ADD CONSTRAINT "clothing_item_photos_clothing_item_id_fkey" FOREIGN KEY ("clothing_item_id") REFERENCES "public"."clothing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clothing_items"
    ADD CONSTRAINT "clothing_items_closet_id_fkey" FOREIGN KEY ("closet_id") REFERENCES "public"."closets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_items"
    ADD CONSTRAINT "outfit_items_clothing_item_id_fkey" FOREIGN KEY ("clothing_item_id") REFERENCES "public"."clothing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_items"
    ADD CONSTRAINT "outfit_items_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfit_photos"
    ADD CONSTRAINT "outfit_photos_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfits"
    ADD CONSTRAINT "outfits_closet_id_fkey" FOREIGN KEY ("closet_id") REFERENCES "public"."closets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outfits"
    ADD CONSTRAINT "outfits_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_closet_id_fkey" FOREIGN KEY ("closet_id") REFERENCES "public"."closets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_clothing_item_id_fkey" FOREIGN KEY ("clothing_item_id") REFERENCES "public"."clothing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wear_logs"
    ADD CONSTRAINT "wear_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Members can manage clothing item photos" ON "public"."clothing_item_photos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clothing_items" "ci"
  WHERE (("ci"."id" = "clothing_item_photos"."clothing_item_id") AND "public"."is_closet_member"("ci"."closet_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clothing_items" "ci"
  WHERE (("ci"."id" = "clothing_item_photos"."clothing_item_id") AND "public"."is_closet_member"("ci"."closet_id")))));



CREATE POLICY "Members can manage clothing items" ON "public"."clothing_items" TO "authenticated" USING ("public"."is_closet_member"("closet_id")) WITH CHECK ("public"."is_closet_member"("closet_id"));



CREATE POLICY "Members can manage outfit items" ON "public"."outfit_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."outfits" "o"
  WHERE (("o"."id" = "outfit_items"."outfit_id") AND "public"."is_closet_member"("o"."closet_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."outfits" "o"
  WHERE (("o"."id" = "outfit_items"."outfit_id") AND "public"."is_closet_member"("o"."closet_id")))));



CREATE POLICY "Members can manage outfit photos" ON "public"."outfit_photos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."outfits" "o"
  WHERE (("o"."id" = "outfit_photos"."outfit_id") AND "public"."is_closet_member"("o"."closet_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."outfits" "o"
  WHERE (("o"."id" = "outfit_photos"."outfit_id") AND "public"."is_closet_member"("o"."closet_id")))));



CREATE POLICY "Members can manage outfits" ON "public"."outfits" TO "authenticated" USING ("public"."is_closet_member"("closet_id")) WITH CHECK ("public"."is_closet_member"("closet_id"));



CREATE POLICY "Members can view collaborators" ON "public"."closet_collaborators" FOR SELECT TO "authenticated" USING ("public"."is_closet_member"("closet_id"));



CREATE POLICY "Members can view their closets" ON "public"."closets" FOR SELECT TO "authenticated" USING (("public"."is_closet_member"("id") OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "Members can view wear logs" ON "public"."wear_logs" FOR SELECT TO "authenticated" USING ("public"."is_closet_member"("closet_id"));



CREATE POLICY "Owners can add collaborators" ON "public"."closet_collaborators" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_closet_owner"("closet_id"));



CREATE POLICY "Owners can delete their closets" ON "public"."closets" FOR DELETE TO "authenticated" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Owners can update their closets" ON "public"."closets" FOR UPDATE TO "authenticated" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Owners or the collaborator can remove a collaborator" ON "public"."closet_collaborators" FOR DELETE TO "authenticated" USING (("public"."is_closet_owner"("closet_id") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users are viewable by any signed-in user" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create closets they own" ON "public"."closets" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own wear logs" ON "public"."wear_logs" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can log their own wears" ON "public"."wear_logs" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_closet_member"("closet_id")));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own wear logs" ON "public"."wear_logs" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."closet_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."closets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clothing_item_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clothing_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outfit_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outfit_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outfits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wear_logs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_closet_member"("target_closet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_closet_member"("target_closet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_closet_member"("target_closet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_closet_owner"("target_closet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_closet_owner"("target_closet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_closet_owner"("target_closet_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."closet_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."closet_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."closet_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."closets" TO "anon";
GRANT ALL ON TABLE "public"."closets" TO "authenticated";
GRANT ALL ON TABLE "public"."closets" TO "service_role";



GRANT ALL ON TABLE "public"."clothing_item_photos" TO "anon";
GRANT ALL ON TABLE "public"."clothing_item_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."clothing_item_photos" TO "service_role";



GRANT ALL ON TABLE "public"."clothing_items" TO "anon";
GRANT ALL ON TABLE "public"."clothing_items" TO "authenticated";
GRANT ALL ON TABLE "public"."clothing_items" TO "service_role";



GRANT ALL ON TABLE "public"."outfit_items" TO "anon";
GRANT ALL ON TABLE "public"."outfit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."outfit_items" TO "service_role";



GRANT ALL ON TABLE "public"."outfit_photos" TO "anon";
GRANT ALL ON TABLE "public"."outfit_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."outfit_photos" TO "service_role";



GRANT ALL ON TABLE "public"."outfits" TO "anon";
GRANT ALL ON TABLE "public"."outfits" TO "authenticated";
GRANT ALL ON TABLE "public"."outfits" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."wear_logs" TO "anon";
GRANT ALL ON TABLE "public"."wear_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."wear_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































