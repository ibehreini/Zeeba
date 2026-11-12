// Multi-user race / RLS tests against the LOCAL docker Supabase.
//
//   npm run test:db
//
// Signs in as several seeded accounts (supabase/seed.sql) and replays the
// queries the app's services send, so two "devices" can race each other.
// The services import the React Native supabase client and can't be loaded
// here, so each helper below mirrors one service function - keep them in sync.
//
// Safety: refuses to run against anything but localhost. Every row it creates
// is named with the ZZTEST prefix and removed in after(), also on failure.
// Join tests temporarily add Blake to Gray's closet and change Gray's
// passphrase; both are restored in after().

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const URL = process.env.ZEEBA_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)) {
  throw new Error(`Refusing to run: ${URL} is not a local Supabase.`);
}

function readEnvFile(file) {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/)
      .map(line => /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line))
      .filter(Boolean)
      .map(m => [m[1], m[2]]),
  );
}

const ANON_KEY = process.env.ZEEBA_TEST_ANON_KEY ?? readEnvFile(path.join(ROOT, '.env.docker.local')).EXPO_PUBLIC_SUPABASE_KEY;
// Service role is only used for cleanup (activity_logs rows written by triggers have no delete policy).
const SERVICE_KEY = process.env.ZEEBA_TEST_SERVICE_KEY
  ?? /SERVICE_ROLE_KEY="?([^"\r\n]+)/.exec(execSync('npx supabase status -o env', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))?.[1];
const PASSWORD = 'zeeba-test-1234';
const AVA_CLOSET = '2bd0b2c2-3d54-4fdb-8f5f-20918d73eb7c';
const GRAY_CLOSET = 'd67f2cd3-51e2-4e93-80fb-ba8edcbe07c9';
const P = 'ZZTEST';
const TEST_TAG = `${P} tag`;

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE_KEY, clientOptions);
const u = {}; // { ava, blake, casey, emerson, gray } -> { db, id }
let grayOriginalPassphrase;

async function signIn(name) {
  const db = createClient(URL, ANON_KEY, clientOptions);
  const { data, error } = await db.auth.signInWithPassword({ email: `${name}@zeeba.local`, password: PASSWORD });
  if (error) throw new Error(`sign-in ${name}: ${error.message}`);
  return { db, id: data.user.id };
}

// ---- Mirrors of src/services/* -------------------------------------------

const OUTFIT_SELECT = '*, outfit_items(clothing_item_id), outfit_photos(id, image_url, created_at)';
const CLOSET_ITEM_SELECT = '*, clothing_item_photos(id, image_url, is_primary, created_at)';

/** occConcurrency.updateWithOcc - returns 'ok' | 'conflict'. */
async function updateWithOcc(db, table, id, expectedUpdatedAt, patch) {
  const { data, error } = await db.from(table).update(patch).eq('id', id).eq('updated_at', expectedUpdatedAt).select('id').maybeSingle();
  if (error) throw error;
  return data ? 'ok' : 'conflict';
}

/** occConcurrency.deleteWithOcc */
async function deleteWithOcc(db, table, id, expectedUpdatedAt) {
  const { data, error } = await db.from(table).delete().eq('id', id).eq('updated_at', expectedUpdatedAt).select('id').maybeSingle();
  if (error) throw error;
  return data ? 'ok' : 'conflict';
}

/** occConcurrency.assertUnchanged - 'ok' | 'conflict'. */
async function checkUnchanged(db, table, id, expectedUpdatedAt) {
  const { data, error } = await db.from(table).select('id').eq('id', id).eq('updated_at', expectedUpdatedAt).maybeSingle();
  if (error) throw error;
  return data ? 'ok' : 'conflict';
}

