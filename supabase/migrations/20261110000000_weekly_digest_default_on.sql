-- The weekly email digest is on by default: new accounts get it unless they
-- turn it off in Settings or unsubscribe from an email.
--
-- Safe to run twice: it only changes the column default. Turning the digest on
-- for accounts that existed before this change is a one-time data update, run
-- once by hand (see README), because re-running it would undo unsubscribes.
ALTER TABLE public.users ALTER COLUMN weekly_digest_opt_in SET DEFAULT true;
