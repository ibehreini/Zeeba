-- Voice notes: short (<= 30s) audio recordings a stylist or closet owner
-- attaches to an outfit or a clothing item, as a spoken companion to the
-- text description. One table covers both targets via two nullable FKs with
-- an exactly-one check, so the app has a single list/upload/delete path.
--
-- The audio itself lives in the new public `voice_notes` storage bucket,
-- mirroring the photo buckets: public read via the bucket flag (the URL in
-- audio_url is a plain public object URL), writes gated to signed-in users at
-- the storage layer, and closet membership enforced on the row here.

CREATE TABLE "public"."voice_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "closet_id" "uuid" NOT NULL,
    "outfit_id" "uuid",
    "clothing_item_id" "uuid",
    "created_by_user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration_seconds" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "voice_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "voice_notes_closet_id_fkey" FOREIGN KEY ("closet_id") REFERENCES "public"."closets"("id") ON DELETE CASCADE,
    CONSTRAINT "voice_notes_outfit_id_fkey" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE CASCADE,
    CONSTRAINT "voice_notes_clothing_item_id_fkey" FOREIGN KEY ("clothing_item_id") REFERENCES "public"."clothing_items"("id") ON DELETE CASCADE,
    CONSTRAINT "voice_notes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "voice_notes_one_target" CHECK ((("outfit_id" IS NOT NULL) <> ("clothing_item_id" IS NOT NULL))),
    CONSTRAINT "voice_notes_duration_range" CHECK (("duration_seconds" > 0 AND "duration_seconds" <= 30))
);

ALTER TABLE "public"."voice_notes" OWNER TO "postgres";

CREATE INDEX "voice_notes_outfit_id_idx" ON "public"."voice_notes" ("outfit_id");
CREATE INDEX "voice_notes_clothing_item_id_idx" ON "public"."voice_notes" ("clothing_item_id");

ALTER TABLE "public"."voice_notes" ENABLE ROW LEVEL SECURITY;

-- Owner and stylists of the closet can listen.
CREATE POLICY "Members can view voice notes" ON "public"."voice_notes"
    FOR SELECT TO "authenticated"
    USING ("public"."is_closet_member"("closet_id"));

-- Any member can record one, but only as themselves.
CREATE POLICY "Members can add their own voice notes" ON "public"."voice_notes"
    FOR INSERT TO "authenticated"
    WITH CHECK (("created_by_user_id" = "auth"."uid"()) AND "public"."is_closet_member"("closet_id"));

-- Whoever recorded it can delete it, and so can the closet owner (it's
-- their closet - they shouldn't be stuck with a note they can't remove).
CREATE POLICY "Recorder or closet owner can delete voice notes" ON "public"."voice_notes"
    FOR DELETE TO "authenticated"
    USING (
        ("created_by_user_id" = "auth"."uid"())
        OR EXISTS (SELECT 1 FROM "public"."closets" "c" WHERE "c"."id" = "closet_id" AND "c"."owner_id" = "auth"."uid"())
    );

GRANT ALL ON TABLE "public"."voice_notes" TO "anon";
GRANT ALL ON TABLE "public"."voice_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_notes" TO "service_role";

-- Storage: same shape as the photo buckets (see 20260721020000). iOS records
-- AAC in an .m4a container; browsers record Opus in WebM or, where the
-- browser supports it, AAC in MP4.
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('voice_notes', 'voice_notes', true, 5242880, ARRAY['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav'])
ON CONFLICT ("id") DO NOTHING;

CREATE POLICY "Authenticated users can manage voice note objects" ON "storage"."objects"
    FOR ALL TO "authenticated"
    USING (("bucket_id" = 'voice_notes'))
    WITH CHECK (("bucket_id" = 'voice_notes'));
