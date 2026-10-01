// Migrationen mit Kysely (2.1, 15.6). Rollback wird nicht unterstützt.
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration, MigrationProvider } from 'kysely/migration';

const migrations: Record<string, Migration> = {
  '0001_init': {
    async up(db: Kysely<unknown>) {
      await db.schema.createTable('accounts')
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('username', 'text', (c) => c.notNull().unique().modifyEnd(sql`collate nocase`))
        .addColumn('pw_hash', 'text', (c) => c.notNull())
        .addColumn('created_at', 'integer', (c) => c.notNull())
        .addColumn('last_login', 'integer')
        .execute();
      await db.schema.createTable('sessions')
        .addColumn('token_hash', 'text', (c) => c.primaryKey())
        .addColumn('account_id', 'integer', (c) => c.notNull().references('accounts.id').onDelete('cascade'))
        .addColumn('created_at', 'integer', (c) => c.notNull())
        .addColumn('expires_at', 'integer', (c) => c.notNull())
        .execute();
      await db.schema.createTable('heroes')
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('account_id', 'integer', (c) => c.notNull().references('accounts.id').onDelete('cascade'))
        .addColumn('name', 'text', (c) => c.notNull().modifyEnd(sql`collate nocase`))
        .addColumn('class', 'text', (c) => c.notNull())
        .addColumn('appearance', 'text', (c) => c.notNull())
        .addColumn('level', 'integer', (c) => c.notNull().defaultTo(1))
        .addColumn('xp', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('gold', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('splinters', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('active_set', 'text', (c) => c.notNull().defaultTo('A'))
        .addColumn('autocast', 'text', (c) => c.notNull().defaultTo('{}'))
        .addColumn('settings', 'text', (c) => c.notNull().defaultTo('{}'))
        .addColumn('created_at', 'integer', (c) => c.notNull())
        .addUniqueConstraint('heroes_account_class', ['account_id', 'class'])
        .addUniqueConstraint('heroes_account_name', ['account_id', 'name'])
        .execute();
      await db.schema.createTable('items')
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('hero_id', 'integer', (c) => c.notNull().references('heroes.id').onDelete('cascade'))
        .addColumn('slot', 'text', (c) => c.notNull())
        .addColumn('ilvl', 'integer', (c) => c.notNull())
        .addColumn('rarity', 'text', (c) => c.notNull())
        .addColumn('budget', 'real', (c) => c.notNull())
        .addColumn('stats', 'text', (c) => c.notNull())
        .addColumn('ele', 'real', (c) => c.notNull().defaultTo(0))
        .addColumn('name', 'text', (c) => c.notNull())
        .addColumn('element', 'text')
        .addColumn('weapon_level', 'integer', (c) => c.notNull().defaultTo(1))
        .addColumn('weapon_xp', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('enchants', 'text', (c) => c.notNull().defaultTo('[]'))
        .addColumn('effect_id', 'text')
        .addColumn('equip_slot', 'text')
        .addColumn('stash', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('locked', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('created_at', 'integer', (c) => c.notNull())
        .execute();
      await sql`create unique index items_equip on items(hero_id, equip_slot) where equip_slot is not null`.execute(db);
      await db.schema.createIndex('items_hero').on('items').column('hero_id').execute();
      await db.schema.createTable('gems')
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('hero_id', 'integer', (c) => c.notNull().references('heroes.id').onDelete('cascade'))
        .addColumn('kind', 'text', (c) => c.notNull())
        .addColumn('tier', 'integer', (c) => c.notNull())
        .addColumn('socket', 'integer')
        .execute();
      await sql`create unique index gems_socket on gems(hero_id, socket) where socket is not null`.execute(db);
      await db.schema.createTable('artifacts')
        .addColumn('hero_id', 'integer', (c) => c.notNull().references('heroes.id').onDelete('cascade'))
        .addColumn('slot', 'text', (c) => c.notNull())
        .addColumn('rank', 'integer', (c) => c.notNull())
        .addPrimaryKeyConstraint('artifacts_pk', ['hero_id', 'slot'])
        .execute();
      await db.schema.createTable('boss_state')
        .addColumn('hero_id', 'integer', (c) => c.notNull().references('heroes.id').onDelete('cascade'))
        .addColumn('boss_id', 'text', (c) => c.notNull())
        .addColumn('first_kill_at', 'integer')
        .addColumn('last_kill_at', 'integer')
        .addColumn('kampfstufe', 'integer', (c) => c.notNull().defaultTo(0))
        .addPrimaryKeyConstraint('boss_state_pk', ['hero_id', 'boss_id'])
        .execute();
      await db.schema.createTable('stage_progress')
        .addColumn('hero_id', 'integer', (c) => c.notNull().references('heroes.id').onDelete('cascade'))
        .addColumn('stage', 'integer', (c) => c.notNull())
        .addColumn('clears', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('best_time_ms', 'integer')
        .addPrimaryKeyConstraint('stage_progress_pk', ['hero_id', 'stage'])
        .execute();
      await db.schema.createTable('story_seen')
        .addColumn('hero_id', 'integer', (c) => c.notNull().references('heroes.id').onDelete('cascade'))
        .addColumn('text_id', 'text', (c) => c.notNull())
        .addPrimaryKeyConstraint('story_seen_pk', ['hero_id', 'text_id'])
        .execute();
      await db.schema.createTable('run_log')
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('seed', 'integer', (c) => c.notNull())
        .addColumn('party', 'text', (c) => c.notNull())
        .addColumn('stage', 'integer', (c) => c.notNull())
        .addColumn('started_at', 'integer', (c) => c.notNull())
        .addColumn('ended_at', 'integer')
        .addColumn('result', 'text')
        .addColumn('events', 'blob')
        .execute();
    },
  },
};

export const migrationProvider: MigrationProvider = {
  getMigrations: async () => migrations,
};
