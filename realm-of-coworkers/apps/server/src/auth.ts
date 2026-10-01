// Konten und Sitzungen (15.1, 16.6): argon2id, Sitzungs-Token als SHA-256 gespeichert, Cookie 30 Tage.
import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Content } from '@aethra/shared';
import type { Db } from './db/db';
import { fail } from './http/errors';

const TOKEN_BYTES = 32;
const MS_PER_DAY = 86_400_000;
export const SESSION_COOKIE = 'aethra_session';
const USERNAME_PATTERN = /^[A-Za-z0-9ÄÖÜäöüß_.-]+$/;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(pw: string): Promise<string> {
  return hash(pw);
}

export async function checkPassword(stored: string, pw: string): Promise<boolean> {
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

export function validateCredentials(content: Content, username: string, password: string): void {
  const l = content.engine.limits;
  const u = username.trim();
  if (u.length < l.usernameMin || u.length > l.usernameMax || !USERNAME_PATTERN.test(u)) {
    fail('BAD_REQUEST', `Benutzername: ${l.usernameMin} bis ${l.usernameMax} Zeichen, Buchstaben, Ziffern, _ . -`);
  }
  if (password.length < l.passwordMin) fail('BAD_REQUEST', `Das Passwort braucht mindestens ${l.passwordMin} Zeichen.`);
}

export async function createSession(db: Db, content: Content, accountId: number, now: number): Promise<{ token: string; expiresAt: number }> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = now + content.engine.limits.sessionDays * MS_PER_DAY;
  await db.insertInto('sessions').values({ token_hash: hashToken(token), account_id: accountId, created_at: now, expires_at: expiresAt }).execute();
  return { token, expiresAt };
}

export interface SessionInfo {
  accountId: number;
  username: string;
  tokenHash: string;
}

export async function sessionFromToken(db: Db, token: string | undefined, now: number): Promise<SessionInfo | null> {
  if (!token) return null;
  const th = hashToken(token);
  const row = await db.selectFrom('sessions')
    .innerJoin('accounts', 'accounts.id', 'sessions.account_id')
    .select(['sessions.account_id', 'sessions.expires_at', 'accounts.username'])
    .where('sessions.token_hash', '=', th)
    .executeTakeFirst();
  if (!row || row.expires_at < now) return null;
  return { accountId: row.account_id, username: row.username, tokenHash: th };
}

export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
  await db.deleteFrom('sessions').where('token_hash', '=', tokenHash).execute();
}

export async function pruneSessions(db: Db, now: number): Promise<void> {
  await db.deleteFrom('sessions').where('expires_at', '<', now).execute();
}

export const sessionMaxAgeS = (content: Content) => (content.engine.limits.sessionDays * MS_PER_DAY) / 1000;
