-- Local-only fixture data: 9 auth accounts + 5 closets covering the two
-- "stylist" shapes the app needs to support - one closet with several
-- stylists, and one stylist who styles several closets - plus sample
-- clothing and outfits so every closet has something to look at.
--
-- Runs automatically on `supabase db reset` ([db.seed] in config.toml points
-- at this file). Never gets near the remote project - it isn't referenced
-- anywhere outside the local supabase/ directory, and it creates auth.users
-- rows with a shared, publicly-known password.
--
-- Account list lives in sync with src/constants/testAccounts.ts - the
-- sign-in-as-test-account screen (EXPO_PUBLIC_ENABLE_TEST_AUTH) reads that
-- file, not this one, so a change here must be mirrored there.

-- Inserting straight into auth.users/auth.identities is the standard way to
-- seed real, password-login-able Supabase Auth accounts from SQL (GoTrue has
-- no seed-time API of its own). identities is required too - without it,
-- signInWithPassword can't resolve the account.
create or replace function pg_temp.seed_test_user(user_email text, full_name text, password text)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    user_email, crypt(password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', full_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id, new_id::text,
    jsonb_build_object('sub', new_id::text, 'email', user_email),
    'email', now(), now(), now()
  );

  return new_id;
  -- public.users gets its matching row via the on_auth_user_created trigger.
end;
$$;

do $$
declare
  v_password text := 'zeeba-test-1234';

  v_ava uuid; v_blake uuid; v_casey uuid; v_drew uuid; v_emerson uuid;
  v_finley uuid; v_gray uuid; v_harper uuid; v_indigo uuid;

  v_closet_ava uuid; v_closet_finley uuid; v_closet_gray uuid; v_closet_harper uuid; v_closet_indigo uuid;

  v_item uuid[];
  v_outfit uuid;
