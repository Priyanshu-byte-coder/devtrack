
create table if not exists daily_notes (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               text not null,
  date                  date not null,
  note                  text,
  created_at            timestamptz default now(),
  
  UNIQUE(user_id, date)
);