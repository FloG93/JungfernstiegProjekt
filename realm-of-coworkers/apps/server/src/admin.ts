// Verwaltung per Kommandozeile (16.6): Passwort zurücksetzen, Helden für Tests und Support ausstatten.
// Aufruf: pnpm admin <befehl> … (Datenbank aus DB_PATH, Inhalte aus CONTENT_DIR wie beim Server).
import { RARITY_IDS, Rng, SLOT_IDS, createItem, loadContent } from '@aethra/shared';
import type { ClassId, GemId, RarityId, SlotId } from '@aethra/shared';
import { readContentFiles } from '@aethra/shared/node';
import { hashPassword } from './auth';
import { loadConfig } from './config';
import { migrate, openDb } from './db/db';
import { insertItem } from './game/heroes';

const HELP = `Befehle:
  reset-password <benutzer> <neues-passwort>   Passwort setzen, alle Sitzungen beenden
  gold <held> <betrag>                         Gold gutschreiben
  splinters <held> <anzahl>                    Artefaktsplitter gutschreiben
  level <held> <stufe>                         Heldenstufe setzen
  gear <held> <ilvl> [seltenheit]              vollständige Ausrüstung anlegen (ersetzt angelegte Gegenstände)
  item <held> <slot> <ilvl> [seltenheit]       Gegenstand ins Inventar legen
  gems <held> <art> <stufe> <anzahl>           Gems in den Beutel legen
  weapon-level <held> <stufe>                  Waffenstufe der Waffe in Satz A setzen
  clear <held> <bis-stage>                     Stages 1 bis n als abgeschlossen eintragen`;

const EQUIP: Record<Exclude<SlotId, 'waffe'>, string> = {
  ruestung: 'Ruestung', nebenhand: 'Nebenhand', helm: 'Helm', handschuhe: 'Handschuhe', umhang: 'Umhang', stiefel: 'Stiefel',
};

