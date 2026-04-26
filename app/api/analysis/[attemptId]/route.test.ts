import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { getDb, __resetDbCache } from "@/lib/db";
import { seedProblems } from "@/lib/seed";
import { createUser } from "@/lib/auth/users";

vi.mock("@/lib/auth/current-user", () => ({ requireUserId: vi.fn() }));
vi.mock("@/lib/analysis/pipeline", () => ({ runPipeline: vi.fn() }));

import { requireUserId } from "@/lib/auth/current-user";
import { runPipeline } from "@/lib/analysis/pipeline";
import { GET, POST } from "./route";

async function setup() {
  __resetDbCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "analysis-route-"));
  const file = path.join(dir, "test.db");
  const db = getDb(file);
  seedProblems(db);
  const user = await createUser(db, "u@example.com", "pw");
  const other = await createUser(db, "o@example.com", "pw");
  const info = db
    .prepare(
      `INSERT INTO attempts (user_id, problem_id, code, status) VALUES (?, ?, ?, ?)`,
    )
    .run(user.id, 1, "def f(): pass", "passed");
  const attemptId = Number(info.lastInsertRowid);
  return { db, userId: user.id, otherId: other.id, attemptId };
}

function makeReq(attemptId: string | number) {
  return new NextRequest(new URL(`http://localhost/api/analysis/${attemptId}`));
}

describe("api/analysis/[attemptId] route", () => {
  beforeEach(() => {
    vi.mocked(requireUserId).mockReset();
    vi.mocked(runPipeline).mockReset();
  });

  it("GET returns {rows: []} for owned attempt with no analyses", async () => {
    const { userId, attemptId } = await setup();
    vi.mocked(requireUserId).mockResolvedValue(userId);

    const res = await GET(makeReq(attemptId), {
      params: Promise.resolve({ attemptId: String(attemptId) }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it("GET returns 404 for unknown attempt", async () => {
    const { userId } = await setup();
    vi.mocked(requireUserId).mockResolvedValue(userId);

    const res = await GET(makeReq(99999), {
      params: Promise.resolve({ attemptId: "99999" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET returns 404 when attempt belongs to another user", async () => {
    const { otherId, attemptId } = await setup();
    vi.mocked(requireUserId).mockResolvedValue(otherId);

    const res = await GET(makeReq(attemptId), {
      params: Promise.resolve({ attemptId: String(attemptId) }),
    });
    expect(res.status).toBe(404);
  });

  it("GET returns 400 for non-numeric attemptId", async () => {
    const { userId } = await setup();
    vi.mocked(requireUserId).mockResolvedValue(userId);

    const res = await GET(makeReq("abc"), {
      params: Promise.resolve({ attemptId: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST triggers runPipeline (fire-and-forget) and returns current rows immediately", async () => {
    const { userId, attemptId } = await setup();
    vi.mocked(requireUserId).mockResolvedValue(userId);
    // Never resolves: ensures POST does not await it.
    vi.mocked(runPipeline).mockImplementation(() => new Promise(() => {}));

    const res = await POST(makeReq(attemptId), {
      params: Promise.resolve({ attemptId: String(attemptId) }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
    expect(vi.mocked(runPipeline)).toHaveBeenCalledOnce();
  });

  it("POST returns 404 for wrong user and does NOT call runPipeline", async () => {
    const { otherId, attemptId } = await setup();
    vi.mocked(requireUserId).mockResolvedValue(otherId);

    const res = await POST(makeReq(attemptId), {
      params: Promise.resolve({ attemptId: String(attemptId) }),
    });
    expect(res.status).toBe(404);
    expect(vi.mocked(runPipeline)).not.toHaveBeenCalled();
  });

  it("POST returns 400 for non-numeric attemptId", async () => {
    const { userId } = await setup();
    vi.mocked(requireUserId).mockResolvedValue(userId);

    const res = await POST(makeReq("abc"), {
      params: Promise.resolve({ attemptId: "abc" }),
    });
    expect(res.status).toBe(400);
    expect(vi.mocked(runPipeline)).not.toHaveBeenCalled();
  });
});
