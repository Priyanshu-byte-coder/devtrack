-- The baseline only allowed 'en' and 'es' in users.preferred_locale, so
-- picking Hindi in Settings failed with "preference not saved". Allow every
-- UI locale in src/i18n/config.ts (pt-BR is included for the open
-- Portuguese translation). test/locale-constraint.test.ts keeps this list in
-- step with the app's locales. Safe to run more than once.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%preferred_locale%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_preferred_locale_check
  CHECK (preferred_locale IN ('en', 'es', 'hi', 'pt-BR'));
