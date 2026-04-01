export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    const { seedProblems } = await import("./lib/seed");
    seedProblems(getDb());
  }
}
