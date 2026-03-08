import { getDb } from "../lib/db";
import { createUser } from "../lib/auth/users";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: tsx scripts/create-user.ts <email> <password>");
  process.exit(1);
}
const db = getDb();
createUser(db, email, password)
  .then((u) => console.log(`Created user ${u.email} (id=${u.id})`))
  .finally(() => db.close());
