/**
 * Reset an existing user's password.
 *
 * Usage: tsx scripts/set-password.ts <email> <password>
 * Targets whatever database getDb() resolves to (remote Turso when
 * TURSO_DATABASE_URL is set, otherwise the local file).
 */
import bcrypt from "bcryptjs";
import { getDb } from "../lib/db";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: tsx scripts/set-password.ts <email> <password>");
  process.exit(1);
}

async function main(): Promise<void> {
  const db = getDb();
  const hash = await bcrypt.hash(password, 12);
  const info = db
    .prepare("UPDATE users SET password_hash = ? WHERE email = ?")
    .run(hash, email);
  if (info.changes === 0) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }
  console.log(`Password updated for ${email}`);
}

main();
