// Tests for 20261111000000_closet_outfit_labels.sql: loads every earlier migration,
// creates a closet the way it existed before the change, then applies the tag
// migration so the backfill is exercised too. Run like sanity.mjs.
import { loadDatabase, asUser, MIGRATIONS_DIR } from './rig.mjs';
import path from 'path';
// Closet that exists before the migration -> backfill check
const { db } = await loadDatabase({ upTo: '20261013999999' });
const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', C='00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users (id,email) values ('${A}','a@x'),('${B}','b@x'),('${C}','c@x'); insert into public.users (id,email) values ('${A}','a@x'),('${B}','b@x'),('${C}','c@x') on conflict do nothing;`);
const old = (await asUser(db, A, () => db.query(`insert into public.closets (owner_id, closet_name) values ('${A}','A') returning id`))).rows[0].id;
await db.exec(`insert into public.closet_collaborators (closet_id,user_id) values ('${old}','${B}')`);
const fs = await import('fs');
const MIGRATION = path.join(MIGRATIONS_DIR, '20261111000000_closet_outfit_labels.sql');
await db.exec(fs.readFileSync(MIGRATION, 'utf8'));
let pass=0, fail=0;
const ok=(c,m)=>{ c?pass++:fail++; console.log(c?'PASS':'FAIL', m); };
const q = async (uid, sql) => { try { return { rows: (await asUser(db, uid, () => db.query(sql))).rows }; } catch(e) { return { err: e.message }; } };
const list = async () => (await db.query(`select outfit_labels l from closets where id='${old}'`)).rows[0].l;
ok((await list()).length===10, 'existing closet backfilled with 10 defaults');
const fresh = await q(C, `insert into public.closets (owner_id, closet_name) values ('${C}','C') returning outfit_labels`);
ok(fresh.rows?.[0].outfit_labels.length===10, 'new closet gets 10 defaults');
let r = await q(A, `select add_closet_outfit_label('${old}', '  Vin   tage ') x`); ok(r.rows?.[0].x.at(-1)==='Vin tage', 'owner add normalises + appends');
r = await q(A, `select add_closet_outfit_label('${old}', 'casual ') x`); ok(r.err?.includes('You already have a tag named "Casual"'), 'dup ignoring case: '+r.err);
r = await q(A, `select add_closet_outfit_label('${old}', 'ALL') x`); ok(r.err?.includes('"All" is already used'), 'All reserved: '+r.err);
r = await q(A, `select add_closet_outfit_label('${old}', E'\u200B\u200B') x`); ok(r.err==='Enter a tag name.', 'zero-width only rejected: '+r.err);
r = await q(A, `select add_closet_outfit_label('${old}', E'bell\x07x') x`); ok(r.rows?.[0].x.at(-1)==='bell x', 'control char becomes space: '+JSON.stringify(r));
r = await q(A, `select add_closet_outfit_label('${old}', E'Zero\u200Bwidth') x`); ok(r.rows?.[0].x.at(-1)==='Zerowidth', 'zero-width stripped');
r = await q(A, `select add_closet_outfit_label('${old}', repeat('x',31)) x`); ok(r.err==='Tags can be up to 30 characters.', 'too long');
r = await q(A, `select add_closet_outfit_label('${old}', 'First', 1) x`); ok(r.rows?.[0].x[0]==='First', 'insert at position 1');
r = await q(A, `select add_closet_outfit_label('${old}', 'Mid', 3) x`); ok(r.rows?.[0].x[2]==='Mid', 'insert at position 3');
r = await q(B, `select add_closet_outfit_label('${old}', 'Stylist') x`); ok(r.err?.includes('Only the closet owner'), 'stylist cannot add');
r = await q(B, `select remove_closet_outfit_label('${old}', 'Work') x`); ok(r.err?.includes('Only the closet owner'), 'stylist cannot remove');
r = await q(B, `select outfit_labels from closets where id='${old}'`); ok(r.rows?.length===1, 'stylist can read list');
r = await q(C, `select outfit_labels from closets where id='${old}'`); ok(r.rows?.length===0, 'stranger cannot read list');
r = await q(A, `select remove_closet_outfit_label('${old}', 'Work') x`); ok(!r.rows?.[0].x.includes('Work'), 'owner remove');
r = await q(A, `select remove_closet_outfit_label('${old}', 'Work') x`); ok(!!r.rows, 'remove idempotent');
r = await q(A, `update closets set outfit_labels=array['a','A'] where id='${old}'`); ok(r.err?.includes('closets_outfit_labels_valid'), 'CHECK: case dup');
r = await q(A, `update closets set outfit_labels=array['all'] where id='${old}'`); ok(r.err?.includes('closets_outfit_labels_valid'), 'CHECK: all');
r = await q(A, `update closets set outfit_labels=array[E'a\u200Bb'] where id='${old}'`); ok(r.err?.includes('closets_outfit_labels_valid'), 'CHECK: zero-width');
r = await q(A, `update closets set outfit_labels=array[' a'] where id='${old}'`); ok(r.err?.includes('closets_outfit_labels_valid'), 'CHECK: untrimmed');
r = await q(A, `update closets set outfit_labels=array[null]::text[] where id='${old}'`); ok(r.err?.includes('closets_outfit_labels_valid'), 'CHECK: null');
r = await q(A, `update closets set outfit_labels=(select array_agg('t'||g) from generate_series(1,31) g) where id='${old}'`); ok(r.err?.includes('closets_outfit_labels_valid'), 'CHECK: 31 tags');
r = await q(A, `update closets set outfit_labels='{}' where id='${old}' returning outfit_labels`); ok(r.rows?.length===1, 'CHECK: empty allowed');
r = await q(A, `select add_closet_outfit_label('${old}', 'Only') x`); ok(r.rows?.[0].x.length===1, 'add into empty list');
await q(A, `update closets set outfit_labels=(select array_agg('t'||g) from generate_series(1,30) g) where id='${old}'`);
r = await q(A, `select add_closet_outfit_label('${old}', 'Extra') x`); ok(r.err?.includes('up to 30 tags'), 'full list: '+r.err);
// outfits labels edit by stylist still allowed (Edit outfit tags)
const o = await q(A, `insert into outfits (closet_id, created_by_user_id, name, description, labels) values ('${old}','${A}','O','d','{Work}') returning id`);
r = await q(B, `update outfits set labels='{t1,t2}' where id='${o.rows[0].id}' returning labels`); ok(r.rows?.[0]?.labels.length===2, 'stylist can edit an outfit\'s tags');
console.log(`${pass} passed, ${fail} failed`);
