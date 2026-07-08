-- ============================================================================
-- Zeeba wardrobe app — initial Supabase schema
-- Run this once in the Supabase SQL Editor on a fresh project.
-- ============================================================================
-- Simplifications made vs. the source schema (kept close otherwise):
--   * users.google_id was dropped. Supabase Auth (auth.users + auth.identities)
--     already stores the Google identity; duplicating it invites drift.
--     public.users.id IS auth.users.id (1:1), so it's still there implicitly.
--   * A trigger auto-inserts a public.users row whenever someone signs in via
--     Google (or any provider) for the first time, so you never manage that
--     table by hand.
--   * outfits.labels became text[] instead of a single text field - same
--     "labels" concept, just able to hold more than one without extra tables.
--   * Added a few small, obviously-useful columns (created_at timestamps) that
--     were implied but not spelled out for every table.
--   * item_type is a checked text column rather than a Postgres ENUM, so you
--     can add a new garment category later with a single ALTER TABLE instead
--     of an ALTER TYPE dance.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto; -- gen_random_uuid(), crypt() for seed data


-- ----------------------------------------------------------------------------
-- 1. Storage buckets
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('wardrobe-media', 'wardrobe-media', true)
on conflict (id) do nothing;

-- Dedicated bucket for the "add new item" flow's photo uploads. Public
-- (world-readable) with no auth-scoped storage policies at all - unlike
-- wardrobe-media, uploads aren't restricted to the `authenticated` role or
-- gated by ownership, since the mobile client uploads straight from the
-- create-item form using the same supabase client already in use elsewhere.
insert into storage.buckets (id, name, public)
values ('clothing_item_photos', 'clothing_item_photos', true)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- 2.1 users — one row per Supabase Auth user (Google, etc.)
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text unique not null,
  username   text,
  created_at timestamptz not null default now()
);

-- 2.2 closets — a wardrobe container, owned by one user
create table public.closets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.users (id) on delete cascade,
  closet_name text not null,
  pass_phrase text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_at  timestamptz not null default now()
);

-- 2.3 closet_collaborators — "stylist" access: a user styling a friend's closet
create table public.closet_collaborators (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  closet_id  uuid not null references public.closets (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, closet_id)
);

-- 2.4 clothing_items — individual garments inside a closet
create table public.clothing_items (
  id                 uuid primary key default gen_random_uuid(),
  closet_id          uuid not null references public.closets (id) on delete cascade,
  item_type          text not null check (
    item_type in ('shirt', 'pants', 'dress_romper', 'shoes', 'jacket', 'purse', 'jewelry', 'accessory')
  ),
  name               text not null,
  description        text,
  fit_notes          text, -- e.g. "fits boxy", "runs tight"
  care_instructions  text, -- e.g. "dry clean only"
  brand              text, -- brand name and/or where it was bought
  purchase_url       text,
  created_at         timestamptz not null default now()
);

-- 2.5 clothing_item_photos — unlimited photos per garment
create table public.clothing_item_photos (
  id                uuid primary key default gen_random_uuid(),
  clothing_item_id  uuid not null references public.clothing_items (id) on delete cascade,
  image_url         text not null,
  is_primary        boolean not null default false,
  created_at        timestamptz not null default now()
);

-- 2.6 outfits — styled combinations of clothing_items
create table public.outfits (
  id                 uuid primary key default gen_random_uuid(),
  closet_id          uuid not null references public.closets (id) on delete cascade,
  created_by_user_id uuid references public.users (id) on delete set null,
  name               text not null,
  description        text,
  labels             text[] not null default '{}',
  compliment_count   integer not null default 0,
  created_at         timestamptz not null default now()
);

-- 2.7 outfit_photos — "worn in the wild" fit pics
create table public.outfit_photos (
  id         uuid primary key default gen_random_uuid(),
  outfit_id  uuid not null references public.outfits (id) on delete cascade,
  image_url  text not null,
  created_at timestamptz not null default now()
);

-- 2.8 outfit_items — join table: which garments make up an outfit
create table public.outfit_items (
  outfit_id         uuid not null references public.outfits (id) on delete cascade,
  clothing_item_id  uuid not null references public.clothing_items (id) on delete cascade,
  primary key (outfit_id, clothing_item_id)
);

-- 2.9 wear_logs — history of what got worn, for metrics
create table public.wear_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  closet_id         uuid not null references public.closets (id) on delete cascade,
  outfit_id         uuid references public.outfits (id) on delete cascade,
  clothing_item_id  uuid references public.clothing_items (id) on delete cascade,
  worn_on_date      date not null default current_date,
  check (outfit_id is not null or clothing_item_id is not null)
);


