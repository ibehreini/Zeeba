-- The "Public access to ... bucket" policies were added by hand directly on
-- remote (same untracked-drift pattern as handle_new_auth_user's trigger) and
-- grant ALL (select/insert/update/delete) to the public role gated only by
-- bucket_id -- meaning anonymous requests could upload, overwrite, or delete
-- photos. Public *read* of rendered photos is unaffected: it goes through the
-- bucket's public=true flag at the storage/CDN layer, which bypasses these
-- RLS policies entirely, not through a SELECT policy here. The scoped
-- "Authenticated users can manage ... photo objects" policies from
-- 20260721020000 remain as the only policies on these two buckets afterward.
DROP POLICY IF EXISTS "Public access to clothing item photos bucket" ON "storage"."objects";
DROP POLICY IF EXISTS "Public access to outfit photos bucket" ON "storage"."objects";

-- wardrobe-media predates the clothing_item_photos/outfit_photos bucket split,
-- isn't declared in config.toml, and holds zero objects on remote -- dead
-- weight left over from before the rename. Drop its policies here; the empty
-- bucket row itself must be deleted via the Storage API (`supabase storage rm`
-- or the dashboard), not SQL -- storage.buckets rejects direct DML.
DROP POLICY IF EXISTS "Owners can delete their own wardrobe media" ON "storage"."objects";
DROP POLICY IF EXISTS "Owners can update their own wardrobe media" ON "storage"."objects";
DROP POLICY IF EXISTS "Public read access to wardrobe media" ON "storage"."objects";
DROP POLICY IF EXISTS "Signed-in users can upload wardrobe media" ON "storage"."objects";
