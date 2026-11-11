// Loads the repo's migrations into an in-memory Postgres (PGlite) with minimal Supabase stubs.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

export const MIGRATIONS_DIR = '/home/user/Zeeba/supabase/migrations';

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role supabase_admin;
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions; create schema if not exists graphql; create schema if not exists vault;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
-- auth.uid() reads the same GUC Supabase sets per request
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
`;

export async function loadDatabase({ upTo } = {}) {
  const db = new PGlite();
  await db.exec(STUBS);
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  const applied = [];
  for (const f of files) {
    if (upTo && f > upTo) break;
    let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    // pg_dump preamble lines PGlite/plain Postgres cannot run in this stub environment
    sql = sql.split('\n').filter(l => !/^(CREATE EXTENSION|COMMENT ON EXTENSION|ALTER PUBLICATION|CREATE PUBLICATION|RESET ALL|ALTER DEFAULT PRIVILEGES)/.test(l.trim())).join('\n');
    // pg_dump files end with session settings changed (row_security off, empty search_path); undo them.
    try { await db.exec(sql); await db.exec('RESET ALL;'); applied.push(f); }
    catch (e) { throw new Error(`migration ${f} failed: ${e.message}`); }
  }
  return { db, applied };
}

/** Runs fn as a signed-in user (role authenticated + auth.uid()). */
export async function asUser(db, userId, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false); select set_config('request.jwt.claim.role', 'authenticated', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}

if (process.argv[1].endsWith('rig.mjs')) {
  const { db, applied } = await loadDatabase();
  console.log('applied', applied.length, 'migrations');
  const t = await db.query(`select table_name from information_schema.tables where table_schema='public' order by 1`);
  console.log('tables:', t.rows.map(r => r.table_name).join(', '));
}