-- ----------------------------------------------------------------------------
-- 3. Auto-create a public.users row on first sign-in (Google, etc.)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ----------------------------------------------------------------------------
-- 4. RLS helper functions
-- ----------------------------------------------------------------------------
-- True if the current user owns or collaborates on the given closet.
create or replace function public.is_closet_member(target_closet_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.closets c
    where c.id = target_closet_id and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.closet_collaborators cc
    where cc.closet_id = target_closet_id and cc.user_id = auth.uid()
  );
$$;

-- True if the current user owns the given closet.
create or replace function public.is_closet_owner(target_closet_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.closets c
    where c.id = target_closet_id and c.owner_id = auth.uid()
  );
$$;

-- Regenerates a closet's passphrase and returns the new value. SECURITY
-- DEFINER so it can update a row the "Owners can update their closets" RLS
-- policy would otherwise still allow anyway - the explicit owner check here
-- is what actually gates it, since this function lives in `public` and is
-- therefore callable by any authenticated (or anon) caller by default.
create or replace function public.regenerate_closet_passphrase(target_closet_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_phrase text;
begin
  if not exists (
    select 1 from public.closets where id = target_closet_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized to regenerate this closet''s passphrase';
  end if;

  new_phrase := substr(md5(random()::text || clock_timestamp()::text), 1, 10);

  update public.closets set pass_phrase = new_phrase where id = target_closet_id;

  return new_phrase;
end;
$$;

grant execute on function public.regenerate_closet_passphrase(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.closets enable row level security;
alter table public.closet_collaborators enable row level security;
alter table public.clothing_items enable row level security;
alter table public.clothing_item_photos enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_photos enable row level security;
alter table public.outfit_items enable row level security;
alter table public.wear_logs enable row level security;

-- users: everyone signed in can see basic profiles (needed to show
-- collaborator names); you can only edit your own row.
create policy "Users are viewable by any signed-in user"
  on public.users for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- closets: members (owner + collaborators) can view; only the owner can
-- create/rename/delete the closet itself.
create policy "Members can view their closets"
  on public.closets for select
  to authenticated
  using (public.is_closet_member(id));

create policy "Users can create closets they own"
  on public.closets for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their closets"
  on public.closets for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their closets"
  on public.closets for delete
  to authenticated
  using (owner_id = auth.uid());

-- closet_collaborators: members can see the collaborator list; only the
-- owner can add collaborators; the owner or the collaborator themself can
-- remove a collaborator.
create policy "Members can view collaborators"
  on public.closet_collaborators for select
  to authenticated
  using (public.is_closet_member(closet_id));

create policy "Owners can add collaborators"
  on public.closet_collaborators for insert
  to authenticated
  with check (public.is_closet_owner(closet_id));

create policy "Owners or the collaborator can remove a collaborator"
  on public.closet_collaborators for delete
  to authenticated
  using (public.is_closet_owner(closet_id) or user_id = auth.uid());

-- clothing_items: any closet member (owner or stylist collaborator) can
-- view and manage the garments.
create policy "Members can manage clothing items"
  on public.clothing_items for all
  to authenticated
  using (public.is_closet_member(closet_id))
  with check (public.is_closet_member(closet_id));

-- clothing_item_photos: access follows the parent garment's closet.
create policy "Members can manage clothing item photos"
  on public.clothing_item_photos for all
  to authenticated
  using (
    exists (
      select 1 from public.clothing_items ci
      where ci.id = clothing_item_photos.clothing_item_id
        and public.is_closet_member(ci.closet_id)
    )
  )
  with check (
    exists (
      select 1 from public.clothing_items ci
      where ci.id = clothing_item_photos.clothing_item_id
        and public.is_closet_member(ci.closet_id)
    )
  );

-- outfits: any closet member can view and manage outfits.
create policy "Members can manage outfits"
  on public.outfits for all
  to authenticated
  using (public.is_closet_member(closet_id))
  with check (public.is_closet_member(closet_id));

-- outfit_photos: access follows the parent outfit's closet.
create policy "Members can manage outfit photos"
  on public.outfit_photos for all
  to authenticated
  using (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_photos.outfit_id
        and public.is_closet_member(o.closet_id)
    )
  )
  with check (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_photos.outfit_id
        and public.is_closet_member(o.closet_id)
    )
  );

-- outfit_items: access follows the parent outfit's closet.
create policy "Members can manage outfit items"
  on public.outfit_items for all
  to authenticated
  using (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_items.outfit_id
        and public.is_closet_member(o.closet_id)
    )
  )
  with check (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_items.outfit_id
        and public.is_closet_member(o.closet_id)
    )
  );

-- wear_logs: closet members can see wear history; you can only log/edit/
-- remove entries under your own name.
create policy "Members can view wear logs"
  on public.wear_logs for select
  to authenticated
  using (public.is_closet_member(closet_id));

