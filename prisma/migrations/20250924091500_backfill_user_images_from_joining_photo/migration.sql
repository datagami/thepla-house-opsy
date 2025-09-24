-- Backfill existing users' profile images from joining form photo
-- Only set image when it is currently NULL and joining_form_photo is present

UPDATE "users1"
SET
  "image" = "joining_form_photo",
  "updated_at" = NOW()
WHERE
  "image" IS NULL
  AND "joining_form_photo" IS NOT NULL;


