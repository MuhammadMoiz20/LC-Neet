import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth/current-user";
import { saveMessage, listMessages, type ChatMode } from "@/lib/chat/repo";
import { streamCoach } from "@/lib/agent/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MODES: ChatMode[] = ["socratic", "hints"];

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const problemId = Number(req.nextUrl.searchParams.get("problemId"));
  if (!Number.isFinite(problemId)) {
    return new Response("bad problemId", { status: 400 });
  }
  const messages = listMessages(getDb(), userId, problemId);
  return Response.json({ messages });
}

type PostBody = {
  problemId: number;
  mode: ChatMode;
  userMessage: string;
  code: string;
  lastRunOutput: string | null;
};

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  const body = (await req.json()) as Partial<PostBody>;

  if (
    !Number.isFinite(body.problemId) ||
    !VALID_MODES.includes(body.mode as ChatMode) ||
    typeof body.userMessage !== "string" ||
    body.userMessage.trim() === ""
  ) {
    return new Response("bad request", { status: 400 });
  }

  const db = getDb();
  const problemId = body.problemId!;
  const mode = body.mode as ChatMode;

  saveMessage(db, {
    user_id: userId,
    problem_id: problemId,
    role: "user",
    content: body.userMessage,
    mode,
  });

  const history = listMessages(db, userId, problemId);

  const encoder = new TextEncoder();
  let assistantBuffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of streamCoach({
          mode,
          problemId,
          userId,
          code: body.code ?? "",
          lastRunOutput: body.lastRunOutput ?? null,
          history,
          userMessage: body.userMessage!,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
          if (ev.type === "delta") assistantBuffer += ev.text;
          if (ev.type === "blocked") assistantBuffer = ev.text;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", text: message })}\n\n`),
        );
      } finally {
        if (assistantBuffer.length > 0) {
          saveMessage(db, {
            user_id: userId,
            problem_id: problemId,
            role: "assistant",
            content: assistantBuffer,
            mode,
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
