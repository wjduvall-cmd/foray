-- 0001_extensions.sql
-- Extensions available on Supabase-managed Postgres by default; enabling
-- explicitly keeps this migration set portable to a bare local Postgres too.

create extension if not exists pgcrypto;   -- gen_random_uuid()
