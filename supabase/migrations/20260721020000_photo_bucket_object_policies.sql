-- Lets signed-in users upload/replace/delete objects in the two photo
-- buckets. The buckets themselves are public (read bypasses RLS entirely),
-- but storage.objects has RLS on by default with zero policies, so writes
-- via the client SDK (upload/remove) were only ever working on remote
-- because these were added by hand and never captured in a migration - the
-- same drift as handle_new_auth_user's trigger. Membership on the
-- referenced closet is already enforced one layer up, at the
-- clothing_item_photos/outfit_photos row level, so this only needs to gate
-- by bucket, not re-derive closet membership from the storage path.

CREATE POLICY "Authenticated users can manage clothing item photo objects" ON "storage"."objects"
    FOR ALL TO "authenticated"
    USING (("bucket_id" = 'clothing_item_photos'))
    WITH CHECK (("bucket_id" = 'clothing_item_photos'));

CREATE POLICY "Authenticated users can manage outfit photo objects" ON "storage"."objects"
    FOR ALL TO "authenticated"
    USING (("bucket_id" = 'outfit_photos'))
    WITH CHECK (("bucket_id" = 'outfit_photos'));
