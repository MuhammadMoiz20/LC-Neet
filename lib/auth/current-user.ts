import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return Number(session.user.id);
}
