-- handle_new_auth_user() has existed since the baseline schema but was never
-- attached to auth.users - it only worked on remote because a trigger was
-- created there by hand and never captured into a migration. Without it, a
-- fresh auth.users row never gets a matching public.users row, and every
-- insert that references public.users(id) (e.g. closets.owner_id) fails its
-- foreign key check.

CREATE OR REPLACE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_auth_user"();
