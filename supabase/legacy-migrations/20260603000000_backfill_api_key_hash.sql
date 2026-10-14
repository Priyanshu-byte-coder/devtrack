-- Safe migration to enforce canonical hash storage for local_coding_api_keys.
--
-- Schema history:
--   20260521000000_add_local_coding_tables.sql  -- api_key column only (stored hashes)
--   20260522000000_add_api_key_hash_column.sql  -- api_key_hash column added (nullable)
--
-- Three row variants may exist in production:
--
--   A. api_key = sha256(key),  api_key_hash = NULL
--      Created before api_key_hash was introduced. The hash lives only in
--      api_key.  Promote it to api_key_hash so authentication can use the
--      canonical column exclusively, then replace api_key with a display
--      prefix derived from the row id.
--
--   B. api_key = sha256(key),  api_key_hash = sha256(key)
--      Created by the dual-write "fix" for #1748. api_key_hash is already
--      correct; api_key just needs to be replaced with a non-sensitive prefix.
--
--   C. api_key = prefix (8 chars), api_key_hash = sha256(key)
--      Created by the current code after issue #2038.  Nothing to do.
--
-- A SHA-256 hex digest is exactly 64 lowercase hex characters.  That pattern
-- distinguishes variants A/B from variant C.

-- Step 1: promote hash to api_key_hash for rows that have no hash column yet.
UPDATE local_coding_api_keys
SET api_key_hash = api_key
WHERE api_key_hash IS NULL
  AND api_key ~ '^[a-f0-9]{64}$';

-- Step 2: replace the hash stored in api_key with a display-safe prefix so
-- the column no longer holds any credential-derived value.  The prefix is the
-- first 8 characters of the row's own primary-key UUID, which is unique and
-- non-sensitive.
UPDATE local_coding_api_keys
SET api_key = SUBSTRING(id, 1, 8)
WHERE api_key ~ '^[a-f0-9]{64}$';
