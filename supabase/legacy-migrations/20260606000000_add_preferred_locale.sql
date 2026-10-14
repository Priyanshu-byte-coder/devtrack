ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_locale text DEFAULT 'en'
CHECK (preferred_locale IN ('en', 'es'));
