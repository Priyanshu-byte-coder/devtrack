-- Add a Markdown-capable public profile bio with a 500 character limit.
alter table users
  add column if not exists bio text default '';

alter table users
  drop constraint if exists users_bio_length_check;

alter table users
  add constraint users_bio_length_check check (char_length(bio) <= 500);
