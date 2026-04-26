import type { ReactNode } from "react";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { AppShell } from "@/components/app-shell";
import type { PaletteProblem } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const db = getDb();
  const problems: PaletteProblem[] = listProblems(db).map((p) => ({
    slug: p.slug,
    name: p.title,
    difficulty: p.difficulty,
  }));

  const session = await auth();
  const email = session?.user?.email ?? null;
  const avatarInitials = email ? email.slice(0, 2).toUpperCase() : "?";

  return (
    <AppShell problems={problems} avatarInitials={avatarInitials}>
      {children}
    </AppShell>
  );
}