create policy "Users can log their own wears"
  on public.wear_logs for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_closet_member(closet_id));

create policy "Users can update their own wear logs"
  on public.wear_logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own wear logs"
  on public.wear_logs for delete
  to authenticated
  using (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 6. Storage policies for the wardrobe-media bucket
-- ----------------------------------------------------------------------------
create policy "Public read access to wardrobe media"
  on storage.objects for select
  using (bucket_id = 'wardrobe-media');

create policy "Signed-in users can upload wardrobe media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'wardrobe-media');

create policy "Owners can update their own wardrobe media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'wardrobe-media' and owner = auth.uid())
  with check (bucket_id = 'wardrobe-media' and owner = auth.uid());

create policy "Owners can delete their own wardrobe media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'wardrobe-media' and owner = auth.uid());

-- ----------------------------------------------------------------------------
-- 6b. Storage policy for the clothing_item_photos bucket - fully public, no
-- auth check at all (any role, no ownership check) for every operation.
-- ----------------------------------------------------------------------------
create policy "Public access to clothing item photos bucket"
  on storage.objects for all
  using (bucket_id = 'clothing_item_photos')
  with check (bucket_id = 'clothing_item_photos');


-- ----------------------------------------------------------------------------
-- 7. Table grants (RLS still governs row-level access)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;


-- ============================================================================
-- 8. Dummy data
-- ============================================================================
-- Note: public.users rows are populated via the on_auth_user_created trigger,
-- so we seed them by inserting into auth.users directly. That table isn't a
-- normal public API and its required columns can shift between Postgres
-- versions - this is the standard community trick for seeding a fresh
-- Supabase project and works today, but in production real rows will be
-- created for you automatically the moment someone signs in with Google.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'ida@example.com',
    crypt('placeholder-password', gen_salt('bf')), now(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Ida"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'sam@example.com',
    crypt('placeholder-password', gen_salt('bf')), now(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Sam"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'jordan@example.com',
    crypt('placeholder-password', gen_salt('bf')), now(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Jordan"}',
    now(), now(), '', '', '', ''
  );

-- Closets
insert into public.closets (id, owner_id, closet_name, pass_phrase) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Ida''s Closet', 'sunny-fox-42'),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Sam''s Closet', 'blue-otter-17');

-- Collaborators - Sam styles Ida's closet, Jordan styles Sam's closet
insert into public.closet_collaborators (user_id, closet_id) values
  ('22222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222');

-- Clothing items - Ida's Closet
insert into public.clothing_items (id, closet_id, item_type, name, description, fit_notes, care_instructions, brand, purchase_url) values
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'shirt', 'Black Silk Tank', 'Simple black tank, silky material makes it dressier than it looks.', 'True to size', 'Hand wash cold, hang dry', 'Everlane', 'https://www.everlane.com'),
  ('b1111111-1111-1111-1111-111111111112', 'a1111111-1111-1111-1111-111111111111', 'pants', 'Midwash Straight Jeans', 'Classic midwash denim with contrast white stitching.', 'True to size', 'Machine wash cold, tumble dry low', 'Levi''s', 'https://www.levi.com'),
  ('b1111111-1111-1111-1111-111111111113', 'a1111111-1111-1111-1111-111111111111', 'shoes', 'Mint Green Sneakers', 'White laces, mint green statement sneakers.', 'Runs half size small', 'Wipe clean, air dry', 'Adidas', null),
  ('b1111111-1111-1111-1111-111111111114', 'a1111111-1111-1111-1111-111111111111', 'dress_romper', 'Yellow Floral Sundress', 'Small floral print with sky blue and orange, flowy and casual.', 'Fits loose/oversized', 'Machine wash cold, hang dry', null, null),
  ('b1111111-1111-1111-1111-111111111115', 'a1111111-1111-1111-1111-111111111111', 'jacket', 'Cream Wool Blazer', 'Tailored cream blazer, dresses up any casual outfit.', 'Runs boxy, size down', 'Dry clean only', 'Zara', 'https://www.zara.com'),
  ('b1111111-1111-1111-1111-111111111116', 'a1111111-1111-1111-1111-111111111111', 'purse', 'Rose Pink Shoulder Bag', 'Gold hardware, baby pink, very girlie.', null, 'Spot clean only', 'Coach', 'https://www.coach.com'),
  ('b1111111-1111-1111-1111-111111111117', 'a1111111-1111-1111-1111-111111111111', 'jewelry', 'Gold Heart Necklace', 'Rose gold heart pendant necklace.', null, 'Keep dry, store separately', null, null),
  ('b1111111-1111-1111-1111-111111111118', 'a1111111-1111-1111-1111-111111111111', 'accessory', 'Cat Eye Sunglasses', 'Black frames with gold accents.', null, 'Wipe lenses with microfiber cloth', null, null);

-- Clothing items - Sam's Closet
insert into public.clothing_items (id, closet_id, item_type, name, description, fit_notes, care_instructions, brand, purchase_url) values
  ('b2222222-2222-2222-2222-222222222221', 'a2222222-2222-2222-2222-222222222222', 'shirt', 'Cherry Red Sweater', 'Warm cherry red, preppy cut.', 'Fits true to size', 'Hand wash cold, dry flat', null, null),
  ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'pants', 'Forest Green Maxi Skirt', 'Flowy maxi skirt, very summery.', 'Fits loose', 'Machine wash cold', null, null),
  ('b2222222-2222-2222-2222-222222222223', 'a2222222-2222-2222-2222-222222222222', 'shoes', 'White Leather Loafers', 'Classic white leather loafers.', 'True to size', 'Wipe clean', 'Clarks', null),
  ('b2222222-2222-2222-2222-222222222224', 'a2222222-2222-2222-2222-222222222222', 'jacket', 'Classic Denim Jacket', 'Mid-wash denim jacket, layers over everything.', 'Fits true to size', 'Machine wash cold, hang dry', 'Gap', null);