begin
  -- Accounts -----------------------------------------------------------
  v_ava     := pg_temp.seed_test_user('ava@zeeba.local', 'Ava Chen', v_password);
  v_blake   := pg_temp.seed_test_user('blake@zeeba.local', 'Blake Nguyen', v_password);
  v_casey   := pg_temp.seed_test_user('casey@zeeba.local', 'Casey Patel', v_password);
  v_drew    := pg_temp.seed_test_user('drew@zeeba.local', 'Drew Sullivan', v_password);
  v_emerson := pg_temp.seed_test_user('emerson@zeeba.local', 'Emerson Vega', v_password);
  v_finley  := pg_temp.seed_test_user('finley@zeeba.local', 'Finley Ortiz', v_password);
  v_gray    := pg_temp.seed_test_user('gray@zeeba.local', 'Gray Nakamura', v_password);
  v_harper  := pg_temp.seed_test_user('harper@zeeba.local', 'Harper Diaz', v_password);
  v_indigo  := pg_temp.seed_test_user('indigo@zeeba.local', 'Indigo Reyes', v_password);

  -- Closets --------------------------------------------------------------
  insert into public.closets (id, owner_id, closet_name) values
    (gen_random_uuid(), v_ava, 'Ava''s Closet') returning id into v_closet_ava;
  insert into public.closets (id, owner_id, closet_name) values
    (gen_random_uuid(), v_finley, 'Finley''s Closet') returning id into v_closet_finley;
  insert into public.closets (id, owner_id, closet_name) values
    (gen_random_uuid(), v_gray, 'Gray''s Closet') returning id into v_closet_gray;
  insert into public.closets (id, owner_id, closet_name) values
    (gen_random_uuid(), v_harper, 'Harper''s Closet') returning id into v_closet_harper;
  insert into public.closets (id, owner_id, closet_name) values
    (gen_random_uuid(), v_indigo, 'Indigo''s Closet') returning id into v_closet_indigo;

  -- Stylist assignments ----------------------------------------------------
  -- Ava's closet: 3 stylists.
  insert into public.closet_collaborators (user_id, closet_id) values
    (v_blake, v_closet_ava),
    (v_casey, v_closet_ava),
    (v_drew, v_closet_ava);

  -- Emerson: 1 stylist across 4 closets.
  insert into public.closet_collaborators (user_id, closet_id) values
    (v_emerson, v_closet_finley),
    (v_emerson, v_closet_gray),
    (v_emerson, v_closet_harper),
    (v_emerson, v_closet_indigo);

  -- Ava's Closet: clothing + outfits ---------------------------------------
  v_item := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  insert into public.clothing_items (id, closet_id, item_type, name, description, brand) values
    (v_item[1], v_closet_ava, 'shirt', 'White Button-Down', 'Crisp poplin, tucks in clean for work or layering.', 'Everlane'),
    (v_item[2], v_closet_ava, 'pants', 'High-Rise Straight Jeans', 'Medium-wash, straight through the leg.', E'Levi’s'),
    (v_item[3], v_closet_ava, 'dress_romper', 'Little Black Dress', 'Fitted midi, goes from dinner to drinks.', 'Reformation'),
    (v_item[4], v_closet_ava, 'shoes', 'White Leather Sneakers', 'Minimal low-tops, break in fast.', 'Common Projects'),
    (v_item[5], v_closet_ava, 'jacket', 'Camel Wool Coat', 'Knee-length topper for over anything.', E'Aritzia'),
    (v_item[6], v_closet_ava, 'jewelry', 'Gold Hoop Earrings', 'Medium hoops, everyday wear.', null);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_ava, v_ava, 'Office Ready', 'Button-down, straight jeans, and clean sneakers.', array['Work'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[1]), (v_outfit, v_item[2]), (v_outfit, v_item[4]);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_ava, v_blake, 'Dinner Date', 'LBD with the camel coat and gold hoops.', array['Date Night'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[3]), (v_outfit, v_item[5]), (v_outfit, v_item[6]);

  -- Finley's Closet: clothing + outfits ------------------------------------
  v_item := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  insert into public.clothing_items (id, closet_id, item_type, name, description, brand) values
    (v_item[1], v_closet_finley, 'shirt', 'Striped Linen Shirt', 'Breezy button-up, sleeves roll easily.', null),
    (v_item[2], v_closet_finley, 'pants', 'Wide-Leg Trousers', 'High-waisted, flowy through the leg.', 'Everlane'),
    (v_item[3], v_closet_finley, 'shoes', 'Suede Loafers', 'Penny loafers, tan suede.', null),
    (v_item[4], v_closet_finley, 'purse', 'Canvas Tote', 'Oversized, fits a laptop.', 'Baggu'),
    (v_item[5], v_closet_finley, 'jacket', 'Denim Jacket', 'Classic mid-wash trucker.', E'Levi’s');

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_finley, v_finley, 'Weekend Brunch', 'Linen shirt, wide-leg trousers, loafers.', array['Casual'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[1]), (v_outfit, v_item[2]), (v_outfit, v_item[3]);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_finley, v_emerson, 'Errand Day', 'Denim jacket over trousers with the canvas tote.', array['Casual'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[5]), (v_outfit, v_item[2]), (v_outfit, v_item[4]);

  -- Gray's Closet: clothing + outfits ---------------------------------------
  v_item := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  insert into public.clothing_items (id, closet_id, item_type, name, description, brand) values
    (v_item[1], v_closet_gray, 'shirt', 'Black Turtleneck', 'Fine-knit, layers under anything.', 'Uniqlo'),
    (v_item[2], v_closet_gray, 'jacket', 'Leather Moto Jacket', 'Cropped, silver hardware.', null),
    (v_item[3], v_closet_gray, 'pants', 'Slim Black Jeans', 'Stretch denim, ankle length.', E'AG'),
    (v_item[4], v_closet_gray, 'shoes', 'Chelsea Boots', 'Black leather, elastic side panels.', 'Blundstone'),
    (v_item[5], v_closet_gray, 'jewelry', 'Silver Chain Necklace', 'Layerable, mid-length.', null);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_gray, v_gray, 'Street Style', 'Turtleneck, moto jacket, jeans, boots.', array['Street Style'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[1]), (v_outfit, v_item[2]), (v_outfit, v_item[3]), (v_outfit, v_item[4]);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_gray, v_emerson, 'Minimalist Chic', 'Turtleneck, slim jeans, silver chain.', array['Minimalist Chic'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[1]), (v_outfit, v_item[3]), (v_outfit, v_item[5]);

  -- Harper's Closet: clothing + outfits -------------------------------------
  v_item := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  insert into public.clothing_items (id, closet_id, item_type, name, description, brand) values
    (v_item[1], v_closet_harper, 'dress_romper', 'Floral Wrap Dress', 'Midi length, ties at the waist.', 'Free People'),
    (v_item[2], v_closet_harper, 'shoes', 'Espadrille Sandals', 'Jute wedge, ankle tie.', null),
    (v_item[3], v_closet_harper, 'purse', 'Straw Tote Bag', 'Woven straw, leather handles.', null),
    (v_item[4], v_closet_harper, 'jewelry', 'Beaded Statement Necklace', 'Chunky wood beads.', null),
    (v_item[5], v_closet_harper, 'jacket', 'Cropped Denim Jacket', 'Light-wash, boxy fit.', 'Madewell');

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_harper, v_harper, 'Garden Party', 'Floral wrap dress with espadrilles and the statement necklace.', array['Girly/Romantic'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[1]), (v_outfit, v_item[2]), (v_outfit, v_item[4]);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_harper, v_emerson, 'Boho Weekend', 'Floral dress layered under the denim jacket, straw tote.', array['Boho'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[1]), (v_outfit, v_item[5]), (v_outfit, v_item[3]);

  -- Indigo's Closet: clothing + outfits -------------------------------------
  v_item := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  insert into public.clothing_items (id, closet_id, item_type, name, description, brand) values
    (v_item[1], v_closet_indigo, 'shirt', 'Graphic Tee', 'Oversized, vintage band print.', null),
    (v_item[2], v_closet_indigo, 'pants', 'Track Pants', 'Tapered, side stripe.', 'Adidas'),
    (v_item[3], v_closet_indigo, 'shoes', 'Chunky Sneakers', 'Platform sole, retro colorway.', 'New Balance'),
    (v_item[4], v_closet_indigo, 'jacket', 'Bomber Jacket', 'Nylon shell, ribbed cuffs.', null),
    (v_item[5], v_closet_indigo, 'purse', 'Crossbody Bag', 'Small nylon sling.', null);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_indigo, v_indigo, 'Athleisure Day', 'Graphic tee, track pants, chunky sneakers.', array['Athleisure'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[1]), (v_outfit, v_item[2]), (v_outfit, v_item[3]);

  insert into public.outfits (id, closet_id, created_by_user_id, name, description, labels)
    values (gen_random_uuid(), v_closet_indigo, v_emerson, 'Street Casual', 'Bomber over the tee, track pants, crossbody bag.', array['Street Style'])
    returning id into v_outfit;
  insert into public.outfit_items (outfit_id, clothing_item_id) values
    (v_outfit, v_item[4]), (v_outfit, v_item[1]), (v_outfit, v_item[2]), (v_outfit, v_item[5]);
end $$;
