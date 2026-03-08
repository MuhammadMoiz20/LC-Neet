import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";

export type User = { id: number; email: string };

export async function createUser(
  db: Database.Database,
  email: string,
  password: string,
): Promise<User> {
  const hash = await bcrypt.hash(password, 12);
  const info = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, hash);
  return { id: Number(info.lastInsertRowid), email };
}

export async function verifyPassword(
  db: Database.Database,
  email: string,
  password: string,
): Promise<User | null> {
  const row = db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; password_hash: string } | undefined;
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  return ok ? { id: row.id, email: row.email } : null;
}