-- Clothing item photos (Unsplash stock photos as placeholders)
insert into public.clothing_item_photos (clothing_item_id, image_url, is_primary) values
  ('b1111111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80', true),
  ('b1111111-1111-1111-1111-111111111112', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80', true),
  ('b1111111-1111-1111-1111-111111111113', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80', true),
  ('b1111111-1111-1111-1111-111111111113', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80', false),
  ('b1111111-1111-1111-1111-111111111114', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80', true),
  ('b1111111-1111-1111-1111-111111111115', 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&q=80', true),
  ('b1111111-1111-1111-1111-111111111116', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80', true),
  ('b1111111-1111-1111-1111-111111111117', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80', true),
  ('b1111111-1111-1111-1111-111111111118', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80', true),
  ('b2222222-2222-2222-2222-222222222221', 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=800&q=80', true),
  ('b2222222-2222-2222-2222-222222222222', 'https://images.unsplash.com/photo-1467043237213-65f2da53396f?auto=format&fit=crop&w=800&q=80', true),
  ('b2222222-2222-2222-2222-222222222223', 'https://images.unsplash.com/photo-1560243563-062bfc001d68?auto=format&fit=crop&w=800&q=80', true),
  ('b2222222-2222-2222-2222-222222222224', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=800&q=80', true);

-- Outfits
insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels, compliment_count) values
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Tank and Jeans', 'Casual fit with black silky tank and midwash jeans.', array['casual', 'streetwear'], 3),
  ('c1111111-1111-1111-1111-111111111112', 'a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Sundress and Sneakers', 'Casual summer look pairing the sundress with statement sneakers.', array['casual', 'summer'], 5),
  ('c1111111-1111-1111-1111-111111111113', 'a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Blazer Night Out', 'Elegant evening outfit styled by Sam: tank, blazer, purse, and necklace.', array['dressy', 'elegant'], 8),
  ('c2222222-2222-2222-2222-222222222221', 'a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Sweater and Skirt', 'Preppy-chic look combining cherry red with forest green.', array['preppy', 'warm'], 2),
  ('c2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Denim Layered Look', 'Casual denim-on-denim styled by Jordan.', array['casual'], 1);

-- Outfit <-> clothing item links
insert into public.outfit_items (outfit_id, clothing_item_id) values
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111'),
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111112'),
  ('c1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111114'),
  ('c1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111113'),
  ('c1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111'),
  ('c1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111115'),
  ('c1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111116'),
  ('c1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111117'),
  ('c2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222221'),
  ('c2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222'),
  ('c2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222224'),
  ('c2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222223');

-- Outfit "worn in the wild" photos
insert into public.outfit_photos (outfit_id, image_url) values
  ('c1111111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80'),
  ('c1111111-1111-1111-1111-111111111113', 'https://images.unsplash.com/photo-1571945153237-4929e783af4a?auto=format&fit=crop&w=800&q=80'),
  ('c2222222-2222-2222-2222-222222222221', 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80');

-- Wear logs
insert into public.wear_logs (user_id, closet_id, outfit_id, clothing_item_id, worn_on_date) values
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', null, current_date - 7),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', null, current_date - 3),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', null, 'b1111111-1111-1111-1111-111111111118', current_date - 1),
  ('22222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111113', null, current_date - 2),
  ('22222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', null, current_date - 5),
  ('33333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', null, current_date);
