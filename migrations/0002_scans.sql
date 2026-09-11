create table if not exists scans (
  id          serial primary key,
  user_id     text not null,
  title       text not null,
  mode        text not null,
  language    text not null,
  source_name text not null default '',
  text        text not null,
  markdown    text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists scans_user_id_idx on scans (user_id, created_at desc);
