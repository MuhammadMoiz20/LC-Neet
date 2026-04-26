import { requireUserId } from "@/lib/auth/current-user";
import { startInterview } from "./start";

export const dynamic = "force-dynamic";

export default async function InterviewLandingPage() {
  await requireUserId();
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Mock Interview</h1>
      <p className="text-sm text-zinc-400 mb-6">
        30-minute timed session. The coach acts as an interviewer — clarifying
        questions only, no hints. Test results are hidden.
      </p>
      <form action={startInterview}>
        <button
          type="submit"
          className="px-4 py-2 rounded bg-emerald-600 text-white"
        >
          Start 30-min session
        </button>
      </form>
    </main>
  );
}