/** supabaseOutfitsService.getOutfitById (raw row, item ids flattened). */
async function getOutfit(db, id) {
  const { data, error } = await db.from('outfits').select(OUTFIT_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data && { ...data, item_ids: data.outfit_items.map(r => r.clothing_item_id).sort() };
}

/** supabaseClosetItemsService.getClosetItemById */
async function getItem(db, id) {
  const { data, error } = await db.from('clothing_items').select(CLOSET_ITEM_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** supabaseOutfitsService.updateOutfit (the RPC) - 'ok' | 'conflict', or throws the RPC error. */
async function updateOutfit(db, outfit, input) {
  const { data, error } = await db.rpc('update_outfit_with_items', {
    p_outfit_id: outfit.id,
    p_expected_updated_at: outfit.updated_at,
    p_name: input.name ?? outfit.name,
    p_description: input.description ?? outfit.description,
    p_labels: input.labels ?? outfit.labels,
    p_item_ids: input.itemIds ?? outfit.item_ids,
  });
  if (error) throw error;
  return data ? 'ok' : 'conflict';
}

/** supabaseClosetItemsService.updateClosetItem (OCC write only, no photo). */
const updateItem = (db, item, input) =>
  updateWithOcc(db, 'clothing_items', item.id, item.updated_at, {
    item_type: item.item_type,
    name: input.name ?? item.name,
    description: item.description,
    fit_notes: item.fit_notes,
    care_instructions: item.care_instructions,
    brand: item.brand,
    purchase_url: item.purchase_url,
  });

/** supabaseClosetItemsService.createClosetItem, minus storage: one primary photo row with a fake URL. */
async function createItem(db, name) {
  const { data, error } = await db.from('clothing_items')
    .insert({ closet_id: AVA_CLOSET, item_type: 'shirt', name: `${P} ${name}`, description: 'test' })
    .select('id').single();
  if (error) throw error;
  const photo = await db.from('clothing_item_photos').insert({ clothing_item_id: data.id, image_url: `http://x/${P}/p0.jpg`, is_primary: true });
  if (photo.error) throw photo.error;
  return getItem(db, data.id);
}

/** supabaseOutfitsService.createOutfit - returns the outfit, or throws the join-insert error after rolling back. */
async function createOutfit(db, userId, name, itemIds, labels = []) {
  const { data: row, error } = await db.from('outfits')
    .insert({ closet_id: AVA_CLOSET, created_by_user_id: userId, name: `${P} ${name}`, description: 'test', labels })
    .select('id').single();
  if (error) throw error;
  if (itemIds.length) {
    const { error: itemsError } = await db.from('outfit_items').insert(itemIds.map(id => ({ outfit_id: row.id, clothing_item_id: id })));
    if (itemsError) {
      await db.from('outfits').delete().eq('id', row.id);
      throw itemsError;
    }
  }
  return getOutfit(db, row.id);
}

/** supabasePhotoStorage.replacePrimaryClosetItemPhoto, minus storage. */
async function replacePrimaryPhoto(db, itemId, tag) {
  const { data, error } = await db.from('clothing_item_photos')
    .insert({ clothing_item_id: itemId, image_url: `http://x/${P}/${tag}.jpg`, is_primary: true })
    .select('created_at').single();
  if (error) throw error;
  await db.from('clothing_item_photos').delete()
    .eq('clothing_item_id', itemId).eq('is_primary', true).lt('created_at', data.created_at).select('image_url');
}

/** supabaseOutfitsService.logCompliment */
async function logCompliment(db, outfitId) {
  const { data, error } = await db.rpc('increment_outfit_compliment_count', { target_outfit_id: outfitId });
  if (error) throw error;
  return data;
}

/** supabaseClosetsService.joinClosetByPassphrase (RPC step). */
const joinByPassphrase = (db, phrase) => db.rpc('join_closet_by_passphrase', { target_pass_phrase: phrase });

const freshPair = async () => {
  const item = await createItem(u.ava.db, 'item');
  const outfit = await createOutfit(u.ava.db, u.ava.id, 'outfit', [item.id]);
  return { item, outfit };
};

// ---- Setup / teardown -----------------------------------------------------

before(async () => {
  assert.ok(ANON_KEY, 'no anon key in .env.docker.local');
  assert.ok(SERVICE_KEY, 'no service role key (is `npx supabase status` working?)');
  for (const name of ['ava', 'blake', 'casey', 'emerson', 'gray']) u[name] = await signIn(name);
  const { data } = await u.gray.db.from('closets').select('pass_phrase').eq('id', GRAY_CLOSET).single();
  grayOriginalPassphrase = data.pass_phrase;
});

after(async () => {
  const errors = [];
  const run = async (label, query) => { const { error } = await query; if (error) errors.push(`${label}: ${error.message}`); };
  if (grayOriginalPassphrase) await run('restore gray passphrase', admin.from('closets').update({ pass_phrase: grayOriginalPassphrase }).eq('id', GRAY_CLOSET));
  await run('blake leaves gray', admin.from('closet_collaborators').delete().eq('closet_id', GRAY_CLOSET).eq('user_id', u.blake?.id ?? ''));
  await run('ava tag', u.ava.db.rpc('remove_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: TEST_TAG }));
  await run('voice notes', admin.from('voice_notes').delete().like('audio_url', `%${P}%`));
  await run('outfits', admin.from('outfits').delete().like('name', `${P}%`));
  await run('items', admin.from('clothing_items').delete().like('name', `${P}%`));
  await run('closets', admin.from('closets').delete().like('closet_name', `${P}%`));
  await run('activity', admin.from('activity_logs').delete().like('item_name', `${P}%`));
  if (errors.length) throw new Error(`cleanup failed:\n${errors.join('\n')}`);
});

// ---- 1. Both edit -----------------------------------------------------------

describe('1. owner and stylist both save', () => {
  test('outfit: second save conflicts and does not overwrite', async () => {
    const { outfit } = await freshPair();
    const avaCopy = await getOutfit(u.ava.db, outfit.id);
    const blakeCopy = await getOutfit(u.blake.db, outfit.id);
    assert.equal(await updateOutfit(u.ava.db, avaCopy, { name: `${P} ava` }), 'ok');
    assert.equal(await updateOutfit(u.blake.db, blakeCopy, { name: `${P} blake` }), 'conflict');
    assert.equal((await getOutfit(u.ava.db, outfit.id)).name, `${P} ava`);
  });

  test('outfit: truly simultaneous saves - exactly one wins', async () => {
    const { outfit } = await freshPair();
    const results = await Promise.all([
      updateOutfit(u.ava.db, outfit, { name: `${P} ava` }),
      updateOutfit(u.blake.db, outfit, { name: `${P} blake` }),
    ]);
    assert.deepEqual(results.sort(), ['conflict', 'ok']);
  });

  test('item: second save conflicts and does not overwrite', async () => {
    const item = await createItem(u.ava.db, 'item');
    assert.equal(await updateItem(u.blake.db, item, { name: `${P} blake` }), 'ok');
    assert.equal(await updateItem(u.ava.db, item, { name: `${P} ava` }), 'conflict');
    assert.equal((await getItem(u.ava.db, item.id)).name, `${P} blake`);
  });
});

// ---- 2. Delete vs edit ------------------------------------------------------

describe('2. one deletes while the other edits', () => {
  for (const kind of ['outfit', 'item']) {
    const table = kind === 'outfit' ? 'outfits' : 'clothing_items';
    const load = kind === 'outfit' ? getOutfit : getItem;
    const save = kind === 'outfit' ? updateOutfit : updateItem;
    const make = async () => (kind === 'outfit' ? (await freshPair()).outfit : createItem(u.ava.db, 'item'));

    test(`${kind}: delete first, then stale edit conflicts (row stays gone)`, async () => {
      const row = await make();
      assert.equal(await deleteWithOcc(u.ava.db, table, row.id, row.updated_at), 'ok');
      assert.equal(await save(u.blake.db, row, { name: `${P} resurrect` }), 'conflict');
      assert.equal(await load(u.ava.db, row.id), null);
    });

    test(`${kind}: edit first, then stale delete conflicts (row survives)`, async () => {
      const row = await make();
      assert.equal(await save(u.blake.db, row, { name: `${P} edited` }), 'ok');
      assert.equal(await deleteWithOcc(u.ava.db, table, row.id, row.updated_at), 'conflict');
      assert.equal((await load(u.ava.db, row.id)).name, `${P} edited`);
    });
  }
});

// ---- 3 + 4. Outfit <-> item join rows --------------------------------------

describe('3/4. outfit item lists and deleted items', () => {
  // Deleting an item cascades its join rows without bumping the outfit's
  // updated_at, so an open edit form still holds a valid token - but its item
  // list names the deleted item. updateOutfit rewrites outfit_items, so it must
  // reject that list (23503, no partial write) rather than resurrect the item;
  // the form then drops the deleted pick and the retry saves.
  test('deleting an item drops it from outfits; a stale outfit save is rejected, not resurrected', async () => {
    const { item, outfit } = await freshPair();
    const second = await createItem(u.ava.db, 'second');
    await u.ava.db.from('outfit_items').insert({ outfit_id: outfit.id, clothing_item_id: second.id });
    const avaCopy = await getOutfit(u.ava.db, outfit.id);

    assert.equal(await deleteWithOcc(u.blake.db, 'clothing_items', item.id, item.updated_at), 'ok');
    const after = await getOutfit(u.ava.db, outfit.id);
    assert.deepEqual(after.item_ids, [second.id]);
    assert.equal(after.updated_at, avaCopy.updated_at, 'join cascade does not bump the outfit token');

    await assert.rejects(updateOutfit(u.ava.db, avaCopy, { name: `${P} renamed` }), err => err.code === '23503');
    assert.equal((await getOutfit(u.ava.db, outfit.id)).name, outfit.name, 'rolled back');
    assert.equal(await updateOutfit(u.ava.db, avaCopy, { name: `${P} renamed`, itemIds: [second.id] }), 'ok');
    assert.deepEqual((await getOutfit(u.ava.db, outfit.id)).item_ids, [second.id]);
  });

  test('createOutfit with an item deleted a moment ago fails with 23503 and leaves no orphan outfit', async () => {
    const item = await createItem(u.ava.db, 'doomed');
    assert.equal(await deleteWithOcc(u.blake.db, 'clothing_items', item.id, item.updated_at), 'ok');
    await assert.rejects(createOutfit(u.ava.db, u.ava.id, 'orphan', [item.id]), err => err.code === '23503');
    const { data } = await u.ava.db.from('outfits').select('id').eq('name', `${P} orphan`);
    assert.deepEqual(data, []);
  });
});

// ---- 3b. Editing an outfit's items ----------------------------------------

describe("3b. editing an outfit's items (update_outfit_with_items)", () => {
  const pairWithSpares = async () => {
    const { item, outfit } = await freshPair();
    const a = await createItem(u.ava.db, 'spare a');
    const b = await createItem(u.ava.db, 'spare b');
    return { item, outfit, a, b };
  };

  test("owner and stylist both change the items: second conflicts, list is exactly the first writer's", async () => {
    const { item, outfit, a, b } = await pairWithSpares();
    const avaCopy = await getOutfit(u.ava.db, outfit.id);
    const blakeCopy = await getOutfit(u.blake.db, outfit.id);
    assert.equal(await updateOutfit(u.ava.db, avaCopy, { itemIds: [item.id, a.id] }), 'ok');
    assert.equal(await updateOutfit(u.blake.db, blakeCopy, { itemIds: [b.id] }), 'conflict');
    assert.deepEqual((await getOutfit(u.ava.db, outfit.id)).item_ids, [item.id, a.id].sort());
  });

  test("truly simultaneous item changes - exactly one wins, list is the winner's", async () => {
    const { outfit, a, b } = await pairWithSpares();
    const results = await Promise.all([
      updateOutfit(u.ava.db, outfit, { itemIds: [a.id] }),
      updateOutfit(u.blake.db, outfit, { itemIds: [b.id] }),
    ]);
    assert.deepEqual([...results].sort(), ['conflict', 'ok']);
    const winner = results[0] === 'ok' ? a : b;
    assert.deepEqual((await getOutfit(u.ava.db, outfit.id)).item_ids, [winner.id]);
  });

  test('an items-only change bumps the token, so a stale name-only edit conflicts; it is logged as an edit', async () => {
    const { item, outfit, a } = await pairWithSpares();
    const blakeCopy = await getOutfit(u.blake.db, outfit.id);
    assert.equal(await updateOutfit(u.ava.db, outfit, { itemIds: [item.id, a.id] }), 'ok');
    const after = await getOutfit(u.ava.db, outfit.id);
    assert.notEqual(after.updated_at, outfit.updated_at);
    assert.equal(await updateOutfit(u.blake.db, blakeCopy, { name: `${P} stale` }), 'conflict');
    assert.equal((await getOutfit(u.ava.db, outfit.id)).name, outfit.name);
    const { count } = await admin.from('activity_logs').select('id', { count: 'exact', head: true })
      .eq('item_id', outfit.id).eq('action_type', 'edited');
    assert.equal(count, 1);
  });

  test('an item from another closet is rejected and nothing changes', async () => {
    const { outfit } = await freshPair();
    const { data: grayItem, error } = await admin.from('clothing_items')
      .insert({ closet_id: GRAY_CLOSET, item_type: 'shirt', name: `${P} gray item`, description: 'test' })
      .select('id').single();
    assert.ifError(error);
    // Ava can't see Gray's closet at all: same answer as a deleted item.
    await assert.rejects(updateOutfit(u.ava.db, outfit, { itemIds: [grayItem.id] }), err => err.code === '23503');
    // Blake is a member of both closets, so he can see the item - still refused.
    assert.equal((await joinByPassphrase(u.blake.db, grayOriginalPassphrase)).data, GRAY_CLOSET);
    try {
      await assert.rejects(
        updateOutfit(u.blake.db, outfit, { itemIds: [...outfit.item_ids, grayItem.id], name: `${P} mixed` }),
        err => err.code === '22023' && /different closet/.test(err.message),
      );
    } finally {
      await u.blake.db.from('closet_collaborators').delete().eq('closet_id', GRAY_CLOSET).eq('user_id', u.blake.id);
    }
    const after = await getOutfit(u.ava.db, outfit.id);
    assert.deepEqual(after.item_ids, outfit.item_ids);
    assert.equal(after.name, outfit.name);
    assert.equal(after.updated_at, outfit.updated_at);
  });

  test('a deleted item id is rejected and the whole save rolls back', async () => {
    const { item, outfit, a } = await pairWithSpares();
    assert.equal(await deleteWithOcc(u.blake.db, 'clothing_items', a.id, a.updated_at), 'ok');
    await assert.rejects(
      updateOutfit(u.ava.db, outfit, { name: `${P} partial`, itemIds: [item.id, a.id] }),
      err => err.code === '23503',
    );
    const after = await getOutfit(u.ava.db, outfit.id);
    assert.deepEqual(after.item_ids, [item.id]);
    assert.equal(after.name, outfit.name);
    assert.equal(after.updated_at, outfit.updated_at);
  });

  test('an empty item list is rejected', async () => {
    const { outfit } = await freshPair();
    await assert.rejects(updateOutfit(u.ava.db, outfit, { itemIds: [] }), err => err.code === '22023');
    assert.deepEqual((await getOutfit(u.ava.db, outfit.id)).item_ids, outfit.item_ids);
  });

  test('a non-member (Emerson) cannot change the items', async () => {
    const { outfit, a } = await pairWithSpares();
    assert.equal(await updateOutfit(u.emerson.db, outfit, { itemIds: [a.id] }), 'conflict');
    const after = await getOutfit(u.ava.db, outfit.id);
    assert.deepEqual(after.item_ids, outfit.item_ids);
    assert.equal(after.updated_at, outfit.updated_at);
  });

  test('a compliment in between does not make an items edit conflict', async () => {
    const { item, outfit, a } = await pairWithSpares();
    await logCompliment(u.blake.db, outfit.id);
    assert.equal(await updateOutfit(u.ava.db, outfit, { itemIds: [item.id, a.id] }), 'ok');
    assert.deepEqual((await getOutfit(u.ava.db, outfit.id)).item_ids, [item.id, a.id].sort());
  });
});

// ---- 5. Timestamp tokens ----------------------------------------------------

describe('5. updated_at token precision', () => {
  test('token round-trips exactly and rapid saves never false-conflict', async () => {
    const { outfit } = await freshPair();
    assert.match(outfit.updated_at, /\.\d{1,6}\+00:00$/, 'microsecond timestamp string from PostgREST');
    const seen = new Set([outfit.updated_at]);
    let current = outfit;
    for (let i = 0; i < 15; i++) {
      assert.equal(await updateOutfit(u.ava.db, current, { name: `${P} v${i}` }), 'ok', `save ${i} false-conflicted`);
      current = await getOutfit(u.ava.db, outfit.id);
      assert.ok(!seen.has(current.updated_at), `duplicate token after save ${i}`);
      seen.add(current.updated_at);
    }
  });

  test('a JS Date round-trip (millisecond truncation) would conflict - tokens must stay strings', async () => {
    const { outfit } = await freshPair();
    const truncated = new Date(outfit.updated_at).toISOString();
    if (truncated === outfit.updated_at) return; // exact-millisecond timestamp, nothing to show
    assert.equal(await updateOutfit(u.ava.db, { ...outfit, updated_at: truncated }, {}), 'conflict');
  });
});

// ---- 6. RLS -----------------------------------------------------------------

describe('6. RLS', () => {
  test('non-member (Emerson) cannot read, update or delete Ava\'s rows', async () => {
    const { item, outfit } = await freshPair();
    const e = u.emerson.db;
    assert.equal(await getOutfit(e, outfit.id), null);
    assert.equal(await getItem(e, item.id), null);
    assert.equal(await updateOutfit(e, outfit, { name: `${P} hacked` }), 'conflict');
    assert.equal(await updateItem(e, item, { name: `${P} hacked` }), 'conflict');
    assert.equal(await deleteWithOcc(e, 'outfits', outfit.id, outfit.updated_at), 'conflict');
    assert.equal(await deleteWithOcc(e, 'clothing_items', item.id, item.updated_at), 'conflict');
    const closet = await e.from('closets').select('id, outfit_labels').eq('id', AVA_CLOSET);
    assert.deepEqual(closet.data, []);
    const tag = await e.rpc('add_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: TEST_TAG });
    assert.ok(tag.error);
    const comp = await e.rpc('increment_outfit_compliment_count', { target_outfit_id: outfit.id });
    assert.ok(comp.error);
    const wear = await e.from('wear_logs').insert({ closet_id: AVA_CLOSET, outfit_id: outfit.id, user_id: u.emerson.id });
    assert.ok(wear.error);
    const link = await e.from('outfit_items').insert({ outfit_id: outfit.id, clothing_item_id: item.id });
    assert.ok(link.error);
    assert.equal((await getOutfit(u.ava.db, outfit.id)).name, outfit.name);
  });

  test('voice notes: stylist records, non-member can\'t see or add, owner can delete stylist\'s note', async () => {
    const { outfit } = await freshPair();
    const note = { closet_id: AVA_CLOSET, outfit_id: outfit.id, audio_url: `http://x/${P}/note.m4a`, duration_seconds: 5 };
    const added = await u.blake.db.from('voice_notes').insert(note).select('id').single();
    assert.ifError(added.error);
    const seen = await u.emerson.db.from('voice_notes').select('id').eq('outfit_id', outfit.id);
    assert.deepEqual(seen.data, []);
    const intruder = await u.emerson.db.from('voice_notes').insert(note);
    assert.ok(intruder.error);
    // Casey (another stylist) can't delete Blake's note; Ava (owner) can.
    const casey = await u.casey.db.from('voice_notes').delete().eq('id', added.data.id).select('id').maybeSingle();
    assert.equal(casey.data, null);
    const ava = await u.ava.db.from('voice_notes').delete().eq('id', added.data.id).select('id').maybeSingle();
    assert.equal(ava.data?.id, added.data.id);
  });

  test('stylist (Blake) cannot do owner-only things', async () => {
    const b = u.blake.db;
    const rename = await b.from('closets').update({ closet_name: `${P} hijack` }).eq('id', AVA_CLOSET).select('id');
    assert.deepEqual(rename.data, []);
    const del = await b.from('closets').delete().eq('id', AVA_CLOSET).select('id');
    assert.deepEqual(del.data, []);
    const phrase = await b.from('closets').update({ pass_phrase: 'zztest0000' }).eq('id', AVA_CLOSET).select('id');
    assert.deepEqual(phrase.data, []);
    const tag = await b.rpc('add_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: TEST_TAG });
    assert.match(tag.error?.message ?? '', /Only the closet owner/);
    const untag = await b.rpc('remove_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: 'Work' });
    assert.match(untag.error?.message ?? '', /Only the closet owner/);
    const invite = await b.from('closet_collaborators').insert({ closet_id: AVA_CLOSET, user_id: u.emerson.id });
    assert.ok(invite.error, 'stylist cannot add collaborators');
    const kick = await b.from('closet_collaborators').delete().eq('closet_id', AVA_CLOSET).eq('user_id', u.casey.id).select('id');
    assert.deepEqual(kick.data, [], 'stylist cannot remove another stylist');
    // The owner has no closet_collaborators row, so there is nothing to remove.
    const owner = await u.ava.db.from('closet_collaborators').select('id').eq('closet_id', AVA_CLOSET).eq('user_id', u.ava.id);
    assert.deepEqual(owner.data, []);
  });

  test('stylist CAN do what the UI offers: edit, delete, log compliments/wears, read tags', async () => {
    const { item, outfit } = await freshPair();
    const b = u.blake.db;
    assert.equal(await updateItem(b, item, { name: `${P} by blake` }), 'ok');
    assert.ok((await logCompliment(b, outfit.id)) >= 1);
    const wear = await b.from('wear_logs').insert({ closet_id: AVA_CLOSET, outfit_id: outfit.id, user_id: u.blake.id, worn_on_date: '2026-01-01' });
    assert.ifError(wear.error);
    const tags = await b.from('closets').select('outfit_labels').eq('id', AVA_CLOSET).single();
    assert.ok(Array.isArray(tags.data.outfit_labels));
    const fresh = await getOutfit(b, outfit.id);
    assert.equal(await deleteWithOcc(b, 'outfits', fresh.id, fresh.updated_at), 'ok');
  });

  test.todo('stylist cannot read the closet passphrase (column is readable via "Members can view their closets")', async () => {
    const { data } = await u.blake.db.from('closets').select('pass_phrase').eq('id', AVA_CLOSET).single();
    assert.equal(data.pass_phrase, undefined);
  });
});

// ---- 7. Joining -------------------------------------------------------------

describe('7. join by passphrase', () => {
  test('join twice, own closet, wrong phrase, after the phrase changed', async () => {
    const b = u.blake.db;
    const first = await joinByPassphrase(b, grayOriginalPassphrase);
    assert.equal(first.data, GRAY_CLOSET);
    const second = await joinByPassphrase(b, grayOriginalPassphrase);
    assert.equal(second.data, GRAY_CLOSET, 'joining again is a no-op, not an error');
    const rows = await b.from('closet_collaborators').select('id').eq('closet_id', GRAY_CLOSET).eq('user_id', u.blake.id);
    assert.equal(rows.data.length, 1);

    assert.match((await joinByPassphrase(u.gray.db, grayOriginalPassphrase)).error?.message ?? '', /already own/);
    assert.match((await joinByPassphrase(b, 'zz-not-a-phrase')).error?.message ?? '', /Invalid passphrase/);

    // Blake leaves; Gray changes the phrase (owner UPDATE; the app has no regenerate flow).
    await b.from('closet_collaborators').delete().eq('closet_id', GRAY_CLOSET).eq('user_id', u.blake.id);
    const changed = await u.gray.db.from('closets').update({ pass_phrase: 'zztest1234' }).eq('id', GRAY_CLOSET).select('id');
    assert.equal(changed.data.length, 1);
    assert.match((await joinByPassphrase(b, grayOriginalPassphrase)).error?.message ?? '', /Invalid passphrase/);
    assert.equal((await joinByPassphrase(b, 'zztest1234')).data, GRAY_CLOSET);
  });
});

// ---- 8. Closet tags ---------------------------------------------------------

describe('8. closet outfit tags', () => {
  test('owner removes a tag while a stylist saves an outfit with it: save succeeds, outfit keeps it', async () => {
    const add = await u.ava.db.rpc('add_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: TEST_TAG });
    assert.ifError(add.error);
    const { outfit } = await freshPair();
    const blakeCopy = await getOutfit(u.blake.db, outfit.id);
    const removed = await u.ava.db.rpc('remove_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: TEST_TAG });
    assert.ok(!removed.data.includes(TEST_TAG));
    assert.equal(await updateOutfit(u.blake.db, blakeCopy, { labels: [TEST_TAG] }), 'ok', 'tag removal must not bump outfit tokens');
    assert.deepEqual((await getOutfit(u.ava.db, outfit.id)).labels, [TEST_TAG]);
  });

  test('two concurrent tag adds both land', async () => {
    const tags = [`${P} a`, `${P} b`];
    const results = await Promise.all(tags.map(t => u.ava.db.rpc('add_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: t })));
    try {
      results.forEach(r => assert.ifError(r.error));
      const { data } = await u.ava.db.from('closets').select('outfit_labels').eq('id', AVA_CLOSET).single();
      for (const t of tags) assert.ok(data.outfit_labels.includes(t));
    } finally {
      for (const t of tags) await u.ava.db.rpc('remove_closet_outfit_label', { target_closet_id: AVA_CLOSET, target_label: t });
    }
  });
});

// ---- 9. Counters ------------------------------------------------------------

describe('9. compliments and wear logs', () => {
  test('20 concurrent compliments from two users all count', async () => {
    const { outfit } = await freshPair();
    await Promise.all(Array.from({ length: 20 }, (_, i) => logCompliment(i % 2 ? u.ava.db : u.blake.db, outfit.id)));
    assert.equal((await getOutfit(u.ava.db, outfit.id)).compliment_count, 20);
  });

  test('a compliment does not invalidate an open edit form (no false conflict)', async () => {
    const { outfit } = await freshPair();
    const avaCopy = await getOutfit(u.ava.db, outfit.id);
    await logCompliment(u.blake.db, outfit.id);
    assert.equal(await updateOutfit(u.ava.db, avaCopy, { name: `${P} after compliment` }), 'ok');
  });

  test('logging a compliment then deleting the outfit from the same detail page works', async () => {
    // outfitDetailPage keeps outfit.updatedAt from load; logCompliment used to bump it.
    const { outfit } = await freshPair();
    await logCompliment(u.ava.db, outfit.id);
    assert.equal(await deleteWithOcc(u.ava.db, 'outfits', outfit.id, outfit.updated_at), 'ok');
  });

  test('wear logs from two users at once both count', async () => {
    const { outfit } = await freshPair();
    const today = '2026-01-02';
    const rows = await Promise.all([u.ava, u.blake].map(x =>
      x.db.from('wear_logs').insert({ closet_id: AVA_CLOSET, outfit_id: outfit.id, user_id: x.id, worn_on_date: today })));
    rows.forEach(r => assert.ifError(r.error));
    const { count } = await u.ava.db.from('wear_logs').select('id', { count: 'exact', head: true }).eq('closet_id', AVA_CLOSET).eq('outfit_id', outfit.id);
    assert.equal(count, 2);
  });

  test.todo('the same user logging "worn today" from two devices creates one row (no unique constraint today)', async () => {
    const { outfit } = await freshPair();
    const insert = () => u.ava.db.from('wear_logs').insert({ closet_id: AVA_CLOSET, outfit_id: outfit.id, user_id: u.ava.id, worn_on_date: '2026-01-03' });
    await Promise.all([insert(), insert()]);
    const { count } = await u.ava.db.from('wear_logs').select('id', { count: 'exact', head: true }).eq('outfit_id', outfit.id);
    assert.equal(count, 1);
  });
});

// ---- 10. Other races --------------------------------------------------------

describe('10. other races', () => {
  test('creating your own closet from two devices at once yields one closet', async () => {
    // Blake owns no closet. getOwnCloset uses maybeSingle(), so a second row
    // would make "Failed to load your closet" permanent for this user.
    const create = () => u.blake.db.from('closets').insert({ owner_id: u.blake.id, closet_name: `${P} closet` }).select('id').single();
    const results = await Promise.all([create(), create()]);
    assert.equal(results.filter(r => !r.error).length, 1);
    assert.equal(results.find(r => r.error).error.code, '23505');
    const own = await u.blake.db.from('closets').select('id').eq('owner_id', u.blake.id).maybeSingle();
    assert.ifError(own.error);
  });

  test('two users replacing an item\'s primary photo at once leave exactly one primary', async () => {
    const item = await createItem(u.ava.db, 'photo race');
    await Promise.all([replacePrimaryPhoto(u.ava.db, item.id, 'ava'), replacePrimaryPhoto(u.blake.db, item.id, 'blake')]);
    const { data } = await u.ava.db.from('clothing_item_photos').select('image_url').eq('clothing_item_id', item.id).eq('is_primary', true);
    assert.equal(data.length, 1);
  });

  test('a stale edit with a new photo is refused before the photo is written', async () => {
    const item = await createItem(u.ava.db, 'stale photo');
    assert.equal(await updateItem(u.blake.db, item, { name: `${P} blake` }), 'ok');
    // updateClosetItem checks the token before replacing the photo.
    assert.equal(await checkUnchanged(u.ava.db, 'clothing_items', item.id, item.updated_at), 'conflict');
  });
});
