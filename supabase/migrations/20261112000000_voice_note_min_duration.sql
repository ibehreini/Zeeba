-- Voice notes must be at least 3 seconds (the app refuses shorter ones;
-- MIN_VOICE_NOTE_SECONDS in dataService.types.ts). Still capped at 30.
--
-- NOT VALID: enforced for every new or updated row, but existing rows aren't
-- re-checked - earlier builds saved clipped sub-second notes, and those
-- shouldn't block the migration. They can be deleted from the app.

ALTER TABLE "public"."voice_notes" DROP CONSTRAINT "voice_notes_duration_range";

ALTER TABLE "public"."voice_notes"
    ADD CONSTRAINT "voice_notes_duration_range"
    CHECK (("duration_seconds" >= 3 AND "duration_seconds" <= 30)) NOT VALID;
