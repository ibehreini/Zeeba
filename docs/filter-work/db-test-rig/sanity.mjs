import { loadDatabase, asUser } from './rig.mjs';
const { db } = await loadDatabase();
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
await db.exec(`insert into auth.users (id, email) values ('${A}','a@x.com'),('${B}','b@x.com');`);
console.log('public.users after auth insert (trigger):', (await db.query('select id, email from public.users order by email')).rows.length, 'rows');
await db.exec(`insert into public.users (id, email) values ('${A}','a@x.com'),('${B}','b@x.com') on conflict do nothing;`);
const ca = await asUser(db, A, () => db.query(`insert into public.closets (owner_id, closet_name) values ('${A}','A closet') returning id`));
const cb = await asUser(db, B, () => db.query(`insert into public.closets (owner_id, closet_name) values ('${B}','B closet') returning id`));
const seenByA = await asUser(db, A, () => db.query('select closet_name from public.closets'));
console.log('A sees:', seenByA.rows.map(r => r.closet_name));
const upd = await asUser(db, A, () => db.query(`update public.closets set closet_name='hacked' where id='${cb.rows[0].id}' returning id`));
console.log('A updating B closet affected rows:', upd.rows.length, '(expect 0)');
try { await asUser(db, A, () => db.query(`insert into public.closets (owner_id, closet_name) values ('${B}','forged')`)); console.log('forged insert: ALLOWED (bad)'); } catch (e) { console.log('forged insert rejected:', e.message.slice(0, 80)); }
const pol = await db.query(`select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('closets','outfits') order by 1,2`);
console.log(pol.rows.map(r => `${r.tablename}: ${r.policyname} [${r.cmd}]`).join('\n'));
const trg = await db.query(`select event_object_table t, trigger_name n, string_agg(event_manipulation, '/') ev from information_schema.triggers where trigger_schema='public' group by 1,2 order by 1,2`);
console.log('triggers:\n' + trg.rows.map(r => `  ${r.t}: ${r.n} (${r.ev})`).join('\n'));
