import { getDb } from "../lib/db";
import { seedProblems } from "../lib/seed";

const db = getDb();
seedProblems(db);
const count = (db.prepare("SELECT COUNT(*) as c FROM problems").get() as any).c;
console.log(`Seeded ${count} problems.`);
db.close();
