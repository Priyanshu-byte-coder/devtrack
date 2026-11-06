ALTER TABLE users
ADD COLUMN IF NOT EXISTS public_since timestamptz;

CREATE INDEX IF NOT EXISTS users_public_since_idx ON users(public_since);