function num(s: string | undefined, what: string): number {
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${what} fehlt oder ist keine Zahl`);
  return n;
}

async function main(argv: string[]): Promise<void> {
  const [cmd, ...a] = argv;
  if (!cmd || cmd === 'help') {
    console.log(HELP);
    return;
  }
  const env = { SESSION_SECRET: 'nur-fuer-die-verwaltung', INVITE_CODE: '-', ...process.env };
  const config = loadConfig(env);
  const content = loadContent(readContentFiles(config.contentDir).raw);
  const { db, raw } = openDb(config.dbPath);
  await migrate(db);
  const now = Date.now();
  const hero = async (name: string | undefined) => {
    const h = await db.selectFrom('heroes').selectAll().where('name', '=', name ?? '').executeTakeFirst();
    if (!h) throw new Error(`Held ${name ?? '?'} nicht gefunden`);
    return h;
  };
  try {
    switch (cmd) {
      case 'reset-password': {
        const acc = await db.selectFrom('accounts').selectAll().where('username', '=', a[0] ?? '').executeTakeFirst();
        if (!acc) throw new Error(`Konto ${a[0] ?? '?'} nicht gefunden`);
        if (!a[1] || a[1].length < content.engine.limits.passwordMin) throw new Error(`Passwort mindestens ${content.engine.limits.passwordMin} Zeichen`);
        await db.updateTable('accounts').set({ pw_hash: await hashPassword(a[1]) }).where('id', '=', acc.id).execute();
        await db.deleteFrom('sessions').where('account_id', '=', acc.id).execute();
        console.log(`Passwort von ${acc.username} gesetzt, Sitzungen beendet.`);
        break;
      }
      case 'gold':
      case 'splinters': {
        const h = await hero(a[0]);
        const n = num(a[1], 'Betrag');
        if (cmd === 'gold') await db.updateTable('heroes').set({ gold: h.gold + n }).where('id', '=', h.id).execute();
        else await db.updateTable('heroes').set({ splinters: h.splinters + n }).where('id', '=', h.id).execute();
        console.log(`${h.name}: +${n} ${cmd === 'gold' ? 'Gold' : 'Splitter'}`);
        break;
      }
      case 'level': {
        const h = await hero(a[0]);
        const l = Math.max(1, Math.min(content.balance.stats.maxLevel, num(a[1], 'Stufe')));
        await db.updateTable('heroes').set({ level: l, xp: 0 }).where('id', '=', h.id).execute();
        console.log(`${h.name}: Stufe ${l}`);
        break;
      }
      case 'gear': {
        const h = await hero(a[0]);
        const ilvl = num(a[1], 'iLvl');
        const rarity = (a[2] ?? 'selten') as RarityId;
        if (!RARITY_IDS.includes(rarity)) throw new Error(`Seltenheit: ${RARITY_IDS.join(', ')}`);
        const rng = new Rng(h.id * 7919 + ilvl);
        await db.transaction().execute(async (trx) => {
          await trx.updateTable('items').set({ equip_slot: null }).where('hero_id', '=', h.id).execute();
          await insertItem(trx, h.id, createItem(content, rng, { classId: h.class as ClassId, slot: 'waffe', ilvl, rarity, element: 'eis' }), now, 'Waffe_A');
          for (const [slot, eq] of Object.entries(EQUIP)) {
            await insertItem(trx, h.id, createItem(content, rng, { classId: h.class as ClassId, slot: slot as SlotId, ilvl, rarity }), now, eq as never);
          }
        });
        console.log(`${h.name}: Ausrüstung iLvl ${ilvl} (${rarity}) angelegt`);
        break;
      }
      case 'item': {
        const h = await hero(a[0]);
        const slot = a[1] as SlotId;
        if (!SLOT_IDS.includes(slot)) throw new Error(`Slot: ${SLOT_IDS.join(', ')}`);
        const ilvl = num(a[2], 'iLvl');
        const rarity = (a[3] ?? 'selten') as RarityId;
        const it = createItem(content, new Rng(now % 100_000), { classId: h.class as ClassId, slot, ilvl, rarity, ...(slot === 'waffe' ? { element: 'feuer' as const } : {}) });
        const id = await insertItem(db, h.id, it, now);
        console.log(`${h.name}: ${it.name} (ID ${id}) ins Inventar gelegt`);
        break;
      }
      case 'gems': {
        const h = await hero(a[0]);
        const kind = a[1] as GemId;
        const tier = num(a[2], 'Stufe');
        const count = num(a[3], 'Anzahl');
        for (let i = 0; i < count; i++) await db.insertInto('gems').values({ hero_id: h.id, kind, tier, socket: null }).execute();
        console.log(`${h.name}: ${count} × ${kind} Stufe ${tier}`);
        break;
      }
      case 'weapon-level': {
        const h = await hero(a[0]);
        const l = Math.max(1, Math.min(content.balance.weapon.maxLevel, num(a[1], 'Stufe')));
        await db.updateTable('items').set({ weapon_level: l, weapon_xp: 0 }).where('hero_id', '=', h.id).where('equip_slot', '=', 'Waffe_A').execute();
        console.log(`${h.name}: Waffenstufe ${l}`);
        break;
      }
      case 'clear': {
        const h = await hero(a[0]);
        const n = num(a[1], 'Stage');
        for (let s = 1; s <= n; s++) {
          await db.insertInto('stage_progress').values({ hero_id: h.id, stage: s, clears: 1, best_time_ms: null })
            .onConflict((oc) => oc.columns(['hero_id', 'stage']).doNothing()).execute();
        }
        console.log(`${h.name}: Stages 1 bis ${n} abgeschlossen`);
        break;
      }
      default:
        console.log(HELP);
        process.exitCode = 1;
    }
  } finally {
    await db.destroy();
    if (raw.open) raw.close();
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
