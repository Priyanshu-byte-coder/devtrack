alter table local_coding_api_keys add column if not exists api_key_hash text unique;

create index if not exists local_coding_api_keys_key_hash on local_coding_api_keys(api_key_hash);
